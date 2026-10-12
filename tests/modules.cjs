'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {create} = require('./harness.cjs');
const balance = require('../balance.js');
const root = path.join(__dirname, '..');
assert.throws(() => { balance.difficulties[0].health = 99; }, TypeError);
assert.throws(() => { balance.constants.BUDGET_CURVE.push(999); }, TypeError);
// Upgrade closures must follow the current player, including after a restart.
const {g} = create(); g.start(); const previous = g.player;
g.upgrades.find(u=>u.id==='damage').apply(); const oldDamage=previous.damage;
g.start(); const fresh=g.player; const base=fresh.damage;
g.upgrades.find(u=>u.id==='damage').apply();
assert.equal(fresh.damage,base*1.3); assert.equal(previous.damage,oldDamage);
// Drawing receives live references for efficiency, but must not mutate the world.
const before=JSON.stringify([g.player,g.enemies,g.bullets,g.enemyShots,g.gems]);
g.draw(0);g.draw(1);
assert.equal(JSON.stringify([g.player,g.enemies,g.bullets,g.enemyShots,g.gems]),before);
// Every HTML runtime dependency must exist and be available in the offline snapshot.
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const worker=fs.readFileSync(path.join(root,'sw.js'),'utf8');
for(const [,file] of html.matchAll(/<script src="([^"]+)"/g)) {
  assert.ok(fs.existsSync(path.join(root,file)),file);
  assert.ok(worker.includes(`'./${file}'`),`Offline snapshot missing ${file}`);
}
// Stable templates fail loudly for missing parameters and keep markup literal.
for(const lang of ['en','pt-BR']) {
  const ctx={navigator:{language:lang}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'i18n.js'),'utf8'),ctx);
  const values={enemyLimit:400,firstBoss:'04:00',bossInterval:90,budget:150,growthStart:'03:00',budgetGrowth:50,damageGrowth:40};
  const text=ctx.RiotI18n.message('endless.description',values);
  for(const value of Object.values(values)) assert.ok(text.includes(String(value)));
  assert.ok(!text.includes('{'));
  assert.throws(()=>ctx.RiotI18n.message('endless.description'),/Missing/);
  assert.throws(()=>ctx.RiotI18n.message('missing'),/Unknown/);
}
console.log('PASS: frozen balance, restart-safe upgrades, read-only drawing, runtime/offline assets and message contracts.');
// Exercise real audio code with a minimal Web Audio contract, including restart/mute.
let started=0, muted=false;
const param=()=>({setValueAtTime(){},exponentialRampToValueAtTime(){},linearRampToValueAtTime(){},setTargetAtTime(){}});
class AudioContext {
  constructor(){this.currentTime=1;this.state='running';}
  createGain(){return {gain:param(),connect(){},disconnect(){}};}
  createDynamicsCompressor(){return {connect(){}};}
  createOscillator(){return {frequency:param(),connect(){},disconnect(){},start(){started++;},stop(){}};}
}
const audioContext={window:{AudioContext},Math};
vm.runInNewContext(fs.readFileSync(path.join(root,'audio.js'),'utf8'),audioContext);
const audio=audioContext.createRiotAudio({isMuted:()=>muted,getPlayer:()=>({fireRate:.38}),getClock:()=>12,weaponWeight:()=>1});
audio.init();audio.sound('shot');const first=started;assert.ok(first>0);
audio.sound('shot');assert.equal(started,first);
audio.reset();audio.sound('shot');assert.equal(started,first*2);
muted=true;audio.syncMute();audio.sound('dash');assert.equal(started,first*2);
muted=false;audio.syncMute();
for(const sound of ['bossHit','kill','crit','gem','level','dash','ready','boom','hurt','clear','reroll','warning','win']) audio.sound(sound);
assert.ok(started>first*2);
console.log('PASS: audio initialization, sound palette, throttling, restart and mute.');
