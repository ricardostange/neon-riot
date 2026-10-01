'use strict';
(() => {
  // All gameplay is in world units and advances at a fixed 60 Hz, independent of display size.
  const $ = id => document.getElementById(id);
  const canvas = $('game'), ctx = canvas.getContext('2d');
  const TAU = Math.PI * 2, STEP = 1 / 60, BOSS_TIME = 180, CELL = 90;
  const COLORS = { mint: '#a5ff73', pink: '#ff508f', blue: '#54d9ff', gold: '#ffe779' };
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const store = {
    get(key, fallback) { try { return JSON.parse(localStorage.getItem(`neon-riot-${key}`)) ?? fallback; } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem(`neon-riot-${key}`, JSON.stringify(value)); } catch {} }
  };
  const progression = globalThis.RiotProgression;
  let profile = progression.normalize(store.get('progression', null));
  let runDifficulty = 0, difficulty = progression.difficulties[0], earnings = null, newUnlock = '';
  let progressSaved = true;
  let W, H, dpr, zoom, viewW, viewH;
  let state = 'menu', last = null, accumulator = 0, clock = 0, fxClock = 0;
  let player, enemies = [], bullets = [], gems = [], particles = [], rings = [], texts = [], enemyShots = [], trails = [];
  let cam = { x: 0, y: 0 }, keys = new Set(), joy = { x: 0, y: 0 }, stickPointer = null;
  let kills = 0, level = 1, xp = 0, need = 8, spawn = 0, enemyId = 0, bossSpawned = false;
  let shake = 0, hurtFlash = 0, endDelay = 0, winRun = false;
  let choices = [], build = {}, rerolls = 2, stats;
  let grid = new Map(), hudTime = 0;
  let best = Number(store.get('best', 0)) || 0;
  let muted = !!store.get('muted', false);
  let calm = !!store.get('calm', window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  let audio, master, soundTimes = {}, pickupNote = 0;

  function resize() {
    W = innerWidth; H = innerHeight; dpr = Math.min(devicePixelRatio || 1, 2);
    // Keep the original 1:1 desktop view; only scale down for smaller screens.
    zoom = clamp(Math.sqrt(W * H / (1100 * 740)), .55, 1);
    viewW = W / zoom; viewH = H / zoom;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  }
  addEventListener('resize', resize);
  resize();

  // A small synthesized sound palette, with envelopes and rate limits (no assets or autoplay).
  function initAudio() {
    if (muted) return;
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
    if (!audio || muted) return;
    const t = audio.currentTime + delay, o = audio.createOscillator(), g = audio.createGain();
    o.type = wave; o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + duration);
    g.gain.setValueAtTime(.001, t); g.gain.linearRampToValueAtTime(volume, t + .008);
    g.gain.exponentialRampToValueAtTime(.001, t + duration);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + duration + .02);
    o.onended = () => { o.disconnect(); g.disconnect(); };
  }
  function sound(type) {
    if (!audio || muted) return;
    const t = audio.currentTime;
    const limits = { shot: .075, kill: .09, gem: .065, crit: .12, hurt: .25, clear: .1 };
    if (t - (soundTimes[type] ?? -10) < (limits[type] || .05)) return;
    soundTimes[type] = t;
    switch (type) {
      case 'shot': tone(520, 150, .065, .055, 'triangle'); tone(95, 45, .07, .045); break;
      case 'kill': tone(140, 45, .07, .065, 'triangle'); break;
      case 'crit': tone(1200, 600, .08, .045, 'triangle'); break;
      case 'gem': { const f = [660, 784, 880, 988, 1175][pickupNote++ % 5]; tone(f, f * 1.08, .085, .055); break; }
      case 'level': [440, 554, 659, 880].forEach((f, i) => tone(f, f, .24, .13, 'triangle', i * .065)); break;
      case 'dash': tone(130, 800, .17, .11, 'sawtooth'); tone(80, 30, .2, .12); break;
      case 'ready': tone(660, 880, .1, .055); break;
      case 'boom': tone(100, 22, .38, .19, 'sawtooth'); tone(45, 25, .4, .2); break;
      case 'hurt': tone(210, 45, .2, .15, 'square'); break;
      case 'clear': tone(880, 1600, .1, .035); break;
      case 'reroll': tone(320, 640, .12, .1, 'triangle'); break;
      case 'warning': tone(180, 180, .18, .1, 'triangle'); tone(140, 140, .25, .1, 'triangle', .2); break;
      case 'win': [330, 440, 554, 659, 880].forEach((f, i) => tone(f, f, .6, .14, 'triangle', i * .09)); break;
    }
  }

  function setText(id, text) { const el = $(id); if (el.textContent !== String(text)) el.textContent = text; }
  function setWidth(id, value) { const s = `${clamp(value, 0, 100).toFixed(1)}%`; if ($(id).style.width !== s) $(id).style.width = s; }
  function clearInput() {
    keys.clear(); joy = { x: 0, y: 0 };
    if (stickPointer !== null) {
      const stick = $('stick');
      if (stick.hasPointerCapture?.(stickPointer)) stick.releasePointerCapture(stickPointer);
    }
    stickPointer = null; $('stick').firstElementChild.style.transform = '';
  }
  function show(id) {
    $('overlay').hidden = !id;
    $('hud').hidden = !!id || state !== 'playing';
    for (const name of ['menu', 'garage', 'upgrade', 'pauseMenu', 'end']) $(name).hidden = name !== id;
    document.body.classList.toggle('playing', state === 'playing');
    if (id) {
      clearInput();
      $(id).querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
    } else document.activeElement?.blur();
    accumulator = 0;
  }
  function renderBuild(id) {
    const target = $(id); target.replaceChildren();
    for (const [key, rank] of Object.entries(build)) {
      const u = upgrades.find(u => u.id === key), el = document.createElement('span');
      el.innerHTML = `${u.icon} ${u.name} <b>${rank}</b>`; target.append(el);
    }
  }
  function saveProgress() {
    try {
      localStorage.setItem('neon-riot-progression', JSON.stringify(profile));
      progressSaved = true;
    } catch { progressSaved = false; }
    setText('saveStatus', progressSaved ? 'Progress is saved on this browser and device. Clearing site data erases it.' : 'Storage is unavailable. Progress will last only until this page closes.');
  }
  function renderSetup() {
    setText('wallet', `${profile.scrap} SCRAP`);
    $('difficulties').replaceChildren();
    progression.difficulties.forEach((d, i) => {
      const button = document.createElement('button');
      button.className = 'difficulty-option'; button.disabled = i > profile.unlocked;
      button.setAttribute('aria-pressed', String(i === profile.selected));
      button.innerHTML = `<strong>${d.name}</strong><small>${button.disabled ? `Beat ${progression.difficulties[i - 1].name} to unlock` : `${d.reward}× Scrap · ${profile.wins[i]} wins`}</small>`;
      button.onclick = () => {
        profile.selected = i; saveProgress(); renderSetup();
        $('difficulties').children[i].focus({ preventScroll: true });
      };
      $('difficulties').append(button);
    });
    const d = progression.difficulties[profile.selected];
    setText('difficultyInfo', `${d.density}× spawns · ${d.health}× enemy hull · ${d.damage}× damage${d.elite ? ` · ${Math.round(d.elite * 100)}% elites` : ''} · ${d.reward}× Scrap. ${profile.selected === 0 ? 'Beat the boss to unlock Overdrive.' : 'Faster enemies and attacks. Stronger boss cores.'}`);
  }
  function renderWorkshop() {
    setText('garageWallet', profile.scrap);
    $('permanentUpgrades').replaceChildren();
    progression.upgrades.forEach(u => {
      const rank = profile.ranks[u.id], cost = u.costs[rank];
      const card = document.createElement('article'); card.className = 'workshop-card';
      card.innerHTML = `<h3><span aria-hidden="true">${u.icon}</span>${u.name}</h3><small>RANK ${rank} / ${u.costs.length} · ${u.bonus(rank)}</small><p>${u.description}</p><small>${cost === undefined ? 'Fully upgraded' : `Next: ${u.bonus(rank + 1)}`}</small>`;
      const button = document.createElement('button'); button.className = 'quiet';
      button.textContent = cost === undefined ? 'MAXED' : `${cost} SCRAP${profile.scrap < cost ? ` · NEED ${cost - profile.scrap} MORE` : ' · UPGRADE'}`;
      button.disabled = cost === undefined || profile.scrap < cost;
      button.onclick = () => {
        if (state !== 'garage' || !progression.buy(profile, u.id)) return;
        saveProgress(); renderWorkshop(); renderSetup(); sound('level');
        // The purchased button is replaced; give keyboard users a stable next target.
        $('permanentUpgrades').querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
        if (!document.activeElement || document.activeElement === document.body) $('garageBack').focus();
      };
      card.append(button); $('permanentUpgrades').append(card);
    });
  }
  function openWorkshop() {
    if (state !== 'menu' && state !== 'end') return;
    state = 'garage'; $('hud').hidden = true; renderWorkshop(); show('garage');
  }
  function openMenu() {
    if (!['garage', 'end'].includes(state)) return;
    state = 'menu'; $('hud').hidden = true; renderSetup(); show('menu');
  }
  function start() {
    initAudio();
    runDifficulty = profile.selected; difficulty = progression.difficulties[runDifficulty];
    earnings = null; newUnlock = '';
    player = {
      x: 0, y: 0, r: 12, hp: 100, maxHp: 100, speed: 235, damage: 19, fireRate: .38, fire: 0,
      projectiles: 1, pierce: 0, bulletSpeed: 700, magnet: 120, regen: 0,
      dash: 0, dashMax: 2.4, dashing: 0, dashRefund: 0, dx: 1, dy: 0, inv: 1,
      orbit: 0, orbitDamage: 22, blast: 0, blastTimer: 0, crit: .07, aim: 0, recoil: 0, moving: 0
    };
    player.hp = player.maxHp = 100 + profile.ranks.hull * 10;
    player.damage *= 1 + profile.ranks.rounds * .06;
    player.fireRate /= 1 + profile.ranks.attackSpeed * .08;
    player.magnet *= 1 + profile.ranks.magnet * .1;
    player.dashMax *= 1 - profile.ranks.dash * .04;
    enemies = []; bullets = []; gems = []; particles = []; rings = []; texts = []; enemyShots = []; trails = [];
    build = {}; choices = []; grid.clear(); clock = 0; fxClock = 0; kills = 0; level = 1; xp = 0; need = 8;
    spawn = .65; enemyId = 0; shake = 0; hurtFlash = 0; bossSpawned = false; cam = { x: 0, y: 0 };
    rerolls = 2 + profile.ranks.rerolls; hudTime = 0; endDelay = 0; soundTimes = {}; pickupNote = 0;
    stats = { dashKills: 0, dodged: 0, taken: 0, lastHit: '', damage: { Rounds: 0, Blades: 0, Shockwave: 0, Dash: 0 } };
    clearInput(); $('bossbar').hidden = true; $('bossbar').classList.remove('armored'); $('hud').hidden = false;
    state = 'playing'; show(null); sound('level');
    // Put the first targets just outside the screen rather than a distant circular perimeter.
    for (let i = 0; i < 3; i++) spawnEnemy('chaser');
    updateHud();
  }

  // Same compact upgrade pool; previews show the actual change, not vague percentages.
  const upgrades = [
    { id: 'damage', name: 'Hot rounds', icon: '↗', max: 6, offense: true,
      desc: 'Every bullet hits 30% harder. Simple. Extremely effective.',
      preview: () => `${Math.round(player.damage)} → ${Math.round(player.damage * 1.3)} damage / round`,
      apply: () => player.damage *= 1.3 },
    { id: 'rate', name: 'Trigger happy', icon: '≋', max: 6, offense: true,
      desc: 'Fire 22% faster. Less thinking, more bullets.',
      preview: () => `${(1 / player.fireRate).toFixed(1)} → ${(1.22 / player.fireRate).toFixed(1)} volleys / second`,
      apply: () => player.fireRate /= 1.22 },
    { id: 'multi', name: 'The more the merrier', icon: '⋮', max: 5, offense: true,
      desc: 'Add a projectile to every volley. Shotgun diplomacy.',
      preview: () => `${player.projectiles} → ${player.projectiles + 1} rounds / volley`,
      apply: () => player.projectiles++ },
    { id: 'pierce', name: 'Through & through', icon: '➜', max: 4, offense: true,
      desc: 'Each round passes through one more enemy. Punish a crowded room.',
      preview: () => `${player.pierce + 1} → ${player.pierce + 2} targets / round`,
      apply: () => player.pierce++ },
    { id: 'orbit', name: 'Personal space', icon: '✧', max: 5, offense: true,
      desc: 'Add an orbiting blade. Damage scales as the riot gets nastier.',
      preview: () => `${player.orbit} → ${player.orbit + 1} blades · ${Math.round(bladeDamage())} damage / hit`,
      apply: () => player.orbit++ },
    { id: 'blast', name: 'Shock therapy', icon: '◎', max: 5, offense: true,
      desc: 'An automatic shockwave every 5s. Knocks back enemies and clears bullets.',
      preview: () => `${player.blast ? 40 + player.blast * 35 : 0} → ${40 + (player.blast + 1) * 35} area damage`,
      apply: () => { player.blast++; player.blastTimer = .5; } },
    { id: 'speed', name: 'Gotta go fast', icon: 'ϟ', max: 4,
      desc: 'Move 15% faster. Dash recharges 15% sooner. Never be where they expect.',
      preview: () => `Dash ${player.dashMax.toFixed(2)}s → ${(player.dashMax * .85).toFixed(2)}s · +15% speed`,
      apply: () => { player.speed *= 1.15; player.dashMax *= .85; player.dash = Math.min(player.dash, player.dashMax); } },
    { id: 'health', name: 'Built different', icon: '♥', max: 5,
      desc: 'Add 30 maximum hull and repair 50 immediately. A second wind.',
      preview: () => `${Math.ceil(player.hp)} / ${player.maxHp} → ${Math.ceil(Math.min(player.hp + 50, player.maxHp + 30))} / ${player.maxHp + 30} hull`,
      apply: () => { player.maxHp += 30; player.hp = Math.min(player.maxHp, player.hp + 50); } },
    { id: 'regen', name: 'Self repair', icon: '✚', max: 4,
      desc: 'Regenerate hull every second. A little breathing room goes a long way.',
      preview: () => `${player.regen.toFixed(1)} → ${(player.regen + 1.5).toFixed(1)} hull / second`,
      apply: () => player.regen += 1.5 },
    { id: 'magnet', name: 'Greedy little thing', icon: '◈', max: 3,
      desc: 'Pull in shards from 65% farther away. Spend less time chasing your lunch.',
      preview: () => `${Math.round(player.magnet)} → ${Math.round(player.magnet * 1.65)} pickup radius`,
      apply: () => player.magnet *= 1.65 },
    { id: 'crit', name: 'Bad intentions', icon: '✴', max: 5, offense: true,
      desc: 'Add 15% critical chance. Critical rounds deal triple damage.',
      preview: () => `${Math.round(player.crit * 100)}% → ${Math.round((player.crit + .15) * 100)}% critical chance`,
      apply: () => player.crit += .15 },
    { id: 'overdrive', name: 'Glass cannon', icon: '☄', max: 3, offense: true,
      desc: '55% more bullet damage. Fire 15% faster. Trade away 20 maximum hull.',
      preview: () => `${Math.round(player.damage)} → ${Math.round(player.damage * 1.55)} damage · hull ${player.maxHp} → ${player.maxHp - 20}`,
      available: () => player.maxHp > 40,
      apply: () => { player.damage *= 1.55; player.fireRate /= 1.15; player.maxHp -= 20; player.hp = Math.min(player.hp, player.maxHp); } }
  ];
  function bladeDamage() { return player.orbitDamage * (1 + clock / 120); }
  function synergy(u) {
    if (u.id === 'multi' && build.pierce || u.id === 'pierce' && build.multi) return 'BUILD MATCH · fill the screen, pierce the crowd';
    if (u.id === 'crit' && (build.multi || build.rate)) return 'BUILD MATCH · more rounds, more critical hits';
    if (u.id === 'orbit' && (build.speed || build.regen)) return 'BUILD MATCH · get close, stay alive';
    if (u.id === 'speed' && build.orbit) return 'BUILD MATCH · take your blades to them';
    if (u.id === 'damage' && (build.multi || build.rate)) return 'BUILD MATCH · every extra round hits harder';
    if (u.id === 'regen' && build.overdrive) return 'BUILD MATCH · patch up that glass cannon';
    if (u.id === 'magnet' && (build.blast || build.pierce)) return 'BUILD MATCH · collect the whole crowd';
    return '';
  }
  function shuffled(list) {
    const result = [...list];
    for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
    return result;
  }
  function draft(exclude = []) {
    let pool = upgrades.filter(u => (build[u.id] || 0) < u.max && (!u.available || u.available()));
    const fresh = pool.filter(u => !exclude.includes(u.id));
    if (fresh.length >= 3 && fresh.some(u => u.offense)) pool = fresh;
    choices = shuffled(pool).slice(0, 3);
    // Every draft has a way to increase damage. Defensive luck can't brick a run.
    if (!choices.some(u => u.offense)) {
      const offensive = shuffled(pool.filter(u => u.offense));
      if (offensive.length) choices[0] = offensive[0];
    }
    renderCards();
  }
  function renderCards() {
    setText('upgradeLevel', `LEVEL ${level} · POWER SPIKE`);
    $('cards').replaceChildren();
    choices.forEach((u, i) => {
      const button = document.createElement('button'); button.className = 'card';
      const rank = build[u.id] || 0, match = synergy(u);
      button.innerHTML = `<span class="key">0${i + 1}</span><span class="icon" aria-hidden="true">${u.icon}</span><span class="tier">${rank ? `RANK ${rank} → ${rank + 1}` : 'NEW POWER'} / ${u.max}</span><strong>${u.name}</strong><p>${u.desc}</p><span class="preview">${u.preview()}</span>${match ? `<span class="synergy">${match}</span>` : ''}`;
      button.onclick = () => choose(i); $('cards').append(button);
    });
    $('reroll').innerHTML = `↻ REROLL · ${rerolls} LEFT <kbd>R</kbd>`;
    $('reroll').disabled = rerolls === 0;
    renderBuild('draftBuild');
  }
  function levelUp() {
    xp -= need; level++; need = Math.floor(need * 1.17 + 4);
    state = 'upgrade'; sound('level'); draft(); show('upgrade'); updateHud();
  }
  function choose(i) {
    if (state !== 'upgrade' || !choices[i]) return;
    const u = choices[i]; u.apply(); build[u.id] = (build[u.id] || 0) + 1;
    player.inv = Math.max(player.inv, .8); player.fire = Math.min(player.fire, player.fireRate);
    state = 'playing'; show(null); sound('level'); updateHud();
    if (xp >= need) levelUp();
  }
  function reroll() {
    if (state !== 'upgrade' || rerolls <= 0) return;
    rerolls--; draft(choices.map(u => u.id)); sound('reroll');
    $('cards').querySelector('button')?.focus({ preventScroll: true });
  }
  function pause() {
    if (state === 'playing') {
      state = 'paused'; setText('pauseStats', `${difficulty.name} · ${formatTime(clock)} · Level ${level} · ${kills} eliminations`);
      renderBuild('pauseBuild'); show('pauseMenu');
    } else if (state === 'paused') { state = 'playing'; show(null); }
  }
  function movement() {
    let x = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0) + joy.x;
    let y = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0) + joy.y;
    const length = Math.hypot(x, y);
    return length > 1 ? { x: x / length, y: y / length } : { x, y };
  }
  function dash() {
    if (state !== 'playing' || player.dash > .001) return;
    let v = movement(), length = Math.hypot(v.x, v.y);
    // Analog input chooses a direction, not a weaker dash.
    if (length < .1) v = { x: player.dx, y: player.dy };
    else v = { x: v.x / length, y: v.y / length };
    player.dx = v.x; player.dy = v.y; player.dashing = .2; player.dash = player.dashMax;
    player.dashRefund = 0; player.inv = Math.max(player.inv, .42);
    shake = Math.max(shake, 3); sound('dash'); ring(player.x, player.y, 50, COLORS.mint, .25);
  }

  function burst(x, y, color, n = 8, power = 130) {
    n = calm ? Math.ceil(n * .35) : n;
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), speed = rand(20, power), life = rand(.18, .5);
      particles.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life, max: life, r: rand(1.5, 4), color });
    }
  }
  function ring(x, y, r, color, life = .4) { rings.push({ x, y, r, color, life, max: life }); }
  function floating(x, y, text, color = COLORS.gold, life = .65, size = 14) { texts.push({ x, y, text, color, life, max: life, size }); }
  function damage(e, amount, source = 'Rounds', critical = false) {
    if (e.dead || e.entry > 0 || e.armor > 0 || state !== 'playing') return false;
    const floor = e.boss && e.phase < 2 ? e.maxHp * (2 - e.phase) / 3 : 0;
    const actual = Math.min(e.hp - floor, amount);
    e.hp -= actual; e.flash = .09; stats.damage[source] += actual;
    if (critical) sound('crit');
    if (e.boss && e.phase < 2 && e.hp <= floor) {
      e.phase++; e.enraged = true; e.armor = 1.5; e.speed *= 1.1;
      e.windup = 0; e.attack = 0; e.pattern = 0;
      ring(e.x, e.y, e.r + 80, COLORS.blue, 1.5);
      sound('warning');
    }
    if (e.hp > 0) return false;
    e.dead = true; kills++;
    burst(e.x, e.y, e.color, e.boss ? 100 : e.type === 'tank' ? 16 : 8, e.boss ? 460 : 150);
    if (e.type === 'tank') ring(e.x, e.y, 40, e.color, .25);
    sound('kill');
    if (source === 'Dash') {
      stats.dashKills++;
      const refund = Math.min(.16, .8 - player.dashRefund);
      player.dash = Math.max(0, player.dash - refund); player.dashRefund += refund;
    }
    if (!e.boss) {
      const value = e.type === 'tank' ? 5 : e.type === 'shooter' ? 3 : e.type === 'runner' ? 2 : 1;
      gems.push({ x: e.x, y: e.y, value: value * (e.elite ? 2 : 1), r: e.type === 'tank' || e.elite ? 6 : 4 });
      if (Math.random() < .006 || (kills % 140 === 0 && player.hp < player.maxHp * .65)) {
        gems.push({ x: e.x + 10, y: e.y, value: 0, heal: 18, r: 7 });
      }
    } else finish(true);
    return true;
  }
  function hurt(amount, source = 'the swarm', x = player.x, y = player.y) {
    if (player.inv > 0 || state !== 'playing') return;
    amount = Math.round(amount * difficulty.damage);
    stats.taken += Math.min(player.hp, amount); stats.lastHit = source;
    player.hp = Math.max(0, player.hp - amount); player.inv = .7; shake = 8; hurtFlash = .25;

    burst(player.x, player.y, COLORS.pink, 14); sound('hurt');
    floating(player.x, player.y - 25, `−${amount}`, COLORS.pink, .8, 19);
    player.hurtAngle = Math.atan2(y - player.y, x - player.x);
    if (player.hp === 0) finish(false);
  }
  function finish(win) {
    if (state !== 'playing') return;
    if (!earnings) {
      earnings = progression.reward(clock, kills, win, runDifficulty);
      const previouslyUnlocked = profile.unlocked;
      progression.settle(profile, earnings, win, runDifficulty);
      if (profile.unlocked > previouslyUnlocked) newUnlock = progression.difficulties[profile.unlocked].name;
      saveProgress();
    }
    winRun = win; state = 'ending'; endDelay = win ? 1.2 : .8; clearInput();
    document.body.classList.remove('playing');
    shake = win ? 14 : 11; sound(win ? 'win' : 'boom');
    for (const b of enemyShots) burst(b.x, b.y, COLORS.gold, 3, 80);
    enemyShots = [];
    if (win) {
      const boss = enemies.find(e => e.boss);
      if (boss) { ring(boss.x, boss.y, 450, COLORS.pink, 1.1); ring(boss.x, boss.y, 280, COLORS.mint, .8); }
      for (const g of gems) g.pulling = true;
    } else { burst(player.x, player.y, COLORS.mint, 60, 280); ring(player.x, player.y, 150, COLORS.pink, .7); }
    updateHud();
  }
  function showResults() {
    state = 'end';
    const record = kills > best; best = Math.max(best, kills); store.set('best', best);
    setText('endLabel', record ? 'NEW PERSONAL BEST. SAME BEAUTIFUL CHAOS.' : winRun ? 'YOU WERE THE FINAL BOSS.' : 'OUTNUMBERED. NOT OUTCLASSED.');
    $('endTitle').innerHTML = winRun ? 'RIOT <em>COMPLETE.</em>' : 'BEAUTIFUL <em>CHAOS.</em>';
    setText('endStats', `${difficulty.name} · ${formatTime(clock)} survived · Level ${level}${winRun ? ' · Obliterator destroyed' : ''}`);
    setText('scrapEarned', `+${earnings?.total ?? 0} SCRAP`);
    setText('scrapBreakdown', earnings ? `Survival ${earnings.survival} + eliminations ${earnings.combat} + victory ${earnings.victory} · ${earnings.multiplier}× threat bonus${winRun ? '' : ' · DEFEAT: −80% (keep 20%)'}` : '');
    setText('unlockNotice', `${newUnlock ? `${newUnlock.toUpperCase()} UNLOCKED. ` : ''}${profile.scrap} Scrap available in the workshop.${progressSaved ? '' : ' Storage unavailable: keep this page open to retain progress.'}`);
    $('runStats').innerHTML = `<div><strong>${kills}</strong><small>ELIMINATIONS</small></div><div><strong>${level}</strong><small>LEVEL REACHED</small></div><div><strong>${stats.dashKills}</strong><small>DASH KILLS</small></div>`;
    const total = Object.values(stats.damage).reduce((a, b) => a + b, 0);
    $('damageReport').innerHTML = '<div class="report-title">YOUR DAMAGE, DISSECTED</div>' + Object.entries(stats.damage).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).map(([name, n]) => `<div class="damage-row"><span>${name}</span><i><i style="width:${n / total * 100}%"></i></i><b>${Math.round(n / total * 100)}%</b></div>`).join('');
    renderBuild('endBuild');
    let tip = winRun ? `${stats.dodged} bullets erased. ${stats.taken === 0 ? 'Not a scratch. Ridiculous.' : 'Same three minutes. What will you build next?'}` :
      stats.lastHit === 'a projectile' ? 'Dashed too late? Dash and shockwaves erase incoming bullets.' :
      stats.lastHit === 'the Obliterator' ? 'The boss locks its aim before firing. Move across the warning lines.' :
      stats.dashKills < 3 ? 'Be aggressive: dash through the swarm. Shred kills refund dash cooldown.' :
      !build.pierce && !build.blast ? 'Crowds getting thick? Piercing rounds or shockwaves make room.' : 'Keep circling the shards. More levels means more bad decisions.';
    setText('endTip', tip); setText('best', `PERSONAL BEST · ${best} ELIMINATIONS`);
    show('end');
  }

  function onScreen(x, y, margin = 0) {
    return Math.abs(x - cam.x) < viewW / 2 + margin && Math.abs(y - cam.y) < viewH / 2 + margin;
  }
  function edgePosition() {
    const a = rand(0, TAU), dx = Math.cos(a), dy = Math.sin(a);
    const distance = Math.min((viewW / 2 + 45) / Math.max(.001, Math.abs(dx)), (viewH / 2 + 45) / Math.max(.001, Math.abs(dy)));
    return { x: cam.x + dx * distance, y: cam.y + dy * distance };
  }
  function spawnEnemy(type) {
    const position = edgePosition(), scale = 1 + Math.min(clock, BOSS_TIME) / 155;
    const defs = {
      chaser: { r: 12, hp: 25, speed: rand(82, 103), color: COLORS.pink, damage: 12 },
      runner: { r: 9, hp: 19, speed: rand(163, 184), color: '#ffc665', damage: 10 },
      tank: { r: 23, hp: 130, speed: 59, color: '#b587ff', damage: 22 },
      shooter: { r: 16, hp: 57, speed: 73, color: COLORS.blue, damage: 14 },
      boss: { r: 52, hp: 48000, speed: 76, color: COLORS.pink, damage: 28 }
    };
    const e = {
      ...defs[type], ...position, id: ++enemyId, type, flash: 0, attack: rand(1, 2), dead: false,
      bladeHit: 0, dashHit: 0, vx: 0, vy: 0, kx: 0, ky: 0, windup: 0, windupMax: 0, aim: 0,
      entry: type === 'boss' ? 1.3 : .15, pattern: 0, enraged: false, boss: type === 'boss',
      phase: 0, armor: 0, elite: false
    };
    if (e.boss) { e.x = cam.x + viewW * .22; e.y = cam.y - viewH * .26; e.attack = 1.5; }
    e.hp *= e.boss ? difficulty.boss : scale * difficulty.health;
    if (!e.boss && clock >= 35 && difficulty.elite > 0 && Math.random() < difficulty.elite) {
      e.elite = true; e.hp *= 2.2; e.damage *= 1.2; e.r *= 1.15; e.color = COLORS.gold;
    }
    e.maxHp = e.hp;
    e.speed *= (1 + Math.min(clock / 650, .28)) * difficulty.speed;
    enemies.push(e); return e;
  }
  function buildGrid() {
    grid.clear();
    for (const e of enemies) {
      if (e.dead) continue;
      const key = `${Math.floor(e.x / CELL)},${Math.floor(e.y / CELL)}`;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(e);
    }
  }
  function nearby(x, y, radius) {
    const result = [];
    for (let gx = Math.floor((x - radius) / CELL); gx <= Math.floor((x + radius) / CELL); gx++) {
      for (let gy = Math.floor((y - radius) / CELL); gy <= Math.floor((y + radius) / CELL); gy++) {
        const cell = grid.get(`${gx},${gy}`); if (cell) result.push(...cell);
      }
    }
    return result;
  }
  function segmentT(ax, ay, bx, by, x, y) {
    const dx = bx - ax, dy = by - ay;
    return clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  }
  function segmentHit(ax, ay, bx, by, x, y, radius) {
    const t = segmentT(ax, ay, bx, by, x, y);
    return (x - lerp(ax, bx, t)) ** 2 + (y - lerp(ay, by, t)) ** 2 <= radius * radius;
  }
  function fire() {
    let target = null, distance = 820 ** 2;
    for (const e of enemies) {
      if (e.dead || e.entry > 0 || !onScreen(e.x, e.y, 30)) continue;
      const d = (e.x - player.x) ** 2 + (e.y - player.y) ** 2;
      if (d < distance) { distance = d; target = e; }
    }
    if (!target) return false;
    const lead = Math.min(.5, Math.sqrt(distance) / player.bulletSpeed);
    const angle = Math.atan2(target.y + target.vy * lead - player.y, target.x + target.vx * lead - player.x);
    player.aim = angle; player.recoil = 1;
    for (let i = 0; i < player.projectiles; i++) {
      const a = angle + (i - (player.projectiles - 1) / 2) * .105;
      bullets.push({ x: player.x + Math.cos(a) * 18, y: player.y + Math.sin(a) * 18, vx: Math.cos(a) * player.bulletSpeed, vy: Math.sin(a) * player.bulletSpeed, life: 1.2, left: player.pierce, hit: new Set(), r: 3.5 });
    }
    sound('shot'); return true;
  }
  function emitShot(e, angle, speed = 215, r = 5) {
    speed *= difficulty.attack * (e.boss ? 1 + e.phase * .07 : 1);
    enemyShots.push({ x: e.x + Math.cos(angle) * (e.r + 5), y: e.y + Math.sin(angle) * (e.r + 5), vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r, life: 5.5, boss: e.boss });
  }
  function attackAngles(e) {
    if (!e.boss) return [e.aim];
    const count = 16 + e.phase * 4;
    if (e.pattern % 2 === 0) return Array.from({ length: count }, (_, i) => e.aim + i * TAU / count);
    return Array.from({ length: 5 + e.phase * 2 }, (_, i) => e.aim + (i - 2 - e.phase) * .18);
  }
  function enemyAttack(e, dt) {
    if (e.type !== 'shooter' && !e.boss || e.entry > 0) return;
    if (e.windup > 0) {
      e.windup = Math.max(0, e.windup - dt);
      if (e.windup === 0) {
        for (const a of attackAngles(e)) emitShot(e, a, e.boss ? (e.pattern % 2 ? 260 : 175) : 230, e.boss ? 6 : 5);
        ring(e.x, e.y, e.r + 25, e.color, .25);
        e.pattern++; e.attack = (e.boss ? 1.35 - e.phase * .25 : 1.85) / difficulty.attack;
      }
    } else {
      e.attack -= dt;
      // No off-screen sniper shots. Aim is locked for the entire visible windup.
      if (e.attack <= 0 && onScreen(e.x, e.y, -25)) {
        e.windupMax = e.boss ? .85 - e.phase * .1 : .7;
        e.windup = e.windupMax;
        e.aim = Math.atan2(player.y - e.y, player.x - e.x);
        if (e.boss && e.pattern % 2 === 0) e.aim += TAU / (2 * (16 + e.phase * 4)); // Leave an escape gap toward the player.
      }
    }
  }
  function separateEnemies(dt) {
    for (const e of enemies) {
      if (e.dead) continue;
      for (const other of nearby(e.x, e.y, e.r + 54)) {
        if (other.id <= e.id || other.dead) continue;
        let dx = other.x - e.x, dy = other.y - e.y, distance = Math.hypot(dx, dy);
        const min = (e.r + other.r) * .86;
        if (distance >= min) continue;
        if (distance < .01) { dx = 1; dy = 0; distance = 1; }
        const push = Math.min(3, (min - distance) * dt * 8), nx = dx / distance, ny = dy / distance;
        if (!e.boss) { e.x -= nx * push; e.y -= ny * push; }
        if (!other.boss) { other.x += nx * push; other.y += ny * push; }
      }
    }
  }
  function updateEnemies(dt, oldX, oldY, wasDashing) {
    for (const e of enemies) {
      if (e.dead) continue;
      e.flash -= dt; e.bladeHit -= dt; e.dashHit -= dt; e.entry = Math.max(0, e.entry - dt);
      e.armor = Math.max(0, e.armor - dt);
      const dx = player.x - e.x, dy = player.y - e.y, distance = Math.hypot(dx, dy) || 1;
      let move = e.type === 'shooter' ? (distance < 220 ? -.65 : distance < 320 ? 0 : 1) : 1;
      if (e.windup > 0) move *= e.boss ? .15 : 0;
      if (e.entry > 0) move = 0;
      e.vx = dx / distance * e.speed * move; e.vy = dy / distance * e.speed * move;
      e.x += (e.vx + e.kx) * dt; e.y += (e.vy + e.ky) * dt;
      e.kx *= Math.exp(-dt * 9); e.ky *= Math.exp(-dt * 9);
      enemyAttack(e, dt);
      if (e.entry > 0) continue;
      // Swept dash collision: every enemy along the path is hit, even at low frame rates.
      if (wasDashing && e.dashHit <= 0 && segmentHit(oldX, oldY, player.x, player.y, e.x, e.y, e.r + player.r + 3)) {
        damage(e, 85 + player.damage * .8, 'Dash'); e.dashHit = .35;
        if (!e.boss) { e.kx = player.dx * 320; e.ky = player.dy * 320; }
        shake = Math.max(shake, 4);
      } else if (!wasDashing && Math.hypot(e.x - player.x, e.y - player.y) < e.r + player.r - 2) {
        hurt(e.damage, e.boss ? 'the Obliterator' : 'the swarm', e.x, e.y);
      }
      if (state !== 'playing') return;
      if (player.orbit && e.bladeHit <= 0 && !e.dead) {
        for (let i = 0; i < player.orbit; i++) {
          const a = clock * 3.5 + i * TAU / player.orbit;
          const bx = player.x + Math.cos(a) * 75, by = player.y + Math.sin(a) * 75;
          if (Math.hypot(e.x - bx, e.y - by) < e.r + 14) {
            damage(e, bladeDamage(), 'Blades'); e.bladeHit = .22;
            burst(bx, by, COLORS.mint, 3); break;
          }
        }
      }
      if (state !== 'playing') return;
      if (!e.boss && !onScreen(e.x, e.y, 420)) { Object.assign(e, edgePosition()); e.attack = Math.max(e.attack, 1); e.windup = 0; }
    }
    buildGrid(); separateEnemies(dt); buildGrid();
  }
  function updateBullets(dt) {
    for (const b of bullets) {
      if (b.life <= 0) continue;
      const ox = b.x, oy = b.y;
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      const candidates = nearby((b.x + ox) / 2, (b.y + oy) / 2, 60 + Math.hypot(b.x - ox, b.y - oy) / 2)
        .filter(e => !e.dead && e.entry <= 0 && !b.hit.has(e.id) && segmentHit(ox, oy, b.x, b.y, e.x, e.y, e.r + b.r))
        .sort((a, c) => segmentT(ox, oy, b.x, b.y, a.x, a.y) - segmentT(ox, oy, b.x, b.y, c.x, c.y));
      for (const e of candidates) {
        const crit = Math.random() < player.crit;
        damage(e, player.damage * (crit ? 3 : 1), 'Rounds', crit); b.hit.add(e.id);
        if (!e.boss) { e.kx += b.vx * .035; e.ky += b.vy * .035; }
        burst(e.x, e.y, crit ? COLORS.gold : '#dceec5', crit ? 5 : 2, 85);
        if (state !== 'playing') return;
        if (b.left-- <= 0) { b.life = 0; break; }
      }
    }
  }
  function clearShot(b) {
    b.life = 0; stats.dodged++; burst(b.x, b.y, COLORS.gold, 3, 100); sound('clear');
  }
  function updateEnemyShots(dt, oldX, oldY, wasDashing) {
    for (const b of enemyShots) {
      if (b.life <= 0) continue;
      const ox = b.x, oy = b.y;
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      // Relative swept collision handles a bullet and the player moving in the same tick.
      if (segmentHit(ox - oldX, oy - oldY, b.x - player.x, b.y - player.y, 0, 0, b.r + (wasDashing ? 28 : player.r - 2))) {
        if (wasDashing) clearShot(b);
        else { hurt(b.boss ? 12 : 10, b.boss ? 'the Obliterator' : 'a projectile', b.x, b.y); b.life = 0; }
      }
      if (state !== 'playing') return;
    }
  }
  function shockwave(dt) {
    if (!player.blast) return;
    player.blastTimer -= dt;
    if (player.blastTimer > 0) return;
    const radius = 150 + player.blast * 28;
    ring(player.x, player.y, radius, COLORS.blue, .5); sound('boom'); shake = Math.max(shake, 4);
    for (const e of enemies) {
      if (Math.hypot(e.x - player.x, e.y - player.y) >= radius + e.r) continue;
      damage(e, 40 + player.blast * 35, 'Shockwave');
      if (state !== 'playing') return;
      if (!e.boss) { const a = Math.atan2(e.y - player.y, e.x - player.x); e.kx = Math.cos(a) * 380; e.ky = Math.sin(a) * 380; }
    }
    for (const b of enemyShots) if (b.life > 0 && Math.hypot(b.x - player.x, b.y - player.y) < radius) clearShot(b);
    player.blastTimer = 5;
  }
  function collectGems(dt) {
    let picked = false;
    for (const g of gems) {
      const dx = player.x - g.x, dy = player.y - g.y, distance = Math.hypot(dx, dy);
      if (g.heal && player.hp >= player.maxHp && !g.pulling) continue; // Don't waste a repair at full hull.
      if (distance < (g.heal ? Math.min(player.magnet, 100) : player.magnet) || g.pulling) {
        g.pulling = true;
        const step = Math.min(distance, (420 + player.magnet) * dt);
        g.x += dx / (distance || 1) * step; g.y += dy / (distance || 1) * step;
      }
      if (Math.hypot(g.x - player.x, g.y - player.y) < 19) {
        g.dead = true;
        if (g.heal) {
          const amount = Math.min(g.heal, player.maxHp - player.hp); player.hp += amount;
          floating(player.x, player.y - 32, `+${Math.ceil(amount)} HULL`, COLORS.mint, 1, 12); ring(player.x, player.y, 35, COLORS.mint, .3);
        } else xp += g.value;
        picked = true;
      }
    }
    if (picked) sound('gem');
    gems = gems.filter(g => !g.dead);
    // Merge shards only within the same distant cell; their value and location stay meaningful.
    if (gems.length > 400) {
      const cells = new Map();
      for (const g of gems) {
        if (g.heal || g.pulling || Math.hypot(g.x - player.x, g.y - player.y) < player.magnet + 150) continue;
        const key = `${Math.floor(g.x / 100)},${Math.floor(g.y / 100)}`;
        const other = cells.get(key);
        if (other) { other.value += g.value; other.r = 7; g.dead = true; } else cells.set(key, g);
      }
      gems = gems.filter(g => !g.dead);
    }
  }
  function director(dt) {
    spawn -= dt;
    if (spawn <= 0) {
      const count = bossSpawned ? 2 : 1 + Math.floor(clock / 45);
      for (let i = 0; i < count && enemies.length < 210; i++) {
        const r = Math.random();
        spawnEnemy(clock > 55 && r < .13 ? 'shooter' : clock > 30 && r < .3 ? 'tank' : clock > 12 && r < .52 ? 'runner' : 'chaser');
      }
      spawn = (bossSpawned ? .9 : Math.max(.26, .85 - clock * .0032)) / difficulty.density;
    }
    if (clock >= BOSS_TIME && !bossSpawned) {
      bossSpawned = true; spawnEnemy('boss'); $('bossbar').hidden = false;
      for (const g of gems) if (!g.heal) g.pulling = true;
      for (const b of enemyShots) { burst(b.x, b.y, COLORS.gold, 2); b.life = 0; }
      player.inv = Math.max(player.inv, 1.5); sound('warning');
    }
  }

  function update(dt) {
    if (state !== 'playing') return;
    clock += dt; player.inv = Math.max(0, player.inv - dt); player.recoil = Math.max(0, player.recoil - dt * 12);
    const oldDash = player.dash;
    player.dash = Math.max(0, player.dash - dt);
    if (oldDash > 0 && player.dash === 0) { sound('ready'); ring(player.x, player.y, 25, COLORS.mint, .22); }
    player.hp = Math.min(player.maxHp, player.hp + player.regen * dt);
    const oldX = player.x, oldY = player.y, wasDashing = player.dashing > 0, v = movement();
    player.moving = Math.hypot(v.x, v.y);
    if (wasDashing) {
      const dashDt = Math.min(dt, player.dashing);
      player.x += player.dx * 1050 * dashDt; player.y += player.dy * 1050 * dashDt;
      player.dashing = Math.max(0, player.dashing - dt);
      trails.push({ x: player.x, y: player.y, angle: Math.atan2(player.dy, player.dx), life: .18 });
    } else {
      player.x += v.x * player.speed * dt; player.y += v.y * player.speed * dt;
      if (player.moving > .1) { player.dx = v.x / player.moving; player.dy = v.y / player.moving; }
    }
    cam.x = lerp(cam.x, player.x, 1 - Math.exp(-dt * 10)); cam.y = lerp(cam.y, player.y, 1 - Math.exp(-dt * 10));
    director(dt);
    updateEnemies(dt, oldX, oldY, wasDashing); if (state !== 'playing') return;
    player.fire -= dt;
    if (player.fire <= 0) player.fire = fire() ? player.fire + player.fireRate : 0;
    shockwave(dt); if (state !== 'playing') return;
    updateBullets(dt); if (state !== 'playing') return;
    updateEnemyShots(dt, oldX, oldY, wasDashing); if (state !== 'playing') return;
    collectGems(dt);
    enemies = enemies.filter(e => !e.dead); bullets = bullets.filter(b => b.life > 0); enemyShots = enemyShots.filter(b => b.life > 0);
    if (xp >= need) levelUp();
    hudTime -= dt; if (hudTime <= 0) { updateHud(); hudTime = .08; }
  }
  function effects(dt) {
    fxClock += dt; shake = Math.max(0, shake - dt * 26); hurtFlash = Math.max(0, hurtFlash - dt);
    for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= Math.exp(-dt * 4); p.vy *= Math.exp(-dt * 4); p.life -= dt; }
    particles = particles.filter(p => p.life > 0).slice(-700);
    for (const r of rings) r.life -= dt; rings = rings.filter(r => r.life > 0);
    for (const t of texts) { t.y -= dt * 35; t.life -= dt; } texts = texts.filter(t => t.life > 0).slice(-60);
    for (const t of trails) t.life -= dt; trails = trails.filter(t => t.life > 0);
    if (state === 'ending') { endDelay -= dt; if (endDelay <= 0) showResults(); }
  }
  function formatTime(s) { return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`; }
  function updateHud() {
    setText('time', formatTime(clock));
    $('time').classList.toggle('boss-soon', !bossSpawned && clock >= 170);
    $('time').title = bossSpawned ? 'Boss fight' : 'Boss arrives at 03:00';
    setWidth('hp', player.hp / player.maxHp * 100); setWidth('hpLag', player.hp / player.maxHp * 100);
    setText('hpText', `${Math.ceil(player.hp)} / ${player.maxHp}`);
    setWidth('dash', (1 - player.dash / player.dashMax) * 100);
    setText('dashText', player.dash > 0 ? `${player.dash.toFixed(1)}s` : window.matchMedia?.('(pointer: coarse)').matches ? 'READY · TAP' : 'READY · SPACE');
    $('dashText').classList.toggle('ready', player.dash === 0);
    $('touchDash').classList.toggle('cooldown', player.dash > 0);
    setText('touchDash', player.dash > 0 ? `${player.dash.toFixed(1)}s` : 'DASH');
    setWidth('xp', xp / need * 100); setText('level', `LEVEL ${level}`);
    const boss = enemies.find(e => e.boss);
    if (boss) {
      setWidth('bossHp', boss.hp / boss.maxHp * 100);
      setText('bossPhase', boss.armor > 0 ? `ARMORED · ${boss.armor.toFixed(1)}s` : `CORE ${boss.phase + 1} / 3`);
      $('bossbar').classList.toggle('armored', boss.armor > 0);
    }
  }

  // Rendering: bright dangers, dim effects. Telegraphs are never disabled by the calm setting.
  function polygon(x, y, r, n, angle = 0) {
    ctx.beginPath();
    for (let i = 0; i < n; i++) { const a = angle + i * TAU / n; const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.closePath();
  }
  function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, TAU); }
  function ship(x, y, angle, alpha = 1) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.globalAlpha = alpha;
    ctx.beginPath(); ctx.moveTo(19, 0); ctx.lineTo(-12, -12); ctx.lineTo(-6, 0); ctx.lineTo(-12, 12); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  function drawGrid(cx, cy, t) {
    const left = cx - viewW / 2, top = cy - viewH / 2;
    ctx.lineWidth = 1 / zoom; ctx.strokeStyle = '#13202c'; ctx.beginPath();
    for (let x = Math.floor(left / 60) * 60; x < left + viewW + 60; x += 60) { ctx.moveTo(x, top); ctx.lineTo(x, top + viewH); }
    for (let y = Math.floor(top / 60) * 60; y < top + viewH + 60; y += 60) { ctx.moveTo(left, y); ctx.lineTo(left + viewW, y); } ctx.stroke();
    ctx.fillStyle = '#2a3b4a';
    for (let x = Math.floor(left / 180) * 180; x < left + viewW + 180; x += 180) {
      for (let y = Math.floor(top / 180) * 180; y < top + viewH + 180; y += 180) { ctx.fillRect(x - 3, y - .5, 6, 1); ctx.fillRect(x - .5, y - 3, 1, 6); }
    }
    // Faint sector numbers give movement a sense of place without adding obstacles.
    ctx.font = '9px monospace'; ctx.textAlign = 'left'; ctx.fillStyle = '#243241';
    for (let x = Math.floor(left / 540) * 540; x < left + viewW + 540; x += 540) {
      for (let y = Math.floor(top / 540) * 540; y < top + viewH + 540; y += 540) ctx.fillText(`SECTOR ${Math.abs(x / 540)} : ${Math.abs(y / 540)}`, x + 9, y + 16);
    }
    if (!player) for (let i = 0; i < 24; i++) {
      const x = Math.sin(i * 78.3) * viewW * .8 + cx, y = ((i * 193 + t * (10 + i)) % (viewH + 100)) - viewH / 2 + cy;
      ctx.strokeStyle = i % 2 ? '#ff508f40' : '#a5ff7340'; polygon(x, y, 12 + i % 4 * 5, i % 2 ? 3 : 4, t * .2); ctx.stroke();
    }
  }
  function drawTelegraph(e) {
    if (e.windup <= 0) return;
    const progress = 1 - e.windup / e.windupMax;
    ctx.save(); ctx.strokeStyle = e.boss ? '#ff739e' : COLORS.blue;
    ctx.globalAlpha = .22 + progress * .45; ctx.lineWidth = 1.5; ctx.setLineDash([7, 7]);
    const length = e.boss && e.pattern % 2 === 0 ? 220 + progress * 160 : 550;
    for (const a of attackAngles(e)) {
      ctx.beginPath(); ctx.moveTo(e.x + Math.cos(a) * (e.r + 7), e.y + Math.sin(a) * (e.r + 7));
      ctx.lineTo(e.x + Math.cos(a) * length, e.y + Math.sin(a) * length); ctx.stroke();
    }
    ctx.setLineDash([]); ctx.globalAlpha = .8; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 8, -Math.PI / 2, -Math.PI / 2 + progress * TAU); ctx.stroke();
    ctx.restore();
  }
  function drawEnemy(e, t) {
    if (e.dead || !onScreen(e.x, e.y, e.r + 40)) return;
    const a = Math.atan2(player.y - e.y, player.x - e.x);
    ctx.save();
    if (e.entry > 0) {
      ctx.globalAlpha = .55; ctx.strokeStyle = e.color; ctx.lineWidth = 2;
      circle(e.x, e.y, e.r + e.entry * 35); ctx.stroke();
    }
    ctx.fillStyle = e.flash > 0 && !calm ? '#f7fff4' : e.color + '22'; ctx.strokeStyle = e.flash > 0 && !calm ? '#fff' : e.color;
    ctx.lineWidth = e.boss ? 3 : 2; ctx.shadowColor = e.color; ctx.shadowBlur = calm ? 0 : e.boss ? 16 : 5;
    polygon(e.x, e.y, e.r, e.type === 'runner' ? 3 : e.type === 'tank' ? 6 : e.boss ? 8 : 4, e.boss ? t * .4 : a);
    ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0; ctx.fillStyle = e.color;
    if (e.boss) {
      if (e.armor > 0) { ctx.strokeStyle = COLORS.blue; ctx.lineWidth = 4; circle(e.x, e.y, e.r + 15); ctx.stroke(); ctx.strokeStyle = e.color; }
      polygon(e.x, e.y, e.r * .65, 4, -t); ctx.stroke();
      circle(e.x, e.y, 10 + (calm ? 0 : Math.sin(t * 5) * 3)); ctx.fill();
      if (e.enraged) { ctx.strokeStyle = COLORS.gold; polygon(e.x, e.y, e.r + 7, 8, -t * .3); ctx.stroke(); }
    } else if (e.type === 'shooter') {
      circle(e.x, e.y, 6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + Math.cos(e.windup ? e.aim : a) * 19, e.y + Math.sin(e.windup ? e.aim : a) * 19); ctx.stroke();
    } else { circle(e.x + Math.cos(a) * 4, e.y + Math.sin(a) * 4, 3); ctx.fill(); }
    if (e.elite) { ctx.strokeStyle = COLORS.gold; ctx.lineWidth = 1.5; polygon(e.x, e.y, e.r + 6, 6, -t * .4); ctx.stroke(); }
    if (e.hp < e.maxHp && !e.boss) {
      ctx.fillStyle = '#ffffff18'; ctx.fillRect(e.x - e.r, e.y - e.r - 8, e.r * 2, 2);
      ctx.fillStyle = e.color; ctx.fillRect(e.x - e.r, e.y - e.r - 8, e.r * 2 * Math.max(0, e.hp / e.maxHp), 2);
    }
    ctx.restore();
  }
  function drawPlayer(t) {
    if (!player || ((state === 'ending' || state === 'end') && !winRun)) return;
    if (player.orbit) {
      ctx.strokeStyle = '#a5ff731a'; ctx.lineWidth = 1; circle(player.x, player.y, 75); ctx.stroke();
      for (let i = 0; i < player.orbit; i++) {
        const a = clock * 3.5 + i * TAU / player.orbit;
        ctx.strokeStyle = '#a5ff7366'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(player.x, player.y, 75, a - .4, a); ctx.stroke();
        ctx.fillStyle = COLORS.mint; polygon(player.x + Math.cos(a) * 75, player.y + Math.sin(a) * 75, 13, 3, a + Math.PI / 2); ctx.fill();
      }
    }
    if (player.blast) {
      ctx.strokeStyle = '#54d9ff65'; ctx.lineWidth = 2; ctx.beginPath();
      ctx.arc(player.x, player.y, 30, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - clamp(player.blastTimer / 5, 0, 1))); ctx.stroke();
    }
    ctx.fillStyle = COLORS.mint;
    if (!calm) for (const trail of trails) ship(trail.x, trail.y, trail.angle, trail.life / .18 * .3);
    const angle = Math.atan2(player.dy, player.dx);
    if (player.moving > .1 && state === 'playing') {
      ctx.save(); ctx.translate(player.x, player.y); ctx.rotate(angle);
      ctx.fillStyle = '#a5ff7355'; ctx.beginPath(); ctx.moveTo(-8, -5); ctx.lineTo(-19 - (calm ? 3 : Math.sin(t * 50) * 5), 0); ctx.lineTo(-8, 5); ctx.fill(); ctx.restore();
    }
    // Solid ship silhouette + shield ring instead of flashing the player out of existence.
    if (player.inv > 0) { ctx.strokeStyle = player.dashing > 0 ? '#ffffffbb' : '#a5ff7388'; ctx.lineWidth = 1.5; circle(player.x, player.y, 22); ctx.stroke(); }
    ctx.shadowColor = COLORS.mint; ctx.shadowBlur = calm ? 0 : 18; ctx.fillStyle = player.dashing > 0 ? '#fff' : COLORS.mint;
    ship(player.x, player.y, angle); ctx.shadowBlur = 0;
    ctx.fillStyle = '#101e1c'; circle(player.x, player.y, 4); ctx.fill();
    // A local dash meter keeps the important cooldown in your peripheral vision.
    ctx.strokeStyle = player.dash > 0 ? '#7f9893' : COLORS.mint; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(player.x, player.y, 24, Math.PI * .25, Math.PI * .25 + Math.PI * .5 * (1 - player.dash / player.dashMax)); ctx.stroke();
    if (hurtFlash > 0) {
      ctx.strokeStyle = COLORS.pink; ctx.lineWidth = 4; ctx.beginPath();
      ctx.arc(player.x, player.y, 37, player.hurtAngle - .6, player.hurtAngle + .6); ctx.stroke();
    }
    const boss = enemies.find(e => e.boss && !e.dead);
    if (boss && !onScreen(boss.x, boss.y, -35)) {
      const a = Math.atan2(boss.y - cam.y, boss.x - cam.x);
      const r = Math.max(30, Math.min((viewW / 2 - 35) / Math.max(.001, Math.abs(Math.cos(a))), (viewH / 2 - 110) / Math.max(.001, Math.abs(Math.sin(a)))));
      ctx.fillStyle = COLORS.pink; polygon(cam.x + Math.cos(a) * r, cam.y + Math.sin(a) * r, 11, 3, a); ctx.fill();
    }
  }
  function draw(t) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = '#080c15'; ctx.fillRect(0, 0, W, H);
    const cx = player ? cam.x : calm ? 0 : Math.sin(t * .07) * 200, cy = player ? cam.y : calm ? 0 : t * 12;
    ctx.save(); ctx.translate(W / 2 + (calm ? 0 : rand(-shake, shake)), H / 2 + (calm ? 0 : rand(-shake, shake)));
    ctx.scale(zoom, zoom); ctx.translate(-cx, -cy);
    drawGrid(cx, cy, calm && !player ? 0 : t);
    for (const g of gems) {
      if (!onScreen(g.x, g.y, 20)) continue;
      ctx.fillStyle = g.heal ? COLORS.pink : COLORS.mint;
      if (g.heal) {
        ctx.strokeStyle = '#ff508f55'; ctx.lineWidth = 1; circle(g.x, g.y, 12); ctx.stroke();
        ctx.fillRect(g.x - 2, g.y - 6, 4, 12); ctx.fillRect(g.x - 6, g.y - 2, 12, 4);
      } else { polygon(g.x, g.y, g.r, 4); ctx.fill(); }
    }
    for (const r of rings) {
      ctx.globalAlpha = r.life / r.max * .65; ctx.strokeStyle = r.color; ctx.lineWidth = 2;
      circle(r.x, r.y, r.r * (1 - (r.life / r.max) ** 2)); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const e of enemies) if (!e.dead) drawTelegraph(e);
    for (const b of bullets) {
      if (b.life <= 0) continue;
      ctx.strokeStyle = '#d6ffb7'; ctx.lineWidth = 2.5; ctx.beginPath();
      ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * .018, b.y - b.vy * .018); ctx.stroke();
      ctx.fillStyle = '#f8fff0'; circle(b.x, b.y, 2); ctx.fill();
    }
    for (const e of enemies) drawEnemy(e, t);
    for (const p of particles) { ctx.globalAlpha = p.life / p.max * .8; ctx.fillStyle = p.color; ctx.fillRect(p.x - p.r / 2, p.y - p.r / 2, p.r, p.r); }
    ctx.globalAlpha = 1;
    // Enemy bullets render above effects and have white cores + dark outlines for readability.
    for (const b of enemyShots) {
      if (b.life <= 0 || !onScreen(b.x, b.y, 20)) continue;
      ctx.strokeStyle = '#080c15'; ctx.lineWidth = 3; ctx.fillStyle = b.boss ? '#ff638d' : '#ffb65c';
      circle(b.x, b.y, b.r + 1); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff0d9'; circle(b.x, b.y, 2); ctx.fill();
    }
    drawPlayer(t);
    ctx.textAlign = 'center';
    for (const text of texts) {
      ctx.globalAlpha = Math.min(1, text.life * 4); ctx.fillStyle = text.color; ctx.font = `bold ${text.size}px Inter, sans-serif`;
      ctx.strokeStyle = '#080c15'; ctx.lineWidth = 3; ctx.strokeText(text.text, text.x, text.y); ctx.fillText(text.text, text.x, text.y);
    }
    ctx.globalAlpha = 1; ctx.restore();
    const gradient = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .3, W / 2, H / 2, Math.max(W, H) * .72);
    gradient.addColorStop(0, '#080c1500'); gradient.addColorStop(1, '#03050c77'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, W, H);
    if (player && state === 'playing' && player.hp / player.maxHp < .3) {
      ctx.strokeStyle = `rgba(255,60,100,${calm ? .24 : .2 + Math.sin(t * 4) * .07})`; ctx.lineWidth = 7; ctx.strokeRect(0, 0, W, H);
    }
    if (hurtFlash > 0 && !calm) { ctx.fillStyle = `rgba(255,50,80,${hurtFlash * .24})`; ctx.fillRect(0, 0, W, H); }
  }
  function frame(ts) {
    const dt = last === null ? 0 : clamp((ts - last) / 1000, 0, .1); last = ts;
    if (state === 'playing') {
      accumulator += dt;
      while (accumulator >= STEP && state === 'playing') {
        accumulator -= STEP; update(STEP); effects(STEP);
      }
    } else {
      accumulator = 0;
      if (state !== 'paused' && state !== 'upgrade') effects(dt);
    }
    draw(fxClock); requestAnimationFrame(frame);
  }

  function updateSettings() {
    setText('mute', muted ? '♫ SOUND OFF' : '♫ SOUND ON'); $('mute').setAttribute('aria-pressed', String(muted));
    $('mute').setAttribute('aria-label', muted ? 'Enable sound' : 'Mute sound');
    setText('motion', calm ? '✦ FX CALM' : '✦ FX FULL'); $('motion').setAttribute('aria-pressed', String(calm));
    document.body.classList.toggle('calm', calm);
    if (master) master.gain.setTargetAtTime(muted ? 0 : .55, audio.currentTime, .02);
  }
  function mute() { muted = !muted; store.set('muted', muted); initAudio(); updateSettings(); }
  function toggleMotion() { calm = !calm; store.set('calm', calm); updateSettings(); }
  function fullscreen() {
    try {
      const result = document.fullscreenElement ? document.exitFullscreen?.() : document.documentElement.requestFullscreen?.();
      result?.catch(() => {});
    } catch {}
  }
  $('start').onclick = start; $('restart').onclick = start; $('pause').onclick = pause; $('resume').onclick = pause;
  $('workshop').onclick = openWorkshop; $('endWorkshop').onclick = openWorkshop;
  $('garageBack').onclick = openMenu; $('endMenu').onclick = openMenu;
  $('reroll').onclick = reroll; $('mute').onclick = mute; $('motion').onclick = toggleMotion; $('fullscreen').onclick = fullscreen;
  addEventListener('keydown', e => {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    const k = e.key.toLowerCase();
    if (state === 'playing' && [' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    if (state === 'playing') keys.add(k);
    if (e.repeat) {
      // A held dash key must not silently select the newly focused upgrade card.
      if (k === ' ' || k === 'enter') e.preventDefault();
      return;
    }
    if (k === 'm') mute(); if (k === 'f') fullscreen();
    if (k === 'escape' && (state === 'garage' || state === 'end')) openMenu();
    else if (k === 'p' || k === 'escape') pause();
    if (k === ' ' && state === 'playing') dash();
    if (state === 'upgrade') { if (['1', '2', '3'].includes(k)) choose(Number(k) - 1); if (k === 'r') reroll(); }
    // Settings live in Pause; keep keyboard focus within the visible panel.
    if (k === 'tab' && !$('overlay').hidden) {
      const buttons = [...$('overlay').querySelectorAll('section:not([hidden]) button:not(:disabled)')];
      const first = buttons[0], final = buttons[buttons.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); final.focus(); }
      else if (!e.shiftKey && document.activeElement === final) { e.preventDefault(); first.focus(); }
    }
  });
  addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
  addEventListener('blur', () => { clearInput(); if (state === 'playing') pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { clearInput(); if (state === 'playing') pause(); last = null; } });
  const stick = $('stick');
  function stickMove(e) {
    if (e.pointerId !== stickPointer) return;
    const rect = stick.getBoundingClientRect(), x = e.clientX - rect.left - rect.width / 2, y = e.clientY - rect.top - rect.height / 2;
    const distance = Math.hypot(x, y), magnitude = clamp((distance - 6) / 29, 0, 1), f = Math.min(distance, 35) / (distance || 1);
    joy = { x: x / (distance || 1) * magnitude, y: y / (distance || 1) * magnitude };
    stick.firstElementChild.style.transform = `translate(${x * f}px,${y * f}px)`;
  }
  function releaseStick(e) {
    if (e && e.pointerId !== stickPointer) return;
    stickPointer = null; joy = { x: 0, y: 0 }; stick.firstElementChild.style.transform = '';
  }
  stick.onpointerdown = e => { if (state !== 'playing' || stickPointer !== null) return; stickPointer = e.pointerId; stick.setPointerCapture(e.pointerId); stickMove(e); };
  stick.onpointermove = stickMove; stick.onpointerup = releaseStick; stick.onpointercancel = releaseStick; stick.onlostpointercapture = releaseStick;
  $('touchDash').onpointerdown = e => { e.preventDefault(); initAudio(); dash(); };
  setText('best', best ? `PERSONAL BEST · ${best} ELIMINATIONS` : 'THREE MINUTES. ONE ABSURD BUILD.');
  renderSetup(); saveProgress(); updateSettings(); requestAnimationFrame(frame);
})();
