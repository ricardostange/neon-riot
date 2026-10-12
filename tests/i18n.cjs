const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const { create } = require('./harness.cjs');
const source = fs.readFileSync(require('node:path').join(__dirname, '../i18n.js'), 'utf8');
for (const [navigator, expected] of [
  [{language:'pt-BR'},'pt-BR'], [{language:'pt-PT'},'pt-BR'], [{language:'pt'},'pt-BR'],
  [{language:'es'},'en'], [{language:'en-US',languages:['pt-AO','en']},'pt-BR'],
  [{language:'pt',languages:['en','pt']},'en'], [{},'en']
]) {
  const ctx = {navigator}; vm.runInNewContext(source,ctx);
  assert.equal(ctx.RiotI18n.locale, expected);
}
const {g,elements,sandbox} = create(42,1280,800,[],'pt-BR');
const {t,html} = sandbox.RiotI18n;
assert.equal(t('Beat Street to unlock'),'Vença Rua para desbloquear');
assert.equal(t('LEVEL 12 · POWER SPIKE'),'NÍVEL 12 · SALTO DE PODER');
assert.equal(t('+320 SCRAP BANKED'),'+320 SUCATA GUARDADA');
assert.equal(html('<span class="damage-row">Rounds</span>'),'<span class="damage-row">Projéteis</span>');
assert.match(elements.get('difficulties').children[0].innerHTML,/Rua/);
g.openWorkshop(); assert.match(elements.get('permanentUpgrades').children[0].innerHTML,/Estrutura reforçada/);
g.start(); g.updateHud(); g.draw(0); assert.equal(elements.get('dashText').textContent,'PRONTO · ESPAÇO');
g.draft(); assert.match(elements.get('upgradeLevel').textContent,/NÍVEL/);
for (const u of g.upgrades) { assert.notEqual(t(u.name),u.name); assert.notEqual(t(u.desc),u.desc); }
g.finish(false); g.showResults(); assert.match(elements.get('scrapBreakdown').textContent,/DERROTA/);
const english=create(); english.g.start(); english.g.updateHud();
assert.equal(english.elements.get('dashText').textContent,'READY · SPACE');
console.log('Language detection, Portuguese menus/workshop/upgrades/HUD/results and English fallback passed.');
