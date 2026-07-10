/**
 * Main game loop, input wiring, and browser bootstrap.
 */
(function () {
  'use strict';

  var Sim = window.PinballSim;
  var Render = window.PinballRender;
  var Audio = window.PinballAudio;
  var Assets = window.PinballAssets;

  var canvas = document.getElementById('pinball-canvas');
  var state = Sim.createInitialState();
  var lastTime = 0;
  var keys = { left: false, right: false, launch: false };
  var soundPrev = Audio.createPrev();

  if (Assets && Assets.preloadTheme) {
    Assets.preloadTheme();
  }

  function unlockAudio() {
    Audio.unlock();
  }

  function resizeCanvas() {
    var targetW = 520;
    var targetH = 980;
    canvas.width = targetW;
    canvas.height = targetH;
    canvas.style.width = targetW + 'px';
    canvas.style.height = targetH + 'px';
  }

  function setLeftFlipper(active) {
    if (active && !keys.left) Audio.flipperFire('left');
    keys.left = active;
    Sim.activateFlipper(state, 'left', active);
  }

  function setRightFlipper(active) {
    if (active && !keys.right) Audio.flipperFire('right');
    keys.right = active;
    Sim.activateFlipper(state, 'right', active);
  }

  function handleKeyDown(e) {
    unlockAudio();
    if (e.code === 'ArrowLeft') {
      setLeftFlipper(true);
    }
    if (e.code === 'ArrowRight') {
      setRightFlipper(true);
    }
    if (e.code === 'Space') {
      e.preventDefault();
      keys.launch = true;
      if (Sim.canChargePlunger(state)) {
        if (!state.ball.inPlay && state.phase === 'playing') {
          state.phase = 'ready';
        }
        Sim.setLaunchCharging(state, true);
      }
    }
    if (e.code === 'KeyR') {
      if (state.phase === 'game_over') {
        state = Sim.createInitialState();
        soundPrev = Audio.createPrev();
      } else if (state.ball.inPlay) {
        Sim.tilt(state);
      }
    }
    // Theme pack swap (art only — does not alter physics)
    if (e.code === 'KeyT' && Assets && Assets.listThemes && Assets.setTheme) {
      var list = Assets.listThemes();
      var cur = Assets.getThemeId();
      var next = list[(list.indexOf(cur) + 1) % list.length];
      Assets.setTheme(next);
    }
  }

  function handleKeyUp(e) {
    unlockAudio();
    if (e.code === 'ArrowLeft') {
      setLeftFlipper(false);
    }
    if (e.code === 'ArrowRight') {
      setRightFlipper(false);
    }
    if (e.code === 'Space') {
      keys.launch = false;
      if (state.launchCharging) {
        Sim.launchBall(state, null);
        Sim.setLaunchCharging(state, false);
      }
    }
  }

  function handlePointerDown(e) {
    unlockAudio();
    if (e.button === 0) {
      e.preventDefault();
      setLeftFlipper(true);
    }
    if (e.button === 2) {
      e.preventDefault();
      setRightFlipper(true);
    }
    try {
      document.body.setPointerCapture(e.pointerId);
    } catch (err) { /* ignore */ }
  }

  function handlePointerUp(e) {
    if (e.button === 0) {
      setLeftFlipper(false);
    }
    if (e.button === 2) {
      setRightFlipper(false);
    }
    try {
      if (document.body.hasPointerCapture(e.pointerId)) {
        document.body.releasePointerCapture(e.pointerId);
      }
    } catch (err) { /* ignore */ }
  }

  function blockContextMenu(e) {
    e.preventDefault();
  }

  function gameLoop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    var dt = Math.min((timestamp - lastTime) / 1000, 0.033);
    lastTime = timestamp;

    if (keys.left) Sim.activateFlipper(state, 'left', true);
    if (keys.right) Sim.activateFlipper(state, 'right', true);

    Sim.tick(state, dt);
    soundPrev = Audio.processState(state, soundPrev);
    Render.render(canvas, state, dt);

    requestAnimationFrame(gameLoop);
  }

  resizeCanvas();
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  document.addEventListener('contextmenu', blockContextMenu);
  window.addEventListener('contextmenu', blockContextMenu);
  document.body.addEventListener('pointerdown', handlePointerDown);
  document.body.addEventListener('pointerup', handlePointerUp);
  document.body.addEventListener('pointercancel', handlePointerUp);
  document.body.addEventListener('auxclick', function (e) {
    if (e.button === 2) e.preventDefault();
  });
  window.addEventListener('resize', resizeCanvas);

  window.PinballGame = {
    canvas: canvas,
    getState: function () { return state; },
    reset: function () {
      state = Sim.createInitialState();
      soundPrev = Audio.createPrev();
    },
    gameLoop: gameLoop,
    setTheme: function (id) {
      if (Assets && Assets.setTheme) return Assets.setTheme(id);
      return false;
    },
    getThemeId: function () {
      return Assets && Assets.getThemeId ? Assets.getThemeId() : null;
    }
  };

  requestAnimationFrame(gameLoop);
})();