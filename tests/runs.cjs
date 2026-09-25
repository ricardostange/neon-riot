// Deterministic full-run simulations, including a simple (not human-equivalent) pilot.
// node tests/runs.cjs [number-of-seeds]
const assert = require('node:assert/strict');
const { create } = require('./harness.cjs');
function pick(g) {
  const priorities = {multi:10,pierce:g.build.pierce?4:9,damage:8,rate:8,blast:g.build.blast?5:10,orbit:7,regen:g.player.hp<65?11:6,health:g.player.hp<45?14:2,crit:5,magnet:g.build.magnet?2:7,speed:g.build.speed?3:6,overdrive:6};
  const scored=g.choices.map((u,i)=>({i,score:priorities[u.id]})).sort((a,b)=>b.score-a.score);
  g.choose(scored[0].i);
}
function pilot(g) {
  const p=g.player,boss=g.enemies.find(e=>e.boss&&!e.dead);
  let tx=p.x+Math.cos(g.clock*.2)*200,ty=p.y+Math.sin(g.clock*.2)*200,best=Infinity;
  for(const gem of g.gems){
    if(gem.heal&&p.hp>=p.maxHp)continue;
    const score=Math.hypot(gem.x-p.x,gem.y-p.y)/(gem.heal&&p.hp<p.maxHp*.6?3:1);
    if(score<best){best=score;tx=gem.x;ty=gem.y;}
  }
  if(boss){const a=Math.atan2(p.y-boss.y,p.x-boss.x)+.55;tx=boss.x+Math.cos(a)*210;ty=boss.y+Math.sin(a)*210;}
  let choice,score=-Infinity,danger=Infinity;
  const near=g.enemies.filter(e=>!e.dead&&Math.hypot(e.x-p.x,e.y-p.y)<300);
  const shots=g.enemyShots.filter(b=>Math.hypot(b.x-p.x,b.y-p.y)<250);
  for(const e of near)danger=Math.min(danger,Math.hypot(e.x-p.x,e.y-p.y)-e.r);
  for(let i=0;i<24;i++){
    const a=i*Math.PI*2/24,x=Math.cos(a),y=Math.sin(a),nx=p.x+x*p.speed*.35,ny=p.y+y*p.speed*.35;
    let s=-Math.hypot(tx-nx,ty-ny)*.3;
    for(const e of near){const d=Math.hypot(e.x+e.vx*.2-nx,e.y+e.vy*.2-ny)-e.r;if(d<100)s-=(100-d)*3;}
    for(const b of shots){const d=Math.hypot(b.x+b.vx*.25-nx,b.y+b.vy*.25-ny);if(d<65)s-=(65-d)*2;}
    if(s>score){score=s;choice={x,y};}
  }
  g.steer(choice.x,choice.y);
  if(danger<65&&p.dash===0)g.dash();
}
function run(seed, invulnerable=false, width=1280, height=800) {
  const {g}=create(seed,width,height);g.start();
  let frames=0,maxEnemies=0,maxBullets=0;
  const start=performance.now();
  while(g.clock<240&&(g.state==='playing'||g.state==='upgrade')){
    if(g.state==='upgrade'){pick(g);continue;}
    if(invulnerable)g.player.inv=10;
    if(frames%6===0)pilot(g);
    g.update(1/60);g.effects(1/60);frames++;
    if(frames%180===0)g.draw(g.clock);
    maxEnemies=Math.max(maxEnemies,g.enemies.length);maxBullets=Math.max(maxBullets,g.bullets.length);
    assert.ok(Number.isFinite(g.player.x)&&Number.isFinite(g.player.hp));
    assert.ok(g.enemies.length<=211);
  }
  const result={seed,seconds:Math.round(g.clock),kills:g.kills,level:g.level,hull:Math.ceil(g.player.hp),result:g.state==='ending'&&g.player.hp>0?'WIN':g.player.hp===0?'DEAD':'TIMEOUT',peakEnemies:maxEnemies,peakRounds:maxBullets,cpuSeconds:((performance.now()-start)/1000).toFixed(1)};
  if(invulnerable){assert.ok(g.clock>=180);assert.ok(g.kills>100);assert.ok(g.level>5);assert.ok(g.particles.length<=700);}
  return result;
}
if(require.main===module){
  console.table([run(19,true),...Array.from({length:Number(process.argv[2])||3},(_,i)=>run(i+1))]);
}
module.exports={run,pick,pilot};
