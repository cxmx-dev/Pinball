/**
 * Device profile — auto-detect phone / tablet / desktop + touch vs fine pointer.
 * Sets documentElement.dataset.device and classes for CSS.
 * window.DeviceProfile API for games / demos.
 *
 * Hub rule: every browser-facing Repos demo (static/vite/p5) must use this
 * (or equivalent) so play works on whatever device opens the page.
 */
(function (global) {
  'use strict';

  var FINE_MQ = '(pointer: fine)';
  var COARSE_MQ = '(pointer: coarse)';
  var HOVER_MQ = '(hover: hover)';
  var NARROW_MQ = '(max-width: 680px)';
  var SHORT_MQ = '(max-height: 720px)';

  function mq(q) {
    try {
      return !!(global.matchMedia && global.matchMedia(q).matches);
    } catch (e) {
      return false;
    }
  }

  function detect() {
    var coarse = mq(COARSE_MQ);
    var fine = mq(FINE_MQ);
    var hover = mq(HOVER_MQ);
    var narrow = mq(NARROW_MQ);
    var short = mq(SHORT_MQ);
    var touchPoints = (navigator && navigator.maxTouchPoints) || 0;
    var ua = (navigator && navigator.userAgent) || '';
    var uaMobile = /Android|iPhone|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    var uaTablet = /iPad|Tablet|Android(?!.*Mobile)/i.test(ua) ||
      (navigator.platform === 'MacIntel' && touchPoints > 1);

    var isTouch = coarse || touchPoints > 0 || ('ontouchstart' in global);
    // Prefer media queries; UA is fallback only
    var isPhone = (uaMobile && !uaTablet) || (isTouch && narrow && !uaTablet);
    var isTablet = uaTablet || (isTouch && !isPhone && (narrow || !fine));
    var isDesktop = !isPhone && !isTablet;

    // If coarse pointer + narrow → phone even without UA
    if (coarse && narrow && !uaTablet) {
      isPhone = true;
      isTablet = false;
      isDesktop = false;
    }

    var form =
      isPhone ? 'phone' :
      isTablet ? 'tablet' :
      'desktop';

    return {
      form: form,
      isPhone: isPhone,
      isTablet: isTablet,
      isDesktop: isDesktop,
      isTouch: isTouch,
      finePointer: fine || (hover && !coarse),
      coarsePointer: coarse || isTouch,
      narrow: narrow,
      short: short,
      dpr: (global.devicePixelRatio || 1)
    };
  }

  function apply(profile) {
    var root = document.documentElement;
    if (!root) return profile;
    root.dataset.device = profile.form;
    root.dataset.input = profile.isTouch ? 'touch' : 'fine';
    root.classList.remove('device-phone', 'device-tablet', 'device-desktop', 'input-touch', 'input-fine');
    root.classList.add('device-' + profile.form);
    root.classList.add(profile.isTouch ? 'input-touch' : 'input-fine');
    if (document.body) {
      document.body.dataset.device = profile.form;
      document.body.dataset.input = root.dataset.input;
    }
    return profile;
  }

  var profile = apply(detect());
  var listeners = [];

  function refresh() {
    profile = apply(detect());
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](profile); } catch (e) { /* ignore */ }
    }
    return profile;
  }

  function onChange(fn) {
    if (typeof fn === 'function') listeners.push(fn);
    return function off() {
      listeners = listeners.filter(function (f) { return f !== fn; });
    };
  }

  /**
   * Fit a fixed-aspect canvas into the viewport (CSS size only; keep internal resolution).
   * opts: { aspect, maxW, maxH, pad, touchChrome } — touchChrome reserves bottom space for controls
   */
  function fitCanvas(canvas, opts) {
    if (!canvas) return { scale: 1, cssW: 0, cssH: 0 };
    opts = opts || {};
    var iw = canvas.width || opts.width || 1;
    var ih = canvas.height || opts.height || 1;
    var pad = opts.pad != null ? opts.pad : 8;
    var chrome = 0;
    if (opts.touchChrome && profile.isTouch) {
      chrome = typeof opts.touchChrome === 'number' ? opts.touchChrome : 120;
    }
    var maxW = (opts.maxW != null ? opts.maxW : global.innerWidth) - pad * 2;
    var maxH = (opts.maxH != null ? opts.maxH : global.innerHeight) - pad * 2 - chrome;
    if (maxW < 80) maxW = 80;
    if (maxH < 80) maxH = 80;
    var scale = Math.min(maxW / iw, maxH / ih, opts.maxScale != null ? opts.maxScale : 1);
    if (opts.allowUpscale) {
      scale = Math.min(maxW / iw, maxH / ih);
    }
    var cssW = Math.floor(iw * scale);
    var cssH = Math.floor(ih * scale);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    return { scale: scale, cssW: cssW, cssH: cssH };
  }

  function bindMedia() {
    if (!global.matchMedia) {
      global.addEventListener('resize', refresh);
      return;
    }
    ['(pointer: coarse)', '(pointer: fine)', '(max-width: 680px)', '(max-height: 720px)'].forEach(function (q) {
      try {
        var m = global.matchMedia(q);
        if (m.addEventListener) m.addEventListener('change', refresh);
        else if (m.addListener) m.addListener(refresh);
      } catch (e) { /* ignore */ }
    });
    global.addEventListener('orientationchange', function () {
      setTimeout(refresh, 50);
    });
    global.addEventListener('resize', function () {
      // cheap debounce
      clearTimeout(bindMedia._t);
      bindMedia._t = setTimeout(refresh, 80);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { apply(profile); });
  }

  bindMedia();

  var api = {
    get: function () { return profile; },
    refresh: refresh,
    onChange: onChange,
    fitCanvas: fitCanvas,
    detect: detect
  };

  global.DeviceProfile = api;
})(typeof window !== 'undefined' ? window : this);
