const assert=require('node:assert/strict');
const {create}=require('./harness.cjs');const P=require('../progression.js');
function profile(wins=1){return {version:1,unlocked:3,selected:3,endless:true,wins:[0,0,0,wins]};}
function setup(p=profile()){return create(42,1280,800,[['neon-riot-progression',JSON.stringify(p)]]);}
let n=0;function test(name,f){f();console.log('  ✓ '+name);n++;}
test('locked saves cannot start Endless; existing Cataclysm wins unlock it',()=>{
 const h=setup(profile(0));h.g.start();assert.equal(h.g.endless,false);assert.equal(h.elements.get('difficulties').children[4].disabled,true);
 const old=profile();delete old.endless;const h2=setup(old);assert.equal(h2.elements.get('difficulties').children[4].disabled,false);
 h2.elements.get('difficulties').children[4].onclick();h2.g.start();assert.equal(h2.g.endless,true);assert.equal(h2.g.difficulty.name,'Cataclysm');
 h2.g.openMenu();h2.elements.get('difficulties').children[0].onclick();h2.g.start();assert.equal(h2.g.endless,false);
});
test('Cataclysm victory exposes Endless immediately',()=>{
 const h=setup(profile(0));h.g.start();h.g.finish(true);h.g.showResults();assert.match(h.elements.get('unlockNotice').textContent,/ENDLESS UNLOCKED/);
 h.g.openMenu();assert.equal(h.elements.get('difficulties').children[4].disabled,false);
});
test('each full minute banks its increasing reward once, without a defeat deduction',()=>{
 const h=setup(),g=h.g;g.start();g.clean();
 g.setClock(59.9);g.bankEndlessMinutes();assert.equal(g.profile.scrap,0);
 g.setClock(60);g.bankEndlessMinutes();assert.equal(g.profile.scrap,120);g.bankEndlessMinutes();assert.equal(g.profile.scrap,120);
 g.setClock(120);g.bankEndlessMinutes();assert.equal(g.profile.scrap,260);
 g.setClock(600);g.bankEndlessMinutes();assert.equal(g.profile.scrap,2100);assert.equal(g.paidMinutes,10);
 g.setClock(659);g.finish(false);g.showResults();g.showResults();assert.equal(g.profile.scrap,2100);assert.equal(g.earnings.total,2100);
 assert.match(h.elements.get('scrapBreakdown').textContent,/already banked/);
 const reloaded=create(42,1280,800,[...h.saved]);assert.equal(reloaded.g.profile.scrap,2100);reloaded.g.start();assert.equal(reloaded.g.paidMinutes,0);
 assert.equal(P.endlessReward(20),6200);assert.equal(P.endlessReward(10)-P.endlessReward(9),300);
});
test('minute banking survives closing an unfinished run and pauses do not accrue time',()=>{
 const h=setup(),g=h.g;g.start();g.clean();g.setClock(59.99);g.pause();g.update(5);assert.equal(g.profile.scrap,0);
 g.pause();g.update(1/60);assert.equal(g.profile.scrap,120);
 const reloaded=create(42,1280,800,[...h.saved]);assert.equal(reloaded.g.profile.scrap,120);
});
test('Endless grows its budget 50% per minute but caps ordinary enemies at 400 with bosses outside the cap',()=>{
 const {g}=setup();g.start();g.clean();g.setClock(150);assert.equal(g.threatBudget(),146);g.setClock(179.99);assert.equal(g.threatBudget(),149);g.setClock(180);g.director(10001);
 assert.equal(g.enemies.some(e=>e.boss),false);assert.equal(g.threatBudget(),150);
 g.setClock(600);assert.equal(g.threatBudget(),Math.floor(150*1.5**7));g.director(1);
 assert.equal(g.enemies.filter(e=>e.boss).length,1);
 g.setClock(1200);g.director(1);assert.equal(g.enemies.filter(e=>e.boss).length,2);
 assert.equal(g.enemies.filter(e=>!e.dead&&!e.boss).length,400);
 for(let t=1300;t<2000;t+=100){g.setClock(t);g.director(1);assert.equal(g.enemies.filter(e=>!e.dead&&!e.boss).length,400);}
 g.updateHud();g.draw(600);
});
test('bosses arrive at four minutes then every 90 seconds with no overdue bursts',()=>{
 const {g}=setup();g.start();g.clean();g.setClock(239.99);g.director(.01);assert.equal(g.enemies.length,0);
 g.pause();g.update(5);assert.equal(g.enemies.length,0);g.pause();
 g.setClock(240);g.director(.01);assert.equal(g.enemies.length,1);
 assert.equal(g.enemies[0].maxHp,144000);
 g.setClock(329.99);g.director(.01);assert.equal(g.enemies.length,1);
 g.setClock(330);g.director(.01);assert.equal(g.enemies.length,2);
 assert.equal(g.enemies[1].maxHp,288000);
 g.setClock(420);g.director(.01);assert.equal(g.enemies.length,3);
 const b=g.enemies[0];b.entry=0;
 for(let i=0;i<3;i++){b.armor=0;g.damage(b,1e9,'Rounds',false,b.x+100*Math.cos(b.weakAngle),b.y+100*Math.sin(b.weakAngle));}
 assert.equal(b.dead,true);assert.equal(g.state,'playing');assert.equal(g.earnings,null);
 assert.equal(g.gems.reduce((n,e)=>n+e.value,0),60);
 g.setClock(421);g.director(.01);assert.equal(g.enemies.filter(e=>!e.dead&&e.boss).length,2);
 g.setClock(510);g.director(.01);assert.equal(g.enemies.filter(e=>!e.dead&&e.boss).length,3);
 assert.equal(g.enemies.at(-1).maxHp,1152000);
 g.updateHud();assert.ok(g.nearestBoss()&&!g.nearestBoss().dead);
});
test('after saturation only replacements gain health; restart resets strength',()=>{
 const {g}=setup();g.start();g.clean();g.setClock(1200);g.director(10001);assert.equal(g.replacementStrength(),1);
 const e=g.enemies.find(e=>e.type==='chaser'&&!e.elite&&!e.fodder),hp=e.hp,damage=e.damage;
 g.setClock(1260);const factor=g.replacementStrength();assert.ok(factor>1.49&&factor<1.51);assert.equal(e.hp,hp);
 e.dead=true;const replacement=g.spawnEnemy('chaser','ordinary');assert.ok(Math.abs(replacement.hp/hp-factor)<1e-8);assert.ok(Math.abs(replacement.damage/damage-1.4)<1e-8);
 g.start();assert.equal(g.replacementStrength(),1);assert.ok(g.enemies.every(e=>!e.boss));
});
test('fully upgraded builds continue collecting levels without empty draft screens',()=>{
 const {g}=setup();g.start();g.clean();for(const u of g.upgrades)g.grant(u.id,u.max);
 g.player.hp=10;g.setXP(g.need);g.levelUp();assert.equal(g.state,'playing');assert.equal(g.level,2);assert.equal(g.player.hp,35);
 g.setXP(g.need);g.levelUp();assert.equal(g.state,'playing');assert.equal(g.player.hp,60);
});
console.log(`PASS: ${n} Endless checks.`);
{
 for(const time of [120,180,240,600])for(const type of ['chaser','shooter','boss']){
  const {g}=setup();g.start();g.clean();g.setClock(time);
  const e=g.spawnEnemy(type,'ordinary'),factor=1.4**Math.max(0,(time-180)/60);
  assert.ok(Math.abs(e.damageMultiplier-factor)<1e-9);
  assert.ok(Math.abs(e.damage-({chaser:12,shooter:14,boss:28}[type]*factor))<1e-8);
  g.setClock(time+120);assert.equal(e.damageMultiplier,factor);
  if(type!=='chaser'){
   Object.assign(e,{entry:0,windup:.01,aim:0});g.enemyAttack(e,.02);
   const shot=g.enemyShots[0],expected=(type==='boss'?12*1.2**2:10)*factor;
   assert.ok(Math.abs(shot.damage-expected)<1e-8);
   for(const s of g.enemyShots.slice(1))s.life=0;
   Object.assign(shot,{x:0,y:0,vx:0,vy:0});g.player.hp=g.player.maxHp=10000;g.player.inv=0;
   g.updateEnemyShots(0,0,0,false);
   assert.equal(g.player.hp,10000-Math.round(expected*1.7));
  }
 }
 const {g,elements}=setup();g.start();g.clean();
 for(let t=240;t<=780;t+=90){g.setClock(t);g.director(.01);}
 assert.equal(g.enemies.filter(e=>e.boss).length,7);g.updateHud();assert.match(elements.get('bossPhase').textContent,/7 BOSSES/);
 g.start();g.clean();g.setClock(240);g.director(.01);assert.equal(g.enemies[0].maxHp,144000);
 const normal=create().g;normal.start();normal.clean();normal.setClock(1200);
 assert.equal(normal.spawnEnemy('shooter','ordinary').damageMultiplier,1);
 console.log('PASS: uncapped bosses/HUD/reset and spawn-fixed damage for contact and projectiles; normal modes unchanged.');
}
