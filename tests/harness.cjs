// Test-only instrumentation. Nothing is exposed by the shipped game.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../game.js'), 'utf8');
const hooks = `
  globalThis.__riot = {
    start, update, effects, draw, frame, choose, pause, dash, hurt, damage, spawnEnemy,
    buildGrid, updateBullets, updateEnemyShots, enemyAttack, collectGems, shockwave,
    levelUp, reroll, draft, resize, fire, clearInput, updateHud, segmentHit, showResults,
    finish, openWorkshop, openMenu, director, threatBudget, threatCost, attackAngles, bossSideOpen, updateBossSide, weaponWeight,
    get profile() { return profile; }, get difficulty() { return difficulty; },
    get earnings() { return earnings; },
    get state() { return state; }, get player() { return player; }, get enemies() { return enemies; },
    get bullets() { return bullets; }, get enemyShots() { return enemyShots; }, get gems() { return gems; },
    get clock() { return clock; }, get kills() { return kills; }, get level() { return level; },
    get choices() { return choices; }, get build() { return build; }, get stats() { return stats; },
    get rerolls() { return rerolls; }, get xp() { return xp; }, get need() { return need; },
    get upgrades() { return upgrades; }, get cam() { return cam; }, get joy() { return joy; },
    get zoom() { return zoom; }, get viewW() { return viewW; }, get viewH() { return viewH; },
    get texts() { return texts; }, get particles() { return particles; }, get muted() { return muted; }, get calm() { return calm; },
    setClock(v) { clock = v; }, setXP(v) { xp = v; }, steer(x, y) { joy = {x, y}; },
    clean() { enemies = []; bullets = []; enemyShots = []; gems = []; grid.clear(); spawn = 10000; },
    grant(id, n = 1) { const u = upgrades.find(u => u.id === id); for(let i=0;i<n;i++){u.apply();build[id]=(build[id]||0)+1;} },
    scene() {
      start(); cleanScene();
      function cleanScene() { enemies = []; bullets = []; enemyShots = []; gems = []; clock = 125; spawn = .5; }
      this.grant('multi', 2); this.grant('pierce'); this.grant('orbit', 2); this.grant('blast'); this.grant('damage', 2);
      level = 11; kills = 236; xp = 60; need = 120; player.hp = 72;
      for(let i=0;i<46;i++){
        const e = spawnEnemy(['chaser','runner','tank','shooter'][i%4]);
        const a=i*2.399, r=110+(i%9)*38;
        e.x=Math.cos(a)*r; e.y=Math.sin(a)*r; e.entry=0;
        if(e.type==='shooter'){e.windup=.5;e.windupMax=.7;e.aim=Math.atan2(-e.y,-e.x);}
      }
      for(let i=0;i<40;i++)gems.push({x:Math.cos(i*2.399)*(90+i*6),y:Math.sin(i*2.399)*(90+i*6),r:4,value:1});
      updateHud();
    }
  };
`;
function instrument() { return source.replace(/\}\)\(\);\s*$/, `${hooks}\n})();`); }
function create(seed = 42, width = 1280, height = 800, initialStorage = []) {
  const elements = new Map(), listeners = new Map(), saved = new Map(initialStorage);
  let document;
  function element(tag = 'div') {
    const classes = new Set();
    return {
      tagName: tag.toUpperCase(), style: {}, hidden: false, disabled: false, textContent: '', innerHTML: '',
      firstElementChild: { style: {} }, children: [], attributes: {},
      classList: { add(s) { classes.add(s); }, remove(s) { classes.delete(s); }, toggle(s, force) { if(force)classes.add(s);else classes.delete(s); }, contains(s) { return classes.has(s); } },
      replaceChildren(...children) { this.children = children; }, append(...children) { this.children.push(...children); },
      setAttribute(k, v) { this.attributes[k] = v; },
      querySelector() { return this.children.find(c => c.tagName === 'BUTTON') || null; },
      querySelectorAll() { return this.children.filter(c => c.tagName === 'BUTTON'); },
      focus() { document.activeElement = this; }, blur() { document.activeElement = null; },
      getBoundingClientRect() { return { left: 0, top: 0, width: 106, height: 106 }; }
    };
  }
  const context = new Proxy({}, { get: (_, key) => key === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {}, set: () => true });
  document = {
    getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); },
    createElement: element, createTextNode: text => ({textContent: text}), body: element('body'),
    addEventListener(k, f) { listeners.set(k, f); }, querySelectorAll() { return []; }, activeElement: null
  };
  document.getElementById('game').getContext = () => context;
  const math = Object.create(Math);
  math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const sandbox = {
    document, innerWidth: width, innerHeight: height, devicePixelRatio: 1,
    addEventListener(k, f) { listeners.set(k, f); }, requestAnimationFrame() {},
    localStorage: { getItem(k) { return saved.get(k) ?? null; }, setItem(k,v) { saved.set(k, v); } },
    matchMedia() { return { matches: false }; }, Math: math, console
  };
  sandbox.window = sandbox;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../progression.js'), 'utf8'), sandbox);
  vm.runInNewContext(instrument(), sandbox);
  return { g: sandbox.__riot, elements, listeners, saved, sandbox };
}
module.exports = { create, instrument };
