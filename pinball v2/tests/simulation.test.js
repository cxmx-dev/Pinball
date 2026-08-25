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


(function testMergeOnRampDoesNotCrossShooterWell() {
  var state = fresh();
  var right = state.sideRoutes.rightRamp;
  var segs = (right.mergeOuter || []).concat(right.mergeInner || []);
  var i;
  for (i = 0; i < segs.length; i++) {
    var s = segs[i];
    var crosses =
      (s.x1 < sim.LAUNCH_LANE_LEFT + 2 && s.x2 < sim.LAUNCH_LANE_LEFT + 2 && s.y1 > 112 && s.y2 > 112);
    assert(!crosses, 'merge must not drop a wall down the shooter at x<392 y>112 (' + s.x1 + ',' + s.y1 + ')-(' + s.x2 + ',' + s.y2 + ')');
    var inWell =
      Math.min(s.x1, s.x2) < sim.LAUNCH_LANE_RIGHT &&
      Math.max(s.x1, s.x2) > sim.LAUNCH_LANE_LEFT &&
      Math.min(s.y1, s.y2) > 112;
    assert(!inWell, 'merge segment must not sit inside the shooter well below the join');
  }
  var walls = state.walls || [];
  var blocked = false;
  for (i = 0; i < walls.length; i++) {
    var w = walls[i];
    if (w.kind !== 'habitrail' && w.kind !== 'guide') continue;
    if (Math.min(w.y1, w.y2) > 112 &&
        Math.min(w.x1, w.x2) > sim.LAUNCH_LANE_LEFT - 2 &&
        Math.max(w.x1, w.x2) < sim.LAUNCH_LANE_RIGHT + 2) blocked = true;
  }
  assert(!blocked, 'no habitrail/guide wall may brick the shooter well');
  console.log('PASS: merge on-ramp stays above the shooter well');
})();

(function testCyanSlideNeverTeleportsToFarExit() {
  var state = fresh();
  placeInLeftMouth(state, 980);
  var prevX = state.ball.x;
  var prevY = state.ball.y;
  var apex = false;
  var teleported = false;
  var maxJump = 0;
  var i;
  for (i = 0; i < 240; i++) {
    sim.stepPhysics(state, 1 / 60);
    var b = state.ball;
    var jump = Math.sqrt((b.x - prevX) * (b.x - prevX) + (b.y - prevY) * (b.y - prevY));
    if (jump > maxJump) maxJump = jump;
    if (b.x > 200 && b.x < 280 && b.y < 100) apex = true;
    if (!apex && b.x > 300 && b.y < 180 && jump > 36) teleported = true;
    prevX = b.x;
    prevY = b.y;
    if (b.y > 500) break;
  }
  assert(!teleported, 'LTR must not jump to the right horseshoe before the apex');
  assert(maxJump < 40, 'cyan climb must not teleport (maxJump=' + maxJump.toFixed(1) + ')');
  console.log('PASS: cyan climb no far-side teleport (maxJump=' + maxJump.toFixed(1) + ' apex=' + apex + ')');
})();

(function testPlayfieldCyanTopDoesNotSnapToWire() {
  var state = fresh();
  state.ball.inPlay = true;
  state.exitedLaunchLane = false;
  state.activeLaunchPower = 1400;
  state.ball.x = 88;
  state.ball.y = 76;
  state.ball.vx = 40;
  state.ball.vy = -80;
  var i;
  for (i = 0; i < 8; i++) sim.stepPhysics(state, 1 / 60);
  assert(state.ball.x < 200, 'top-of-cyan ball must not snap onto the copper wire (x=' + state.ball.x.toFixed(1) + ')');
  console.log('PASS: playfield cyan top does not snap to wire (x=' + state.ball.x.toFixed(1) + ')');
})();

(function testMediumPlungeStillExitsAndChargedEntersU() {
  function run(power) {
    var state = fresh();
    sim.launchBall(state, power);
    var inU = false;
    var i;
    for (i = 0; i < 180; i++) {
      sim.tick(state, 1 / 60);
      if (state.exitedLaunchLane && state.ball.y < 90 && state.ball.x > 140 && state.ball.x < 360) inU = true;
      if (state.exitedLaunchLane && state.ball.y > 420) break;
      if (!state.ball.inPlay && i > 12) break;
    }
    return { ex: state.exitedLaunchLane, inU: inU, x: state.ball.x, y: state.ball.y, remaining: state.ballsRemaining };
  }
  var mid = run(600);
  assert(mid.ex, '600 plunge must still exit the launch lane');
  assert(mid.remaining === 3, '600 plunge must not drain in the shooter');
  var hot = run(1400);
  assert(hot.ex, '1400 plunge must leave the lane');
  assert(hot.inU, '1400 plunge must ride the merge into the U (x=' + hot.x.toFixed(1) + ' y=' + hot.y.toFixed(1) + ')');
  var med = run(800);
  assert(med.ex, '800 plunge must leave the lane');
  assert(med.inU, '800 plunge should ride the merge into the U');
  console.log('PASS: 600 exits; 800/1400 enter U');
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
  assert(state.ball.x < sim.LAUNCH_LANE_LEFT - 8, 'medium launch should leave the shooter (U merge or playfield)');
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

(function testOutlaneDashCorridorsStayOpen() {
  var state = fresh();
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  state.ball.x = sim.FLIPPER_INLANE_X - state.ball.radius - 6;
  state.ball.y = sim.FLIPPER_ROW_Y - 48;
  state.ball.vx = -40;
  state.ball.vy = 220;
  var x0 = state.ball.x;
  sim.stepPhysics(state, 0.016);
  assert(
    state.ball.x < sim.FLIPPER_INLANE_X,
    'left dash corridor must not ghost-kick out of the outlane (x=' + state.ball.x.toFixed(1) + ')'
  );
  assert(state.ball.x <= x0 + 4, 'left outlane must not teleport inward');
  console.log('PASS: left outlane dash corridor stays open');
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
  state.ball.x = 376;
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

(function testMergeInnerFloorIsContinuousChannel() {
  var state = fresh();
  var inner = state.sideRoutes.rightRamp.mergeInner || [];
  assert(inner.length >= 5, 'merge inner must be a real floor, not a stub');
  var minX = 999, maxX = 0, maxY = 0;
  var i;
  for (i = 0; i < inner.length; i++) {
    minX = Math.min(minX, inner[i].x1, inner[i].x2);
    maxX = Math.max(maxX, inner[i].x1, inner[i].x2);
    maxY = Math.max(maxY, inner[i].y1, inner[i].y2);
  }
  assert(maxX >= 390, 'merge inner must start at the shooter join');
  assert(minX <= 300, 'merge inner must reach the copper U floor');
  assert(maxY <= 112, 'merge inner must stay above the shooter well');
  var tagged = 0;
  for (i = 0; i < state.walls.length; i++) {
    if (state.walls[i].merge) tagged++;
  }
  assert(tagged >= 8, 'merge walls must be tagged so launch does not skip the floor');
  console.log('PASS: merge inner floor is a continuous channel (minX=' + minX + ' maxX=' + maxX + ')');
})();

(function testSaucerCatchesBall() {
  var state = fresh();
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  state.phase = 'playing';
  state.ball.x = state.saucer.x;
  state.ball.y = state.saucer.y;
  state.ball.vx = 30;
  state.ball.vy = 40;
  var i;
  for (i = 0; i < 8; i++) sim.tick(state, 1 / 60);
  assert(state.saucer.captured, 'saucer should catch a ball placed on it');
  assert(state.lockCount >= 1, 'first catch should lock');
  assert(state.saucer.lit, 'LOCK should light after first catch');
  for (i = 0; i < 90; i++) sim.tick(state, 1 / 60);
  assert(!state.saucer.captured, 'saucer should kick out after the hold');
  assert(state.ball.inPlay, 'kicked ball stays in play');
  console.log('PASS: saucer catches, locks, kicks out');
})();

(function testSaucerStartsTwoBallMultiball() {
  var state = fresh();
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  state.phase = 'playing';
  state.lockCount = 1;
  state.saucer.lit = true;
  state.ball.x = state.saucer.x;
  state.ball.y = state.saucer.y;
  state.ball.vx = 10;
  state.ball.vy = 20;
  var i;
  for (i = 0; i < 100; i++) sim.tick(state, 1 / 60);
  var extras = 0;
  if (state.balls) {
    for (i = 0; i < state.balls.length; i++) {
      if (state.balls[i] && state.balls[i].inPlay) extras++;
    }
  }
  var live = (state.ball && state.ball.inPlay ? 1 : 0);
  if (state.balls) {
    live = 0;
    for (i = 0; i < state.balls.length; i++) if (state.balls[i] && state.balls[i].inPlay) live++;
    if (state.ball && state.ball.inPlay && state.balls.indexOf(state.ball) < 0) live++;
  }
  assert(state.multiball || live >= 2, 'second saucer hit should start multiball');
  assert(live >= 2, 'two balls should be on the table (live=' + live + ')');
  console.log('PASS: saucer second lock starts two-ball MB (live=' + live + ')');
})();

(function testCircledGlowingPostsRemoved() {
  var state = fresh();
  assert(!state.posts || state.posts.length === 0, 'circled glowing posts removed');
  assert(state.saucer && state.saucer.x === 95 && state.saucer.y === 520, 'saucer/HOLE stays');
  console.log('PASS: circled posts gone, saucer kept');
})();

(function testGateSpinnerAwardsOnPass() {
  var state = fresh();
  var g = state.gateSpinner;
  assert(g, 'vertical gate spinner exists');
  assert(g.x >= 220 && g.x <= 260 && g.y >= 400 && g.y <= 430, 'gate sits at board center above the saver');
  assert(Math.abs(g.x - 240) < 8, 'gate is centered on the board');
  assert(state.spinner.x >= 185 && state.spinner.y >= 195, 'flat spinner stays in the open field');
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  state.phase = 'playing';
  state.ball.x = g.x - 8;
  state.ball.y = g.y;
  state.ball.vx = 220;
  state.ball.vy = 40;
  var score0 = state.score;
  var i;
  for (i = 0; i < 20; i++) sim.stepPhysics(state, 1 / 60);
  assert(state.score > score0, 'gate should award like the flat spinner');
  assert(Math.abs(g.spinVel) > 0 || Math.abs(g.angle) > 0, 'gate should spin');
  console.log('PASS: vertical gate awards and spins (score=' + (state.score - score0) + ')');
})();

(function testPlungeStaysInMergeTube() {
  function run(power) {
    var state = fresh();
    sim.launchBall(state, power);
    var fell = false;
    var inTube = false;
    var i;
    for (i = 0; i < 200; i++) {
      sim.tick(state, 1 / 60);
      var b = state.ball;
      if (b.x > 250 && b.x < 420 && b.y < 120) {
        inTube = true;
        if (b.y > 118) fell = true;
      }
      if (state.exitedLaunchLane && b.y > 400) break;
    }
    return { ex: state.exitedLaunchLane, inTube: inTube, fell: fell, x: state.ball.x, y: state.ball.y, remaining: state.ballsRemaining };
  }
  var a = run(600);
  assert(a.ex, '600 must exit the lane');
  assert(a.remaining === 3, '600 must not drain');
  var b = run(800);
  assert(b.inTube && !b.fell, '800 must stay in the merge tube');
  var c = run(1400);
  assert(c.inTube && !c.fell, '1400 must stay in the merge tube');
  console.log('PASS: plunge 600/800/1400 stay in merge (800 y=' + b.y.toFixed(1) + ' 1400 y=' + c.y.toFixed(1) + ')');
})();


(function testLeftHabitrailBounceOnDrawnChord() {
  var state = fresh();
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  state.phase = 'playing';
  // Left inner guide ~ (80,276)-(100,342). Fire left into the chord.
  state.ball.x = 104;
  state.ball.y = 300;
  state.ball.vx = -420;
  state.ball.vy = 20;
  var hit = false;
  var contactX = 0;
  var i;
  for (i = 0; i < 40; i++) {
    sim.stepPhysics(state, 1 / 60);
    if (state.ball.vx > 0) {
      hit = true;
      contactX = state.ball.x;
      break;
    }
  }
  assert(hit, 'ball must bounce off the left inner habitrail');
  // Chord at this height is ~x=86; bounce sits on the line + radius, not a ball-width inside.
  assert(contactX > 86 && contactX < 112, 'left bounce must sit on the drawn chord (x=' + contactX.toFixed(1) + ')');
  console.log('PASS: left habitrail bounce on drawn chord (x=' + contactX.toFixed(1) + ')');
})();

console.log('All tests passed.');

(function testUpperRightSaucerLocks() {
  var state = fresh();
  assert(state.saucer && state.saucer.x === 95 && state.saucer.y === 520, 'left saucer stays');
  assert(state.saucer2, 'upper-right saucer exists');
  assert(state.saucer2.x >= 310 && state.saucer2.x <= 350, 'UR saucer in the open pocket');
  assert(state.saucer2.y >= 130 && state.saucer2.y <= 190, 'UR saucer just below the copper ramp');
  assert(state.saucer2.x < sim.LAUNCH_LANE_LEFT - 20, 'UR saucer is not in the shooter');
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  state.phase = 'playing';
  state.ball.x = state.saucer2.x;
  state.ball.y = state.saucer2.y;
  state.ball.vx = 20;
  state.ball.vy = 20;
  var i;
  for (i = 0; i < 8; i++) sim.tick(state, 1 / 60);
  assert(state.saucer2.captured, 'UR saucer should catch');
  assert(state.lockCount >= 1, 'UR saucer should lock');
  assert(state.saucer.lit && state.saucer2.lit && state.saucer3.lit, 'all three holes light LOCK');
  console.log('PASS: upper-right saucer locks (' + state.saucer2.x + ',' + state.saucer2.y + ')');
})();

(function testLeftRampMouthCreditsLock() {
  var state = fresh();
  placeInLeftMouth(state, 980);
  state.ball.x = 80;
  state.ball.y = 337;
  state.ball.vx = -10;
  state.ball.vy = -360;
  state.activeHabitrail = null;
  var y0 = state.ball.y;
  var i;
  for (i = 0; i < 20; i++) sim.stepPhysics(state, 1 / 60);
  assert(state.lockCount >= 1, 'left ramp mouth should credit a lock');
  assert(state.saucer.lit, 'left ramp feeds the lock light');
  var dSaucer = Math.sqrt(
    (state.ball.x - state.saucer.x) * (state.ball.x - state.saucer.x) +
    (state.ball.y - state.saucer.y) * (state.ball.y - state.saucer.y)
  );
  assert(dSaucer > 40, 'left ramp lock must not teleport the ball to the saucer');
  assert(state.ball.y < y0 + 8, 'ball keeps rolling after lock credit (y=' + state.ball.y.toFixed(1) + ')');
  console.log('PASS: left ramp mouth credits lock without teleport (lock=' + state.lockCount + ' xy=' + state.ball.x.toFixed(1) + ',' + state.ball.y.toFixed(1) + ')');
})();

(function testFillersShiftedTowardRails() {
  var state = fresh();
  var lg = state.sideRoutes.leftRamp.guides;
  var rg = state.sideRoutes.rightRamp.guides;
  function xAtY(segs, y) {
    var i;
    for (i = 0; i < segs.length; i++) {
      var a = segs[i];
      var minY = Math.min(a.y1, a.y2);
      var maxY = Math.max(a.y1, a.y2);
      if (minY <= y && maxY >= y && maxY !== minY) {
        var t = (y - a.y1) / (a.y2 - a.y1);
        return a.x1 + (a.x2 - a.x1) * t;
      }
    }
    return null;
  }
  var leftX = xAtY(lg, 200);
  var rightX = xAtY(rg, 160);
  assert(leftX != null, 'left mid inner exists');
  assert(rightX != null, 'right mid inner exists');
  assert(leftX <= 66, 'left filler inner sits toward x=36 (got ' + leftX.toFixed(1) + ')');
  assert(rightX >= 360, 'right filler inner sits toward the launch wall (got ' + rightX.toFixed(1) + ')');
  var leftOuter = state.sideRoutes.leftRamp.segments;
  assert(leftOuter[leftOuter.length - 1].y2 === 32, 'U outer stays y=32');
  assert(lg[lg.length - 1].y2 === 70, 'U inner stays y=70');
  var leftMouthY = state.sideRoutes.leftRamp.entry.y;
  var rightMouthY = state.sideRoutes.rightRamp.entry.y;
  assert(leftMouthY >= 330 && leftMouthY <= 345, 'left mouth ~336');
  assert(rightMouthY >= 330 && rightMouthY <= 345, 'right mouth ~336');
  console.log('PASS: fillers shifted out (leftMid=' + leftX.toFixed(1) + ' rightMid=' + rightX.toFixed(1) + ')');
})();

(function testCopperCurveClearsUpperRightSaucer() {
  var state = fresh();
  var s = state.saucer2;
  var hit = null;
  var oldLoop = false;
  var i;
  for (i = 0; i < state.walls.length; i++) {
    var w = state.walls[i];
    if (w.kind !== 'habitrail' && w.kind !== 'guide') continue;
    var minX = Math.min(w.x1, w.x2);
    var maxX = Math.max(w.x1, w.x2);
    var minY = Math.min(w.y1, w.y2);
    var maxY = Math.max(w.y1, w.y2);
    if (minY >= 100 && maxY <= 170 && minX > 300 && minX <= 350) oldLoop = true;
    var ax = w.x2 - w.x1;
    var ay = w.y2 - w.y1;
    var lenSq = ax * ax + ay * ay;
    var t = lenSq < 1e-6 ? 0 : Math.max(0, Math.min(1, ((s.x - w.x1) * ax + (s.y - w.y1) * ay) / lenSq));
    var px = w.x1 + ax * t;
    var py = w.y1 + ay * t;
    var dist = Math.sqrt((s.x - px) * (s.x - px) + (s.y - py) * (s.y - py));
    if (dist < s.radius + 6) hit = { dist: dist };
  }
  assert(!oldLoop, 'old inward copper loop must not remain as an invisible wall');
  assert(!hit, 'copper curve must clear the UR saucer (dist=' + (hit ? hit.dist.toFixed(1) : 'ok') + ')');
  console.log('PASS: copper curve cleared of UR saucer');
})();


(function testTopLeftSaucerLocks() {
  var state = fresh();
  assert(state.saucer3, 'top-left saucer exists');
  assert(state.saucer3.x >= 90 && state.saucer3.x <= 110, 'TL saucer in the open pocket');
  assert(state.saucer3.y >= 190 && state.saucer3.y <= 230, 'TL saucer under/beside the cyan curve');
  assert(state.saucer3.x !== 95 || state.saucer3.y !== 520, 'TL saucer is not the lower-left lock');
  assert(!(state.saucer3.x === 330 && state.saucer3.y === 148), 'TL saucer is not the UR lock');
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  state.phase = 'playing';
  state.ball.x = state.saucer3.x;
  state.ball.y = state.saucer3.y;
  state.ball.vx = 12;
  state.ball.vy = 16;
  var i;
  for (i = 0; i < 8; i++) sim.tick(state, 1 / 60);
  assert(state.saucer3.captured, 'TL saucer should catch');
  assert(state.lockCount >= 1, 'TL saucer should lock');
  assert(state.saucer.lit && state.saucer2.lit && state.saucer3.lit, 'all three holes light LOCK');
  console.log('PASS: top-left saucer locks (' + state.saucer3.x + ',' + state.saucer3.y + ')');
})();
(function testEitherHoleStartsMultiball() {
  var state = fresh();
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  state.phase = 'playing';
  state.lockCount = 1;
  state.saucer.lit = true;
  state.saucer2.lit = true;
  state.ball.x = state.saucer2.x;
  state.ball.y = state.saucer2.y;
  state.ball.vx = 8;
  state.ball.vy = 12;
  var i;
  for (i = 0; i < 100; i++) sim.tick(state, 1 / 60);
  var live = 0;
  if (state.balls) {
    for (i = 0; i < state.balls.length; i++) if (state.balls[i] && state.balls[i].inPlay) live++;
    if (state.ball && state.ball.inPlay && state.balls.indexOf(state.ball) < 0) live++;
  } else if (state.ball && state.ball.inPlay) live = 1;
  assert(state.multiball || live >= 2, 'second lock on either hole starts MB');
  assert(live >= 2, 'two balls on table (live=' + live + ')');
  console.log('PASS: either hole second lock starts two-ball MB (live=' + live + ')');
})();

(function testSideHullFillers() {
  var state = sim.createInitialState();
  var left = state.sideRoutes.leftFiller;
  var right = state.sideRoutes.rightFiller;
  assert(left && left.id === 'fill-l', 'left orange filler present');
  assert(right && right.id === 'fill-r', 'right cyan filler present');
  assert(left.theme === 'copper', 'lower-left is copper (opposite of top cyan)');
  assert(right.theme === 'cyan', 'lower-right is cyan (opposite of top copper)');
  assert(left.segments[0].x1 === 36 && left.segments[0].y1 === 640, 'left filler hugs rail at 36,640');
  assert(left.guides.some(function (s) { return s.x2 === 74 && s.y2 === 700; }), 'left bulge peaks at 74,700');
  assert(right.segments[0].x1 === 392 && right.segments[0].y1 === 642, 'right filler hugs plunger wall 392,642');
  assert(right.guides.some(function (s) { return s.x2 === 354 && s.y2 === 702; }), 'right bulge peaks at 354,702');
  var fillerWalls = state.walls.filter(function (w) { return w.kind === 'filler'; });
  assert(fillerWalls.length >= 16, 'filler physics walls exist (' + fillerWalls.length + ')');
  assert(fillerWalls.some(function (w) { return w.x1 === 36 && w.y1 === 640; }), 'left filler wall 36,640');
  assert(fillerWalls.some(function (w) { return w.x1 === 392 && w.y1 === 642; }), 'right filler wall 392,642');
  assert(fillerWalls.some(function (w) { return w.x1 === 74 && w.y1 === 700; }), 'left inner wall at bulge');
  assert(fillerWalls.some(function (w) { return w.x1 === 354 && w.y1 === 702; }), 'right inner wall at bulge');
  var midU = fillerWalls.some(function (w) {
    var y = Math.min(w.y1, w.y2);
    return y >= 170 && y <= 330;
  });
  assert(!midU, 'no mid-height filler sausages on the U rails');
  function ptsY(fill) {
    var ys = [];
    fill.segments.concat(fill.guides).forEach(function (s) {
      ys.push(s.y1, s.y2);
    });
    return ys;
  }
  var lys = ptsY(left);
  var rys = ptsY(right);
  assert(Math.min.apply(null, lys) >= 620 && Math.max.apply(null, lys) <= 750, 'left filler sits just above flippers');
  assert(Math.min.apply(null, rys) >= 620 && Math.max.apply(null, rys) <= 750, 'right filler sits just above flippers');
  assert(Math.max.apply(null, left.guides.map(function (s) { return Math.max(s.x1, s.x2); })) <= 80, 'left filler does not pinch inlane/saucer');
  assert(Math.min.apply(null, right.guides.map(function (s) { return Math.min(s.x1, s.x2); })) >= 348, 'right filler does not pinch inlane');
  assert(Math.max.apply(null, right.segments.map(function (s) { return Math.max(s.x1, s.x2); })) <= 392, 'right filler stays at launch wall 392');
  var segs = state.sideRoutes.rightRamp.segments;
  var jagged = segs.some(function (s) { return s.x1 === 330 && s.y1 === 36 && s.x2 === 390 && s.y2 === 76; });
  assert(!jagged, 'old one-chord copper corner must be gone');
  var i;
  for (i = 0; i < segs.length - 1; i++) {
    assert(segs[i].x2 === segs[i + 1].x1 && segs[i].y2 === segs[i + 1].y1, 'copper outer is one continuous polyline at ' + i);
  }
  assert(state.targets.length === 0, 'grey standup rectangles removed');
  assert(state.flippers[0].length === 66, 'FLIPPER_LEN stays 66');
  assert(sim.HABITRAIL_ASSIST === 0, 'HABITRAIL_ASSIST stays 0');
  assert(state.saucer.x === 95 && state.saucer.y === 520, 'saucer 95,520');
  assert(state.saucer2.x === 330 && state.saucer2.y === 148, 'saucer2 330,148');
  assert(state.saucer3.x === 100 && state.saucer3.y === 208, 'saucer3 100,208');
  assert(state.gateSpinner.x === 240 && state.gateSpinner.y === 422, 'gate 240,422');
  var leftMouthY = state.sideRoutes.leftRamp.entry.y;
  var rightMouthY = state.sideRoutes.rightRamp.entry.y;
  assert(leftMouthY >= 330 && leftMouthY <= 345, 'left mouth ~336');
  assert(rightMouthY >= 330 && rightMouthY <= 345, 'right mouth ~336');
  console.log('PASS: lower hull fillers (copper left / cyan right) just above flippers');
})();
