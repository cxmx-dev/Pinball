'use strict';

/**
 * Browser-like load verification — mirrors index.html script tag order.
 * No artificial global injection; game.js uses window.PinballSim explicitly.
 */
var fs = require('fs');
var path = require('path');
var os = require('os');
var vm = require('vm');

var root = __dirname;
var scratch = process.env.SCRATCH || path.join(os.tmpdir(), 'pinball-scratch');
var log = [];

function createTrackingContext() {
  var stats = { fillRect: 0, arc: 0, fill: 0, stroke: 0, drawImage: 0 };
  function track(name) {
    return function () { stats[name]++; };
  }
  var grad = { addColorStop: function () {} };
  return {
    stats: stats,
    ctx: {
      fillRect: track('fillRect'),
      arc: track('arc'),
      fill: track('fill'),
      stroke: track('stroke'),
      drawImage: track('drawImage'),
      createLinearGradient: function () { return grad; },
      createRadialGradient: function () { return grad; },
      save: function () {},
      restore: function () {},
      translate: function () {},
      rotate: function () {},
      beginPath: function () {},
      moveTo: function () {},
      lineTo: function () {},
      quadraticCurveTo: function () {},
      closePath: function () {},
      clip: function () {},
      strokeRect: function () { stats.stroke++; },
      setLineDash: function () {},
      fillText: function () {},
      strokeStyle: '',
      fillStyle: '',
      lineWidth: 0,
      lineCap: '',
      font: '',
      textAlign: '',
      textBaseline: '',
      shadowColor: '',
      shadowBlur: 0,
      globalAlpha: 1
    }
  };
}

function browserLoad(runId) {
  log.push('--- Browser-like load run ' + runId + ' ---');

  var tracking = createTrackingContext();
  var rafCallback = null;

  function FakeImage() {
    this.src = '';
    this.complete = false;
    this.naturalWidth = 0;
    this.naturalHeight = 0;
  }

  var window = {
    document: {
      getElementById: function (id) {
        if (id === 'pinball-canvas') {
          return {
            width: 0,
            height: 0,
            style: {},
            addEventListener: function () {},
            setPointerCapture: function () {},
            hasPointerCapture: function () { return false; },
            releasePointerCapture: function () {},
            getContext: function (type) {
              if (type === '2d') return tracking.ctx;
              return null;
            }
          };
        }
        return null;
      },
      createElement: function (tag) {
        if (tag === 'video') {
          return {
            src: '',
            muted: true,
            loop: true,
            playsInline: true,
            readyState: 0,
            videoWidth: 0,
            videoHeight: 0,
            setAttribute: function () {},
            play: function () { return Promise.resolve(); }
          };
        }
        return {};
      }
    },
    addEventListener: function () {},
    requestAnimationFrame: function (cb) {
      rafCallback = cb;
      return runId * 100;
    },
    Image: FakeImage,
    PinballSim: null,
    PinballAssets: null,
    PinballRender: null,
    PinballAudio: null,
    PinballGame: null,
    AudioContext: function () {
      return {
        state: 'running',
        currentTime: 0,
        destination: {},
        sampleRate: 44100,
        createGain: function () {
          return { gain: { value: 0, setValueAtTime: function () {}, exponentialRampToValueAtTime: function () {} }, connect: function () {} };
        },
        createOscillator: function () {
          return {
            type: 'sine',
            frequency: { setValueAtTime: function () {}, exponentialRampToValueAtTime: function () {} },
            connect: function () {},
            start: function () {},
            stop: function () {}
          };
        },
        createBiquadFilter: function () {
          return { type: 'lowpass', frequency: { value: 0 }, Q: { value: 0 }, connect: function () {} };
        },
        createBuffer: function () { return { getChannelData: function () { return new Float32Array(8); } }; },
        createBufferSource: function () {
          return { buffer: null, connect: function () {}, start: function () {}, stop: function () {} };
        },
        resume: function () { return Promise.resolve(); }
      };
    }
  };

  var body = {
    addEventListener: function () {},
    setPointerCapture: function () {},
    hasPointerCapture: function () { return false; },
    releasePointerCapture: function () {}
  };
  var document = {
    addEventListener: function () {},
    getElementById: window.document.getElementById,
    body: body
  };

  var context = {
    window: window,
    document: document,
    console: console,
    Math: Math,
    Image: FakeImage,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    requestAnimationFrame: window.requestAnimationFrame.bind(window)
  };

  vm.createContext(context);

  var scripts = ['simulation.js', 'assets.js', 'renderer.js', 'audio.js', 'game.js'];
  scripts.forEach(function (file) {
    var code = fs.readFileSync(path.join(root, file), 'utf8');
    vm.runInContext(code, context, { filename: file });
    log.push('  loaded ' + file + ' without error');
  });

  assertTruthy(window.PinballSim, 'window.PinballSim');
  assertTruthy(window.PinballAssets, 'window.PinballAssets');
  assertTruthy(window.PinballRender, 'window.PinballRender');
  assertTruthy(window.PinballAudio, 'window.PinballAudio');
  assertTruthy(window.PinballGame, 'window.PinballGame');
  assertTruthy(typeof window.PinballAssets.processHitEvents === 'function', 'processHitEvents');
  assertTruthy(typeof window.PinballAssets.setTheme === 'function', 'setTheme');

  var canvas = window.PinballGame.canvas;
  assertTruthy(canvas, 'PinballGame.canvas');
  assertEqual(canvas.width, 520, 'canvas.width');
  assertEqual(canvas.height, 980, 'canvas.height');

  assertTruthy(typeof window.PinballGame.getState === 'function', 'getState');
  assertTruthy(typeof window.PinballGame.gameLoop === 'function', 'gameLoop');

  var state = window.PinballGame.getState();
  assertEqual(state.tableW, 480, 'state.tableW');
  assertEqual(state.ballsRemaining, 3, 'state.ballsRemaining');

  assertTruthy(rafCallback, 'requestAnimationFrame callback registered');
  rafCallback(16);
  log.push('  invoked RAF gameLoop(16) — tick + render executed');

  log.push('  render draw stats: fillRect=' + tracking.stats.fillRect +
    ' arc=' + tracking.stats.arc +
    ' fill=' + tracking.stats.fill +
    ' stroke=' + tracking.stats.stroke +
    ' drawImage=' + tracking.stats.drawImage);

  if (tracking.stats.fillRect < 2) throw new Error('render did not fill cabinet/HUD');
  if (tracking.stats.arc < 4) throw new Error('render did not draw playfield arcs');
  if (tracking.stats.fill < 8) throw new Error('render surface not substantially filled');

  log.push('Run ' + runId + ': OK — zero errors, globals on window, canvas 520x980, render observed');
}

function assertTruthy(v, label) {
  if (!v) throw new Error('Expected ' + label + ' to be truthy');
}

function assertEqual(a, b, label) {
  if (a !== b) throw new Error(label + ': expected ' + b + ' got ' + a);
}

try {
  browserLoad(1);
  browserLoad(2);
  log.push('=== All browser-like loads succeeded (2/2) ===');
  fs.mkdirSync(scratch, { recursive: true });
  fs.writeFileSync(path.join(scratch, 'launch.log'), log.join('\n') + '\n', { encoding: 'utf8' });
  console.log(log.join('\n'));
  process.exit(0);
} catch (err) {
  log.push('ERROR: ' + err.message);
  if (err.stack) log.push(err.stack);
  fs.mkdirSync(scratch, { recursive: true });
  fs.writeFileSync(path.join(scratch, 'launch.log'), log.join('\n') + '\n', { encoding: 'utf8' });
  console.error(err);
  process.exit(1);
}