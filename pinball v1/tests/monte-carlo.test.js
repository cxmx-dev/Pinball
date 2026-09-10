'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var os = require('os');
var sim = require('../simulation.js');

var scratch = process.env.SCRATCH || path.join(os.tmpdir(), 'pinball-scratch');

console.log('Pinball Monte Carlo stuck + drain test');
console.log('======================================');

var maxStuck = 0;
var runs = 200;
var drainAttempts = 0;
var drainSuccess = 0;
var escaped = 0;

for (var r = 0; r < runs; r++) {
  var state = sim.createInitialState();
  sim.launchBall(state, 300 + Math.random() * 900);
  var stuck = 0;
  var fellBelow = false;
  for (var i = 0; i < 6000; i++) {
    sim.tick(state, 0.016);
    if (!state.ball.inPlay) {
      if (fellBelow) drainSuccess++;
      break;
    }
    if (state.ball.y > sim.FLIPPER_ROW_Y + 40 && state.ball.x < sim.LAUNCH_LANE_LEFT - 8) {
      fellBelow = true;
    }
    if (state.ball.y > sim.TABLE_H + 120) {
      escaped++;
      break;
    }
    var sp = Math.sqrt(state.ball.vx * state.ball.vx + state.ball.vy * state.ball.vy);
    if (sp < 30 && state.ball.y > sim.FLIPPER_ROW_Y - 20 && state.ball.x < sim.LAUNCH_LANE_LEFT - 8) {
      stuck++;
      if (stuck > maxStuck) maxStuck = stuck;
    } else {
      stuck = 0;
    }
  }
  if (fellBelow) drainAttempts++;
}

assert(maxStuck < 15, 'max stuck frames should stay low, got ' + maxStuck);
assert.strictEqual(escaped, 0, 'no ball should escape below table without draining');
assert(drainAttempts === 0 || drainSuccess / drainAttempts > 0.85,
  'drain success rate should exceed 85%, got ' + drainSuccess + '/' + drainAttempts);

var log = [
  'Monte Carlo stuck + drain test',
  'runs: ' + runs,
  'max stuck frames: ' + maxStuck,
  'drain attempts (fell below flippers): ' + drainAttempts,
  'drain success: ' + drainSuccess,
  'escaped below table: ' + escaped,
  'PASS'
].join('\n');

fs.mkdirSync(scratch, { recursive: true });
fs.writeFileSync(path.join(scratch, 'monte-carlo.log'), log + '\n');
console.log('max stuck:', maxStuck, 'drain:', drainSuccess + '/' + drainAttempts, 'escaped:', escaped);
console.log('PASS: monte carlo thresholds met');
console.log('======================================');