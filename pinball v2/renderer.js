/**
 * High-fidelity Canvas 2D renderer for pinball table.
 */
(function (root) {
  'use strict';

  var particles = [];
  var glowPulse = 0;
  var trail = [];
  var playfieldGlow = 0;

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
    if (particles.length > 320) {
      particles.splice(0, particles.length - 320);
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

    ctx.shadowColor = 'rgba(255,180,60,0.4)';
    ctx.shadowBlur = 24;
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
    drawDrainSlots(ctx, state, glowPulse);

    ctx.restore();
    return { ox: ox, oy: oy };
  }

  function drawLaunchLaneChannel(ctx, state) {
    var tw = state.tableW;
    var th = state.tableH;
    var laneLeft = root.PinballSim.LAUNCH_LANE_LEFT;
    var laneGrad = ctx.createLinearGradient(laneLeft, 0, tw, 0);
    laneGrad.addColorStop(0, 'rgba(20,45,70,0.85)');
    laneGrad.addColorStop(1, 'rgba(35,65,95,0.95)');
    ctx.fillStyle = laneGrad;
    ctx.fillRect(laneLeft, 60, tw - laneLeft - 4, th - 130);
    ctx.strokeStyle = 'rgba(80,140,200,0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(laneLeft + 1, 60, tw - laneLeft - 6, th - 132);
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
      ctx.fillStyle = 'rgba(50, 80, 110, 0.55)';
      drawRoundedRect(ctx, x0, y0, w, h, 5);
      ctx.fill();
      ctx.strokeStyle = 'rgba(100,150,200,0.28)';
      ctx.lineWidth = 1;
      drawRoundedRect(ctx, x0, y0, w, h, 5);
      ctx.stroke();
      // Lit layer on top
      if (intensity > 0.02) {
        var a = intensity;
        ctx.globalAlpha = a;
        ctx.shadowColor = hot
          ? 'rgba(255,240,140,' + (0.5 + 0.5 * a) + ')'
          : 'rgba(255,200,50,' + (0.25 + 0.55 * a) + ')';
        ctx.shadowBlur = (hot ? 18 : 12) * (0.4 + 0.6 * a);
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

  function drawWalls(ctx, state) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // Glow pass for rounded top arch segments
    state.walls.forEach(function (wall) {
      var kind = wall.kind || 'rail';
      if (kind === 'lane' || kind === 'chute' || kind === 'guide') return;
      if (wall.arc || kind === 'rail') {
        ctx.strokeStyle = 'rgba(100, 200, 255, 0.22)';
        ctx.lineWidth = 10;
        ctx.shadowColor = 'rgba(0, 220, 255, 0.35)';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(wall.x1, wall.y1);
        ctx.lineTo(wall.x2, wall.y2);
        ctx.stroke();
      }
    });
    state.walls.forEach(function (wall) {
      var kind = wall.kind || 'rail';
      if (kind === 'lane') return;
      if (kind === 'chute' || kind === 'guide') {
        return;
      } else if (kind === 'inlane') {
        ctx.strokeStyle = 'rgba(140,170,210,0.45)';
        ctx.lineWidth = 3;
        ctx.shadowBlur = 0;
      } else if (kind === 'deck') {
        // Subtle stubs only — full gray bars used to block lower bumpers/kickers
        ctx.strokeStyle = 'rgba(160,180,210,0.28)';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 0;
      } else {
        ctx.strokeStyle = wall.arc ? 'rgba(160, 230, 255, 0.95)' : 'rgba(180,200,230,0.85)';
        ctx.lineWidth = wall.arc ? 6 : 5;
        ctx.shadowColor = 'rgba(100,150,255,0.5)';
        ctx.shadowBlur = 8;
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
      ctx.shadowColor = 'rgba(255,80,100,0.5)';
      ctx.shadowBlur = 10;
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

  function drawSideRoutes(ctx, state, pulse) {
    if (!state.sideRoutes) return;
    var cap = state.sideRoutes.leftCaptive;
    if (cap) {
      ctx.save();
      ctx.shadowColor = 'rgba(120, 200, 255, 0.55)';
      ctx.shadowBlur = 10 + Math.sin(pulse * 2) * 3;
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
    var ramp = state.sideRoutes.rightRamp;
    if (ramp) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 180, 80, 0.75)';
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.shadowColor = 'rgba(255, 160, 40, 0.45)';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(ramp.x1, ramp.y1);
      ctx.lineTo(ramp.x2, ramp.y2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 220, 140, 0.5)';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
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
        ctx.shadowColor = hot ? 'rgba(255, 220, 80, 0.9)' : 'rgba(255, 120, 60, 0.5)';
        ctx.shadowBlur = hot ? 14 : 8;
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
      ctx.shadowColor = lit ? 'rgba(255,200,80,0.9)' : 'rgba(100,150,200,0.4)';
      ctx.shadowBlur = lit ? 14 + flash * 10 : 6;
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
      ctx.save();
      ctx.strokeStyle = lane.lit ? 'rgba(255,220,80,0.85)' : 'rgba(80,120,160,0.4)';
      ctx.lineWidth = lane.width;
      ctx.lineCap = 'round';
      ctx.shadowColor = lane.lit ? 'rgba(255,200,60,0.6)' : 'transparent';
      ctx.shadowBlur = lane.lit ? 12 : 0;
      ctx.beginPath();
      ctx.moveTo(lane.x1, lane.y1);
      ctx.lineTo(lane.x2, lane.y2);
      ctx.stroke();
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
        ctx.shadowColor = bumper.color;
        ctx.shadowBlur = 20 + glow * 15;
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
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        // hit flash ring over sprite
        var hitVis = Assets && Assets.getBumperHitVisual ? Assets.getBumperHitVisual(idx) : 0;
        if (hitVis > 0 || (bumper.hitCooldown && bumper.hitCooldown > 0.1)) {
          ctx.shadowColor = bumper.color;
          ctx.shadowBlur = 28;
          ctx.strokeStyle = 'rgba(255,255,255,0.85)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(bumper.x, bumper.y, bumper.radius + 4, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
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
      ctx.shadowColor = kicker.color;
      ctx.shadowBlur = 12 + glow * 10;
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
    ctx.save();
    ctx.translate(sp.x, sp.y);
    ctx.rotate(sp.angle);
    ctx.shadowColor = 'rgba(180,220,255,0.6)';
    ctx.shadowBlur = 8 + Math.sin(pulse * 5) * 4;
    ctx.strokeStyle = 'rgba(200,220,255,0.85)';
    ctx.lineWidth = 3;
    for (var i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(sp.radius, 0);
      ctx.stroke();
      ctx.rotate(Math.PI / 2);
    }
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#aabbcc';
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
      ctx.shadowColor = flipper.active ? 'rgba(100,200,255,0.9)' : 'rgba(60,90,120,0.5)';
      ctx.shadowBlur = flipper.active ? 20 : 8;
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

      ctx.fillStyle = flipper.active ? '#88bbee' : '#556677';
      ctx.beginPath();
      ctx.arc(flipper.pivotX, flipper.pivotY, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  function drawPlunger(ctx, state) {
    var x = root.PinballSim.LAUNCH_LANE_X;
    var y = root.PinballSim.PLUNGER_REST_Y;
    var laneLeft = root.PinballSim.LAUNCH_LANE_LEFT;

    ctx.save();
    ctx.fillStyle = '#334455';
    ctx.fillRect(x - 10, y - 20, 20, 40);
    var cupGrad = ctx.createLinearGradient(x - 8, y - 8, x + 8, y + 8);
    cupGrad.addColorStop(0, '#667788');
    cupGrad.addColorStop(1, '#334455');
    ctx.fillStyle = cupGrad;
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(180,200,230,0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(laneLeft + 4, y - 30, root.PinballSim.TABLE_W - laneLeft - 42, 60);
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
      ctx.shadowColor = state.launchCharging ? 'rgba(255,200,60,0.5)' : 'transparent';
      ctx.shadowBlur = state.launchCharging ? 10 : 0;
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
    var wireY1 = root.PinballSim.LAUNCH_WIRE_Y1;
    var wireY2 = root.PinballSim.LAUNCH_WIRE_Y2;
    var wireX2 = root.PinballSim.LAUNCH_WIRE_X2;
    ctx.save();
    var railGrad = ctx.createLinearGradient(x - 8, 0, x + 2, 0);
    railGrad.addColorStop(0, 'rgba(200,230,255,0.95)');
    railGrad.addColorStop(1, 'rgba(100,130,170,0.8)');
    ctx.strokeStyle = railGrad;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(120,180,255,0.55)';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(x, 60);
    ctx.lineTo(x, wireY1);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, wireY1);
    ctx.quadraticCurveTo(x - 36, wireY1 - 18, wireX2, wireY2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, wireY1);
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
      ctx.shadowColor = color;
      ctx.shadowBlur = 8 + glow * 6;
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
    if (trail.length > 16) trail.shift();

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

    ctx.shadowColor = 'rgba(200,220,255,0.9)';
    ctx.shadowBlur = 14 + Math.min(speed * 0.02, 12);
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
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 12;
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
    ctx.shadowColor = themeAccent();
    ctx.shadowBlur = 12;
    ctx.textAlign = 'left';
    ctx.fillText(formatScore(state.score), 24, 46);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#80c8ff';
    ctx.fillText('BALL ' + Math.max(0, state.ballsRemaining), canvas.width - 24, 46);

    // Center of HUD band reserved for DOM #btn-tilt (no canvas text there).
    ctx.font = 'bold 12px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff88cc';
    ctx.shadowBlur = 8;
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
      ctx.shadowBlur = 12;
      ctx.fillText(state.skillShotBanner, canvas.width - 24, 64);
    } else if (state.skillShotWindow) {
      ctx.fillStyle = '#ffcc44';
      ctx.shadowBlur = 10;
      ctx.fillText('SKILL SHOT!', canvas.width - 24, 64);
    } else if (state.rushTimer > 0 && state.rushName) {
      var isEmber = /EMBER/i.test(state.rushName);
      ctx.fillStyle = isEmber ? '#ff8844' : '#44e0ff';
      ctx.shadowColor = isEmber ? '#ff6622' : '#22c8ff';
      ctx.shadowBlur = 14;
      ctx.fillText(state.rushName + ' ' + Math.ceil(state.rushTimer) + 's · ' + (state.rushMult || 2) + 'X', canvas.width - 24, 64);
    } else if (state.ballSaveArmed && state.ball.inPlay && !state.ballSaveUsed) {
      ctx.fillStyle = '#88ffcc';
      ctx.shadowBlur = 8;
      ctx.fillText('BALL SAVE READY', canvas.width - 24, 64);
    } else {
      ctx.fillText(themeTitle() + ' · T theme', canvas.width - 24, 64);
    }

    if (state.jackpotLit) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 12px Orbitron, sans-serif';
      ctx.fillStyle = '#ffdd22';
      ctx.shadowBlur = 14;
      ctx.fillText('JACKPOT LIT', canvas.width * 0.5, 86);
    }

    if (state.tiltWarnings > 0 && state.phase !== 'game_over') {
      ctx.textAlign = 'center';
      ctx.font = 'bold 12px Orbitron, sans-serif';
      ctx.fillStyle = state.tiltWarnings > 1 ? '#ff6644' : '#ffaa44';
      ctx.shadowBlur = 10;
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
        ctx.shadowBlur = 16;
        ctx.shadowColor = popup.type === 'tiltout' ? 'rgba(255,60,80,0.9)' : 'rgba(255,180,60,0.8)';
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
      ctx.shadowBlur = 24;
      ctx.shadowColor = 'rgba(255,80,120,0.9)';
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
    var count = state.lastHitType === 'bumper' ? 18 : state.lastHitType === 'jackpot' ? 28 : 10;
    addParticles(x - offset.ox, y - offset.oy, color, count, state.lastHitType === 'bumper' ? 1.3 : 1);
    playfieldGlow += 0.4;
    state.lastHitType = null;
  }

  function render(canvas, state, dt) {
    var ctx = canvas.getContext('2d');
    var Assets = getAssets();
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
        addParticles(bumper.x, bumper.y, bumper.color, 14, 1.2);
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
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
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
        ctx.shadowColor = '#66ffcc';
        ctx.shadowBlur = 16;
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
      ctx.shadowColor = '#44a0ff';
      ctx.shadowBlur = 12;
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
  }

  var api = { render: render, addParticles: addParticles, themeTitle: themeTitle };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof root !== 'undefined') {
    root.PinballRender = api;
  }
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);