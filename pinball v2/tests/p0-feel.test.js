'use strict';

/**
 * P0 feel & clarity — drives shipped PinballSim (no hardcoded full-suite scores).
 */
var assert = require('assert');
var sim = require('../simulation.js');

function fresh() {
  return sim.createInitialState();
}

console.log('Pinball P0 feel unit tests');
console.log('==========================');

(function testGradeSkillShotCenterVsNear() {
  var top = { x: 240, y: 200, radius: 36 };
  var ball = { x: 240, y: 200, radius: 12, vx: 0, vy: 0 };
  var center = sim.gradeSkillShot(ball, top);
  assert(center, 'center hit should grade');
  assert.strictEqual(center.grade, 'center');
  assert.strictEqual(center.bonus, sim.SKILL_SHOT_CENTER_BONUS);
  assert(/CENTER/i.test(center.label), 'center label');

  // Just outside center ring, inside near ring
  var touch = top.radius + ball.radius;
  ball.x = top.x + touch + 18;
  ball.y = top.y;
  var near = sim.gradeSkillShot(ball, top);
  assert(near, 'near-miss should grade');
  assert.strictEqual(near.grade, 'near');
  assert.strictEqual(near.bonus, sim.SKILL_SHOT_NEAR_BONUS);
  assert(near.bonus < center.bonus, 'near bonus < center');
  assert(/NEAR/i.test(near.label), 'near label');

  ball.x = top.x + touch + 80;
  assert.strictEqual(sim.gradeSkillShot(ball, top), null, 'miss returns null');
  console.log('PASS: skill shot grades center vs near vs miss');
})();

(function testApplySkillShotArmsBallSave() {
  var state = fresh();
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  state.skillShotWindow = true;
  state.multiplier = 1;
  var g = sim.gradeSkillShot(
    { x: state.bumpers[0].x, y: state.bumpers[0].y, radius: 12 },
    state.bumpers[0]
  );
  var before = state.score;
  sim.applySkillShot(state, g);
  assert(state.score > before, 'skill awards points');
  assert.strictEqual(state.skillShotWindow, false);
  assert.strictEqual(state.ballSaveArmed, true);
  assert(state.skillShotBannerLife > 0, 'banner armed');
  assert(/CENTER/i.test(state.skillShotBanner));
  console.log('PASS: applySkillShot arms ball save + banner');
})();

(function testPopupMergeAtHighCombo() {
  var state = fresh();
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  state.multiplier = 1;
  // First hits build combo
  sim.awardScore(state, 100, 'bumper', 'a', 100, 200);
  sim.awardScore(state, 100, 'bumper', 'b', 110, 210);
  var afterTwo = state.lastScorePopup.points;
  assert(state.comboCount >= 2, 'combo building');
  // Third+ should merge into same popup when still alive
  sim.awardScore(state, 100, 'bumper', 'c', 120, 220);
  assert(state.comboCount >= 3, 'combo >= merge threshold');
  var pop = state.lastScorePopup;
  assert(pop.merged === true || pop.type === 'combo', 'merged popup flag/type');
  assert(pop.points > afterTwo, 'merged points accumulate on one popup');
  // Skill shot should not merge into combo popup
  var ptsBeforeSkill = pop.points;
  sim.awardScore(state, 500, 'skillshot', 's', 240, 200);
  assert.strictEqual(state.lastScorePopup.type, 'skillshot');
  assert.notStrictEqual(state.lastScorePopup.points, ptsBeforeSkill + 500 * state.multiplier);
  // Actually skill creates new popup — type skillshot
  assert.strictEqual(state.lastScorePopup.merged, false);
  console.log('PASS: popup merge at high combo; skillshot not merged');
})();

(function testFullDashStackRewardPartialNone() {
  var state = fresh();
  // Keep ball out of physics so dashes aren't wiped by resetBallToPlunger
  state.ball.inPlay = false;
  state.phase = 'ready';
  var dashes = state.launchLaneDashes;
  var score0 = state.score;
  var i;
  for (i = 0; i < dashes.length - 2; i++) {
    dashes[i].lit = true;
    dashes[i].intensity = 1;
  }
  // Drive dash update via tick (charge/physics no-op on ball)
  for (var t = 0; t < 5; t++) sim.tick(state, 0.016);
  assert.strictEqual(state.launchDashRewarded, false, 'partial not rewarded');
  assert.strictEqual(state.score, score0, 'partial awards no score');

  dashes = state.launchLaneDashes;
  for (i = 0; i < dashes.length; i++) {
    dashes[i].lit = true;
    dashes[i].intensity = 1;
  }
  var before = state.score;
  sim.tick(state, 0.016);
  assert.strictEqual(state.launchDashRewarded, true, 'full stack rewarded once');
  assert(state.score > before, 'full stack adds bonus');
  var afterFull = state.score;
  sim.tick(state, 0.016);
  assert.strictEqual(state.score, afterFull, 'full stack bonus once only');
  console.log('PASS: full dash reward; partial none; no double award');
})();

(function testBallSaveOnceThenDrain() {
  var state = fresh();
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  state.phase = 'playing';
  state.ballsRemaining = 3;
  state.ballSaveArmed = true;
  state.ballSaveUsed = false;
  state.ball.x = 240;
  state.ball.y = sim.DRAIN_Y + 5;
  state.ball.vy = 200;

  var ballsBefore = state.ballsRemaining;
  var drainsBefore = state.drainEvents;
  sim.performDrain(state);
  assert.strictEqual(state.ball.inPlay, true, 'save keeps ball in play');
  assert.strictEqual(state.ballsRemaining, ballsBefore, 'save does not spend ball');
  assert.strictEqual(state.drainEvents, drainsBefore, 'save does not count drain event');
  assert.strictEqual(state.ballSaveUsed, true);
  assert.strictEqual(state.ballSaveArmed, false);
  assert(state.ballSaveFlash > 0, 'save flash');
  assert.strictEqual(state.lastHitType, 'ballsave');

  // Second drain spends ball and enters EOB (then ready after flush)
  sim.performDrain(state);
  assert.strictEqual(state.ballsRemaining, ballsBefore - 1, 'second drain spends ball');
  assert.strictEqual(state.drainEvents, drainsBefore + 1);
  assert(state.drainFlash > 0, 'drain flash on real drain');
  assert.strictEqual(state.phase, 'eob_bonus', 'EOB sequence after real drain');
  var g = 0;
  while (state.phase === 'eob_bonus' && g++ < 80) sim.tick(state, 0.05);
  assert.strictEqual(state.phase, 'ready');
  console.log('PASS: ball-save once then real drain');
})();

console.log('==========================');
console.log('All P0 feel tests passed.');
