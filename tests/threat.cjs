const assert = require('node:assert/strict');
const {create}=require('./harness.cjs');
let count=0;
function test(name,fn){fn();count++;console.log(`  ✓ ${name}`);}
const used=g=>g.enemies.filter(e=>!e.dead).reduce((sum,e)=>sum+g.threatCost(e),0);
const sizes=[[393,851],[851,393],[1280,720],[1920,1080],[2560,1440]];
test('budget grows by time and difficulty, never by player strength',()=>{
 for(let d=0;d<4;d++){
  const {g}=create(7,1280,720,[['neon-riot-progression',JSON.stringify({version:1,unlocked:3,selected:d})]]);g.start();
  let last=0;for(let t=0;t<180;t++){g.setClock(t);const n=g.threatBudget();assert.ok(n>=last);last=n;g.player.damage*=1.1;assert.equal(g.threatBudget(),n);}
  g.setClock(0);assert.equal(g.threatBudget(),Math.floor(8*g.difficulty.density));
 }
});
test('cost accounting and composition limits survive repeated selective kills',()=>{
 for(let d=0;d<4;d++){
  const {g}=create(9,1280,720,[['neon-riot-progression',JSON.stringify({version:1,unlocked:3,selected:d})]]);g.start();
  for(let t=0;t<180;t++){
   g.setClock(t);g.director(1);const budget=g.threatBudget();assert.equal(used(g),budget);
   const live=g.enemies.filter(e=>!e.dead);
   assert.ok(live.length<=210);
   assert.ok(live.filter(e=>e.type==='tank').reduce((n,e)=>n+g.threatCost(e),0)<=budget*.35);
   assert.ok(live.filter(e=>e.type==='shooter').reduce((n,e)=>n+g.threatCost(e),0)<=budget*.25);
   assert.ok(live.filter(e=>e.type!=='chaser'||e.elite).reduce((n,e)=>n+g.threatCost(e),0)<=budget*.6);
   // Simulate a build mowing down basics while the durable enemies survive.
   for(const e of live)if(e.type==='chaser')e.dead=true;
   for(let i=g.enemies.length-1;i>=0;i--)if(g.enemies[i].dead)g.enemies.splice(i,1);
  }
 }
});
test('kills release weighted budget, refills wait, paused play does not refill',()=>{
 const {g}=create();g.start();g.director(1);const n=g.enemies.length;
 g.enemies[0].dead=true;g.director(.1);assert.equal(g.enemies.length,n);
 g.director(.65);assert.equal(used(g),g.threatBudget());assert.equal(g.enemies.length,n+1);
 g.enemies[1].dead=true;g.pause();const before=g.enemies.length;g.update(1);assert.equal(g.enemies.length,before);
});
test('spawn, boss position, aim and attack eligibility ignore viewport',()=>{
 let expected;
 for(const [w,h] of sizes){const {g}=create(12,w,h);g.start();
  const snapshot=JSON.parse(JSON.stringify(g.enemies.map(e=>[e.x,e.y,e.hp,e.speed])));if(expected)assert.deepEqual(snapshot,expected);else expected=snapshot;
  for(const e of g.enemies){assert.ok(Math.abs(Math.hypot(e.x,e.y)-560)<1e-8);assert.equal(e.entry,.85);}
  g.clean();const e=g.spawnEnemy('shooter');Object.assign(e,{x:400,y:0,entry:0,attack:0});assert.equal(g.fire(),true);
  g.enemyAttack(e,.01);assert.equal(e.windup,0);e.x=300;g.enemyAttack(e,.01);assert.ok(e.windup>0);
  e.x=470;assert.equal(g.fire(),false);
  const b=g.spawnEnemy('boss');assert.equal(b.x,180);assert.equal(b.y,-210);
 }
});
test('same pilot produces identical XP and kills across sizes, orientations and resize',()=>{
 function run(w,h,resize=false){const {g,sandbox}=create(42,w,h);g.start();
  for(let i=0;i<3600;i++){
   if(resize&&i===1800){sandbox.innerWidth=851;sandbox.innerHeight=393;g.resize();}
   while(g.state==='upgrade')g.choose(0);
   g.player.inv=10;g.steer(Math.cos(i/60*.7),Math.sin(i/60*.7));g.update(1/60);g.effects(1/60);
  }
  return {kills:g.kills,level:g.level,xp:g.xp,need:g.need,x:g.player.x,y:g.player.y,ground:g.gems.reduce((n,e)=>n+e.value,0)};
 }
 const expected=run(...sizes[0]);for(const size of sizes.slice(1))assert.deepEqual(run(...size),expected);
 assert.deepEqual(run(...sizes[0],true),expected);
});
test('boss reduces budget once and cancels pack pressure without deleting survivors',()=>{
 const {g}=create();g.start();g.setClock(179);g.director(1);const before=g.enemies.length;
 g.setClock(180);g.director(1);assert.equal(g.enemies.length,before+1);assert.equal(g.threatBudget(),43);
 g.director(1);assert.equal(g.enemies.length,before+1);
 for(let i=g.enemies.length-1;i>=0;i--)if(!g.enemies[i].boss)g.enemies.splice(i,1);
 g.director(1);assert.equal(used(g),43);assert.equal(g.enemies.filter(e=>e.boss).length,1);assert.ok(!g.enemies.some(e=>e.fodder));
});
console.log(`PASS: ${count} threat/scaling checks.`);
