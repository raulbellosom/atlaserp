import test from 'node:test'
import assert from 'node:assert/strict'
import { nativeNotificationOptions, notificationId, notificationTarget, prepareAndroidNotificationChannels } from '../notification-policy.js'

test('call notification retains a bounded target and stable ID for replacement/dismissal', () => {
  const options = nativeNotificationOptions({ title: 'Ana', tag: 'call:call-1', data: { callId: 'call-1', token: 'must-not-leak' }, requireInteraction: true })
  assert.equal(options.id, notificationId('call:call-1'))
  assert.equal(options.channelId, 'runly-calls-v1')
  assert.deepEqual(options.extra, { target: { kind: 'call', targetId: 'call-1' } })
  assert.ok(options.id > 0 && options.id <= 2147483647)
  assert.notEqual(options.id, notificationId('call:call-2'))
})

test('notification links do not authorize external URLs or arbitrary native actions', () => {
  for (const link of ['https://evil.test', 'javascript:alert(1)', '/app/m/runly.chat/chat/inbox/a?token=x', '/app/m/runly.chat/chat/inbox/a/extra']) assert.equal(notificationTarget({ link }), null)
  assert.deepEqual(notificationTarget({ link: '/app/m/runly.chat/chat/inbox/chat-1' }), { kind: 'chat', targetId: 'chat-1' })
})

test('Android call/alert channels request heads-up importance and private lockscreen content', async () => {
  const channels = []
  await prepareAndroidNotificationChannels({ createChannel: async (channel) => channels.push(channel) })
  assert.equal(channels.length, 2)
  assert.ok(channels.every((channel) => channel.importance === 4 && channel.visibility === 0 && channel.vibration))
})
