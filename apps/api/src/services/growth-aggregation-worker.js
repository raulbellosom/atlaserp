const WATERMARK_KEY = "growth.analytics.watermark";
const DEFAULT_MAX_DAYS_PER_TICK = 7;
const DEFAULT_REPROCESS_DAYS = 2;
const DEFAULT_PURGE_BATCH_SIZE = 5000;
const RAW_EVENT_RETENTION_DAYS = 90;
const AGGREGATE_RETENTION_MONTHS = 25;

function startOfUtcDay(value) {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

function addUtcDays(value, days) {
  const result = new Date(value);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function subtractUtcMonths(value, months) {
  const result = new Date(value);
  result.setUTCMonth(result.getUTCMonth() - months);
  return result;
}

function dateKey(value) {
  return value.toISOString().slice(0, 10);
}

function parseWatermark(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? "")) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeMetricValue(value) {
  if (typeof value === "bigint") return Number(value);
  if (Array.isArray(value)) return value.map(normalizeMetricValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        normalizeMetricValue(entry),
      ]),
    );
  }
  return value;
}

function earlierDate(left, right) {
  if (!left) return right;
  if (!right) return left;
  return left < right ? left : right;
}

export function createGrowthAggregationWorker({
  prisma,
  now = () => new Date(),
  maxDaysPerTick = DEFAULT_MAX_DAYS_PER_TICK,
  reprocessDays = DEFAULT_REPROCESS_DAYS,
  purgeBatchSize = DEFAULT_PURGE_BATCH_SIZE,
}) {
  async function earliestDataDay(today) {
    const [eventResult, sessionResult, leadResult] = await Promise.all([
      prisma.growthEvent.aggregate?.({
        where: { serverReceivedAt: { lt: today } },
        _min: { serverReceivedAt: true },
      }),
      prisma.growthSession.aggregate?.({
        where: { startedAt: { lt: today } },
        _min: { startedAt: true },
      }),
      prisma.growthLead?.aggregate?.({
        where: { createdAt: { lt: today } },
        _min: { createdAt: true },
      }),
    ]);
    const earliest = earlierDate(
      earlierDate(
        eventResult?._min?.serverReceivedAt ?? null,
        sessionResult?._min?.startedAt ?? null,
      ),
      leadResult?._min?.createdAt ?? null,
    );
    return earliest ? startOfUtcDay(earliest) : null;
  }

  async function aggregateDay(dayStart) {
    const dayEnd = addUtcDays(dayStart, 1);
    return prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw`
        WITH
        session_base AS (
          SELECT *
          FROM growth_session
          WHERE started_at >= ${dayStart}
            AND started_at < ${dayEnd}
        ),
        event_base AS (
          SELECT *
          FROM growth_event
          WHERE server_received_at >= ${dayStart}
            AND server_received_at < ${dayEnd}
            AND consent_state <> 'denied'
        ),
        lead_base AS (
          SELECT *
          FROM growth_lead
          WHERE created_at >= ${dayStart}
            AND created_at < ${dayEnd}
            AND enabled = true
        ),
        site_keys AS (
          SELECT company_id, site_id FROM session_base
          UNION
          SELECT company_id, site_id FROM event_base
          UNION
          SELECT company_id, site_id FROM lead_base
        ),
        site_rows AS (
          SELECT
            keys.company_id AS "companyId",
            keys.site_id AS "siteId",
            'site'::text AS "dimensionType",
            ''::text AS "dimensionKey",
            jsonb_build_object(
              'visitors', (
                SELECT COUNT(DISTINCT visitor_id) FROM event_base
                WHERE company_id = keys.company_id AND site_id = keys.site_id
              ),
              'sessions', (
                SELECT COUNT(*) FROM session_base
                WHERE company_id = keys.company_id AND site_id = keys.site_id
              ),
              'engagedSessions', (
                SELECT COUNT(*) FROM session_base
                WHERE company_id = keys.company_id AND site_id = keys.site_id
                  AND engaged = true
              ),
              'pageviews', (
                SELECT COUNT(*) FROM event_base
                WHERE company_id = keys.company_id AND site_id = keys.site_id
                  AND event_name = 'page_view'
              ),
              'visibleSeconds', (
                SELECT COALESCE(SUM(visible_seconds), 0) FROM session_base
                WHERE company_id = keys.company_id AND site_id = keys.site_id
              ),
              'leads', (
                SELECT COUNT(*) FROM lead_base
                WHERE company_id = keys.company_id AND site_id = keys.site_id
              ),
              'qualified', (
                SELECT COUNT(*) FROM growth_lead
                WHERE company_id = keys.company_id AND site_id = keys.site_id
                  AND qualified_at >= ${dayStart} AND qualified_at < ${dayEnd}
              ),
              'converted', (
                SELECT COUNT(*) FROM growth_lead
                WHERE company_id = keys.company_id AND site_id = keys.site_id
                  AND converted_at >= ${dayStart} AND converted_at < ${dayEnd}
              )
            ) AS metrics
          FROM site_keys keys
        ),
        source_rows AS (
          SELECT
            company_id AS "companyId",
            site_id AS "siteId",
            'source'::text AS "dimensionType",
            CONCAT_WS('|',
              COALESCE(NULLIF(utm_source, ''), 'direct'),
              COALESCE(NULLIF(utm_medium, ''), 'none'),
              COALESCE(NULLIF(utm_campaign, ''), 'none')
            ) AS "dimensionKey",
            jsonb_build_object(
              'sessions', COUNT(*),
              'engagedSessions', COUNT(*) FILTER (WHERE engaged = true),
              'conversions', COUNT(*) FILTER (WHERE has_conversion = true),
              'source', COALESCE(NULLIF(utm_source, ''), 'Directo'),
              'medium', COALESCE(NULLIF(utm_medium, ''), 'Sin medio'),
              'campaign', COALESCE(NULLIF(utm_campaign, ''), 'Sin campaña')
            ) AS metrics
          FROM session_base
          GROUP BY company_id, site_id, utm_source, utm_medium, utm_campaign
        ),
        landing_rows AS (
          SELECT
            company_id AS "companyId",
            site_id AS "siteId",
            'landing'::text AS "dimensionType",
            COALESCE(NULLIF(landing_path, ''), '/') AS "dimensionKey",
            jsonb_build_object(
              'sessions', COUNT(*),
              'engagedSessions', COUNT(*) FILTER (WHERE engaged = true),
              'conversions', COUNT(*) FILTER (WHERE has_conversion = true)
            ) AS metrics
          FROM session_base
          GROUP BY company_id, site_id, COALESCE(NULLIF(landing_path, ''), '/')
        ),
        page_rows AS (
          SELECT
            company_id AS "companyId",
            site_id AS "siteId",
            'page'::text AS "dimensionType",
            COALESCE(NULLIF(path, ''), '/') AS "dimensionKey",
            jsonb_build_object(
              'pageviews', COUNT(*),
              'visitors', COUNT(DISTINCT visitor_id)
            ) AS metrics
          FROM event_base
          WHERE event_name = 'page_view'
          GROUP BY company_id, site_id, COALESCE(NULLIF(path, ''), '/')
        ),
        cta_rows AS (
          SELECT
            company_id AS "companyId",
            site_id AS "siteId",
            'cta'::text AS "dimensionType",
            event_name AS "dimensionKey",
            jsonb_build_object(
              'clicks', COUNT(*),
              'visitors', COUNT(DISTINCT visitor_id),
              'label', MAX(properties->>'label'),
              'placement', MAX(properties->>'placement')
            ) AS metrics
          FROM event_base
          WHERE event_name NOT IN (
            'page_view', 'visible_time', 'form_view', 'form_start',
            'form_submit', 'form_submit_error', 'lead_created',
            'qualified', 'converted'
          )
          GROUP BY company_id, site_id, event_name
        ),
        form_rows AS (
          SELECT
            company_id AS "companyId",
            site_id AS "siteId",
            'form'::text AS "dimensionType",
            form_id::text AS "dimensionKey",
            jsonb_build_object(
              'views', COUNT(*) FILTER (WHERE event_name = 'form_view'),
              'starts', COUNT(*) FILTER (WHERE event_name = 'form_start'),
              'submits', COUNT(*) FILTER (WHERE event_name = 'form_submit')
            ) AS metrics
          FROM event_base
          WHERE form_id IS NOT NULL
            AND event_name IN ('form_view', 'form_start', 'form_submit')
          GROUP BY company_id, site_id, form_id
        ),
        funnel_events AS (
          SELECT company_id, site_id, event_name AS step, COUNT(*) AS count
          FROM event_base
          WHERE event_name IN (
            'form_view', 'form_start', 'form_submit', 'lead_created'
          )
          GROUP BY company_id, site_id, event_name
          UNION ALL
          SELECT company_id, site_id, 'qualified', COUNT(*)
          FROM growth_lead
          WHERE qualified_at >= ${dayStart} AND qualified_at < ${dayEnd}
          GROUP BY company_id, site_id
          UNION ALL
          SELECT company_id, site_id, 'converted', COUNT(*)
          FROM growth_lead
          WHERE converted_at >= ${dayStart} AND converted_at < ${dayEnd}
          GROUP BY company_id, site_id
        ),
        funnel_rows AS (
          SELECT
            company_id AS "companyId",
            site_id AS "siteId",
            'funnel'::text AS "dimensionType",
            step AS "dimensionKey",
            jsonb_build_object('count', SUM(count)) AS metrics
          FROM funnel_events
          GROUP BY company_id, site_id, step
        ),
        retention_rows AS (
          SELECT
            visitor.company_id AS "companyId",
            visitor.site_id AS "siteId",
            'retention'::text AS "dimensionType",
            visitor.first_seen_at::date::text AS "dimensionKey",
            jsonb_build_object(
              'cohortVisitors', COUNT(DISTINCT visitor.id),
              'd1', COUNT(DISTINCT visitor.id) FILTER (
                WHERE EXISTS (
                  SELECT 1 FROM growth_session session
                  WHERE session.visitor_id = visitor.id
                    AND session.started_at::date = visitor.first_seen_at::date + 1
                )
              ),
              'd7', COUNT(DISTINCT visitor.id) FILTER (
                WHERE EXISTS (
                  SELECT 1 FROM growth_session session
                  WHERE session.visitor_id = visitor.id
                    AND session.started_at::date = visitor.first_seen_at::date + 7
                )
              ),
              'd30', COUNT(DISTINCT visitor.id) FILTER (
                WHERE EXISTS (
                  SELECT 1 FROM growth_session session
                  WHERE session.visitor_id = visitor.id
                    AND session.started_at::date = visitor.first_seen_at::date + 30
                )
              )
            ) AS metrics
          FROM growth_visitor visitor
          WHERE visitor.first_seen_at >= ${dayStart}
            AND visitor.first_seen_at < ${dayEnd}
            AND visitor.consent_state <> 'denied'
          GROUP BY visitor.company_id, visitor.site_id, visitor.first_seen_at::date
        )
        SELECT * FROM site_rows
        UNION ALL SELECT * FROM source_rows
        UNION ALL SELECT * FROM landing_rows
        UNION ALL SELECT * FROM page_rows
        UNION ALL SELECT * FROM cta_rows
        UNION ALL SELECT * FROM form_rows
        UNION ALL SELECT * FROM funnel_rows
        UNION ALL SELECT * FROM retention_rows
      `;

      for (const row of rows) {
        const metricDate = row.metricDate
          ? startOfUtcDay(new Date(row.metricDate))
          : dayStart;
        const dimensionType = String(row.dimensionType ?? "site");
        const dimensionKey = String(row.dimensionKey ?? "");
        const metrics = normalizeMetricValue(row.metrics ?? {});
        await tx.growthDailyMetric.upsert({
          where: {
            siteId_metricDate_dimensionType_dimensionKey: {
              siteId: row.siteId,
              metricDate,
              dimensionType,
              dimensionKey,
            },
          },
          create: {
            companyId: row.companyId,
            siteId: row.siteId,
            metricDate,
            dimensionType,
            dimensionKey,
            metrics,
          },
          update: { metrics },
        });
      }

      await tx.instanceConfig.upsert({
        where: { key: WATERMARK_KEY },
        create: { key: WATERMARK_KEY, value: dateKey(dayStart) },
        update: { value: dateKey(dayStart) },
      });
      return rows.length;
    });
  }

  async function purgeModel(model, dateField, cutoff) {
    if (!model?.findMany || !cutoff) return 0;
    const rows = await model.findMany({
      where: { [dateField]: { lt: cutoff } },
      select: { id: true },
      orderBy: { [dateField]: "asc" },
      take: purgeBatchSize,
    });
    if (!rows.length) return 0;
    const result = await model.deleteMany({
      where: { id: { in: rows.map((row) => row.id) } },
    });
    return result.count;
  }

  async function purgeExpired(referenceTime, watermark) {
    const watermarkEnd = watermark ? addUtcDays(watermark, 1) : null;
    const rawCutoff = addUtcDays(referenceTime, -RAW_EVENT_RETENTION_DAYS);
    const aggregateCutoff = new Date(
      Date.UTC(
        referenceTime.getUTCFullYear(),
        referenceTime.getUTCMonth() - AGGREGATE_RETENTION_MONTHS,
        1,
      ),
    );
    const sessionCutoff = subtractUtcMonths(
      referenceTime,
      AGGREGATE_RETENTION_MONTHS,
    );
    const [events, sessions, metrics] = await Promise.all([
      purgeModel(
        prisma.growthEvent,
        "serverReceivedAt",
        watermarkEnd ? earlierDate(rawCutoff, watermarkEnd) : null,
      ),
      purgeModel(
        prisma.growthSession,
        "lastSeenAt",
        watermarkEnd ? earlierDate(sessionCutoff, watermarkEnd) : null,
      ),
      purgeModel(prisma.growthDailyMetric, "metricDate", aggregateCutoff),
    ]);
    return { events, sessions, metrics };
  }

  async function runOnce() {
    const referenceTime = now();
    const today = startOfUtcDay(referenceTime);
    const lastCompleteDay = addUtcDays(today, -1);
    const watermarkRow = await prisma.instanceConfig.findUnique({
      where: { key: WATERMARK_KEY },
    });
    let watermark = parseWatermark(watermarkRow?.value);
    let nextDay;
    if (watermark) {
      nextDay = addUtcDays(watermark, -(Math.max(1, reprocessDays) - 1));
    } else {
      nextDay = await earliestDataDay(today);
    }

    let aggregatedDays = 0;
    let aggregatedDimensions = 0;
    while (
      nextDay &&
      nextDay <= lastCompleteDay &&
      aggregatedDays < maxDaysPerTick
    ) {
      aggregatedDimensions += await aggregateDay(nextDay);
      if (!watermark || nextDay > watermark) watermark = nextDay;
      nextDay = addUtcDays(nextDay, 1);
      aggregatedDays += 1;
    }

    const purged = await purgeExpired(referenceTime, watermark);
    return {
      aggregatedDays,
      aggregatedDimensions,
      watermark: watermark ? dateKey(watermark) : null,
      purged,
    };
  }

  return {
    runOnce,
    WATERMARK_KEY,
    RAW_EVENT_RETENTION_DAYS,
    AGGREGATE_RETENTION_MONTHS,
  };
}
