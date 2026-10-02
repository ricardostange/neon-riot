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
test('Endless passes 03:00 without boss or reduced budget and exceeds ordinary population cap',()=>{
 const {g}=setup();g.start();g.clean();g.setClock(180);g.director(10001);
 assert.equal(g.enemies.some(e=>e.boss),false);assert.equal(g.threatBudget(),183);
 g.setClock(600);const target=Math.floor(108*1.7*1.2**7);assert.equal(g.threatBudget(),target);g.director(1);
 assert.equal(g.enemies.some(e=>e.boss),false);assert.ok(g.enemies.length>210);
 assert.equal(g.enemies.reduce((n,e)=>n+g.threatCost(e),0),target);
 const previous=g.threatBudget();g.setClock(660);assert.ok(Math.abs(g.threatBudget()/previous-1.2)<.003);
 g.updateHud();g.draw(600);
});
test('fully upgraded builds continue collecting levels without empty draft screens',()=>{
 const {g}=setup();g.start();g.clean();for(const u of g.upgrades)g.grant(u.id,u.max);
 g.player.hp=10;g.setXP(g.need);g.levelUp();assert.equal(g.state,'playing');assert.equal(g.level,2);assert.equal(g.player.hp,35);
 g.setXP(g.need);g.levelUp();assert.equal(g.state,'playing');assert.equal(g.player.hp,60);
});
console.log(`PASS: ${n} Endless checks.`);
