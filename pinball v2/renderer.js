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

    ctx.save();
    drawRoundedRect(ctx, 0, 0, tw, th, 12);
    ctx.clip();

    drawLaunchLaneChannel(ctx, state);
    drawLaunchLaneDashes(ctx, state);
    drawGlassSheen(ctx, tw, th);
    drawApron(ctx, state);
    drawSideRoutes(ctx, state, glowPulse);
    drawWalls(ctx, state);
    drawLaunchLaneRail(ctx, state);
    drawRollovers(ctx, state);
    drawDropTargets(ctx, state);
    drawSlingshots(ctx, state);
    drawPulseTriangle(ctx, state);
    drawBoinger(ctx, state);
    drawTargets(ctx, state);
    drawPosts(ctx, state, glowPulse);
    drawSaucer(ctx, state, glowPulse);
    drawBumpers(ctx, state, glowPulse);
    drawKickers(ctx, state, glowPulse);
    drawSpinner(ctx, state, glowPulse);
    drawGateSpinner(ctx, state, glowPulse);
    // Phase 3: multi-frame spark VFX in table space
    if (Assets && Assets.drawSparks) {
      Assets.drawSparks(ctx);
    }
    drawFlippers(ctx, state);
    if (!state.ball.inPlay || !state.exitedLaunchLane) {
      drawPlunger(ctx, state);
    }

    ctx.restore();
    ctx.restore();
    return { ox: ox, oy: oy };
  }

  function drawLaunchLaneChannel(ctx, state) {
    var tw = state.tableW;
    var th = state.tableH;
    var laneLeft = root.PinballSim.LAUNCH_LANE_LEFT;
    var joinY = root.PinballSim.LAUNCH_WIRE_Y1;
    var laneGrad = ctx.createLinearGradient(laneLeft, 0, tw, 0);
    laneGrad.addColorStop(0, 'rgba(42,18,8,0.92)');
    laneGrad.addColorStop(1, 'rgba(88,36,12,0.96)');
    ctx.fillStyle = laneGrad;
    ctx.fillRect(laneLeft, joinY, tw - laneLeft - 4, th - 70 - joinY);
    ctx.strokeStyle = 'rgba(255,160,64,0.28)';
    ctx.lineWidth = 1;
    ctx.strokeRect(laneLeft + 1, joinY, tw - laneLeft - 6, th - 72 - joinY);
  }

  /**
   * Centered vertical dash lights in the shooter lane.
   * intensity 0 = dim, 1 = full yellow; used for pass-on and reverse pulse-fade.
   */
  function drawLaunchLaneDashes(ctx, state) {
    var dashes = state.launchLaneDashes;
    if (!dashes || !dashes.length) return;
    var joinY = root.PinballSim.LAUNCH_WIRE_Y1;
    var i;
    for (i = 0; i < dashes.length; i++) {
      var d = dashes[i];
      if (d.y < joinY) continue;
      var intensity = d.intensity != null ? d.intensity : (d.lit ? 1 : 0);
      if (intensity < 0) intensity = 0;
      if (intensity > 1) intensity = 1;
      var hot = d.flash > 0;
      var w = d.w || 12;
      var h = d.h || 22;
      var x0 = d.x - w * 0.5;
      var y0 = d.y - h * 0.5;
      ctx.save();
      // Idle dim floor so hall lights never read as empty holes (game-over / pre-plunge).
      var idlePulse = 0.20 + 0.10 * (0.5 + 0.5 * Math.sin(glowPulse * 2.6 + i * 0.7));
      if (intensity < idlePulse) intensity = idlePulse;
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(120, 52, 14, 0.82)';
      drawRoundedRect(ctx, x0, y0, w, h, 5);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,190,80,0.45)';
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

  function strokeTubePath(ctx, pts, opts) {
    if (!pts || pts.length < 2) return;
    opts = opts || {};
    var core = opts.core;
    var glow = opts.glow;
    var hi = opts.hi;
    var shadow = opts.shadow || 'rgba(0,0,0,0.35)';
    var w = opts.width || 6;
    var smooth = !!opts.smooth;
    function paint() {
      if (smooth) strokeSmooth(ctx, pts, false);
      else strokeExact(ctx, pts, false);
    }
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (q().tubeDetail === 'simple') {
      ctx.shadowBlur = 0;
      ctx.strokeStyle = glow;
      ctx.lineWidth = w + 1.5;
      ctx.globalAlpha = 0.5;
      paint();
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = core;
      ctx.lineWidth = w;
      paint();
      ctx.stroke();
      ctx.restore();
      return;
    }
    ctx.strokeStyle = shadow;
    ctx.lineWidth = w + 4;
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.55;
    paint();
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = glow;
    ctx.lineWidth = w + 3;
    ctx.shadowColor = glow;
    ctx.shadowBlur = 10;
    paint();
    ctx.stroke();
    ctx.shadowBlur = 4;
    ctx.strokeStyle = core;
    ctx.lineWidth = w;
    paint();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = hi;
    ctx.lineWidth = Math.max(1.2, w * 0.28);
    ctx.globalAlpha = 0.75;
    paint();
    ctx.stroke();
    ctx.restore();
  }

  function drawChromeCageBar(ctx, x1, y1, x2, y2) {
    var grad = ctx.createLinearGradient(x1, y1, x2, y2);
    grad.addColorStop(0, '#6d7580');
    grad.addColorStop(0.32, '#c5ccd6');
    grad.addColorStop(0.5, '#f3f6fa');
    grad.addColorStop(0.68, '#b4bcc6');
    grad.addColorStop(1, '#5c646e');
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(0,0,0,0.42)';
    ctx.lineWidth = 6.4;
    ctx.beginPath();
    ctx.moveTo(x1 + 1.0, y1 + 1.4);
    ctx.lineTo(x2 + 1.0, y2 + 1.4);
    ctx.stroke();
    ctx.strokeStyle = grad;
    ctx.lineWidth = 4.1;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.88)';
    ctx.lineWidth = 1.15;
    ctx.beginPath();
    ctx.moveTo(x1 - 0.55, y1 - 0.9);
    ctx.lineTo(x2 - 0.55, y2 - 0.9);
    ctx.stroke();
    ctx.restore();
    drawSteelSlingPost(ctx, x1, y1);
    drawSteelSlingPost(ctx, x2, y2);
  }

  function drawWalls(ctx, state) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // Glow pass for rounded top arch / habitrail segments (desktop only — shadowBlur overdraw)
    if (q().wallGlowPass) {
      state.walls.forEach(function (wall) {
        var kind = wall.kind || 'rail';
        if (kind === 'lane' || kind === 'chute' || kind === 'filler' || kind === 'cage' || kind === 'tri-solid') return;
        if (kind === 'rail' && !wall.arc && Math.min(wall.x1, wall.x2) >= 390) return;
        if (kind === 'rail' && wall.cyan && Math.min(wall.y1, wall.y2) >= 568) return;
        if (kind === 'rail' && wall.arc) {
          var gmx = (wall.x1 + wall.x2) * 0.5;
          var gmy = (wall.y1 + wall.y2) * 0.5;
          if (gmy < 120) return; // shoe3: kill leftover arch-end glow scraps at both corners
        }
        if (kind === 'habitrail') return; // smooth tube in drawSideRoutes — no brick glow seams
        if (wall.arc || kind === 'rail') {
          var glowCyan = !!(wall.cyan || kind !== 'habitrail' || (!wall.merge && wall.x1 < 220 && wall.x2 < 220));
          if (kind === 'habitrail' && !glowCyan) return;
          ctx.strokeStyle = (kind === 'habitrail' && !glowCyan) ? 'rgba(255, 170, 60, 0.20)' : 'rgba(100, 200, 255, 0.22)';
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
      if (kind === 'chute' || kind === 'filler' || kind === 'tri-solid') return;
      if (kind === 'lane' && !wall.wireform) return;
      if (wall.wireform) {
        // Leftover white launch-wire stroke sat on the copper inner wall. Physics stays.
        return;
      }
      if (kind === 'cage') {
        drawChromeCageBar(ctx, wall.x1, wall.y1, wall.x2, wall.y2);
        return;
      }
      if (kind === 'rail' && wall.arc) {
        var mx = (wall.x1 + wall.x2) * 0.5;
        var my = (wall.y1 + wall.y2) * 0.5;
        if (my < 120) return; // shoe3: no leftover arch-end rail stroke at the U corners
      }
      if (kind === 'rail' && wall.cyan && !wall.arc) {
        var rx1 = wall.x1, ry1 = wall.y1, rx2 = wall.x2, ry2 = wall.y2;
        var sausageTop = 568;
        if (ry1 >= sausageTop && ry2 >= sausageTop) return;
        if (ry1 < sausageTop && ry2 > sausageTop) ry2 = sausageTop;
        if (ry2 < sausageTop && ry1 > sausageTop) ry1 = sausageTop;
        strokeTubeSegment(ctx, rx1, ry1, rx2, ry2, {
          core: 'rgba(80, 230, 255, 0.95)',
          glow: 'rgba(40, 180, 255, 0.45)',
          hi: 'rgba(220, 250, 255, 0.7)',
          width: 6
        });
        return;
      }
      if (kind === 'habitrail' || kind === 'guide') {
        // Continuous tubes are drawn in drawSideRoutes (smooth strokeTubePath).
        // Per-segment stroke was the cyan brick-seam / leftover orange strip.
        return;
        var cyan = !!(wall.cyan || (!wall.merge && wall.x1 < 220 && wall.x2 < 220));
        if (!cyan) return;
        if (kind === 'habitrail') {
          strokeTubeSegment(ctx, wall.x1, wall.y1, wall.x2, wall.y2, cyan ? {
            core: 'rgba(80, 230, 255, 0.95)',
            glow: 'rgba(40, 180, 255, 0.45)',
            hi: 'rgba(220, 250, 255, 0.7)',
            width: 6
          } : {
            core: 'rgba(255, 190, 90, 0.92)',
            glow: 'rgba(255, 150, 40, 0.42)',
            hi: 'rgba(255, 245, 210, 0.65)',
            width: 6
          });
          return;
        }
        strokeTubeSegment(ctx, wall.x1, wall.y1, wall.x2, wall.y2, cyan ? {
          core: 'rgba(160, 240, 255, 0.6)',
          glow: 'rgba(40, 180, 255, 0.22)',
          hi: 'rgba(255,255,255,0.4)',
          width: 3.5,
          dashed: true
        } : {
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
      } else if (!wall.arc && Math.min(wall.x1, wall.x2) >= 390) {
        ctx.strokeStyle = 'rgba(200, 110, 40, 0.9)';
        ctx.lineWidth = 5;
        applyShadow(ctx, 'rgba(255,140,40,0.35)', 8);
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
    // Copper habitrail is drawn once via drawPioneerRamp + merge rims. A second
    // strokeTubePath of the full rightRamp was the brick-line / double-hull seam.
    ctx.restore();
  }


  function drawBoinger(ctx, b, theme) {
    if (b && (b.boingers || (b.boinger && b.ball))) {
      var pack = b.boingers && b.boingers.length ? b.boingers : (b.boinger ? [b.boinger] : []);
      var pi;
      for (pi = 0; pi < pack.length; pi++) drawBoinger(ctx, pack[pi], pack[pi].theme);
      return;
    }
    if (!b) return;
    theme = theme || b.theme || 'copper';
    var copper = theme === 'copper';
    var pop = b.pop != null ? b.pop : (b.up ? 1 : 0);
    if (pop < 0) pop = 0;
    if (pop > 1) pop = 1;
    var r = b.radius;
    ctx.save();
    if (pop < 0.12) {
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = copper ? 'rgba(180, 80, 20, 0.55)' : 'rgba(20, 120, 160, 0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(b.x, b.y + 1, r * 0.52, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = copper ? 'rgba(74, 28, 8, 0.32)' : 'rgba(10, 48, 64, 0.32)';
      ctx.fill();
      ctx.restore();
      return;
    }
    var hot = b.flash > 0;
    var capR = r * (0.42 + 0.58 * pop);
    var stemH = 8 * pop;
    var capY = b.y - stemH * 0.35;
    ctx.shadowColor = copper
      ? ('rgba(255, 140, 40, ' + (0.28 + 0.5 * pop) + ')')
      : ('rgba(40, 200, 255, ' + (0.28 + 0.5 * pop) + ')');
    ctx.shadowBlur = hot ? 22 : 10 + pop * 10;
    ctx.fillStyle = copper
      ? (pop > 0.5 ? 'rgba(120, 44, 8, 0.95)' : 'rgba(74, 28, 8, 0.7)')
      : (pop > 0.5 ? 'rgba(6, 70, 100, 0.95)' : 'rgba(10, 48, 64, 0.7)');
    ctx.fillRect(b.x - 3.1, capY, 6.2, stemH + 4);
    var g = ctx.createRadialGradient(b.x - capR * 0.3, capY - capR * 0.35, 2, b.x, capY, capR);
    if (copper) {
      g.addColorStop(0, hot ? '#ffe0a0' : '#ffb040');
      g.addColorStop(0.45, '#d65814');
      g.addColorStop(1, '#782c08');
    } else {
      g.addColorStop(0, hot ? '#c8f8ff' : '#5ae0ff');
      g.addColorStop(0.45, '#1296c8');
      g.addColorStop(1, '#064664');
    }
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(b.x, capY, capR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = copper ? 'rgba(255, 230, 170, 0.7)' : 'rgba(200, 245, 255, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  function drawSteelSlingPost(ctx, x, y) {
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(x, y, 4.2, 0, Math.PI * 2);
    ctx.fillStyle = '#8a93a0';
    ctx.fill();
    ctx.strokeStyle = 'rgba(230,235,245,0.85)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x - 1.1, y - 1.2, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fill();
    ctx.restore();
  }

  function roundedTriPath(ctx, verts, radius) {
    var r = radius || 8;
    var i;
    var n = verts.length;
    ctx.beginPath();
    for (i = 0; i < n; i++) {
      var prev = verts[(i + n - 1) % n];
      var cur = verts[i];
      var next = verts[(i + 1) % n];
      var vx0 = cur.x - prev.x;
      var vy0 = cur.y - prev.y;
      var vx1 = next.x - cur.x;
      var vy1 = next.y - cur.y;
      var l0 = Math.sqrt(vx0 * vx0 + vy0 * vy0) || 1;
      var l1 = Math.sqrt(vx1 * vx1 + vy1 * vy1) || 1;
      var rr = Math.min(r, l0 * 0.42, l1 * 0.42);
      var sx = cur.x - (vx0 / l0) * rr;
      var sy = cur.y - (vy0 / l0) * rr;
      var ex = cur.x + (vx1 / l1) * rr;
      var ey = cur.y + (vy1 / l1) * rr;
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
      ctx.quadraticCurveTo(cur.x, cur.y, ex, ey);
    }
    ctx.closePath();
  }

  function drawPulseTriangle(ctx, state) {
    var tri = state && state.pulseTriangle;
    if (!tri || !tri.verts || !tri.sides) return;
    var SimTri = root.PinballSim;
    if (SimTri && typeof SimTri.triangleIsUp === 'function' && !SimTri.triangleIsUp(tri)) return;
    var v = tri.verts;
    var r = tri.radius || 8;
    ctx.save();
    roundedTriPath(ctx, v, r);
    var body = ctx.createLinearGradient(v[0].x, v[0].y, v[2].x, v[2].y);
    body.addColorStop(0, '#243044');
    body.addColorStop(1, '#141c28');
    ctx.fillStyle = body;
    ctx.fill();
    ctx.strokeStyle = 'rgba(20,24,32,0.85)';
    ctx.lineWidth = 2;
    ctx.stroke();
    var i;
    for (i = 0; i < tri.sides.length; i++) {
      var s = tri.sides[i];
      var lit = s.lit != null ? s.lit : 0.5;
      if (s.flash > 0) lit = Math.min(1, lit + s.flash * 2.2);
      var col = s.color || { core: '#ccc', glow: 'rgba(255,255,255,0.4)', hi: '#fff' };
      ctx.save();
      ctx.shadowColor = col.glow;
      ctx.shadowBlur = 6 + lit * 14;
      ctx.strokeStyle = col.core;
      ctx.globalAlpha = 0.45 + lit * 0.55;
      ctx.lineWidth = 5.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = col.hi;
      ctx.globalAlpha = 0.25 + lit * 0.5;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }


  function drawSlingshots(ctx, state) {
    if (!state.slingshots || !state.slingshots.length) return;
    var bySide = {};
    state.slingshots.forEach(function (sling) {
      var key = (sling.side === 'right' ? 'right' : 'left') + ':' + (sling.face || 'climb');
      if (!bySide[key]) bySide[key] = [];
      bySide[key].push(sling);
    });
    Object.keys(bySide).forEach(function (side) {
      var segs = bySide[side];
      if (!segs.length) return;
      ctx.save();
      var rubberGrad = ctx.createLinearGradient(segs[0].x1, segs[0].y1, segs[segs.length - 1].x2, segs[segs.length - 1].y2);
      rubberGrad.addColorStop(0, 'rgba(190,36,58,0.92)');
      rubberGrad.addColorStop(0.5, 'rgba(230,80,110,0.88)');
      rubberGrad.addColorStop(1, 'rgba(150,24,44,0.94)');
      ctx.strokeStyle = rubberGrad;
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      applyShadow(ctx, 'rgba(255,70,90,0.28)', 6);
      ctx.beginPath();
      ctx.moveTo(segs[0].x1, segs[0].y1);
      var si;
      for (si = 0; si < segs.length; si++) ctx.lineTo(segs[si].x2, segs[si].y2);
      ctx.stroke();
      ctx.restore();
      drawSteelSlingPost(ctx, segs[0].x1, segs[0].y1);
      drawSteelSlingPost(ctx, segs[segs.length - 1].x2, segs[segs.length - 1].y2);
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

  /** Keep polyline points on one side of the top-center sausage join. */
  function clipPtsAtJoinX(pts, joinX, keepLeft) {
    if (!pts || pts.length < 2) return pts || [];
    var out = [];
    var i;
    var seen = false;
    for (i = 0; i < pts.length; i++) {
      var p = pts[i];
      var prev = i > 0 ? pts[i - 1] : null;
      var onSide = keepLeft ? p.x <= joinX + 0.51 : p.x >= joinX - 0.51;
      if (onSide) {
        seen = true;
        if (prev) {
          var prevOn = keepLeft ? prev.x <= joinX + 0.51 : prev.x >= joinX - 0.51;
          if (!prevOn) {
            var dx0 = p.x - prev.x;
            var t0 = Math.abs(dx0) < 1e-6 ? 0 : (joinX - prev.x) / dx0;
            out.push({ x: joinX, y: prev.y + t0 * (p.y - prev.y) });
          }
        }
        out.push(p);
      } else if (prev && seen) {
        var prevKeep = keepLeft ? prev.x <= joinX + 0.51 : prev.x >= joinX - 0.51;
        if (prevKeep) {
          var dx1 = p.x - prev.x;
          var t1 = Math.abs(dx1) < 1e-6 ? 0 : (joinX - prev.x) / dx1;
          out.push({ x: joinX, y: prev.y + t1 * (p.y - prev.y) });
        }
        break;
      }
    }
    return out;
  }

  function strokeExact(ctx, pts, close) {
    if (!pts || pts.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    var ei;
    for (ei = 1; ei < pts.length; ei++) ctx.lineTo(pts[ei].x, pts[ei].y);
    if (close) ctx.closePath();
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

  /** shoe1: fair the DRAW polyline (physics walls stay live segments). */
  function chaikinSmooth(pts, iterations) {
    if (!pts || pts.length < 3) return pts || [];
    var out = pts;
    var n = iterations == null ? 2 : iterations;
    var k, i, next;
    for (k = 0; k < n; k++) {
      next = [{ x: out[0].x, y: out[0].y }];
      for (i = 0; i < out.length - 1; i++) {
        var a = out[i], b = out[i + 1];
        next.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
        next.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
      }
      next.push({ x: out[out.length - 1].x, y: out[out.length - 1].y });
      out = next;
    }
    return out;
  }

  function drawPioneerRamp(ctx, ramp, pulse, theme) {
    if (!ramp || !ramp.segments) return;
    var cyan = theme === 'cyan';
    var outer = segsToPoints(ramp.segments);
    var inner = segsToPoints(ramp.guides).reverse();
    if (outer.length < 2 || inner.length < 2) return;
    var simple = q().tubeDetail === 'simple' || (q().tier === 'phone');
    var filler = ramp.id === 'fill-l' || ramp.id === 'fill-r';
    if (!filler) {
      // shoe2: Pioneer is lower fill-l / fill-r sausages only. Horseshoe is solid sausages in drawHorseshoeOrbit.
      return;
    }
    // Draw hull = physics outline. No inset (that made a skeleton off the rail).

    var hull = outer.concat(inner);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Copper + cyan habitrail: one smooth hull (no chord / brick ticks).
    // Fillers and phone/simple stay exact. Phone/simple: no ellipse/scale.
    var strokeHull = strokeExact;
    strokeHull(ctx, hull, true);
    ctx.fillStyle = cyan ? (filler ? '#0a3040' : '#061820') : (filler ? '#4a1c08' : '#2a1206');
    ctx.fill();
    strokeHull(ctx, hull, true);
    var minX = hull[0].x, maxX = hull[0].x, minY = hull[0].y, maxY = hull[0].y;
    var hi;
    for (hi = 1; hi < hull.length; hi++) {
      if (hull[hi].x < minX) minX = hull[hi].x;
      if (hull[hi].x > maxX) maxX = hull[hi].x;
      if (hull[hi].y < minY) minY = hull[hi].y;
      if (hull[hi].y > maxY) maxY = hull[hi].y;
    }
    var g = cyan
      ? ctx.createLinearGradient(minX, minY, maxX, maxY)
      : ctx.createLinearGradient(minX, minY, maxX, maxY);
    if (cyan) {
      g.addColorStop(0, filler ? 'rgba(90, 224, 255, 1)' : 'rgba(120, 230, 255, 1)');
      g.addColorStop(0.4, filler ? 'rgba(18, 150, 200, 1)' : 'rgba(24, 140, 190, 1)');
      g.addColorStop(1, filler ? 'rgba(6, 70, 100, 1)' : 'rgba(8, 40, 70, 1)');
    } else {
      g.addColorStop(0, filler ? 'rgba(255, 176, 64, 1)' : 'rgba(255, 184, 72, 1)');
      g.addColorStop(0.4, filler ? 'rgba(214, 88, 20, 1)' : 'rgba(214, 96, 24, 1)');
      g.addColorStop(1, filler ? 'rgba(120, 44, 8, 1)' : 'rgba(110, 40, 10, 1)');
    }
    ctx.fillStyle = g;
    ctx.fill();


    if (!simple) {
      applyShadow(ctx, cyan ? 'rgba(40, 200, 255, 0.28)' : 'rgba(255, 140, 40, 0.28)', 10);
    }

    function paintRim(pts, width) {
      strokeHull(ctx, pts, false);
      ctx.strokeStyle = cyan ? 'rgba(80, 220, 255, 0.95)' : 'rgba(255, 168, 64, 0.95)';
      ctx.lineWidth = width;
      ctx.stroke();
      if (!simple) {
        ctx.shadowBlur = 0;
        ctx.strokeStyle = cyan ? 'rgba(200, 245, 255, 0.55)' : 'rgba(255, 230, 170, 0.55)';
        ctx.lineWidth = Math.max(2, width * 0.28);
        strokeHull(ctx, pts, false);
        ctx.stroke();
      }
    }
    // Thin rims. Fillers keep paintRim; orbit tubes use one smooth strokeTubePath (no brick / melt).
    if (filler) {
      paintRim(outer, simple ? 5 : 6);
      paintRim(inner.slice().reverse(), simple ? 4 : 5);
    } else {
      var tube = {
        core: cyan ? 'rgba(80, 230, 255, 0.95)' : 'rgba(255, 190, 90, 0.92)',
        glow: cyan ? 'rgba(40, 180, 255, 0.45)' : 'rgba(255, 150, 40, 0.42)',
        hi: cyan ? 'rgba(220, 250, 255, 0.7)' : 'rgba(255, 245, 210, 0.65)',
        width: 6,
        smooth: !simple
      };
      var guide = {
        core: cyan ? 'rgba(160, 240, 255, 0.6)' : 'rgba(255, 220, 140, 0.55)',
        glow: cyan ? 'rgba(40, 180, 255, 0.22)' : 'rgba(255, 180, 60, 0.22)',
        hi: cyan ? 'rgba(255,255,255,0.4)' : 'rgba(255, 230, 170, 0.45)',
        width: 3.5,
        smooth: !simple
      };
      strokeTubePath(ctx, outer, tube);
      strokeTubePath(ctx, inner.slice().reverse(), guide);
    }

    ctx.restore();
  }

  function clipSegsBelowY(segs, y0) {
    var out = [];
    var i;
    for (i = 0; i < (segs || []).length; i++) {
      var seg = segs[i];
      var y1 = seg.y1, y2 = seg.y2;
      if (y1 >= y0 && y2 >= y0) {
        out.push(seg);
      } else if (y1 < y0 && y2 >= y0) {
        var t = (y0 - y1) / (y2 - y1);
        out.push({ x1: seg.x1 + (seg.x2 - seg.x1) * t, y1: y0, x2: seg.x2, y2: y2 });
      } else if (y2 < y0 && y1 >= y0) {
        var t2 = (y0 - y1) / (y2 - y1);
        out.push({ x1: seg.x1, y1: y1, x2: seg.x1 + (seg.x2 - seg.x1) * t2, y2: y0 });
      }
    }
    return out;
  }

  function horseshoeOuterPoints(left, right) {
    var pts = segsToPoints(left && left.segments);
    var copper = segsToPoints(right && right.mergeOuter);
    if (!pts.length || copper.length < 2) return pts;
    var i;
    for (i = copper.length - 2; i >= 0; i--) pts.push(copper[i]);
    return pts;
  }

  function horseshoeInnerPoints(left, right) {
    var pts = segsToPoints(left && left.guides);
    var copper = segsToPoints(right && right.mergeInner);
    if (!pts.length || copper.length < 2) return pts;
    var i;
    for (i = copper.length - 2; i >= 0; i--) pts.push(copper[i]);
    return pts;
  }

  /** shoe3: solid sausage fill + one neon rim on the physics outer. Never stroke the closed hull (that was the x=280 brick seam). */
  function fillSausageHull(ctx, outerPts, innerPts, theme, simple, rimW) {
    if (!outerPts || !innerPts || outerPts.length < 2 || innerPts.length < 2) return;
    var outer = chaikinSmooth(outerPts, 2);
    var inner = chaikinSmooth(innerPts, 2);
    if (outer.length < 2 || inner.length < 2) return;
    var hull = outer.concat(inner.slice().reverse());
    var cyan = theme === 'cyan';
    var minX = hull[0].x, maxX = hull[0].x, minY = hull[0].y, maxY = hull[0].y;
    var hi;
    for (hi = 1; hi < hull.length; hi++) {
      if (hull[hi].x < minX) minX = hull[hi].x;
      if (hull[hi].x > maxX) maxX = hull[hi].x;
      if (hull[hi].y < minY) minY = hull[hi].y;
      if (hull[hi].y > maxY) maxY = hull[hi].y;
    }

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    strokeExact(ctx, hull, true);
    ctx.fillStyle = cyan ? '#0a3040' : '#4a1c08';
    ctx.fill();
    var g = ctx.createLinearGradient(minX, minY, maxX, maxY);
    if (cyan) {
      g.addColorStop(0, 'rgba(90, 224, 255, 1)');
      g.addColorStop(0.4, 'rgba(18, 150, 200, 1)');
      g.addColorStop(1, 'rgba(6, 70, 100, 1)');
    } else {
      g.addColorStop(0, 'rgba(255, 176, 64, 1)');
      g.addColorStop(0.4, 'rgba(214, 88, 20, 1)');
      g.addColorStop(1, 'rgba(120, 44, 8, 1)');
    }
    strokeExact(ctx, hull, true);
    ctx.fillStyle = g;
    ctx.fill();
    var width = rimW == null ? 5.5 : rimW;
    strokeExact(ctx, outer, false);
    ctx.strokeStyle = cyan ? 'rgba(80, 220, 255, 0.95)' : 'rgba(255, 168, 64, 0.95)';
    ctx.lineWidth = width;
    ctx.stroke();
    strokeExact(ctx, inner, false);
    ctx.strokeStyle = cyan ? 'rgba(80, 220, 255, 0.95)' : 'rgba(255, 168, 64, 0.95)';
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.restore();
  }


  function drawHorseshoeOrbit(ctx, left, right, pulse) {
    if (!left) return;
    var simple = q().tubeDetail === 'simple' || (q().tier === 'phone');
    var tubeW = 5.5;
    var JOIN_X = 280;
    var fullOuter = horseshoeOuterPoints(left, right);
    var fullInner = horseshoeInnerPoints(left, right);
    if (!fullOuter || fullOuter.length < 2 || !fullInner || fullInner.length < 2) return;
    var outer = chaikinSmooth(fullOuter, 2);
    var inner = chaikinSmooth(fullInner, 2);
    var hull = outer.concat(inner.slice().reverse());

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    strokeExact(ctx, hull, true);
    ctx.clip();

    var cyanFill = ctx.createLinearGradient(0, 0, 0, 140);
    cyanFill.addColorStop(0, 'rgba(90, 224, 255, 1)');
    cyanFill.addColorStop(0.55, 'rgba(18, 150, 200, 1)');
    cyanFill.addColorStop(1, 'rgba(6, 70, 100, 1)');
    ctx.fillStyle = cyanFill;
    ctx.fillRect(0, 0, JOIN_X, 860);

    var copperFill = ctx.createLinearGradient(JOIN_X, 0, JOIN_X, 140);
    copperFill.addColorStop(0, 'rgba(255, 176, 64, 1)');
    copperFill.addColorStop(0.55, 'rgba(214, 88, 20, 1)');
    copperFill.addColorStop(1, 'rgba(120, 44, 8, 1)');
    ctx.fillStyle = copperFill;
    ctx.fillRect(JOIN_X, 0, 560, 860);

    var seam = ctx.createLinearGradient(JOIN_X - 6, 0, JOIN_X + 6, 0);
    seam.addColorStop(0, 'rgba(90, 224, 255, 1)');
    seam.addColorStop(1, 'rgba(255, 176, 64, 1)');
    ctx.fillStyle = seam;
    ctx.fillRect(JOIN_X - 6, 0, 12, 860);
    ctx.restore();

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    var rim = ctx.createLinearGradient(0, 0, 560, 0);
    rim.addColorStop(0, 'rgba(80, 220, 255, 0.95)');
    rim.addColorStop((JOIN_X - 8) / 560, 'rgba(80, 220, 255, 0.95)');
    rim.addColorStop((JOIN_X + 8) / 560, 'rgba(255, 168, 64, 0.95)');
    rim.addColorStop(1, 'rgba(255, 168, 64, 0.95)');
    ctx.strokeStyle = rim;
    ctx.lineWidth = tubeW;
    strokeExact(ctx, outer, false);
    ctx.stroke();
    strokeExact(ctx, inner, false);
    ctx.stroke();
    ctx.restore();

    // dump2: no clipSegsBelowY copper drop fill — that sealed the left merge
    // into a melted orange blob. Fail dump is a short exit sausage only.
    if (right && right.failDump && right.failDump.outer && right.failDump.inner) {
      var dumpO = segsToPoints(right.failDump.outer);
      var dumpI = segsToPoints(right.failDump.inner);
      if (dumpO.length >= 2 && dumpI.length >= 2) {
        fillSausageHull(ctx, dumpO, dumpI, 'copper', simple, tubeW);
      }
    }
  }

  function drawCopperMergeShoulder(ctx, ramp, pulse) {
    return;
  }

  function drawMergeJoinRims(ctx, outerSegs, innerSegs) {
    return;
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

    if (state.sideRoutes.leftFiller) {
      drawPioneerRamp(ctx, state.sideRoutes.leftFiller, pulse);
    }
    if (state.sideRoutes.rightFiller) {
      drawPioneerRamp(ctx, state.sideRoutes.rightFiller, pulse, 'cyan');
    }

    var left = state.sideRoutes.leftRamp;
    var ramp = state.sideRoutes.rightRamp;
    if (left) {
      drawHorseshoeOrbit(ctx, left, ramp, pulse);
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
      // Yellow/orange vertical pills on the upper-middle ramp hulls — nonsense, not hall dashes.
      if (lane.id === "lane-l" || lane.id === "lane-r") return;
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
      if (post.kind === 'pin') return;
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

  function drawRubberBumper(ctx, bumper, pulse, idx) {
    var glow = 0.55 + 0.45 * Math.sin(pulse * 4 + idx * 1.1);
    var hot = bumper.hitCooldown && bumper.hitCooldown > 0.08;
    var r = bumper.radius;
    ctx.save();
    var cap = ctx.createRadialGradient(
      bumper.x - r * 0.28,
      bumper.y - r * 0.32,
      r * 0.08,
      bumper.x,
      bumper.y,
      r * 0.72
    );
    cap.addColorStop(0, '#f4f1ea');
    cap.addColorStop(0.35, '#c8c4bb');
    cap.addColorStop(0.75, '#8a8680');
    cap.addColorStop(1, '#5c5854');
    ctx.beginPath();
    ctx.arc(bumper.x, bumper.y, r * 0.72, 0, Math.PI * 2);
    ctx.fillStyle = cap;
    ctx.fill();
    ctx.shadowColor = hot ? 'rgba(255,70,110,0.95)' : 'rgba(180,30,55,0.55)';
    ctx.shadowBlur = hot ? 22 : 8 + glow * 8;
    ctx.strokeStyle = hot ? '#ff6a8a' : '#b31f3a';
    ctx.lineWidth = Math.max(3.8, r * 0.28);
    ctx.beginPath();
    ctx.arc(bumper.x, bumper.y, r * 0.86, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = hot ? 'rgba(255,180,200,0.85)' : 'rgba(80,10,20,0.7)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(bumper.x, bumper.y, r * 0.98, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(bumper.x, bumper.y, r * 0.74, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = hot ? 'rgba(255,240,244,0.95)' : 'rgba(40,12,16,0.82)';
    ctx.font = 'bold 9px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(bumper.score), bumper.x, bumper.y);
    ctx.restore();
  }

  function drawBumpers(ctx, state, pulse) {
    var Assets = getAssets();
    state.bumpers.forEach(function (bumper, idx) {
      if (bumper.rubber) {
        drawRubberBumper(ctx, bumper, pulse, idx);
        return;
      }
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

  function drawSaucerHole(ctx, state, s, pulse) {
    if (!s) return;
    var simple = q().tubeDetail === 'simple' || q().tier === 'phone';
    ctx.save();
    var glow = s.lit || s.captured ? 0.85 : 0.45;
    if (!simple) applyShadow(ctx, s.lit ? 'rgba(80,220,255,0.7)' : 'rgba(40,80,120,0.45)', 10 + Math.sin(pulse * 3) * 3);
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.radius + 4, 0, Math.PI * 2);
    ctx.fillStyle = s.lit ? 'rgba(20, 90, 130, 0.95)' : 'rgba(8, 20, 36, 0.95)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
    ctx.fillStyle = s.captured ? '#041018' : '#070e18';
    ctx.fill();
    ctx.strokeStyle = s.lit
      ? 'rgba(80, 230, 255, ' + glow + ')'
      : 'rgba(120, 180, 220, 0.7)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(s.x, s.y, Math.max(3, s.radius * 0.38), 0, Math.PI * 2);
    ctx.fillStyle = s.captured ? 'rgba(80,200,255,0.55)' : 'rgba(10,16,24,0.9)';
    ctx.fill();
    ctx.font = 'bold 8px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = s.lit ? 'rgba(180,250,255,0.95)' : 'rgba(140,180,210,0.65)';
    ctx.shadowBlur = 0;
    ctx.fillText(s.lit && (state.lockCount || 0) >= 1 ? 'LOCK' : 'HOLE', s.x, s.y + s.radius + 10);
    ctx.restore();
  }

  function drawSaucer(ctx, state, pulse) {
    if (state.saucer) drawSaucerHole(ctx, state, state.saucer, pulse);
    if (state.saucer2) drawSaucerHole(ctx, state, state.saucer2, pulse);
    if (state.saucer3) drawSaucerHole(ctx, state, state.saucer3, pulse);
  }

  function drawGateSpinner(ctx, state, pulse) {
    var g = state.gateSpinner;
    if (!g) return;
    var simple = q().tubeDetail === 'simple' || q().tier === 'phone';
    var spinGlow = Math.min(1, Math.abs(g.spinVel) * 1.6);
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.rotate(g.angle);
    if (!simple) {
      applyShadow(ctx, 'rgba(120,230,255,' + (0.35 + spinGlow * 0.45) + ')', 8 + spinGlow * 8);
    }
    var half = g.h * 0.5;
    ctx.strokeStyle = 'rgba(160, 240, 255, ' + (0.75 + spinGlow * 0.2) + ')';
    ctx.lineWidth = simple ? 3 : 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -half);
    ctx.lineTo(0, half);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -half, 3.2, 0, Math.PI * 2);
    ctx.arc(0, half, 3.2, 0, Math.PI * 2);
    ctx.fillStyle = spinGlow > 0.08 ? '#c8f6ff' : '#7ad0e8';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, 4.2, 0, Math.PI * 2);
    ctx.fillStyle = '#e8ffff';
    ctx.fill();
    ctx.restore();
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
      var mini = flipper.role === 'upper' || (flipper.length && flipper.length < 56);
      var pivotOuter = mini ? 9 : 14;
      var pivotInner = mini ? 6 : 9;

      ctx.fillStyle = '#2a3540';
      ctx.beginPath();
      ctx.arc(flipper.pivotX, flipper.pivotY, pivotOuter, 0, Math.PI * 2);
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
      ctx.arc(flipper.pivotX, flipper.pivotY, pivotInner, 0, Math.PI * 2);
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
    var followMax = (Sim.PLUNGER_FOLLOW_FRAMES != null ? Sim.PLUNGER_FOLLOW_FRAMES : 3);
    var headR = 8;
    var tipW = 19;
    var tipH = 11;
    var headRestY = restY + Sim.BALL_RADIUS + headR + 2;
    var headY = headRestY;
    if (follow > 0) {
      headY = headRestY - 28 * (follow / followMax);
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
    var apronGrad = ctx.createLinearGradient(0, state.tableH - 130, 0, state.tableH);
    apronGrad.addColorStop(0, 'rgba(15,30,50,0.0)');
    apronGrad.addColorStop(0.35, 'rgba(18,35,55,0.85)');
    apronGrad.addColorStop(1, 'rgba(10,18,30,0.95)');
    ctx.fillStyle = apronGrad;
    ctx.fillRect(36, state.tableH - 110, root.PinballSim.LAUNCH_LANE_LEFT - 36, 110);
    ctx.restore();
  }

  function drawLaunchLaneRail(ctx, state) {
    var x = root.PinballSim.LAUNCH_LANE_LEFT;
    var joinY = root.PinballSim.LAUNCH_WIRE_Y1;
    ctx.save();
    var railGrad = ctx.createLinearGradient(x - 8, 0, x + 2, 0);
    railGrad.addColorStop(0, 'rgba(255,190,80,0.95)');
    railGrad.addColorStop(1, 'rgba(160,70,20,0.88)');
    ctx.strokeStyle = railGrad;
    ctx.lineWidth = 4;
    ctx.lineCap = 'butt';
    applyShadow(ctx, 'rgba(255,140,40,0.45)', 10);
    ctx.beginPath();
    ctx.moveTo(x, joinY);
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

  function paintOneBall(ctx, ball, ox, oy) {
    if (!ball) return;
    var bx = ox + ball.x;
    var by = oy + ball.y;
    var speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    trail.push({ x: bx, y: by, life: 0.15 });
    applyShadow(ctx, 'rgba(200,220,255,0.9)', 14 + Math.min(speed * 0.02, 12));
    var ballGrad = ctx.createRadialGradient(bx - 4, by - 4, 1, bx, by, ball.radius);
    ballGrad.addColorStop(0, '#ffffff');
    ballGrad.addColorStop(0.45, '#c8d8f0');
    ballGrad.addColorStop(1, '#607090');
    ctx.beginPath();
    ctx.arc(bx, by, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = ballGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function drawBall(ctx, state, offset) {
    if (!state.ball.inPlay && state.phase !== 'ready') return;

    var tLen = q().trailLen || 16;
    ctx.save();
    var i;
    for (i = 0; i < trail.length; i++) {
      var t = trail[i];
      t.life -= 0.016;
      var alpha = Math.max(0, t.life / 0.15) * 0.35;
      ctx.beginPath();
      ctx.arc(t.x, t.y, state.ball.radius * 0.7, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(220,230,255,' + alpha + ')';
      ctx.fill();
    }
    trail = trail.filter(function (tr) { return tr.life > 0; });
    while (trail.length > tLen) trail.shift();

    paintOneBall(ctx, state.ball, offset.ox, offset.oy);
    if (state.balls && state.balls.length) {
      for (i = 0; i < state.balls.length; i++) {
        if (state.balls[i] && state.balls[i] !== state.ball && state.balls[i].inPlay) {
          paintOneBall(ctx, state.balls[i], offset.ox, offset.oy);
        }
      }
    }
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
    } else if (state.multiballBannerLife > 0 && state.multiballBanner) {
      ctx.fillStyle = '#66f0ff';
      applyShadow(ctx, '#22d0ff', 14);
      ctx.fillText(state.multiballBanner, canvas.width - 24, 64);
    } else if (!state.multiball && ((state.saucer && state.saucer.lit) || (state.saucer2 && state.saucer2.lit) || (state.saucer3 && state.saucer3.lit))) {
      ctx.fillStyle = '#88e8ff';
      applyShadow(ctx, '#44c8ff', 10);
      ctx.fillText('LOCK LIT', canvas.width - 24, 64);
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
      combo: '#aaff88',
      boinger: '#ffb040'
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
    ctx.save();
    drawRoundedRect(ctx, offset.ox, offset.oy, state.tableW, state.tableH, 12);
    ctx.clip();
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
    ctx.restore();

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
