import { formatLogTimestamp } from '@atlas/core'
import { config as loadEnv } from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pkg from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { createNotificationDeliveryWorker } from '../../api/src/services/notification-delivery-worker.js'
import { createCalendarNotificationService } from '../../api/src/routes/calendar/calendar-notification-service.js'

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

process.on('SIGTERM', async () => {
  await prisma.$disconnect().catch(() => {})
  process.exit(0)
})

process.on('SIGINT', async () => {
  await prisma.$disconnect().catch(() => {})
  process.exit(0)
})
