'use strict';

var assert = require('assert');
var sim = require('../simulation.js');

function fresh() {
  return sim.createInitialState();
}

function flushEob(state) {
  var g = 0;
  while (state.phase === 'eob_bonus' && g++ < 80) sim.tick(state, 0.05);
}

console.log('Pinball P1 depth unit tests');
console.log('===========================');

(function testDropBankStartsRush() {
  var state = fresh();
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  state.themeId = 'void-pulse';
  assert.strictEqual(state.dropTargets.length, sim.DROP_BANK_SIZE);
  // Knock drops via ball overlaps (AABB + radius)
  state.dropTargets.forEach(function (drop) {
    state.ball.x = drop.x;
    state.ball.y = drop.y;
    state.ball.vx = 0;
    state.ball.vy = 20;
    drop.occupied = false;
    sim.stepPhysics(state, 0.016);
  });
  assert(sim.allDropsDown(state.dropTargets), 'all drops down');
  assert(state.rushTimer > 0, 'rush started');
  assert.strictEqual(state.rushName, 'VOID RUSH');
  assert.strictEqual(state.rushMult, sim.RUSH_SCORE_MULT);
  console.log('PASS: drop bank starts VOID RUSH');
})();

(function testEmberRushNameFromTheme() {
  var state = fresh();
  sim.setThemeId(state, 'ember-rail');
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  sim.startRushMode(state);
  assert.strictEqual(state.rushName, 'EMBER RUSH');
  console.log('PASS: EMBER RUSH name from theme');
})();

(function testRushDoublesScore() {
  var state = fresh();
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  state.multiplier = 1;
  state.comboCount = 0;
  state.comboTimer = 0;
  sim.awardScore(state, 100, 'bumper', 'x', 200, 200);
  var base = state.score;
  state = fresh();
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  state.multiplier = 1;
  state.comboCount = 0;
  state.comboTimer = 0;
  state.rushTimer = 10;
  state.rushMult = 2;
  sim.awardScore(state, 100, 'bumper', 'x', 200, 200);
  assert.strictEqual(state.score, base * 2, 'rush doubles award');
  console.log('PASS: rush 2X scoring');
})();

(function testSideRoutesExist() {
  var state = fresh();
  assert(state.sideRoutes.leftCaptive, 'left captive');
  assert(state.sideRoutes.rightRamp, 'right ramp');
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  var cap = state.sideRoutes.leftCaptive;
  state.ball.x = cap.x;
  state.ball.y = cap.y;
  state.ball.vx = 10;
  state.ball.vy = 10;
  var s0 = state.score;
  sim.stepPhysics(state, 0.016);
  assert(state.score > s0, 'captive awards');
  assert(state.ball.vy < 0, 'captive kicks up');
  console.log('PASS: left captive route');
})();

(function testEndOfBallBonusTally() {
  var state = fresh();
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  state.multiplier = 3;
  state.launchDashRewarded = true;
  state.jackpotLit = true;
  state.bonusBank = 500;
  state.ballsRemaining = 2;
  sim.performDrain(state);
  assert.strictEqual(state.phase, 'eob_bonus');
  assert(state.eobTotal > 500, 'eob includes mult/dash/jackpot/bank');
  assert(state.eobBreakdown.length >= 2, 'breakdown steps');
  flushEob(state);
  assert.strictEqual(state.phase, 'ready');
  assert(state.score >= state.eobTotal, 'score includes eob');
  assert.strictEqual(state.bonusBank, 0, 'bank cleared');
  console.log('PASS: end-of-ball bonus sequence');
})();

(function testOutlaneWiderThanBefore() {
  var state = fresh();
  var z = sim.getDrainBounds(state);
  // Greedier: left outlane extends further right than classic FLIPPER_INLANE_X alone
  assert(z.leftOutlaneRight > sim.FLIPPER_INLANE_X, 'left outlane greedier');
  assert(z.centerLeft < z.centerRight, 'center drain open');
  console.log('PASS: outlane tension geometry');
})();

console.log('===========================');
console.log('All P1 depth tests passed.');
