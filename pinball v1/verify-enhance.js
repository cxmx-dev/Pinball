'use strict';

var fs = require('fs');
var path = require('path');
var os = require('os');
var { spawnSync } = require('child_process');

var scratch = process.env.SCRATCH || path.join(os.tmpdir(), 'pinball-scratch');
var root = __dirname;
var log = [];

function runOnce(n) {
  log.push('--- Enhancement verification run ' + n + ' ---');
  var result = spawnSync(process.execPath, [path.join(root, 'tests/enhance.test.js')], {
    encoding: 'utf8',
    cwd: root
  });
  if (result.stdout) log.push(result.stdout.trimEnd());
  if (result.stderr) log.push(result.stderr.trimEnd());
  log.push('exit: ' + result.status);
  return result.status === 0;
}

fs.mkdirSync(scratch, { recursive: true });
var ok = runOnce(1) && runOnce(2);
fs.writeFileSync(path.join(scratch, 'enhance.log'), log.join('\n') + '\n');
console.log(log.join('\n'));
process.exit(ok ? 0 : 1);