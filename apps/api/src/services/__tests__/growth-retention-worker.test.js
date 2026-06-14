import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createGrowthRetentionWorker } from '../growth-retention-worker.js'

const NOW = new Date('2026-06-14T12:00:00.000Z')
const COMPANY_ID = '01900000-0000-7000-8000-000000000001'
const SITE_ID = '01900000-0000-7000-8000-000000000002'

function dayKey(date) {
  return date.toISOString().slice(0, 10)
}

function createPrisma({
  watermark = null,
  earliestEvent = null,
  earliestSession = null,
  aggregateRows = {},
  events = [],
  sessions = [],
  metrics = [],
} = {}) {
  const state = {
    watermark,
    aggregateDays: [],
    dailyMetrics: new Map(
      metrics.map((metric) => [
        `${metric.siteId}:${dayKey(metric.metricDate)}`,
        metric,
      ]),
    ),
    events: [...events],
    sessions: [...sessions],
    leads: [{ id: 'lead-1' }],
    submissions: [{ id: 'submission-1' }],
  }

  function modelForRows(name, dateField) {
    return {
      findMany: async ({ where, take }) =>
        state[name]
          .filter((row) => row[dateField] < where[dateField].lt)
          .slice(0, take)
          .map((row) => ({ id: row.id })),
      deleteMany: async ({ where }) => {
        const ids = new Set(where.id.in)
        const before = state[name].length
        state[name] = state[name].filter((row) => !ids.has(row.id))
        return { count: before - state[name].length }
      },
    }
  }

  const prisma = {
    instanceConfig: {
      findUnique: async () =>
        state.watermark ? { value: state.watermark } : null,
      upsert: async ({ create, update }) => {
        state.watermark = update.value ?? create.value
        return { key: create.key, value: state.watermark }
      },
    },
    growthEvent: {
      aggregate: async () => ({
        _min: { serverReceivedAt: earliestEvent },
      }),
      ...modelForRows('events', 'serverReceivedAt'),
    },
    growthSession: {
      aggregate: async () => ({
        _min: { startedAt: earliestSession },
      }),
      ...modelForRows('sessions', 'lastSeenAt'),
    },
    growthDailyMetric: {
      upsert: async ({ where, create, update }) => {
        const key = `${where.siteId_metricDate_dimensionType_dimensionKey.siteId}:${dayKey(
          where.siteId_metricDate_dimensionType_dimensionKey.metricDate,
        )}`
        const existing = state.dailyMetrics.get(key)
        const row = existing
          ? { ...existing, ...update }
          : { id: `metric-${state.dailyMetrics.size + 1}`, ...create }
        state.dailyMetrics.set(key, row)
        return row
      },
      findMany: async ({ where, take }) =>
        [...state.dailyMetrics.values()]
          .filter((row) => row.metricDate < where.metricDate.lt)
          .slice(0, take)
          .map((row) => ({ id: row.id })),
      deleteMany: async ({ where }) => {
        const ids = new Set(where.id.in)
        let deleted = 0
        for (const [key, row] of state.dailyMetrics) {
          if (ids.has(row.id)) {
            state.dailyMetrics.delete(key)
            deleted += 1
          }
        }
        return { count: deleted }
      },
    },
    growthLead: {
      deleteMany: async () => {
        throw new Error('leads must be preserved')
      },
    },
    websiteFormSubmission: {
      deleteMany: async () => {
        throw new Error('submissions must be preserved')
      },
    },
    $queryRaw: async (strings, dayStart) => {
      const sql = strings.join(' ')
      if (!sql.includes('growth_event_daily')) return []
      const key = dayKey(dayStart)
      state.aggregateDays.push(key)
      return aggregateRows[key] ?? []
    },
    $transaction: async (callback) => callback(prisma),
    _state: state,
  }
  return prisma
}

function metricRow(overrides = {}) {
  return {
    companyId: COMPANY_ID,
    siteId: SITE_ID,
    visitors: 2n,
    sessions: 3n,
    engagedSessions: 2n,
    pageviews: 5n,
    events: 8n,
    visibleSeconds: 44n,
    conversions: 1n,
    formViews: 2n,
    formStarts: 1n,
    formSubmits: 1n,
    ...overrides,
  }
}

describe('createGrowthRetentionWorker', () => {
  it('aggregates complete UTC days idempotently', async () => {
    const prisma = createPrisma({
      earliestEvent: new Date('2026-06-12T08:00:00.000Z'),
      aggregateRows: {
        '2026-06-12': [metricRow()],
        '2026-06-13': [metricRow({ pageviews: 7n })],
      },
    })
    const worker = createGrowthRetentionWorker({ prisma, now: () => NOW })

    const first = await worker.runOnce()
    assert.equal(first.aggregatedDays, 2)
    assert.equal(prisma._state.dailyMetrics.size, 2)
    assert.equal(
      prisma._state.dailyMetrics.get(`${SITE_ID}:2026-06-13`).metrics.pageviews,
      7,
    )

    prisma._state.watermark = null
    const second = await worker.runOnce()
    assert.equal(second.aggregatedDays, 2)
    assert.equal(prisma._state.dailyMetrics.size, 2)
  })

  it('starts after the watermark and never aggregates the current day', async () => {
    const prisma = createPrisma({
      watermark: '2026-06-12',
      earliestEvent: new Date('2026-06-01T00:00:00.000Z'),
      aggregateRows: {
        '2026-06-13': [metricRow()],
        '2026-06-14': [metricRow()],
      },
    })
    const worker = createGrowthRetentionWorker({ prisma, now: () => NOW })

    const result = await worker.runOnce()
    assert.equal(result.aggregatedDays, 1)
    assert.deepEqual(prisma._state.aggregateDays, ['2026-06-13'])
    assert.equal(prisma._state.watermark, '2026-06-13')
  })

  it('purges bounded expired raw and aggregate data without touching leads or submissions', async () => {
    const prisma = createPrisma({
      watermark: '2026-06-13',
      events: [
        { id: 'event-old', serverReceivedAt: new Date('2026-03-01T00:00:00Z') },
        { id: 'event-new', serverReceivedAt: new Date('2026-06-01T00:00:00Z') },
      ],
      sessions: [
        { id: 'session-old', lastSeenAt: new Date('2024-04-01T00:00:00Z') },
        { id: 'session-new', lastSeenAt: new Date('2026-01-01T00:00:00Z') },
      ],
      metrics: [
        {
          id: 'metric-old',
          siteId: SITE_ID,
          metricDate: new Date('2024-04-01T00:00:00Z'),
          metrics: {},
        },
        {
          id: 'metric-new',
          siteId: SITE_ID,
          metricDate: new Date('2026-01-01T00:00:00Z'),
          metrics: {},
        },
      ],
    })
    const worker = createGrowthRetentionWorker({
      prisma,
      now: () => NOW,
      purgeBatchSize: 1,
    })

    const result = await worker.runOnce()
    assert.deepEqual(result.purged, { events: 1, sessions: 1, metrics: 1 })
    assert.deepEqual(prisma._state.events.map((row) => row.id), ['event-new'])
    assert.deepEqual(prisma._state.sessions.map((row) => row.id), ['session-new'])
    assert.equal(prisma._state.dailyMetrics.size, 1)
    assert.deepEqual(prisma._state.leads, [{ id: 'lead-1' }])
    assert.deepEqual(prisma._state.submissions, [{ id: 'submission-1' }])
  })
})
