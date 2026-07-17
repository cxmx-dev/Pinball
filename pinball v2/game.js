/**
 * Main game loop, input wiring, browser bootstrap.
 * Device-aware fit + touch dock + legend drawer (L / swipe).
 */
(function () {
  'use strict';

  var Sim = window.PinballSim;
  var Render = window.PinballRender;
  var Audio = window.PinballAudio;
  var Assets = window.PinballAssets;
  var Device = window.DeviceProfile;
  var HS = window.PinballHighScores;

  var canvas = document.getElementById('pinball-canvas');
  var legendDrawer = document.getElementById('legend-drawer');
  var legendBackdrop = document.getElementById('legend-backdrop');
  var legendClose = document.getElementById('legend-close');
  var gameOverUi = document.getElementById('gameover-restart');
  var btnRestartBall = document.getElementById('btn-restart-ball');
  var touchUi = document.getElementById('touch-ui');
  var highScoreListEl = document.getElementById('highscore-list');
  var btnCopyScore = document.getElementById('btn-copy-score');
  var btnMute = document.getElementById('btn-mute');
  var state = Sim.createInitialState();
  var lastTime = 0;
  var keys = { left: false, right: false, launch: false };
  var soundPrev = Audio.createPrev();
  var activePointers = Object.create(null);
  var legendOpen = false;
  var swipeTrack = null;
  var lastPhase = state.phase;
  var hintEl = document.getElementById('swipe-legend-hint');
  var hintHidden = false;
  var hintTimer = null;
  var lastHighScoreRecorded = -1;
  var lastShareLine = '';

  if (Assets && Assets.preloadTheme) {
    Assets.preloadTheme();
  }
  if (Assets && Assets.getThemeId && Sim.setThemeId) {
    Sim.setThemeId(state, Assets.getThemeId());
  }

  function hideSwipeHint() {
    if (hintHidden) return;
    hintHidden = true;
    if (hintTimer) {
      clearTimeout(hintTimer);
      hintTimer = null;
    }
    if (hintEl) {
      hintEl.classList.add('hint-hidden');
      hintEl.setAttribute('aria-hidden', 'true');
    }
  }

  function scheduleHintAutoHide() {
    if (hintHidden || hintTimer) return;
    hintTimer = setTimeout(function () {
      hintTimer = null;
      hideSwipeHint();
    }, 8000);
  }

  function unlockAudio() {
    Audio.unlock();
  }

  function isTouchProfile() {
    var p = Device && Device.get ? Device.get() : null;
    return !!(p && (p.isTouch || p.isPhone || p.isTablet));
  }

  function setLegendOpen(open) {
    legendOpen = !!open;
    if (legendDrawer) {
      legendDrawer.classList.toggle('open', legendOpen);
      legendDrawer.setAttribute('aria-hidden', legendOpen ? 'false' : 'true');
    }
    if (legendBackdrop) {
      legendBackdrop.classList.toggle('open', legendOpen);
      legendBackdrop.setAttribute('aria-hidden', legendOpen ? 'false' : 'true');
    }
  }

  function toggleLegend() {
    setLegendOpen(!legendOpen);
  }

  function resizeCanvas() {
    var targetW = 520;
    var targetH = 980;
    canvas.width = targetW;
    canvas.height = targetH;
    // Reserve space for bottom dock (all devices) + Theme|Legend + swipe/PC hint
    // (fitCanvas must honor this on PC too — see device.js touchChrome, not touch-only)
    var chrome = 150;
    if (Device && Device.fitCanvas) {
      Device.fitCanvas(canvas, {
        touchChrome: chrome,
        pad: 8,
        allowUpscale: false
      });
    } else {
      canvas.style.width = targetW + 'px';
      canvas.style.height = targetH + 'px';
    }
  }

  function setLeftFlipper(active) {
    if (active) hideSwipeHint();
    if (active && !keys.left) Audio.flipperFire('left');
    keys.left = active;
    Sim.activateFlipper(state, 'left', active);
    var btn = document.getElementById('btn-left');
    if (btn) btn.classList.toggle('held', !!active);
  }

  function setRightFlipper(active) {
    if (active) hideSwipeHint();
    if (active && !keys.right) Audio.flipperFire('right');
    keys.right = active;
    Sim.activateFlipper(state, 'right', active);
    var btn = document.getElementById('btn-right');
    if (btn) btn.classList.toggle('held', !!active);
  }

  function beginLaunchCharge() {
    hideSwipeHint();
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

  function restartGame() {
    state = Sim.createInitialState();
    if (Assets && Assets.getThemeId && Sim.setThemeId) {
      Sim.setThemeId(state, Assets.getThemeId());
    }
    soundPrev = Audio.createPrev();
    lastPhase = state.phase;
    lastHighScoreRecorded = -1;
    updateGameOverUi();
    updateDockContext();
  }

  function doTiltOrRestart() {
    if (state.phase === 'game_over') {
      restartGame();
    } else if (state.ball.inPlay) {
      Sim.tilt(state);
    }
  }

  function loadHighScores() {
    if (!HS) return [];
    try {
      var raw = localStorage.getItem(HS.STORAGE_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveHighScores(list) {
    if (!HS) return;
    try {
      localStorage.setItem(HS.STORAGE_KEY, JSON.stringify(list));
    } catch (e) { /* private mode */ }
  }

  function renderHighScoreList(list, highlightScore) {
    if (!highScoreListEl || !HS) return;
    highScoreListEl.innerHTML = '';
    var rows = list || [];
    if (!rows.length) {
      var empty = document.createElement('li');
      empty.textContent = 'No scores yet';
      highScoreListEl.appendChild(empty);
      return;
    }
    rows.forEach(function (entry, idx) {
      var e = HS.normalizeEntry(entry);
      if (!e) return;
      var li = document.createElement('li');
      if (highlightScore != null && e.score === highlightScore) li.className = 'hi';
      var rank = document.createElement('span');
      rank.textContent = '#' + (idx + 1);
      var pts = document.createElement('span');
      pts.textContent = e.score.toLocaleString('en-US');
      li.appendChild(rank);
      li.appendChild(pts);
      highScoreListEl.appendChild(li);
    });
  }

  function recordGameOverScore() {
    if (!HS || state.phase !== 'game_over') return;
    if (lastHighScoreRecorded === state.score) return;
    lastHighScoreRecorded = state.score;
    var list = loadHighScores();
    var next = HS.updateHighScores(list, state.score, HS.DEFAULT_MAX);
    saveHighScores(next);
    renderHighScoreList(next, state.score);
    var rank = HS.rankOfScore(next, state.score);
    lastShareLine = HS.formatShareLine(state.score, rank);
  }

  function updateDockContext() {
    if (!touchUi) return;
    var inPlay = !!(state.ball && state.ball.inPlay && state.phase === 'playing');
    touchUi.classList.toggle('ball-in-play', inPlay);
  }

  function updateMuteButton() {
    if (!btnMute || !Audio.isMuted) return;
    var m = Audio.isMuted();
    btnMute.classList.toggle('muted', m);
    btnMute.setAttribute('aria-pressed', m ? 'true' : 'false');
    btnMute.textContent = m ? 'Muted' : 'Sound';
  }

  function updateGameOverUi() {
    if (!gameOverUi) return;
    // Desktop + mobile: spinning pinball restart (PC can also press NumPad 7)
    var show = state.phase === 'game_over';
    gameOverUi.classList.toggle('show', show);
    gameOverUi.setAttribute('aria-hidden', show ? 'false' : 'true');
    if (show) recordGameOverScore();
    updateDockContext();
  }

  function cycleTheme() {
    if (Assets && Assets.listThemes && Assets.setTheme) {
      var list = Assets.listThemes();
      var cur = Assets.getThemeId();
      var next = list[(list.indexOf(cur) + 1) % list.length];
      Assets.setTheme(next);
      if (Sim.setThemeId) Sim.setThemeId(state, next);
      state.themeFlash = 0.4;
      if (Audio.play) {
        unlockAudio();
        Audio.play('rushstart');
      }
    }
  }

  // Multi-key flippers: any bound key holds; release only when all left/right keys up.
  var leftKeyHeld = Object.create(null);
  var rightKeyHeld = Object.create(null);

  function isLeftFlipperKey(code) {
    return code === 'ArrowLeft' || code === 'KeyA' || code === 'Numpad1';
  }

  function isRightFlipperKey(code) {
    return code === 'ArrowRight' || code === 'KeyD' || code === 'Numpad3';
  }

  function anyHeld(map) {
    for (var k in map) {
      if (map[k]) return true;
    }
    return false;
  }

  function handleKeyDown(e) {
    unlockAudio();
    if (e.code === 'KeyL') {
      e.preventDefault();
      toggleLegend();
      return;
    }
    if (legendOpen && e.code === 'Escape') {
      setLegendOpen(false);
      return;
    }
    if (isLeftFlipperKey(e.code)) {
      e.preventDefault();
      leftKeyHeld[e.code] = true;
      setLeftFlipper(true);
    }
    if (isRightFlipperKey(e.code)) {
      e.preventDefault();
      rightKeyHeld[e.code] = true;
      setRightFlipper(true);
    }
    if (e.code === 'Space') {
      e.preventDefault();
      beginLaunchCharge();
    }
    // Tilt is intentionally awkward (NumPad 7 only) — not letter R
    if (e.code === 'Numpad7') {
      e.preventDefault();
      doTiltOrRestart();
    }
    if (e.code === 'KeyT') cycleTheme();
  }

  function handleKeyUp(e) {
    unlockAudio();
    if (isLeftFlipperKey(e.code)) {
      leftKeyHeld[e.code] = false;
      if (!anyHeld(leftKeyHeld)) setLeftFlipper(false);
    }
    if (isRightFlipperKey(e.code)) {
      rightKeyHeld[e.code] = false;
      if (!anyHeld(rightKeyHeld)) setRightFlipper(false);
    }
    if (e.code === 'Space') endLaunchCharge();
  }

  function sideFromEvent(e) {
    var rect = canvas.getBoundingClientRect();
    var x = e.clientX;
    if (x < rect.left || x > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
      return e.clientX < window.innerWidth * 0.5 ? 'left' : 'right';
    }
    var mid = rect.left + rect.width * 0.5;
    return x < mid ? 'left' : 'right';
  }

  function isUiChrome(e) {
    return !!(e.target && e.target.closest && (
      e.target.closest('#touch-ui') ||
      e.target.closest('#btn-tilt') ||
      e.target.closest('#legend-drawer') ||
      e.target.closest('#legend-backdrop') ||
      e.target.closest('#gameover-restart')
    ));
  }

  function handlePointerDown(e) {
    unlockAudio();
    if (isUiChrome(e)) return;
    if (legendOpen) return;

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
    bindTapButton(document.getElementById('btn-theme'), cycleTheme);
    bindTapButton(document.getElementById('btn-legend'), toggleLegend);

    if (btnRestartBall) {
      function pressRestart(ev) {
        unlockAudio();
        ev.preventDefault();
        ev.stopPropagation();
        if (state.phase === 'game_over') restartGame();
      }
      btnRestartBall.addEventListener('pointerdown', pressRestart);
      btnRestartBall.addEventListener('click', pressRestart);
    }
  }

  function wireLegend() {
    if (legendClose) {
      legendClose.addEventListener('click', function (e) {
        e.preventDefault();
        setLegendOpen(false);
      });
      legendClose.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        e.stopPropagation();
        setLegendOpen(false);
      });
    }
    if (legendBackdrop) {
      legendBackdrop.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        setLegendOpen(false);
      });
    }

    // Fast swipe right-to-left (finger moves left) opens legend
    document.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (isUiChrome(e) && !e.target.closest('#stage')) return;
      if (legendOpen) return;
      swipeTrack = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        t: Date.now()
      };
    }, { capture: true, passive: true });

    document.addEventListener('pointerup', function (e) {
      if (!swipeTrack || swipeTrack.id !== e.pointerId) return;
      var dx = e.clientX - swipeTrack.x;
      var dy = e.clientY - swipeTrack.y;
      var dt = Date.now() - swipeTrack.t;
      swipeTrack = null;
      // right-to-left: negative dx, fast, mostly horizontal
      if (dt > 0 && dt < 420 && dx < -72 && Math.abs(dx) > Math.abs(dy) * 1.25) {
        unlockAudio();
        setLegendOpen(true);
      }
    }, { capture: true, passive: true });

    document.addEventListener('pointercancel', function () {
      swipeTrack = null;
    }, { capture: true, passive: true });
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
    if (state.themeFlash > 0) {
      state.themeFlash = Math.max(0, state.themeFlash - dt);
    }
    soundPrev = Audio.processState(state, soundPrev);
    Render.render(canvas, state, dt);
    updateDockContext();

    if (state.phase !== lastPhase) {
      lastPhase = state.phase;
      updateGameOverUi();
    }

    requestAnimationFrame(gameLoop);
  }

  function wireMuteAndShare() {
    if (btnMute) {
      bindTapButton(btnMute, function () {
        unlockAudio();
        if (Audio.toggleMute) Audio.toggleMute();
        updateMuteButton();
      });
      updateMuteButton();
    }
    if (btnCopyScore) {
      bindTapButton(btnCopyScore, function () {
        var line = lastShareLine || (HS ? HS.formatShareLine(state.score, null) : String(state.score));
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(line).then(function () {
            btnCopyScore.textContent = 'Copied!';
            setTimeout(function () { btnCopyScore.textContent = 'Copy score line'; }, 1200);
          }).catch(function () {
            btnCopyScore.textContent = 'Copy failed';
            setTimeout(function () { btnCopyScore.textContent = 'Copy score line'; }, 1200);
          });
        } else {
          btnCopyScore.textContent = line.slice(0, 18) + '…';
        }
      });
    }
  }

  resizeCanvas();
  wireTouchUi();
  wireLegend();
  wireMuteAndShare();
  updateGameOverUi();
  updateDockContext();
  scheduleHintAutoHide();
  if (Device && Device.onChange) {
    Device.onChange(function () {
      resizeCanvas();
      updateGameOverUi();
    });
  }

  window.addEventListener('keydown', function (e) {
    hideSwipeHint();
    handleKeyDown(e);
  });
  window.addEventListener('keyup', handleKeyUp);
  document.addEventListener('contextmenu', blockContextMenu);
  window.addEventListener('contextmenu', blockContextMenu);
  canvas.addEventListener('pointerdown', function (e) {
    hideSwipeHint();
    handlePointerDown(e);
  });
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
      if (Assets && Assets.setTheme) {
        var ok = Assets.setTheme(id);
        if (ok && Sim.setThemeId) Sim.setThemeId(state, id);
        return ok;
      }
      return false;
    },
    getThemeId: function () {
      return Assets && Assets.getThemeId ? Assets.getThemeId() : null;
    },
    toggleLegend: toggleLegend,
    setLegendOpen: setLegendOpen
  };

  requestAnimationFrame(gameLoop);
})();
