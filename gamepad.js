'use strict';

// Standard browser mapping: Xbox A/B/X, RT, Menu and D-pad. No device IDs needed.
(() => {
  function createGamepadInput(api) {
    let index = null, previous = [], baseline = true, direction = 0, repeatAt = 0;
    function reset() { baseline = true; direction = 0; repeatAt = 0; api.move(0, 0); }
    function poll(now) {
      let pads;
      try { pads = Array.from(api.read() || []); } catch { pads = []; }
      const supported = p => p && p.connected !== false && p.mapping === 'standard';
      let pad = pads.find(p => supported(p) && p.index === index);
      if (index !== null && !pad) {
        index = null; previous = []; reset(); api.active(false);
        api.disconnected(); return;
      }
      if (!pad) {
        pad = pads.find(supported);
        if (!pad) return;
        index = pad.index; baseline = true; api.active(true);
      }
      const pressed = pad.buttons.map(b => !!b.pressed || b.value > .5);
      if (!api.focused()) { reset(); previous = pressed; return; }
      const x = Number.isFinite(pad.axes[0]) ? pad.axes[0] : 0;
      const y = Number.isFinite(pad.axes[1]) ? pad.axes[1] : 0;
      const length = Math.hypot(x, y), magnitude = Math.min(1, Math.max(0, (length - .18) / .82));
      api.move(length ? x / length * magnitude : 0, length ? y / length * magnitude : 0);
      if (baseline) { previous = pressed; baseline = false; return; }
      const down = n => pressed[n] && !previous[n];
      // Capture edges before callbacks can change the active screen.
      const start = down(9), a = down(0), b = down(1), rt = down(7), reroll = down(2);
      previous = pressed;
      if (start) { api.pause(); return; }
      if (api.playing()) {
        direction = 0;
        if (a || rt) api.dash();
        return;
      }
      if (b) { api.back(); return; }
      const next = pressed[12] || pressed[14] ? -1 : pressed[13] || pressed[15] ? 1 :
        Math.abs(y) > .55 ? Math.sign(y) : Math.abs(x) > .55 ? Math.sign(x) : 0;
      if (next && (next !== direction || now >= repeatAt)) {
        api.navigate(next); repeatAt = now + (next !== direction ? 350 : 150);
      }
      direction = next;
      if (a) api.confirm();
      else if (reroll) api.reroll();
    }
    return { poll, reset };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = createGamepadInput;
  else globalThis.createRiotGamepadInput = createGamepadInput;
})();
