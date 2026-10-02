const assert = require('node:assert/strict');
const P = require('../progression.js');
const { create } = require('./harness.cjs');
let passed = 0;
function test(name, run) { run(); console.log(`  ✓ ${name}`); passed++; }
const savedProfile = p => [['neon-riot-progression', JSON.stringify(p)]];

test('missing, corrupted and incompatible saves fall back safely', () => {
  for (const raw of [null, [], 'bad', {version:99,scrap:1000}]) assert.equal(P.normalize(raw).scrap,0);
  const p=P.normalize({version:1,scrap:-100,unlocked:99,selected:99,ranks:{hull:99,rounds:-1,dash:'5',rerolls:NaN}});
  assert.equal(p.scrap,0);assert.equal(p.selected,3);assert.equal(p.ranks.hull,10);assert.equal(p.ranks.rounds,0);assert.equal(p.ranks.dash,0);
  assert.equal(P.normalize({version:1,unlocked:0,selected:3}).selected,0);
  const old=P.normalize({version:1,scrap:123,ranks:{hull:2}});assert.equal(old.ranks.attackSpeed,0);assert.equal(old.scrap,123);assert.equal(old.ranks.hull,2);
  assert.equal(create(42,1280,800,[['neon-riot-progression','{broken']]).g.profile.scrap,0);
});
test('purchases reject insufficient funds and capped or unknown upgrades', () => {
  const p=P.normalize(null);assert.equal(P.buy(p,'hull'),false);assert.equal(P.buy(p,'invalid'),false);
  p.scrap=100000;
  for(let i=0;i<10;i++)assert.equal(P.buy(p,'hull'),true);
  assert.equal(p.scrap,97395);assert.equal(p.ranks.hull,10);
  assert.equal(P.buy(p,'hull'),false);assert.equal(p.scrap,97395);
});
test('defeat earns Scrap; victory and higher difficulty increase rewards', () => {
  assert.equal(P.reward(60,100,false,0).total,10);
  assert.equal(P.reward(180,500,false,0).total,40);
  assert.equal(P.reward(180,500,true,0).total,140);
  assert.equal(P.reward(180,500,true,3).total,448);
  assert.equal(P.reward(99999,99999,false,0).total,40);
  assert.equal(P.reward(0,0,false,0).total,0);
  for(let d=0;d<4;d++)assert.equal(P.reward(180,500,false,d).total,[40,60,88,128][d]);
});
test('boss wins unlock only the next tier and preserve selected difficulty', () => {
  const p=P.normalize(null);
  P.settle(p,P.reward(180,500,true,0),true,0);
  assert.equal(p.unlocked,1);assert.equal(p.selected,0);assert.equal(p.wins[0],1);
  P.settle(p,P.reward(180,500,false,1),false,1);assert.equal(p.unlocked,1);
  P.settle(p,P.reward(180,500,true,0),true,0);assert.equal(p.unlocked,1);
});
test('run rewards settle once, before results, and survive a reload', () => {
  const h=create();h.g.start();h.g.setClock(60);h.g.finish(false);
  assert.equal(h.g.profile.scrap,5);h.g.finish(false);h.g.showResults();h.g.showResults();assert.equal(h.g.profile.scrap,5);
  const next=create(42,1280,800,[...h.saved]);assert.equal(next.g.profile.scrap,5);
  next.g.start();assert.equal(next.g.earnings,null);next.g.setClock(60);next.g.finish(false);assert.equal(next.g.profile.scrap,10);
});
test('workshop purchase persists and bonuses apply once per new run', () => {
  const p=P.normalize(null);p.scrap=1000;
  const {g,elements,saved}=create(42,1280,800,savedProfile(p));
  g.openWorkshop();elements.get('permanentUpgrades').children[0].children[0].onclick();
  assert.equal(g.profile.ranks.hull,1);assert.equal(g.profile.scrap,970);
  g.openMenu();g.start();assert.equal(g.player.maxHp,110);
  g.start();assert.equal(g.player.maxHp,110);
  const loaded=create(42,1280,800,[...saved]);loaded.g.start();assert.equal(loaded.g.player.maxHp,110);
  // A retained click handler must not buy upgrades mid-run.
  elements.get('permanentUpgrades').children[0].children[0].onclick();assert.equal(g.profile.ranks.hull,1);
});
test('all permanent bonuses are capped and applied independently of run upgrades', () => {
  const p=P.normalize({version:1,ranks:{hull:5,rounds:5,attackSpeed:5,magnet:5,dash:5,rerolls:3}});
  const {g}=create(42,1280,800,savedProfile(p));g.start();
  assert.equal(g.player.maxHp,150);assert.ok(Math.abs(g.player.damage-24.7)<1e-8);
  assert.ok(Math.abs(g.player.fireRate-.38/1.4)<1e-10);assert.equal(g.player.magnet,180);assert.equal(g.player.dashMax,1.92);assert.equal(g.rerolls,5);
  assert.equal(Object.keys(g.build).length,0);
});
test('difficulty selection persists and higher threats have stronger enemies', () => {
  const p=P.normalize({version:1,unlocked:3});
  const {g,elements,saved}=create(42,1280,800,savedProfile(p));
  elements.get('difficulties').children[3].onclick();g.start();
  assert.equal(g.difficulty.name,'Cataclysm');assert.equal(JSON.parse(saved.get('neon-riot-progression')).selected,3);
  g.clean();const tank=g.spawnEnemy('tank');assert.equal(tank.hp,208);
  const boss=g.spawnEnemy('boss');assert.equal(boss.hp,288000);
  g.player.inv=0;g.hurt(10);assert.equal(g.player.hp,83);
  assert.equal(create().elements.get('difficulties').children[1].disabled,true);
});
test('boss burst cannot skip cores; armor blocks damage and patterns escalate', () => {
  const {g}=create();g.start();g.clean();const boss=g.spawnEnemy('boss');boss.entry=0;
  assert.equal(boss.maxHp,144000);assert.equal(g.attackAngles(boss).length,16);
  g.damage(boss,1e9);assert.equal(boss.hp,96000);assert.equal(boss.phase,1);assert.ok(boss.armor>0);
  assert.equal(g.stats.damage.Rounds,48000);g.damage(boss,1e9);assert.equal(boss.hp,96000);
  assert.equal(g.attackAngles(boss).length,20);
  boss.armor=0;g.damage(boss,1e9);assert.equal(boss.hp,48000);assert.equal(boss.phase,2);
  assert.equal(g.attackAngles(boss).length,24);assert.equal(g.state,'playing');
  boss.armor=0;g.damage(boss,1e9);assert.equal(g.state,'ending');assert.equal(g.profile.unlocked,1);
  assert.equal(g.stats.damage.Rounds,144000);
});
test('armor expires during play and paused combat cannot consume it', () => {
  const {g}=create();g.start();g.clean();const boss=g.spawnEnemy('boss');boss.entry=0;
  g.damage(boss,1e9);g.player.inv=100;g.player.fire=100;
  g.pause();g.update(1);assert.equal(boss.armor,1.5);g.pause();
  for(let i=0;i<91;i++)g.update(1/60);
  assert.equal(boss.armor,0);g.damage(boss,1);assert.equal(boss.hp,95999);
});
test('higher difficulties increase spawn pressure without raising the entity cap', () => {
  function count(selected){const {g}=create(42,1280,800,savedProfile(P.normalize({version:1,unlocked:3,selected})));g.start();for(let i=0;i<1500;i++){g.setClock(60);g.director(.02);}return g.enemies.length;}
  assert.ok(count(3)>count(0));
  const {g}=create(42,1280,800,savedProfile(P.normalize({version:1,unlocked:3,selected:3})));g.start();
  for(let i=0;i<2000;i++){g.setClock(100);g.director(1);}assert.ok(g.enemies.length<=210);assert.equal(g.enemies.reduce((n,e)=>n+g.threatCost(e),0),g.threatBudget());
  const before=g.enemies.length;g.setClock(180);g.director(1);assert.equal(g.enemies.length,before+1);assert.equal(g.enemies.filter(e=>e.boss).length,1);
});
test('storage write failures do not crash settlement or hide the limitation', () => {
  const {g,sandbox,elements}=create();sandbox.localStorage.setItem=()=>{throw Error('blocked');};
  g.start();g.setClock(60);g.finish(false);g.showResults();assert.equal(g.profile.scrap,5);
  assert.match(elements.get('unlockNotice').textContent,/Storage unavailable/);
});
console.log(`PASS: ${passed} progression and difficulty checks.`);
