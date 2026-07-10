/**
 * Theme / Imagine-style asset loading, hit VFX hooks, safe draw helpers.
 * Pure relative paths; missing or incomplete media no-ops without crashing.
 */
(function (root) {
  'use strict';

  var themesIndex = {
    defaultTheme: 'void-pulse',
    themes: {
      'void-pulse': {
        id: 'void-pulse',
        name: 'Void Pulse',
        tagline: 'Cyan-magenta cyber rail',
        tableTitle: 'VOID PULSE',
        hudAccent: '#00f0ff',
        basePath: 'assets/themes/void-pulse/',
        playfield: {
          still: 'assets/themes/void-pulse/playfield/base.png',
          ambientFrames: [
            'assets/themes/void-pulse/playfield/ambient-0.png',
            'assets/themes/void-pulse/playfield/ambient-1.png',
            'assets/themes/void-pulse/playfield/ambient-2.png',
            'assets/themes/void-pulse/playfield/ambient-3.png'
          ],
          ambientFps: 6,
          ambientVideo: null
        },
        bumpers: {
          idle: 'assets/themes/void-pulse/bumpers/idle.png',
          hit: 'assets/themes/void-pulse/bumpers/hit.png'
        },
        sparks: {
          sheet: 'assets/themes/void-pulse/vfx/spark-sheet.png',
          frames: 6,
          frameWidth: 96,
          frameHeight: 96,
          fps: 18,
          scale: 1.15
        }
      },
      'ember-rail': {
        id: 'ember-rail',
        name: 'Ember Rail',
        tagline: 'Molten copper night table',
        tableTitle: 'EMBER RAIL',
        hudAccent: '#ff8c28',
        basePath: 'assets/themes/ember-rail/',
        playfield: {
          still: 'assets/themes/ember-rail/playfield/base.png',
          ambientFrames: [
            'assets/themes/ember-rail/playfield/ambient-0.png',
            'assets/themes/ember-rail/playfield/ambient-1.png',
            'assets/themes/ember-rail/playfield/ambient-2.png',
            'assets/themes/ember-rail/playfield/ambient-3.png'
          ],
          ambientFps: 6,
          ambientVideo: null
        },
        bumpers: {
          idle: 'assets/themes/ember-rail/bumpers/idle.png',
          hit: 'assets/themes/ember-rail/bumpers/hit.png'
        },
        sparks: {
          sheet: 'assets/themes/ember-rail/vfx/spark-sheet.png',
          frames: 6,
          frameWidth: 96,
          frameHeight: 96,
          fps: 18,
          scale: 1.2
        }
      }
    }
  };

  var currentThemeId = themesIndex.defaultTheme;
  var images = {};
  var ambientVideo = null;
  var sparkBursts = [];
  var bumperHitVisual = {};
  var ambientTime = 0;
  var lastProcessedHitKey = null;
  var ready = false;

  function theme() {
    return themesIndex.themes[currentThemeId] || themesIndex.themes[themesIndex.defaultTheme];
  }

  function isImageReady(img) {
    return !!(img && img.complete && img.naturalWidth > 0);
  }

  function isVideoReady(video) {
    return !!(video && video.readyState >= 2 && video.videoWidth > 0);
  }

  function loadImage(src) {
    if (!src) return null;
    if (images[src]) return images[src];
    var img = null;
    if (typeof Image !== 'undefined') {
      img = new Image();
      img.src = src;
    } else {
      // Node / headless mock: mark as incomplete empty stub
      img = {
        src: src,
        complete: false,
        naturalWidth: 0,
        naturalHeight: 0
      };
    }
    images[src] = img;
    return img;
  }

  function preloadTheme(t) {
    loadImage(t.playfield.still);
    loadImage(t.bumpers.idle);
    loadImage(t.bumpers.hit);
    loadImage(t.sparks.sheet);
    if (t.playfield.ambientFrames) {
      t.playfield.ambientFrames.forEach(function (src) {
        loadImage(src);
      });
    }
    if (t.playfield.ambientVideo && typeof document !== 'undefined') {
      try {
        ambientVideo = document.createElement('video');
        ambientVideo.src = t.playfield.ambientVideo;
        ambientVideo.muted = true;
        ambientVideo.loop = true;
        ambientVideo.playsInline = true;
        ambientVideo.setAttribute('muted', '');
        ambientVideo.setAttribute('playsinline', '');
        var p = ambientVideo.play();
        if (p && typeof p.catch === 'function') p.catch(function () {});
      } catch (e) {
        ambientVideo = null;
      }
    } else {
      ambientVideo = null;
    }
  }

  function setTheme(id) {
    if (!themesIndex.themes[id]) return false;
    currentThemeId = id;
    sparkBursts = [];
    bumperHitVisual = {};
    lastProcessedHitKey = null;
    ambientTime = 0;
    preloadTheme(theme());
    ready = true;
    return true;
  }

  function listThemes() {
    return Object.keys(themesIndex.themes);
  }

  function getThemeId() {
    return currentThemeId;
  }

  function getThemeMeta() {
    var t = theme();
    return {
      id: t.id,
      name: t.name,
      tagline: t.tagline,
      tableTitle: t.tableTitle,
      hudAccent: t.hudAccent
    };
  }

  /**
   * Consume sim hit signals into VFX state. Does not clear lastHitType
   * (renderer/audio still own that). Safe to call every frame.
   */
  function processHitEvents(state) {
    if (!state) return null;
    var hitType = state.lastHitType;
    if (!hitType) return null;

    var hitKey =
      hitType +
      '|' +
      (state.lastHitId != null ? state.lastHitId : '') +
      '|' +
      (state.lastHitBumper != null ? state.lastHitBumper : '') +
      '|' +
      (state.lastScorePopup ? state.lastScorePopup.points : 0) +
      '|' +
      (state.score || 0);

    // Flipper hits may not award score points but still set lastHitType once per collision frame.
    if (hitKey === lastProcessedHitKey && hitType !== 'flipper') {
      return null;
    }
    // Allow flipper re-trigger only when type just became flipper this frame;
    // use a softer dedupe for flippers via position+type.
    if (hitType === 'flipper') {
      var flipKey = 'flipper|' + state.lastHitId + '|' + Math.round(state.ball.x) + '|' + Math.round(state.ball.y);
      if (flipKey === lastProcessedHitKey) return null;
      lastProcessedHitKey = flipKey;
    } else {
      lastProcessedHitKey = hitKey;
    }

    var x = state.ball.x;
    var y = state.ball.y;
    if (hitType !== 'flipper' && state.lastScorePopup) {
      x = state.lastScorePopup.x;
      y = state.lastScorePopup.y;
    }

    var result = { type: hitType, x: x, y: y, sparks: 0, bumperIdx: null };

    if (hitType === 'bumper' || hitType === 'flipper' || hitType === 'jackpot') {
      scheduleSpark(x, y, hitType === 'flipper' ? 1 : 1.15);
      result.sparks = sparkBursts.length;
    }

    if (hitType === 'bumper' && state.lastHitBumper != null) {
      var idx = state.lastHitBumper;
      bumperHitVisual[idx] = 0.28;
      result.bumperIdx = idx;
    }

    return result;
  }

  function scheduleSpark(x, y, scaleMul) {
    var t = theme();
    var sp = t.sparks;
    sparkBursts.push({
      x: x,
      y: y,
      frame: 0,
      age: 0,
      frameDuration: 1 / (sp.fps || 18),
      frames: sp.frames || 6,
      scale: (sp.scale || 1) * (scaleMul || 1),
      active: true
    });
    if (sparkBursts.length > 24) {
      sparkBursts.splice(0, sparkBursts.length - 24);
    }
    return sparkBursts[sparkBursts.length - 1];
  }

  function update(dt) {
    ambientTime += dt || 0;
    var i;
    for (i = sparkBursts.length - 1; i >= 0; i--) {
      var b = sparkBursts[i];
      b.age += dt;
      while (b.age >= b.frameDuration) {
        b.age -= b.frameDuration;
        b.frame += 1;
      }
      if (b.frame >= b.frames) {
        sparkBursts.splice(i, 1);
      }
    }
    Object.keys(bumperHitVisual).forEach(function (k) {
      bumperHitVisual[k] -= dt;
      if (bumperHitVisual[k] <= 0) delete bumperHitVisual[k];
    });
  }

  function getSparkBursts() {
    return sparkBursts;
  }

  function getBumperHitVisual(idx) {
    return bumperHitVisual[idx] || 0;
  }

  function isBumperHitActive(idx) {
    return (bumperHitVisual[idx] || 0) > 0;
  }

  /**
   * Safe canvas.drawImage wrapper.
   * Call forms (after ctx, img):
   *   (x, y)                         → drawImage(img, x, y)           args length 4
   *   (dx, dy, dw, dh)               → drawImage(img, dx, dy, dw, dh) args length 6
   *   (sx, sy, sw, sh, dx, dy, dw, dh) → full source+dest            args length 10
   */
  function safeDrawImage(ctx, img, a, b, c, d, e, f, g, h) {
    if (!isImageReady(img)) return false;
    try {
      var n = arguments.length;
      if (n === 4) {
        ctx.drawImage(img, a, b);
      } else if (n === 6) {
        // Dest-only form used by playfield still + ambient frames
        ctx.drawImage(img, a, b, c, d);
      } else if (n === 10) {
        ctx.drawImage(img, a, b, c, d, e, f, g, h);
      } else {
        return false;
      }
      return true;
    } catch (err) {
      return false;
    }
  }

  function drawPlayfieldLayer(ctx, tableW, tableH) {
    var t = theme();
    var still = images[t.playfield.still];
    var drew = safeDrawImage(ctx, still, 0, 0, tableW, tableH);
    if (!drew) return false;

    // Optional ambient video underlay (when present + ready)
    if (ambientVideo && isVideoReady(ambientVideo)) {
      try {
        ctx.save();
        ctx.globalAlpha = 0.28;
        ctx.drawImage(ambientVideo, 0, 0, tableW, tableH);
        ctx.restore();
      } catch (e) { /* ignore */ }
    } else if (t.playfield.ambientFrames && t.playfield.ambientFrames.length) {
      var fps = t.playfield.ambientFps || 6;
      var fi = Math.floor(ambientTime * fps) % t.playfield.ambientFrames.length;
      var frameImg = images[t.playfield.ambientFrames[fi]];
      if (isImageReady(frameImg)) {
        ctx.save();
        ctx.globalAlpha = 0.35;
        safeDrawImage(ctx, frameImg, 0, 0, tableW, tableH);
        ctx.restore();
      }
    }
    return true;
  }

  function drawBumperSprite(ctx, bumper, idx) {
    var t = theme();
    var hitActive = isBumperHitActive(idx) || (bumper.hitCooldown && bumper.hitCooldown > 0.12);
    var src = hitActive ? t.bumpers.hit : t.bumpers.idle;
    var img = images[src];
    if (!isImageReady(img)) return false;
    var size = bumper.radius * 2.15;
    return safeDrawImage(
      ctx,
      img,
      0,
      0,
      img.naturalWidth,
      img.naturalHeight,
      bumper.x - size * 0.5,
      bumper.y - size * 0.5,
      size,
      size
    );
  }

  function drawSparks(ctx) {
    var t = theme();
    var sheet = images[t.sparks.sheet];
    if (!isImageReady(sheet)) return 0;
    var fw = t.sparks.frameWidth || 96;
    var fh = t.sparks.frameHeight || 96;
    var drawn = 0;
    sparkBursts.forEach(function (b) {
      var sx = Math.min(b.frame, (t.sparks.frames || 6) - 1) * fw;
      var dw = fw * b.scale;
      var dh = fh * b.scale;
      if (
        safeDrawImage(
          ctx,
          sheet,
          sx,
          0,
          fw,
          fh,
          b.x - dw * 0.5,
          b.y - dh * 0.5,
          dw,
          dh
        )
      ) {
        drawn++;
      }
    });
    return drawn;
  }

  /** Test / tooling: force-load image stubs as "ready" with fake dimensions (Node). */
  function _injectReadyImage(src, w, h) {
    images[src] = {
      src: src,
      complete: true,
      naturalWidth: w || 96,
      naturalHeight: h || 96
    };
  }

  function _resetVfx() {
    sparkBursts = [];
    bumperHitVisual = {};
    lastProcessedHitKey = null;
    ambientTime = 0;
  }

  // Boot default theme
  setTheme(themesIndex.defaultTheme);

  var api = {
    setTheme: setTheme,
    listThemes: listThemes,
    getThemeId: getThemeId,
    getThemeMeta: getThemeMeta,
    processHitEvents: processHitEvents,
    scheduleSpark: scheduleSpark,
    update: update,
    getSparkBursts: getSparkBursts,
    getBumperHitVisual: getBumperHitVisual,
    isBumperHitActive: isBumperHitActive,
    drawPlayfieldLayer: drawPlayfieldLayer,
    drawBumperSprite: drawBumperSprite,
    drawSparks: drawSparks,
    isImageReady: isImageReady,
    safeDrawImage: safeDrawImage,
    preloadTheme: function () {
      preloadTheme(theme());
    },
    _injectReadyImage: _injectReadyImage,
    _resetVfx: _resetVfx,
    _themesIndex: themesIndex
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof root !== 'undefined') {
    root.PinballAssets = api;
  }
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
