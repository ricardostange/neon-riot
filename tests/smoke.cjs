// Run: node tests/smoke.cjs (no dependencies).
const assert = require('node:assert/strict');
const { create } = require('./harness.cjs');
let passed = 0;
function test(name, run) { run(); console.log(`  ✓ ${name}`); passed++; }
function fresh(seed) { const h = create(seed); h.g.start(); h.g.clean(); return h; }
function target(g, type, x, y, hp = 200) {
  const e = g.spawnEnemy(type); Object.assign(e, {x, y, hp, maxHp:hp, entry:0, speed:0}); return e;
}
function round(x, y, vx, left = 0) { return {x,y,vx,vy:0,r:3.5,life:2,left,hit:new Set()}; }
function shot(x, y, vx = 0, vy = 0) { return {x,y,vx,vy,r:5,life:5,boss:false}; }

test('start, pause, keyboard input cleanup, and restart', () => {
  const {g, listeners} = fresh(); assert.equal(g.state, 'playing');
  listeners.get('keydown')({key:'d',preventDefault(){}}); g.update(1/60); assert.ok(g.player.x > 0);
  g.pause(); const x = g.player.x; g.update(1); assert.equal(g.player.x, x); assert.equal(g.state, 'paused');
  g.pause(); g.update(1/60); assert.equal(g.player.x, x);
  g.start(); assert.equal(g.player.hp, 100); assert.equal(g.kills, 0); assert.equal(g.level, 1); assert.equal(g.clock, 0);
});
test('auto-fire chooses the closest enemy regardless of pointer position', () => {
  const {g,listeners}=fresh(); target(g,'chaser',200,0); target(g,'chaser',-50,0);
  listeners.get('pointermove')?.({pointerType:'mouse',clientX:1000,clientY:400});
  g.fire(); assert.ok(g.bullets[0].vx<0); assert.ok(Math.abs(g.bullets[0].vy)<1e-8);
  g.clean(); assert.equal(g.fire(),false); assert.equal(g.bullets.length,0);
});
test('auto-fire skips dead and protected enemies and leads moving targets', () => {
  const {g}=fresh(); target(g,'chaser',20,0).dead=true;
  target(g,'chaser',30,0).entry=1;
  const moving=target(g,'chaser',100,0);moving.vy=100;
  g.fire();assert.ok(g.bullets[0].vx>0);assert.ok(g.bullets[0].vy>0);
});
test('every display preserves a 720-unit short-axis view', () => {
  const {g,sandbox}=fresh();
  for(const [width,height] of [[393,851],[851,393],[1280,800],[1920,1080],[2560,1440]]){
    sandbox.innerWidth=width;sandbox.innerHeight=height;g.resize();
    assert.ok(Math.abs(Math.min(g.viewW,g.viewH)-720)<1e-9);
    assert.ok(Math.abs(g.viewW/g.viewH-width/height)<1e-9);
  }
});
test('analog dashes travel the same distance as keyboard dashes', () => {
  const {g} = fresh(); g.steer(.2, .1); g.dash();
  assert.ok(Math.abs(Math.hypot(g.player.dx, g.player.dy) - 1) < 1e-10);
  g.steer(0,0); for(let i=0;i<13;i++)g.update(1/60);
  assert.ok(Math.abs(Math.hypot(g.player.x,g.player.y)-210)<.01);
});
test('swept dash hits enemies crossed between ticks and refunds cooldown', () => {
  const {g} = fresh(); const e = target(g,'runner',35,0,60);
  g.dash(); g.update(.07); assert.equal(e.dead,true); assert.equal(g.stats.dashKills,1);
  assert.ok(g.player.dash < g.player.dashMax - .07);
});
test('dash immunity never shortens an existing shield', () => {
  const {g}=fresh(); g.player.inv=2; g.dash(); assert.equal(g.player.inv,2);
});
test('piercing rounds damage each enemy only once', () => {
  const {g}=fresh(); g.player.crit=0; const e=target(g,'tank',30,0,1000);
  g.bullets.push(round(0,0,100,4)); g.buildGrid();
  for(let i=0;i<20;i++)g.updateBullets(1/60);
  assert.equal(e.hp,1000-g.player.damage); assert.equal(g.bullets[0].hit.size,1);
});
test('non-piercing bullets hit the nearest target, not spawn order', () => {
  const {g}=fresh(); g.player.crit=0;
  const farther=target(g,'chaser',80,0), nearer=target(g,'chaser',30,0);
  g.bullets.push(round(0,0,1000)); g.buildGrid(); g.updateBullets(.1);
  assert.equal(farther.hp,200); assert.equal(nearer.hp,200-g.player.damage);
});
test('enemy bullets use relative swept collision; dash erases them', () => {
  const {g}=fresh(); g.player.inv=0; g.enemyShots.push(shot(-100,0,2000));
  g.updateEnemyShots(.1,0,0,false); assert.equal(g.player.hp,90);
  g.enemyShots.push(shot(60,0)); g.player.x=100; g.updateEnemyShots(.1,0,0,true);
  assert.equal(g.stats.dodged,1); assert.equal(g.player.hp,90);
});
test('shooters telegraph, lock aim, and cannot initiate attacks off screen', () => {
  const {g}=fresh(); const e=target(g,'shooter',250,0); e.attack=0;
  g.enemyAttack(e,1/60); assert.equal(g.enemyShots.length,0); assert.ok(e.windup>0);
  const aim=e.aim; g.player.y=200; g.enemyAttack(e,.3); assert.equal(e.aim,aim);
  g.enemyAttack(e,.5); assert.equal(g.enemyShots.length,1);
  e.x=10000;e.attack=0;e.windup=0;g.enemyAttack(e,1);assert.equal(e.windup,0);
});
test('shockwave deals area damage and clears only bullets in its radius', () => {
  const {g}=fresh(); g.grant('blast');g.player.blastTimer=0;
  const e=target(g,'tank',70,0);g.enemyShots.push(shot(30,0),shot(500,0));g.shockwave(1/60);
  assert.equal(e.hp,125);assert.equal(g.enemyShots[0].life,0);assert.equal(g.enemyShots[1].life,5);assert.equal(g.stats.dodged,1);
});
test('every draft offers offense, respects caps, and rerolls are limited', () => {
  const {g}=fresh();g.grant('multi',5);g.setXP(g.need);g.levelUp();
  for(let i=0;i<100;i++){g.draft();assert.equal(g.choices.length,3);assert.equal(new Set(g.choices.map(u=>u.id)).size,3);assert.ok(g.choices.some(u=>u.offense));assert.ok(!g.choices.some(u=>u.id==='multi'));}
  const old=g.choices.map(u=>u.id);g.reroll();assert.equal(g.rerolls,1);assert.ok(g.choices.every(u=>!old.includes(u.id)));
  g.reroll();assert.equal(g.rerolls,0);const final=g.choices;g.reroll();assert.equal(g.choices,final);
  g.choose(0);assert.equal(g.state,'playing');assert.ok(g.player.inv>=.8);
});
test('banked XP opens consecutive drafts without advancing combat', () => {
  const {g}=fresh();g.setXP(100);g.levelUp();let count=0;
  while(g.state==='upgrade'&&count<10){g.choose(0);count++;}
  assert.ok(count>1);assert.equal(g.clock,0);assert.equal(g.state,'playing');assert.ok(g.xp<g.need);
});
test('repairs are saved at full hull and show actual healing', () => {
  const {g}=fresh();g.gems.push({x:0,y:0,heal:18,value:0,r:7});g.collectGems(.1);assert.equal(g.gems.length,1);
  g.player.hp=94;g.collectGems(.1);assert.equal(g.player.hp,100);assert.equal(g.gems.length,0);
});
test('distant shard merging preserves total XP and nearby positions', () => {
  const {g}=fresh();for(let i=0;i<500;i++)g.gems.push({x:1000+i%50,y:1000,value:2,r:4});
  g.collectGems(1/60);assert.equal(g.gems.reduce((sum,v)=>sum+v.value,0),1000);assert.equal(g.gems.length,1);assert.ok(g.gems[0].x>=1000);
});
test('lethal hits stop the simulation immediately; no postmortem healing or kills', () => {
  const {g}=fresh();g.player.inv=0;target(g,'tank',0,0);g.player.hp=1;
  g.gems.push({x:0,y:0,heal:18,value:0,r:7});g.update(1/60);
  assert.equal(g.state,'ending');assert.equal(g.player.hp,0);const time=g.clock;g.update(1);assert.equal(g.clock,time);
  g.effects(1);assert.equal(g.state,'end');
});
test('boss arrives at 03:00 exactly, once; victory freezes combat', () => {
  const {g}=fresh();g.setClock(179.99);g.player.inv=10;g.update(1/60);
  let bosses=g.enemies.filter(e=>e.boss);assert.equal(bosses.length,1);g.update(1/60);assert.equal(g.enemies.filter(e=>e.boss).length,1);
  const boss=bosses[0];boss.entry=0;
  for(let phase=0;phase<3;phase++){boss.armor=0;g.damage(boss,1e9);}
  assert.equal(g.state,'ending');
  const kills=g.kills;g.damage(boss,1e9);assert.equal(g.kills,kills);g.effects(2);assert.equal(g.state,'end');
});
test('fixed-step clocks agree at 30, 60, and 144 FPS', () => {
  for(const fps of [30,60,144]){
    const {g}=fresh();g.player.inv=100;g.frame(0);
    for(let i=1;i<=fps*5;i++)g.frame(i*1000/fps);
    assert.ok(Math.abs(g.clock-5)<1/59,`${fps}fps: ${g.clock}`);
  }
});
test('desktop, portrait, and landscape rendering and resize stay finite', () => {
  for(const [w,h] of [[1440,900],[390,844],[844,390],[320,568]]){
    const {g,sandbox}=create(5,w,h);g.draw(0);g.scene();g.update(1/60);g.draw(1);
    assert.ok(Number.isFinite(g.zoom));assert.ok(Number.isFinite(g.player.x));sandbox.innerWidth=h;sandbox.innerHeight=w;g.resize();g.draw(2);
  }
});
test('settings persist and reduced-effects mode is independent of sound', () => {
  const {g,elements,saved}=fresh();elements.get('mute').onclick();assert.equal(g.muted,true);
  elements.get('motion').onclick();assert.equal(g.calm,true);assert.equal(g.muted,true);
  assert.equal(saved.get('neon-riot-calm'),'true');assert.equal(saved.get('neon-riot-muted'),'true');
});
console.log(`PASS: ${passed} regression checks.`);
