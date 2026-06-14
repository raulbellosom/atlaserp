import { formatLogTimestamp } from '@atlas/core'
import { config as loadEnv } from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pkg from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { createNotificationDeliveryWorker } from '../../api/src/services/notification-delivery-worker.js'
import { createCalendarNotificationService } from '../../api/src/routes/calendar/calendar-notification-service.js'
import { createSyncLogCleanupWorker } from '../../api/src/services/sync-cleanup-worker.js'
import { createNotificationService } from '../../api/src/services/notification-service.js'
import { createProjectsNotificationService } from '../../api/src/routes/projects/projects-notification-service.js'
import { createRecurringTasksService } from '../../api/src/routes/projects/projects-recurring-service.js'
import { createGrowthAggregationWorker } from '../../api/src/services/growth-aggregation-worker.js'

const { PrismaClient } = pkg

const currentDir = path.dirname(fileURLToPath(import.meta.url))
loadEnv({
  path: [
    path.resolve(currentDir, '../.env'),
    path.resolve(currentDir, '../../../.env'),
  ],
})

const prismaConnectionString =
  process.env.DATABASE_URL ?? process.env.DIRECT_URL

if (!prismaConnectionString) {
  throw new Error(
    '[worker] DATABASE_URL o DIRECT_URL es requerido para iniciar Prisma',
  )
}

const prismaAdapter = new PrismaPg({
  connectionString: prismaConnectionString,
})
const prisma = new PrismaClient({ adapter: prismaAdapter })
const deliveryWorker = createNotificationDeliveryWorker({ prisma })
const calendarNotificationService = createCalendarNotificationService({ prisma })
const DELIVERY_INTERVAL_MS = Number(process.env.ATLAS_NOTIFICATION_DELIVERY_INTERVAL_MS ?? 30000)
const syncCleanupWorker = createSyncLogCleanupWorker({ prisma })
const SYNC_CLEANUP_INTERVAL_MS = syncCleanupWorker.SYNC_CLEANUP_INTERVAL_MS
const projectsNotifService = createProjectsNotificationService({
  prisma,
  notificationService: createNotificationService({ prisma }),
})
const DUE_SOON_INTERVAL_MS = 60 * 60 * 1000
const recurringTasksService = createRecurringTasksService({ prisma })
const RECURRING_INTERVAL_MS = 60 * 60 * 1000
const growthAggregationWorker = createGrowthAggregationWorker({ prisma })
const GROWTH_AGGREGATION_INTERVAL_MS = Number(
  process.env.ATLAS_GROWTH_AGGREGATION_INTERVAL_MS ??
    process.env.ATLAS_GROWTH_RETENTION_INTERVAL_MS ??
    60 * 60 * 1000,
)

function isConnectionError(err) {
  const msg = err?.message ?? ''
  return (
    msg.includes('Server has closed the connection') ||
    msg.includes('Connection terminated') ||
    msg.includes('Connection reset') ||
    msg.includes("Can't reach database server") ||
    err?.code === 'P1001' ||
    err?.code === 'P1017'
  )
}

async function reconnect() {
  try {
    await prisma.$disconnect()
  } catch (_) {}
  try {
    await prisma.$connect()
    console.log('[worker] prisma reconnected')
  } catch (reconnErr) {
    console.error('[worker] prisma reconnect failed:', reconnErr?.message ?? reconnErr)
  }
}

async function runCalendarReminderTick() {
  try {
    const result = await calendarNotificationService.processReminders()
    if ((result?.processed ?? 0) > 0) {
      console.log(
        `[worker] calendar reminders ${formatLogTimestamp()} processed=${result.processed} published=${result.published ?? 0}`,
      )
    }
  } catch (err) {
    console.error('[worker] calendar reminder tick failed:', err?.message ?? err)
    if (isConnectionError(err)) await reconnect()
  }
}

async function runDeliveryTick() {
  try {
    const channels = ['email', 'web_push']
    for (const channel of channels) {
      const result = await deliveryWorker.processPendingNotificationDeliveries({
        channel,
        limit: 50,
      })
      if (result.processed > 0) {
        console.log(
          `[worker] notification delivery channel=${channel} ${formatLogTimestamp()} processed=${result.processed} sent=${result.sent} failed=${result.failed} retrying=${result.retrying}`,
        )
      }
    }
  } catch (err) {
    console.error('[worker] notification delivery tick failed:', err?.message ?? err)
    if (isConnectionError(err)) await reconnect()
  }
}

async function runSyncCleanupTick() {
  try {
    const result = await syncCleanupWorker.processExpiredLogs()
    if (result.deleted > 0) {
      console.log(`[worker] sync log cleanup ${formatLogTimestamp()} deleted=${result.deleted}`)
    }
  } catch (err) {
    console.error('[worker] sync log cleanup tick failed:', err?.message ?? err)
    if (isConnectionError(err)) await reconnect()
  }
}

async function runTasksDueSoonTick() {
  try {
    const result = await projectsNotifService.processTasksDueSoon()
    if ((result?.published ?? 0) > 0) {
      console.log(
        `[worker] tasks due soon ${formatLogTimestamp()} processed=${result.processed} published=${result.published}`,
      )
    }
  } catch (err) {
    console.error('[worker] tasks due soon tick failed:', err?.message ?? err)
    if (isConnectionError(err)) await reconnect()
  }
}

async function runGrowthRetentionTick() {
  try {
    const result = await growthAggregationWorker.runOnce()
    const purged =
      result.purged.events +
      result.purged.sessions +
      result.purged.metrics
    if (result.aggregatedDays > 0 || purged > 0) {
      console.log(
        `[worker] growth analytics ${formatLogTimestamp()} days=${result.aggregatedDays} dimensions=${result.aggregatedDimensions} purged=${purged} watermark=${result.watermark ?? 'none'}`,
      )
    }
  } catch (err) {
  console.error('[worker] growth analytics tick failed:', err?.message ?? err)
    if (isConnectionError(err)) await reconnect()
  }
}

console.log('Atlas Worker started')
runCalendarReminderTick()
runDeliveryTick()
setInterval(() => {
  runCalendarReminderTick()
}, DELIVERY_INTERVAL_MS)
setInterval(() => {
  runDeliveryTick()
}, DELIVERY_INTERVAL_MS)
setInterval(() => {
  console.log(`[worker] heartbeat ${formatLogTimestamp()}`)
}, 30000)
runSyncCleanupTick()
setInterval(() => {
  runSyncCleanupTick()
}, SYNC_CLEANUP_INTERVAL_MS)
runTasksDueSoonTick()
setInterval(() => {
  runTasksDueSoonTick()
}, DUE_SOON_INTERVAL_MS)
runGrowthRetentionTick()
setInterval(() => {
  runGrowthRetentionTick()
}, GROWTH_AGGREGATION_INTERVAL_MS)

async function runRecurringTasksTick() {
  try {
    const result = await recurringTasksService.processRecurringTasks()
    if ((result?.created ?? 0) > 0) {
      console.log(
        `[worker] recurring tasks ${formatLogTimestamp()} processed=${result.processed} created=${result.created}`,
      )
    }
  } catch (err) {
    console.error('[worker] recurring tasks tick failed:', err?.message ?? err)
    if (isConnectionError(err)) await reconnect()
  }
}

runRecurringTasksTick()
setInterval(() => {
  runRecurringTasksTick()
}, RECURRING_INTERVAL_MS)

process.on('SIGTERM', async () => {
  await prisma.$disconnect().catch(() => {})
  process.exit(0)
})

process.on('SIGINT', async () => {
  await prisma.$disconnect().catch(() => {})
  process.exit(0)
})
