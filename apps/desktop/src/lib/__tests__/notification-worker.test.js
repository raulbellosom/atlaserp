import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

async function worker() {
  const handlers = {}, notifications = [], messages = [], opened = [];
  const clients = { matchAll: async () => [], openWindow: async (link) => opened.push(link), claim() {} };
  const self = { location: { origin: 'https://atlas.test' }, registration: { showNotification: async (title, options) => notifications.push({ title, options }) }, addEventListener: (event, handler) => { handlers[event] = handler; } };
  vm.runInNewContext(await readFile(new URL('../../../public/sw-notifications.js', import.meta.url), 'utf8'), { self, clients, URL, fetch });
  return { handlers, notifications, messages, opened };
}

test('push displays a normal notice without any open application windows', async () => {
  const { handlers, notifications } = await worker();
  let done;
  handlers.push({ data: { json: () => ({ title: 'Mensaje', data: { eventType: 'chat.message.new' } }) }, waitUntil: (p) => { done = p; } });
  await done;
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].options.requireInteraction, false);
});

test('incoming call push displays an actionable notice and click opens Atlas when it is closed', async () => {
  const { handlers, notifications, opened } = await worker();
  let done;
  const link = '/app/m/atlas.chat/chat/inbox/conversation';
  handlers.push({ data: { json: () => ({ title: 'Llamada', tag: 'call:one', data: { eventType: 'chat.call.incoming', link, sourceId: 'one' } }) }, waitUntil: (p) => { done = p; } });
  await done;
  const { options } = notifications[0];
  assert.equal(options.requireInteraction, true);
  assert.equal(options.actions[0].action, 'open-call');
  handlers.notificationclick({ notification: { data: options.data, close() {} }, waitUntil: (p) => { done = p; } });
  await done;
  assert.deepEqual(opened, [link]);
});
