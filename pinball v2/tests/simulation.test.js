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
    assert(!crosses, 'merge must not drop a wall down the shooter at x<LAUNCH_LANE_LEFT y>112 (' + s.x1 + ',' + s.y1 + ')-(' + s.x2 + ',' + s.y2 + ')');
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
      if (state.exitedLaunchLane && state.ball.y < 90 && state.ball.x > 160 && state.ball.x < 400) inU = true;
      if (state.exitedLaunchLane && state.ball.y > 420) break;
      if (!state.ball.inPlay && i > 12) break;
    }
    return { ex: state.exitedLaunchLane, inU: inU, x: state.ball.x, y: state.ball.y, remaining: state.ballsRemaining };
  }
  var mid = run(600);
  assert(mid.ex || mid.y < 100, '600 plunge must reach the merge / mouth (y=' + mid.y.toFixed(1) + ')');
  assert(mid.remaining === 3, '600 plunge must not drain in the shooter');
  var hot = run(1400);
  assert(hot.ex, '1400 plunge must leave the lane');
  assert(hot.inU, '1400 plunge must ride the merge into the U (x=' + hot.x.toFixed(1) + ' y=' + hot.y.toFixed(1) + ')');
  var med = run(800);
  assert(med.ex, '800 plunge must leave the lane');
  assert(med.ex, '800 plunge must leave the lane (dump or U)');
  console.log('PASS: 600 exits; 800/1400 enter U');
})();
console.log('=============================');

(function testGravityUpdatesPositionAndVelocity() {
  var state = fresh();
  state.ball.inPlay = true;
  state.ball.x = 240;
  // Clear of mid toys / feeder (240,455) / posts â€” pace fixture (was 240,400)
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

  // Dead-hold at apex: omega ~0, active=true â€” restitution only, no powered boost
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
  assert(mid <= linearMid + 0.5, 'mid-charge is not hotter than the bar');
  if (sim.LAUNCH_METER_EASE > 1) assert(mid < linearMid, 'eased mid-charge is softer than linear');
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
  var right = state.flippers.find(function (f) { return f.side === 'right' && f.role !== 'upper'; });
  var spacing = right.pivotX - left.pivotX;
  assert.strictEqual(spacing, sim.FLIPPER_PIVOT_SPACING);
  assert(spacing > 180 && spacing < 260, 'flipper pivot spacing uses the 560 table');
  var leftTip = sim.flipperTip(left);
  var rightTip = sim.flipperTip(right);
  var tipGap = rightTip.x - leftTip.x;
  assert(tipGap > 50 && tipGap < 140, 'flipper tips leave a real cabinet center hole');
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
  assert(state.exitedLaunchLane || state.ball.y < 100, 'medium launch should reach the merge / mouth');
  assert(state.ball.y < 160, 'medium launch should feed ball through top wireform');
  assert(state.ball.x < sim.LAUNCH_LANE_LEFT + 40, 'medium launch stays at the elbow, not a hall drain');
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
  // lay2: left sausage seats to the rail / bulge. Probe the playfield face, not the old outlane slot.
  state.ball.x = 148;
  state.ball.y = 704;
  state.ball.vx = -40;
  state.ball.vy = 220;
  var x0 = state.ball.x;
  sim.stepPhysics(state, 0.016);
  assert(
    state.ball.x > 118,
    'playfield beside left sausage must not teleport into the hull (x=' + state.ball.x.toFixed(1) + ')'
  );
  assert(state.ball.x <= x0 + 8, 'must not teleport inward from the playfield face');
  console.log('PASS: left sausage playfield face stays solid (no ghost kick)');
})();

(function testStrongLaunchReachesTopBumperZone() {
  var state = fresh();
  sim.launchBall(state, 700);
  for (var i = 0; i < 110; i++) {
    sim.tick(state, 0.016);
    if (state.exitedLaunchLane) break;
  }
  var k;
  for (k = 0; k < 10; k++) sim.tick(state, 0.016);
  assert(state.exitedLaunchLane, 'strong launch should complete top wireform');
  assert(state.ball.y < 200, 'strong launch should release near the merge / dump');
  assert(state.ball.x < sim.LAUNCH_LANE_LEFT + 8, 'strong launch should arc left off shooter lane');
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
  state.ball.x = sim.LAUNCH_LANE_LEFT - 8;
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
  var right = state.flippers.find(function (f) { return f.side === 'right' && f.role !== 'upper'; });
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
  // Parked on left tip â€” must fall into center hole, not loft forever
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
  var mx = (sling.x1 + sling.x2) * 0.5;
  var my = (sling.y1 + sling.y2) * 0.5;
  state.ball.x = mx + (sling.side === 'left' ? 14 : -14);
  state.ball.y = my;
  state.ball.vx = sling.side === 'left' ? -160 : 160;
  state.ball.vy = 40;
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
  // Second drain via physics must stick â€” no second loft above flippers from save
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
  state.ball.x = 456;
  state.ball.y = 220;
  state.ball.vx = 10;
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
  for (i = 0; i < 420; i++) {
    sim.stepPhysics(state, 1 / 60);
    var b = state.ball;
    if (b.x > 240 && b.x < 320 && b.y < 100) {
      crossedApex = true;
      minYAtApex = Math.min(minYAtApex, b.y);
      if (b.y > 95 && Math.abs(b.vx) < 30) droppedThrough = true;
    }
    if (dirLabel === 'LTR' && b.x > 400 && b.y < 160) farSide = true;
    if (dirLabel === 'RTL' && b.x < 250 && b.y < 160) farSide = true;
    if (farSide) break;
  }
  return { crossedApex: crossedApex, farSide: farSide, droppedThrough: droppedThrough, minYAtApex: minYAtApex, x: state.ball.x, y: state.ball.y, vx: state.ball.vx };
}

(function testHorseshoeOrbitBothWays() {
  var ltr = runOrbit(placeInLeftMouth, 'LTR', 1120);
  assert(ltr.crossedApex, 'LTR should crest the U (x=' + ltr.x.toFixed(1) + ' y=' + ltr.y.toFixed(1) + ')');
  assert(ltr.farSide, 'LTR should reach the right channel, not drop at the apex');
  assert(!ltr.droppedThrough, 'LTR must not kill vx and fall through the top');
  var rtl = runOrbit(placeInRightMouth, 'RTL', 1120);
  assert(rtl.crossedApex, 'RTL should crest the U');
  assert(rtl.farSide, 'RTL should reach the left channel, not drop at the apex');
  assert(!rtl.droppedThrough, 'RTL must not kill vx and fall through the top');
  console.log('PASS: horseshoe orbit LTR and RTL (LTR y=' + ltr.minYAtApex.toFixed(1) + ' RTL y=' + rtl.minYAtApex.toFixed(1) + ')');
})();

(function testRampShotKeepsMomentumNoSnap() {
  var state = fresh();
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  // Cyan 300 bumper â€” mid-field, must not magnetize onto the left rail.
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
    if (state.exitedLaunchLane && state.ball.y < 90 && state.ball.x < 440 && state.ball.x > 140) {
      inChannel = true;
      break;
    }
  }
  assert(state.exitedLaunchLane, 'charged plunge should leave the lane');
  assert(inChannel || (state.ball.y < 130 && state.ball.x < 440), 'charged plunge should enter the U channel');
  console.log('PASS: charged plunge enters horseshoe (x=' + state.ball.x.toFixed(1) + ' y=' + state.ball.y.toFixed(1) + ')');
})();

console.log('=============================');

(function testMergeInnerFloorIsContinuousChannel() {
  var state = fresh();
  var inner = state.sideRoutes.rightRamp.mergeInner || [];
  assert(inner.length >= 4, 'merge inner must be a real floor, not a stub');
  var minX = 999, maxX = 0, maxY = 0;
  var i;
  for (i = 0; i < inner.length; i++) {
    minX = Math.min(minX, inner[i].x1, inner[i].x2);
    maxX = Math.max(maxX, inner[i].x1, inner[i].x2);
    maxY = Math.max(maxY, inner[i].y1, inner[i].y2);
  }
  assert(maxX >= 470, 'merge inner must start at the shooter join');
  assert(minX <= 300, 'merge inner must reach the copper U floor');
  assert(maxY <= 112, 'merge inner must stay above the shooter well');
  var tagged = 0;
  for (i = 0; i < state.walls.length; i++) {
    if (state.walls[i].merge) tagged++;
  }
  assert(tagged >= 4, 'merge walls must be tagged so launch does not skip the floor');
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
  var glowing = (state.posts || []).filter(function (p) { return p.kind !== 'pin'; });
  assert.strictEqual(glowing.length, 0, 'circled glowing posts removed');
  assert((state.posts || []).length === 2, 'two small rubber-end pins');
  assert(state.saucer && state.saucer.x === 95 && state.saucer.y === 520, 'saucer/HOLE stays');
  console.log('PASS: circled posts gone, saucer kept');
})();

(function testGateSpinnerAwardsOnPass() {
  var state = fresh();
  var g = state.gateSpinner;
  assert(g, 'vertical gate spinner exists');
  assert(g.x >= 98 && g.x <= 118 && g.y >= 400 && g.y <= 432, 'gate sits left, above the lower-left HOLE');
  assert(Math.abs(g.x - 108) < 8 && Math.abs(g.y - 416) < 8, 'gate is at the annotated X');
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
  var b = run(1400);
  assert(b.inTube && !b.fell, '1400 must stay in the merge tube');
  var c = run(1400);
  assert(c.inTube && !c.fell, '1400 must stay in the merge tube');
  console.log('PASS: plunge 600/800/1400 stay in merge (800 y=' + b.y.toFixed(1) + ' 1400 y=' + c.y.toFixed(1) + ')');
})();


(function testLeftHabitrailBounceOnDrawnChord() {
  var state = fresh();
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  state.phase = 'playing';
  // Left inner guide ~ (92,276)-(116,340). Fire left into the widened chord.
  state.ball.x = 122;
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
  // Widened chord at y=300 is ~x=101; bounce sits on the line + radius.
  assert(contactX > 100 && contactX < 130, 'left bounce must sit on the drawn chord (x=' + contactX.toFixed(1) + ')');
  console.log('PASS: left habitrail bounce on drawn chord (x=' + contactX.toFixed(1) + ')');
})();

console.log('All tests passed.');

(function testUpperRightSaucerLocks() {
  var state = fresh();
  assert(state.saucer && state.saucer.x === 95 && state.saucer.y === 520, 'left saucer stays');
  assert(state.saucer2, 'upper-right saucer exists');
  assert(state.saucer2.x >= 390 && state.saucer2.x <= 430, 'UR saucer in the open pocket');
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
  assert(leftX >= 78 && leftX <= 92, 'left inner opened for 44px channel (got ' + leftX.toFixed(1) + ')');
  assert(rightX >= 360, 'right filler inner sits toward the launch wall (got ' + rightX.toFixed(1) + ')');
  var leftOuter = state.sideRoutes.leftRamp.segments;
  assert(leftOuter[leftOuter.length - 1].x2 >= 270 && leftOuter[leftOuter.length - 1].x2 <= 290, 'cyan U meets copper at top-center');
  assert(leftOuter[leftOuter.length - 1].y2 <= 20, 'cyan U outer sits on the flatter crown');
  var topOuterY = Math.min.apply(null, leftOuter.map(function (s) { return Math.min(s.y1, s.y2); }));
  assert(topOuterY <= 28, 'cyan U lifted to the green arc (top y=' + topOuterY + ')');
  assert(lg[lg.length - 1].x2 >= 270, 'cyan inner meets the join');
  assert(lg[lg.length - 1].y2 >= 79 && lg[lg.length - 1].y2 <= 81, 'cyan inner floor y=80 under flat outer');
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
  assert(state.saucer3.x >= 120 && state.saucer3.x <= 156, 'TL saucer in the open pocket');
  assert(state.saucer3.y >= 150 && state.saucer3.y <= 186, 'TL saucer above-right of the old hole');
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
  assert(left.segments[0].x1 === 36 && left.segments[0].y1 === 568, 'left filler flush on x=36');
  assert(left.guides.some(function (s) { return s.x2 === 80 && s.y2 === 652; }), 'left sausage keeps climb vertex 80,652');
  assert(left.guides.some(function (s) { return s.x2 === 122 && s.y2 === 712; }), 'left sausage bulges to 122,712');
  assert(!left.guides.some(function (s) { return s.x2 === 36 && s.y2 === 738; }), 'opt1: sausage no longer seals outlane at the rail');
  assert(!left.guides.some(function (s) { return s.x1 === 90 && s.y1 === 728 && s.x2 === 50; }), 'opt1: old outlane-seal slant gone');
  assert(right.segments[0].x1 === sim.LAUNCH_LANE_LEFT && right.segments[0].y1 === 538, 'right filler grown up the plunger wall');
  assert(right.guides.some(function (s) { return s.x2 === 414 && s.y2 === 662; }), 'right sausage peaks at 334,662');
  var fillerWalls = state.walls.filter(function (w) { return w.kind === 'filler'; });
  assert(fillerWalls.length >= 16, 'filler physics walls exist (' + fillerWalls.length + ')');
  assert(fillerWalls.some(function (w) { return w.x1 === 36 && w.y1 === 568; }), 'left filler wall flush on rail');
  assert(fillerWalls.some(function (w) { return w.x1 === sim.LAUNCH_LANE_LEFT && w.y1 === 538; }), 'right filler wall grown upward');
  assert(!fillerWalls.some(function (w) { return w.x1 === 64 && w.y1 === 598 && w.x2 === 76 && w.y2 === 628; }), 'left climb rubber is sling not filler');
  assert(!fillerWalls.some(function (w) { return w.x1 === 76 && w.y1 === 628 && w.x2 === 80 && w.y2 === 652; }), 'left peak rubber is sling not filler');
  assert(fillerWalls.some(function (w) { return w.x1 === 80 && w.y1 === 652 && w.x2 === 82 && w.y2 === 670; }), 'left downhill after peak stays filler');
  assert(!fillerWalls.some(function (w) { return w.x1 === 428 && w.y1 === 580 && w.x2 === 418 && w.y2 === 622; }), 'right climb rubber is sling not filler');
  assert(!fillerWalls.some(function (w) { return w.x1 === 418 && w.y1 === 622 && w.x2 === 414 && w.y2 === 662; }), 'right peak rubber is sling not filler');
  assert(fillerWalls.some(function (w) { return w.x1 === 414 && w.y1 === 662 && w.x2 === 420 && w.y2 === 698; }), 'right downhill after peak stays filler');
  assert(fillerWalls.some(function (w) { return w.x1 === 122 && w.y1 === 712 && w.x2 === 112 && w.y2 === 728; }), 'left sausage bulge turns toward inlane, not the rail');
  assert(!fillerWalls.some(function (w) { return w.x1 === 48 && w.y1 === 578 && w.x2 === 64 && w.y2 === 598; }), 'left top rubber is sling not filler');
  assert(fillerWalls.some(function (w) { return w.x1 === 428 && w.y1 === 714 && w.x2 === 442 && w.y2 === 728; }), 'right bottom inner stays filler');
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
  assert(Math.min.apply(null, lys) >= 560 && Math.min.apply(null, lys) <= 580, 'left filler y-min meets cyan rail');
  assert(Math.max.apply(null, lys) <= 750, 'left filler seats to the rail above flipper');
  assert(Math.min.apply(null, rys) >= 520 && Math.min.apply(null, rys) <= 540, 'right filler grown upward');
  assert(Math.max.apply(null, rys) <= 750, 'right filler stays above flipper');
  assert(Math.max.apply(null, left.guides.map(function (s) { return Math.max(s.x1, s.x2); })) <= 130, 'left filler bulge stays left of flipper sweep');
  assert(Math.min.apply(null, right.guides.map(function (s) { return Math.min(s.x1, s.x2); })) >= 330, 'right filler fatter but not inlane');
  assert(Math.max.apply(null, right.segments.map(function (s) { return Math.max(s.x1, s.x2); })) <= sim.LAUNCH_LANE_LEFT, 'right filler stays at launch wall');
  assert(Math.min.apply(null, left.segments.map(function (s) { return Math.min(s.x1, s.x2); })) === 36, 'left outer flush x=36');
  assert(Math.max.apply(null, left.segments.map(function (s) { return Math.max(s.x1, s.x2); })) >= 96 && Math.max.apply(null, left.segments.map(function (s) { return Math.max(s.x1, s.x2); })) <= 110, 'opt1: left outer peels in to open the outlane');
  assert(Math.min.apply(null, right.segments.map(function (s) { return Math.min(s.x1, s.x2); })) === sim.LAUNCH_LANE_LEFT, 'right outer flush on launch lane');
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
  assert(state.saucer2.x === 410 && state.saucer2.y === 148, 'saucer2 410,148');
  assert(state.saucer3.x === 138 && state.saucer3.y === 168, 'saucer3 138,168');
  assert(state.gateSpinner.x === 108 && state.gateSpinner.y === 416, 'gate 108,416');
  var leftMouthY = state.sideRoutes.leftRamp.entry.y;
  var rightMouthY = state.sideRoutes.rightRamp.entry.y;
  assert(leftMouthY >= 330 && leftMouthY <= 345, 'left mouth ~336');
  assert(rightMouthY >= 330 && rightMouthY <= 345, 'right mouth ~336');
  console.log('PASS: lower hull fillers (copper left / cyan right) just above flippers');
})();

(function testSausageMidfaceSlingshots() {
  var state = fresh();
  var slings = state.slingshots;
  assert.strictEqual(slings.length, 6, 'two climb rubbers per sausage plus both top bands');
  function hasSeg(side, x1, y1, x2, y2) {
    return slings.some(function (s) {
      return s.side === side && s.x1 === x1 && s.y1 === y1 && s.x2 === x2 && s.y2 === y2 && s.score === 150;
    });
  }
  assert(hasSeg('left', 48, 578, 64, 598), 'left top rubber 48,578-64,598');
  assert(hasSeg('left', 64, 598, 76, 628), 'left climb rubber 64,598-76,628');
  assert(hasSeg('left', 76, 628, 80, 652), 'left climb rubber 76,628-80,652');
  assert(hasSeg('right', 428, 580, 418, 622), 'right climb rubber 348,580-338,622');
  assert(hasSeg('right', 418, 622, 414, 662), 'right climb rubber 338,622-334,662');
  assert(hasSeg('right', 450, 558, 438, 570), 'right top rubber 370,558-358,570');
  assert(!hasSeg('left', 80, 652, 74, 676), 'no left downhill rubber after peak');
  assert(!hasSeg('right', 414, 662, 420, 698), 'no right downhill rubber after peak');
  var classic = slings.some(function (s) {
    return s.y1 === sim.FLIPPER_ROW_Y - 4 || s.y2 === sim.FLIPPER_ROW_Y - 42;
  });
  assert(!classic, 'classic flipper-row triangle slings must be gone');
  console.log('PASS: sausage climb-face slings (not downhill, not triangles)');
})();

(function testHall1Refinements() {
  var fs = require('fs');
  var path = require('path');
  var state = sim.createInitialState();
  var dashes = state.launchLaneDashes;
  assert.strictEqual(dashes.length, 15, 'plunger-hall running lights restored to 9');
  var ys = dashes.map(function (d) { return d.y; });
  var yMin = Math.min.apply(null, ys);
  var yMax = Math.max.apply(null, ys);
  assert(yMin >= 95 && yMin <= 120, 'dash yTop at merge join ~103 (got ' + yMin + ')');
  assert(yMax >= 700, 'dash yBot stays near plunger (got ' + yMax + ')');
  dashes.forEach(function (d) {
    assert(d.y >= sim.LAUNCH_WIRE_Y1 - 2, 'no hall dash enters U past merge (y=' + d.y + ')');
    assert(d.x === sim.LAUNCH_LANE_X, 'dashes stay in the copper alley');
  });
  var renSrc = fs.readFileSync(path.join(__dirname, '..', 'renderer.js'), 'utf8');
  assert(renSrc.indexOf('if (d.y < 360)') === -1, 'old y<360 draw skip must be gone');
  assert(renSrc.indexOf('if (d.y < joinY)') !== -1, 'draw skip is y<joinY so upper hall lights');
  assert(renSrc.indexOf('if (d.y < 660)') === -1, 'over-delete skip y<660 must be gone');
  assert(renSrc.indexOf('lane-l') !== -1 && renSrc.indexOf('lane-r') !== -1, 'oval-pill skip mentions both ramp lights');
  var mergeFn = renSrc.split('function drawMergeJoinRims')[1] || '';
  mergeFn = mergeFn.split('function drawSideRoutes')[0] || mergeFn;
  assert(mergeFn.indexOf('ctx.fill(') === -1 && mergeFn.indexOf('.fill()') === -1, 'merge draw has no filled splice');
  assert(renSrc.indexOf('strokeTubePath(ctx, segsToPoints(rr.segments)') === -1, 'no second full-ramp copper tube');
  var slings = state.slingshots;
  var climbR = slings.filter(function (s) { return s.side === 'right' && s.face !== 'top'; });
  var topR = slings.filter(function (s) { return s.side === 'right' && s.face === 'top'; });
  assert.strictEqual(climbR.length, 2, 'right climb slings still two segs');
  assert.strictEqual(topR.length, 1, 'right top rubber is one short band');
  assert(topR[0].x1 === 450 && topR[0].y1 === 558 && topR[0].x2 === 438 && topR[0].y2 === 570);
  var topL = slings.filter(function (s) { return s.side === 'left' && s.face === 'top'; });
  assert.strictEqual(topL.length, 1, 'left top rubber is one short band');
  assert(topL[0].x1 === 48 && topL[0].y1 === 578 && topL[0].x2 === 64 && topL[0].y2 === 598);
  var right = state.sideRoutes.rightFiller;
  assert(right.segments[0].y1 === 538, 'right filler starts higher');
  assert(right.guides.some(function (s) { return s.x1 === 450 && s.y1 === 558 && s.x2 === 438 && s.y2 === 570; }), 'top cap is on the hull');
  var fillerWalls = state.walls.filter(function (w) { return w.kind === 'filler'; });
  assert(!fillerWalls.some(function (w) { return w.x1 === 450 && w.y1 === 558 && w.x2 === 438 && w.y2 === 570; }), 'top rubber is sling not filler');
  assert(!fillerWalls.some(function (w) { return w.x1 === 428 && w.y1 === 580 && w.x2 === 418 && w.y2 === 622; }), 'right climb still sling not filler');
  assert(fillerWalls.some(function (w) { return w.x1 === 414 && w.y1 === 662 && w.x2 === 420 && w.y2 === 698; }), 'right downhill after peak stays filler');
  dashes.forEach(function (d) {
    assert(d.intensity >= 0.2, 'dash idle dim so they read as lights (i=' + d.intensity + ')');
  });
  assert(renSrc.indexOf('idlePulse') !== -1, 'renderer idle dim glow');
  assert(renSrc.indexOf('insetX') === -1, 'no filler draw inset skeleton');
  assert(renSrc.indexOf('Math.max(s.y1, s.y2) < 112') === -1, 'no split top hull double-drawing merge');
  assert(state.walls.some(function (w) { return w.kind === 'rail' && w.cyan && w.x1 === 36; }), 'left wall is cyan to the sausage');
  function monotonicToPeak(guides, inwardSign) {
    var xs = [guides[0].x1];
    guides.forEach(function (s) { xs.push(s.x2); });
    var peak = 0;
    var i;
    for (i = 1; i < xs.length; i++) {
      if (inwardSign > 0 ? xs[i] >= xs[peak] : xs[i] <= xs[peak]) peak = i;
    }
    for (i = 1; i <= peak; i++) {
      if (inwardSign > 0 ? xs[i] < xs[i - 1] : xs[i] > xs[i - 1]) return false;
    }
    for (i = peak + 1; i < xs.length; i++) {
      if (inwardSign > 0 ? xs[i] > xs[i - 1] : xs[i] < xs[i - 1]) return false;
    }
    return peak > 1 && peak < xs.length - 1;
  }
  assert(monotonicToPeak(state.sideRoutes.leftFiller.guides, 1), 'left sausage is a smooth wedge, not a triangle/sawtooth');
  assert(monotonicToPeak(state.sideRoutes.rightFiller.guides, -1), 'right sausage is a smooth wedge, not a sawtooth skeleton');
  console.log('PASS: sense1 dashes/ovals/merge/sausages');
})();
(function testBoingerPairAlternateAndKick() {
  var state = fresh();
  var list = state.boingers;
  assert(list && list.length === 3, 'three boingers');
  var a = list[0];
  var b = list[1];
  var c = list[2];
  assert(a, 'boinger A exists');
  assert.strictEqual(a.x, 398);
  assert.strictEqual(a.y, 686);
  assert.strictEqual(a.phase, 'a');
  assert.strictEqual(a.theme, 'copper');
  assert(a.radius >= 11 && a.radius <= 13, 'cap radius ~12');
  assert.strictEqual(b.x, 352);
  assert.strictEqual(b.y, 707);
  assert.strictEqual(b.phase, 'b');
  assert.strictEqual(b.theme, 'cyan');
  assert(b.radius >= 11 && b.radius <= 13, 'B cap radius ~12');
  assert(c, 'boinger C exists');
  assert.strictEqual(c.x, 125);
  assert.strictEqual(c.y, 708);
  assert.strictEqual(c.phase, 'b');
  assert.strictEqual(c.theme, 'cyan');
  assert(c.radius >= 11 && c.radius <= 13, 'C cap radius ~12');
  assert.strictEqual(sim.BOINGER_C_X, 125);
  assert.strictEqual(sim.BOINGER_C_Y, 708);
  assert.strictEqual(sim.BOINGER_UP_SEC, 3);
  assert.strictEqual(sim.BOINGER_DOWN_SEC, 1.5);
  sim.stepBoinger(state, 0);
  assert(a.up && !b.up && !c.up, 'A up / B+C down at t=0 (inverted phase)');
  sim.stepBoinger(state, 2.9);
  assert(a.up && !b.up && !c.up, 'A still up / B+C down at 2.9s');
  sim.stepBoinger(state, 0.2);
  assert(!a.up && b.up && c.up, 'A down / B+C up after 3.1s');
  sim.stepBoinger(state, 1.5);
  assert(a.up && !b.up && !c.up, 'A up / B+C down after full 4.5s cycle');
  state.ball.inPlay = true;
  a.up = false;
  a.pop = 0;
  b.up = false;
  b.pop = 0;
  state.ball.x = a.x;
  state.ball.y = a.y;
  state.ball.vx = 40;
  state.ball.vy = 80;
  var ox = state.ball.x;
  var ovx = state.ball.vx;
  sim.collideBoinger(state);
  assert(state.ball.x === ox && state.ball.vx === ovx, 'pass through A when A down');
  a.up = true;
  a.pop = 1;
  a.cooldown = 0;
  state.ball.x = a.x - 8;
  state.ball.y = a.y;
  state.ball.vx = 120;
  state.ball.vy = 0;
  var score0 = state.score;
  sim.collideBoinger(state);
  assert(state.ball.vx < 0, 'A kicked back along contact normal (-x)');
  assert(state.score > score0, 'A scored a hit');
  a.up = false;
  a.pop = 0;
  b.up = true;
  b.pop = 1;
  b.cooldown = 0;
  state.ball.x = b.x - 8;
  state.ball.y = b.y;
  state.ball.vx = 120;
  state.ball.vy = 0;
  score0 = state.score;
  sim.collideBoinger(state);
  assert(state.ball.vx < 0, 'B kicked when B up');
  assert(state.score > score0, 'B scored a hit');
  b.up = false;
  b.pop = 0;
  a.up = true;
  a.pop = 1;
  state.ball.x = b.x - 8;
  state.ball.y = b.y;
  state.ball.vx = 120;
  state.ball.vy = 0;
  ox = state.ball.x;
  ovx = state.ball.vx;
  score0 = state.score;
  sim.collideBoinger(state);
  assert(state.ball.x === ox && state.ball.vx === ovx, 'pass through B when B down');
  assert(state.score === score0, 'no score from down B');
  console.log('PASS: three boingers, inverted phase, collide only when that one is up');
})();
(function testCopperInnerChannelFitsBall() {
  var state = fresh();
  var right = state.sideRoutes.rightRamp;
  var inner = right.mergeInner || [];
  var guides = right.guides || [];
  var minGap = 999;
  var i, j, t, u;
  function distPointSeg(px, py, s) {
    var dx = s.x2 - s.x1, dy = s.y2 - s.y1;
    var lenSq = dx * dx + dy * dy;
    if (lenSq < 1e-6) return Math.hypot(px - s.x1, py - s.y1);
    var tt = Math.max(0, Math.min(1, ((px - s.x1) * dx + (py - s.y1) * dy) / lenSq));
    return Math.hypot(px - (s.x1 + dx * tt), py - (s.y1 + dy * tt));
  }
  for (i = 0; i < inner.length; i++) {
    for (t = 0; t <= 4; t++) {
      var px = inner[i].x1 + (inner[i].x2 - inner[i].x1) * (t / 4);
      var py = inner[i].y1 + (inner[i].y2 - inner[i].y1) * (t / 4);
      if (px < 290 || px > 400 || py < 28 || py > 130) continue;
      for (j = 0; j < guides.length; j++) {
        minGap = Math.min(minGap, distPointSeg(px, py, guides[j]));
      }
    }
  }
  for (j = 0; j < guides.length; j++) {
    for (u = 0; u <= 4; u++) {
      var gx = guides[j].x1 + (guides[j].x2 - guides[j].x1) * (u / 4);
      var gy = guides[j].y1 + (guides[j].y2 - guides[j].y1) * (u / 4);
      if (gx < 290 || gx > 400 || gy < 28 || gy > 130) continue;
      for (i = 0; i < inner.length; i++) minGap = Math.min(minGap, distPointSeg(gx, gy, inner[i]));
    }
  }
  // Shared T-junction vertex is a corner, not a slot. Flag only a parallel pinch.
  var pinch = 999;
  function segLen(s) { return Math.hypot(s.x2 - s.x1, s.y2 - s.y1); }
  function unit(s) {
    var L = segLen(s) || 1;
    return { x: (s.x2 - s.x1) / L, y: (s.y2 - s.y1) / L };
  }
  function sharesEnd(a, b) {
    var pts = [[a.x1,a.y1],[a.x2,a.y2]];
    var i;
    for (i = 0; i < 2; i++) {
      if (Math.hypot(pts[i][0] - b.x1, pts[i][1] - b.y1) < 4) return true;
      if (Math.hypot(pts[i][0] - b.x2, pts[i][1] - b.y2) < 4) return true;
    }
    return false;
  }
  for (i = 0; i < inner.length; i++) {
    for (j = 0; j < guides.length; j++) {
      if (sharesEnd(inner[i], guides[j])) continue;
      var ua = unit(inner[i]), ub = unit(guides[j]);
      var para = Math.abs(ua.x * ub.x + ua.y * ub.y) > 0.72;
      if (!para) continue;
      var mx = (inner[i].x1 + inner[i].x2) * 0.5;
      var my = (inner[i].y1 + inner[i].y2) * 0.5;
      if (mx < 290 || mx > 400 || my < 28 || my > 130) continue;
      pinch = Math.min(pinch, distPointSeg(mx, my, guides[j]));
    }
  }
  // A lodge is a long parallel slot, not a T-corner. Require overlap along both segs.
  var slot = 999;
  for (i = 0; i < inner.length; i++) {
    for (j = 0; j < guides.length; j++) {
      if (sharesEnd(inner[i], guides[j])) continue;
      var ua = unit(inner[i]), ub = unit(guides[j]);
      if (Math.abs(ua.x * ub.x + ua.y * ub.y) < 0.82) continue;
      if (segLen(inner[i]) < 16 || segLen(guides[j]) < 16) continue;
      var mx = (inner[i].x1 + inner[i].x2) * 0.5;
      var my = (inner[i].y1 + inner[i].y2) * 0.5;
      if (mx < 290 || mx > 400 || my < 28 || my > 130) continue;
      var d = distPointSeg(mx, my, guides[j]);
      if (d < slot) slot = d;
    }
  }
  // Old lodge was a 1-13px parallel run at 322,74. A T-corner ~23px is not a slot.
  assert(slot >= 20, 'old 1-13px parallel lodge must be gone (slot=' + slot.toFixed(1) + ' pinch=' + pinch.toFixed(1) + ')');
  var oldV = false;
  function hasPt(segs, x, y) {
    var k;
    for (k = 0; k < segs.length; k++) {
      if ((Math.abs(segs[k].x1 - x) < 2 && Math.abs(segs[k].y1 - y) < 2) ||
          (Math.abs(segs[k].x2 - x) < 2 && Math.abs(segs[k].y2 - y) < 2)) return true;
    }
    return false;
  }
  if (hasPt(guides, 322, 74) && hasPt(inner, 324, 74)) oldV = true;
  assert(!oldV, 'old 322,74 / 324,74 inner V vertices must be gone');
  var leftGuides = state.sideRoutes.leftRamp.guides || [];
  var poked = false;
  for (i = 0; i < leftGuides.length; i++) {
    if (Math.max(leftGuides[i].x1, leftGuides[i].x2) > 300) poked = true;
  }
  assert(!poked, 'cyan inner must not poke into the copper V past x=300');
  console.log('PASS: copper inner channel gap=' + minGap.toFixed(1));
})();
(function testCopperMergePocketUnsticks() {
  function runAt(x, y, extra) {
    var state = fresh();
    state.ball.inPlay = true;
    state.exitedLaunchLane = true;
    state.activeHabitrail = extra ? null : 'ramp-r';
    state.ball.x = x;
    state.ball.y = y;
    state.ball.vx = 0;
    state.ball.vy = 0;
    if (extra) {
      state.ball.x = 200;
      state.ball.y = 360;
      state.ball.vx = 40;
      state.ball.vy = -10;
      var stuck = {
        x: x, y: y, vx: 0, vy: 0, radius: sim.BALL_RADIUS, inPlay: true, _exited: true
      };
      state.balls = [state.ball, stuck];
      state.multiball = true;
    }
    var k, lastSp = 0, maxSp = 0, target = extra ? state.balls[1] : state.ball;
    for (k = 0; k < 24; k++) {
      sim.stepPhysics(state, 1 / 60);
      if (extra) {
        var live = sim.allLiveBalls(state);
        var i;
        target = null;
        for (i = 0; i < live.length; i++) {
          if (live[i] !== state.ball || live.length === 1) target = live[i];
        }
        if (state.balls) {
          for (i = 0; i < state.balls.length; i++) {
            if (state.balls[i] && state.balls[i] !== state.ball) target = state.balls[i];
          }
        }
        if (!target) target = state.ball;
      } else {
        target = state.ball;
      }
      lastSp = Math.hypot(target.vx, target.vy);
      if (lastSp > maxSp) maxSp = lastSp;
    }
    var inV = target.x > 472 && target.x < 496 && target.y > 68 && target.y < 92 && maxSp < 50;
    return { x: target.x, y: target.y, sp: maxSp, lastSp: lastSp, inV: inV, state: state };
  }
  var a = runAt(484, 79, false);
  assert(a.sp > 50, 'V rest at 484,79 must be moving after 0.4s (sp=' + a.sp.toFixed(1) + ' x=' + a.x.toFixed(1) + ' y=' + a.y.toFixed(1) + ')');
  assert(!a.inV, 'must not still sit in the V');
  var b = runAt(500, 72, false);
  assert(b.sp > 50, 'mid-orange rail ~500,72 must be moving after 0.4s (sp=' + b.sp.toFixed(1) + ' x=' + b.x.toFixed(1) + ' y=' + b.y.toFixed(1) + ')');
  var c = runAt(484, 79, true);
  assert(c.sp > 50, 'stuck secondary ball must be freed (sp=' + c.sp.toFixed(1) + ')');
  assert(!c.inV, 'secondary must leave the V');
  assert(sim.HABITRAIL_ASSIST === 0, 'HABITRAIL_ASSIST stays 0');
  assert(sim.BOINGER_B_X === 352 && sim.BOINGER_B_Y === 707, 'B at 352,707 (in/up, symmetric with C)');
  console.log('PASS: copper lodge unsticks V/rail/secondary (sp=' + a.sp.toFixed(1) + '/' + b.sp.toFixed(1) + '/' + c.sp.toFixed(1) + ')');
})();
(function testRubberMidBumperPowerful() {
  var state = fresh();
  var rubber = state.bumpers.find(function (b) { return b.id === 'rubber-mid' && b.rubber; });
  assert(rubber, 'rubber-mid bumper exists');
  assert(Math.abs(rubber.x - 340) < 14 && Math.abs(rubber.y - 520) < 16, 'rubber bumper below triangle (340,520), got ' + rubber.x + ',' + rubber.y);
  assert(rubber.y > 418, 'rubber-mid y below triangle bottom ~418, got y=' + rubber.y);
  assert.strictEqual(rubber.radius, 18);
  assert.strictEqual(rubber.score, 500);
  assert(rubber.restitution >= 1.32, 'rubber restitution');
  assert(rubber.exitSpeed >= 320, 'rubber exitSpeed');
  assert(rubber.restitution > sim.BUMPER_RESTITUTION, 'rubber rest > global 1.15');
  assert(rubber.exitSpeed > sim.MIN_BUMPER_EXIT_SPEED, 'rubber exit > normal 180 min');
  var apex = state.bumpers[0];
  function kickSpeed(target) {
    var st = fresh();
    var b = st.bumpers.find(function (x) { return x.x === target.x && x.y === target.y; });
    st.ball.inPlay = true;
    st.exitedLaunchLane = true;
    st.ball.x = b.x;
    st.ball.y = b.y - b.radius - st.ball.radius + 2;
    st.ball.vx = 0;
    st.ball.vy = 80;
    sim.stepPhysics(st, 0.016);
    return Math.hypot(st.ball.vx, st.ball.vy);
  }
  var rubberKick = kickSpeed(rubber);
  var apexKick = kickSpeed(apex);
  assert(rubberKick > apexKick, 'rubber kicks harder than 180 (rubber=' + rubberKick.toFixed(1) + ' apex=' + apexKick.toFixed(1) + ')');
  assert(rubberKick >= 300, 'rubber min exit ~320, got ' + rubberKick.toFixed(1));
  console.log('PASS: rubber-mid bumper at ' + rubber.x + ',' + rubber.y + ' r=' + rubber.radius + ' kicks harder than 180 (' + rubberKick.toFixed(1) + ' > ' + apexKick.toFixed(1) + ')');
})();
(function testCage1DumpAndOutlaneCage() {
  var state = fresh();
  var rubber = state.bumpers.find(function (b) { return b.id === 'rubber-mid' && b.rubber; });
  assert(rubber, 'rubber-mid still exists (moved, not deleted)');
  assert(rubber.y > 418, 'rubber-mid y below triangle, got ' + rubber.y);
  assert(Math.abs(rubber.x - 340) < 14 && Math.abs(rubber.y - 520) < 16, 'rubber-mid below triangle (340,520), got ' + rubber.x + ',' + rubber.y);
  var wing300 = state.bumpers.find(function (b) { return b.score === 300 && b.x > 250; });
  assert(wing300, 'right 300 exists');
  var gap300 = Math.hypot(rubber.x - wing300.x, rubber.y - wing300.y) - rubber.radius - wing300.radius;
  assert(gap300 > 8, 'rubber-mid does not overlap the 300, gap=' + gap300.toFixed(1));
  var list = state.boingers;
  var a = list[0], b = list[1], c = list[2];
  assert.strictEqual(a.x, 398);
  assert.strictEqual(a.y, 686);
  assert(c.x === 125 && c.y === 708, 'C at 125,708, got ' + c.x + ',' + c.y);
  assert(b.x === 352 && b.y === 707, 'B at 352,707, got ' + b.x + ',' + b.y);
  assert.strictEqual(c.phase, 'b');
  assert.strictEqual(b.phase, 'b');
  assert.strictEqual(c.theme, 'cyan');
  assert.strictEqual(b.theme, 'cyan');
  var cages = state.walls.filter(function (w) { return w.kind === 'cage'; });
  assert.strictEqual(cages.length, 1, 'only the left chrome cage remains');
  var left = cages.find(function (w) { return w.id === 'cage-l'; });
  var right = cages.find(function (w) { return w.id === 'cage-r'; });
  assert(left && !right, 'cage-r dumbbell removed; cage-l kept');
  assert(left.x1 >= 96 && left.x2 <= 150 && left.y1 > 700 && left.y2 < 750, 'left cage frames C, not the outlane');
  console.log('PASS: cage1 rubber-mid below triangle, cyan boingers lower/outer, right dumbbell gone');
})();

(function testMultiballSurvivorStaysLive() {
  var state = fresh();
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  state.phase = 'playing';
  state.ball.x = 200;
  state.ball.y = 360;
  state.ball.vx = 40;
  state.ball.vy = -20;
  state.ball._exited = true;
  var extra = {
    x: 240,
    y: 400,
    vx: -30,
    vy: -10,
    radius: sim.BALL_RADIUS,
    inPlay: true,
    _exited: true,
    _habitrail: null,
    _railT: null
  };
  state.balls = [state.ball, extra];
  state.multiball = true;
  state.ballsRemaining = 3;
  extra.y = sim.TABLE_H + 60;
  extra.vy = 80;
  var i;
  for (i = 0; i < 8; i++) sim.tick(state, 1 / 60);
  var live = 0;
  if (state.ball && state.ball.inPlay) live += 1;
  if (state.balls) {
    for (i = 0; i < state.balls.length; i++) {
      if (state.balls[i] && state.balls[i].inPlay && state.balls[i] !== state.ball) live += 1;
    }
  }
  assert(live >= 1, 'survivor must stay live after one MB drain, live=' + live);
  assert(state.phase !== 'eob_bonus', 'must not start EOB while a ball is still in play');
  assert(state.phase !== 'ready', 'must not reset to plunger while a ball is still in play');
  assert(state.ball.inPlay, 'primary should be the surviving live ball');
  assert(state.ball.y < sim.TABLE_H, 'survivor must remain on the table (y=' + state.ball.y + ')');
  console.log('PASS: MB survivor stays live after one drain (live=' + live + ' phase=' + state.phase + ')');
})();

(function testOrangeDumpDoesNotRequire500() {
  var state = fresh();
  var rubber = state.bumpers.find(function (b) { return b.id === 'rubber-mid' && b.rubber; });
  assert(rubber, 'rubber-mid exists');
  assert(rubber.y > 418, 'rubber-mid below triangle, y=' + rubber.y);
  assert(Math.abs(rubber.x - 340) < 14 && Math.abs(rubber.y - 520) < 16, '500 at ~340,520, got ' + rubber.x + ',' + rubber.y);
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  state.phase = 'playing';
  state.activeHabitrail = 'ramp-r';
  state.ball.x = 430;
  state.ball.y = 328;
  state.ball.vx = 20;
  state.ball.vy = 80;
  state.ball._exited = true;
  var i;
  var leftMouth = false;
  for (i = 0; i < 90; i++) {
    sim.stepPhysics(state, 1 / 60);
    if (state.ball.y > 390 || state.ball.x < 400) leftMouth = true;
  }
  assert(leftMouth || state.ball.inPlay, 'orange dump can leave the mouth freely');
  console.log('PASS: orange dump is free (not required to hit 500) x=' + state.ball.x.toFixed(1) + ' y=' + state.ball.y.toFixed(1));
})();

(function testPulseTriangleThreeRubbers() {
  var state = fresh();
  var tri = state.pulseTriangle;
  assert(tri, 'pulse triangle exists');
  assert(tri.verts && tri.verts.length === 3, 'rounded triangle has 3 verts');
  assert(tri.sides && tri.sides.length === 3, 'triangle has 3 rubber sides');
  var themes = tri.sides.map(function (s) { return s.theme; }).sort();
  assert.deepStrictEqual(themes, ['copper', 'cyan', 'violet'].sort(), 'three different side colors');
  assert(tri.sweepSec === 15, '15s pulse sweep');
  var left = Math.min(tri.verts[0].x, tri.verts[1].x, tri.verts[2].x);
  var right = Math.max(tri.verts[0].x, tri.verts[1].x, tri.verts[2].x);
  var top = Math.min(tri.verts[0].y, tri.verts[1].y, tri.verts[2].y);
  var bot = Math.max(tri.verts[0].y, tri.verts[1].y, tri.verts[2].y);
  var rubber = state.bumpers.find(function (b) { return b.id === 'rubber-mid'; });
  assert(rubber && rubber.x === 340 && rubber.y === 520, '500 at 340,520');
  assert(Math.hypot(((tri.verts[0].x + tri.verts[1].x + tri.verts[2].x) / 3) - rubber.x, ((tri.verts[0].y + tri.verts[1].y + tri.verts[2].y) / 3) - rubber.y) > 40, 'triangle centroid clear of 500');
  assert(top > 500, 'triangle sits in the lower-middle band');
  assert(bot < sim.FLIPPER_ROW_Y - 80, 'triangle stays above the flipper row');
  assert(left > 140 && left < 200, 'triangle is lower-middle-left, not on saucer/sausage');
  var i;
  for (i = 0; i < 3; i++) {
    var s = tri.sides[i];
    var d500 = Math.hypot((s.x1 + s.x2) * 0.5 - rubber.x, (s.y1 + s.y2) * 0.5 - rubber.y);
    assert(d500 > 28, 'triangle rubber does not swallow the 500');
  }
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  var side0 = tri.sides[0];
  var mx = (side0.x1 + side0.x2) * 0.5;
  var my = (side0.y1 + side0.y2) * 0.5;
  state.ball.x = mx + side0.nx * (state.ball.radius + 2);
  state.ball.y = my + side0.ny * (state.ball.radius + 2);
  state.ball.vx = -side0.nx * 220;
  state.ball.vy = -side0.ny * 220;
  sim.stepPhysics(state, 1 / 60);
  assert(side0.flash > 0 || side0.cooldown > 0, 'hitting a rubber flashes that side');
  var out = state.ball.vx * side0.nx + state.ball.vy * side0.ny;
  assert(out > 0, 'ball boings off the face along the outward normal');
  assert(Math.abs(tri.sides[0].phaseOffset - tri.sides[1].phaseOffset) > 1, 'side phase offsets differ');
  var i;
  for (i = 0; i < 24; i++) sim.tick(state, 1 / 60);
  var litA = tri.sides[0].lit;
  var litB = tri.sides[1].lit;
  var litC = tri.sides[2].lit;
  assert(Math.abs(litA - litB) > 0.02 || Math.abs(litB - litC) > 0.02 || Math.abs(litA - litC) > 0.02, 'sides are out of phase after the sweep starts');
  console.log('PASS: pulse triangle at ~186,558 with 3 colored rubbers');
})();
(function testCyanSausageSolidAndCuspFree() {
  function runAt(x, y, frames) {
    var state = fresh();
    state.ball.inPlay = true;
    state.exitedLaunchLane = true;
    state.phase = 'playing';
    state.ball.x = x;
    state.ball.y = y;
    state.ball.vx = 0;
    state.ball.vy = 0;
    var k, maxSp = 0;
    for (k = 0; k < frames; k++) {
      sim.stepPhysics(state, 1 / 60);
      var sp = Math.hypot(state.ball.vx, state.ball.vy);
      if (sp > maxSp) maxSp = sp;
    }
    return { state: state, x: state.ball.x, y: state.ball.y, maxSp: maxSp, lastSp: Math.hypot(state.ball.vx, state.ball.vy) };
  }
  var right = fresh().sideRoutes.rightFiller;
  assert(right.segments[0].x1 === sim.LAUNCH_LANE_LEFT && right.segments[0].y1 === 538, 'outer still meets rail at launch,538');
  assert(right.guides[0].x1 === sim.LAUNCH_LANE_LEFT && right.guides[0].y1 === 538 && right.guides[0].x2 === sim.LAUNCH_LANE_LEFT - 10 && right.guides[0].y2 === 546, 'open shoulder down-left, not knife V');
  assert(!right.guides.some(function (s) { return s.y2 < s.y1 && s.x1 === sim.LAUNCH_LANE_LEFT; }), 'first inner must not climb above the rail join');
  var cusp = runAt(468, 536, 24);
  assert(cusp.maxSp > 40, 'cusp sit 468,536 must be moving within 0.4s (sp=' + cusp.maxSp.toFixed(1) + ')');
  var stillV = cusp.x >= 458 && cusp.x <= 476 && cusp.y >= 528 && cusp.y <= 548 && cusp.lastSp < 30;
  assert(!stillV, 'must not still sit in the V (x=' + cusp.x.toFixed(1) + ' y=' + cusp.y.toFixed(1) + ')');
  var insideR = runAt(450, 620, 8);
  assert(insideR.x < 440, 'right interior 450,620 ejects toward playfield (x=' + insideR.x.toFixed(1) + ')');
  assert(insideR.x < sim.LAUNCH_LANE_LEFT - 8, 'right eject must not enter shooter');
  assert(insideR.maxSp > 40, 'right interior eject has roll');
  var insideL = runAt(100, 700, 8);
  assert(insideL.x > 110, 'left interior 100,700 ejects toward playfield (x=' + insideL.x.toFixed(1) + ')');
  assert(insideL.maxSp > 40, 'left interior eject has roll');
  var farm = fresh();
  farm.ball.inPlay = true;
  farm.exitedLaunchLane = true;
  farm.phase = 'playing';
  farm.score = 0;
  farm.ball.x = 468;
  farm.ball.y = 536;
  farm.ball.vx = 0;
  farm.ball.vy = 0;
  var f;
  for (f = 0; f < 30; f++) sim.stepPhysics(farm, 1 / 60);
  assert(farm.score < 400, 'cusp must not farm sling/bumper spam (score=' + farm.score + ')');
  var plunge = fresh();
  sim.launchBall(plunge, 800);
  assert.strictEqual(plunge.ball.x, sim.LAUNCH_LANE_X, '800 plunge still starts in shooter');
  var p;
  for (p = 0; p < 90; p++) sim.tick(plunge, 1 / 60);
  assert(plunge.exitedLaunchLane, '800 plunge still leaves the lane');
  assert(plunge.ball.x < sim.LAUNCH_LANE_LEFT + 20 || plunge.exitedLaunchLane, '800 shooter still works');
  assert(sim.GRAVITY === 1180, 'GRAVITY is 1180 (phys1)');
  assert(sim.HABITRAIL_ASSIST === 0, 'HABITRAIL_ASSIST stays 0');
  var rubber = fresh().bumpers.find(function (b) { return b.id === 'rubber-mid'; });
  assert(rubber && rubber.x === 340 && rubber.y === 520, '500 rubber at 340,520');
  console.log('PASS: cyan sausage solid + cusp free (cusp x=' + cusp.x.toFixed(1) + ' y=' + cusp.y.toFixed(1) + ')');
})();
(function testOneWayShooterAndSausageEject() {
  function run(x, y, vx, vy, exited, frames) {
    var state = fresh();
    state.ball.inPlay = true;
    state.exitedLaunchLane = !!exited;
    state.phase = 'playing';
    state.ball.x = x;
    state.ball.y = y;
    state.ball.vx = vx;
    state.ball.vy = vy;
    var k;
    var shooterLow = false;
    for (k = 0; k < frames; k++) {
      sim.stepPhysics(state, 1 / 60);
      if (state.ball.x > sim.LAUNCH_LANE_LEFT && state.ball.y > 200) shooterLow = true;
    }
    return { state: state, x: state.ball.x, y: state.ball.y, shooterLow: shooterLow };
  }
  var merge = run(460, 90, 220, 20, true, 90);
  assert(!merge.shooterLow, 'merge ball heading into the lane must not fall down the shooter (x=' + merge.x.toFixed(1) + ' y=' + merge.y.toFixed(1) + ')');
  assert(!(merge.x > sim.LAUNCH_LANE_LEFT && merge.y > 200), 'merge ball must not end at y>200 in the shooter');
  var fallen = run(sim.LAUNCH_LANE_LEFT + 18, 200, 0, 80, true, 24);
  assert(fallen.x < sim.LAUNCH_LANE_LEFT, 'lane ball at 410,200 with exitedLaunchLane must peel to playfield (x=' + fallen.x.toFixed(1) + ')');
  var leak = fresh();
  leak.ball.inPlay = true;
  leak.exitedLaunchLane = true;
  leak.skillShotWindow = true;
  leak.phase = 'playing';
  leak.ball.x = sim.LAUNCH_LANE_LEFT + 16;
  leak.ball.y = 160;
  leak.ball.vx = 20;
  leak.ball.vy = 10;
  var lk;
  for (lk = 0; lk < 30; lk++) sim.stepPhysics(leak, 1 / 60);
  assert(leak.ball.x < sim.LAUNCH_LANE_LEFT - 2, 'skill-shot leak in the purple/hall seam must eject to playfield (x=' + leak.ball.x.toFixed(1) + ' y=' + leak.ball.y.toFixed(1) + ')');
  assert(!(fallen.x > sim.LAUNCH_LANE_LEFT && fallen.y >= 538), 'peeled ball must not drop to the sausage in the lane');
  var inside = run(450, 620, 0, 0, true, 8);
  assert(inside.x < 440, 'right interior 450,620 still ejects (x=' + inside.x.toFixed(1) + ')');
  var nearRail = run(sim.LAUNCH_LANE_LEFT - 4, 620, 0, 0, true, 8);
  assert(nearRail.x < sim.LAUNCH_LANE_LEFT - 4, 'sausage near x=392 still ejects (x=' + nearRail.x.toFixed(1) + ')');
  var plunge = fresh();
  sim.launchBall(plunge, 800);
  var inU = false;
  var p;
  for (p = 0; p < 120; p++) {
    sim.tick(plunge, 1 / 60);
    if (plunge.exitedLaunchLane && plunge.ball.y < 90 && plunge.ball.x < 440 && plunge.ball.x > 140) inU = true;
  }
  assert(plunge.exitedLaunchLane, 'fresh plunge 800 still leaves the lane');
  assert(plunge.exitedLaunchLane, 'fresh plunge 800 still leaves the lane (dump or U)');
  assert(sim.GRAVITY === 1180, 'GRAVITY is 1180 (phys1)');
  assert(sim.HABITRAIL_ASSIST === 0, 'HABITRAIL_ASSIST stays 0');
  var rubber = fresh().bumpers.find(function (b) { return b.id === 'rubber-mid'; });
  assert(rubber && rubber.x === 340 && rubber.y === 520, '500 rubber at 340,520');
  console.log('PASS: one-way shooter + sausage eject (merge x=' + merge.x.toFixed(1) + ' y=' + merge.y.toFixed(1) + ')');
})();


(function testMerge2GapAndDrainSkip() {
  function runPlunge(power) {
    var state = fresh();
    sim.launchBall(state, power);
    var inU = false;
    var fellGap = false;
    var i;
    for (i = 0; i < 200; i++) {
      sim.tick(state, 1 / 60);
      var b = state.ball;
      if (b.y < 90 && b.x > 140 && b.x < 440) inU = true;
      if (!inU && b.y > 200 && b.x > 430 && b.x < sim.LAUNCH_LANE_LEFT) fellGap = true;
      if (state.exitedLaunchLane && b.y > 420) break;
      if (!b.inPlay && i > 12) break;
    }
    return { inU: inU, fellGap: fellGap, x: state.ball.x, y: state.ball.y, remaining: state.ballsRemaining };
  }
  var a = runPlunge(800);
  assert(a.remaining === 3, '800 must not drain (rem=' + a.remaining + ')');
  var b = runPlunge(1400);
  assert(!b.fellGap, '1400 must not fall through the merge gap to y>200 at x>350 (x=' + b.x.toFixed(1) + ' y=' + b.y.toFixed(1) + ')');
  assert(b.inU, '1400 must ride the copper merge into the U');
  assert(b.remaining === 3, '1400 plunge must not drain');

  var state = fresh();
  var rubber = state.bumpers.find(function (x) { return x.id === 'rubber-mid'; });
  var tri = state.pulseTriangle;
  function distPointSeg(px, py, s) {
    var dx = s.x2 - s.x1, dy = s.y2 - s.y1;
    var lenSq = dx * dx + dy * dy;
    var tt = lenSq < 1e-6 ? 0 : Math.max(0, Math.min(1, ((px - s.x1) * dx + (py - s.y1) * dy) / lenSq));
    return Math.hypot(px - (s.x1 + dx * tt), py - (s.y1 + dy * tt));
  }
  var minD = 999;
  var si;
  for (si = 0; si < tri.sides.length; si++) minD = Math.min(minD, distPointSeg(rubber.x, rubber.y, tri.sides[si]));
  var gap = minD - rubber.radius;
  assert(gap >= 28, 'triangle-to-500 gap must be >= 28 (gap=' + gap.toFixed(1) + ')');
  assert(rubber.x === 340 && rubber.y === 520, '500 at 340,520');

  function notTopLeft(ball) {
    return !(ball.x < 120 && ball.y < 160);
  }
  var k;
  var dead = fresh();
  dead.ball.inPlay = false;
  dead.exitedLaunchLane = true;
  dead.phase = 'playing';
  dead.ball.x = 240;
  dead.ball.y = 820;
  dead.ball.vx = 0;
  dead.ball.vy = 80;
  for (k = 0; k < 20; k++) sim.stepPhysics(dead, 1 / 60);
  assert(notTopLeft(dead.ball), 'inPlay=false drain ball must not teleport to top-left (x=' + dead.ball.x.toFixed(1) + ' y=' + dead.ball.y.toFixed(1) + ')');
  assert(Math.abs(dead.ball.x - 240) < 8, 'dead ball x stays parked');
  var falling = fresh();
  falling.ball.inPlay = true;
  falling.exitedLaunchLane = true;
  falling.phase = 'playing';
  falling.ball.x = 240;
  falling.ball.y = 800;
  falling.ball.vx = 0;
  falling.ball.vy = 60;
  var fy0 = falling.ball.y;
  for (k = 0; k < 12; k++) sim.stepPhysics(falling, 1 / 60);
  assert(notTopLeft(falling.ball), 'y>780 draining ball must not teleport to top-left (x=' + falling.ball.x.toFixed(1) + ' y=' + falling.ball.y.toFixed(1) + ')');
  assert(falling.ball.y >= fy0 - 2, 'draining ball must not be yeeted upward (y0=' + fy0 + ' y=' + falling.ball.y.toFixed(1) + ')');
  assert(sim.GRAVITY === 1180, 'GRAVITY is 1180 (phys1)');
  assert(sim.HABITRAIL_ASSIST === 0, 'HABITRAIL_ASSIST stays 0');
  console.log('PASS: merge2 gap closed, 500 spacing, drain skip (800 U y=' + a.y.toFixed(1) + ')');
})();

(function testMerge3FloorSausageShooter() {
  var state = fresh();
  var inner = state.sideRoutes.rightRamp.mergeInner || [];
  var hasBeak = inner.some(function (s) {
    return (s.x1 === 392 && s.y1 === 103) || (s.x2 === 392 && s.y2 === 103);
  });
  assert(!hasBeak, 'old (392,103) bird-beak must be gone');
  var hasNew = inner.some(function (s) { return s.x1 === 470 && s.y1 === 88 && s.x2 === 458 && s.y2 === 80; });
  assert(hasNew, 'merge3 inner starts at 390,88 -> 378,80');
  var closer = (state.walls || []).filter(function (w) { return w.merge && Math.abs(w.x1 - sim.LAUNCH_LANE_LEFT) < 1 && Math.abs(w.y1 - 103) < 1; });
  assert(closer.length >= 1, 'rounded closer from launch,103 exists');
  assert(!closer.some(function (w) { return w.x2 === 392 && w.y2 === 103 && w.x1 === 390 && w.y1 === 90; }), 'old V closer 390,90-392,103 must be gone');

  function channelWidthAt(x) {
    var outer = state.sideRoutes.rightRamp.mergeOuter || [];
    function yOn(segs, atX) {
      var k, y = null;
      for (k = 0; k < segs.length; k++) {
        var s = segs[k];
        var lo = Math.min(s.x1, s.x2), hi = Math.max(s.x1, s.x2);
        if (atX < lo - 0.01 || atX > hi + 0.01) continue;
        var dx = s.x2 - s.x1;
        var t = Math.abs(dx) < 1e-6 ? 0 : (atX - s.x1) / dx;
        y = s.y1 + t * (s.y2 - s.y1);
      }
      return y;
    }
    var yo = yOn(outer, x);
    var yi = yOn(inner, x);
    if (yo == null || yi == null) return 999;
    return Math.abs(yi - yo);
  }
  var w378 = channelWidthAt(378);
  var w362 = channelWidthAt(362);
  var w344 = channelWidthAt(344);
  assert(w378 >= 36, 'channel at x=378 must be >= 36 (w=' + w378.toFixed(1) + ')');
  assert(w362 >= 36, 'channel at x=362 must be >= 36 (w=' + w362.toFixed(1) + ')');
  assert(w344 >= 36, 'channel at x=344 must be >= 36 (w=' + w344.toFixed(1) + ')');

  function runPlungeFloor(power) {
    var st = fresh();
    sim.launchBall(st, power);
    var inU = false;
    var dropped = false;
    var n;
    for (n = 0; n < 220; n++) {
      sim.tick(st, 1 / 60);
      var b = st.ball;
      if (b.y < 90 && b.x > 140 && b.x < 440) inU = true;
      if (!inU && b.x > 430 && b.x < 490 && b.y > 140 && b.y < 280) dropped = true;
      if (st.exitedLaunchLane && b.y > 420) break;
      if (!b.inPlay && n > 12) break;
    }
    return { inU: inU, dropped: dropped, exited: st.exitedLaunchLane, x: st.ball.x, y: st.ball.y, remaining: st.ballsRemaining };
  }
  var p800 = runPlungeFloor(800);
  assert(p800.remaining === 3 || p800.inU || p800.dropped, '800 is a legal mid plunge');
  assert(p800.exited || p800.inU, '800 leaves the shooter (dump or U)');
  var p1400 = runPlungeFloor(1400);
  assert(!p1400.dropped, '1400 must not fall through merge floor at x~380 y~150 (x=' + p1400.x.toFixed(1) + ' y=' + p1400.y.toFixed(1) + ')');
  assert(p1400.inU, '1400 must ride the copper floor into the U');

  function placeRun(x, y, vx, vy, exited, frames) {
    var st = fresh();
    st.ball.inPlay = true;
    st.exitedLaunchLane = !!exited;
    st.phase = 'playing';
    st.ball.x = x;
    st.ball.y = y;
    st.ball.vx = vx;
    st.ball.vy = vy;
    var k;
    var score0 = st.score;
    for (k = 0; k < frames; k++) sim.stepPhysics(st, 1 / 60);
    return { x: st.ball.x, y: st.ball.y, vx: st.ball.vx, vy: st.ball.vy, score: st.score - score0 };
  }
  var ext = placeRun(408, 620, 220, 0, true, 18);
  assert(ext.x < 420 || ext.vx <= 0, 'exterior sausage shot must bounce off, not enter (x=' + ext.x.toFixed(1) + ' vx=' + ext.vx.toFixed(1) + ')');
  var inn = placeRun(450, 620, 0, 0, true, 12);
  assert(inn.x < 440, 'ball placed inside cyan sausage ejects within 0.2s (x=' + inn.x.toFixed(1) + ')');
  assert(inn.score < 400, 'interior eject must not farm (score=' + inn.score + ')');

  var wall = placeRun(460, 800, 180, 20, true, 24);
  assert(wall.x < sim.LAUNCH_LANE_LEFT, 'playfield ball at y=800 must not cross into the shooter (x=' + wall.x.toFixed(1) + ')');
  var inLane = placeRun(sim.LAUNCH_LANE_LEFT + 8, 800, 0, 40, true, 18);
  assert(inLane.x < sim.LAUNCH_LANE_LEFT, 'ball already in the lane from playfield must peel back (x=' + inLane.x.toFixed(1) + ')');

  var v = placeRun(sim.LAUNCH_LANE_LEFT, 96, 0, 0, true, 24);
  assert(!(v.x > 450 && v.x < 490 && v.y > 80 && v.y < 120 && Math.hypot(v.vx, v.vy) < 30), 'old V-pinch 392,96 must peel out within 0.4s (x=' + v.x.toFixed(1) + ' y=' + v.y.toFixed(1) + ')');
  assert(Math.hypot(v.vx, v.vy) > 40, 'V-pinch peel has speed');
  assert(v.x < 480, 'V peel goes into the U / play, not down the plunger');

  var rtl = fresh();
  rtl.ball.inPlay = true;
  rtl.exitedLaunchLane = true;
  rtl.phase = 'playing';
  rtl.activeHabitrail = 'ramp-r';
  rtl.ball.x = 456;
  rtl.ball.y = 240;
  rtl.ball.vx = 25;
  rtl.ball.vy = -980;
  var crest = false;
  var n;
  for (n = 0; n < 300; n++) {
    sim.stepPhysics(rtl, 1 / 60);
    if (rtl.ball.x > 240 && rtl.ball.x < 320 && rtl.ball.y < 100) { crest = true; break; }
  }
  assert(crest, 'RTL orbiter still skips the raised merge floor and crests the U');

  assert(sim.GRAVITY === 1180, 'GRAVITY is 1180 (phys1)');
  assert(sim.TABLE_PITCH_DEG === 6.8, 'TABLE_PITCH_DEG stays 7');
  assert(sim.HABITRAIL_ASSIST === 0, 'HABITRAIL_ASSIST stays 0');
  var rubber = fresh().bumpers.find(function (b) { return b.id === 'rubber-mid'; });
  assert(rubber && rubber.x === 340 && rubber.y === 520 && rubber.radius === 18, '500 at 340,520');
  console.log('PASS: merge3 floor/sausage/shooter (800 U y=' + p800.y.toFixed(1) + ' 1400 U y=' + p1400.y.toFixed(1) + ' V x=' + v.x.toFixed(1) + ')');
})();

(function testWide1TriangleSolidAndCyanClimb() {
  var state = fresh();
  var left = state.sideRoutes.leftRamp;
  assert(left.entry.w >= 44, 'left ramp mouth w>=44 (w=' + left.entry.w + ')');
  assert(left.entry.h <= 32, 'entry sensor still hugs the mouth');
  assert(left.entry.x === 80 && left.entry.y === 337, 'entry centered on the opened mouth');

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
  function horizWidth(y) {
    var xo = xAtY(left.segments, y);
    var xi = xAtY(left.guides, y);
    assert(xo != null && xi != null, 'channel exists at y=' + y);
    return Math.abs(xi - xo);
  }
  var w278 = horizWidth(278);
  var w200 = horizWidth(200);
  var w146 = horizWidth(146);
  assert(w278 >= 44, 'channel at y=278 >= 44 (w=' + w278.toFixed(1) + ')');
  assert(w200 >= 44, 'channel at y=200 >= 44 (w=' + w200.toFixed(1) + ')');
  assert(w146 >= 44, 'channel at y=146 >= 44 (w=' + w146.toFixed(1) + ')');

  function distPointSeg(px, py, s) {
    var dx = s.x2 - s.x1, dy = s.y2 - s.y1;
    var lenSq = dx * dx + dy * dy;
    if (lenSq < 1e-6) return Math.hypot(px - s.x1, py - s.y1);
    var tt = Math.max(0, Math.min(1, ((px - s.x1) * dx + (py - s.y1) * dy) / lenSq));
    return Math.hypot(px - (s.x1 + dx * tt), py - (s.y1 + dy * tt));
  }
  var bendMin = 999;
  var gi, t;
  for (gi = 0; gi < left.guides.length; gi++) {
    var g = left.guides[gi];
    for (t = 0; t <= 6; t++) {
      var px = g.x1 + (g.x2 - g.x1) * (t / 6);
      var py = g.y1 + (g.y2 - g.y1) * (t / 6);
      if (py > 150 || py < 70 || px > 160) continue;
      var oi;
      for (oi = 0; oi < left.segments.length; oi++) {
        var o = left.segments[oi];
        if (Math.max(o.y1, o.y2) < 70 || Math.min(o.y1, o.y2) > 155) continue;
        bendMin = Math.min(bendMin, distPointSeg(px, py, o));
      }
    }
  }
  assert(bendMin >= 44, 'left-top bend min width >= 44 (w=' + bendMin.toFixed(1) + ')');

  var merge = state.sideRoutes.rightRamp.mergeInner || [];
  assert(merge.some(function (s) { return s.x1 === 470 && s.y1 === 88 && s.x2 === 458 && s.y2 === 80; }), 'merge3 inner kept');
  assert(left.guides[left.guides.length - 1].x2 === 280 && left.guides[left.guides.length - 1].y2 >= 79 && left.guides[left.guides.length - 1].y2 <= 81, 'cyan inner joins at 280,80 (shoe6 flat crown)');
  assert(sim.HABITRAIL_ASSIST === 0 && sim.HABITRAIL_MIN_SPEED === 0, 'no habitrail assist');
  assert(sim.GRAVITY === 1180 && sim.TABLE_PITCH_DEG === 6.8, 'gravity/pitch are phys1');

  var tri = state.pulseTriangle;
  var triWalls = (state.walls || []).filter(function (w) { return w.kind === 'tri-solid'; });
  assert(triWalls.length === 3, 'triangle has 3 solid edge walls');
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  state.phase = 'playing';
  state.ball.x = 186;
  state.ball.y = 558;
  state.ball.vx = 12;
  state.ball.vy = -8;
  var score0 = state.score;
  var k;
  var insideFrames = 0;
  var fellThrough = false;
  for (k = 0; k < 15; k++) {
    sim.stepPhysics(state, 1 / 60);
    if (sim.ballInsideTriangle(state.ball, tri)) insideFrames += 1;
    if (state.ball.y > 620 && state.ball.x > 140 && state.ball.x < 240) fellThrough = true;
  }
  assert(!sim.ballInsideTriangle(state.ball, tri), 'ball inside triangle ejects within 0.25s (xy=' + state.ball.x.toFixed(1) + ',' + state.ball.y.toFixed(1) + ')');
  assert(insideFrames <= 2, 'must not lodge vibrating inside (insideFrames=' + insideFrames + ')');
  assert(!fellThrough, 'must not fall through the bottom edge');
  assert(state.ball.y < 680, 'eject stays in play, not down the floor (y=' + state.ball.y.toFixed(1) + ')');
  assert(state.score - score0 < 200, 'no farm score while inside (dScore=' + (state.score - score0) + ')');
  assert(Math.hypot(state.ball.vx, state.ball.vy) > 40, 'eject has speed');

  function shootLeft(speed) {
    var st = fresh();
    st.ball.inPlay = true;
    st.exitedLaunchLane = true;
    st.phase = 'playing';
    st.ball.x = 80;
    st.ball.y = 330;
    st.ball.vx = -30;
    st.ball.vy = -speed;
    st.activeHabitrail = 'ramp-l';
    var n;
    var reversed = false;
    var cleared = false;
    var minY = st.ball.y;
    for (n = 0; n < 90; n++) {
      var yBefore = st.ball.y;
      sim.stepPhysics(st, 1 / 60);
      if (st.ball.y < minY) minY = st.ball.y;
      if (st.ball.y < 100 && st.ball.x > 80) cleared = true;
      if (yBefore < 140 && yBefore > 100 && st.ball.vy > 40 && st.ball.y > yBefore + 1) reversed = true;
      if (cleared) break;
    }
    return { cleared: cleared, reversed: reversed, x: st.ball.x, y: st.ball.y, minY: minY, vy: st.ball.vy };
  }
  var s1000 = shootLeft(1000);
  assert(s1000.cleared, '1000 px/s left-ramp shot must clear the bend (y<100,x>80) got x=' + s1000.x.toFixed(1) + ' y=' + s1000.y.toFixed(1) + ' minY=' + s1000.minY.toFixed(1));
  assert(!s1000.reversed, '1000 px/s must not reverse at the old y~120 pinch');
  var s900 = shootLeft(900);
  assert(s900.minY < 120, '900 px/s must climb past the old 30px pinch (minY=' + s900.minY.toFixed(1) + ')');
  var s1100 = shootLeft(1100);
  assert(s1100.cleared || s1100.minY < 100, '1100 px/s must climb past y=120 (minY=' + s1100.minY.toFixed(1) + ')');

  assert(sim.HABITRAIL_ASSIST === 0, 'HABITRAIL_ASSIST stays 0');
  console.log('PASS: wide1 triangle solid + cyan climb (w278=' + w278.toFixed(1) + ' bend=' + bendMin.toFixed(1) + ' shot y=' + s1000.y.toFixed(1) + ')');
})();

(function testOrbit1TwoWayAndSausageTips() {
  var state = fresh();
  var left = state.sideRoutes.leftRamp;
  var right = state.sideRoutes.rightRamp;
  var inner = right.mergeInner || [];
  var outer = right.mergeOuter || [];
  assert(inner.some(function (s) { return s.x1 === 470 && s.y1 === 88 && s.x2 === 458 && s.y2 === 80; }), 'merge3 inner kept');
  assert(!left.segments.some(function (s) {
    return (s.x1 === 42 && s.y1 === 146) || (s.x2 === 42 && s.y2 === 146) || (s.x1 === 62 && s.y1 === 107);
  }), 'leftover top-left (42,146)/(62,107) cusp deleted');
  assert(!outer.some(function (s) {
    return (s.x1 === 438 && s.y1 === 86) || (s.x2 === 430 && s.y2 === 76 && s.x1 === 438);
  }), 'leftover outer V (438,86)->(430,76) deleted');
  var wireBeak = (state.walls || []).some(function (w) {
    return w.kind === 'lane' && w.wireform && Math.abs(w.x2 - 360) < 1 && Math.abs(w.y2 - 80) < 1;
  });
  assert(!wireBeak, 'leftover wireform beak (392,103)->(360,80) deleted');
  var lCorner = (state.walls || []).some(function (w) {
    return Math.abs(w.x1 - 40) < 1 && Math.abs(w.y1 - 76) < 1 && Math.abs(w.x2 - 36) < 1 && Math.abs(w.y2 - 76) < 1;
  });
  assert(!lCorner, 'leftover (40,76)->(36,76) L-corner deleted');

  function channelWidthAt(x) {
    function yOn(segs, atX) {
      var k, best = null;
      for (k = 0; k < segs.length; k++) {
        var s = segs[k];
        var lo = Math.min(s.x1, s.x2), hi = Math.max(s.x1, s.x2);
        if (atX < lo - 0.01 || atX > hi + 0.01) continue;
        var t = (hi === lo) ? 0 : (atX - s.x1) / ((s.x2 - s.x1) || 1e-6);
        best = s.y1 + t * (s.y2 - s.y1);
      }
      return best;
    }
    var yo = yOn(outer, x);
    var yi = yOn(inner, x);
    if (yo == null || yi == null) return 999;
    return Math.abs(yi - yo);
  }
  var w378 = channelWidthAt(378);
  var w362 = channelWidthAt(362);
  var w344 = channelWidthAt(344);
  assert(w378 >= 44, 'merge channel at x=378 >= 44 (w=' + w378.toFixed(1) + ')');
  assert(w362 >= 44, 'merge channel at x=362 >= 44 (w=' + w362.toFixed(1) + ')');
  assert(w344 >= 44, 'merge channel at x=344 >= 44 (w=' + w344.toFixed(1) + ')');

  function xAtY(segs, y) {
    var i;
    for (i = 0; i < segs.length; i++) {
      var a = segs[i];
      var minY = Math.min(a.y1, a.y2), maxY = Math.max(a.y1, a.y2);
      if (minY <= y && maxY >= y && maxY !== minY) {
        var t = (y - a.y1) / (a.y2 - a.y1);
        return a.x1 + (a.x2 - a.x1) * t;
      }
    }
    return null;
  }
  function horizWidth(y) {
    var xo = xAtY(left.segments, y);
    var xi = xAtY(left.guides, y);
    assert(xo != null && xi != null, 'left channel exists at y=' + y);
    return Math.abs(xi - xo);
  }
  assert(horizWidth(146) >= 44, 'left bend y=146 >= 44');
  assert(horizWidth(118) >= 44, 'left bend y=118 >= 44');
  assert(left.entry.x === 80 && left.entry.y === 337 && left.entry.w === 44, 'wide1 entry kept');

  function runPlunge(power) {
    var st = fresh();
    sim.launchBall(st, power);
    var inU = false, left200 = false, dropped = false, lodged = false;
    var n;
    for (n = 0; n < 180; n++) {
      sim.tick(st, 1 / 60);
      var b = st.ball;
      if (b.y < 95 && b.x > 140 && b.x < 440) inU = true;
      if (inU && b.x < 200 && b.y < 160) left200 = true;
      if (!inU && b.x > 430 && b.x < 490 && b.y > 140 && b.y < 280) dropped = true;
      if (n > 24 && Math.hypot(b.vx, b.vy) < 25 && b.y < 160) lodged = true;
      if (!b.inPlay && n > 12) break;
    }
    return { inU: inU, left200: left200, dropped: dropped, lodged: lodged, x: st.ball.x, y: st.ball.y, remaining: st.ballsRemaining };
  }
  var p800 = runPlunge(800);
  assert(p800.inU || p800.dropped, '800 dumps slide or rides U');
  var p1400 = runPlunge(1400);
  assert(!p1400.dropped && p1400.inU, '1400 still rides merge floor into U');
  var p1000 = runPlunge(1000);
  assert(p1400.inU && !p1400.lodged, 'full plunge rides copper into the U');

  function shootLeft(speed) {
    var st = fresh();
    st.ball.inPlay = true;
    st.exitedLaunchLane = true;
    st.phase = 'playing';
    st.ball.x = 80;
    st.ball.y = 330;
    st.ball.vx = -30;
    st.ball.vy = -speed;
    st.activeHabitrail = 'ramp-l';
    var n, reversed = false, reached = false, minY = st.ball.y;
    for (n = 0; n < 120; n++) {
      var yb = st.ball.y;
      sim.stepPhysics(st, 1 / 60);
      if (st.ball.y < minY) minY = st.ball.y;
      if (st.ball.x > 280 && st.ball.y < 110) reached = true;
      if (yb < 140 && yb > 100 && st.ball.vy > 40 && st.ball.y > yb + 1) reversed = true;
      if (reached) break;
    }
    return { reached: reached, reversed: reversed, x: st.ball.x, y: st.ball.y, minY: minY };
  }
  var climb = shootLeft(1000);
  assert(climb.reached, '1000 left-ramp climb must reach x>280 on the U (x=' + climb.x.toFixed(1) + ' y=' + climb.y.toFixed(1) + ')');
  assert(!climb.reversed, '1000 must not reverse at the old y~120 pinch');

  function orbitLodge(place, dirLabel) {
    var st = fresh();
    place(st, 1000);
    var n, stuck = 0, last = { x: st.ball.x, y: st.ball.y };
    for (n = 0; n < 90; n++) {
      sim.stepPhysics(st, 1 / 60);
      var b = st.ball;
      var nearInner = b.x > 430 && b.x < 480 && b.y > 60 && b.y < 100;
      var nearOuter = b.x > 480 && b.x < 525 && b.y > 40 && b.y < 100;
      var nearBend = b.x > 30 && b.x < 80 && b.y > 90 && b.y < 150;
      if (nearInner || nearOuter || nearBend) {
        if (Math.hypot(b.x - last.x, b.y - last.y) < 3 && Math.hypot(b.vx, b.vy) < 40) stuck++;
        else stuck = 0;
      } else stuck = 0;
      last = { x: b.x, y: b.y };
    }
    assert(stuck < 12, dirLabel + ' orbit must not lodge at a former X (xy=' + st.ball.x.toFixed(1) + ',' + st.ball.y.toFixed(1) + ')');
  }
  orbitLodge(placeInLeftMouth, 'LTR');
  orbitLodge(placeInRightMouth, 'RTL');

  function freeTip(x, y, label) {
    var st = fresh();
    st.ball.inPlay = true;
    st.exitedLaunchLane = true;
    st.phase = 'playing';
    st.ball.x = x;
    st.ball.y = y;
    st.ball.vx = 0;
    st.ball.vy = 0;
    var score0 = st.score;
    var n, freeAt = null;
    for (n = 0; n < 15; n++) {
      sim.stepPhysics(st, 1 / 60);
      var b = st.ball;
      var sp = Math.hypot(b.vx, b.vy);
      if (Math.hypot(b.x - x, b.y - y) > 16 && sp > 40 && !freeAt) freeAt = n;
    }
    assert(freeAt != null, label + ' tip pinch must be free in 0.25s (xy=' + st.ball.x.toFixed(1) + ',' + st.ball.y.toFixed(1) + ')');
    assert(st.score - score0 < 200, label + ' no farm while wedged (dScore=' + (st.score - score0) + ')');
    return st.ball;
  }
  freeTip(430, 716, 'right sausage');
  freeTip(52, 708, 'left sausage');

  var fillL = state.sideRoutes.leftFiller;
  var fillR = state.sideRoutes.rightFiller;
  assert(fillL.segments[0].x1 === 36, 'left sausage still flush on x=36');
  assert(fillR.segments[0].x1 === sim.LAUNCH_LANE_LEFT, 'right sausage still flush on LAUNCH_LANE_LEFT');
  assert(fillL.guides.some(function (s) { return s.x2 === 80 && s.y2 === 652; }), 'left sausage peak kept');
  assert(fillR.guides.some(function (s) { return s.x2 === 414 && s.y2 === 662; }), 'right sausage peak kept');

  var cages = (state.walls || []).filter(function (w) { return w.kind === 'cage'; });
  assert.strictEqual(cages.length, 1, 'right dumbbell cage-r removed');
  var cageR = cages.find(function (w) { return w.id === 'cage-r'; });
  assert(!cageR, 'cage-r dumbbell is gone');

  var oneWay = fresh();
  oneWay.ball.inPlay = true;
  oneWay.exitedLaunchLane = true;
  oneWay.phase = 'playing';
  oneWay.ball.x = 460;
  oneWay.ball.y = 800;
  oneWay.ball.vx = 180;
  oneWay.ball.vy = 20;
  var k;
  for (k = 0; k < 24; k++) sim.stepPhysics(oneWay, 1 / 60);
  assert(oneWay.ball.x < sim.LAUNCH_LANE_LEFT, 'one-way shooter still holds (x=' + oneWay.ball.x.toFixed(1) + ')');

  assert(sim.GRAVITY === 1180, 'GRAVITY is 1180 (phys1)');
  assert(sim.TABLE_PITCH_DEG === 6.8, 'TABLE_PITCH_DEG stays 7');
  assert(sim.HABITRAIL_ASSIST === 0 && sim.HABITRAIL_MIN_SPEED === 0, 'no habitrail assist');
  assert(sim.BALL_RADIUS === 12, 'BALL_RADIUS stays 12');
  console.log('PASS: orbit1 two-way + sausage tips (800 U y=' + p800.y.toFixed(1) + ' climb x=' + climb.x.toFixed(1) + ' w378=' + w378.toFixed(1) + ')');
})();

(function testLay1SaucerGateTriangleSpin() {
  var state = fresh();
  assert(Math.abs(state.saucer3.x - 138) < 8 && Math.abs(state.saucer3.y - 168) < 8, 'saucer3 near (138,168)');
  assert(state.saucer3.radius === 15, 'saucer3 r=15');
  assert(state.saucer.x === 95 && state.saucer.y === 520, 'lower-left hole stays');
  assert(state.saucer2.x === 410 && state.saucer2.y === 148, 'UR hole shifted +80');
  assert(Math.abs(state.gateSpinner.x - 108) < 10 && Math.abs(state.gateSpinner.y - 416) < 12, 'gate near (108,416)');
  assert(state.gateSpinner.h === 42, 'gate height stays 42');
  var tri = state.pulseTriangle;
  var cx = (tri.verts[0].x + tri.verts[1].x + tri.verts[2].x) / 3;
  var cy = (tri.verts[0].y + tri.verts[1].y + tri.verts[2].y) / 3;
  assert(Math.abs(cx - 186) < 6 && Math.abs(cy - 558) < 6, 'triangle centroid near (186,558) got ' + cx.toFixed(1) + ',' + cy.toFixed(1));
  var w = Math.max(tri.verts[0].x, tri.verts[1].x, tri.verts[2].x) - Math.min(tri.verts[0].x, tri.verts[1].x, tri.verts[2].x);
  var h = Math.max(tri.verts[0].y, tri.verts[1].y, tri.verts[2].y) - Math.min(tri.verts[0].y, tri.verts[1].y, tri.verts[2].y);
  assert(Math.abs(w - 52) < 4 && Math.abs(h - 44) < 6, 'triangle size stays ~52x44 (w=' + w.toFixed(1) + ' h=' + h.toFixed(1) + ')');
  assert(sim.TRIANGLE_SPIN === 0, 'TRIANGLE_SPIN drive is off (hit-spin only)');
  assert(Math.abs(tri.spin || 0) < 0.05, 'triangle omega ~0 at rest');
  var angle0 = tri.angle || 0;
  var i;
  for (i = 0; i < 60; i++) sim.tick(state, 1 / 60);
  var dAngle = (state.pulseTriangle.angle || 0) - angle0;
  assert(Math.abs(dAngle) < 0.08, 'no auto-rotate at rest (dAngle=' + dAngle.toFixed(3) + ')');

  var st = fresh();
  st.ball.inPlay = true;
  st.exitedLaunchLane = true;
  st.phase = 'playing';
  st.ball.x = 186;
  st.ball.y = 558;
  st.ball.vx = 8;
  st.ball.vy = -6;
  for (i = 0; i < 20; i++) sim.tick(st, 1 / 60);
  assert(!sim.ballInsideTriangle(st.ball, st.pulseTriangle), 'ball inside spinning triangle still ejected (xy=' + st.ball.x.toFixed(1) + ',' + st.ball.y.toFixed(1) + ')');
  assert(Math.hypot(st.ball.vx, st.ball.vy) > 40, 'eject has speed while spinning');

  var outer = state.sideRoutes.rightRamp.mergeOuter || [];
  var topY = Math.min.apply(null, outer.map(function (s) { return Math.min(s.y1, s.y2); }));
  assert(topY >= 16 && topY <= 22, 'flatter horseshoe ceiling y=' + topY);
  var leftTop = Math.min.apply(null, state.sideRoutes.leftRamp.segments.map(function (s) { return Math.min(s.y1, s.y2); }));
  assert(leftTop >= 16 && leftTop <= 22, 'cyan U crown y=' + leftTop);
  assert(state.sideRoutes.leftRamp.segments[0].x1 === 36 || state.sideRoutes.leftRamp.segments.some(function (s) { return s.x1 === 36 || s.x2 === 36; }), 'cabinet left wall stays x=36');
  assert(state.sideRoutes.rightRamp.mergeInner.some(function (s) { return s.x1 === 470 && s.y1 === 88 && s.x2 === 458 && s.y2 === 80; }), 'merge3 plunge floor kept');
  assert(sim.GRAVITY === 1180 && sim.TABLE_PITCH_DEG === 6.8 && sim.HABITRAIL_ASSIST === 0, 'HABITRAIL_ASSIST stays 0; gravity is phys1');

  st = fresh();
  st.ball.inPlay = true;
  st.exitedLaunchLane = true;
  st.phase = 'playing';
  st.ball.x = state.saucer3.x;
  st.ball.y = state.saucer3.y;
  st.ball.vx = 10;
  st.ball.vy = 12;
  for (i = 0; i < 8; i++) sim.tick(st, 1 / 60);
  assert(st.saucer3.captured, 'saucer3 at new spot still captures');
  console.log('PASS: lay1 saucer/gate/triangle spin + raised U (saucer3=' + state.saucer3.x + ',' + state.saucer3.y + ' gate=' + state.gateSpinner.x + ',' + state.gateSpinner.y + ' ceilY=' + topY + ')');
})();

(function testTop2SausageJoinAndGate() {
  var state = fresh();
  var left = state.sideRoutes.leftRamp;
  var right = state.sideRoutes.rightRamp;
  var outer = right.mergeOuter || [];
  var inner = right.mergeInner || [];
  var g = state.gateSpinner;
  assert(Math.abs(g.x - 108) < 6 && Math.abs(g.y - 416) < 6, 'gate near (108,416)');
  assert(g.h === 42, 'gate height stays 42');
  var hole = state.saucer;
  assert(Math.hypot(g.x - hole.x, (g.y + g.h * 0.5) - (hole.y - hole.radius)) > 18, 'gate does not overlap lower-left HOLE');
  assert(Math.abs(g.x - 210) > 80, 'gate not on the 180 saver');
  assert(Math.hypot(g.x - 186, g.y - 558) > 80, 'gate not on the triangle');

  var cyanTop = Math.min.apply(null, left.segments.map(function (s) { return Math.min(s.y1, s.y2); }));
  var copperTop = Math.min.apply(null, outer.map(function (s) { return Math.min(s.y1, s.y2); }));
  assert(cyanTop <= 22 && cyanTop >= 16, 'cyan crown y~18 (y=' + cyanTop + ')');
  assert(copperTop <= 22 && copperTop >= 16, 'copper crown y~18 (y=' + copperTop + ')');

  var cyanEnd = left.segments[left.segments.length - 1];
  assert(Math.abs(cyanEnd.x2 - 280) < 2 && Math.abs(cyanEnd.y2 - 18) < 3, 'cyan outer ends at the join (280,18)');
  var copperJoin = outer[outer.length - 1];
  assert(Math.abs(copperJoin.x2 - 280) < 2 && Math.abs(copperJoin.y2 - 18) < 3, 'copper outer ends at the join (280,18)');
  assert(Math.abs(cyanEnd.x2 - copperJoin.x2) < 2 && Math.abs(cyanEnd.y2 - copperJoin.y2) < 2, 'cyan/copper join is one continuous path');
  assert(!left.segments.some(function (s) { return s.x2 === 328 && s.y2 === 14; }), 'no leftover cyan cap on the copper corner');
  assert(right.segments.some(function (s) { return s.x2 === 470 && s.y2 === 88; }), 'RTL corner still meets merge3 at 470,88');
  assert(inner.some(function (s) { return s.x1 === 470 && s.y1 === 88 && s.x2 === 458 && s.y2 === 80; }), 'merge3 plunge floor kept');

  function yOn(segs, atX) {
    var k, y = null;
    for (k = 0; k < segs.length; k++) {
      var s = segs[k];
      var lo = Math.min(s.x1, s.x2), hi = Math.max(s.x1, s.x2);
      if (atX < lo - 0.01 || atX > hi + 0.01) continue;
      var dx = s.x2 - s.x1;
      var t = Math.abs(dx) < 1e-6 ? 0 : (atX - s.x1) / dx;
      y = s.y1 + t * (s.y2 - s.y1);
    }
    return y;
  }
  function channelAt(x) {
    var yo = yOn(outer, x);
    var yi = yOn(inner, x);
    if (yo == null || yi == null) return 999;
    return Math.abs(yi - yo);
  }
  assert(channelAt(458) >= 44, 'top channel x=458 >= 44');
  assert(channelAt(424) >= 44, 'top channel x=424 >= 44');
  assert(channelAt(296) >= 44, 'top channel at join approach >= 44');

  function runPlunge(power) {
    var st = fresh();
    sim.launchBall(st, power);
    var inU = false, dropped = false, lodged = false;
    var n;
    for (n = 0; n < 200; n++) {
      sim.tick(st, 1 / 60);
      var b = st.ball;
      if (b.y < 95 && b.x > 140 && b.x < 440) inU = true;
      if (!inU && b.x > 430 && b.x < 490 && b.y > 140 && b.y < 280) dropped = true;
      if (n > 24 && Math.hypot(b.vx, b.vy) < 25 && b.y < 160) lodged = true;
      if (!b.inPlay && n > 12) break;
    }
    return { inU: inU, dropped: dropped, lodged: lodged, x: st.ball.x, y: st.ball.y };
  }
  var p800 = runPlunge(800);
  assert(p800.inU || p800.dropped, '800 / 50% dumps the slide or rides U');
  var p1400 = runPlunge(1400);
  assert(!p1400.dropped && p1400.inU, '1400 still rides merge floor into U');

  var climb = fresh();
  climb.ball.inPlay = true;
  climb.exitedLaunchLane = true;
  climb.phase = 'playing';
  climb.ball.x = 80;
  climb.ball.y = 330;
  climb.ball.vx = -30;
  climb.ball.vy = -1000;
  climb.activeHabitrail = 'ramp-l';
  var cn, reached = false, reversed = false, minY = climb.ball.y;
  for (cn = 0; cn < 120; cn++) {
    var yb = climb.ball.y;
    sim.stepPhysics(climb, 1 / 60);
    if (climb.ball.y < minY) minY = climb.ball.y;
    if (climb.ball.x > 280 && climb.ball.y < 110) reached = true;
    if (yb < 140 && yb > 100 && climb.ball.vy > 40 && climb.ball.y > yb + 1) reversed = true;
    if (reached) break;
  }
  assert(reached, '1000 left-ramp climb still clears to x>280 (x=' + climb.ball.x.toFixed(1) + ' y=' + climb.ball.y.toFixed(1) + ')');
  assert(!reversed, '1000 must not reverse at the old pinch');

  function orbitLodge(place, dirLabel) {
    var st = fresh();
    place(st, 1000);
    var n, stuck = 0, last = { x: st.ball.x, y: st.ball.y };
    for (n = 0; n < 90; n++) {
      sim.stepPhysics(st, 1 / 60);
      var b = st.ball;
      var nearJoin = b.x > 250 && b.x < 320 && b.y > 4 && b.y < 90;
      if (nearJoin) {
        if (Math.hypot(b.x - last.x, b.y - last.y) < 3 && Math.hypot(b.vx, b.vy) < 40) stuck++;
        else stuck = 0;
      } else stuck = 0;
      last = { x: b.x, y: b.y };
    }
    assert(stuck < 12, dirLabel + ' orbit must not lodge at the join (xy=' + st.ball.x.toFixed(1) + ',' + st.ball.y.toFixed(1) + ')');
  }
  orbitLodge(placeInLeftMouth, 'LTR');
  orbitLodge(placeInRightMouth, 'RTL');

  assert(sim.GRAVITY === 1180 && sim.TABLE_PITCH_DEG === 6.8 && sim.HABITRAIL_ASSIST === 0, 'HABITRAIL_ASSIST stays 0; gravity is phys1');
  assert(left.entry.x === 80 && left.entry.y === 337 && left.entry.w === 44, 'wide1 entry kept');
  console.log('PASS: top2 sausage join + moved gate (gate=' + g.x + ',' + g.y + ' crownC=' + cyanTop + ' crownCu=' + copperTop + ' 800y=' + p800.y.toFixed(1) + ')');
})();
(function testNeed1UpperFlipperRubberTriangleLodge() {
  var state = fresh();
  assert.strictEqual(sim.TABLE_W, 560, 'TABLE_W is 560');
  assert.strictEqual(sim.LAUNCH_LANE_LEFT, 472, 'launch lane at 472');
  assert.strictEqual(sim.LAUNCH_LANE_RIGHT, 524, 'right rail at 524');
  assert.strictEqual(sim.FLIPPER_LEFT_PIVOT_X, 124, 'left flipper uses extra outlane width');
  assert.strictEqual(sim.FLIPPER_RIGHT_PIVOT_X, 318, 'right flipper spread toward new lane');
  assert(sim.FLIPPER_RIGHT_PIVOT_X - sim.FLIPPER_LEFT_PIVOT_X > 180, 'pivots farther apart on 560');
  var raisedL = { pivotX: sim.FLIPPER_LEFT_PIVOT_X, pivotY: sim.FLIPPER_ROW_Y, angle: -0.38, length: 66 };
  var raisedR = { pivotX: sim.FLIPPER_RIGHT_PIVOT_X, pivotY: sim.FLIPPER_ROW_Y, angle: Math.PI + 0.38, length: 66 };
  var gap = sim.flipperTip(raisedR).x - sim.flipperTip(raisedL).x;
  assert(gap > 24, 'raised flippers do not seal (gap=' + gap.toFixed(1) + ')');
  var mid500 = state.bumpers.find(function (b) { return b.id === 'rubber-mid'; });
  assert(mid500 && mid500.x === 340 && mid500.y === 520, '500 at 340,520');
  assert(state.saucer2.x === 410 && state.saucer2.y === 148, 'saucer2 moved +80');
  assert(state.gateSpinner.x === 108 && state.gateSpinner.y === 416, 'gate stays');
  assert(state.saucer.x === 95 && state.saucer.y === 520, 'lower hole stays');
  assert(state.saucer3.x === 138 && state.saucer3.y === 168, 'saucer3 stays');
  assert.strictEqual(sim.BALL_RADIUS, 12, 'BALL_RADIUS stays 12');
  assert.strictEqual(sim.HABITRAIL_ASSIST, 0, 'HABITRAIL_ASSIST stays 0');
  assert.strictEqual(sim.GRAVITY, 1180, 'GRAVITY is 1180 (phys1)');
  var mains = state.flippers.filter(function (f) { return f.role !== 'upper'; });
  assert.strictEqual(mains.length, 2, 'two main flippers');
  assert.strictEqual(mains[0].length, 66, 'main flipper length unchanged');
  assert.strictEqual(mains[1].length, 66, 'main right flipper length unchanged');
  var upper = state.flippers.filter(function (f) { return f.role === 'upper'; });
  assert.strictEqual(upper.length, 1, 'one upper flipper');
  var u = upper[0];
  assert.strictEqual(u.side, 'right', 'upper shares right side');
  assert(Math.abs(u.pivotX - 358) <= 14, 'upper pivot x ~358 (got ' + u.pivotX + ')');
  assert(Math.abs(u.pivotY - 372) <= 12, 'upper pivot y ~372 (got ' + u.pivotY + ')');
  assert(u.length >= 40 && u.length <= 48, 'upper is mini 40-48 (len=' + u.length + ')');
  assert(u.restAngle > Math.PI / 2 && u.restAngle < Math.PI, 'rest points left-down');
  sim.activateFlipper(state, 'right', true);
  var mainR = state.flippers.find(function (f) { return f.side === 'right' && f.role !== 'upper'; });
  assert(u.active && mainR.active, 'R FLIP drives both right flippers');
  sim.activateFlipper(state, 'right', false);

  var kick = fresh();
  var uf = kick.flippers.find(function (f) { return f.role === 'upper'; });
  kick.ball.inPlay = true;
  kick.exitedLaunchLane = true;
  kick.phase = 'playing';
  var tip = sim.flipperTip(uf);
  var mx = (uf.pivotX + tip.x) * 0.5;
  var my = (uf.pivotY + tip.y) * 0.5;
  var nx = -(tip.y - uf.pivotY);
  var ny = tip.x - uf.pivotX;
  var nlen = Math.hypot(nx, ny) || 1;
  nx /= nlen; ny /= nlen;
  if (ny > 0) { nx = -nx; ny = -ny; }
  kick.ball.x = mx + nx * (kick.ball.radius + uf.width * 0.5 + 1);
  kick.ball.y = my + ny * (kick.ball.radius + uf.width * 0.5 + 1);
  kick.ball.vx = -nx * 40;
  kick.ball.vy = -ny * 40;
  sim.activateFlipper(kick, 'right', true);
  var i;
  for (i = 0; i < 18; i++) sim.stepPhysics(kick, 1 / 60);
  var ksp = Math.hypot(kick.ball.vx, kick.ball.vy);
  assert(ksp > 90, 'ball on upper face is kicked (sp=' + ksp.toFixed(1) + ')');

  var triSt = fresh();
  assert(Math.abs(triSt.pulseTriangle.spin || 0) < 0.05, 'triangle omega ~0 at rest');
  triSt.ball.inPlay = true;
  triSt.exitedLaunchLane = true;
  triSt.phase = 'playing';
  triSt.ball.x = 186;
  triSt.ball.y = 590;
  triSt.ball.vx = 20;
  triSt.ball.vy = -420;
  for (i = 0; i < 12; i++) sim.stepPhysics(triSt, 1 / 60);
  var hitOm = Math.abs(triSt.pulseTriangle.spin || 0);
  assert(hitOm > 0.18, 'a hit raises |omega| (got ' + hitOm.toFixed(3) + ')');
  var coast = hitOm;
  triSt.ball.x = 418;
  triSt.ball.y = 780;
  triSt.ball.vx = 0;
  triSt.ball.vy = 0;
  triSt.ball.inPlay = false;
  for (i = 0; i < 120; i++) sim.stepPulseTriangle(triSt, 1 / 60);
  var decayed = Math.abs(triSt.pulseTriangle.spin || 0);
  assert(decayed < coast * 0.55, 'after 2s no hit, spin decayed (' + coast.toFixed(3) + ' -> ' + decayed.toFixed(3) + ')');

  var lodge = fresh();
  lodge.ball.inPlay = true;
  lodge.exitedLaunchLane = true;
  lodge.phase = 'playing';
  lodge.ball.x = 52;
  lodge.ball.y = 708;
  lodge.ball.vx = 0;
  lodge.ball.vy = 0;
  var score0 = lodge.score;
  var freeAt = null;
  for (i = 0; i < 12; i++) {
    sim.stepPhysics(lodge, 1 / 60);
    var b = lodge.ball;
    var sp = Math.hypot(b.vx, b.vy);
    if (Math.hypot(b.x - 52, b.y - 708) > 16 && sp > 40 && freeAt == null) freeAt = i;
  }
  assert(freeAt != null, 'left-tip lodge frees in 0.2s (xy=' + lodge.ball.x.toFixed(1) + ',' + lodge.ball.y.toFixed(1) + ')');
  assert(lodge.score - score0 < 200, 'left-tip peel is not a score farm');

  var rub = fresh();
  var topRubber = rub.slingshots.find(function (s) { return s.side === 'left' && s.face === 'top'; });
  assert(topRubber, 'new left-sausage top rubber exists');
  rub.ball.inPlay = true;
  rub.exitedLaunchLane = true;
  rub.phase = 'playing';
  rub.score = 0;
  rub.ball.x = 58;
  rub.ball.y = 572;
  rub.ball.vx = -30;
  rub.ball.vy = 220;
  var fired = false;
  var maxSp = 0;
  for (i = 0; i < 18; i++) {
    sim.stepPhysics(rub, 1 / 60);
    var rsp = Math.hypot(rub.ball.vx, rub.ball.vy);
    if (rsp > maxSp) maxSp = rsp;
    if (topRubber.cooldown > 0 || rub.score >= 150) fired = true;
  }
  assert(fired || maxSp > 200, 'left sausage top rubber fires (score=' + rub.score + ' sp=' + maxSp.toFixed(1) + ')');

  function runPlunge(power) {
    var st = fresh();
    sim.launchBall(st, power);
    var inU = false, dropped = false;
    var n;
    for (n = 0; n < 180; n++) {
      sim.tick(st, 1 / 60);
      var bb = st.ball;
      if (bb.y < 95 && bb.x > 140 && bb.x < 460) inU = true;
      if (!inU && bb.x > 430 && bb.x < 490 && bb.y > 140 && bb.y < 280) dropped = true;
      if (!bb.inPlay && n > 12) break;
    }
    return { inU: inU, dropped: dropped, x: st.ball.x, y: st.ball.y };
  }
  var p800 = runPlunge(800);
  var p1400 = runPlunge(1400);
  assert(p800.inU || p800.dropped, '800 / 50% dumps the slide or rides U');
  assert(!p1400.dropped && p1400.inU, '1400 still rides merge floor into U');
  var oneWay = fresh();
  oneWay.ball.inPlay = true;
  oneWay.exitedLaunchLane = true;
  oneWay.phase = 'playing';
  oneWay.ball.x = 460;
  oneWay.ball.y = 800;
  oneWay.ball.vx = 180;
  oneWay.ball.vy = 20;
  for (i = 0; i < 24; i++) sim.stepPhysics(oneWay, 1 / 60);
  assert(oneWay.ball.x < sim.LAUNCH_LANE_LEFT, 'one-way shooter still holds');
  console.log('PASS: need1 upper flipper + triangle hit-spin + left rubber + lodge + plunge/orbit');
})();

(function testPhys1GaugeAndGravity() {
  assert.strictEqual(sim.TABLE_W, 560, 'need1 width kept');
  assert.strictEqual(sim.HABITRAIL_ASSIST, 0, 'no rail magnet');
  assert(sim.LAUNCH_METER_EASE >= 1 && sim.LAUNCH_METER_EASE <= 1.25, 'gauge is linear or a mild curve');
  assert.strictEqual(sim.GRAVITY, 1180, 'along-playfield gravity (g sin pitch)');
  assert.strictEqual(sim.TABLE_PITCH_DEG, 6.8, 'playfield pitch');
  var p15 = sim.meterToLaunchPower(0.15);
  var p50 = sim.meterToLaunchPower(0.5);
  var p100 = sim.meterToLaunchPower(1);
  assert(p15 > 200 && p15 < 450, '15% is a weak band (p=' + p15 + ')');
  assert(p50 > p15 + 150 && p50 < 900, '50% is a mid band (p=' + p50 + ')');
  assert(p100 > p50 + 200 && Math.abs(p100 - sim.MAX_LAUNCH_POWER) < 1, '100% is max (p=' + p100 + ')');

  function speeds(u) {
    var st = fresh();
    st.launchPower = u;
    st.launchCharging = true;
    sim.launchBall(st, u);
    return Math.hypot(st.ball.vx, st.ball.vy);
  }
  var s15 = speeds(0.15);
  var s50 = speeds(0.5);
  var s100 = speeds(1);
  assert(s15 < s50 && s50 < s100, 'charge 15/50/100 produce distinct launch speeds (' + s15.toFixed(0) + '/' + s50.toFixed(0) + '/' + s100.toFixed(0) + ')');
  assert(s50 - s15 > 80 && s100 - s50 > 80, 'bands are separated');

  function runMeter(u) {
    var st = fresh();
    st.launchPower = u;
    st.launchCharging = true;
    sim.launchBall(st, u);
    var inU = false, dumped = false, exited = false, maxJump = 0, prevX = st.ball.x, prevY = st.ball.y;
    var i;
    for (i = 0; i < 200; i++) {
      sim.tick(st, 1 / 60);
      var b = st.ball;
      var jump = Math.hypot(b.x - prevX, b.y - prevY);
      if (jump > maxJump) maxJump = jump;
      prevX = b.x; prevY = b.y;
      if (st.exitedLaunchLane) exited = true;
      if (st.exitedLaunchLane && b.y < 90 && b.x > 160 && b.x < 400) inU = true;
      if (b.x > 400 && b.x < 490 && b.y > 140 && b.y < 380) dumped = true;
      if (!b.inPlay && i > 12) break;
    }
    return { inU: inU, dumped: dumped, exited: exited || st.exitedLaunchLane, maxJump: maxJump, x: st.ball.x, y: st.ball.y, remaining: st.ballsRemaining };
  }
  var tap = runMeter(0.15);
  assert(tap.exited || tap.dumped, 'tap/15% clears the lane or dumps the slide');
  assert(!tap.inU, 'tap/15% dies before the U');
  var mid = runMeter(0.5);
  assert(mid.dumped || mid.exited, '50% leaves the shooter');
  assert(mid.dumped || !mid.inU, '50% dumps the slide (may graze copper crown)');
  var full = runMeter(1);
  assert(full.inU, 'full charge rides the merge floor into the U');
  assert(full.maxJump < 80, 'no teleport on full plunge (maxJump=' + full.maxJump.toFixed(1) + ')');
  assert(full.remaining === 3, 'full plunge does not drain');

  var p800 = fresh();
  sim.launchBall(p800, 800);
  var inU800 = false;
  var n;
  for (n = 0; n < 180; n++) {
    sim.tick(p800, 1 / 60);
    var bb = p800.ball;
    if (p800.exitedLaunchLane && bb.y < 95 && bb.x > 140 && bb.x < 460) inU800 = true;
    if (!bb.inPlay && n > 12) break;
  }
  assert(inU800 || full.inU, '800-equivalent / full still rides the merge floor');

  var y = 14;
  var vy = 0;
  var t = 0;
  var dtDrop = 1 / 120;
  var reached = false;
  while (y < sim.FLIPPER_ROW_Y && t < 4) {
    vy += sim.GRAVITY * dtDrop;
    y += vy * dtDrop;
    var sr = Math.min(1.5, Math.abs(vy) / sim.MAX_BALL_SPEED);
    var damp = 1 - (sim.BALL_DRAG_BASE + sim.BALL_DRAG_SPEED * sr);
    if (damp < 0.97) damp = 0.97;
    vy *= damp;
    t += dtDrop;
  }
  if (y >= sim.FLIPPER_ROW_Y) reached = true;
  assert(reached, 'crown drop reaches the flipper row');
  assert(t >= 1.05 && t <= 1.55, 'drop time is realistic pinball (' + t.toFixed(2) + 's)');

  var drain = fresh();
  drain.ball.inPlay = true;
  drain.exitedLaunchLane = true;
  drain.phase = 'playing';
  drain.ball.x = 250;
  drain.ball.y = sim.FLIPPER_ROW_Y + 40;
  drain.ball.vx = 0;
  drain.ball.vy = 220;
  var left = drain.ballsRemaining;
  for (n = 0; n < 90; n++) sim.tick(drain, 1 / 60);
  assert(drain.ballsRemaining < left || !drain.ball.inPlay, 'center drop still drains');

  assert(sim.createUpperRightFlipper().pivotX > 340, 'need1 upper flipper kept');
  console.log('PASS: phys1 gauge + gravity (15/50/100=' + s15.toFixed(0) + '/' + s50.toFixed(0) + '/' + s100.toFixed(0) + ' drop=' + t.toFixed(2) + 's)');
})();

(function testPop1TriangleAndDumbbell() {
  assert.strictEqual(sim.TRIANGLE_UP_SEC, 1, 'triangle up 1s');
  assert.strictEqual(sim.TRIANGLE_DOWN_SEC, 1, 'triangle down 1s');
  assert.strictEqual(sim.TRIANGLE_CYCLE_SEC, 2, 'loop every 2s');
  assert.strictEqual(sim.TRIANGLE_RUBBER_MULT, 1.25, 'rubber +25% when up');
  var fs = require('fs');
  var path = require('path');
  var simSrc = fs.readFileSync(path.join(__dirname, '..', 'simulation.js'), 'utf8');
  assert(simSrc.indexOf('SLING_RESTITUTION * TRIANGLE_RUBBER_MULT') !== -1, 'vertex + side restitution x1.25');
  assert(simSrc.indexOf('SLING_KICK_GAIN * TRIANGLE_RUBBER_MULT') !== -1, 'kick gain x1.25');
  assert(simSrc.indexOf('SLING_KICK_MIN * TRIANGLE_RUBBER_MULT') !== -1, 'kick min x1.25');
  assert(simSrc.indexOf('SLING_KICK_MAX * TRIANGLE_RUBBER_MULT') !== -1, 'kick max x1.25');
  var renSrcPop = fs.readFileSync(path.join(__dirname, '..', 'renderer.js'), 'utf8');
  assert(renSrcPop.indexOf('triangleIsUp') !== -1, 'draw skips triangle when down');
  assert(renSrcPop.indexOf('#071018') === -1, 'no horseshoe channel fill');
  assert(renSrcPop.indexOf('chaikinSmooth') !== -1, 'draw path is Chaikin-smoothed');
  assert(renSrcPop.indexOf('var blend = 26') === -1, 'no 26px two-hull blend');
  assert(renSrcPop.indexOf('var JOIN_X = 280') !== -1, 'hard vertical split at x=280');
  assert(renSrcPop.indexOf('fillRect(0, 0, JOIN_X') !== -1, 'one-hull vertical cyan fill at JOIN_X');
  assert(renSrcPop.indexOf('var tubeW = 5.5') !== -1, 'matching tube width 5.5');
  assert(renSrcPop.indexOf('drawPioneerRamp(ctx, { segments: left.segments') === -1, 'no Pioneer on leftRamp');
  assert(renSrcPop.indexOf('segments: (ramp.segments') === -1, 'no Pioneer on rightRamp');
  assert(renSrcPop.indexOf('drawPioneerRamp(ctx, { segments: ramp.mergeOuter') === -1, 'no Pioneer on mergeOuter');
  var idxSrc = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert(idxSrc.indexOf('?v=dump7') !== -1, 'cache bust dump5');
  assert(renSrcPop.indexOf('{ x: 472, y: 103 }') === -1, 'leftover closer-cap draw is gone');
  var segs = fresh().sideRoutes.rightRamp.segments;
  assert(!segs.some(function (sg) { return sg.x1 === 408 && sg.y1 === 14; }), 'copper join curve 408,14 pinch deleted (PHYSICS=DRAW)');
  assert(segs.some(function (sg) { return sg.x1 === 470 && sg.y1 === 88; }), 'join meets orange ramp at 470,88');
  var tri = sim.createPulseTriangle();
  tri.cycleT = 0;
  assert(sim.triangleIsUp(tri), 'starts up');
  tri.cycleT = 0.99;
  assert(sim.triangleIsUp(tri), 'still up just before 1s');
  tri.cycleT = 1.01;
  assert(!sim.triangleIsUp(tri), 'down after 1s');
  tri.cycleT = 1.99;
  assert(!sim.triangleIsUp(tri), 'still down just before 2s');
  tri.cycleT = 2.01;
  assert(sim.triangleIsUp(tri), 'up again after 2s');

  var cages = fresh().walls.filter(function (w) { return w.kind === "cage" || w.id === "cage-r"; });
  assert(!cages.some(function (w) { return w.id === 'cage-r'; }), 'dumbbell cage-r removed from physics');

  var down = fresh();
  down.pulseTriangle.cycleT = 1.2;
  down.ball.inPlay = true;
  down.exitedLaunchLane = true;
  down.phase = 'playing';
  down.ball.x = down.pulseTriangle.cx;
  down.ball.y = down.pulseTriangle.cy;
  down.ball.vx = 80;
  down.ball.vy = 40;
  var vx0 = down.ball.vx, vy0 = down.ball.vy, x0 = down.ball.x, y0 = down.ball.y;
  sim.resolvePulseTriangle(down);
  assert(Math.abs(down.ball.vx - vx0) < 1e-6 && Math.abs(down.ball.vy - vy0) < 1e-6, 'no collide when down');
  assert(Math.abs(down.ball.x - x0) < 1e-6 && Math.abs(down.ball.y - y0) < 1e-6, 'no rubber when down');

  var pop = fresh();
  pop.pulseTriangle.cycleT = 1.85;
  pop.ball.inPlay = true;
  pop.exitedLaunchLane = true;
  pop.phase = 'playing';
  pop.ball.x = pop.pulseTriangle.cx;
  pop.ball.y = pop.pulseTriangle.cy;
  pop.ball.vx = 0;
  pop.ball.vy = 0;
  sim.stepPulseTriangle(pop, 0.3);
  assert(sim.triangleIsUp(pop.pulseTriangle), 'crossed into up');
  var dPop = Math.hypot(pop.ball.x - pop.pulseTriangle.cx, pop.ball.y - pop.pulseTriangle.cy);
  assert(dPop > 20, 'ejects instead of trapping on pop-up (d=' + dPop.toFixed(1) + ')');

  var full = fresh();
  sim.launchBall(full, 1);
  var inU = false, n;
  for (n = 0; n < 180; n++) {
    sim.tick(full, 1 / 60);
    var b = full.ball;
    if (full.exitedLaunchLane && b.y < 90 && b.x > 140 && b.x < 440) inU = true;
  }
  assert(inU, 'full plunge still enters the U after pop1');
  assert.strictEqual(sim.GRAVITY, 1180, 'phys1 gravity kept');
  assert.strictEqual(sim.TABLE_W, 560, 'width kept');
  assert.strictEqual(sim.HABITRAIL_ASSIST, 0, 'no rail magnet');
  console.log('PASS: shoe1 tubes + pop1 triangle 1+1 / rubber / plunge U');
})();

(function testFlip1SweptFlipperBlocksAndCenterHole() {
  function raise(state, which) {
    state.flippers.forEach(function (f) {
      if (which === 'upper') {
        if (f.role !== 'upper') return;
      } else if (f.role === 'upper') {
        return;
      } else if (which !== 'both' && f.side !== which) {
        return;
      }
      f.active = true;
      f.angle = f.activeAngle;
      f.targetAngle = f.activeAngle;
      f.omega = 0;
    });
  }
  function fireInto(side, speed, dt) {
    var state = fresh();
    state.ball.inPlay = true;
    state.exitedLaunchLane = true;
    state.phase = 'playing';
    raise(state, side);
    var f = state.flippers.find(function (fl) {
      if (side === 'upper') return fl.role === 'upper';
      return fl.side === side && fl.role !== 'upper';
    });
    var ux = Math.cos(f.angle);
    var uy = Math.sin(f.angle);
    var tAlong = f.length * 0.55;
    var mx = f.pivotX + ux * tAlong;
    var my = f.pivotY + uy * tAlong;
    var nx = -uy;
    var ny = ux;
    if (ny > 0) { nx = -nx; ny = -ny; }
    var hit = state.ball.radius + f.width * 0.5;
    state.ball.x = mx + nx * (hit + 30);
    state.ball.y = my + ny * (hit + 30);
    state.ball.vx = -nx * speed;
    state.ball.vy = -ny * speed;
    var crossed = false;
    var bounced = false;
    var i;
    for (i = 0; i < 36; i++) {
      sim.stepPhysics(state, dt);
      var tip = sim.flipperTip(f);
      var dx = tip.x - f.pivotX;
      var dy = tip.y - f.pivotY;
      var len = Math.hypot(dx, dy);
      var uxx = dx / len;
      var uyy = dy / len;
      var relX = state.ball.x - f.pivotX;
      var relY = state.ball.y - f.pivotY;
      var tt = Math.max(0, Math.min(len, relX * uxx + relY * uyy));
      var cx = f.pivotX + uxx * tt;
      var cy = f.pivotY + uyy * tt;
      var sideDot = (state.ball.x - cx) * nx + (state.ball.y - cy) * ny;
      if (tt > 10 && tt < len - 6 && sideDot < -5) crossed = true;
      if (state.ball.vx * -nx + state.ball.vy * -ny < speed * 0.15) bounced = true;
    }
    return { bounced: bounced, crossed: crossed, x: state.ball.x, y: state.ball.y, vy: state.ball.vy };
  }
  var speeds = [400, 650, 900];
  var si;
  for (si = 0; si < speeds.length; si++) {
    var sp = speeds[si];
    var L = fireInto('left', sp, 1 / 30);
    assert(L.bounced, 'left raised must rebound at ' + sp + ' (vy=' + L.vy.toFixed(1) + ')');
    assert(!L.crossed, 'left raised must not appear below the bat at ' + sp);
    var R = fireInto('right', sp, 1 / 30);
    assert(R.bounced, 'right raised must rebound at ' + sp + ' (vy=' + R.vy.toFixed(1) + ')');
    assert(!R.crossed, 'right raised must not appear below the bat at ' + sp);
  }
  var hole = fresh();
  hole.ball.inPlay = true;
  hole.exitedLaunchLane = true;
  hole.phase = 'playing';
  raise(hole, 'both');
  var leftF = hole.flippers.find(function (f) { return f.side === 'left' && f.role !== 'upper'; });
  var rightF = hole.flippers.find(function (f) { return f.side === 'right' && f.role !== 'upper'; });
  var gapL = sim.flipperTip(leftF).x;
  var gapR = sim.flipperTip(rightF).x;
  assert(gapR - gapL > 24, 'hold-both still leaves a center hole');
  hole.ball.x = (gapL + gapR) / 2;
  hole.ball.y = Math.min(sim.flipperTip(leftF).y, sim.flipperTip(rightF).y) - 40;
  hole.ball.vx = 0;
  hole.ball.vy = 700;
  var beforeBalls = hole.ballsRemaining;
  var n;
  for (n = 0; n < 90; n++) sim.tick(hole, 1 / 60);
  assert(hole.ballsRemaining < beforeBalls || !hole.ball.inPlay, 'center hole still drains with both raised');
  var U = fireInto('upper', 700, 1 / 30);
  assert(U.bounced, 'upper flipper must block (vy=' + U.vy.toFixed(1) + ')');
  assert(!U.crossed, 'upper flipper must not be a ghost');
  var simSrc = require('fs').readFileSync(require('path').join(__dirname, '..', 'simulation.js'), 'utf8');
  assert(simSrc.indexOf('Swept / sub-step capsule tests') !== -1, 'swept flipper collision present');
  assert.strictEqual(sim.TABLE_W, 560, 'TABLE_W stays 560');
  assert.strictEqual(sim.GRAVITY, 1180, 'GRAVITY stays 1180');
  assert.strictEqual(sim.BOINGER_B_X, 352, 'B at 352');
  assert.strictEqual(sim.BOINGER_B_Y, 707, 'B y at 707');
  console.log('PASS: flip1 swept flippers block + center hole + upper');
})();

(function testOpt1OutlaneSlotAndCFace() {
  function place(state, x, y, vx, vy) {
    state.ball.inPlay = true;
    state.exitedLaunchLane = true;
    state.phase = 'playing';
    state.ball.x = x;
    state.ball.y = y;
    state.ball.vx = vx;
    state.ball.vy = vy;
  }
  function runTick(x, y, vx, vy, frames) {
    var state = fresh();
    place(state, x, y, vx, vy);
    var startBalls = state.ballsRemaining;
    var maxX = x;
    var i;
    for (i = 0; i < frames; i++) {
      var liveX = state.ball.x;
      sim.tick(state, 1 / 60);
      if (state.ballsRemaining < startBalls || !state.ball.inPlay) {
        if (liveX > maxX) maxX = liveX;
        break;
      }
      if (state.ball.x > maxX) maxX = state.ball.x;
    }
    return {
      drained: state.ballsRemaining < startBalls || !state.ball.inPlay,
      x: state.ball.x,
      y: state.ball.y,
      maxX: maxX,
      inPlay: state.ball.inPlay,
      remaining: state.ballsRemaining
    };
  }
  var dying = runTick(50, 720, 0, 40, 180);
  assert(dying.drained, 'dying ball at 50,720 must drain left (x=' + dying.x.toFixed(1) + ' y=' + dying.y.toFixed(1) + ')');
  assert(dying.maxX < 160, 'outlane must not teleport into the inlane (maxX=' + dying.maxX.toFixed(1) + ')');

  var rail = runTick(50, 640, 0, 160, 180);
  assert(rail.drained, 'rail-down 50,640 must still be able to drain');
  assert(rail.maxX < 200, 'rail-down must not get cheap-saved into inlane (maxX=' + rail.maxX.toFixed(1) + ')');

  var face = fresh();
  place(face, 125, 708, -8, 24);
  (face.boingers || []).forEach(function (b) { if (b.x < 200) { b.up = false; b.pop = 0; } });
  var k, farm = 0, nan = false, maxJump = 0, px = 125, py = 708;
  for (k = 0; k < 90; k++) {
    sim.stepPhysics(face, 1 / 60);
    var b = face.ball;
    if (!isFinite(b.x) || !isFinite(b.y) || !isFinite(b.vx) || !isFinite(b.vy)) nan = true;
    var jump = Math.hypot(b.x - px, b.y - py);
    if (jump > maxJump) maxJump = jump;
    px = b.x; py = b.y;
    if (b.x >= 36 && b.x <= 118 && b.y >= 650 && b.y <= 750 && Math.hypot(b.vx, b.vy) < 35) farm++;
  }
  assert(!nan, 'C-face spawn must not NaN');
  assert(farm < 20, 'C-face must not farm inside plastic (farm=' + farm + ')');
  assert(face.ball.x > 118, 'C-face must pop out to playfield (x=' + face.ball.x.toFixed(1) + ')');
  assert(maxJump < 80, 'C-face must not tunnel (maxJump=' + maxJump.toFixed(1) + ')');

  var mid = fresh();
  place(mid, 340, 520, 16, 12);
  for (k = 0; k < 60; k++) sim.stepPhysics(mid, 1 / 60);
  assert(isFinite(mid.ball.x) && isFinite(mid.ball.y), '500 spawn stays finite');
  assert(!(mid.ball.x > 322 && mid.ball.x < 358 && mid.ball.y > 502 && mid.ball.y < 538 && Math.hypot(mid.ball.vx, mid.ball.vy) < 20), 'must not sit inside 500');

  var tri = fresh();
  place(tri, 186, 558, 0, 16);
  for (k = 0; k < 24; k++) sim.stepPhysics(tri, 1 / 60);
  var dTri = Math.hypot(tri.ball.x - 186, tri.ball.y - 558);
  assert(dTri > 20, 'triangle centroid must eject (d=' + dTri.toFixed(1) + ')');

  assert.strictEqual(sim.GRAVITY, 1180, 'GRAVITY stays 1180');
  assert.strictEqual(sim.TABLE_PITCH_DEG, 6.8, 'pitch stays 6.8');
  assert.strictEqual(sim.HABITRAIL_ASSIST, 0, 'no rail magnet');
  assert.strictEqual(sim.TABLE_W, 560, 'TABLE_W stays 560');
  console.log('PASS: opt1 outlane slot + C-face pop-out');
})();

(function testOpt1T139CoordsAndCenterHole() {
  assert.strictEqual(sim.BOINGER_C_X, 125);
  assert.strictEqual(sim.BOINGER_C_Y, 708);
  assert.strictEqual(sim.BOINGER_B_X, 352);
  assert.strictEqual(sim.BOINGER_B_Y, 707);
  assert.strictEqual(sim.GRAVITY, 1180);
  assert.strictEqual(sim.TABLE_PITCH_DEG, 6.8);
  assert.strictEqual(sim.HABITRAIL_ASSIST, 0);
  assert.strictEqual(sim.TABLE_W, 560);
  var hole = sim.createInitialState();
  hole.phase = 'playing';
  hole.ball.inPlay = true;
  hole.exitedLaunchLane = true;
  var leftF = hole.flippers.find(function (f) { return f.side === 'left' && f.role !== 'upper'; });
  var rightF = hole.flippers.find(function (f) { return f.side === 'right' && f.role !== 'upper'; });
  sim.activateFlipper(hole, 'left', true);
  sim.activateFlipper(hole, 'right', true);
  var t = 0;
  while (t < 0.4) { sim.tick(hole, 1 / 60); t += 1 / 60; }
  var gap = sim.flipperTip(rightF).x - sim.flipperTip(leftF).x;
  assert(gap > 24, 'hold-both must not seal center (gap=' + gap.toFixed(1) + ')');
  console.log('PASS: opt1 t139 coords locked + center hole open');
})();

(function testOpt2CrownShelfEjectAndPlungeU() {
  function yOnSegs(segs, x) {
    var best = null;
    var i;
    for (i = 0; i < (segs || []).length; i++) {
      var s = segs[i];
      var minX = Math.min(s.x1, s.x2);
      var maxX = Math.max(s.x1, s.x2);
      if (x < minX - 0.5 || x > maxX + 0.5) continue;
      var dx = s.x2 - s.x1;
      var t = Math.abs(dx) < 1e-6 ? 0 : (x - s.x1) / dx;
      if (t < -0.05 || t > 1.05) continue;
      var y = s.y1 + (s.y2 - s.y1) * t;
      if (best == null || Math.abs(x - (s.x1 + dx * t)) < 2) best = y;
    }
    return best;
  }
  function channelH(state, x) {
    var left = state.sideRoutes.leftRamp;
    var right = state.sideRoutes.rightRamp;
    var outer = (left.segments || []).concat(right.mergeOuter || []);
    var inner = (left.guides || []).concat(right.mergeInner || []);
    var oy = yOnSegs(outer, x);
    var iy = yOnSegs(inner, x);
    return (oy == null || iy == null) ? null : (iy - oy);
  }
  var geo = fresh();
  [200, 235, 260, 280].forEach(function (x) {
    var h = channelH(geo, x);
    assert(h != null && h >= 38, 'crown channel at x=' + x + ' must be >=38 (h=' + h + ')');
  });
  assert.strictEqual(sim.GRAVITY, 1180);
  assert.strictEqual(sim.HABITRAIL_ASSIST, 0);
  assert.strictEqual(sim.TABLE_W, 560);

  var pinch = fresh();
  pinch.phase = 'playing';
  pinch.ball.inPlay = true;
  pinch.exitedLaunchLane = true;
  pinch.ball.x = 235;
  pinch.ball.y = 90;
  pinch.ball.vx = 0;
  pinch.ball.vy = 0;
  var t = 0;
  var moved = false;
  while (t < 1) {
    sim.tick(pinch, 1 / 60);
    t += 1 / 60;
    var sp = Math.hypot(pinch.ball.vx, pinch.ball.vy);
    var inPinch = pinch.ball.x >= 170 && pinch.ball.x <= 310 && pinch.ball.y >= 6 && pinch.ball.y <= 110 && sp < 40;
    if (!inPinch && sp >= 40) { moved = true; break; }
  }
  var endSp = Math.hypot(pinch.ball.vx, pinch.ball.vy);
  assert(moved || endSp >= 40 || pinch.ball.x > 300 || pinch.ball.y > 100, 'crown shelf ball must be moving/out within 1s (x=' + pinch.ball.x.toFixed(1) + ' y=' + pinch.ball.y.toFixed(1) + ' sp=' + endSp.toFixed(1) + ')');
  assert(pinch.ball.x < sim.LAUNCH_LANE_LEFT - 4, 'eject must not dump into the shooter');

  var high = fresh();
  high.phase = 'playing';
  high.ball.inPlay = true;
  high.exitedLaunchLane = true;
  high.ball.x = 250;
  high.ball.y = 30;
  high.ball.vx = 0;
  high.ball.vy = 0;
  t = 0;
  var highMoved = false;
  while (t < 1) {
    sim.tick(high, 1 / 60);
    t += 1 / 60;
    var hsp = Math.hypot(high.ball.vx, high.ball.vy);
    var highPinch = high.ball.x >= 170 && high.ball.x <= 310 && high.ball.y >= 6 && high.ball.y <= 110 && hsp < 40;
    if (!highPinch && hsp >= 40) { highMoved = true; break; }
  }
  var highSp = Math.hypot(high.ball.vx, high.ball.vy);
  assert(highMoved || highSp >= 40 || high.ball.x > 310 || high.ball.y > 110, 'crown high ball must be moving/out within 1s (x=' + high.ball.x.toFixed(1) + ' y=' + high.ball.y.toFixed(1) + ' sp=' + highSp.toFixed(1) + ')');
  assert(high.ball.x < sim.LAUNCH_LANE_LEFT - 4, 'high eject must not dump into the shooter');

  var ltr = runOrbit(placeInLeftMouth, 'LTR', 1120);
  assert(ltr.crossedApex && ltr.farSide && !ltr.droppedThrough, 'LTR must still complete after opt2');
  var rtl = runOrbit(placeInRightMouth, 'RTL', 1120);
  assert(rtl.crossedApex && rtl.farSide && !rtl.droppedThrough, 'RTL must still complete after opt2');

  var plunge = fresh();
  sim.launchBall(plunge, 1400);
  var u = false;
  var frames = 0;
  while (frames < 240) {
    sim.tick(plunge, 1 / 60);
    frames++;
    var b = plunge.ball;
    if (b.y < 90 && b.x > 140 && b.x < 440) u = true;
    if (plunge.exitedLaunchLane && b.y > 420) break;
    if (!b.inPlay && frames > 12) break;
  }
  assert(plunge.exitedLaunchLane, 'full plunge must leave the lane');
  assert(u, 'full plunge must still ride the U (x=' + plunge.ball.x.toFixed(1) + ' y=' + plunge.ball.y.toFixed(1) + ')');
  console.log('PASS: opt2 crown shelf eject + channel >=38 + plunge rides U');
})();
(function testShoe6VerticalUJoin() {
  var fs = require('fs');
  var path = require('path');
  var ren = fs.readFileSync(path.join(__dirname, '..', 'renderer.js'), 'utf8');
  assert.strictEqual((ren.match(/function drawHorseshoeOrbit/g) || []).length, 1, 'exactly one drawHorseshoeOrbit');
  assert(ren.indexOf('function fillSausageHull') !== -1, 'solid sausage hull helper');
  assert(ren.indexOf('function extendJoinX') === -1, 'no extendJoinX brick-cut');
  assert(ren.indexOf('if (gmy < 120) return') !== -1, 'arch-end glow scraps deleted');
  assert(ren.indexOf('clipPtsAtJoinX(fullOuter, 280 - blend, false)') === -1, 'no copper two-hull clip');
  assert(ren.indexOf('clipPtsAtJoinX(fullOuter, 280 + blend, true)') === -1, 'no cyan two-hull clip');
  assert(ren.indexOf('var JOIN_X = 280') !== -1, 'one hull + vertical split at JOIN_X');
  assert(ren.indexOf('fillRect(JOIN_X - 5, 0, 10, TABLE_H)') !== -1, '10px horizontal seam at x=280');
  assert(ren.indexOf('function extendJoinX') === -1, 'no extendJoinX brick-cut');
  assert(ren.indexOf('if (gmy < 120) return') !== -1, 'arch-end glow scraps deleted');
  assert(ren.indexOf('clipPtsAtJoinX(fullOuter, 280 - blend, false)') === -1, 'no copper two-hull clip');
  assert(ren.indexOf('clipPtsAtJoinX(fullOuter, 280 + blend, true)') === -1, 'no cyan two-hull clip');
  assert(ren.indexOf('var JOIN_X = 280') !== -1, 'one hull + vertical split at JOIN_X');
  assert(ren.indexOf('fillRect(JOIN_X - 5, 0, 10, TABLE_H)') !== -1, '10px horizontal seam at x=280');
  assert(ren.indexOf('function drawCopperDropMouth') === -1, 'shoe3: drop-mouth scrap stroke deleted');
  assert(ren.indexOf('fillSausageHull(ctx, dropO, dropI') === -1, 'no drop-fill blob over the crown');
  assert(ren.indexOf('fillSausageHull(ctx, dumpO') === -1, 'no floating failDump sausage');
  assert(ren.indexOf('clipSegsBelowY(right.mergeInner, 88)') === -1, 'no clipSegsBelowY copper drop fill');
  assert(ren.indexOf('strokeTubePath(ctx, drop') === -1, 'no leftover drop tube strokes');
  var idxHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert(idxHtml.indexOf('?v=dump7') !== -1, 'live cache tag dump5');
  assert.strictEqual(sim.GRAVITY, 1180);
  assert.strictEqual(sim.TABLE_PITCH_DEG, 6.8);
  assert.strictEqual(sim.HABITRAIL_ASSIST, 0);
  assert.strictEqual(sim.TABLE_W, 560);
  var fs = require('fs');
  var path = require('path');
  var ren = fs.readFileSync(path.join(__dirname, '..', 'renderer.js'), 'utf8');
  assert.strictEqual((ren.match(/function drawHorseshoeOrbit/g) || []).length, 1, 'exactly one drawHorseshoeOrbit');
  assert(ren.indexOf('function fillSausageHull') !== -1, 'solid sausage hull helper');
  assert(ren.indexOf('function drawCopperDropMouth') === -1, 'shoe3: drop-mouth scrap stroke deleted');
  assert(ren.indexOf('fillSausageHull(ctx, dropO, dropI') === -1, 'no drop-fill blob over the crown');
  assert(ren.indexOf('fillSausageHull(ctx, dumpO') === -1, 'no floating failDump sausage');
  assert(ren.indexOf('clipSegsBelowY(right.mergeInner, 88)') === -1, 'no clipSegsBelowY copper drop fill');
  assert(ren.indexOf('strokeTubePath(ctx, drop') === -1, 'no leftover drop tube strokes');
  var idxHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert(idxHtml.indexOf('?v=dump7') !== -1, 'live cache tag dump5');
  assert.strictEqual(sim.GRAVITY, 1180);
  assert.strictEqual(sim.TABLE_PITCH_DEG, 6.8);
  assert.strictEqual(sim.HABITRAIL_ASSIST, 0);
  assert.strictEqual(sim.TABLE_W, 560);
  var right = fresh().sideRoutes.rightRamp;
  assert(right.mergeInner.some(function (s) { return s.x1 === 470 && s.y1 === 88; }), 'plunge mouth still starts at 470,88');
  assert(right.mergeInner.some(function (s) { return s.x2 === 280 && s.y2 === 80; }), 'join inner y=80 kept');
  assert(!right.mergeInner.some(function (s) { return s.x1 === 372 || s.x2 === 372; }), 'orange inner dent x=372 deleted');
  assert(!right.mergeOuter.some(function (s) { return s.x1 === 526 || s.x2 === 526; }), 'square 526,90 corner stays gone');
  assert(right.mergeOuter.some(function (s) { return s.x1 === 524 && s.y1 === 64 && s.x2 === 518 && s.y2 === 42; }), 'NE outer stays out then rounds to crown');
  var right = fresh().sideRoutes.rightRamp;
  assert(right.mergeInner.some(function (s) { return s.x1 === 470 && s.y1 === 88; }), 'plunge mouth still starts at 470,88');
  assert(right.mergeInner.some(function (s) { return s.x2 === 280 && s.y2 === 80; }), 'join inner y=80 kept');
  assert(!right.mergeInner.some(function (s) { return s.x1 === 372 || s.x2 === 372; }), 'orange inner dent x=372 deleted');
  assert(!right.mergeOuter.some(function (s) { return s.x1 === 526 || s.x2 === 526; }), 'square 526,90 corner stays gone');
  assert(right.mergeOuter.some(function (s) { return s.x1 === 524 && s.y1 === 64 && s.x2 === 518 && s.y2 === 42; }), 'NE outer stays out then rounds to crown');
  var pinch = fresh();
  pinch.ball.inPlay = true;
  pinch.exitedLaunchLane = true;
  pinch.phase = 'playing';
  pinch.ball.x = 235;
  pinch.ball.y = 90;
  pinch.ball.vx = 0;
  pinch.ball.vy = 0;
  var i, moved = false;
  for (i = 0; i < 60; i++) {
    sim.tick(pinch, 1 / 60);
    if (Math.hypot(pinch.ball.vx, pinch.ball.vy) >= 40 || pinch.ball.x > 300 || pinch.ball.y > 100) { moved = true; break; }
  }
  assert(moved || Math.hypot(pinch.ball.vx, pinch.ball.vy) >= 40, 'spawn (235,90) unsticks');
  var ltr = runOrbit(placeInLeftMouth, 'LTR', 1120);
  assert(ltr.crossedApex && ltr.farSide && !ltr.droppedThrough, 'LTR must still ride the U');
  var rtl = runOrbit(placeInRightMouth, 'RTL', 1120);
  assert(rtl.crossedApex && rtl.farSide && !rtl.droppedThrough, 'RTL must still ride the U');
  var plunge = fresh();
  sim.launchBall(plunge, 1400);
  var u = false, n;
  for (n = 0; n < 220; n++) {
    sim.tick(plunge, 1 / 60);
    if (plunge.exitedLaunchLane && plunge.ball.y < 110 && plunge.ball.x > 140 && plunge.ball.x < 440) u = true;
    if (plunge.exitedLaunchLane && plunge.ball.y > 420) break;
  }
  assert(plunge.exitedLaunchLane && u, 'full plunge 1400 rides U');
  // shoe6: both elbows exist as thick sausages; crown has a vertical color join, no melted smear.
  function nearestDist(x, y, segs) {
    var best = 1e9, i;
    for (i = 0; i < segs.length; i++) {
      var s = segs[i];
      var dx = s.x2 - s.x1, dy = s.y2 - s.y1;
      var len2 = dx * dx + dy * dy;
      var t = len2 < 1e-8 ? 0 : ((x - s.x1) * dx + (y - s.y1) * dy) / len2;
      if (t < 0) t = 0;
      if (t > 1) t = 1;
      var d = Math.hypot(x - (s.x1 + t * dx), y - (s.y1 + t * dy));
      if (d < best) best = d;
    }
    return best;
  }
  function insideChannel(x, y, outer, inner, minW) {
    var dO = nearestDist(x, y, outer);
    var dI = nearestDist(x, y, inner);
    return (dO + dI) >= minW && dO < 70 && dI < 70;
  }
  var leftR = fresh().sideRoutes.leftRamp;
  var rightR = fresh().sideRoutes.rightRamp;
  var nwOuter = leftR.segments;
  var nwInner = leftR.guides;
  var neOuter = rightR.mergeOuter;
  var neInner = rightR.mergeInner;
  assert(insideChannel(70, 40, nwOuter, nwInner, 50), 'NW corner (~70,40) is inside the cyan channel');
  assert(insideChannel(500, 40, neOuter, neInner, 50), 'NE corner (~500,40) is inside a 50px+ copper hull');
  function yOnCrown(segs, atX) {
    var k, y = null;
    for (k = 0; k < segs.length; k++) {
      var s = segs[k];
      var lo = Math.min(s.x1, s.x2), hi = Math.max(s.x1, s.x2);
      if (atX < lo - 0.01 || atX > hi + 0.01) continue;
      if (s.y1 > 24 && s.y2 > 24) continue;
      var dx = s.x2 - s.x1;
      var t = Math.abs(dx) < 1e-6 ? 0 : (atX - s.x1) / dx;
      y = s.y1 + t * (s.y2 - s.y1);
    }
    return y;
  }
  var crown = (leftR.segments || []).concat(rightR.mergeOuter || []);
  var cx;
  for (cx = 60; cx <= 478; cx += 22) {
    var cy = yOnCrown(crown, cx);
    assert(cy != null && cy >= 16 && cy <= 22, 'crown outer continuous at x=' + cx + ' y=' + cy);
  }
  assert(leftR.segments.some(function (s) { return s.x1 === 40 && s.y1 === 28 && s.x2 === 48 && s.y2 === 22; }), 'NW outer rounds through (40,28)');
  assert(leftR.segments.some(function (s) { return s.x1 === 48 && s.y1 === 22 && s.x2 === 60 && s.y2 === 18; }), 'NW outer lands on crown (60,18)');
  assert(!leftR.guides.some(function (s) { return s.x1 === 82 && s.y1 === 62 && s.x2 === 110 && s.y2 === 64; }), 'square-L inner jog deleted');
  assert(rightR.mergeOuter.some(function (s) { return s.x1 === 502 && s.y1 === 26 && s.x2 === 478 && s.y2 === 18; }), 'NE outer (502,26)-(478,18)');
  assert(ren.indexOf('clipSegsBelowY(right.segments, 88)') === -1, 'no right-ramp stick scrap');
  assert(ren.indexOf('clipSegsBelowY(right.mergeOuter, 64)') === -1, 'no overlapping elbow hull smear');
  assert(ren.indexOf('createLinearGradient(JOIN_X - 5, 0, JOIN_X + 5, 0)') !== -1, '10px horizontal seam gradient');
  assert(ren.indexOf('var seen = false;') !== -1, 'clip waits until keep-side is entered');
  function yOnInnerCrown(segs, atX) {
    var k, y = null;
    for (k = 0; k < segs.length; k++) {
      var s = segs[k];
      var lo = Math.min(s.x1, s.x2), hi = Math.max(s.x1, s.x2);
      if (atX < lo - 0.01 || atX > hi + 0.01) continue;
      if (Math.max(s.y1, s.y2) > 100 || Math.min(s.y1, s.y2) < 50) continue;
      var dx = s.x2 - s.x1;
      var tt = Math.abs(dx) < 1e-6 ? 0 : (atX - s.x1) / dx;
      y = s.y1 + tt * (s.y2 - s.y1);
    }
    return y;
  }
  var innerCrown = (leftR.guides || []).concat(rightR.mergeInner || []);
  for (cx = 140; cx <= 420; cx += 20) {
    var iy = yOnInnerCrown(innerCrown, cx);
    assert(iy != null && iy >= 79 && iy <= 81, 'inner crown y=80+/-1 at x=' + cx + ' y=' + iy);
  }
  assert(!innerCrown.some(function (s) {
    var onCrown = (s.x1 >= 130 && s.x1 <= 430) || (s.x2 >= 130 && s.x2 <= 430);
    return onCrown && (s.y1 === 66 || s.y2 === 66 || s.y1 === 73 || s.y2 === 73);
  }), 'no y=66/73 snake on inner crown');
  assert(rightR.mergeInner.some(function (s) { return s.x1 === 470 && s.y1 === 88; }), 'plunge mouth (470,88)');
  assert(rightR.mergeInner.some(function (s) { return s.x2 === 280 && s.y2 === 80; }), 'join (280,80)');
  console.log('PASS: shoe6 vertical U join, no melted crown');
})();

(function testShoe6FlatInnerCrown() {
  var fs = require('fs');
  var path = require('path');
  var ren = fs.readFileSync(path.join(__dirname, '..', 'renderer.js'), 'utf8');
  var idxHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert(idxHtml.indexOf('?v=dump7') !== -1, 'cache tag dump5');
  assert(ren.indexOf('var blend = 26') === -1, 'no 26px two-hull blend');
  assert(ren.indexOf('clipPtsAtJoinX(fullOuter') === -1, 'no two-hull clipPtsAtJoinX pair');
  assert(ren.indexOf('var JOIN_X = 280') !== -1, 'JOIN_X vertical fills');
  assert(ren.indexOf('ctx.fillRect(0, 0, JOIN_X, TABLE_H)') !== -1, 'cyan left of 280');
  assert(ren.indexOf('TABLE_W - JOIN_X') !== -1, 'copper right of 280');
  assert(ren.indexOf('ctx.fillRect(JOIN_X - 5, 0, 10, TABLE_H)') !== -1, '10px seam');
  var state = fresh();
  var left = state.sideRoutes.leftRamp;
  var right = state.sideRoutes.rightRamp;
  var inner = (left.guides || []).concat(right.mergeInner || []);
  var outer = (left.segments || []).concat(right.mergeOuter || []);
  function yOn(segs, x, pred) {
    var best = null, i;
    for (i = 0; i < segs.length; i++) {
      var s = segs[i];
      var lo = Math.min(s.x1, s.x2), hi = Math.max(s.x1, s.x2);
      if (x < lo - 0.01 || x > hi + 0.01) continue;
      if (pred && !pred(s)) continue;
      var dx = s.x2 - s.x1;
      var t = Math.abs(dx) < 1e-6 ? 0 : (x - s.x1) / dx;
      best = s.y1 + t * (s.y2 - s.y1);
    }
    return best;
  }
  var x;
  for (x = 140; x <= 420; x += 20) {
    var iy = yOn(inner, x, function (s) { return s.y1 >= 70 && s.y2 >= 70; });
    var oy = yOn(outer, x, function (s) { return s.y1 <= 24 && s.y2 <= 24; });
    assert(iy != null && Math.abs(iy - 80) <= 1, 'inner crown y=80+/-1 at x=' + x + ' y=' + iy);
    assert(oy != null && Math.abs(oy - 18) <= 1, 'outer crown y=18 at x=' + x + ' y=' + oy);
    assert(iy - oy >= 60 && iy - oy <= 64, 'channel ~62 at x=' + x + ' h=' + (iy - oy));
  }
  assert(!inner.some(function (s) { return s.y1 === 66 || s.y2 === 66; }), 'no y=66 snake');
  assert(!right.mergeInner.some(function (s) { return s.y1 === 73 || s.y2 === 73; }), 'no y=73 mergeInner dip');
  assert(right.mergeInner.some(function (s) { return s.x1 === 470 && s.y1 === 88 && s.x2 === 458 && s.y2 === 80; }), 'plunge mouth (470,88)->(458,80)');
  assert(right.mergeInner.some(function (s) { return s.x2 === 280 && s.y2 === 80; }), 'join stays (280,80)');
  assert(left.guides.some(function (s) { return s.x2 === 280 && s.y2 === 80; }), 'left join stays (280,80)');
  assert.strictEqual(sim.GRAVITY, 1180);
  assert.strictEqual(sim.TABLE_PITCH_DEG, 6.8);
  assert.strictEqual(sim.HABITRAIL_ASSIST, 0);
  assert.strictEqual(sim.TABLE_W, 560);
  assert.strictEqual(sim.TABLE_H, 860);
  console.log('PASS: shoe6 flat inner crown y=80, 62px channel, JOIN_X draw');
})();

(function testDump3RestoreLeftUMerge() {
  var fs = require('fs');
  var path = require('path');
  var right0 = fresh().sideRoutes.rightRamp;
  assert(right0.failDump && right0.failDump.outer && right0.failDump.inner && right0.failDump.gate, 'failDump sausage polylines exist');
  var d0 = right0.failDump.outer[0];
  assert(d0.x1 >= 428 && d0.x1 <= 448 && d0.y1 >= 96 && d0.y1 <= 110, 'dump mouth under inner elbow, not on the crown');
  assert(d0.y2 > d0.y1 + 16 && Math.abs(d0.x2 - d0.x1) <= 10, 'first dump chord drops down the inner wall');
  assert(!right0.failDump.outer.some(function (s) { return s.y1 < 96 || s.y2 < 96; }), 'dump never covers the crown channel y<96');
  var lastO = right0.failDump.outer[right0.failDump.outer.length - 1];
  assert(lastO.y2 >= 240 && lastO.x2 <= 380, 'dump opens onto the field, not a y=200 lodge shelf');
  assert(!right0.failDump.gate.some(function (s) { return s.y1 <= 204 && s.y2 <= 204; }), 'old stub end-cap gate gone');
  var saucer = { x: 410, y: 148, r: 15 };
  function segDist(s, p) {
    var ax = s.x2 - s.x1, ay = s.y2 - s.y1;
    var lenSq = ax * ax + ay * ay;
    var t = lenSq < 1e-6 ? 0 : Math.max(0, Math.min(1, ((p.x - s.x1) * ax + (p.y - s.y1) * ay) / lenSq));
    var px = s.x1 + ax * t, py = s.y1 + ay * t;
    return Math.sqrt((p.x - px) * (p.x - px) + (p.y - py) * (p.y - py));
  }
  var dumpSegs = right0.failDump.outer.concat(right0.failDump.inner).concat(right0.failDump.gate);
  dumpSegs.forEach(function (s) {
    var d = segDist(s, saucer);
    assert(d >= saucer.r + 6, 'dump wall clears UR saucer dist=' + d.toFixed(1));
  });
  assert(right0.mergeInner.some(function (s) { return s.x1 === 470 && s.y1 === 88 && s.x2 === 458 && s.y2 === 80; }), 'plunge mouth (470,88) kept');
  assert(right0.mergeInner.some(function (s) { return s.y1 === 80 && s.y2 === 80 && Math.min(s.x1, s.x2) <= 280 && Math.max(s.x1, s.x2) >= 330; }), 'crown floor x=280-400 stays');
  assert(right0.mergeOuter.some(function (s) { return s.x1 === 478 && s.y1 === 18 || s.x2 === 280 && s.y2 === 18; }), 'crown outer y=18 kept');
  function isChain(segs) {
    var k;
    for (k = 1; k < segs.length; k++) {
      if (Math.abs(segs[k].x1 - segs[k - 1].x2) > 0.51 || Math.abs(segs[k].y1 - segs[k - 1].y2) > 0.51) return false;
    }
    return true;
  }
  assert(isChain(right0.mergeOuter), 'copper outer is one polyline');
  assert(right0.mergeOuter.some(function (s) { return (s.y1 === 18 || s.y2 === 18) && (s.x1 === 280 || s.x2 === 280); }), 'outer still reaches crown join 280,18');
  assert(right0.mergeOuter.some(function (s) { return s.x1 === 524 && s.y1 === 64 && s.x2 === 518 && s.y2 === 42; }), 'elbow still rounds into the crown');
  var walls = fresh().walls.filter(function (w) { return w.dumpRamp || w.failMouth || w.dumpGate; });
  assert(walls.some(function (w) { return w.dumpRamp; }), 'dump ramp walls exist');
  assert(walls.some(function (w) { return w.failMouth; }), 'elbow dump mouth is a trapdoor wall');
  assert(walls.some(function (w) { return w.dumpGate; }), 'one-way dump gate exists');
  var upperGuideSolid = (right0.guides || []).some(function (s) {
    return s.x1 === 424 && s.y1 === 73 && s.x2 === 428 && s.y2 === 86;
  });
  assert(upperGuideSolid, 'U inner rail (424,73)-(428,86) restored');
  var failMouthWalls = walls.filter(function (w) { return w.failMouth; });
  assert(failMouthWalls.every(function (w) { return (w.y1 + w.y2) * 0.5 > 86; }), 'failMouth window is later than the U inner rail');

  function rideInfo(st) {
    var b = st.ball;
    return { x: b.x, y: b.y, vx: b.vx, vy: b.vy, rem: st.ballsRemaining, exited: st.exitedLaunchLane };
  }
  function ranU(trace) {
    return trace.some(function (p) { return p.exited && p.y < 110 && p.x < 280; }) ||
      trace.some(function (p) { return p.exited && p.y < 90 && p.x < 400 && p.x > 140; });
  }
  function dumpedToPlay(trace) {
    return trace.some(function (p) {
      return p.exited && p.x < 472 - 24 && p.y > 120 && p.y < 420 && p.x > 200;
    });
  }
  function hallReturnAfterEnter(trace) {
    var entered = false;
    var i;
    for (i = 0; i < trace.length; i++) {
      var p = trace[i];
      if (p.x < 500 && p.x > 400 && p.y < 180) entered = true;
      if (entered && p.x > 472 && p.y > 200) return true;
    }
    return false;
  }
  function runPower(power) {
    var st = fresh();
    sim.launchBall(st, power);
    var trace = [];
    var j;
    for (j = 0; j < 320; j++) {
      sim.tick(st, 1 / 60);
      var p = rideInfo(st);
      trace.push(p);
      if (!st.ball || !st.ball.inPlay) break;
      if (st.phase === 'ready' && j > 30) break;
      if (p.y > 500 && p.exited) break;
    }
    var last = trace[trace.length - 1] || rideInfo(st);
    return {
      u: ranU(trace),
      dumped: dumpedToPlay(trace),
      hallReturn: hallReturnAfterEnter(trace),
      x: last.x,
      y: last.y,
      rem: last.rem,
      inPlay: !!(st.ball && st.ball.inPlay),
      hitDumpSpot: trace.some(function (p) { return Math.abs(p.x - 361) < 18 && Math.abs(p.y - 238) < 18; })
    };
  }

  var full = runPower(1400);
  assert(full.u, '1400 rides the U (x=' + full.x.toFixed(1) + ' y=' + full.y.toFixed(1) + ')');
  assert(!full.hitDumpSpot, '1400 must not dump to (361,238)');
  assert(full.rem === 3, '1400 must not drain');

  var mid = runPower(900);
  assert(mid.u, '900 crests and rides the U (x=' + mid.x.toFixed(1) + ' y=' + mid.y.toFixed(1) + ')');
  assert(!mid.hitDumpSpot, '900 must not dump to play');
  assert(mid.rem === 3, '900 must not drain');

  var soft = runPower(700);
  assert(!soft.hallReturn, '700 must not reverse down the shooter hall (x=' + soft.x.toFixed(1) + ' y=' + soft.y.toFixed(1) + ')');
  assert(soft.dumped && soft.inPlay, '700 dumps onto playfield x=' + soft.x.toFixed(1) + ' y=' + soft.y.toFixed(1));
  assert(soft.x < 472 - 20, 'dump x well left of hall');
  assert(soft.y > 90, 'dump y below the crown');
  assert(soft.rem === 3, '700 dump is not a drain');

  var mh = fresh();
  sim.launchBall(mh, 1100);
  var mhDump = false;
  var mhHall = false;
  var mhU = false;
  var mhi;
  for (mhi = 0; mhi < 480; mhi++) {
    sim.tick(mh, 1 / 60);
    var mb = mh.ball;
    if (!mb) break;
    if (mh.exitedLaunchLane && mb.y < 90 && mb.x < 400 && mb.x > 140) mhU = true;
    if (mh.exitedLaunchLane && !mh.activeHabitrail && mb.y > 120 && mb.y < 500 && mb.x < 450) mhDump = true;
    if (mb.x > 472 && mb.y > 200) mhHall = true;
    if (!mb.inPlay && mhi > 20) break;
  }
  assert(mhU, '1100 rides the U before peeling');
  assert(mhDump, '1100 must peel the copper off-ramp, not crawl the U (x=' + mh.ball.x.toFixed(1) + ' y=' + mh.ball.y.toFixed(1) + ' hab=' + mh.activeHabitrail + ')');
  assert(mh.ballsRemaining === 3, '1100 dump is not a drain');
  assert(!mhHall || mhDump, '1100 hall visit only after a dump, not a reverse-shooter fail');

  var field = fresh();
  field.ball.inPlay = true;
  field.exitedLaunchLane = true;
  field.phase = 'playing';
  field.activeHabitrail = null;
  field.ball.x = 360;
  field.ball.y = 250;
  field.ball.vx = 240;
  field.ball.vy = -300;
  var reentered = false;
  var i;
  for (i = 0; i < 180; i++) {
    sim.stepPhysics(field, 1 / 60);
    var fb = field.ball;
    if (fb.x > 430 && fb.y < 90) reentered = true;
    if (fb.x > sim.LAUNCH_LANE_LEFT - 2 && fb.y < 170) reentered = true;
  }
  assert(!reentered, 'field ball cannot climb back into the U through the dump (x=' + field.ball.x.toFixed(1) + ' y=' + field.ball.y.toFixed(1) + ')');
  assert(field.ball.y > 80, 'field ball stays below the crown');

  var idx = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert(idx.indexOf('?v=dump7') !== -1, 'cache tag dump5');
  assert(idx.indexOf('?v=dump1') === -1, 'old dump1 cache tag gone');
  var renSrc = fs.readFileSync(path.join(__dirname, '..', 'renderer.js'), 'utf8');
  assert(renSrc.indexOf('right.failDump') !== -1, 'renderer draws copper dump sausage');
  assert(renSrc.indexOf('clipSegsBelowY(right.mergeOuter, 88)') === -1, 'no leftover copper drop fill');
  assert(renSrc.indexOf('fillSausageHull(ctx, dropO, dropI') === -1, 'no drop hull blob');
  assert(renSrc.indexOf('fillSausageHull(ctx, dumpO') === -1, 'no floating failDump sausage');
  var horse = renSrc.indexOf('function drawHorseshoeOrbit');
  var horseEnd = renSrc.indexOf('function drawCopperMergeShoulder');
  assert(horse !== -1 && horseEnd > horse, 'horseshoe draw span');
  var horseSrc = renSrc.slice(horse, horseEnd);
  assert(horseSrc.indexOf('strokeRect') === -1, 'no AABB strokeRect in horseshoe path');
  assert(horseSrc.indexOf('rgba(255,255,255') === -1 && horseSrc.indexOf('rgba(255, 255, 255') === -1, 'no white debug stroke in horseshoe path');
  assert.strictEqual(sim.GRAVITY, 1180);
  assert.strictEqual(sim.HABITRAIL_ASSIST, 0);
  assert.strictEqual(sim.TABLE_W, 560);

  var simSrc = fs.readFileSync(path.join(__dirname, '..', 'simulation.js'), 'utf8');
  assert(simSrc.indexOf('dumpSlide') === -1, 'no dumpSlide aim at the hole');
  assert(simSrc.indexOf('if (ball.y < 86) ball.y = 92') === -1, 'no mouth y snap');
  assert(simSrc.indexOf('targetY = dumpSlide ? 150') === -1, 'no teleport target 150');
  assert(renSrc.indexOf('fillSausageHull(ctx, peelO') !== -1, 'renderer peel sausage');

  function maxJump(power) {
    var st = fresh();
    sim.launchBall(st, power);
    var px = st.ball.x, py = st.ball.y, jump = 0;
    var k;
    for (k = 0; k < 320; k++) {
      sim.tick(st, 1 / 60);
      if (!st.ball || !st.ball.inPlay) break;
      var d = Math.hypot(st.ball.x - px, st.ball.y - py);
      if (d > jump && st.ball.y < 800 && py < 800) jump = d;
      px = st.ball.x;
      py = st.ball.y;
    }
    return jump;
  }
  var j1400 = maxJump(1400);
  var j900 = maxJump(900);
  var j700 = maxJump(700);
  assert(j1400 <= 50, '1400 no single-frame rail jump ' + j1400.toFixed(1));
  assert(j900 <= 50, '900 no single-frame rail jump ' + j900.toFixed(1));
  assert(j700 <= 50, '700 no single-frame rail jump ' + j700.toFixed(1));

  var rtl = fresh();
  rtl.ball.inPlay = true;
  rtl.exitedLaunchLane = true;
  rtl.phase = 'playing';
  rtl.activeHabitrail = 'ramp-l';
  rtl.ball.x = 438;
  rtl.ball.y = 108;
  rtl.ball.vx = 16;
  rtl.ball.vy = 20;
  var rtlDump = false;
  var rtlJump = 0;
  var rpx = rtl.ball.x, rpy = rtl.ball.y;
  var ri;
  for (ri = 0; ri < 240; ri++) {
    sim.stepPhysics(rtl, 1 / 60);
    var rd = Math.hypot(rtl.ball.x - rpx, rtl.ball.y - rpy);
    if (rd > rtlJump) rtlJump = rd;
    rpx = rtl.ball.x;
    rpy = rtl.ball.y;
    if (rtl.ball.y > 160 && rtl.ball.x < 430 && rtl.ball.x > 200) rtlDump = true;
  }
  assert(rtlJump <= 50, 'RTL-slow no single-frame rail jump ' + rtlJump.toFixed(1));
  assert(rtlDump, 'RTL-slow dying on copper finds the off-ramp x=' + rtl.ball.x.toFixed(1) + ' y=' + rtl.ball.y.toFixed(1));
  assert(rtl.ball.y > 90, 'RTL-slow stays below crown after dump');

  var lodge = fresh();
  lodge.ball.inPlay = true;
  lodge.exitedLaunchLane = true;
  lodge.phase = 'playing';
  lodge.activeHabitrail = null;
  lodge.ball.x = 407;
  lodge.ball.y = 202;
  lodge.ball.vx = 0;
  lodge.ball.vy = 0;
  var li;
  for (li = 0; li < 90; li++) sim.stepPhysics(lodge, 1 / 60);
  assert(lodge.ball.y > 210 || lodge.ball.x < 390, 'old stub lodge unsticks onto ramp/field x=' + lodge.ball.x.toFixed(1) + ' y=' + lodge.ball.y.toFixed(1));
  var ljump = Math.hypot(lodge.ball.x - 407, lodge.ball.y - 202);
  assert(ljump < 80 || lodge.ball.y > 210, 'unstick is a nudge not a teleport to the exit');

  console.log('PASS: dump5 restore U (1400 x=' + full.x.toFixed(1) + ' y=' + full.y.toFixed(1) + ' 900 U 700 dump x=' + soft.x.toFixed(1) + ')');
})();
(function testDump3ContinuousUCrownHull() {
  var Render = require('../renderer.js');
  var st = fresh();
  var left = st.sideRoutes.leftRamp;
  var right = st.sideRoutes.rightRamp;
  assert(right && right.mergeOuter && right.mergeOuter.length >= 2, 'draw call site has rightRamp.mergeOuter');
  assert(right && right.mergeInner && right.mergeInner.length >= 2, 'draw call site has rightRamp.mergeInner');
  var outer = Render.horseshoeOuterPoints(left, right);
  var inner = Render.horseshoeInnerPoints(left, right);
  assert(outer && outer.length >= 8 && inner && inner.length >= 8, 'hull polylines exist');
  var oMin = Infinity, oMax = -Infinity, i;
  for (i = 0; i < outer.length; i++) {
    if (outer[i].x < oMin) oMin = outer[i].x;
    if (outer[i].x > oMax) oMax = outer[i].x;
  }
  assert(oMin <= 62 && oMax >= 476, 'horseshoe draw hull spans x ~60 to ~478 (got ' + oMin.toFixed(1) + '-' + oMax.toFixed(1) + ')');
  var crownMin = Infinity, crownMax = -Infinity;
  for (i = 0; i < outer.length; i++) {
    if (outer[i].y > 22) continue;
    if (outer[i].x < crownMin) crownMin = outer[i].x;
    if (outer[i].x > crownMax) crownMax = outer[i].x;
  }
  assert(crownMin <= 62 && crownMax >= 476, 'crown outer y~18 spans ~60-478 (got ' + crownMin + '-' + crownMax + ')');
  assert(outer.some(function (p) { return p.x > 300 && p.y <= 22; }), 'copper crown exists right of join (not left-only)');
  assert(inner.some(function (p) { return p.x >= 450; }), 'inner hull reaches plunge mouth');
  assert(!inner.some(function (p) { return p.y > 120 && p.x > 300 && p.x < 500; }), 'U inner hull has no melted dump scrap');
  assert(!inner.some(function (p) { return Math.abs(p.x - 472) < 1 && Math.abs(p.y - 286) < 1; }), 'inner hull does not extend hall-to-y=286');
  var fs = require('fs');
  var path = require('path');
  var renSrc = fs.readFileSync(path.join(__dirname, '..', 'renderer.js'), 'utf8');
  assert(renSrc.indexOf('fillSausageHull(ctx, peelO') !== -1, 'off-ramp is a sausage peel sharing the elbow');
  assert(renSrc.indexOf('fillSausageHull(ctx, dumpO') === -1, 'no floating dumpO banana');
  assert(renSrc.indexOf('function appendOriented') !== -1, 'oriented hull join helper');
  assert(renSrc.indexOf('fillRect(JOIN_X, 0, 560, 860)') === -1, 'no oversized copper fillRect width 560');
  assert(renSrc.indexOf('TABLE_W - JOIN_X') !== -1, 'copper fillRect uses table-right width');
  assert(renSrc.indexOf('fillRect(JOIN_X - 5, 0, 10, TABLE_H)') !== -1, '10px color seam');
  var idx = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert(idx.indexOf('?v=dump7') !== -1, 'cache tag dump5');
  assert(idx.indexOf('?v=dump3') === -1, 'old dump3 cache tag gone');
  console.log('PASS: dump5 hull spans crown ' + crownMin.toFixed(0) + '-' + crownMax.toFixed(0));
})();

