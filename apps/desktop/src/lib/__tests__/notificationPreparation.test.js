import test from 'node:test';
import assert from 'node:assert/strict';
import { createNotificationPreparation } from '../notificationPreparation.js';

test('retries after transient failure, with cooldown and no concurrent requests', async () => {
  let now = 0, calls = 0, finish;
  const run = createNotificationPreparation(() => {
    calls++;
    if (calls === 1) throw new Error('API unavailable');
    return new Promise((resolve) => { finish = resolve; });
  }, { now: () => now, minInterval: 100 });
  await run(); await run(); assert.equal(calls, 1);
  now = 100;
  const retry = run();
  assert.equal(run(), retry);
  await Promise.resolve(); assert.equal(calls, 2);
  finish(); await retry;
});
