const assert=require('node:assert/strict');
const {create}=require('./harness.cjs');
function game(endless=true){const h=create(42,1280,800,[['neon-riot-progression',JSON.stringify({version:1,unlocked:3,selected:3,wins:[0,0,0,1],endless})]]);h.g.start();h.g.clean();return h.g;}
let g=game();
for(const [vx,vy] of [[-260,0],[0,100],[0,0],[-175,0]]){
 const t=g.interceptTime(100,0,vx,vy,175);assert.ok(t>0);assert.ok(Math.abs(Math.hypot(100+vx*t,vy*t)-175*t)<1e-7);
}
assert.equal(g.interceptTime(100,0,260,0,175),0);
assert.equal(g.interceptTime(100,0,0,260,175),0);
const runner=g.spawnEnemy('runner');Object.assign(runner,{entry:0,x:100,y:0,vx:-260,vy:0});g.fire();assert.ok(g.bullets[0].vx>0,'approaching runner must not cause a backwards shot');
for(const endless of [true,false]){
 g=game(endless);g.setClock(240);const e=g.spawnEnemy('boss');Object.assign(e,{entry:0,x:250,y:0,windup:0,attack:10000});
 const hp=e.hp,speed=e.speed,baseDamage=e.damage;
 for(const age of [0,60,180,600]){
  g.setClock(240+age);const damage=endless?1.2**(age/60):1,pace=endless?Math.min(2,1.1**(age/60)):1;
  assert.ok(Math.abs(g.bossAgeMultiplier(e,1.2)-damage)<1e-8);
  g.updateEnemies(0,0,0,false);assert.ok(Math.abs(Math.hypot(e.vx,e.vy)-speed*pace)<1e-8);
  assert.equal(e.hp,hp);assert.equal(e.damage,baseDamage);
  e.windup=.01;e.windupMax=.85;e.pattern=0;g.enemyAttack(e,.02);
  assert.ok(Math.abs((e.attack+.85)*pace-(1.35/1.25+.85))<1e-8);
  assert.equal(e.windupMax,.85);
  const shot=g.enemyShots.at(-1);assert.ok(Math.abs(shot.damage-12*e.damageMultiplier*damage)<1e-8);
  const shotDamage=shot.damage;g.setClock(240+age+60);assert.equal(shot.damage,shotDamage);
 }
 const ageBefore=g.bossAgeMultiplier(e,1.2);g.pause();g.update(60);assert.equal(g.bossAgeMultiplier(e,1.2),ageBefore);
}
for(const [selected,hp] of [[0,72000],[1,90000],[2,115200],[3,144000]]){
 const h=create(42,1280,800,[['neon-riot-progression',JSON.stringify({version:1,unlocked:3,selected})]]);h.g.start();assert.equal(h.g.spawnEnemy('boss').maxHp,hp);
}
console.log('PASS: interception and fallback, all boss HP tiers, aging speed/damage/cadence caps, warnings, pause and immutable in-flight shots.');
