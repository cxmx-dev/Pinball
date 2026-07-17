/**
 * Procedural pinball SFX — Web Audio API, no external assets.
 */
(function (root) {
  'use strict';

  var ctx = null;
  var master = null;
  var unlocked = false;
  var lastFlipperFire = { left: 0, right: 0 };

  function ensureCtx() {
    if (ctx) return ctx;
    var AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.52;
    master.connect(ctx.destination);
    return ctx;
  }

  function unlock() {
    var c = ensureCtx();
    if (!c) return false;
    if (c.state === 'suspended') c.resume();
    unlocked = true;
    return true;
  }

  function now() {
    return ctx ? ctx.currentTime : 0;
  }

  function env(gain, t0, attack, decay, peak, sustain, release) {
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + attack);
    gain.gain.exponentialRampToValueAtTime(Math.max(sustain, 0.0002), t0 + attack + decay);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay + release);
  }

  function noiseBuffer(duration) {
    var c = ensureCtx();
    var len = Math.floor(c.sampleRate * duration);
    var buf = c.createBuffer(1, len, c.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function tone(freq, type, t0, dur, peak, opts) {
    opts = opts || {};
    var c = ensureCtx();
    var osc = c.createOscillator();
    var g = c.createGain();
    var f = c.createBiquadFilter();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.slideTo) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(opts.slideTo, 40), t0 + dur * 0.7);
    }
    f.type = opts.filter || 'lowpass';
    f.frequency.value = opts.filterFreq || 2400;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(f);
    f.connect(g);
    g.connect(opts.bus || master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
    return osc;
  }

  function noiseBurst(t0, dur, peak, opts) {
    opts = opts || {};
    var c = ensureCtx();
    var src = c.createBufferSource();
    var g = c.createGain();
    var f = c.createBiquadFilter();
    src.buffer = noiseBuffer(dur);
    f.type = opts.filter || 'bandpass';
    f.frequency.value = opts.filterFreq || 900;
    f.Q.value = opts.q || 0.9;
    env(g, t0, 0.001, dur * 0.25, peak, peak * 0.35, dur);
    src.connect(f);
    f.connect(g);
    g.connect(opts.bus || master);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  function playBumper() {
    var t = now();
    tone(280, 'sine', t, 0.14, 0.55, { slideTo: 110, filterFreq: 1800 });
    tone(520, 'triangle', t, 0.08, 0.18, { slideTo: 200, filterFreq: 3200 });
    noiseBurst(t, 0.06, 0.22, { filterFreq: 1400, q: 1.2 });
    // Spark-sheet paired crackle
    noiseBurst(t + 0.02, 0.05, 0.14, { filter: 'highpass', filterFreq: 2600, q: 1.6 });
  }

  function playSling() {
    var t = now();
    noiseBurst(t, 0.09, 0.38, { filter: 'highpass', filterFreq: 700, q: 0.7 });
    tone(180, 'square', t, 0.05, 0.12, { filterFreq: 900 });
  }

  function playTarget() {
    var t = now();
    tone(120, 'triangle', t, 0.07, 0.35, { filterFreq: 600 });
    noiseBurst(t, 0.04, 0.2, { filterFreq: 500, q: 0.5 });
  }

  function playKicker() {
    var t = now();
    tone(200, 'sine', t, 0.1, 0.5, { slideTo: 90 });
    noiseBurst(t, 0.05, 0.3, { filterFreq: 1100 });
  }

  function playRollover() {
    var t = now();
    tone(880, 'square', t, 0.06, 0.14, { filterFreq: 2200 });
    tone(1320, 'square', t + 0.04, 0.07, 0.1, { filterFreq: 2600 });
  }

  function playSpinner() {
    var t = now();
    for (var i = 0; i < 3; i++) {
      noiseBurst(t + i * 0.018, 0.012, 0.14, { filterFreq: 2200, q: 2 });
    }
    tone(640, 'triangle', t, 0.05, 0.08, { filterFreq: 3000 });
  }

  function playFlipperHit() {
    var t = now();
    noiseBurst(t, 0.05, 0.32, { filter: 'bandpass', filterFreq: 800 });
    tone(90, 'sine', t, 0.08, 0.28, { filterFreq: 400 });
    // Void Pulse spark sizzle pairing (bright electric edge)
    noiseBurst(t + 0.01, 0.04, 0.16, { filter: 'highpass', filterFreq: 2200, q: 1.4 });
    tone(1400, 'triangle', t + 0.005, 0.035, 0.08, { filterFreq: 4000 });
  }

  function playFlipperFire(side) {
    var t = now();
    var stamp = Date.now();
    if (stamp - lastFlipperFire[side] < 45) return;
    lastFlipperFire[side] = stamp;
    noiseBurst(t, 0.025, 0.22, { filter: 'highpass', filterFreq: 1200 });
    tone(70, 'square', t, 0.04, 0.16, { filterFreq: 350 });
  }

  function playLaunch() {
    var t = now();
    noiseBurst(t, 0.12, 0.28, { filter: 'lowpass', filterFreq: 900 });
    tone(60, 'sine', t, 0.2, 0.35, { slideTo: 180, filterFreq: 500 });
    tone(140, 'triangle', t + 0.04, 0.15, 0.2, { slideTo: 320 });
  }

  function playDrain() {
    var t = now();
    noiseBurst(t, 0.18, 0.3, { filter: 'lowpass', filterFreq: 700 });
    tone(220, 'sine', t + 0.05, 0.2, 0.22, { slideTo: 80, filterFreq: 600 });
    noiseBurst(t + 0.12, 0.14, 0.18, { filterFreq: 400, q: 0.4 });
  }

  function playSkillshot() {
    var t = now();
    tone(660, 'square', t, 0.1, 0.2, { filterFreq: 2800 });
    tone(990, 'square', t + 0.08, 0.12, 0.18, { filterFreq: 3000 });
    tone(1320, 'square', t + 0.16, 0.16, 0.14, { filterFreq: 3200 });
  }

  function playSkillshotNear() {
    var t = now();
    tone(520, 'square', t, 0.08, 0.16, { filterFreq: 2400 });
    tone(780, 'square', t + 0.09, 0.1, 0.14, { filterFreq: 2600 });
  }

  function playLaneDash() {
    var t = now();
    tone(440, 'triangle', t, 0.06, 0.12, { filterFreq: 2000 });
    tone(880, 'triangle', t + 0.05, 0.08, 0.1, { filterFreq: 2800 });
  }

  function playBallSave() {
    var t = now();
    tone(523, 'square', t, 0.1, 0.18, { filterFreq: 3000 });
    tone(659, 'square', t + 0.08, 0.12, 0.16, { filterFreq: 3200 });
    tone(784, 'square', t + 0.16, 0.14, 0.14, { filterFreq: 3400 });
    noiseBurst(t + 0.05, 0.08, 0.1, { filterFreq: 1800 });
  }

  function playDrop() {
    var t = now();
    noiseBurst(t, 0.04, 0.2, { filter: 'highpass', filterFreq: 900 });
    tone(180, 'square', t, 0.06, 0.14, { filterFreq: 700 });
  }

  function playRoute() {
    var t = now();
    tone(300, 'triangle', t, 0.08, 0.14, { slideTo: 520, filterFreq: 1600 });
    noiseBurst(t + 0.02, 0.06, 0.12, { filterFreq: 1200 });
  }

  function playRushStart() {
    var t = now();
    tone(440, 'square', t, 0.1, 0.16, { filterFreq: 2400 });
    tone(660, 'square', t + 0.08, 0.12, 0.14, { filterFreq: 2800 });
    tone(880, 'square', t + 0.16, 0.14, 0.12, { filterFreq: 3200 });
  }

  function playEob() {
    var t = now();
    tone(392, 'triangle', t, 0.12, 0.14, { filterFreq: 1800 });
    tone(523, 'triangle', t + 0.1, 0.14, 0.12, { filterFreq: 2000 });
  }

  function playJackpot() {
    var t = now();
    var notes = [523, 659, 784, 1047];
    notes.forEach(function (f, i) {
      tone(f, 'square', t + i * 0.07, 0.18, 0.16, { filterFreq: 3500 });
    });
    noiseBurst(t, 0.1, 0.12, { filterFreq: 2000 });
  }

  function playTilt() {
    var t = now();
    for (var i = 0; i < 4; i++) {
      tone(180, 'square', t + i * 0.09, 0.07, 0.14, { filterFreq: 800 });
    }
  }

  function playTiltOut() {
    var t = now();
    playTilt();
    noiseBurst(t + 0.35, 0.25, 0.35, { filterFreq: 300, q: 0.6 });
    tone(90, 'sawtooth', t + 0.35, 0.3, 0.2, { filterFreq: 400 });
  }

  function playGameOver() {
    var t = now();
    tone(392, 'triangle', t, 0.25, 0.16, { slideTo: 196, filterFreq: 1200 });
    tone(294, 'triangle', t + 0.2, 0.35, 0.14, { slideTo: 147, filterFreq: 900 });
  }

  function playChargeTick() {
    var t = now();
    tone(320 + Math.random() * 40, 'square', t, 0.02, 0.04, { filterFreq: 1800 });
  }

  var handlers = {
    bumper: playBumper,
    sling: playSling,
    target: playTarget,
    kicker: playKicker,
    rollover: playRollover,
    spinner: playSpinner,
    flipper: playFlipperHit,
    skillshot: playSkillshot,
    'skillshot-near': playSkillshotNear,
    lanedash: playLaneDash,
    ballsave: playBallSave,
    drop: playDrop,
    route: playRoute,
    rushstart: playRushStart,
    eob: playEob,
    jackpot: playJackpot,
    tilt: playTilt,
    tiltout: playTiltOut,
    launch: playLaunch,
    drain: playDrain,
    gameover: playGameOver,
    charge: playChargeTick
  };

  function play(name) {
    if (!unlocked || !ctx) return;
    var fn = handlers[name];
    if (fn) fn();
  }

  function processState(state, prev) {
    if (!unlocked) return prev;

    if (state.lastHitType) {
      if (state.lastHitType === 'tilt' && state.lastScorePopup && state.lastScorePopup.type === 'tiltout') {
        play('tiltout');
      } else {
        play(state.lastHitType);
      }
    }

    if (state.drainEvents > prev.drainEvents) play('drain');

    if (state.phase === 'game_over' && prev.phase !== 'game_over') play('gameover');

    if (state.ball.inPlay && !prev.ballInPlay) play('launch');

    var chargeTick = prev.chargeTick || 0;
    if (state.launchCharging) {
      chargeTick += 1;
      if (chargeTick % 18 === 0) play('charge');
    } else {
      chargeTick = 0;
    }

    return {
      phase: state.phase,
      drainEvents: state.drainEvents,
      ballInPlay: state.ball.inPlay,
      launchCharging: state.launchCharging,
      chargeTick: chargeTick
    };
  }

  function createPrev() {
    return {
      phase: 'ready',
      drainEvents: 0,
      ballInPlay: false,
      launchCharging: false,
      chargeTick: 0
    };
  }

  root.PinballAudio = {
    unlock: unlock,
    play: play,
    processState: processState,
    createPrev: createPrev,
    flipperFire: playFlipperFire,
    isUnlocked: function () { return unlocked; }
  };
})(typeof window !== 'undefined' ? window : globalThis);