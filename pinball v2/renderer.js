/**
 * High-fidelity Canvas 2D renderer for pinball table.
 */
(function (root) {
  'use strict';

  var particles = [];
  var glowPulse = 0;
  var trail = [];
  var playfieldGlow = 0;
  /** Cached per render() call — phone tier drops shadows / tube overdraw. */
  var frameQuality = null;

  function defaultQuality(tier) {
    if (tier === 'phone') {
      return {
        tier: 'phone',
        shadows: false,
        ambient: false,
        glassSheen: false,
        tubeDetail: 'simple',
        wallGlowPass: false,
        maxParticles: 80,
        particleShadow: false,
        trailLen: 6
      };
    }
    return {
      tier: 'desktop',
      shadows: true,
      ambient: true,
      glassSheen: true,
      tubeDetail: 'full',
      wallGlowPass: true,
      maxParticles: 320,
      particleShadow: true,
      trailLen: 16
    };
  }

  function getQuality() {
    if (frameQuality) return frameQuality;
    var D = root.DeviceProfile;
    if (D && typeof D.quality === 'function') {
      try { return D.quality(); } catch (e) { /* ignore */ }
    }
    if (D && typeof D.get === 'function') {
      try {
        var p = D.get();
        if (p && (p.isPhone || (p.isTablet && p.coarsePointer))) {
          return defaultQuality('phone');
        }
      } catch (e2) { /* ignore */ }
    }
    return defaultQuality('desktop');
  }

  function q() {
    return frameQuality || getQuality();
  }

  /** No-op shadow on phone — shadowBlur is very expensive on Android GPU. */

  var TAP_GLOW_RGB = [
    [34, 255, 68],
    [255, 230, 0],
    [0, 255, 246],
    [255, 122, 24],
    [42, 107, 255],
    [255, 255, 255]
  ];

  function flipperGlowStyle(flipper) {
    if (!flipper || !(flipper.chargeLeft > 0)) return null;
    var phase = flipper.glowPhase || 0;
    var rgb = TAP_GLOW_RGB[Math.floor(phase) % TAP_GLOW_RGB.length];
    var pulse = 0.5 - 0.5 * Math.cos((phase % 1) * Math.PI * 2);
    var dim = 0.22 + 0.78 * pulse;
    var a = 0.28 + 0.72 * pulse;
    function rgba(alpha) {
      return 'rgba(' + Math.round(rgb[0] * dim) + ',' + Math.round(rgb[1] * dim) + ',' + Math.round(rgb[2] * dim) + ',' + alpha + ')';
    }
    return {
      outer: rgba(a),
      shadow: rgba(0.55 + 0.4 * pulse),
      pivot: rgba(0.95)
    };
  }

  function applyShadow(ctx, color, blur) {
    if (!q().shadows) {
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';
      return;
    }
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
  }

  function addParticles(x, y, color, count, speedMul) {
    speedMul = speedMul || 1;
    for (var i = 0; i < count; i++) {
      var angle = Math.random() * Math.PI * 2;
      var speed = (40 + Math.random() * 120) * speedMul;
      particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.35 + Math.random() * 0.45,
        maxLife: 0.9,
        color: color,
        size: 2 + Math.random() * 5
      });
    }
    var pMax = q().maxParticles || 320;
    if (particles.length > pMax) {
      particles.splice(0, particles.length - pMax);
    }
  }

  function updateParticles(dt) {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 180 * dt;
      p.vx *= 0.98;
    }
  }

  function drawRoundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function getAssets() {
    return root.PinballAssets || null;
  }

  function themeTitle() {
    var A = getAssets();
    if (A && A.getThemeMeta) {
      var m = A.getThemeMeta();
      if (m && m.tableTitle) return m.tableTitle;
    }
    return 'VOID PULSE';
  }

  function themeAccent() {
    var A = getAssets();
    if (A && A.getThemeMeta) {
      var m = A.getThemeMeta();
      if (m && m.hudAccent) return m.hudAccent;
    }
    return '#00f0ff';
  }

  function drawCabinet(ctx, w, h) {
    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#1a0a2e');
    grad.addColorStop(0.5, '#0d0618');
    grad.addColorStop(1, '#1a1028');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = 'rgba(255,180,60,0.04)';
    ctx.fillRect(0, 0, w, 56);
    ctx.font = 'bold 11px Orbitron, sans-serif';
    ctx.fillStyle = themeAccent();
    ctx.globalAlpha = 0.55;
    ctx.textAlign = 'center';
    ctx.fillText(themeTitle(), w * 0.5, 38);
    ctx.globalAlpha = 1;

    ctx.strokeStyle = 'rgba(255,200,80,0.15)';
    ctx.lineWidth = 3;
    ctx.strokeRect(8, 8, w - 16, h - 16);

    applyShadow(ctx, 'rgba(255,180,60,0.4)', 24);
    ctx.strokeStyle = 'rgba(255,200,100,0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(14, 14, w - 28, h - 28);
    ctx.shadowBlur = 0;

    ctx.fillStyle = 'rgba(60,80,120,0.25)';
    ctx.fillRect(0, h - 24, w, 24);
  }

  function drawPlayfield(ctx, state) {
    var tw = state.tableW;
    var th = state.tableH;
    var ox = 20;
    var oy = 80;

    ctx.save();
    ctx.translate(ox, oy);

    var pfGrad = ctx.createLinearGradient(0, 0, tw, th);
    pfGrad.addColorStop(0, '#1e3a5f');
    pfGrad.addColorStop(0.3, '#162d4a');
    pfGrad.addColorStop(0.7, '#0f2238');
    pfGrad.addColorStop(1, '#0a1828');
    drawRoundedRect(ctx, 0, 0, tw, th, 12);
    ctx.fillStyle = pfGrad;
    ctx.fill();

    // Phase 1/4: Imagine playfield still + optional ambient under actors
    var Assets = getAssets();
    if (Assets && Assets.drawPlayfieldLayer) {
      ctx.save();
      drawRoundedRect(ctx, 0, 0, tw, th, 12);
      ctx.clip();
      Assets.drawPlayfieldLayer(ctx, tw, th);
      ctx.restore();
    }

    var glow = 0.08 + Math.sin(playfieldGlow) * 0.04;
    ctx.strokeStyle = 'rgba(100,180,255,' + (0.25 + glow) + ')';
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, 0, 0, tw, th, 12);
    ctx.stroke();

    drawLaunchLaneChannel(ctx, state);
    drawLaunchLaneDashes(ctx, state);
    drawGlassSheen(ctx, tw, th);
    drawApron(ctx, state);
    drawWalls(ctx, state);
    drawLaunchLaneRail(ctx, state);
    drawRollovers(ctx, state);
    drawSideRoutes(ctx, state, glowPulse);
    drawDropTargets(ctx, state);
    drawSlingshots(ctx, state);
    drawTargets(ctx, state);
    drawPosts(ctx, state, glowPulse);
    drawBumpers(ctx, state, glowPulse);
    drawKickers(ctx, state, glowPulse);
    drawSpinner(ctx, state, glowPulse);
    // Phase 3: multi-frame spark VFX in table space
    if (Assets && Assets.drawSparks) {
      Assets.drawSparks(ctx);
    }
    drawFlippers(ctx, state);
    if (!state.ball.inPlay || !state.exitedLaunchLane) {
      drawPlunger(ctx, state);
    }

    ctx.restore();
    return { ox: ox, oy: oy };
  }

  function drawLaunchLaneChannel(ctx, state) {
    var tw = state.tableW;
    var th = state.tableH;
    var laneLeft = root.PinballSim.LAUNCH_LANE_LEFT;
    var laneGrad = ctx.createLinearGradient(laneLeft, 0, tw, 0);
    laneGrad.addColorStop(0, 'rgba(42,18,8,0.92)');
    laneGrad.addColorStop(1, 'rgba(88,36,12,0.96)');
    ctx.fillStyle = laneGrad;
    ctx.fillRect(laneLeft, 148, tw - laneLeft - 4, th - 218);
    ctx.strokeStyle = 'rgba(255,160,64,0.28)';
    ctx.lineWidth = 1;
    ctx.strokeRect(laneLeft + 1, 148, tw - laneLeft - 6, th - 220);
  }

  /**
   * Centered vertical dash lights in the shooter lane.
   * intensity 0 = dim, 1 = full yellow; used for pass-on and reverse pulse-fade.
   */
  function drawLaunchLaneDashes(ctx, state) {
    var dashes = state.launchLaneDashes;
    if (!dashes || !dashes.length) return;
    var i;
    for (i = 0; i < dashes.length; i++) {
      var d = dashes[i];
      var intensity = d.intensity != null ? d.intensity : (d.lit ? 1 : 0);
      if (intensity < 0) intensity = 0;
      if (intensity > 1) intensity = 1;
      var hot = d.flash > 0;
      var w = d.w || 12;
      var h = d.h || 22;
      var x0 = d.x - w * 0.5;
      var y0 = d.y - h * 0.5;
      ctx.save();
      // Dim base always
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(70, 32, 10, 0.62)';
      drawRoundedRect(ctx, x0, y0, w, h, 5);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,170,70,0.28)';
      ctx.lineWidth = 1;
      drawRoundedRect(ctx, x0, y0, w, h, 5);
      ctx.stroke();
      // Lit layer on top
      if (intensity > 0.02) {
        var a = intensity;
        ctx.globalAlpha = a;
        applyShadow(
          ctx,
          hot
            ? 'rgba(255,240,140,' + (0.5 + 0.5 * a) + ')'
            : 'rgba(255,200,50,' + (0.25 + 0.55 * a) + ')',
          (hot ? 18 : 12) * (0.4 + 0.6 * a)
        );
        var g = ctx.createLinearGradient(d.x, y0, d.x, y0 + h);
        g.addColorStop(0, hot ? '#fff6a0' : '#ffe066');
        g.addColorStop(0.45, '#ffcc22');
        g.addColorStop(1, '#e09010');
        ctx.fillStyle = g;
        drawRoundedRect(ctx, x0, y0, w, h, 5);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,220,' + (0.4 + 0.5 * a) + ')';
        ctx.lineWidth = 1;
        drawRoundedRect(ctx, x0, y0, w, h, 5);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawGlassSheen(ctx, tw, th) {
    if (!q().glassSheen) return;
    var sheen = ctx.createLinearGradient(0, 60, tw * 0.65, th * 0.55);
    sheen.addColorStop(0, 'rgba(255,255,255,0.07)');
    sheen.addColorStop(0.35, 'rgba(200,230,255,0.03)');
    sheen.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 60, tw, th - 120);

    var glare = ctx.createRadialGradient(tw * 0.22, th * 0.18, 8, tw * 0.22, th * 0.18, tw * 0.42);
    glare.addColorStop(0, 'rgba(255,255,255,0.09)');
    glare.addColorStop(0.55, 'rgba(255,255,255,0.02)');
    glare.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glare;
    ctx.fillRect(0, 60, tw, th - 120);
  }

  function strokeTubeSegment(ctx, x1, y1, x2, y2, opts) {
    opts = opts || {};
    var core = opts.core || "rgba(255,180,80,0.9)";
    var glow = opts.glow || "rgba(255,150,40,0.4)";
    var hi = opts.hi || "rgba(255,255,255,0.55)";
    var shadow = opts.shadow || "rgba(0,0,0,0.45)";
    var w = opts.width || 6;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    // Phone: 2 strokes (soft under + core) — full tube is 5 strokes + shadowBlur per segment.
    if (q().tubeDetail === 'simple') {
      ctx.shadowBlur = 0;
      ctx.strokeStyle = glow;
      ctx.lineWidth = w + 1.5;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = core;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.restore();
      return;
    }
    ctx.strokeStyle = shadow;
    ctx.lineWidth = w + 4;
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(x1 + 1.2, y1 + 1.5);
    ctx.lineTo(x2 + 1.2, y2 + 1.5);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = glow;
    ctx.lineWidth = w + 3;
    ctx.shadowColor = glow;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.shadowBlur = 4;
    ctx.strokeStyle = core;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = hi;
    ctx.lineWidth = Math.max(1.2, w * 0.28);
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.moveTo(x1 - 0.8, y1 - 0.9);
    ctx.lineTo(x2 - 0.8, y2 - 0.9);
    ctx.stroke();
    if (opts.dashed !== false) {
      ctx.setLineDash([5, 6]);
      ctx.strokeStyle = opts.groove || "rgba(255,255,255,0.22)";
      ctx.lineWidth = Math.max(1, w * 0.22);
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  function drawWalls(ctx, state) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // Glow pass for rounded top arch / habitrail segments (desktop only — shadowBlur overdraw)
    if (q().wallGlowPass) {
      state.walls.forEach(function (wall) {
        var kind = wall.kind || 'rail';
        if (kind === 'lane' || kind === 'chute') return;
        if ((kind === 'habitrail' || kind === 'guide') && wall.x1 > 270 && wall.x2 > 270) return;
        if ((kind === 'habitrail' || kind === 'guide') && wall.x1 < 160 && wall.x2 < 160) return;
        if (kind === 'rail' && wall.arc) {
          var gmx = (wall.x1 + wall.x2) * 0.5;
          var gmy = (wall.y1 + wall.y2) * 0.5;
          if (gmy < 118 && gmx > 70 && gmx < 420) return;
        }
        if (wall.arc || kind === 'rail' || kind === 'habitrail') {
          ctx.strokeStyle = kind === 'habitrail' ? 'rgba(255, 170, 60, 0.20)' : 'rgba(100, 200, 255, 0.22)';
          ctx.lineWidth = 10;
          ctx.shadowColor = kind === 'habitrail' ? 'rgba(255, 160, 40, 0.35)' : 'rgba(0, 220, 255, 0.35)';
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.moveTo(wall.x1, wall.y1);
          ctx.lineTo(wall.x2, wall.y2);
          ctx.stroke();
        }
      });
    }
    state.walls.forEach(function (wall) {
      var kind = wall.kind || 'rail';
      if (kind === 'lane' || kind === 'chute') return;
      if ((kind === 'habitrail' || kind === 'guide') && wall.x1 > 270 && wall.x2 > 270) return;
      if ((kind === 'habitrail' || kind === 'guide') && wall.x1 < 160 && wall.x2 < 160) return;
      if (kind === 'rail' && wall.arc) {
        var mx = (wall.x1 + wall.x2) * 0.5;
        var my = (wall.y1 + wall.y2) * 0.5;
        if (my < 118 && mx > 70 && mx < 420) return;
      }
      if (kind === 'habitrail') {
        strokeTubeSegment(ctx, wall.x1, wall.y1, wall.x2, wall.y2, {
          core: 'rgba(255, 190, 90, 0.92)',
          glow: 'rgba(255, 150, 40, 0.42)',
          hi: 'rgba(255, 245, 210, 0.65)',
          width: 6
        });
        return;
      }
      if (kind === 'guide') {
        strokeTubeSegment(ctx, wall.x1, wall.y1, wall.x2, wall.y2, {
          core: 'rgba(255, 220, 140, 0.55)',
          glow: 'rgba(255, 180, 60, 0.22)',
          hi: 'rgba(255,255,255,0.4)',
          width: 3.5,
          dashed: true
        });
        return;
      }
      if (kind === 'inlane') {
        ctx.strokeStyle = 'rgba(140,170,210,0.45)';
        ctx.lineWidth = 3;
        ctx.shadowBlur = 0;
      } else if (kind === 'deck') {
        ctx.strokeStyle = 'rgba(160,180,210,0.28)';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 0;
      } else {
        ctx.strokeStyle = wall.arc ? 'rgba(160, 230, 255, 0.95)' : 'rgba(180,200,230,0.85)';
        ctx.lineWidth = wall.arc ? 6 : 5;
        applyShadow(ctx, 'rgba(100,150,255,0.5)', 8);
      }
      ctx.beginPath();
      ctx.moveTo(wall.x1, wall.y1);
      ctx.lineTo(wall.x2, wall.y2);
      ctx.stroke();
    });
    ctx.restore();
  }

  function drawSlingshots(ctx, state) {
    state.slingshots.forEach(function (sling) {
      ctx.save();
      var rubberGrad = ctx.createLinearGradient(sling.x1, sling.y1, sling.x2, sling.y2);
      rubberGrad.addColorStop(0, 'rgba(220,60,80,0.85)');
      rubberGrad.addColorStop(1, 'rgba(160,30,50,0.9)');
      ctx.strokeStyle = rubberGrad;
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      applyShadow(ctx, 'rgba(255,80,100,0.5)', 10);
      ctx.beginPath();
      ctx.moveTo(sling.x1, sling.y1);
      ctx.lineTo(sling.x2, sling.y2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,120,140,0.35)';
      ctx.beginPath();
      ctx.arc(sling.x2, sling.y2, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  function midpoint(a, b) {
    return { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 };
  }

  function segsToPoints(segs) {
    if (!segs || !segs.length) return [];
    var pts = [{ x: segs[0].x1, y: segs[0].y1 }];
    var i;
    for (i = 0; i < segs.length; i++) pts.push({ x: segs[i].x2, y: segs[i].y2 });
    return pts;
  }

  function strokeSmooth(ctx, pts, close) {
    if (!pts || pts.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    var i;
    for (i = 1; i < pts.length - 1; i++) {
      var m = midpoint(pts[i], pts[i + 1]);
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, m.x, m.y);
    }
    var last = pts[pts.length - 1];
    ctx.lineTo(last.x, last.y);
    if (close) ctx.closePath();
  }

  /** Habitrail as SDF-3-guided hull (style only — physics unchanged). theme: 'copper' (default) or 'cyan'. */
  function drawPioneerRamp(ctx, ramp, pulse, theme) {
    if (!ramp || !ramp.segments) return;
    var cyan = theme === 'cyan';
    var outer = segsToPoints(ramp.segments);
    var inner = segsToPoints(ramp.guides).reverse();
    if (outer.length < 2 || inner.length < 2) return;
    var simple = q().tubeDetail === 'simple' || (q().tier === 'phone');

    var hull = outer.concat(inner);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Solid underlay so the playfield still cannot show the old scribble through
    strokeSmooth(ctx, hull, true);
    ctx.fillStyle = cyan ? '#061820' : '#2a1206';
    ctx.fill();
    strokeSmooth(ctx, hull, true);
    var g = cyan
      ? ctx.createLinearGradient(30, 140, 130, 560)
      : ctx.createLinearGradient(300, 140, 390, 560);
    if (cyan) {
      g.addColorStop(0, 'rgba(120, 230, 255, 1)');
      g.addColorStop(0.4, 'rgba(24, 140, 190, 1)');
      g.addColorStop(1, 'rgba(8, 40, 70, 1)');
    } else {
      g.addColorStop(0, 'rgba(255, 184, 72, 1)');
      g.addColorStop(0.4, 'rgba(214, 96, 24, 1)');
      g.addColorStop(1, 'rgba(110, 40, 10, 1)');
    }
    ctx.fillStyle = g;
    ctx.fill();


    if (!simple) {
      applyShadow(ctx, cyan ? 'rgba(40, 200, 255, 0.28)' : 'rgba(255, 140, 40, 0.28)', 10);
    }

    function paintRim(pts, width) {
      strokeSmooth(ctx, pts, false);
      ctx.strokeStyle = cyan ? 'rgba(80, 220, 255, 0.95)' : 'rgba(255, 168, 64, 0.95)';
      ctx.lineWidth = width;
      ctx.stroke();
      if (!simple) {
        ctx.shadowBlur = 0;
        ctx.strokeStyle = cyan ? 'rgba(200, 245, 255, 0.55)' : 'rgba(255, 230, 170, 0.55)';
        ctx.lineWidth = Math.max(2, width * 0.28);
        strokeSmooth(ctx, pts, false);
        ctx.stroke();
      }
    }
    paintRim(outer, simple ? 11 : 15);
    paintRim(inner.slice().reverse(), simple ? 10 : 14);

    ctx.restore();
  }
  function drawSideRoutes(ctx, state, pulse) {
    if (!state.sideRoutes) return;
    var cap = state.sideRoutes.leftCaptive;
    if (cap) {
      ctx.save();
      applyShadow(ctx, 'rgba(120, 200, 255, 0.55)', 10 + Math.sin(pulse * 2) * 3);
      var g = ctx.createRadialGradient(cap.x - 3, cap.y - 3, 2, cap.x, cap.y, cap.radius);
      g.addColorStop(0, '#c8f0ff');
      g.addColorStop(0.5, '#48a0e0');
      g.addColorStop(1, '#184868');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cap.x, cap.y, cap.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(200,240,255,0.7)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    var left = state.sideRoutes.leftRamp;
    if (left) {
      drawPioneerRamp(ctx, left, pulse, 'cyan');
    }

    var ramp = state.sideRoutes.rightRamp;
    if (ramp) {
      drawPioneerRamp(ctx, ramp, pulse);
      if (ramp.mergeOuter && ramp.mergeInner) {
        drawPioneerRamp(ctx, { segments: ramp.mergeOuter, guides: ramp.mergeInner }, pulse);
      }
    }
  }

  function drawDropTargets(ctx, state) {
    if (!state.dropTargets) return;
    state.dropTargets.forEach(function (drop) {
      ctx.save();
      var halfW = drop.w * 0.5;
      var halfH = drop.h * 0.5;
      if (drop.down) {
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = 'rgba(40, 50, 70, 0.8)';
        ctx.fillRect(drop.x - halfW, drop.y - halfH * 0.4, drop.w, halfH * 0.7);
      } else {
        var hot = drop.flash > 0;
        applyShadow(ctx, hot ? 'rgba(255, 220, 80, 0.9)' : 'rgba(255, 120, 60, 0.5)', hot ? 14 : 8);
        var tg = ctx.createLinearGradient(drop.x, drop.y - halfH, drop.x, drop.y + halfH);
        tg.addColorStop(0, '#ffcc66');
        tg.addColorStop(1, '#cc5520');
        ctx.fillStyle = tg;
        ctx.fillRect(drop.x - halfW, drop.y - halfH, drop.w, drop.h);
        ctx.strokeStyle = 'rgba(255,255,200,0.65)';
        ctx.lineWidth = 1;
        ctx.strokeRect(drop.x - halfW, drop.y - halfH, drop.w, drop.h);
      }
      ctx.restore();
    });
  }

  function drawTargets(ctx, state) {
    state.targets.forEach(function (target) {
      ctx.save();
      var lit = target.lit;
      var flash = target.flash > 0 ? 1 : 0;
      applyShadow(ctx, lit ? 'rgba(255,200,80,0.9)' : 'rgba(100,150,200,0.4)', lit ? 14 + flash * 10 : 6);
      var tg = ctx.createLinearGradient(target.x - target.w, target.y, target.x + target.w, target.y);
      if (lit) {
        tg.addColorStop(0, '#ffee88');
        tg.addColorStop(0.5, '#ffcc22');
        tg.addColorStop(1, '#cc8800');
      } else {
        tg.addColorStop(0, '#8899aa');
        tg.addColorStop(1, '#556677');
      }
      ctx.fillStyle = tg;
      ctx.fillRect(target.x - target.w * 0.5, target.y - target.h * 0.5, target.w, target.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      ctx.strokeRect(target.x - target.w * 0.5, target.y - target.h * 0.5, target.w, target.h);
      ctx.restore();
    });
  }

  function drawRollovers(ctx, state) {
    state.rollovers.forEach(function (lane) {
      if (!lane.lit) return;
      ctx.save();
      ctx.strokeStyle = 'rgba(255,220,80,0.85)';
      ctx.lineWidth = lane.width;
      ctx.lineCap = 'round';
      applyShadow(ctx, 'rgba(255,200,60,0.6)', 12);
      ctx.beginPath();
      ctx.moveTo(lane.x1, lane.y1);
      ctx.lineTo(lane.x2, lane.y2);
      ctx.stroke();
      ctx.restore();
    });
  }

  function drawPosts(ctx, state, pulse) {
    if (!state.posts) return;
    state.posts.forEach(function (post, idx) {
      var hot = post.flash > 0;
      var glow = 0.5 + 0.5 * Math.sin(pulse * 3 + idx);
      ctx.save();
      applyShadow(ctx, post.color || "rgba(160,220,255,0.7)", (hot ? 16 : 8) + glow * 6);
      var g = ctx.createRadialGradient(post.x - 2, post.y - 2, 1, post.x, post.y, post.radius);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.45, post.color || "#88ccee");
      g.addColorStop(1, "#223344");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(post.x, post.y, post.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = hot ? "rgba(255,255,255,0.95)" : "rgba(220,240,255,0.7)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(post.x, post.y, post.radius * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.fill();
      ctx.restore();
    });
  }

  function drawBumpers(ctx, state, pulse) {
    var Assets = getAssets();
    state.bumpers.forEach(function (bumper, idx) {
      var glow = 0.6 + 0.4 * Math.sin(pulse * 3 + idx * 1.2);
      var usedSprite = false;
      ctx.save();
      // Phase 2: hit-reactive bumper sprites when assets ready
      if (Assets && Assets.drawBumperSprite) {
        usedSprite = Assets.drawBumperSprite(ctx, bumper, idx);
      }
      if (!usedSprite) {
        applyShadow(ctx, bumper.color, 20 + glow * 15);
        var radGrad = ctx.createRadialGradient(
          bumper.x - bumper.radius * 0.3,
          bumper.y - bumper.radius * 0.3,
          bumper.radius * 0.1,
          bumper.x,
          bumper.y,
          bumper.radius
        );
        radGrad.addColorStop(0, '#ffffff');
        radGrad.addColorStop(0.35, bumper.color);
        radGrad.addColorStop(1, shadeColor(bumper.color, -40));
        ctx.beginPath();
        ctx.arc(bumper.x, bumper.y, bumper.radius, 0, Math.PI * 2);
        ctx.fillStyle = radGrad;
        ctx.fill();
      }
      // Always draw readable lit rings (sprites alone read as flat posts)
      var hitVis = Assets && Assets.getBumperHitVisual ? Assets.getBumperHitVisual(idx) : 0;
      var hot = hitVis > 0 || (bumper.hitCooldown && bumper.hitCooldown > 0.1);
      applyShadow(ctx, bumper.saver ? "rgba(80,255,180,0.85)" : bumper.color, hot ? 26 : 12 + glow * 8);
      ctx.strokeStyle = bumper.saver
        ? 'rgba(120,255,200,' + (0.75 + glow * 0.2) + ')'
        : 'rgba(255,168,64,' + (0.82 + glow * 0.15) + ')';
      ctx.lineWidth = bumper.saver ? 3.5 : 3.4;
      ctx.beginPath();
      ctx.arc(bumper.x, bumper.y, bumper.radius + (bumper.saver ? 3 : 2), 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = bumper.saver
        ? 'rgba(200,255,230,0.9)'
        : 'rgba(255,196,80,' + (0.55 + glow * 0.3) + ')';
      ctx.lineWidth = 1.6;
      if (bumper.saver) ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.arc(bumper.x, bumper.y, Math.max(4, bumper.radius * 0.62), 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(255,255,255,0.28)";
      ctx.beginPath();
      ctx.arc(bumper.x - bumper.radius * 0.28, bumper.y - bumper.radius * 0.28, bumper.radius * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = 'bold 11px Orbitron, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowBlur = 0;
      ctx.fillText(String(bumper.score), bumper.x, bumper.y);
      ctx.restore();
    });
  }

  function drawKickers(ctx, state, pulse) {
    state.kickers.forEach(function (kicker, idx) {
      var glow = 0.5 + 0.5 * Math.sin(pulse * 4 + idx);
      ctx.save();
      applyShadow(ctx, kicker.color, 12 + glow * 10);
      var g = ctx.createRadialGradient(kicker.x, kicker.y, 2, kicker.x, kicker.y, kicker.radius);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.5, kicker.color);
      g.addColorStop(1, shadeColor(kicker.color, -50));
      ctx.beginPath();
      ctx.arc(kicker.x, kicker.y, kicker.radius, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.restore();
    });
  }

  function drawSpinner(ctx, state, pulse) {
    var sp = state.spinner;
    if (!sp) return;
    var spinGlow = Math.min(1, Math.abs(sp.spinVel) * 1.6);
    ctx.save();
    ctx.translate(sp.x, sp.y);
    ctx.rotate(sp.angle);
    applyShadow(
      ctx,
      'rgba(180,220,255,' + (0.45 + spinGlow * 0.45) + ')',
      8 + spinGlow * 10 + Math.sin(pulse * 5) * 3
    );
    // Sensor eye — copper bezel, amber iris; still rotates with spinVel
    var R = sp.radius + 3;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.fillStyle = spinGlow > 0.05 ? '#c45a18' : '#8a3a12';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 190, 80, 0.95)';
    ctx.lineWidth = 3;
    ctx.stroke();
    var iris = ctx.createRadialGradient(-2, -2, 1, 0, 0, sp.radius * 0.72);
    iris.addColorStop(0, spinGlow > 0.08 ? '#ffe08a' : '#e8a040');
    iris.addColorStop(0.55, spinGlow > 0.08 ? '#ff9a20' : '#c86818');
    iris.addColorStop(1, '#4a1c08');
    ctx.beginPath();
    ctx.arc(0, 0, sp.radius * 0.7, 0, Math.PI * 2);
    ctx.fillStyle = iris;
    ctx.fill();
    ctx.fillStyle = spinGlow > 0.1 ? '#1a0a04' : '#2a1208';
    ctx.beginPath();
    ctx.arc(0, 0, sp.radius * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 220, 140, ' + (0.35 + spinGlow * 0.45) + ')';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-sp.radius * 0.55, 0);
    ctx.lineTo(sp.radius * 0.55, 0);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,230,0.55)';
    ctx.beginPath();
    ctx.arc(-sp.radius * 0.22, -sp.radius * 0.22, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function shadeColor(hex, percent) {
    var num = parseInt(hex.replace('#', ''), 16);
    var r = clampChannel((num >> 16) + percent);
    var g = clampChannel(((num >> 8) & 0xff) + percent);
    var b = clampChannel((num & 0xff) + percent);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function clampChannel(v) {
    return v < 0 ? 0 : v > 255 ? 255 : v;
  }

  function drawFlippers(ctx, state) {
    state.flippers.forEach(function (flipper) {
      var tip = root.PinballSim.flipperTip(flipper);
      ctx.save();

      ctx.fillStyle = '#2a3540';
      ctx.beginPath();
      ctx.arc(flipper.pivotX, flipper.pivotY, 14, 0, Math.PI * 2);
      ctx.fill();

      var grad = ctx.createLinearGradient(flipper.pivotX, flipper.pivotY, tip.x, tip.y);
      grad.addColorStop(0, '#667788');
      grad.addColorStop(0.35, '#eef4ff');
      grad.addColorStop(0.7, '#dde8f5');
      grad.addColorStop(1, '#8899aa');
      ctx.strokeStyle = grad;
      ctx.lineWidth = flipper.width + 2;
      ctx.lineCap = 'round';
      var glow = flipperGlowStyle(flipper);
      if (glow) {
        ctx.strokeStyle = glow.outer;
        ctx.lineWidth = flipper.width + 10;
        applyShadow(ctx, glow.shadow, 22);
        ctx.beginPath();
        ctx.moveTo(flipper.pivotX, flipper.pivotY);
        ctx.lineTo(tip.x, tip.y);
        ctx.stroke();
        ctx.strokeStyle = grad;
        ctx.lineWidth = flipper.width + 2;
        applyShadow(ctx, glow.shadow, 14);
      } else {
        applyShadow(ctx, flipper.active ? 'rgba(100,200,255,0.9)' : 'rgba(60,90,120,0.5)', flipper.active ? 20 : 8);
      }
      ctx.beginPath();
      ctx.moveTo(flipper.pivotX, flipper.pivotY);
      ctx.lineTo(tip.x, tip.y);
      ctx.stroke();

      ctx.lineWidth = flipper.width - 4;
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.moveTo(flipper.pivotX, flipper.pivotY);
      ctx.lineTo(tip.x, tip.y);
      ctx.stroke();

      ctx.fillStyle = glow ? glow.pivot : (flipper.active ? '#88bbee' : '#556677');
      ctx.beginPath();
      ctx.arc(flipper.pivotX, flipper.pivotY, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  function drawPlunger(ctx, state) {
    var Sim = root.PinballSim;
    var x = Sim.LAUNCH_LANE_X;
    var restY = Sim.PLUNGER_REST_Y;
    var laneLeft = Sim.LAUNCH_LANE_LEFT;
    var laneRight = Sim.LAUNCH_LANE_RIGHT;
    var tableH = state.tableH || Sim.TABLE_H;
    var tableW = state.tableW || Sim.TABLE_W;
    var power = clamp(state.launchPower || 0, 0, 1);
    var charging = !!state.launchCharging;
    var follow = state.plungerFollowFrames || 0;
    var followMax = 3;
    var headR = 8;
    var tipW = 19;
    var tipH = 11;
    var headRestY = restY + Sim.BALL_RADIUS + headR + 2;
    var headY = headRestY;
    if (follow > 0) {
      headY = headRestY - 20 * (follow / followMax);
    } else {
      headY = headRestY + power * 48;
    }
    var laneInnerRight = Math.min(laneRight, tableW - 2);
    var laneW = laneInnerRight - laneLeft;
    var shaftW = 6;
    var baseTop = tableH - 20;
    var baseH = 12;
    var shaftTop = headY - headR + tipH - 1;
    var shaftBot = baseTop;
    if (shaftBot < shaftTop + 8) shaftBot = shaftTop + 8;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    var basePad = 5;
    var baseGrad = ctx.createLinearGradient(laneLeft, baseTop, laneLeft, baseTop + baseH);
    baseGrad.addColorStop(0, '#5a2e14');
    baseGrad.addColorStop(0.45, '#3a1c0c');
    baseGrad.addColorStop(1, '#1a0c06');
    ctx.fillStyle = baseGrad;
    ctx.fillRect(laneLeft + basePad, baseTop, laneW - basePad * 2, baseH);
    ctx.strokeStyle = 'rgba(255, 180, 90, 0.4)';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(laneLeft + basePad, baseTop, laneW - basePad * 2, baseH);

    var shaftH = Math.max(6, shaftBot - shaftTop);
    var shaftGrad = ctx.createLinearGradient(x - shaftW * 0.5, shaftTop, x + shaftW * 0.5, shaftBot);
    shaftGrad.addColorStop(0, '#d8dee4');
    shaftGrad.addColorStop(0.35, '#9aa4ae');
    shaftGrad.addColorStop(0.7, '#5a646e');
    shaftGrad.addColorStop(1, '#2a3038');
    ctx.fillStyle = shaftGrad;
    ctx.fillRect(x - shaftW * 0.5, shaftTop, shaftW, shaftH);

    ctx.strokeStyle = 'rgba(36, 42, 48, 0.55)';
    ctx.lineWidth = 1;
    var tickX0 = x - shaftW * 0.5 + 0.5;
    var tickX1 = x + shaftW * 0.5 - 0.5;
    var knurlSpan = shaftH * 0.42;
    var knurlStart = shaftTop + shaftH * 0.22;
    if (knurlSpan > 8) {
      var ki;
      for (ki = 0; ki < 3; ki++) {
        var ky = knurlStart + knurlSpan * (ki / 2);
        ctx.beginPath();
        ctx.moveTo(tickX0, ky);
        ctx.lineTo(tickX1, ky);
        ctx.stroke();
      }
    }

    var springTop = shaftTop + 2;
    var springBot = baseTop - 2;
    var span = springBot - springTop;
    if (span > 6) {
      var coils = follow > 0 ? 9 : Math.max(3, Math.round(8 - power * 4));
      var amp = 7;
      ctx.beginPath();
      ctx.moveTo(x, springTop);
      var si;
      var sn = coils * 2;
      for (si = 1; si <= sn; si++) {
        var st = si / sn;
        ctx.lineTo(x + ((si % 2) ? amp : -amp), springTop + span * st);
      }
      ctx.lineTo(x, springBot);
      ctx.strokeStyle = charging ? 'rgba(220, 176, 96, 0.98)' : 'rgba(196, 170, 120, 0.95)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    var firing = follow > 0;
    if (charging || firing) {
      applyShadow(
        ctx,
        firing ? 'rgba(255, 200, 80, 0.95)' : 'rgba(200, 210, 220, 0.4)',
        firing ? 14 : 8
      );
    }

    var tipTop = headY - headR;
    var tipLeft = x - tipW * 0.5;
    ctx.fillStyle = '#111111';
    ctx.fillRect(tipLeft, tipTop, tipW, tipH * 0.5);
    ctx.fillStyle = '#8a8f96';
    ctx.fillRect(tipLeft, tipTop + tipH * 0.5, tipW, tipH * 0.5);
    ctx.fillStyle = 'rgba(230, 234, 238, 0.65)';
    ctx.fillRect(tipLeft + 1, tipTop, tipW - 2, 1.5);
    ctx.shadowBlur = 0;

    ctx.restore();
  }

  function drawPowerMeter(ctx, canvas, state) {
    if (state.phase !== 'ready' || state.ball.inPlay) return;

    var ox = 20;
    var oy = 80;
    var mx = ox + state.tableW + 6;
    var mw = 18;
    var mb = oy + root.PinballSim.PLUNGER_REST_Y + 14;
    var mt = oy + root.PinballSim.LAUNCH_LANE_TOP - 40;
    var mh = mb - mt;
    var fill = clamp(state.launchPower, 0, 1) * mh;

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    drawRoundedRect(ctx, mx, mt, mw, mh, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(180,200,255,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();

    if (fill > 1) {
      var grad = ctx.createLinearGradient(0, mb, 0, mt);
      grad.addColorStop(0, '#22dd55');
      grad.addColorStop(0.45, '#ffdd22');
      grad.addColorStop(1, '#ff3344');
      ctx.fillStyle = grad;
      applyShadow(ctx, state.launchCharging ? 'rgba(255,200,60,0.5)' : 'transparent', state.launchCharging ? 10 : 0);
      ctx.fillRect(mx + 3, mb - fill, mw - 6, fill);
    }

    if (state.launchCharging) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(mx + mw / 2, mb - fill, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function drawApron(ctx, state) {
    ctx.save();
    var apronGrad = ctx.createLinearGradient(0, state.tableH - 170, 0, state.tableH);
    apronGrad.addColorStop(0, 'rgba(15,30,50,0.0)');
    apronGrad.addColorStop(0.35, 'rgba(18,35,55,0.85)');
    apronGrad.addColorStop(1, 'rgba(10,18,30,0.95)');
    ctx.fillStyle = apronGrad;
    ctx.fillRect(36, state.tableH - 150, root.PinballSim.LAUNCH_LANE_LEFT - 36, 150);
    ctx.restore();
  }

  function drawLaunchLaneRail(ctx, state) {
    var x = root.PinballSim.LAUNCH_LANE_LEFT;
    ctx.save();
    var railGrad = ctx.createLinearGradient(x - 8, 0, x + 2, 0);
    railGrad.addColorStop(0, 'rgba(255,190,80,0.95)');
    railGrad.addColorStop(1, 'rgba(160,70,20,0.88)');
    ctx.strokeStyle = railGrad;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    applyShadow(ctx, 'rgba(255,140,40,0.45)', 10);
    ctx.beginPath();
    ctx.moveTo(x, 148);
    ctx.lineTo(x, state.tableH - 72);
    ctx.stroke();

    ctx.restore();
  }

  function drawDrainSlots(ctx, state, pulse) {
    var zones = root.PinballSim.getDrainBounds(state);
    var y = root.PinballSim.DRAIN_SLOT_TOP;
    var h = root.PinballSim.DRAIN_SLOT_H;
    var glow = 0.5 + 0.5 * Math.sin(pulse * 2.5);
    ctx.save();

    function slot(x, w, color) {
      applyShadow(ctx, color, 8 + glow * 6);
      ctx.fillStyle = 'rgba(0,0,0,0.9)';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.25 + glow * 0.15;
      ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
      ctx.globalAlpha = 1;
    }

    slot(zones.centerLeft, zones.centerRight - zones.centerLeft, 'rgba(255,100,120,0.8)');
    slot(zones.leftOutlaneLeft, zones.leftOutlaneRight - zones.leftOutlaneLeft, 'rgba(100,180,255,0.8)');
    slot(zones.rightOutlaneLeft + 2, zones.rightOutlaneRight - zones.rightOutlaneLeft - 4, 'rgba(255,200,80,0.8)');
    ctx.restore();
  }

  function drawBall(ctx, state, offset) {
    if (!state.ball.inPlay && state.phase !== 'ready') return;

    var ball = state.ball;
    var bx = offset.ox + ball.x;
    var by = offset.oy + ball.y;
    var speed = Math.sqrt(state.ball.vx * state.ball.vx + state.ball.vy * state.ball.vy);

    trail.push({ x: bx, y: by, life: 0.15 });
    var tLen = q().trailLen || 16;
    if (trail.length > tLen) trail.shift();

    ctx.save();
    for (var i = 0; i < trail.length; i++) {
      var t = trail[i];
      t.life -= 0.016;
      var alpha = Math.max(0, t.life / 0.15) * 0.35;
      ctx.beginPath();
      ctx.arc(t.x, t.y, state.ball.radius * 0.7, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(220,230,255,' + alpha + ')';
      ctx.fill();
    }
    trail = trail.filter(function (t) { return t.life > 0; });

    applyShadow(ctx, 'rgba(200,220,255,0.9)', 14 + Math.min(speed * 0.02, 12));
    var ballGrad = ctx.createRadialGradient(bx - 4, by - 4, 1, bx, by, state.ball.radius);
    ballGrad.addColorStop(0, '#ffffff');
    ballGrad.addColorStop(0.45, '#c8d8f0');
    ballGrad.addColorStop(1, '#607090');
    ctx.beginPath();
    ctx.arc(bx, by, state.ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = ballGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  function drawScorePopup(ctx, state, offset) {
    if (!state.lastScorePopup || state.lastScorePopup.life <= 0) return;
    var p = state.lastScorePopup;
    var alpha = clamp(p.life / 1.2, 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = 'bold 16px Orbitron, sans-serif';
    ctx.fillStyle =
      p.type === 'jackpot' || p.type === 'skillshot' || p.type === 'skillshot-near' || p.type === 'lanedash'
        ? '#ffdd44'
        : p.type === 'ballsave'
          ? '#88ffee'
          : p.type === 'combo' || p.merged
            ? '#aaff88'
            : '#aaffcc';
    applyShadow(ctx, ctx.fillStyle, 12);
    ctx.textAlign = 'center';
    ctx.fillText('+' + formatScore(p.points), offset.ox + p.x, offset.oy + p.y - (1.2 - p.life) * 30);
    ctx.restore();
  }

  function drawHUD(ctx, canvas, state) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, canvas.width, 72);

    ctx.font = 'bold 28px Orbitron, monospace';
    ctx.fillStyle = themeAccent();
    applyShadow(ctx, themeAccent(), 12);
    ctx.textAlign = 'left';
    ctx.fillText(formatScore(state.score), 24, 46);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#80c8ff';
    ctx.fillText('BALL ' + Math.max(0, state.ballsRemaining), canvas.width - 24, 46);

    // Center of HUD band reserved for DOM #btn-tilt (no canvas text there).
    ctx.font = 'bold 12px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff88cc';
    applyShadow(ctx, '#ff88cc', 8);
    ctx.fillText(state.multiplier + 'X', canvas.width * 0.5, 18);

    ctx.font = '10px Orbitron, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(180,200,255,0.7)';
    ctx.shadowBlur = 0;
    var bonusLine = 'BONUS ' + formatScore(state.bonusBank);
    if (state.comboCount > 1) {
      bonusLine += '  ·  COMBO x' + state.comboCount;
      ctx.fillStyle = '#88ffaa';
    }
    ctx.fillText(bonusLine, 24, 64);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(160,180,220,0.45)';
    if (state.skillShotBanner && state.skillShotBannerLife > 0) {
      ctx.fillStyle = state.skillShotGrade === 'near' ? '#ffd088' : '#ffee66';
      applyShadow(ctx, ctx.fillStyle, 12);
      ctx.fillText(state.skillShotBanner, canvas.width - 24, 64);
    } else if (state.skillShotWindow) {
      ctx.fillStyle = '#ffcc44';
      applyShadow(ctx, '#ffcc44', 10);
      ctx.fillText('SKILL SHOT!', canvas.width - 24, 64);
    } else if (state.rushTimer > 0 && state.rushName) {
      var isEmber = /EMBER/i.test(state.rushName);
      ctx.fillStyle = isEmber ? '#ff8844' : '#44e0ff';
      applyShadow(ctx, isEmber ? '#ff6622' : '#22c8ff', 14);
      ctx.fillText(state.rushName + ' ' + Math.ceil(state.rushTimer) + 's · ' + (state.rushMult || 2) + 'X', canvas.width - 24, 64);
    } else if (state.ballSaveArmed && state.ball.inPlay && !state.ballSaveUsed) {
      ctx.fillStyle = '#88ffcc';
      applyShadow(ctx, '#88ffcc', 8);
      ctx.fillText('BALL SAVE READY', canvas.width - 24, 64);
    } else {
      ctx.fillText(themeTitle() + ' · T theme', canvas.width - 24, 64);
    }

    if (state.jackpotLit) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 12px Orbitron, sans-serif';
      ctx.fillStyle = '#ffdd22';
      applyShadow(ctx, '#ffdd22', 14);
      ctx.fillText('JACKPOT LIT', canvas.width * 0.5, 86);
    }

    if (state.tiltWarnings > 0 && state.phase !== 'game_over') {
      ctx.textAlign = 'center';
      ctx.font = 'bold 12px Orbitron, sans-serif';
      ctx.fillStyle = state.tiltWarnings > 1 ? '#ff6644' : '#ffaa44';
      applyShadow(ctx, ctx.fillStyle, 10);
      ctx.fillText(
        'TILT WARNING ' + state.tiltWarnings + '/' + root.PinballSim.MAX_TILT_WARNINGS,
        canvas.width * 0.5,
        state.jackpotLit ? 102 : 86
      );
    }

    if (state.lastScorePopup && state.lastScorePopup.life > 0) {
      var popup = state.lastScorePopup;
      if (popup.type === 'tilt' || popup.type === 'tiltout') {
        ctx.textAlign = 'center';
        ctx.font = 'bold 22px Orbitron, sans-serif';
        ctx.fillStyle = popup.type === 'tiltout' ? '#ff4466' : '#ffaa55';
        applyShadow(ctx, popup.type === 'tiltout' ? 'rgba(255,60,80,0.9)' : 'rgba(255,180,60,0.8)', 16);
        ctx.fillText(popup.type === 'tiltout' ? 'TILT — BALL LOST' : 'TILT!', canvas.width * 0.5, state.tableH * 0.42);
        ctx.font = 'bold 13px Orbitron, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.shadowBlur = 0;
        ctx.fillText('NumPad 7 = nudge table', canvas.width * 0.5, state.tableH * 0.42 + 24);
      }
    }

    if (state.phase === 'game_over') {
      ctx.fillStyle = 'rgba(4, 8, 18, 0.82)';
      ctx.fillRect(0, 72, canvas.width, canvas.height - 100);
      ctx.textAlign = 'center';
      ctx.font = 'bold 36px Orbitron, sans-serif';
      ctx.fillStyle = '#ff6688';
      applyShadow(ctx, 'rgba(255,80,120,0.9)', 24);
      ctx.fillText('GAME OVER', canvas.width / 2, canvas.height * 0.38);
      ctx.font = '18px Orbitron, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.shadowBlur = 0;
      ctx.fillText('Press here to Restart', canvas.width / 2, canvas.height * 0.38 + 44);
      ctx.font = '14px Orbitron, sans-serif';
      ctx.fillStyle = 'rgba(200,230,255,0.7)';
      ctx.fillText('(or NumPad 7)', canvas.width / 2, canvas.height * 0.38 + 66);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText('Final: ' + formatScore(state.score), canvas.width / 2, canvas.height * 0.38 + 92);
    }
    ctx.restore();
  }

  function formatScore(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function emitHitParticles(state, offset) {
    if (!state.lastHitType) return;
    var colors = {
      bumper: '#ff66aa',
      sling: '#ff4455',
      target: '#ffcc44',
      kicker: '#44ffaa',
      rollover: '#88ccff',
      spinner: '#ccddee',
      flipper: '#aaddff',
      skillshot: '#ffdd00',
      'skillshot-near': '#ffcc88',
      jackpot: '#ffee22',
      lanedash: '#ffe066',
      ballsave: '#66ffcc',
      combo: '#aaff88'
    };
    var color = colors[state.lastHitType] || '#ffffff';
    var x = offset.ox + (state.lastScorePopup ? state.lastScorePopup.x : state.ball.x);
    var y = offset.oy + (state.lastScorePopup ? state.lastScorePopup.y : state.ball.y);
    var low = q().tier === 'phone';
    var count = state.lastHitType === 'bumper' ? (low ? 8 : 18) : state.lastHitType === 'jackpot' ? (low ? 12 : 28) : (low ? 5 : 10);
    addParticles(x - offset.ox, y - offset.oy, color, count, state.lastHitType === 'bumper' ? 1.3 : 1);
    playfieldGlow += 0.4;
    state.lastHitType = null;
  }

  function render(canvas, state, dt) {
    var ctx = canvas.getContext('2d');
    var Assets = getAssets();
    frameQuality = getQuality();
    glowPulse += dt * 2;
    playfieldGlow += dt;
    updateParticles(dt);

    // Phase 2–3: schedule spark sheets + bumper hit visuals from sim hit events
    if (Assets) {
      if (Assets.processHitEvents) Assets.processHitEvents(state);
      if (Assets.update) Assets.update(dt);
    }

    if (state.lastHitBumper != null) {
      var bumper = state.bumpers[state.lastHitBumper];
      if (bumper) {
        addParticles(bumper.x, bumper.y, bumper.color, q().tier === 'phone' ? 6 : 14, 1.2);
      }
      // keep lastHitBumper until processHitEvents + particles consumed; clear after
      state.lastHitBumper = null;
    }

    drawCabinet(ctx, canvas.width, canvas.height);
    var offset = drawPlayfield(ctx, state);
    drawBall(ctx, state, offset);
    emitHitParticles(state, offset);
    drawScorePopup(ctx, state, offset);

    particles.forEach(function (p) {
      var alpha = p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = alpha;
      if (q().particleShadow) applyShadow(ctx, p.color, 8);
      else { ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; }
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(offset.ox + p.x, offset.oy + p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    drawPowerMeter(ctx, canvas, state);
    drawHUD(ctx, canvas, state);

    // Drain / ball-save screen flash
    if (state.drainFlash > 0 || state.ballSaveFlash > 0) {
      ctx.save();
      if (state.ballSaveFlash > 0) {
        var sa = Math.min(1, state.ballSaveFlash / 0.7) * 0.35;
        ctx.fillStyle = 'rgba(80, 255, 200, ' + sa + ')';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.font = 'bold 22px Orbitron, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(180,255,230,' + Math.min(1, state.ballSaveFlash / 0.5) + ')';
        applyShadow(ctx, '#66ffcc', 16);
        ctx.fillText('BALL SAVED!', canvas.width * 0.5, canvas.height * 0.38);
      } else if (state.drainFlash > 0) {
        var da = Math.min(1, state.drainFlash / 0.55) * 0.4;
        ctx.fillStyle = 'rgba(255, 40, 80, ' + da + ')';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.restore();
    }

    // End-of-ball bonus tally
    if (state.phase === 'eob_bonus') {
      ctx.save();
      ctx.fillStyle = 'rgba(4, 8, 20, 0.72)';
      ctx.fillRect(0, 72, canvas.width, canvas.height - 100);
      ctx.textAlign = 'center';
      ctx.font = 'bold 20px Orbitron, sans-serif';
      ctx.fillStyle = '#88e0ff';
      applyShadow(ctx, '#44a0ff', 12);
      ctx.fillText('END OF BALL', canvas.width * 0.5, canvas.height * 0.28);
      ctx.shadowBlur = 0;
      ctx.font = '13px Orbitron, sans-serif';
      var steps = state.eobBreakdown || [];
      var i;
      for (i = 0; i < steps.length; i++) {
        var active = i <= state.eobStep;
        ctx.fillStyle = active ? '#ffe088' : 'rgba(180,200,220,0.45)';
        ctx.fillText(
          steps[i].label + '  +' + formatScore(steps[i].points),
          canvas.width * 0.5,
          canvas.height * 0.34 + i * 22
        );
      }
      ctx.font = 'bold 18px Orbitron, sans-serif';
      ctx.fillStyle = '#aaffcc';
      ctx.fillText('TOTAL  ' + formatScore(state.eobDisplay || 0), canvas.width * 0.5, canvas.height * 0.34 + steps.length * 22 + 16);
      ctx.restore();
    }

    // Rush mode wash
    if (state.rushTimer > 0 && state.rushName) {
      ctx.save();
      var ember = /EMBER/i.test(state.rushName);
      ctx.fillStyle = ember ? 'rgba(255, 80, 20, 0.06)' : 'rgba(20, 180, 255, 0.06)';
      ctx.fillRect(0, 72, canvas.width, canvas.height - 100);
      ctx.restore();
    }

    // Theme cycle flash
    if (state.themeFlash > 0) {
      ctx.save();
      var ta = Math.min(1, state.themeFlash / 0.4) * 0.28;
      ctx.fillStyle = 'rgba(255, 255, 255, ' + ta + ')';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
    frameQuality = null;
  }

  var api = { render: render, addParticles: addParticles, themeTitle: themeTitle, getQuality: getQuality };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof root !== 'undefined') {
    root.PinballRender = api;
  }
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);