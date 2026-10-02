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
