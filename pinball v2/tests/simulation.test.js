'use strict';

var assert = require('assert');
var sim = require('../simulation.js');

function fresh() {
  return sim.createInitialState();
}

/** Advance end-of-ball bonus sequence to plunger / game over. */
function flushEob(state) {
  var guard = 0;
  while (state.phase === 'eob_bonus' && guard++ < 80) {
    sim.tick(state, 0.05);
  }
}

console.log('Pinball simulation unit tests');

(function testDoubleTapIgnoredWhileGlowing() {
  var state = fresh();
  var left = state.flippers.find(function (f) { return f.side === 'left'; });
  sim.activateFlipper(state, 'left', true);
  sim.stepPhysics(state, 0.05);
  sim.activateFlipper(state, 'left', false);
  sim.stepPhysics(state, 0.08);
  sim.activateFlipper(state, 'left', true);
  sim.stepPhysics(state, 0.016);
  assert(left.chargeLeft > 14, 'first double-tap charges');
  var leftAfter = left.chargeLeft;
  sim.activateFlipper(state, 'left', false);
  sim.stepPhysics(state, 0.5);
  var mid = left.chargeLeft;
  assert(mid > 0 && mid < leftAfter, 'charge is ticking');
  sim.activateFlipper(state, 'left', true);
  sim.stepPhysics(state, 0.05);
  sim.activateFlipper(state, 'left', false);
  sim.stepPhysics(state, 0.08);
  sim.activateFlipper(state, 'left', true);
  sim.stepPhysics(state, 0.016);
  assert(left.chargeLeft < mid - 0.02, 'double-tap while glowing must not reset (mid=' + mid.toFixed(2) + ' now=' + left.chargeLeft.toFixed(2) + ')');
  assert(left.chargeLeft > mid - 0.4, 'charge should still be the same glow, not a new 15s');
  console.log('PASS: double-tap ignored while glowing (charge=' + left.chargeLeft.toFixed(2) + ')');
})();

console.log('=============================');

(function testGravityUpdatesPositionAndVelocity() {
  var state = fresh();
  state.ball.inPlay = true;
  state.ball.x = 240;
  // Clear of mid toys / feeder (240,455) / posts — pace fixture (was 240,400)
  state.ball.y = 520;
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

/**
 * Drop a ball onto the left flipper at fraction along the bat while the bat
 * is mid-sweep toward active. Returns post-collision speed.
 */
function slapSpeedAtFraction(frac) {
  var state = fresh();
  var flipper = state.flippers.find(function (f) { return f.side === 'left'; });
  flipper.active = true;
  // Mid-stroke: halfway from rest toward active so omega stays large.
  flipper.angle = flipper.restAngle + (flipper.activeAngle - flipper.restAngle) * 0.45;
  flipper.omega = -sim.FLIPPER_SPEED; // left bat rises with negative omega
  var ux = Math.cos(flipper.angle);
  var uy = Math.sin(flipper.angle);
  var t = flipper.length * frac;
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  state.ball.x = flipper.pivotX + ux * t;
  state.ball.y = flipper.pivotY + uy * t - (state.ball.radius + flipper.width * 0.5) + 2;
  state.ball.vx = 0;
  state.ball.vy = 180;
  sim.stepPhysics(state, 0.016);
  return Math.sqrt(state.ball.vx * state.ball.vx + state.ball.vy * state.ball.vy);
}

(function testFlipperTipStrongerThanBase() {
  var tipSpeed = slapSpeedAtFraction(0.92);
  var baseSpeed = slapSpeedAtFraction(0.22);
  assert(tipSpeed > baseSpeed * 1.25, 'tip slap should outrun base slap (' + tipSpeed.toFixed(1) + ' vs ' + baseSpeed.toFixed(1) + ')');
  console.log('PASS: flipper tip stronger than base (tip=' + tipSpeed.toFixed(1) + ' base=' + baseSpeed.toFixed(1) + ')');
})();

(function testFlipperSweepStrongerThanDeadHold() {
  // Sweeping mid-stroke tip contact
  var sweepSpeed = slapSpeedAtFraction(0.9);

  // Dead-hold at apex: omega ~0, active=true — restitution only, no powered boost
  var state = fresh();
  var flipper = state.flippers.find(function (f) { return f.side === 'left'; });
  flipper.active = true;
  flipper.angle = flipper.activeAngle;
  flipper.omega = 0;
  var tip = sim.flipperTip(flipper);
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  state.ball.x = tip.x;
  state.ball.y = tip.y - (state.ball.radius + flipper.width * 0.5) + 2;
  state.ball.vx = 0;
  state.ball.vy = 180;
  sim.stepPhysics(state, 0.016);
  var holdSpeed = Math.sqrt(state.ball.vx * state.ball.vx + state.ball.vy * state.ball.vy);

  assert(sweepSpeed > holdSpeed * 1.35, 'rising stroke should beat dead-hold (' + sweepSpeed.toFixed(1) + ' vs ' + holdSpeed.toFixed(1) + ')');
  assert(holdSpeed < 450, 'dead-hold must not magnetically boost, got ' + holdSpeed.toFixed(1));
  console.log('PASS: flipper sweep stronger than dead-hold (sweep=' + sweepSpeed.toFixed(1) + ' hold=' + holdSpeed.toFixed(1) + ')');
})();

(function testLaunchMeterEaseKeepsFullPower() {
  var full = sim.meterToLaunchPower(1);
  assert.strictEqual(full, sim.MAX_LAUNCH_POWER, 'full meter still maps to MAX_LAUNCH_POWER');
  var mid = sim.meterToLaunchPower(0.5);
  var linearMid = sim.MIN_LAUNCH_POWER + 0.5 * (sim.MAX_LAUNCH_POWER - sim.MIN_LAUNCH_POWER);
  assert(mid < linearMid, 'eased mid-charge should be softer than linear');
  console.log('PASS: launch meter ease keeps full power');
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
  assert(tipGap > 45 && tipGap < 90, 'flipper tips leave a fair, playable center gap');
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
  state.ball.x = saver.x - 28;
  state.ball.y = saver.y + 8;
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
  flushEob(state);
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
  // Deep past flippers in former inlane dead-zone must still drain cleanly
  state = fresh();
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  state.ballSaveArmed = false;
  state.ball.x = zones.leftOutlaneRight + 20;
  state.ball.y = sim.DRAIN_Y + sim.BALL_RADIUS + 2;
  var before = state.ballsRemaining;
  sim.checkDrain(state);
  assert.strictEqual(state.ballsRemaining, before - 1, 'deep apron past flippers should drain');
  console.log('PASS: drain uses center hole and outlanes');
})();

(function testSpinnerInOpenFieldBelowU() {
  var state = fresh();
  var sp = state.spinner;
  assert(sp.x >= 185 && sp.x <= 215, 'spinner x in open field below U, got ' + sp.x);
  assert(sp.y >= 195 && sp.y <= 230, 'spinner y below lifted channel, got ' + sp.y);
  assert(sp.x <= 220, 'spinner clear of apex bumper x');
  console.log('PASS: spinner in open field below U');
})();

(function testSpinnerCoastsAngleAfterHit() {
  var state = fresh();
  var sp = state.spinner;
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  state.ball.x = sp.x + sp.radius - 1;
  state.ball.y = sp.y;
  state.ball.vx = 320;
  state.ball.vy = -40;
  sim.stepPhysics(state, 0.016);
  var angleAfterHit = sp.angle;
  var velAfterHit = sp.spinVel;
  assert(velAfterHit > 0.2, 'hit should impart spinVel, got ' + velAfterHit);
  state.ball.x = sp.x + 80;
  state.ball.y = sp.y + 80;
  state.ball.vx = 10;
  state.ball.vy = 10;
  for (var i = 0; i < 12; i++) sim.stepPhysics(state, 0.016);
  assert(Math.abs(sp.angle - angleAfterHit) > 0.15, 'spinner angle should keep changing while coasting');
  console.log('PASS: spinner coasts/rotates after hit');
})();

(function testBallSaveKicksOnceThenDrainSticks() {
  var state = fresh();
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  state.ballSaveArmed = true;
  state.ballSaveUsed = false;
  state.ballSaveTimer = sim.BALL_SAVE_DURATION;
  var zones = sim.getDrainBounds(state);
  state.ball.x = (zones.centerLeft + zones.centerRight) / 2;
  state.ball.y = sim.DRAIN_Y + sim.BALL_RADIUS + 2;
  var balls = state.ballsRemaining;
  sim.checkDrain(state);
  assert.strictEqual(state.ball.inPlay, true, 'ball-save keeps ball in play');
  assert.strictEqual(state.ballSaveUsed, true);
  assert.strictEqual(state.ballSaveArmed, false);
  assert.strictEqual(state.ballSaveTimer, 0, 'save consumes timer');
  assert(state.ball.y < sim.FLIPPER_ROW_Y, 'save respawns above flippers');
  assert.strictEqual(state.ballsRemaining, balls);
  state.ball.x = (zones.centerLeft + zones.centerRight) / 2;
  state.ball.y = sim.DRAIN_Y + sim.BALL_RADIUS + 2;
  state.ball.vy = 100;
  sim.checkDrain(state);
  assert.strictEqual(state.ball.inPlay, false);
  assert.strictEqual(state.ballsRemaining, balls - 1);
  console.log('PASS: ball-save once then drain sticks');
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
  assert.strictEqual(state.drainEvents, 1);
  flushEob(state);
  assert.strictEqual(state.phase, 'ready');
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
  flushEob(state);
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
  flushEob(state);
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
  flushEob(state);
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
    state.ballsRemaining === 1 ||
      state.phase === 'eob_bonus' ||
      state.ball.y < sim.FLIPPER_ROW_Y - 20 ||
      state.ball.y > sim.FLIPPER_ROW_Y + 15,
    'flipper bat unsticks into drain or playfield'
  );
  console.log('PASS: flipper bat unsticks toward drain');
})();
(function testTipCrawlFallsThroughCenterGap() {
  var state = fresh();
  state.ballsRemaining = 2;
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  state.phase = 'playing';
  state.ballSaveTimer = 0;
  var left = state.flippers.find(function (f) { return f.side === 'left'; });
  var tip = sim.flipperTip(left);
  // Parked on left tip — must fall into center hole, not loft forever
  state.ball.x = tip.x;
  state.ball.y = tip.y - state.ball.radius - 2;
  state.ball.vx = 0;
  state.ball.vy = 10;
  var minY = state.ball.y;
  var lofted = false;
  for (var i = 0; i < 240; i++) {
    sim.tick(state, 1 / 60);
    if (state.ball && state.ball.inPlay) {
      minY = Math.min(minY, state.ball.y);
      if (i > 10 && state.ball.y < sim.FLIPPER_ROW_Y - 40) lofted = true;
    }
    if (!state.ball.inPlay || state.ballsRemaining < 2 || state.phase === 'eob_bonus') break;
  }
  assert(!lofted, 'tip crawl must not loft back above flippers');
  assert(
    state.ballsRemaining === 1 || state.phase === 'eob_bonus' || !state.ball.inPlay,
    'tip crawl should drain through center gap'
  );
  console.log('PASS: tip crawl falls through center gap (minY=' + minY.toFixed(1) + ')');
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
  var spinnerHits = 0;
  var prevType = state.lastHitType;
  var prevScore = state.score;
  for (var i = 0; i < 40; i++) {
    sim.stepPhysics(state, 0.016);
    if (state.lastHitType === 'spinner' && (state.score !== prevScore || state.lastHitType !== prevType)) {
      // Count when a spinner award just applied
      if (state.lastHitType === 'spinner' && state.score > prevScore) spinnerHits++;
    }
    // More reliable: count via cooldown arming edges
    prevType = state.lastHitType;
    prevScore = state.score;
  }
  // Re-run focused: cooldown should keep spinVel awards from stacking every frame
  state = fresh();
  sp = state.spinner;
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  state.ball.x = sp.x + sp.radius - 2;
  state.ball.y = sp.y;
  state.ball.vx = 40;
  state.ball.vy = 0;
  var awards = 0;
  for (var j = 0; j < 40; j++) {
    var before = state.score;
    var cdBefore = sp.hitCooldown;
    sim.stepPhysics(state, 0.016);
    if (state.score > before && state.lastHitType === 'spinner') awards++;
    // Keep ball pressed on spinner so only cooldown gates repeats
    state.ball.x = sp.x + sp.radius - 2;
    state.ball.y = sp.y;
    state.ball.vx = 40;
    state.ball.vy = 0;
    void cdBefore;
  }
  assert(awards <= 3, 'spinner cooldown limits repeat awards, got ' + awards);
  console.log('PASS: spinner does not spam score');
})();

(function testBallProgressResetsOnDrain() {
  var state = fresh();
  state.bumpers.forEach(function (b) { if (!b.saver) b.hit = true; });
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
  flushEob(state);
  assert.strictEqual(state.phase, 'ready');
  assert(state.bumpers.filter(function (b) { return !b.saver; }).every(function (b) { return !b.hit; }), 'scoring bumper hits reset');
  assert.strictEqual(state.rollovers[0].lit, false);
  assert.strictEqual(state.jackpotLit, false);
  console.log('PASS: ball progress resets on drain');
})();

(function testSlingshotHitAwardsScore() {
  var state = fresh();
  var sling = state.slingshots[0];
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  state.ball.x = sling.x2;
  state.ball.y = sling.y2 - 10;
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

(function testScoringBumperHitFlags() {
  var state = fresh();
  var bumper = state.bumpers[0];
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  state.ball.x = bumper.x;
  state.ball.y = bumper.y - bumper.radius - state.ball.radius + 2;
  state.ball.vx = 0;
  state.ball.vy = 200;
  var before = state.score;
  sim.stepPhysics(state, 0.016);
  assert(state.score > before, 'scoring bumper hit should score');
  assert.strictEqual(bumper.hit, true);
  console.log('PASS: scoring bumper hit flags and scores');
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


(function testDrainDisarmedNeverLoftsAboveFlippers() {
  var zones = sim.getDrainBounds(fresh());
  var cases = [
    { x: (zones.centerLeft + zones.centerRight) / 2, y: sim.FLIPPER_ROW_Y + 16, vx: 0, vy: 80, label: 'center' },
    { x: (zones.leftOutlaneLeft + zones.leftOutlaneRight) / 2, y: sim.FLIPPER_ROW_Y + 16, vx: 0, vy: 80, label: 'left' },
    { x: (zones.rightOutlaneLeft + zones.rightOutlaneRight) / 2, y: sim.FLIPPER_ROW_Y + 16, vx: 10, vy: 80, label: 'right' },
    { x: 385, y: sim.FLIPPER_ROW_Y + 5, vx: 10, vy: 80, label: 'near-lane' }
  ];
  cases.forEach(function (c) {
    var state = fresh();
    state.ball.inPlay = true;
    state.exitedLaunchLane = true;
    state.phase = 'playing';
    state.ballSaveArmed = false;
    state.ballSaveUsed = false;
    state.ballSaveTimer = 0;
    state.ball.x = c.x;
    state.ball.y = c.y;
    state.ball.vx = c.vx;
    state.ball.vy = c.vy;
    var minY = state.ball.y;
    var drainedAt = -1;
    var i;
    for (i = 0; i < 120; i++) {
      sim.tick(state, 0.016);
      minY = Math.min(minY, state.ball.y);
      if (!state.ball.inPlay) {
        drainedAt = i;
        break;
      }
    }
    assert(drainedAt >= 0, c.label + ' should drain with save disarmed');
    assert(
      minY >= sim.FLIPPER_ROW_Y - 8,
      c.label + ' must not reappear above flippers (minY=' + minY.toFixed(1) + ')'
    );
    assert.strictEqual(state.lastHitType === 'ballsave', false, c.label + ' no ballsave hit');
  });
  console.log('PASS: drain with save disarmed never lofts above flippers');
})();

(function testNearSkillShotDoesNotArmBallSave() {
  var state = fresh();
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  state.skillShotWindow = true;
  var top = state.bumpers[0];
  var touch = top.radius + state.ball.radius;
  var g = sim.gradeSkillShot(
    { x: top.x + touch + 18, y: top.y, radius: state.ball.radius },
    top
  );
  assert(g && g.grade === 'near', 'near grade');
  sim.applySkillShot(state, g);
  assert.strictEqual(state.ballSaveArmed, false, 'near skill shot must not arm save');
  assert.strictEqual(state.ballSaveTimer, 0, 'near leaves timer at 0');
  console.log('PASS: near skill shot does not arm ball-save');
})();

(function testCenterSkillShotArmsTimedSaveThenExpires() {
  var state = fresh();
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  state.skillShotWindow = true;
  var top = state.bumpers[0];
  var g = sim.gradeSkillShot(
    { x: top.x, y: top.y, radius: state.ball.radius },
    top
  );
  assert(g && g.grade === 'center', 'center grade');
  sim.applySkillShot(state, g);
  assert.strictEqual(state.ballSaveArmed, true);
  assert.strictEqual(state.ballSaveTimer, sim.BALL_SAVE_DURATION);
  // Expire without draining
  var steps = Math.ceil(sim.BALL_SAVE_DURATION / 0.05) + 2;
  var i;
  for (i = 0; i < steps; i++) sim.tick(state, 0.05);
  assert.strictEqual(state.ballSaveArmed, false, 'save expires after timer');
  assert.strictEqual(state.ballSaveTimer, 0);
  // Drain must stick (no teleport)
  var zones = sim.getDrainBounds(state);
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  state.phase = 'playing';
  state.ball.x = (zones.centerLeft + zones.centerRight) / 2;
  state.ball.y = sim.DRAIN_Y + 2;
  state.ball.vy = 100;
  var balls = state.ballsRemaining;
  var yBefore = state.ball.y;
  sim.checkDrain(state);
  assert.strictEqual(state.ball.inPlay, false, 'expired save does not fire');
  assert.strictEqual(state.ballsRemaining, balls - 1);
  assert(state.ball.y >= yBefore || state.ball.y > sim.TABLE_H, 'no apron teleport after expiry');
  console.log('PASS: center skill shot arms timed save then expires');
})();

(function testArmedSaveExactlyOneKickThenDrainSticksViaTick() {
  var state = fresh();
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  state.phase = 'playing';
  state.ballSaveArmed = true;
  state.ballSaveUsed = false;
  state.ballSaveTimer = sim.BALL_SAVE_DURATION;
  var zones = sim.getDrainBounds(state);
  state.ball.x = (zones.centerLeft + zones.centerRight) / 2;
  state.ball.y = sim.FLIPPER_ROW_Y + 20;
  state.ball.vx = 0;
  state.ball.vy = 100;
  var sawSave = false;
  var saveY = null;
  var i;
  for (i = 0; i < 200; i++) {
    sim.tick(state, 0.016);
    if (state.lastHitType === 'ballsave' || state.ballSaveUsed) {
      sawSave = true;
      saveY = state.ball.y;
      break;
    }
    if (!state.ball.inPlay) break;
  }
  assert(sawSave, 'armed save should fire once');
  assert(saveY < sim.FLIPPER_ROW_Y, 'save kick places ball above flippers');
  assert.strictEqual(state.ballSaveArmed, false);
  // Second drain via physics must stick — no second loft above flippers from save
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  state.phase = 'playing';
  state.ball.x = (zones.centerLeft + zones.centerRight) / 2;
  state.ball.y = sim.FLIPPER_ROW_Y + 20;
  state.ball.vx = 0;
  state.ball.vy = 100;
  var balls = state.ballsRemaining;
  var minY = state.ball.y;
  var drainedAt = -1;
  for (i = 0; i < 160; i++) {
    sim.tick(state, 0.016);
    minY = Math.min(minY, state.ball.y);
    if (!state.ball.inPlay) {
      drainedAt = i;
      break;
    }
  }
  assert(drainedAt >= 0, 'second drain should stick');
  assert.strictEqual(state.ballsRemaining, balls - 1);
  assert(minY >= sim.FLIPPER_ROW_Y - 8, 'no second save loft (minY=' + minY.toFixed(1) + ')');
  console.log('PASS: armed save exactly one kick then drain sticks via tick');
})();

(function testTapFlipperHitsHarderThanHold() {
  function slap(tap) {
    var state = fresh();
    var flipper = state.flippers.find(function (f) { return f.side === 'left'; });
    flipper.active = true;
    flipper.tapBoost = !!tap;
    flipper.chargeLeft = tap ? 15 : 0;
    flipper.angle = flipper.restAngle + (flipper.activeAngle - flipper.restAngle) * 0.45;
    flipper.omega = -sim.FLIPPER_SPEED;
    var ux = Math.cos(flipper.angle);
    var uy = Math.sin(flipper.angle);
    var t = flipper.length * 0.9;
    state.ball.inPlay = true;
    state.exitedLaunchLane = true;
    state.ball.x = flipper.pivotX + ux * t;
    state.ball.y = flipper.pivotY + uy * t - (state.ball.radius + flipper.width * 0.5) + 2;
    state.ball.vx = 0;
    state.ball.vy = 180;
    sim.stepPhysics(state, 0.016);
    return Math.sqrt(state.ball.vx * state.ball.vx + state.ball.vy * state.ball.vy);
  }
  var hold = slap(false);
  var tap = slap(true);
  assert(tap > hold * 1.35, 'tap slap should be much harder than hold (tap=' + tap.toFixed(1) + ' hold=' + hold.toFixed(1) + ')');
  console.log('PASS: tap flipper hits harder than hold (tap=' + tap.toFixed(1) + ' hold=' + hold.toFixed(1) + ')');
})();

(function testDoubleTapChargesFifteenSeconds() {
  var state = fresh();
  var left = state.flippers.find(function (f) { return f.side === 'left'; });
  sim.activateFlipper(state, 'left', true);
  sim.stepPhysics(state, 0.016);
  assert(!left.chargeLeft, 'single tap does not charge');
  sim.activateFlipper(state, 'left', false);
  sim.stepPhysics(state, 0.08);
  sim.activateFlipper(state, 'left', true);
  sim.stepPhysics(state, 0.016);
  assert(left.chargeLeft > 14.5, 'double-tap should charge ~15s (got ' + left.chargeLeft + ')');
  assert(left.tapBoost, 'charged bat is 2x');
  var phaseEarly = left.glowPhase;
  var steps = Math.ceil(14.7 / 0.05);
  for (var i = 0; i < steps; i++) sim.stepPhysics(state, 0.05);
  assert(left.chargeLeft > 0 && left.chargeLeft < 1.2, 'charge should be nearly spent (got ' + left.chargeLeft + ')');
  assert(left.glowPhase > phaseEarly, 'glow phase should advance');
  for (var j = 0; j < 30; j++) sim.stepPhysics(state, 0.05);
  assert(!(left.chargeLeft > 0), 'charge ends after 15s');
  assert(!left.tapBoost, '2x ends when charge ends');
  console.log('PASS: double-tap charges 15s then expires');
})();



(function testLeftCaptiveClearOfMouth() {
  var state = fresh();
  var cap = state.sideRoutes.leftCaptive;
  var e = state.sideRoutes.leftRamp.entry;
  var hw = (e.w || 30) * 0.5;
  var hh = (e.h || 36) * 0.5;
  var overlap =
    cap.x + cap.radius > e.x - hw &&
    cap.x - cap.radius < e.x + hw &&
    cap.y + cap.radius > e.y - hh &&
    cap.y - cap.radius < e.y + hh;
  assert(!overlap, "left captive must not sit inside the cyan mouth sensor");
  assert(e.h <= 32, "entry sensor must hug the visual mouth, not a fat box above it");
  assert(e.y >= 330 && e.y <= 345, "left entry center stays at the mouth");
  console.log("PASS: left captive clear of mouth (cap=" + cap.x + "," + cap.y + " r=" + cap.radius + ")");
})();

(function testHabitrailEntryKeepsOwnMomentum() {
  var state = fresh();
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  state.ball.x = 80;
  state.ball.y = 337;
  state.ball.vx = 12;
  state.ball.vy = -280;
  var vx0 = state.ball.vx;
  sim.stepPhysics(state, 1 / 60);
  assert(Math.abs(state.ball.vx - vx0) < 80, "entry must not snap vx toward a via (vx=" + state.ball.vx.toFixed(1) + ")");
  assert(state.ball.vy < -80, "entry must not replace climb with a constant-speed rail");
  console.log("PASS: habitrail entry keeps momentum (vx=" + state.ball.vx.toFixed(1) + " vy=" + state.ball.vy.toFixed(1) + ")");
})();

(function testTopArchFloorAboveHorseshoeChannel() {
  var floor = sim.topArchFloorY(240);
  assert(floor < 32, 'arch underside must sit above U outer y=32, got ' + floor);
  assert(floor > 20 && floor < 30, 'arch floor should match lifted ellipse cy=76 ry=50, got ' + floor);
  console.log('PASS: top arch floor above horseshoe channel (floor=' + floor.toFixed(1) + ')');
})();

function placeInLeftMouth(state, speed) {
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  state.phase = 'playing';
  state.ball.x = 80;
  state.ball.y = 310;
  state.ball.vx = -40;
  state.ball.vy = -speed;
  state.activeHabitrail = 'ramp-l';
}

function placeInRightMouth(state, speed) {
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  state.phase = 'playing';
  state.ball.x = 362;
  state.ball.y = 240;
  state.ball.vx = 25;
  state.ball.vy = -speed;
  state.activeHabitrail = 'ramp-r';
}

function runOrbit(place, dirLabel, speed) {
  var state = fresh();
  place(state, speed || 920);
  var crossedApex = false;
  var farSide = false;
  var droppedThrough = false;
  var minYAtApex = 999;
  var i;
  for (i = 0; i < 240; i++) {
    sim.stepPhysics(state, 1 / 60);
    var b = state.ball;
    if (b.x > 200 && b.x < 280 && b.y < 100) {
      crossedApex = true;
      minYAtApex = Math.min(minYAtApex, b.y);
      if (b.y > 95 && Math.abs(b.vx) < 30) droppedThrough = true;
    }
    if (dirLabel === 'LTR' && b.x > 320 && b.y < 160) farSide = true;
    if (dirLabel === 'RTL' && b.x < 120 && b.y < 160) farSide = true;
    if (farSide) break;
  }
  return { crossedApex: crossedApex, farSide: farSide, droppedThrough: droppedThrough, minYAtApex: minYAtApex, x: state.ball.x, y: state.ball.y, vx: state.ball.vx };
}

(function testHorseshoeOrbitBothWays() {
  var ltr = runOrbit(placeInLeftMouth, 'LTR', 980);
  assert(ltr.crossedApex, 'LTR should crest the U (x=' + ltr.x.toFixed(1) + ' y=' + ltr.y.toFixed(1) + ')');
  assert(ltr.farSide, 'LTR should reach the right channel, not drop at the apex');
  assert(!ltr.droppedThrough, 'LTR must not kill vx and fall through the top');
  var rtl = runOrbit(placeInRightMouth, 'RTL', 980);
  assert(rtl.crossedApex, 'RTL should crest the U');
  assert(rtl.farSide, 'RTL should reach the left channel, not drop at the apex');
  assert(!rtl.droppedThrough, 'RTL must not kill vx and fall through the top');
  console.log('PASS: horseshoe orbit LTR and RTL (LTR y=' + ltr.minYAtApex.toFixed(1) + ' RTL y=' + rtl.minYAtApex.toFixed(1) + ')');
})();

(function testRampShotKeepsMomentumNoSnap() {
  var state = fresh();
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  // Cyan 300 bumper — mid-field, must not magnetize onto the left rail.
  state.ball.x = 155;
  state.ball.y = 308;
  state.ball.vx = 90;
  state.ball.vy = -220;
  var x0 = state.ball.x;
  var i;
  for (i = 0; i < 8; i++) sim.stepPhysics(state, 1 / 60);
  assert(Math.abs(state.ball.x - x0) < 80, 'bumper shot must not snap across to a center rail (x=' + state.ball.x.toFixed(1) + ')');
  assert(!state.activeHabitrail, 'mid-field bumper shot must not become a habitrail rider');
  console.log('PASS: ramp capture does not steal bumper shots');
})();

(function testGravitySlowsUphillRamp() {
  var state = fresh();
  placeInLeftMouth(state, 620);
  var speed0 = Math.sqrt(state.ball.vx * state.ball.vx + state.ball.vy * state.ball.vy);
  var i;
  for (i = 0; i < 18; i++) sim.stepPhysics(state, 1 / 60);
  var speed1 = Math.sqrt(state.ball.vx * state.ball.vx + state.ball.vy * state.ball.vy);
  assert(state.ball.y < 310, 'ball should climb');
  assert(speed1 < speed0 - 20, 'uphill should lose speed (' + speed0.toFixed(1) + ' -> ' + speed1.toFixed(1) + ')');
  console.log('PASS: gravity slows uphill ramp (' + speed0.toFixed(1) + ' -> ' + speed1.toFixed(1) + ')');
})();

(function testParkedFlipperIsNotASling() {
  assert(sim.FLIPPER_RESTITUTION_PASSIVE < 0.7, 'parked bat rest must be inelastic');
  assert(sim.FLIPPER_RESTITUTION_SWEEP > 1, 'powered slap can stay strong');
  console.log('PASS: parked flipper rest=' + sim.FLIPPER_RESTITUTION_PASSIVE + ' sweep=' + sim.FLIPPER_RESTITUTION_SWEEP);
})();

(function testChargedPlungeEntersHorseshoe() {
  var state = fresh();
  sim.launchBall(state, 1400);
  var inChannel = false;
  var i;
  for (i = 0; i < 160; i++) {
    sim.tick(state, 1 / 60);
    if (state.exitedLaunchLane && state.ball.y < 90 && state.ball.x < 360 && state.ball.x > 140) {
      inChannel = true;
      break;
    }
  }
  assert(state.exitedLaunchLane, 'charged plunge should leave the lane');
  assert(inChannel || (state.ball.y < 130 && state.ball.x < 360), 'charged plunge should enter the U channel');
  console.log('PASS: charged plunge enters horseshoe (x=' + state.ball.x.toFixed(1) + ' y=' + state.ball.y.toFixed(1) + ')');
})();

console.log('=============================');

console.log('All tests passed.');
