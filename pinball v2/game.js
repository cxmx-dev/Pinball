/**
 * Main game loop, input wiring, and browser bootstrap.
 * Device-aware: scales table to viewport; touch half-screen + on-screen buttons.
 */
(function () {
  'use strict';

  var Sim = window.PinballSim;
  var Render = window.PinballRender;
  var Audio = window.PinballAudio;
  var Assets = window.PinballAssets;
  var Device = window.DeviceProfile;

  var canvas = document.getElementById('pinball-canvas');
  var state = Sim.createInitialState();
  var lastTime = 0;
  var keys = { left: false, right: false, launch: false };
  var soundPrev = Audio.createPrev();
  var activePointers = Object.create(null);

  if (Assets && Assets.preloadTheme) {
    Assets.preloadTheme();
  }

  function unlockAudio() {
    Audio.unlock();
  }

  function isTouchProfile() {
    var p = Device && Device.get ? Device.get() : null;
    return !!(p && (p.isTouch || p.isPhone || p.isTablet));
  }

  function resizeCanvas() {
    var targetW = 520;
    var targetH = 980;
    canvas.width = targetW;
    canvas.height = targetH;
    if (Device && Device.fitCanvas) {
      Device.fitCanvas(canvas, {
        touchChrome: isTouchProfile() ? 72 : 0,
        pad: 8,
        allowUpscale: false
      });
    } else {
      canvas.style.width = targetW + 'px';
      canvas.style.height = targetH + 'px';
    }
  }

  function setLeftFlipper(active) {
    if (active && !keys.left) Audio.flipperFire('left');
    keys.left = active;
    Sim.activateFlipper(state, 'left', active);
    var btn = document.getElementById('btn-left');
    if (btn) btn.classList.toggle('held', !!active);
  }

  function setRightFlipper(active) {
    if (active && !keys.right) Audio.flipperFire('right');
    keys.right = active;
    Sim.activateFlipper(state, 'right', active);
    var btn = document.getElementById('btn-right');
    if (btn) btn.classList.toggle('held', !!active);
  }

  function beginLaunchCharge() {
    keys.launch = true;
    if (Sim.canChargePlunger(state)) {
      if (!state.ball.inPlay && state.phase === 'playing') {
        state.phase = 'ready';
      }
      Sim.setLaunchCharging(state, true);
    }
  }

  function endLaunchCharge() {
    keys.launch = false;
    if (state.launchCharging) {
      Sim.launchBall(state, null);
      Sim.setLaunchCharging(state, false);
    }
  }

  function doTiltOrRestart() {
    if (state.phase === 'game_over') {
      state = Sim.createInitialState();
      soundPrev = Audio.createPrev();
    } else if (state.ball.inPlay) {
      Sim.tilt(state);
    }
  }

  function cycleTheme() {
    if (Assets && Assets.listThemes && Assets.setTheme) {
      var list = Assets.listThemes();
      var cur = Assets.getThemeId();
      var next = list[(list.indexOf(cur) + 1) % list.length];
      Assets.setTheme(next);
    }
  }

  function handleKeyDown(e) {
    unlockAudio();
    if (e.code === 'ArrowLeft') setLeftFlipper(true);
    if (e.code === 'ArrowRight') setRightFlipper(true);
    if (e.code === 'Space') {
      e.preventDefault();
      beginLaunchCharge();
    }
    if (e.code === 'KeyR') doTiltOrRestart();
    if (e.code === 'KeyT') cycleTheme();
  }

  function handleKeyUp(e) {
    unlockAudio();
    if (e.code === 'ArrowLeft') setLeftFlipper(false);
    if (e.code === 'ArrowRight') setRightFlipper(false);
    if (e.code === 'Space') endLaunchCharge();
  }

  function sideFromEvent(e) {
    var rect = canvas.getBoundingClientRect();
    var x = e.clientX;
    if (x < rect.left || x > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
      // off-canvas: use full viewport half for coarse touch
      return e.clientX < window.innerWidth * 0.5 ? 'left' : 'right';
    }
    var mid = rect.left + rect.width * 0.5;
    return x < mid ? 'left' : 'right';
  }

  function isOnTouchChrome(e) {
    var ui = document.getElementById('touch-ui');
    if (!ui || ui.style.display === 'none') return false;
    return !!(e.target && e.target.closest && e.target.closest('#touch-ui'));
  }

  function handlePointerDown(e) {
    unlockAudio();
    if (isOnTouchChrome(e)) return;

    // Mouse / pen: left click = left flipper, right click = right (desktop)
    if (e.pointerType === 'mouse' || e.pointerType === 'pen') {
      if (e.button === 0) {
        e.preventDefault();
        setLeftFlipper(true);
        activePointers[e.pointerId] = 'left';
      } else if (e.button === 2) {
        e.preventDefault();
        setRightFlipper(true);
        activePointers[e.pointerId] = 'right';
      }
    } else {
      // Touch: half-screen flippers (multi-touch OK)
      e.preventDefault();
      var side = sideFromEvent(e);
      activePointers[e.pointerId] = side;
      if (side === 'left') setLeftFlipper(true);
      else setRightFlipper(true);
    }
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (err) { /* ignore */ }
  }

  function handlePointerUp(e) {
    var side = activePointers[e.pointerId];
    delete activePointers[e.pointerId];
    if (side === 'left') {
      // release left only if no other pointer still holds left
      var stillLeft = false;
      for (var id in activePointers) {
        if (activePointers[id] === 'left') stillLeft = true;
      }
      if (!stillLeft) setLeftFlipper(false);
    } else if (side === 'right') {
      var stillRight = false;
      for (var id2 in activePointers) {
        if (activePointers[id2] === 'right') stillRight = true;
      }
      if (!stillRight) setRightFlipper(false);
    } else if (e.pointerType === 'mouse') {
      if (e.button === 0) setLeftFlipper(false);
      if (e.button === 2) setRightFlipper(false);
    }
    try {
      if (canvas.hasPointerCapture && canvas.hasPointerCapture(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId);
      }
    } catch (err) { /* ignore */ }
  }

  function bindHoldButton(el, onDown, onUp) {
    if (!el) return;
    function down(ev) {
      unlockAudio();
      ev.preventDefault();
      ev.stopPropagation();
      onDown();
    }
    function up(ev) {
      ev.preventDefault();
      ev.stopPropagation();
      onUp();
    }
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointerleave', up);
    el.addEventListener('pointercancel', up);
  }

  function bindTapButton(el, fn) {
    if (!el) return;
    el.addEventListener('pointerdown', function (ev) {
      unlockAudio();
      ev.preventDefault();
      ev.stopPropagation();
      fn();
    });
  }

  function wireTouchUi() {
    bindHoldButton(document.getElementById('btn-left'), function () {
      setLeftFlipper(true);
    }, function () {
      setLeftFlipper(false);
    });
    bindHoldButton(document.getElementById('btn-right'), function () {
      setRightFlipper(true);
    }, function () {
      setRightFlipper(false);
    });
    bindHoldButton(document.getElementById('btn-launch'), beginLaunchCharge, endLaunchCharge);
    bindTapButton(document.getElementById('btn-tilt'), doTiltOrRestart);

    // long-press tilt button corners unused — double-tap theme: second button row not needed;
    // theme: hold tilt 600ms cycles on touch devices
    var tiltBtn = document.getElementById('btn-tilt');
    if (tiltBtn) {
      var pressT = 0;
      tiltBtn.addEventListener('pointerdown', function () {
        pressT = Date.now();
      });
      tiltBtn.addEventListener('pointerup', function () {
        if (Date.now() - pressT > 550) cycleTheme();
      });
    }
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
  wireTouchUi();
  if (Device && Device.onChange) Device.onChange(resizeCanvas);

  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  document.addEventListener('contextmenu', blockContextMenu);
  window.addEventListener('contextmenu', blockContextMenu);
  canvas.addEventListener('pointerdown', handlePointerDown);
  canvas.addEventListener('pointerup', handlePointerUp);
  canvas.addEventListener('pointercancel', handlePointerUp);
  canvas.addEventListener('pointerleave', function (e) {
    if (e.pointerType === 'mouse') handlePointerUp(e);
  });
  document.body.addEventListener('auxclick', function (e) {
    if (e.button === 2) e.preventDefault();
  });
  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('orientationchange', function () {
    setTimeout(resizeCanvas, 80);
  });

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
