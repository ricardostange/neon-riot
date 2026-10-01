const assert = require('node:assert/strict');
const {create} = require('./harness.cjs');
function fresh(rank=1) {const {g}=create();g.start();g.clean();g.grant('orbit',rank);g.player.inv=0;return g;}
function shot(x,y,vx,vy,boss=false) {return {x,y,vx,vy,r:5,life:5,boss};}

for (const boss of [false,true]) {
  const g=fresh(), b=shot(150,0,-18000,0,boss);g.enemyShots.push(b);
  g.updateEnemyShots(1/60,0,0,false);
  assert.equal(g.player.hp,100);assert.equal(b.life,0);assert.equal(g.stats.dodged,1);
}
console.log('PASS: blades intercept fast ordinary and boss shots before hull contact.');

{
  const g=fresh();g.enemyShots.push(shot(0,150,0,-18000));g.updateEnemyShots(1/60,0,0,false);
  assert.equal(g.player.hp,90);assert.equal(g.stats.dodged,0);
  const h=fresh();h.enemyShots.push(shot(0,0,18000,0));h.updateEnemyShots(1/60,0,0,false);
  assert.equal(h.player.hp,90);assert.equal(h.stats.dodged,0);
}
console.log('PASS: gaps remain vulnerable; blades cannot undo an earlier hull hit.');

{
  const g=fresh();g.player.x=100;const b=shot(150,0,0,0);g.enemyShots.push(b);
  g.updateEnemyShots(1/60,0,0,false);assert.equal(b.life,0);assert.equal(g.player.hp,100);
  const h=fresh(0);h.enemyShots.push(shot(150,0,-18000,0));h.updateEnemyShots(1/60,0,0,false);assert.equal(h.player.hp,90);
}
console.log('PASS: interception follows player movement and requires the upgrade.');

{
  const g=fresh(5);g.player.inv=100;g.player.fire=100;
  const e=g.spawnEnemy('tank');Object.assign(e,{x:0,y:0,r:200,hp:10000,maxHp:10000,speed:0,entry:0});
  g.update(.01);const damage=g.stats.damage.Blades;assert.ok(damage>330);assert.equal(e.bladeHits.filter(t=>t>0).length,5);
  g.update(.01);assert.equal(g.stats.damage.Blades,damage);
  e.bladeHits[0]=0;g.update(.01);assert.ok(g.stats.damage.Blades>damage);assert.ok(g.stats.damage.Blades<damage+70);
}
console.log('PASS: each blade contributes damage with its own repeat-hit cooldown.');
