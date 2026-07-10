'use strict';

/**
 * Phase 2–5: real shipped assets.js hooks + theme swap does not alter physics.
 */
var assert = require('assert');
var sim = require('../simulation.js');
var assets = require('../assets.js');

console.log('Pinball assets / VFX / theme unit tests');
console.log('=======================================');

(function testThemeListAndSwap() {
  var themes = assets.listThemes();
  assert(themes.indexOf('void-pulse') >= 0, 'void-pulse theme present');
  assert(themes.indexOf('ember-rail') >= 0, 'ember-rail theme present');
  assert(assets.setTheme('ember-rail') === true, 'setTheme ember-rail');
  assert.strictEqual(assets.getThemeId(), 'ember-rail');
  assert(assets.setTheme('void-pulse') === true, 'setTheme void-pulse');
  assert.strictEqual(assets.getThemeId(), 'void-pulse');
  assert(assets.setTheme('no-such-theme') === false, 'unknown theme rejected');
  console.log('PASS: theme list and swap');
})();

(function testThemeSwapDoesNotChangePhysics() {
  assets.setTheme('void-pulse');
  var a = sim.createInitialState();
  sim.launchBall(a, 900);
  for (var i = 0; i < 40; i++) sim.tick(a, 0.016);

  assets.setTheme('ember-rail');
  var b = sim.createInitialState();
  sim.launchBall(b, 900);
  for (var j = 0; j < 40; j++) sim.tick(b, 0.016);

  assert.strictEqual(a.ball.x, b.ball.x, 'theme must not change ball.x after same ticks');
  assert.strictEqual(a.ball.y, b.ball.y, 'theme must not change ball.y after same ticks');
  assert.strictEqual(a.ball.vx, b.ball.vx, 'theme must not change ball.vx');
  assert.strictEqual(a.ball.vy, b.ball.vy, 'theme must not change ball.vy');
  assert.strictEqual(a.score, b.score, 'theme must not change score');
  console.log('PASS: theme swap leaves physics outcomes identical');
})();

(function testBumperHitSchedulesSparkAndHitVisual() {
  assets.setTheme('void-pulse');
  assets._resetVfx();

  var state = sim.createInitialState();
  // Place ball overlapping first bumper and force a collision step
  var bumper = state.bumpers[0];
  state.ball.inPlay = true;
  state.ball.x = bumper.x + bumper.radius * 0.4;
  state.ball.y = bumper.y;
  state.ball.vx = -200;
  state.ball.vy = 0;
  state.exitedLaunchLane = true;
  state.phase = 'playing';

  var scoreBefore = state.score;
  for (var i = 0; i < 8; i++) {
    sim.tick(state, 0.016);
    if (state.lastHitType === 'bumper') break;
  }

  assert(state.score > scoreBefore || state.lastHitType === 'bumper' || state.lastHitBumper != null,
    'expected a bumper interaction path');

  // Direct hook test with real processHitEvents on a state that has hit flags
  assets._resetVfx();
  state.lastHitType = 'bumper';
  state.lastHitId = '0';
  state.lastHitBumper = 0;
  state.lastScorePopup = { points: 500, x: bumper.x, y: bumper.y, life: 1, type: 'bumper' };

  var result = assets.processHitEvents(state);
  assert(result, 'processHitEvents returns result for bumper');
  assert.strictEqual(result.type, 'bumper');
  assert(assets.getSparkBursts().length >= 1, 'spark bursts scheduled on bumper hit');
  assert(assets.isBumperHitActive(0), 'bumper hit visual timer active');
  assert(assets.getBumperHitVisual(0) > 0, 'bumper hit visual > 0');

  assets.update(0.05);
  assert(assets.getSparkBursts().length >= 1, 'sparks still alive after short update');
  console.log('PASS: bumper hit schedules spark + hit visual via real assets.js');
})();

(function testFlipperHitSchedulesSpark() {
  assets.setTheme('void-pulse');
  assets._resetVfx();

  var state = sim.createInitialState();
  state.ball.inPlay = true;
  state.ball.x = 200;
  state.ball.y = 700;
  state.ball.vx = 0;
  state.ball.vy = 50;
  state.exitedLaunchLane = true;
  state.phase = 'playing';
  state.lastHitType = 'flipper';
  state.lastHitId = 'left';
  state.lastScorePopup = null;

  var result = assets.processHitEvents(state);
  assert(result, 'processHitEvents returns result for flipper');
  assert.strictEqual(result.type, 'flipper');
  assert(assets.getSparkBursts().length >= 1, 'spark bursts scheduled on flipper hit');
  var burst = assets.getSparkBursts()[0];
  assert.strictEqual(burst.x, state.ball.x, 'spark at ball x for flipper');
  assert.strictEqual(burst.y, state.ball.y, 'spark at ball y for flipper');
  console.log('PASS: flipper hit schedules spark via real assets.js');
})();

(function testSafeDrawGuardsBrokenImages() {
  var calls = [];
  var ctx = {
    drawImage: function () {
      calls.push({ argc: arguments.length, args: Array.prototype.slice.call(arguments) });
    }
  };
  var broken = { complete: true, naturalWidth: 0, naturalHeight: 0 };
  var incomplete = { complete: false, naturalWidth: 64, naturalHeight: 64 };
  assert.strictEqual(assets.safeDrawImage(ctx, broken, 0, 0, 10, 10), false);
  assert.strictEqual(assets.safeDrawImage(ctx, incomplete, 0, 0, 10, 10), false);
  assert.strictEqual(calls.length, 0, 'drawImage must not run for broken/incomplete images');

  var ok = { complete: true, naturalWidth: 64, naturalHeight: 64 };
  // 6-arg safeDrawImage(ctx,img,dx,dy,dw,dh) must map to 5-arg drawImage(img,dx,dy,dw,dh)
  assert.strictEqual(assets.safeDrawImage(ctx, ok, 0, 0, 480, 860), true);
  assert.strictEqual(calls.length, 1, 'drawImage runs for ready images');
  assert.strictEqual(calls[0].argc, 5, 'dest-size form must call drawImage with 5 args (img+dx+dy+dw+dh)');
  assert.strictEqual(calls[0].args[0], ok, 'first arg is image');
  assert.strictEqual(calls[0].args[1], 0);
  assert.strictEqual(calls[0].args[2], 0);
  assert.strictEqual(calls[0].args[3], 480);
  assert.strictEqual(calls[0].args[4], 860);
  assert.strictEqual(calls[0].args[5], undefined, 'must not pass undefined 9-arg overflow');
  console.log('PASS: safeDrawImage guards broken images + dest-size arity');
})();

(function testSafeDrawOverloadsAndPlayfieldLayer() {
  var calls = [];
  var ctx = {
    drawImage: function () {
      calls.push({ argc: arguments.length, args: Array.prototype.slice.call(arguments) });
    },
    save: function () {},
    restore: function () {},
    globalAlpha: 1
  };

  // xy form: safeDrawImage(ctx,img,x,y) → 3-arg drawImage
  var ok = { complete: true, naturalWidth: 32, naturalHeight: 32 };
  assert.strictEqual(assets.safeDrawImage(ctx, ok, 12, 34), true);
  assert.strictEqual(calls[0].argc, 3, 'xy form → drawImage(img,x,y)');
  assert.deepStrictEqual(calls[0].args.slice(1), [12, 34]);

  // full source+dest form: length 10 → drawImage 9 args
  calls.length = 0;
  assert.strictEqual(
    assets.safeDrawImage(ctx, ok, 0, 0, 32, 32, 10, 20, 64, 64),
    true
  );
  assert.strictEqual(calls[0].argc, 9, 'source+dest form → drawImage 9 args');
  assert.deepStrictEqual(calls[0].args.slice(1), [0, 0, 32, 32, 10, 20, 64, 64]);

  // drawPlayfieldLayer uses dest-size form for still + ambient
  assets.setTheme('void-pulse');
  var stillPath = assets._themesIndex.themes['void-pulse'].playfield.still;
  var amb0 = assets._themesIndex.themes['void-pulse'].playfield.ambientFrames[0];
  assets._injectReadyImage(stillPath, 480, 860);
  assets._injectReadyImage(amb0, 240, 430);
  // inject all ambient so layer can pick any frame
  assets._themesIndex.themes['void-pulse'].playfield.ambientFrames.forEach(function (p) {
    assets._injectReadyImage(p, 240, 430);
  });

  calls.length = 0;
  var drew = assets.drawPlayfieldLayer(ctx, 480, 860);
  assert.strictEqual(drew, true, 'drawPlayfieldLayer returns true when still ready');
  assert(calls.length >= 1, 'playfield still must call drawImage');
  // First blit is the still — dest-size 5-arg form
  assert.strictEqual(calls[0].argc, 5, 'playfield still uses dest-size drawImage(img,0,0,tableW,tableH)');
  assert.strictEqual(calls[0].args[1], 0);
  assert.strictEqual(calls[0].args[2], 0);
  assert.strictEqual(calls[0].args[3], 480);
  assert.strictEqual(calls[0].args[4], 860);
  assert.strictEqual(calls[0].args.length, 5, 'no undefined trailing args on still blit');
  // Ambient frame also dest-size
  if (calls.length >= 2) {
    assert.strictEqual(calls[1].argc, 5, 'ambient frame uses dest-size form');
    assert.strictEqual(calls[1].args[3], 480);
    assert.strictEqual(calls[1].args[4], 860);
  }
  console.log('PASS: safeDrawImage overloads + playfield layer blits dest-size form');
})();

(function testSparkFramesAdvance() {
  assets._resetVfx();
  assets.scheduleSpark(100, 200, 1);
  var before = assets.getSparkBursts()[0].frame;
  // advance past several frame durations (fps 18 → ~0.055s each)
  for (var i = 0; i < 20; i++) assets.update(0.06);
  var bursts = assets.getSparkBursts();
  // either advanced frames or completed and removed
  assert(bursts.length === 0 || bursts[0].frame > before, 'spark animation advances frames');
  console.log('PASS: spark multi-frame animation advances');
})();

console.log('=======================================');
console.log('All assets/VFX/theme tests passed.');
