import { formatLogTimestamp } from '@atlas/core'
import pkg from '@prisma/client'
import { createNotificationDeliveryWorker } from '../../api/src/services/notification-delivery-worker.js'

const { PrismaClient } = pkg

const prisma = new PrismaClient()
const deliveryWorker = createNotificationDeliveryWorker({ prisma })
const DELIVERY_INTERVAL_MS = Number(process.env.ATLAS_NOTIFICATION_DELIVERY_INTERVAL_MS ?? 30000)

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
  }
}

console.log('Atlas Worker started')
runDeliveryTick()
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
