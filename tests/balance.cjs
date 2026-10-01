const assert = require('node:assert/strict');
const {create} = require('./harness.cjs');
const P = require('../progression.js');
let count = 0;
function test(name, run) { run(); console.log(`  ✓ ${name}`); count++; }
function fresh(){const h=create();h.g.start();h.g.clean();return h;}

test('every XP threshold is the original curve times 1.5, with carryover',()=>{
  const {g}=fresh();let base=8;
  for(let i=0;i<20;i++){
    assert.equal(g.need,Math.ceil(base*1.5));
    g.setXP(g.need+3);g.levelUp();assert.equal(g.xp,3);g.choose(0);
    base=Math.floor(base*1.17+4);
  }
  g.start();assert.equal(g.need,12);assert.equal(g.clock,0);
});
test('in-run upgrade percentages and discrete effects remain unchanged',()=>{
  const {g}=fresh();g.grant('damage');assert.equal(g.player.damage,19*1.3);
  g.grant('rate');assert.equal(g.player.fireRate,.38/1.22);
  g.grant('speed');assert.equal(g.player.speed,235*1.15);assert.equal(g.player.dashMax,2.4*.85);
  g.grant('health');assert.equal(g.player.maxHp,130);
  g.grant('magnet');assert.equal(g.player.magnet,120*1.65);
  g.grant('regen');assert.equal(g.player.regen,1.5);
  g.grant('multi');g.grant('pierce');g.grant('orbit');assert.equal(g.player.projectiles,2);assert.equal(g.player.pierce,1);assert.equal(g.player.orbit,1);
});
test('boss blocks closed sides across sources and respects angle wraparound',()=>{
  const {g}=fresh(),b=g.spawnEnemy('boss');Object.assign(b,{entry:0,x:0,y:0,weakAngle:0});
  const hp=b.hp;
  for(const source of ['Rounds','Blades','Dash','Shockwave']){
    g.damage(b,10,source,false,-100,0);assert.equal(b.hp,hp);
  }
  g.damage(b,10,'Rounds',false,100,0);assert.equal(b.hp,hp-10);
  b.weakAngle=Math.PI*2-.1;assert.equal(g.bossSideOpen(b,100,0),true);
  assert.equal(g.bossSideOpen(b,0,100),false);
});
test('side stays fixed through its warning, then rotates, and pauses with combat',()=>{
  const {g}=fresh(),b=g.spawnEnemy('boss');b.entry=0;b.weakAngle=0;
  g.updateBossSide(b,5.6);assert.equal(b.weakAngle,0);assert.ok(b.weakTimer<1.5);
  g.updateBossSide(b,1.5);assert.equal(b.weakAngle,Math.PI/2);
  const timer=b.weakTimer;b.armor=1;g.updateBossSide(b,1);assert.equal(b.weakTimer,timer);
  b.armor=0;g.pause();g.update(1);assert.equal(b.weakTimer,timer);
});
test('bullet approach determines damage independently of player location',()=>{
  const {g}=fresh(),b=g.spawnEnemy('boss');Object.assign(b,{entry:0,x:0,y:0,weakAngle:0});g.player.x=-200;g.player.crit=0;g.buildGrid();
  function round(x,vx){return {x,y:0,vx,vy:0,r:3.5,life:2,left:0,hit:new Set()};}
  const hp=b.hp;g.bullets.push(round(100,-2000));g.updateBullets(.05);assert.equal(b.hp,hp-g.player.damage);
  g.player.x=200;g.bullets.push(round(-100,2000));g.updateBullets(.05);assert.equal(b.hp,hp-g.player.damage);
});
test('final-minute packs add weak targets and an elite within the population cap',()=>{
  const {g}=fresh();g.setClock(119);g.director(.01);assert.equal(g.enemies.length,0);
  g.setClock(120);g.director(.01);assert.equal(g.enemies.filter(e=>e.fodder).length,8);assert.equal(g.enemies.filter(e=>e.elite).length,1);
  assert.ok(g.enemies.filter(e=>e.fodder).every(e=>e.hp===22&&!e.elite));
  g.director(.01);assert.equal(g.enemies.length,9);
  while(g.enemies.length<209)g.spawnEnemy('chaser');g.setClock(132);g.director(.01);assert.equal(g.enemies.length,210);
  g.setClock(180);g.director(.01);assert.equal(g.enemies.length,211);assert.equal(g.enemies.filter(e=>e.boss).length,1);
});
test('all Workshop tracks support ten ranks and older saves retain their progress',()=>{
  const old={version:1,scrap:123,unlocked:2,selected:1,ranks:{hull:5,rounds:5,attackSpeed:5,magnet:5,dash:5,rerolls:3}};
  const p=P.normalize(old);assert.equal(p.scrap,123);assert.equal(p.selected,1);assert.deepEqual(p.ranks,old.ranks);
  p.scrap=100000;
  for(const u of P.upgrades){assert.equal(u.costs.length,10);while(p.ranks[u.id]<10)assert.equal(P.buy(p,u.id),true);assert.equal(P.buy(p,u.id),false);}
  const {g}=create(42,1280,800,[['neon-riot-progression',JSON.stringify(p)]]);g.start();
  assert.equal(g.player.maxHp,200);assert.ok(Math.abs(g.player.fireRate-.38/1.8)<1e-10);assert.ok(Math.abs(g.player.damage-30.4)<1e-10);
  assert.equal(g.player.magnet,240);assert.equal(g.rerolls,12);assert.ok(g.player.dashMax>0);
});
test('visual power saturates and does not change projectile hitboxes or damage',()=>{
  const {g}=fresh();assert.equal(g.weaponWeight(),0);g.grant('damage',6);assert.ok(g.weaponWeight()>2);
  const e=g.spawnEnemy('tank');Object.assign(e,{x:150,y:0,entry:0});g.fire();assert.equal(g.bullets[0].r,3.5);
  g.player.damage=1e9;assert.equal(g.weaponWeight(),3);
});
console.log(`PASS: ${count} balance checks.`);
