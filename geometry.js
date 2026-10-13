'use strict';
// Pure math: no game state, DOM, randomness or rendering.
(() => {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  function circleEntry(ax, ay, bx, by, radius) {
    const dx = bx - ax, dy = by - ay, c = ax * ax + ay * ay - radius * radius;
    if (c <= 0) return 0;
    const a = dx * dx + dy * dy, b = 2 * (ax * dx + ay * dy), discriminant = b * b - 4 * a * c;
    if (a === 0 || discriminant < 0) return Infinity;
    const t = (-b - Math.sqrt(discriminant)) / (2 * a);
    return t >= 0 && t <= 1 ? t : Infinity;
  }
  function segmentT(ax, ay, bx, by, x, y) {
    const dx = bx - ax, dy = by - ay;
    return clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  }
  function segmentHit(ax, ay, bx, by, x, y, radius) {
    const t = segmentT(ax, ay, bx, by, x, y);
    return (x - lerp(ax, bx, t)) ** 2 + (y - lerp(ay, by, t)) ** 2 <= radius * radius;
  }
  function interceptTime(x, y, vx, vy, speed) {
    const a = vx * vx + vy * vy - speed * speed;
    const b = 2 * (x * vx + y * vy), c = x * x + y * y;
    if (c < 1e-10) return 0;
    if (Math.abs(a) < 1e-8) return b < 0 ? -c / b : 0;
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return 0;
    const root = Math.sqrt(discriminant);
    const times = [(-b - root) / (2 * a), (-b + root) / (2 * a)].filter(t => t >= 0 && Number.isFinite(t));
    return times.length ? Math.min(...times) : 0;
  }
  const api = { circleEntry, segmentT, segmentHit, interceptTime };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else globalThis.RiotGeometry = api;
})();
