// Simple in-memory sliding-window rate limiter: if the same number sends
// 10+ messages in a minute, we throttle gracefully instead of calling the AI.

const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 10;

const hits = new Map(); // phone → [timestamps]

function allow(phone) {
  const now = Date.now();
  const recent = (hits.get(phone) || []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(phone, recent);
  return recent.length <= MAX_PER_WINDOW;
}

// Periodic cleanup so the map doesn't grow forever.
setInterval(() => {
  const now = Date.now();
  for (const [phone, times] of hits) {
    const recent = times.filter((t) => now - t < WINDOW_MS);
    if (recent.length === 0) hits.delete(phone);
    else hits.set(phone, recent);
  }
}, 5 * 60 * 1000).unref();

module.exports = { allow };
