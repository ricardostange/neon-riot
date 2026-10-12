const assert = require('node:assert/strict');
const P = require('../progression.js');
const {create} = require('./harness.cjs');
const saved = p => [['neon-riot-progression',JSON.stringify(p)]];
const old=P.normalize({version:1,scrap:777,ranks:{rounds:4}});
assert.equal(old.ranks.projectileSpeed,0);assert.equal(old.scrap,777);assert.equal(old.ranks.rounds,4);
for(let rank=0;rank<=10;rank++){
 const p=P.normalize({version:1,ranks:{projectileSpeed:rank}}),{g}=create(42,1280,800,saved(p));
 g.start();g.clean();const e=g.spawnEnemy('chaser');Object.assign(e,{entry:0,x:450,y:0});
 g.fire();const b=g.bullets[0],speed=Math.hypot(b.vx,b.vy);
 assert.equal(speed,175+52.5*rank);assert.ok(Math.abs(speed*b.life-840)<1e-9);
 assert.equal(g.player.damage,19);assert.equal(g.player.fireRate,.38);
 g.buildGrid();const hp=e.hp;
 for(let i=0;i<180&&e.hp===hp;i++)g.updateBullets(1/60);
 assert.ok(e.hp<hp,'projectile must reach a target at the edge of auto-aim range');
 g.start();assert.equal(g.player.bulletSpeed,speed);
}
const p=P.normalize({version:1,scrap:24});assert.equal(P.buy(p,'projectileSpeed'),false);
p.scrap=1945;for(let i=0;i<10;i++)assert.equal(P.buy(p,'projectileSpeed'),true);
assert.equal(p.scrap,0);assert.equal(P.buy(p,'projectileSpeed'),false);
assert.equal(P.normalize({version:1,ranks:{projectileSpeed:100}}).ranks.projectileSpeed,10);
const h=create(42,1280,800,saved(P.normalize({version:1,scrap:100})));h.g.openWorkshop();
const index=P.upgrades.findIndex(u=>u.id==='projectileSpeed');
h.elements.get('permanentUpgrades').children[index].children[0].onclick();
assert.equal(h.g.profile.scrap,75);assert.equal(h.g.profile.ranks.projectileSpeed,1);
const reload=create(42,1280,800,[...h.saved]);reload.g.start();assert.equal(reload.g.player.bulletSpeed,227.5);
const pt=create(42,1280,800,[],'pt-BR');pt.g.openWorkshop();
assert.match(pt.elements.get('permanentUpgrades').children[index].innerHTML,/Munição de alta velocidade/);
console.log('PASS: all 11 speeds, fixed range, distant hits, save migration, purchase/cap/persistence and Portuguese workshop.');
