'use strict';

var assert = require('assert');
var sim = require('../simulation.js');

function fresh() {
  return sim.createInitialState();
}

console.log('Pinball enhancement unit tests');
console.log('==============================');

(function testInitialStateHasElaborateElements() {
  var state = fresh();
  assert(state.slingshots.length >= 2);
  assert(state.targets.length >= 3);
  assert(state.rollovers.length >= 2);
  assert(state.kickers.length === 0);
  assert(state.bumpers.length >= 4);
  assert(state.spinner);
  assert.strictEqual(state.multiplier, 1);
  console.log('PASS: initial state has elaborate elements');
})();

(function testRolloverHitIncreasesMultiplier() {
  var state = fresh();
  var lane = state.rollovers[0];
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  state.ball.x = lane.x1;
  state.ball.y = (lane.y1 + lane.y2) / 2;
  state.ball.vx = 0;
  state.ball.vy = 80;
  sim.stepPhysics(state, 0.016);
  assert.strictEqual(lane.lit, true);
  assert(state.multiplier >= 2);
  console.log('PASS: rollover hit increases multiplier');
})();

(function testAllTargetsLitEnablesJackpot() {
  var state = fresh();
  state.targets.forEach(function (t) { t.lit = true; });
  state.jackpotLit = state.targets.every(function (t) { return t.lit; });
  assert.strictEqual(state.jackpotLit, true);
  console.log('PASS: all targets lit enables jackpot');
})();

(function testBumperHitScores() {
  var state = fresh();
  var bumper = state.bumpers[0];
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  state.ball.x = bumper.x;
  state.ball.y = bumper.y - bumper.radius - state.ball.radius + 2;
  state.ball.vx = 0;
  state.ball.vy = 150;
  var before = state.score;
  sim.stepPhysics(state, 0.016);
  assert(state.score > before);
  assert.strictEqual(state.lastHitType, 'bumper');
  console.log('PASS: bumper hit scores');
})();

console.log('==============================');
console.log('All enhancement tests passed.');