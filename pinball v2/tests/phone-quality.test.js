'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var sim = require('../simulation.js');

function createTrackingContext() {
  var stats = { fillRect: 0, arc: 0, fill: 0, stroke: 0, shadowBlurSet: 0 };
  function track(name) {
    return function () { stats[name]++; };
  }
  var grad = { addColorStop: function () {} };
  var ctx = {
    fillRect: track('fillRect'),
    arc: track('arc'),
    fill: track('fill'),
    stroke: track('stroke'),
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
    strokeRect: function () { stats.stroke++; },
    setLineDash: function () {},
    fillText: function () {},
    drawImage: function () { stats.drawImage = (stats.drawImage || 0) + 1; },
    clip: function () {},
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 0,
    lineCap: '',
    lineJoin: '',
    font: '',
    textAlign: '',
    textBaseline: '',
    shadowColor: '',
    globalAlpha: 1
  };
  var blur = 0;
  Object.defineProperty(ctx, 'shadowBlur', {
    get: function () { return blur; },
    set: function (v) {
      blur = v;
      if (v > 0) stats.shadowBlurSet++;
    },
    configurable: true,
    enumerable: true
  });
  return { stats: stats, ctx: ctx };
}

function loadRendererWithDevice(deviceProfile) {
  var window = { PinballSim: sim, PinballAssets: null, DeviceProfile: deviceProfile };
  var context = {
    window: window,
    Math: Math,
    console: console,
    Image: function () {
      this.src = '';
      this.complete = false;
      this.naturalWidth = 0;
      this.naturalHeight = 0;
    }
  };
  vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, '../assets.js'), 'utf8'),
    context,
    { filename: 'assets.js' }
  );
  window.PinballAssets = context.window.PinballAssets;
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, '../renderer.js'), 'utf8'),
    context,
    { filename: 'renderer.js' }
  );
  return window;
}

function renderOnce(deviceProfile) {
  var window = loadRendererWithDevice(deviceProfile);
  var tracking = createTrackingContext();
  var canvas = {
    width: 520,
    height: 980,
    getContext: function () { return tracking.ctx; }
  };
  var state = sim.createInitialState();
  state.ball.inPlay = true;
  window.PinballRender.render(canvas, state, 0.016);
  return {
    stats: tracking.stats,
    quality: window.PinballRender.getQuality ? window.PinballRender.getQuality() : null
  };
}

console.log('Pinball phone-quality render tests');
console.log('==================================');

(function testDesktopKeepsFullQuality() {
  var desktop = {
    get: function () {
      return { isPhone: false, isTablet: false, isDesktop: true, coarsePointer: false, quality: { tier: 'desktop', shadows: true, ambient: true, glassSheen: true, tubeDetail: 'full', wallGlowPass: true, maxParticles: 320, particleShadow: true, trailLen: 16 } };
    },
    quality: function () {
      return this.get().quality;
    }
  };
  var out = renderOnce(desktop);
  assert.strictEqual(out.quality.tier, 'desktop');
  assert(out.stats.stroke >= 40, 'desktop should stroke a lot (tubes+glow), got ' + out.stats.stroke);
  assert(out.stats.shadowBlurSet >= 10, 'desktop should set shadowBlur often, got ' + out.stats.shadowBlurSet);
  console.log('PASS: desktop full quality (strokes=' + out.stats.stroke + ' shadows=' + out.stats.shadowBlurSet + ')');
  return out;
})();

(function testPhoneSimplifiesDraw() {
  var phone = {
    get: function () {
      return { isPhone: true, isTablet: false, isDesktop: false, coarsePointer: true, quality: { tier: 'phone', shadows: false, ambient: false, glassSheen: false, tubeDetail: 'simple', wallGlowPass: false, maxParticles: 80, particleShadow: false, trailLen: 6 } };
    },
    quality: function () {
      return this.get().quality;
    }
  };
  var out = renderOnce(phone);
  assert.strictEqual(out.quality.tier, 'phone');
  assert(out.stats.stroke >= 8, 'phone still draws walls/rails');
  assert.strictEqual(out.stats.shadowBlurSet, 0, 'phone must not enable shadowBlur, got ' + out.stats.shadowBlurSet);
  console.log('PASS: phone simplified (strokes=' + out.stats.stroke + ' shadows=' + out.stats.shadowBlurSet + ')');
  return out;
})();

(function testPhoneFewerStrokesThanDesktop() {
  var desktopProf = {
    get: function () { return { isPhone: false, isTablet: false, isDesktop: true, coarsePointer: false }; },
    quality: function () {
      return { tier: 'desktop', shadows: true, ambient: true, glassSheen: true, tubeDetail: 'full', wallGlowPass: true, maxParticles: 320, particleShadow: true, trailLen: 16 };
    }
  };
  var phoneProf = {
    get: function () { return { isPhone: true, isTablet: false, isDesktop: false, coarsePointer: true }; },
    quality: function () {
      return { tier: 'phone', shadows: false, ambient: false, glassSheen: false, tubeDetail: 'simple', wallGlowPass: false, maxParticles: 80, particleShadow: false, trailLen: 6 };
    }
  };
  var d = renderOnce(desktopProf);
  var p = renderOnce(phoneProf);
  assert(p.stats.stroke < d.stats.stroke * 0.75, 'phone strokes should be clearly lower than desktop (' + p.stats.stroke + ' vs ' + d.stats.stroke + ')');
  console.log('PASS: phone stroke reduction ' + d.stats.stroke + ' -> ' + p.stats.stroke);
})();

(function testDeviceQualityApi() {
  var code = fs.readFileSync(path.join(__dirname, '../device.js'), 'utf8');
  var sandbox = {
    window: {
      matchMedia: function () { return { matches: false, addEventListener: function () {}, addListener: function () {} }; },
      addEventListener: function () {},
      innerWidth: 390,
      innerHeight: 844,
      devicePixelRatio: 2.5
    },
    navigator: {
      maxTouchPoints: 5,
      userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Mobile Safari/537.36',
      platform: 'Linux armv8l'
    },
    document: {
      documentElement: { dataset: {}, classList: { remove: function () {}, add: function () {} } },
      body: { dataset: {} },
      readyState: 'complete',
      addEventListener: function () {}
    }
  };
  sandbox.window.navigator = sandbox.navigator;
  sandbox.window.document = sandbox.document;
  sandbox.global = sandbox.window;
  vm.createContext(sandbox);
  // device.js uses typeof window
  sandbox.window.matchMedia = function (q) {
    if (q.indexOf('coarse') >= 0) return { matches: true, addEventListener: function () {}, addListener: function () {} };
    if (q.indexOf('max-width: 680') >= 0) return { matches: true, addEventListener: function () {}, addListener: function () {} };
    return { matches: false, addEventListener: function () {}, addListener: function () {} };
  };
  vm.runInContext(code, sandbox, { filename: 'device.js' });
  var DP = sandbox.window.DeviceProfile;
  assert(DP && DP.quality, 'DeviceProfile.quality exists');
  var q = DP.quality();
  assert.strictEqual(q.tier, 'phone');
  assert.strictEqual(q.allowUpscale, false);
  assert.strictEqual(q.maxScale, 1.25);
  assert.strictEqual(q.tubeDetail, 'simple');
  console.log('PASS: DeviceProfile.quality phone tier from Android UA');
})();

console.log('==================================');
console.log('All phone-quality tests passed.');
