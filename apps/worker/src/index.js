import { formatLogTimestamp } from '@atlas/core'

console.log('Atlas Worker started')
console.log('TODO: add report generation, file processing, OCR/import jobs and integration jobs here')
setInterval(() => {
  console.log(`[worker] heartbeat ${formatLogTimestamp()}`)
}, 30000)
