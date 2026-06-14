const WATERMARK_KEY = 'growth.daily_metrics.watermark'
const DEFAULT_MAX_DAYS_PER_TICK = 7
const DEFAULT_PURGE_BATCH_SIZE = 5000
const RAW_EVENT_RETENTION_DAYS = 90
const AGGREGATE_RETENTION_MONTHS = 25

function startOfUtcDay(value) {
  return new Date(Date.UTC(
    value.getUTCFullYear(),
    value.getUTCMonth(),
    value.getUTCDate(),
  ))
}

function addUtcDays(value, days) {
  const result = new Date(value)
  result.setUTCDate(result.getUTCDate() + days)
  return result
}

function subtractUtcMonths(value, months) {
  const year = value.getUTCFullYear()
  const month = value.getUTCMonth() - months
  const day = value.getUTCDate()
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  return new Date(Date.UTC(
    year,
    month,
    Math.min(day, lastDay),
    value.getUTCHours(),
    value.getUTCMinutes(),
    value.getUTCSeconds(),
    value.getUTCMilliseconds(),
  ))
}

function metricRetentionCutoff(value) {
  return new Date(Date.UTC(
    value.getUTCFullYear(),
    value.getUTCMonth() - AGGREGATE_RETENTION_MONTHS,
    1,
  ))
}

function dateKey(value) {
  return value.toISOString().slice(0, 10)
}

function parseWatermark(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return null
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function numberValue(value) {
  const numeric = Number(value ?? 0)
  return Number.isFinite(numeric) ? numeric : 0
}

function rowMetrics(row) {
  return {
    visitors: numberValue(row.visitors),
    sessions: numberValue(row.sessions),
    engagedSessions: numberValue(row.engagedSessions),
    pageviews: numberValue(row.pageviews),
    events: numberValue(row.events),
    visibleSeconds: numberValue(row.visibleSeconds),
    conversions: numberValue(row.conversions),
    formViews: numberValue(row.formViews),
    formStarts: numberValue(row.formStarts),
    formSubmits: numberValue(row.formSubmits),
  }
}

function earlierDate(left, right) {
  if (!left) return right
  if (!right) return left
  return left < right ? left : right
}

export function createGrowthRetentionWorker({
  prisma,
  now = () => new Date(),
  maxDaysPerTick = DEFAULT_MAX_DAYS_PER_TICK,
  purgeBatchSize = DEFAULT_PURGE_BATCH_SIZE,
}) {
  async function earliestUnaggregatedDay(today, watermark) {
    if (watermark) return addUtcDays(watermark, 1)
    const [eventResult, sessionResult] = await Promise.all([
      prisma.growthEvent.aggregate({
        where: { serverReceivedAt: { lt: today } },
        _min: { serverReceivedAt: true },
      }),
      prisma.growthSession.aggregate({
        where: { startedAt: { lt: today } },
        _min: { startedAt: true },
      }),
    ])
    const earliest = earlierDate(
      eventResult?._min?.serverReceivedAt ?? null,
      sessionResult?._min?.startedAt ?? null,
    )
    return earliest ? startOfUtcDay(earliest) : null
  }

  async function aggregateDay(dayStart) {
    const dayEnd = addUtcDays(dayStart, 1)
    return prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw`
        WITH growth_event_daily AS (
          SELECT
            company_id,
            site_id,
            COUNT(DISTINCT visitor_id) AS visitors,
            COUNT(*) AS events,
            COUNT(*) FILTER (WHERE event_name = 'page_view') AS pageviews,
            COALESCE(SUM(
              CASE
                WHEN event_name = 'visible_time'
                 AND COALESCE(properties->>'seconds', '') ~ '^[0-9]+([.][0-9]+)?$'
                THEN GREATEST(0, (properties->>'seconds')::numeric)
                ELSE 0
              END
            ), 0) AS visible_seconds,
            COUNT(*) FILTER (
              WHERE event_name IN ('form_submit', 'lead_created', 'converted')
            ) AS conversions,
            COUNT(*) FILTER (WHERE event_name = 'form_view') AS form_views,
            COUNT(*) FILTER (WHERE event_name = 'form_start') AS form_starts,
            COUNT(*) FILTER (WHERE event_name = 'form_submit') AS form_submits
          FROM growth_event
          WHERE server_received_at >= ${dayStart}
            AND server_received_at < ${dayEnd}
          GROUP BY company_id, site_id
        ),
        growth_session_daily AS (
          SELECT
            company_id,
            site_id,
            COUNT(*) AS sessions,
            COUNT(*) FILTER (WHERE engaged = true) AS engaged_sessions
          FROM growth_session
          WHERE started_at >= ${dayStart}
            AND started_at < ${dayEnd}
          GROUP BY company_id, site_id
        )
        SELECT
          COALESCE(event_daily.company_id, session_daily.company_id) AS "companyId",
          COALESCE(event_daily.site_id, session_daily.site_id) AS "siteId",
          COALESCE(event_daily.visitors, 0) AS visitors,
          COALESCE(session_daily.sessions, 0) AS sessions,
          COALESCE(session_daily.engaged_sessions, 0) AS "engagedSessions",
          COALESCE(event_daily.pageviews, 0) AS pageviews,
          COALESCE(event_daily.events, 0) AS events,
          COALESCE(event_daily.visible_seconds, 0) AS "visibleSeconds",
          COALESCE(event_daily.conversions, 0) AS conversions,
          COALESCE(event_daily.form_views, 0) AS "formViews",
          COALESCE(event_daily.form_starts, 0) AS "formStarts",
          COALESCE(event_daily.form_submits, 0) AS "formSubmits"
        FROM growth_event_daily event_daily
        FULL OUTER JOIN growth_session_daily session_daily
          ON session_daily.company_id = event_daily.company_id
         AND session_daily.site_id = event_daily.site_id
      `

      for (const row of rows) {
        await tx.growthDailyMetric.upsert({
          where: {
            siteId_metricDate_dimensionType_dimensionKey: {
              siteId: row.siteId,
              metricDate: dayStart,
              dimensionType: 'site',
              dimensionKey: '',
            },
          },
          create: {
            companyId: row.companyId,
            siteId: row.siteId,
            metricDate: dayStart,
            dimensionType: 'site',
            dimensionKey: '',
            metrics: rowMetrics(row),
          },
          update: {
            metrics: rowMetrics(row),
          },
        })
      }

      await tx.instanceConfig.upsert({
        where: { key: WATERMARK_KEY },
        create: { key: WATERMARK_KEY, value: dateKey(dayStart) },
        update: { value: dateKey(dayStart) },
      })
      return rows.length
    })
  }

  async function purgeModel(model, dateField, cutoff) {
    if (!cutoff) return 0
    const rows = await model.findMany({
      where: { [dateField]: { lt: cutoff } },
      select: { id: true },
      orderBy: { [dateField]: 'asc' },
      take: purgeBatchSize,
    })
    if (!rows.length) return 0
    const result = await model.deleteMany({
      where: { id: { in: rows.map((row) => row.id) } },
    })
    return result.count
  }

  async function purgeExpired(referenceTime, watermark) {
    const watermarkEnd = watermark ? addUtcDays(watermark, 1) : null
    const rawCutoff = new Date(
      referenceTime.getTime() -
        RAW_EVENT_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    )
    const sessionCutoff = subtractUtcMonths(
      referenceTime,
      AGGREGATE_RETENTION_MONTHS,
    )
    const safeEventCutoff = watermarkEnd
      ? earlierDate(rawCutoff, watermarkEnd)
      : null
    const safeSessionCutoff = watermarkEnd
      ? earlierDate(sessionCutoff, watermarkEnd)
      : null

    const [events, sessions, metrics] = await Promise.all([
      purgeModel(
        prisma.growthEvent,
        'serverReceivedAt',
        safeEventCutoff,
      ),
      purgeModel(
        prisma.growthSession,
        'lastSeenAt',
        safeSessionCutoff,
      ),
      purgeModel(
        prisma.growthDailyMetric,
        'metricDate',
        metricRetentionCutoff(referenceTime),
      ),
    ])
    return { events, sessions, metrics }
  }

  async function runOnce() {
    const referenceTime = now()
    const today = startOfUtcDay(referenceTime)
    const lastCompleteDay = addUtcDays(today, -1)
    const watermarkRow = await prisma.instanceConfig.findUnique({
      where: { key: WATERMARK_KEY },
    })
    let watermark = parseWatermark(watermarkRow?.value)
    let nextDay = await earliestUnaggregatedDay(today, watermark)
    let aggregatedDays = 0
    let aggregatedSites = 0

    while (
      nextDay &&
      nextDay <= lastCompleteDay &&
      aggregatedDays < maxDaysPerTick
    ) {
      aggregatedSites += await aggregateDay(nextDay)
      watermark = nextDay
      nextDay = addUtcDays(nextDay, 1)
      aggregatedDays += 1
    }

    const purged = await purgeExpired(referenceTime, watermark)
    return {
      aggregatedDays,
      aggregatedSites,
      watermark: watermark ? dateKey(watermark) : null,
      purged,
    }
  }

  return {
    runOnce,
    WATERMARK_KEY,
    RAW_EVENT_RETENTION_DAYS,
    AGGREGATE_RETENTION_MONTHS,
  }
}
