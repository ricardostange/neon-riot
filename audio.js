'use strict';
(() => {
  function createAudio({ isMuted, getPlayer, getClock, weaponWeight }) {
    let audio, master, soundTimes = {}, pickupNote = 0;
    // A small synthesized sound palette, with envelopes and rate limits (no assets or autoplay).
    function initAudio() {
      if (isMuted()) return;
      try {
        if (!audio) {
          audio = new (window.AudioContext || window.webkitAudioContext)();
          master = audio.createGain(); master.gain.value = .55;
          const limiter = audio.createDynamicsCompressor();
          master.connect(limiter); limiter.connect(audio.destination);
        }
        if (audio.state === 'suspended') audio.resume().catch(() => {});
      } catch {}
    }
    function tone(from, to, duration, volume, wave = 'sine', delay = 0) {
      if (!audio || isMuted()) return;
      const t = audio.currentTime + delay, o = audio.createOscillator(), g = audio.createGain();
      o.type = wave; o.frequency.setValueAtTime(from, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + duration);
      g.gain.setValueAtTime(.001, t); g.gain.linearRampToValueAtTime(volume, t + .008);
      g.gain.exponentialRampToValueAtTime(.001, t + duration);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + duration + .02);
      o.onended = () => { o.disconnect(); g.disconnect(); };
    }
    function sound(type) {
      if (!audio || isMuted()) return;
      const t = audio.currentTime;
      const limits = { shot: .075, kill: .09, gem: .065, crit: .12, hurt: .25, clear: .1, bossHit: .04 };
      if (t - (soundTimes[type] ?? -10) < (limits[type] || .05)) return;
      soundTimes[type] = t;
      switch (type) {
        case 'shot': {
          const weight = weaponWeight(), cadence = Math.min(180, (1 / getPlayer().fireRate - 1 / .38) * 12);
          tone(520 + cadence - weight * 35, 150, .065, .055, 'triangle');
          tone(95 - weight * 10, 35, .07, .045); break;
        }
        case 'bossHit': {
          const pitch = 900 + (Math.sin(getClock() * 137) + 1) * 180;
          tone(pitch, 240, .045, .09, 'triangle'); tone(170, 70, .035, .055); break;
        }
        case 'kill': tone(140, 45, .07, .065, 'triangle'); break;
        case 'crit': tone(1200, 600, .08, .045, 'triangle'); break;
        case 'gem': { const f = [660, 784, 880, 988, 1175][pickupNote++ % 5]; tone(f, f * 1.08, .085, .055); break; }
        case 'level': [440, 554, 659, 880].forEach((f, i) => tone(f, f, .24, .13, 'triangle', i * .065)); break;
        case 'dash': tone(130, 800, .17, .11, 'sawtooth'); tone(80, 30, .2, .12); break;
        case 'ready': tone(660, 660, .14, .13, 'triangle'); tone(990, 1320, .22, .12, 'triangle', .09); break;
        case 'boom': tone(100, 22, .38, .19, 'sawtooth'); tone(45, 25, .4, .2); break;
        case 'hurt': tone(210, 45, .2, .15, 'square'); break;
        case 'clear': tone(880, 1600, .1, .035); break;
        case 'reroll': tone(320, 640, .12, .1, 'triangle'); break;
        case 'warning': tone(180, 180, .18, .1, 'triangle'); tone(140, 140, .25, .1, 'triangle', .2); break;
        case 'win': [330, 440, 554, 659, 880].forEach((f, i) => tone(f, f, .6, .14, 'triangle', i * .09)); break;
      }
    }

    function syncMute() { if (master) master.gain.setTargetAtTime(isMuted() ? 0 : .55, audio.currentTime, .02); }
    function reset() { soundTimes = {}; pickupNote = 0; }
    return { init: initAudio, sound, syncMute, reset };
  }
  globalThis.createRiotAudio = createAudio;
})();
