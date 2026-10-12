const assert=require('node:assert/strict');
const {create}=require('./harness.cjs');
function fresh(){const {g}=create();g.start();g.clean();return g;}
{
 const g=fresh(),b=g.spawnEnemy('boss');Object.assign(b,{entry:0,x:0,y:0,weakAngle:0});
 const hp=b.hp;
 for(let i=0;i<20;i++)g.damage(b,10,'Rounds',false,-100,0);
 assert.equal(b.hp,hp);assert.equal(g.texts.filter(t=>t.text==='BLOCK').length,1);
 for(let i=0;i<20;i++)g.damage(b,10,'Rounds',false,100,0);
 assert.equal(b.hp,hp-200);assert.equal(g.texts.filter(t=>t.text==='200').length,1);
 g.setClock(.21);g.damage(b,13,'Blades',false,100,0);assert.equal(g.texts.filter(t=>t.text==='13').length,1);
 g.setClock(1);b.armor=1;g.damage(b,1e6,'Rounds',false,100,0);assert.equal(b.hp,hp-213);
 assert.equal(g.texts.filter(t=>t.text==='BLOCK').length,2);
 b.armor=0;g.setClock(2);b.hp=b.maxHp*2/3+5;g.damage(b,1e6,'Rounds',false,100,0);
 assert.equal(b.hitNumber.text,'5');assert.equal(b.phase,1);
 console.log('PASS: boss numbers reflect actual damage, aggregate bursts, and never count blocked damage.');
}
{
 const g=fresh();g.dash();g.player.dashing=0;g.player.dash=.01;g.update(1/60);
 assert.equal(g.texts.filter(t=>t.text==='DASH READY').length,1);
 for(let i=0;i<60;i++)g.update(1/60);
 assert.equal(g.texts.filter(t=>t.text==='DASH READY').length,1);
 g.dash();g.player.dashing=0;g.player.dash=.01;g.pause();g.update(1);assert.equal(g.player.dash,.01);
 g.pause();g.update(1/60);assert.equal(g.texts.filter(t=>t.text==='DASH READY').length,2);
 console.log('PASS: dash ready cue fires once per refresh and waits through pause.');
}
{
 const g=fresh(), b=g.spawnEnemy('boss');Object.assign(b,{entry:0,x:100,y:0,weakAngle:Math.PI,blockFlash:.14});
 function shoot(){g.bullets.push({x:0,y:0,vx:1000,vy:0,r:3,life:1,left:0,hit:new Set()});g.buildGrid();g.updateBullets(.1);}
 const hp=b.hp,initial=g.particles.length;shoot();assert.ok(b.hp<hp);
 assert.ok(g.particles.length>=4);assert.ok(g.particles.slice(initial).every(p=>Math.abs(p.x-45)<.001&&p.y===0));
 const count=g.particles.length;shoot();assert.ok(g.particles.length>count);
 b.weakAngle=0;const before=g.particles.length,hpBlocked=b.hp;shoot();
 assert.equal(b.hp,hpBlocked);assert.equal(g.particles.length,before);
 b.weakAngle=Math.PI;b.armor=1;shoot();assert.equal(g.particles.length,before);
 console.log('PASS: each damaging boss bullet sparks at contact, even after a recent block; blocked hits do not.');
}
{
 for(const endless of [false,true]){
  const h=create(),g=h.g;g.profile.wins[3]=1;g.profile.endless=endless;g.start();g.clean();
  const original=h.sandbox.Math.random;h.sandbox.Math.random=()=>0;
  function kill(){const e=g.spawnEnemy('chaser');Object.assign(e,{entry:0,x:500,y:0});g.damage(e,1e9);}
  for(let i=0;i<10;i++)kill();assert.equal(g.gems.filter(e=>e.heal).length,5);
  assert.equal(g.gems.filter(e=>!e.heal).length,10);
  g.player.hp=1;const heal=g.gems.find(e=>e.heal);heal.x=0;heal.y=0;g.collectGems(0);
  assert.equal(g.gems.filter(e=>e.heal).length,4);kill();assert.equal(g.gems.filter(e=>e.heal).length,5);
  h.sandbox.Math.random=()=>.99;for(let i=11;i<140;i++)kill();
  assert.equal(g.gems.filter(e=>e.heal).length,5);h.sandbox.Math.random=original;
 }
 console.log('PASS: five-health cap covers normal and Endless random/fallback drops; collection frees a slot; XP unaffected.');
}
