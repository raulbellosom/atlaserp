// Recover after an unavailable API without creating concurrent registrations
// when online, focus and periodic checks fire together.
export function createNotificationPreparation(prepare, { now = Date.now, minInterval = 60_000 } = {}) {
  let inFlight = null;
  let lastAttempt = -Infinity;
  return () => {
    if (inFlight) return inFlight;
    if (now() - lastAttempt < minInterval) return Promise.resolve();
    lastAttempt = now();
    inFlight = Promise.resolve().then(prepare).catch(() => {}).finally(() => { inFlight = null; });
    return inFlight;
  };
}
