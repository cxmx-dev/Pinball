'use strict';

var fs = require('fs');
var path = require('path');
var os = require('os');
var { spawnSync } = require('child_process');

var scratch = process.env.SCRATCH || path.join(os.tmpdir(), 'pinball-scratch');
var root = __dirname;
var testFiles = [
  'tests/simulation.test.js',
  'tests/render.test.js',
  'tests/enhance.test.js',
  'tests/monte-carlo.test.js',
  'tests/assets-vfx.test.js',
  'tests/p0-feel.test.js',
  'tests/p1-depth.test.js',
  'tests/p2-polish.test.js'
];

fs.mkdirSync(scratch, { recursive: true });

function runOnce(runNum) {
  var chunks = [];
  var failed = false;
  chunks.push('Test run ' + runNum + ' at ' + new Date().toISOString());
  chunks.push('');

  testFiles.forEach(function (file) {
    chunks.push('$ node ' + file);
    var result = spawnSync(process.execPath, [path.join(root, file)], {
      encoding: 'utf8',
      cwd: root
    });
    if (result.stdout) chunks.push(result.stdout.replace(/\r\n/g, '\n').trimEnd());
    if (result.stderr) chunks.push(result.stderr.replace(/\r\n/g, '\n').trimEnd());
    chunks.push('exit code: ' + result.status);
    chunks.push('');
    if (result.status !== 0) failed = true;
  });

  var logPath = path.join(scratch, 'tests-run' + runNum + '.log');
  fs.writeFileSync(logPath, chunks.join('\n') + '\n', { encoding: 'utf8' });
  return failed;
}

var anyFail = runOnce(1) || runOnce(2);

var combined = [];
combined.push(fs.readFileSync(path.join(scratch, 'tests-run1.log'), 'utf8'));
combined.push(fs.readFileSync(path.join(scratch, 'tests-run2.log'), 'utf8'));
fs.writeFileSync(path.join(scratch, 'tests.log'), combined.join('\n'), { encoding: 'utf8' });

var rootListing = [];
rootListing.push('Root files (excluding backup):');
fs.readdirSync(root).forEach(function (f) {
  try {
    if (fs.statSync(path.join(root, f)).isFile()) rootListing.push('  ' + f);
  } catch (e) { /* skip */ }
});
rootListing.push('');
rootListing.push('tests/:');
fs.readdirSync(path.join(root, 'tests')).forEach(function (f) {
  rootListing.push('  tests/' + f);
});
fs.writeFileSync(path.join(scratch, 'root-files.txt'), rootListing.join('\n') + '\n');

if (anyFail) {
  console.error('Tests failed — see ' + scratch);
  process.exit(1);
}
console.log('All test runs passed. Logs written to ' + scratch);