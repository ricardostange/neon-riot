// Dependency-free default gate. Browser/device checks remain optional.
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const root = path.join(__dirname, '..');
function run(args) {
  const result = spawnSync(process.execPath, args, {cwd: root, stdio: 'inherit'});
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
for (const file of fs.readdirSync(root).filter(f => f.endsWith('.js'))) run(['--check', file]);
const excluded = new Set(['check.cjs', 'harness.cjs', 'browser.cjs', 'runs.cjs']);
for (const file of fs.readdirSync(__dirname).filter(f => f.endsWith('.cjs') && !excluded.has(f)).sort()) {
  console.log(`\n${file}`);
  run([`tests/${file}`]);
}
console.log('\nAll automated checks passed.');
