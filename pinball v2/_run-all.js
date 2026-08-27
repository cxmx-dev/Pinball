const { spawnSync } = require('child_process');
const fs = require('fs');
const files = [
  'tests/simulation.test.js',
  'tests/render.test.js',
  'tests/enhance.test.js',
  'tests/monte-carlo.test.js',
  'tests/assets-vfx.test.js',
  'tests/p0-feel.test.js',
  'tests/p1-depth.test.js',
  'tests/p2-polish.test.js',
  'tests/phone-quality.test.js'
];
let failed = false;
const lines = [];
files.forEach((f) => {
  const r = spawnSync(process.execPath, [f], { encoding: 'utf8', cwd: __dirname });
  lines.push('==== ' + f + ' exit=' + r.status);
  if (r.stdout) lines.push(r.stdout.trimEnd());
  if (r.stderr) lines.push(r.stderr.trimEnd());
  if (r.status !== 0) failed = true;
});
fs.writeFileSync(process.env.TEMP + '/need1-each.txt', lines.join('\n') + '\n');
console.log(failed ? 'FAILED' : 'ALL_OK');
process.exit(failed ? 1 : 0);
