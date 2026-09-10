'use strict';

var assert = require('assert');
var sim = require('../simulation.js');

function fresh() {
  return sim.createInitialState();
}

console.log('Pinball simulation unit tests');
console.log('=============================');

(function testGravityUpdatesPositionAndVelocity() {
  var state = fresh();
  state.ball.inPlay = true;
  state.ball.x = 240;
  state.ball.y = 400;
  state.ball.vx = 50;
  state.ball.vy = 0;
  var y0 = state.ball.y;
  var vy0 = state.ball.vy;
  sim.stepPhysics(state, 0.016);
  assert(state.ball.vy > vy0, 'gravity should increase downward velocity');
  assert(state.ball.y > y0, 'ball should move down under gravity');
  assert(state.ball.x > 240, 'ball should advance horizontally');
  console.log('PASS: gravity updates position and velocity');
})();

(function testFlipperActivationChangesTarget() {
  var state = fresh();
  var left = state.flippers.find(function (f) { return f.side === 'left'; });
  var rest = left.angle;
  sim.activateFlipper(state, 'left', true);
  assert.strictEqual(left.active, true);
  for (var i = 0; i < 30; i++) {
    sim.stepPhysics(state, 0.016);
  }
  assert(left.angle < rest, 'active left flipper should rotate toward strike angle');
  console.log('PASS: flipper activation changes angle');
})();

(function testFlipperBallCollisionImpartsVelocity() {
  var state = fresh();
  var flipper = state.flippers.find(function (f) { return f.side === 'left'; });
  flipper.active = true;
  flipper.angle = flipper.activeAngle;
  var tip = sim.flipperTip(flipper);
  state.ball.inPlay = true;
  state.ball.x = tip.x;
  state.ball.y = tip.y - 10;
  state.ball.vx = 0;
  state.ball.vy = 100;
  sim.stepPhysics(state, 0.016);
  assert(
    state.ball.vy < 100 || Math.abs(state.ball.vx) > 5,
    'flipper collision should alter ball velocity'
  );
  console.log('PASS: flipper collision response');
})();

(function testLaunchBallSetsVelocityAndPhase() {
  var state = fresh();
  assert.strictEqual(state.ball.inPlay, false);
  assert.strictEqual(state.phase, 'ready');
  sim.launchBall(state, 800);
  assert.strictEqual(state.ball.inPlay, true);
  assert.strictEqual(state.phase, 'playing');
  assert(state.ball.vy < 0, 'launch should impart upward velocity');
  assert(Math.abs(state.ball.vx) < 40, 'launch should not shove ball sideways into flippers');
  assert.strictEqual(state.ball.x, sim.LAUNCH_LANE_X, 'launch starts from plunger lane');
  assert.strictEqual(state.ball.y, sim.PLUNGER_REST_Y, 'launch starts from plunger rest position');
  console.log('PASS: launch ball sets velocity and phase');
})();

(function testPlungerRestBelowFlippers() {
  var state = fresh();
  var rightFlipper = state.flippers.find(function (f) { return f.side === 'right'; });
  assert(state.ball.y > rightFlipper.pivotY, 'ball rests below flipper pivot in plunger lane');
  assert(state.ball.x > rightFlipper.pivotX, 'ball rests in right launch lane');
  console.log('PASS: plunger rest position below flippers');
})();

(function testFlipperSpacingMatchesStandardRatio() {
  var state = fresh();
  var left = state.flippers.find(function (f) { return f.side === 'left'; });
  var right = state.flippers.find(function (f) { return f.side === 'right'; });
  var spacing = right.pivotX - left.pivotX;
  assert.strictEqual(spacing, sim.FLIPPER_PIVOT_SPACING);
  assert(spacing > 130 && spacing < 200, 'flipper pivot spacing in realistic range');
  var leftTip = sim.flipperTip(left);
  var rightTip = sim.flipperTip(right);
  var tipGap = rightTip.x - leftTip.x;
  assert(tipGap > 35 && tipGap < 80, 'flipper tips leave a playable center gap');
  assert(left.pivotX < 140, 'left flipper sits near left inlane without a wide dead zone');
  console.log('PASS: flipper spacing matches standard ratio (spacing=' + spacing + ' tipGap=' + tipGap.toFixed(1) + ')');
})();

(function testMediumLaunchExitsLaneWithoutDrain() {
  var state = fresh();
  sim.launchBall(state, 600);
  var lost = false;
  for (var i = 0; i < 110; i++) {
    sim.tick(state, 0.016);
    if (state.exitedLaunchLane) break;
    if (state.ballsRemaining < 3) lost = true;
  }
  assert(!lost, 'medium launch should not drain while still in lane');
  assert(state.exitedLaunchLane, 'medium launch should exit launch lane');
  assert(state.ball.y < 140, 'medium launch should feed ball through top wireform');
  assert(state.ball.x < sim.LAUNCH_LANE_LEFT - 40, 'medium launch should exit left toward bumpers');
  console.log('PASS: medium launch exits lane without drain');
})();

(function testChargeLaunchHoldsAtMax() {
  var state = fresh();
  state.launchCharging = true;
  sim.chargeLaunch(state, 0.5);
  assert(state.launchPower >= 0 && state.launchPower <= 1, 'meter stays in 0-1 range');
  var held = fresh();
  held.launchCharging = true;
  sim.chargeLaunch(held, 3);
  assert(held.launchPower === 1, 'meter clamps at full power (no wrap)');
  var p = sim.meterToLaunchPower(held.launchPower);
  assert(p >= 1300, 'full meter maps to strong launch, got ' + p);
  console.log('PASS: charge launch holds at max power');
})();

(function testLeftOutlaneShelfBlocksUpperIntrusion() {
  var state = fresh();
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  state.ball.x = sim.FLIPPER_INLANE_X - state.ball.radius - 6;
  state.ball.y = sim.FLIPPER_ROW_Y - 48;
  state.ball.vx = -40;
  state.ball.vy = 220;
  sim.stepPhysics(state, 0.016);
  assert(
    state.ball.x + state.ball.radius >= sim.FLIPPER_INLANE_X - 2,
    'extended inlane post should keep ball out of left outlane shelf'
  );
  console.log('PASS: left outlane shelf blocks upper intrusion');
})();

(function testStrongLaunchReachesTopBumperZone() {
  var state = fresh();
  sim.launchBall(state, 700);
  for (var i = 0; i < 110; i++) {
    sim.tick(state, 0.016);
    if (state.exitedLaunchLane) break;
  }
  assert(state.exitedLaunchLane, 'strong launch should complete top wireform');
  assert(state.ball.y < 130, 'strong launch should release near top bumpers');
  assert(state.ball.x < sim.LAUNCH_WIRE_X2 + 40, 'strong launch should arc left off shooter lane');
  console.log('PASS: strong launch reaches top bumper zone');
})();

(function testWeakLaunchReturnsToPlungerNotDrain() {
  var state = fresh();
  sim.launchBall(state, 250);
  for (var i = 0; i < 200; i++) {
    sim.tick(state, 0.016);
  }
  assert.strictEqual(state.ballsRemaining, 3, 'weak launch should not cost a ball');
  assert.strictEqual(state.phase, 'ready');
  assert.strictEqual(state.ball.inPlay, false);
  console.log('PASS: weak launch returns to plunger');
})();

(function testBumperDoesNotSpamWhileResting() {
  var state = fresh();
  var saver = state.bumpers.find(function (b) { return b.saver; });
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  state.ball.x = 100;
  state.ball.y = 470;
  state.ball.vx = 10;
  state.ball.vy = 30;
  var hits = 0;
  var score0 = state.score;
  for (var i = 0; i < 120; i++) {
    var s0 = state.score;
    sim.stepPhysics(state, 0.016);
    if (state.score > s0) hits++;
  }
  assert(hits < 12, 'bumper should not magnetize and spam hits, got ' + hits);
  assert(
    Math.abs(state.ball.x - saver.x) > saver.radius + 4 ||
      Math.abs(state.ball.y - saver.y) > saver.radius + 8,
    'ball should escape saver bumper orbit'
  );
  console.log('PASS: bumper does not spam while resting');
})();

(function testTiltWarnsThenDrains() {
  var state = fresh();
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  sim.tilt(state);
  assert.strictEqual(state.tiltWarnings, 1);
  assert.strictEqual(state.ballsRemaining, 3);
  state.tiltCooldown = 0;
  sim.tilt(state);
  assert.strictEqual(state.tiltWarnings, 2);
  state.tiltCooldown = 0;
  sim.tilt(state);
  assert.strictEqual(state.ballsRemaining, 2);
  assert.strictEqual(state.tiltWarnings, 0);
  console.log('PASS: tilt warns then drains');
})();

(function testBumperHitIncreasesScore() {
  var state = fresh();
  var bumper = state.bumpers[0];
  state.ball.inPlay = true;
  state.ball.x = bumper.x;
  state.ball.y = bumper.y - bumper.radius - state.ball.radius + 2;
  state.ball.vx = 0;
  state.ball.vy = 200;
  var scoreBefore = state.score;
  sim.stepPhysics(state, 0.016);
  assert(state.score > scoreBefore, 'bumper hit should increase score');
  assert.strictEqual(state.lastHitBumper, 0);
  console.log('PASS: bumper hit increases score');
})();

(function testShooterLaneGuardBlocksIntrusion() {
  var state = fresh();
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  state.ball.x = 410;
  state.ball.y = 700;
  state.ball.vx = 120;
  sim.stepPhysics(state, 0.016);
  assert(state.ball.x + state.ball.radius < sim.LAUNCH_LANE_LEFT + 2, 'playfield ball cannot fall into plunger lane');
  assert(state.ball.vx < 0, 'guard rail should deflect ball left');
  console.log('PASS: shooter lane guard blocks intrusion');
})();

(function testCanChargePlungerWhenReady() {
  var state = fresh();
  assert(sim.canChargePlunger(state));
  state.phase = 'playing';
  state.ball.inPlay = false;
  assert(sim.canChargePlunger(state), 'can charge when ball returned but phase stuck');
  console.log('PASS: plunger can charge when ball waiting');
})();

(function testCenterDrainOnlyBetweenFlipperTips() {
  var state = fresh();
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  var zones = sim.getDrainBounds(state);
  state.ball.x = (zones.centerLeft + zones.centerRight) / 2;
  state.ball.y = sim.DRAIN_Y + sim.BALL_RADIUS + 2;
  sim.checkDrain(state);
  assert.strictEqual(state.ballsRemaining, 2);
  state = fresh();
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  state.ball.x = zones.leftOutlaneRight + 20;
  state.ball.y = sim.DRAIN_Y + sim.BALL_RADIUS + 2;
  var before = state.ballsRemaining;
  sim.checkDrain(state);
  assert.strictEqual(state.ballsRemaining, before, 'inlane apron should not instantly drain');
  console.log('PASS: drain uses center hole and outlanes');
})();

(function testDrainDecrementsBallsAndResets() {
  var state = fresh();
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  var zones = sim.getDrainBounds(state);
  state.ball.x = (zones.centerLeft + zones.centerRight) / 2;
  state.ball.y = sim.DRAIN_Y + sim.BALL_RADIUS + 2;
  state.ball.vx = 0;
  state.ball.vy = 100;
  var ballsBefore = state.ballsRemaining;
  sim.checkDrain(state);
  assert.strictEqual(state.ball.inPlay, false);
  assert.strictEqual(state.ballsRemaining, ballsBefore - 1);
  assert.strictEqual(state.phase, 'ready');
  assert.strictEqual(state.drainEvents, 1);
  console.log('PASS: drain decrements balls and resets');
})();

(function testDrainGameOverWhenNoBallsLeft() {
  var state = fresh();
  state.ballsRemaining = 1;
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  var zones = sim.getDrainBounds(state);
  state.ball.x = (zones.centerLeft + zones.centerRight) / 2;
  state.ball.y = sim.DRAIN_Y + sim.BALL_RADIUS + 2;
  sim.checkDrain(state);
  assert.strictEqual(state.ballsRemaining, 0);
  assert.strictEqual(state.phase, 'game_over');
  console.log('PASS: drain triggers game over');
})();

(function testBallLockedAtPlungerWhenReady() {
  var state = fresh();
  state.ball.x = 50;
  state.ball.y = 800;
  state.ball.vx = 40;
  state.ball.vy = 20;
  sim.tick(state, 0.016);
  assert.strictEqual(state.ball.x, sim.LAUNCH_LANE_X);
  assert.strictEqual(state.ball.y, sim.PLUNGER_REST_Y);
  assert.strictEqual(state.ball.vx, 0);
  assert.strictEqual(state.ball.vy, 0);
  console.log('PASS: ball locked at plunger when ready');
})();

(function testShooterLaneRailHasNoMidGap() {
  var state = fresh();
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  state.ball.x = 400;
  state.ball.y = sim.LAUNCH_LANE_TOP + 30;
  state.ball.vx = 200;
  state.ball.vy = 0;
  sim.stepPhysics(state, 0.016);
  assert(state.ball.x + state.ball.radius < sim.LAUNCH_LANE_LEFT + 2, 'continuous rail blocks mid-lane intrusion');
  console.log('PASS: shooter lane rail has no mid gap');
})();

(function testLeftOutlaneDrainsViaPhysicsFall() {
  var state = fresh();
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  state.ball.x = 55;
  state.ball.y = sim.FLIPPER_ROW_Y + 20;
  state.ball.vx = 0;
  state.ball.vy = 0;
  for (var i = 0; i < 400; i++) {
    sim.tick(state, 0.016);
    if (!state.ball.inPlay) break;
  }
  assert.strictEqual(state.ballsRemaining, 2);
  assert.strictEqual(state.phase, 'ready');
  console.log('PASS: left outlane drains via physics fall to slot');
})();

(function testRightOutlaneFallsThroughDeckGap() {
  var state = fresh();
  state.ballsRemaining = 2;
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  var zones = sim.getDrainBounds(state);
  state.ball.x = (zones.rightOutlaneLeft + zones.rightOutlaneRight) / 2;
  state.ball.y = sim.FLIPPER_ROW_Y + 8;
  state.ball.vx = 0;
  state.ball.vy = 0;
  for (var i = 0; i < 400; i++) {
    sim.tick(state, 0.016);
    if (!state.ball.inPlay) break;
  }
  assert.strictEqual(state.ballsRemaining, 1);
  assert.strictEqual(state.phase, 'ready');
  console.log('PASS: right outlane falls through deck gap to drain slot');
})();

(function testFlipperBatUnsticksTowardDrain() {
  var state = fresh();
  state.ballsRemaining = 2;
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  var right = state.flippers.find(function (f) { return f.side === 'right'; });
  var tip = sim.flipperTip(right);
  state.ball.x = (right.pivotX + tip.x) / 2;
  state.ball.y = (right.pivotY + tip.y) / 2 - 6;
  state.ball.vx = 0;
  state.ball.vy = 0;
  var stuck = 0;
  for (var i = 0; i < 180; i++) {
    sim.tick(state, 0.016);
    if (!state.ball.inPlay) break;
    var speed = Math.sqrt(state.ball.vx * state.ball.vx + state.ball.vy * state.ball.vy);
    if (speed < 35 && state.ball.y > sim.FLIPPER_ROW_Y - 10) stuck++;
    else stuck = 0;
    assert(stuck < 25, 'flipper bat should not rest indefinitely');
  }
  assert(
    state.ballsRemaining === 1 || state.ball.y < sim.FLIPPER_ROW_Y - 20,
    'flipper bat unsticks into drain or playfield'
  );
  console.log('PASS: flipper bat unsticks toward drain');
})();

(function testBottomShooterApronUsesFlipperPhysics() {
  var state = fresh();
  state.ballsRemaining = 1;
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  state.ball.x = 405;
  state.ball.y = 740;
  state.ball.vx = 0;
  state.ball.vy = 40;
  sim.stepPhysics(state, 0.016);
  assert(
    state.ball.x + state.ball.radius < sim.LAUNCH_LANE_LEFT + 2,
    'ball in bottom shooter apron should be ejected onto playfield'
  );
  console.log('PASS: bottom shooter apron uses flipper physics');
})();

(function testBallCannotRestOnRightFlipperDuringPlay() {
  var state = fresh();
  state.ballsRemaining = 1;
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  state.phase = 'playing';
  state.ball.x = 300;
  state.ball.y = 728;
  state.ball.vx = 0;
  state.ball.vy = 0;
  var stuck = 0;
  for (var i = 0; i < 90; i++) {
    sim.tick(state, 0.016);
    if (!state.ball.inPlay) break;
    var speed = Math.sqrt(state.ball.vx * state.ball.vx + state.ball.vy * state.ball.vy);
    if (speed < 35 && state.ball.y > sim.FLIPPER_ROW_Y - 10) stuck++;
    else stuck = 0;
    assert(stuck < 20, 'ball should not rest on right flipper during play');
  }
  assert(!state.ball.inPlay || state.ball.x < sim.LAUNCH_LANE_LEFT - 10, 'play should not leave ball in shooter lane');
  console.log('PASS: ball cannot rest on right flipper during play');
})();

(function testThreeDrainZonesEachLoseBallViaTick() {
  var zones = sim.getDrainBounds(fresh());
  var positions = [
    { x: (zones.leftOutlaneLeft + zones.leftOutlaneRight) / 2, label: 'left outlane' },
    { x: (zones.centerLeft + zones.centerRight) / 2, label: 'center' },
    { x: (zones.rightOutlaneLeft + zones.rightOutlaneRight) / 2, label: 'right outlane' }
  ];
  positions.forEach(function (pos) {
    var state = fresh();
    state.ball.inPlay = true;
    state.exitedLaunchLane = true;
    state.ball.x = pos.x;
    state.ball.y = sim.FLIPPER_ROW_Y + 16;
    state.ball.vx = 0;
    state.ball.vy = 0;
    for (var i = 0; i < 500; i++) {
      sim.tick(state, 0.016);
      if (!state.ball.inPlay) break;
    }
    assert.strictEqual(state.ballsRemaining, 2, pos.label + ' should drain via tick');
    assert.strictEqual(state.ball.inPlay, false);
  });
  console.log('PASS: three drain zones each lose ball via tick');
})();

(function testCenterDrainWithDownwardVelocityAndDrift() {
  var zones = sim.getDrainBounds(fresh());
  var cases = [
    { vx: 0, vy: 80 },
    { vx: 120, vy: 80 },
    { vx: 200, vy: 80 }
  ];
  cases.forEach(function (c, idx) {
    var state = fresh();
    state.ball.inPlay = true;
    state.exitedLaunchLane = true;
    state.ball.x = (zones.centerLeft + zones.centerRight) / 2;
    state.ball.y = sim.FLIPPER_ROW_Y + 16;
    state.ball.vx = c.vx;
    state.ball.vy = c.vy;
    var escaped = false;
    for (var i = 0; i < 600; i++) {
      sim.tick(state, 0.016);
      if (!state.ball.inPlay) break;
      if (state.ball.y > sim.TABLE_H + 200) {
        escaped = true;
        break;
      }
    }
    assert(!escaped, 'case ' + idx + ' should not escape table without draining');
    assert.strictEqual(state.ballsRemaining, 2, 'case ' + idx + ' should drain');
  });
  console.log('PASS: center drain with downward velocity and drift');
})();

(function testBallCannotEscapeBelowTableWithoutDrain() {
  var state = fresh();
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  state.ball.x = 191;
  state.ball.y = sim.FLIPPER_ROW_Y + 16;
  state.ball.vx = 0;
  state.ball.vy = 80;
  for (var i = 0; i < 600; i++) {
    sim.tick(state, 0.016);
    if (!state.ball.inPlay) break;
    assert(state.ball.y < sim.TABLE_H + 100, 'ball should not fly far below table');
  }
  assert.strictEqual(state.ballsRemaining, 2);
  console.log('PASS: ball cannot escape below table without drain');
})();

(function testDrainSlotYMatchesVisualSlot() {
  assert.strictEqual(sim.DRAIN_SLOT_TOP, sim.TABLE_H - 14);
  assert.strictEqual(sim.DRAIN_Y, sim.DRAIN_SLOT_TOP - sim.BALL_RADIUS);
  console.log('PASS: drain slot Y matches visual slot');
})();

(function testRolloverDoesNotSpamScore() {
  var state = fresh();
  var lane = state.rollovers[0];
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  state.ball.x = lane.x1;
  state.ball.y = (lane.y1 + lane.y2) / 2;
  state.ball.vx = 0;
  state.ball.vy = 0;
  sim.stepPhysics(state, 0.016);
  var scoreAfterOne = state.score;
  for (var i = 0; i < 29; i++) {
    state.ball.x = lane.x1;
    state.ball.y = (lane.y1 + lane.y2) / 2;
    sim.stepPhysics(state, 0.016);
  }
  assert.strictEqual(state.score, scoreAfterOne, 'rollover should award once per entry');
  console.log('PASS: rollover does not spam score');
})();

(function testSpinnerDoesNotSpamScore() {
  var state = fresh();
  var sp = state.spinner;
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  state.ball.x = sp.x + sp.radius - 2;
  state.ball.y = sp.y;
  state.ball.vx = 10;
  state.ball.vy = 0;
  sim.stepPhysics(state, 0.016);
  var scoreAfterOne = state.score;
  for (var i = 0; i < 39; i++) {
    sim.stepPhysics(state, 0.016);
  }
  assert(scoreAfterOne === 0 || state.score - scoreAfterOne < 600, 'spinner cooldown limits repeat awards');
  console.log('PASS: spinner does not spam score');
})();

(function testBallProgressResetsOnDrain() {
  var state = fresh();
  state.targets.forEach(function (t) { t.lit = true; });
  state.rollovers.forEach(function (r) { r.lit = true; });
  state.jackpotLit = true;
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  var zones = sim.getDrainBounds(state);
  state.ball.x = (zones.centerLeft + zones.centerRight) / 2;
  state.ball.y = sim.FLIPPER_ROW_Y + 20;
  for (var i = 0; i < 500; i++) {
    sim.tick(state, 0.016);
    if (!state.ball.inPlay) break;
  }
  assert.strictEqual(state.phase, 'ready');
  assert.strictEqual(state.targets[2].lit, false);
  assert.strictEqual(state.rollovers[0].lit, false);
  assert.strictEqual(state.jackpotLit, false);
  console.log('PASS: ball progress resets on drain');
})();

(function testSlingshotHitAwardsScore() {
  var state = fresh();
  var sling = state.slingshots[0];
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  state.ball.x = (sling.x1 + sling.x2) / 2;
  state.ball.y = (sling.y1 + sling.y2) / 2 - 8;
  state.ball.vx = 0;
  state.ball.vy = 120;
  var before = state.score;
  sim.stepPhysics(state, 0.016);
  assert(state.score > before, 'slingshot hit should award score');
  assert.strictEqual(state.lastHitType, 'sling');
  console.log('PASS: slingshot hit awards score');
})();

(function testComboMultiplierIncreasesScore() {
  var state = fresh();
  sim.awardScore(state, 100, 'bumper', '0', 240, 220);
  var first = state.score;
  sim.awardScore(state, 100, 'bumper', '0', 240, 220);
  assert(state.score > first * 1.5, 'combo should boost second hit score');
  assert(state.comboCount >= 2);
  console.log('PASS: combo multiplier increases score');
})();

(function testTargetHitLightsAndScores() {
  var state = fresh();
  var target = state.targets[2];
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  state.ball.x = target.x;
  state.ball.y = target.y - target.h;
  state.ball.vx = 0;
  state.ball.vy = 200;
  var before = state.score;
  sim.stepPhysics(state, 0.016);
  assert(state.score > before, 'target hit should score');
  assert.strictEqual(target.lit, true);
  console.log('PASS: target hit lights and scores');
})();

(function testTickIntegratesPhysicsAndDrain() {
  var state = fresh();
  sim.launchBall(state, 600);
  var startY = state.ball.y;
  var startVy = state.ball.vy;
  sim.tick(state, 0.032);
  assert.notStrictEqual(state.ball.y, startY, 'tick should move ball vertically');
  assert.notStrictEqual(state.ball.vy, startVy, 'tick should update velocity via gravity');
  console.log('PASS: tick integrates physics pipeline');
})();

console.log('=============================');
console.log('All tests passed.');