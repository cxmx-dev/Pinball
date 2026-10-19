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
  state.ballSaveTimer = sim.BALL_SAVE_DURATION;
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


(function testNearSkillShotNoBallSave() {
  var state = fresh();
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  state.skillShotWindow = true;
  var top = state.bumpers[0];
  var touch = top.radius + 12;
  var g = sim.gradeSkillShot({ x: top.x + touch + 18, y: top.y, radius: 12 }, top);
  assert.strictEqual(g.grade, 'near');
  sim.applySkillShot(state, g);
  assert.strictEqual(state.ballSaveArmed, false, 'near must not arm save');
  console.log('PASS: near skill shot does not arm ball-save');
})();

(function testDump17FieldBallCannotTunnelIntoShooterLane() {
  var LL = sim.LAUNCH_LANE_LEFT;
  var cases = [
    { x: 451, y: 135, vx: 1243, vy: 399, dt: 1 / 30 },
    { x: 441, y: 128, vx: 1496, vy: 332, dt: 1 / 30 },
    { x: 444, y: 171, vx: 900, vy: -1000, dt: 1 / 30 },
    { x: 440, y: 400, vx: 1600, vy: 0, dt: 1 / 30 },
    { x: 440, y: 620, vx: 1600, vy: 200, dt: 1 / 60 }
  ];
  cases.forEach(function (c) {
    var state = fresh();
    var b = state.ball;
    b.inPlay = true; b.x = c.x; b.y = c.y; b.vx = c.vx; b.vy = c.vy;
    state.exitedLaunchLane = true;
    for (var i = 0; i < 30; i++) {
      sim.stepPhysics(state, c.dt);
      if (!state.ball.inPlay) break;
      if (state.ball.y > 120 && state.ball.y < 760) {
        assert(state.ball.x <= LL - state.ball.radius + 0.5,
          'field ball crossed divider at y=' + state.ball.y.toFixed(1) + ' x=' + state.ball.x.toFixed(1));
      }
    }
  });
  [1, 0.5].forEach(function (meter) {
    var s = fresh();
    sim.launchBall(s, meter);
    var out = false;
    for (var k = 0; k < 400 && s.ball.inPlay; k++) {
      sim.tick(s, 1 / 60);
      if (s.exitedLaunchLane && s.ball.x < LL - 10) { out = true; break; }
    }
    assert(out, 'plunge (meter ' + meter + ') still exits the shooter lane');
  });
  console.log('PASS: dump17 field ball cannot tunnel into shooter lane; plunges still exit');
})();

(function testDump18CornerExitReachesFieldNotLane() {
  var LL = sim.LAUNCH_LANE_LEFT;
  // Stalled weak/medium plunge in the top-right corner: rolls out the one-way
  // corner exit into the copper slide / field, never back down the lane.
  [[488, 67, 0, 0], [500, 85, 0, 100], [510, 60, -50, 300]].forEach(function (c) {
    var state = fresh();
    var b = state.ball;
    b.inPlay = true; b.x = c[0]; b.y = c[1]; b.vx = c[2]; b.vy = c[3];
    state.phase = 'playing';
    state.exitedLaunchLane = true;
    state.skillShotWindow = true;
    var field = false;
    for (var i = 0; i < 240 && state.ball.inPlay; i++) {
      sim.tick(state, 1 / 60);
      assert(!(state.ball.x > LL + 2 && state.ball.y > 160),
        'corner ball fell down the lane (start ' + c.join(',') + ' at ' + state.ball.x.toFixed(1) + ',' + state.ball.y.toFixed(1) + ')');
      if (state.ball.x < LL - 30 && state.ball.y > 140) { field = true; break; }
    }
    assert(field, 'corner ball reaches the field (start ' + c.join(',') + ')');
  });
  // One-way: a copper-slide ball driven right cannot enter through the exit.
  var s2 = fresh();
  s2.ball.inPlay = true; s2.ball.x = 452; s2.ball.y = 115; s2.ball.vx = 900; s2.ball.vy = 0;
  s2.phase = 'playing';
  s2.exitedLaunchLane = true;
  for (var k = 0; k < 20; k++) {
    sim.stepPhysics(s2, 1 / 60);
    assert(!(s2.ball.x > 470 && s2.ball.y > 103 && s2.ball.y < 780), 'slide ball crossed the corner exit into the lane');
  }
  [1, 0.5].forEach(function (meter) {
    var s = fresh();
    sim.launchBall(s, meter);
    var out = false;
    for (var j = 0; j < 400 && s.ball.inPlay; j++) {
      sim.tick(s, 1 / 60);
      if (s.exitedLaunchLane && s.ball.x < LL - 10) { out = true; break; }
    }
    assert(out, 'plunge (meter ' + meter + ') still exits the shooter lane');
  });
  console.log('PASS: dump18 corner exit reaches field, not lane; one-way; plunges still exit');
})();

(function testDump20NoEscapeOutTheTop() {
  var W = sim.TABLE_W;
  function outside(b) { return b.x < 35 || b.x > W - 35 || b.y < 18; }
  // Full plunge at 30 and 60 fps rides the U and never leaves out the top
  // (dump19: at dt 1/30 it crossed the NE merge rail and flew to y~-216).
  [[1, 1 / 60], [1, 1 / 30], [0.95, 1 / 30]].forEach(function (c) {
    var s = fresh();
    sim.launchBall(s, c[0]);
    var inU = false;
    for (var i = 0; i < 240 && s.ball.inPlay; i++) {
      sim.tick(s, c[1]);
      assert(!outside(s.ball), 'plunge meter ' + c[0] + ' dt 1/' + Math.round(1 / c[1]) +
        ' left the table at ' + s.ball.x.toFixed(1) + ',' + s.ball.y.toFixed(1));
      if (s.exitedLaunchLane && s.ball.y < 90 && s.ball.x > 160 && s.ball.x < 400) { inU = true; break; }
    }
    assert(inU, 'plunge meter ' + c[0] + ' dt 1/' + Math.round(1 / c[1]) + ' rides the U');
  });
  // A 30 fps frame is the same physics as two 60 fps frames.
  var a = fresh(), b = fresh();
  sim.launchBall(a, 1); sim.launchBall(b, 1);
  for (var k = 0; k < 45; k++) { sim.tick(a, 1 / 60); sim.tick(a, 1 / 60); sim.tick(b, 1 / 30); }
  assert(Math.abs(a.ball.x - b.ball.x) < 1e-6 && Math.abs(a.ball.y - b.ball.y) < 1e-6, '30 fps plunge matches 60 fps');
  // Fast balls thrown up into the U outer rail / corners stay on the table.
  var seed = 20;
  function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
  var escaped = 0;
  for (var n = 0; n < 600; n++) {
    var s2 = fresh();
    var ball = s2.ball;
    ball.inPlay = true; s2.phase = 'playing'; s2.exitedLaunchLane = true;
    ball.x = 50 + rnd() * 410; ball.y = 36 + rnd() * 110;
    var sp = 800 + rnd() * 800, ang = -Math.PI / 2 + (rnd() - 0.5) * 2.2;
    ball.vx = Math.cos(ang) * sp; ball.vy = Math.sin(ang) * sp;
    var dt = n % 2 ? 1 / 30 : 1 / 60;
    for (var j = 0; j < 60 && s2.ball.inPlay; j++) {
      sim.stepPhysics(s2, dt);
      if (outside(s2.ball)) { escaped++; break; }
    }
  }
  assert.strictEqual(escaped, 0, 'fast balls left the table out the top: ' + escaped + ' of 600');
  console.log('PASS: dump20 hard plunges and fast balls stay on the table at 30 and 60 fps');
})();

(function testDump21BoingersClearOfFlippersAndWalls() {
  // Each boinger leaves at least a ball width plus margin (30 px) to every
  // wall, sling, other boinger and flipper sweep, so no pinch pocket.
  // dump20: copper A at 398,686 was 7.7 px from the right filler; cyan C at
  // 125,708 was sunk into the left sling filler and 11.1 px over the cage.
  var s = fresh();
  function segDist(px, py, x1, y1, x2, y2) {
    var dx = x2 - x1, dy = y2 - y1, L = dx * dx + dy * dy;
    var t = L ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / L)) : 0;
    return Math.hypot(x1 + t * dx - px, y1 + t * dy - py);
  }
  var NEED = 30;
  s.boingers.forEach(function (b, i) {
    var worst = 1e9, why = '';
    s.walls.concat(s.slingshots).forEach(function (w) {
      var g = segDist(b.x, b.y, w.x1, w.y1, w.x2, w.y2) - b.radius;
      if (g < worst) { worst = g; why = (w.kind || 'sling') + ' ' + [w.x1, w.y1, w.x2, w.y2].join(','); }
    });
    s.boingers.forEach(function (o, j) {
      if (j === i) return;
      var g = Math.hypot(o.x - b.x, o.y - b.y) - o.radius - b.radius;
      if (g < worst) { worst = g; why = 'boinger ' + j; }
    });
    s.flippers.forEach(function (f) {
      var a0 = Math.min(f.restAngle, f.activeAngle), a1 = Math.max(f.restAngle, f.activeAngle);
      for (var k = 0; k <= 32; k++) {
        var a = a0 + (a1 - a0) * k / 32;
        var g = segDist(b.x, b.y, f.pivotX, f.pivotY, f.pivotX + Math.cos(a) * f.length, f.pivotY + Math.sin(a) * f.length) - f.width / 2 - b.radius;
        if (g < worst) { worst = g; why = f.side + ' ' + f.role + ' flipper sweep'; }
      }
    });
    assert(worst >= NEED, 'boinger ' + i + ' (' + b.theme + ' at ' + b.x + ',' + b.y + ') only ' + worst.toFixed(1) + ' px from ' + why);
  });
  console.log('PASS: dump21 boingers clear of flippers, walls and each other (>= 30 px)');
})();

console.log('==========================');
console.log('All P0 feel tests passed.');
