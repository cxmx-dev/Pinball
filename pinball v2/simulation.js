/**
 * Pure pinball simulation â€” no DOM, no rendering.
 * Loadable in browser (window.PinballSim) and Node (module.exports).
 */
(function (root) {
  'use strict';

  var TABLE_PITCH_DEG = 6.8;
  var GRAVITY_1G = 9800;
  // Along-table px/s^2 for a steel ball on TABLE_PITCH_DEG (1g * sin(6.8 deg) ~ 1160, tuned 1180).
  var GRAVITY = 1180;
  var BALL_RADIUS = 12;
  var TABLE_W = 560;
  var TABLE_H = 860;
  var ARCH_CX = TABLE_W * 0.5;
  var ARCH_CY = 76;
  var ARCH_RX = 244;
  var ARCH_RY = 50;
  var FLIPPER_INLANE_X = 88;
  var LEFT_INLANE_POST_TOP = 430;
  var FLIPPER_ROW_Y = TABLE_H - 108;
  var FLIPPER_LEFT_PIVOT_X = 124;
  var FLIPPER_RIGHT_PIVOT_X = 318;
  var FLIPPER_PIVOT_SPACING = FLIPPER_RIGHT_PIVOT_X - FLIPPER_LEFT_PIVOT_X;
  var FLIPPER_LEN = 66; // hold-up still a hole (real cabinet); sweep at horizontal can catch center.
  var FLIPPER_W = 14;
  var FLIPPER_PIVOT_R = 16;
  var FLIPPER_SPEED = 14;
  /** Powered bat slap only while |omega| exceeds this (rad/s). */
  var FLIPPER_OMEGA_DEAD = 2;
  /** Scales tip velocity â†’ ball Î”v while sweeping. */
  var FLIPPER_IMPULSE_GAIN = 0.85;
  /** Double-tap charges that bat 2x for CHARGE_SEC; glow starts at 4 Hz and eases down. */
  var FLIPPER_TAP_MULT = 2;
  var FLIPPER_DBL_TAP_WINDOW = 0.32;
  var FLIPPER_CHARGE_SEC = 15;
  var FLIPPER_GLOW_HZ_START = 4;
  var FLIPPER_GLOW_HZ_END = 0.75;
  /** Cap on powered add-speed from a flipper slap (px/s). */
  var FLIPPER_MAX_ADD_SPEED = 1150;
  /** Tip-weight exponent on contact fraction t/segLen. */
  var FLIPPER_TIP_POWER = 1.2;
  var FLIPPER_RESTITUTION_SWEEP = 1.26;
  var FLIPPER_RESTITUTION_PASSIVE = 0.45;
  var DECK_DRAIN_SPEED = 220;
  var WALL_RESTITUTION = 0.72;
  /** Habitrail/guide bounce â€” livelier than cabinet rails so channels do not crawl. */
  var HABITRAIL_RESTITUTION = 0.52;
  var GUIDE_RESTITUTION = 0.48;
  /** Min along-rail speed (px/s) while ball is inside a habitrail channel. */
  var HABITRAIL_MIN_SPEED = 0;
  /** Continuous along-path assist while riding a habitrail (px/s^2). */
  var HABITRAIL_ASSIST = 0;
  /** Slow CCW spin of the pulse triangle (rad/s). Negative = CCW on canvas y-down. */
  var TRIANGLE_SPIN = 0;
  var TRIANGLE_HIT_SPIN_GAIN = 0.016;
  var TRIANGLE_SPIN_MAX = 2.2;
  var TRIANGLE_SPIN_FRICTION = 1.65;
  var TRIANGLE_SPIN_STOP = 0.03;
  var TRIANGLE_UP_SEC = 1.0;
  var TRIANGLE_DOWN_SEC = 1.0;
  var TRIANGLE_CYCLE_SEC = 2.0;
  /** Rubber kick while the triangle is up (25% over sling baseline). */
  var TRIANGLE_RUBBER_MULT = 1.25;
  var BUMPER_RESTITUTION = 1.15;
  var FLIPPER_RESTITUTION = FLIPPER_RESTITUTION_PASSIVE;
  var SLING_RESTITUTION = 1.08;
  var KICKER_RESTITUTION = 1.2;
  /** Soft ball speed ceiling (px/s). */
  var MAX_BALL_SPEED = 1600;
  /** Base linear damp per physics step (~16ms); rises with speed. */
  var BALL_DRAG_BASE = 0.00058;
  var BALL_DRAG_SPEED = 0.00105;
  var MAX_LAUNCH_POWER = 1400;
  var MIN_LAUNCH_POWER = 200;
  var LAUNCH_CHARGE_RATE = 1.1;
  /** Meterâ†’power ease exponent (1 = linear). */
  var LAUNCH_METER_EASE = 1.0;
  /** Frames of plunger follow thrust while still in shooter lane. */
  var PLUNGER_FOLLOW_FRAMES = 3;
  /** Max |vx| English from launch charge (aim skill). */
  var LAUNCH_ENGLISH_MAX = 0;
  var DRAIN_SLOT_TOP = TABLE_H - 14;
  var DRAIN_SLOT_H = 12;
  var DRAIN_Y = DRAIN_SLOT_TOP - BALL_RADIUS;
  /** Seconds of ball-save after a CENTER skill shot before it expires unused. */
  var BALL_SAVE_DURATION = 8;
  var HIT_COOLDOWN_SPINNER = 0.35;
  var HIT_COOLDOWN_SLING = 0.22;
  var SLING_KICK_GAIN = 1.05;
  var SLING_KICK_MIN = 120;
  var SLING_KICK_MAX = 260;
  var SLING_UP_BIAS = 0.55;
  var HIT_COOLDOWN_BUMPER = 0.24;
  var MIN_BUMPER_EXIT_SPEED = 185;
  var SAVER_BUMPER_EXIT_SPEED = 150;
  var BUMPER_UNSTICK_SPEED = 125;
  var RUBBER_BUMPER_RESTITUTION = 1.32;
  var RUBBER_BUMPER_EXIT_SPEED = 320;
  var RUBBER_BUMPER_SCORE = 500;
  var MAX_TILT_WARNINGS = 2;
  var TILT_COOLDOWN = 0.55;
  var LAUNCH_LANE_X = TABLE_W - 62;
  var LAUNCH_LANE_LEFT = TABLE_W - 88;
  var LAUNCH_LANE_RIGHT = TABLE_W - 36;
  var PLUNGER_REST_Y = TABLE_H - 88;
  var LAUNCH_LANE_TOP = TABLE_H - 200;
  var LAUNCH_WIRE_Y1 = 103;
  var LAUNCH_WIRE_Y2 = 80;
  var LAUNCH_WIRE_X2 = 440;
  var WIRE_FORM_X1 = LAUNCH_LANE_LEFT;
  var WIRE_FORM_Y1 = LAUNCH_WIRE_Y1;
  var WIRE_FORM_X2 = LAUNCH_WIRE_X2;
  var WIRE_FORM_Y2 = LAUNCH_WIRE_Y2;
  var WIRE_FORM_DX = WIRE_FORM_X2 - WIRE_FORM_X1;
  var WIRE_FORM_DY = WIRE_FORM_Y2 - WIRE_FORM_Y1;
  var COMBO_WINDOW = 2.2;
  var MAX_MULTIPLIER = 5;
  var SKILL_SHOT_CENTER_BONUS = 2500;
  var SKILL_SHOT_NEAR_BONUS = 1000;
  /** @deprecated alias â€” center grade (tests / exports) */
  var SKILL_SHOT_BONUS = SKILL_SHOT_CENTER_BONUS;
  var LAUNCH_DASH_FULL_BONUS = 800;
  var LAUNCH_DASH_HOLD_SEC = 1.5;
  var POPUP_MERGE_COMBO = 3;
  var POPUP_MERGE_LIFE_MIN = 0.12;
  /** Reverse cascade: first off (top) is slowest; each next dash toward plunger is faster. */
  var LAUNCH_DASH_FADE_MAX = 0.55;
  var LAUNCH_DASH_FADE_MIN = 0.1;
  var LAUNCH_DASH_FADE_ACCEL = 0.72; // multiply duration each step down
  var RUSH_MODE_DURATION = 20;
  var RUSH_SCORE_MULT = 2;
  var EOB_DURATION = 1.65;
  var DROP_BANK_SIZE = 4;
  var SIDE_ROUTE_COOLDOWN = 0.35;
  var BOINGER_X = 398;
  var BOINGER_Y = 686;
  var BOINGER_B_X = 352;
  var BOINGER_B_Y = 707;
  var BOINGER_C_X = 125;
  var BOINGER_C_Y = 708;
  var BOINGER_R = 12;
  var BOINGER_UP_SEC = 3;
  var BOINGER_DOWN_SEC = 1.5;
  var BOINGER_POP_SEC = 0.18;
  var BOINGER_RESTITUTION = 1.28;
  var BOINGER_EXIT_SPEED = 280;
  var BOINGER_SCORE = 250;
  var HIT_COOLDOWN_BOINGER = 0.22;

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function vecLen(x, y) {
    return Math.sqrt(x * x + y * y);
  }

  function normalize(x, y) {
    var len = vecLen(x, y);
    if (len < 1e-6) return { x: 0, y: -1 };
    return { x: x / len, y: y / len };
  }

  function dot(ax, ay, bx, by) {
    return ax * bx + ay * by;
  }

  function createFlipper(side) {
    var isLeft = side === 'left';
    return {
      side: side,
      pivotX: isLeft ? FLIPPER_LEFT_PIVOT_X : FLIPPER_RIGHT_PIVOT_X,
      pivotY: FLIPPER_ROW_Y,
      restAngle: isLeft ? 0.42 : Math.PI - 0.42,
      activeAngle: isLeft ? -0.38 : Math.PI + 0.38,
      angle: isLeft ? 0.42 : Math.PI - 0.42,
      targetAngle: isLeft ? 0.42 : Math.PI - 0.42,
      length: FLIPPER_LEN,
      width: FLIPPER_W,
      role: 'main',
      active: false,
      omega: 0,
      pressAge: 0,
      tapBoost: false,
      sinceLastPress: 99,
      chargeLeft: 0,
      glowPhase: 0
    };
  }

  function createUpperRightFlipper() {
    // Mini right-facing-left bat. Same right input as the main right flipper.
    var rest = Math.PI - 0.52;
    var active = Math.PI + 0.34;
    return {
      side: 'right',
      role: 'upper',
      pivotX: 358,
      pivotY: 372,
      restAngle: rest,
      activeAngle: active,
      angle: rest,
      targetAngle: rest,
      length: 44,
      width: 11,
      active: false,
      omega: 0,
      pressAge: 0,
      tapBoost: false,
      sinceLastPress: 99,
      chargeLeft: 0,
      glowPhase: 0
    };
  }

  /**
   * Mid-table cluster: 180 apex below the horseshoe, 300s lower and wider.
   * Clears slide channels; saver sits mid-table above the flippers.
   * bumpers[0] remains the skill-shot target (now the lower apex).
   */
  function createBumpers() {
    return [
      // Skill / apex - 180 below the horseshoe join, out of the channel
      { x: 280, y: 275, radius: 16, score: 180, color: '#cc66ff', kind: 'bumper', hitCooldown: 0, hit: false },
      // Wings - mid-field under the lifted U, clear of slide mouths
      { x: 155, y: 308, radius: 22, score: 300, color: '#33ccff', kind: 'bumper', hitCooldown: 0, hit: false },
      { x: 343, y: 295, radius: 22, score: 300, color: '#ffcc00', kind: 'bumper', hitCooldown: 0, hit: false },
      {
        // Weaker / smaller saver - outlane tension
        x: 210,
        y: 455,
        radius: 14,
        score: 120,
        color: '#55ffaa',
        kind: 'bumper',
        saver: true,
        id: 'outlane-saver',
        hitCooldown: 0
      },
      {
        // Powerful rubber-ring bumper below the pulse triangle, toward playfield center
        x: 340,
        y: 520,
        radius: 18,
        score: RUBBER_BUMPER_SCORE,
        color: '#b31f3a',
        kind: 'bumper',
        id: 'rubber-mid',
        rubber: true,
        restitution: RUBBER_BUMPER_RESTITUTION,
        exitSpeed: RUBBER_BUMPER_EXIT_SPEED,
        hitCooldown: 0,
        hit: false
      }
    ];
  }

  /** Rubber on sausage climb/upward face only — last-resort save, never downhill or triangle. */
  function createSlingshots() {
    return [
      { side: 'left', face: 'top', x1: 48, y1: 578, x2: 64, y2: 598, score: 150, cooldown: 0 },
      { side: 'left', x1: 64, y1: 598, x2: 76, y2: 628, score: 150, cooldown: 0 },
      { side: 'left', x1: 76, y1: 628, x2: 80, y2: 652, score: 150, cooldown: 0 },
      { side: 'right', x1: 428, y1: 580, x2: 418, y2: 622, score: 150, cooldown: 0 },
      { side: 'right', x1: 418, y1: 622, x2: 414, y2: 662, score: 150, cooldown: 0 },
      { side: 'right', face: 'top', x1: 450, y1: 558, x2: 438, y2: 570, score: 150, cooldown: 0 }
    ];
  }

  function buildPulseTriangleSides(verts, themes, prev) {
    var sides = [];
    var i;
    var cx = (verts[0].x + verts[1].x + verts[2].x) / 3;
    var cy = (verts[0].y + verts[1].y + verts[2].y) / 3;
    for (i = 0; i < 3; i++) {
      var a = verts[i];
      var b = verts[(i + 1) % 3];
      var mx = (a.x + b.x) * 0.5;
      var my = (a.y + b.y) * 0.5;
      var ex = b.x - a.x;
      var ey = b.y - a.y;
      var n1x = ey;
      var n1y = -ex;
      var toMidX = mx - cx;
      var toMidY = my - cy;
      if (n1x * toMidX + n1y * toMidY < 0) {
        n1x = -n1x;
        n1y = -n1y;
      }
      var nlen = Math.sqrt(n1x * n1x + n1y * n1y) || 1;
      var old = prev && prev[i];
      sides.push({
        i: i,
        x1: a.x,
        y1: a.y,
        x2: b.x,
        y2: b.y,
        nx: n1x / nlen,
        ny: n1y / nlen,
        theme: themes[i].id,
        color: themes[i],
        phaseOffset: old && old.phaseOffset != null ? old.phaseOffset : (i * Math.PI * 2) / 3,
        flash: old ? old.flash : 0,
        cooldown: old ? old.cooldown : 0,
        lit: old && old.lit != null ? old.lit : 0.5,
        score: old && old.score != null ? old.score : 175
      });
    }
    return sides;
  }

  function syncTriangleSolidWalls(state) {
    var tri = state && state.pulseTriangle;
    if (!tri || !state.walls || !tri.sides) return;
    var wi = 0;
    var i;
    for (i = 0; i < state.walls.length; i++) {
      if (state.walls[i].kind !== 'tri-solid') continue;
      var s = tri.sides[wi++];
      if (!s) continue;
      state.walls[i].x1 = s.x1;
      state.walls[i].y1 = s.y1;
      state.walls[i].x2 = s.x2;
      state.walls[i].y2 = s.y2;
      state.walls[i].nx = s.nx;
      state.walls[i].ny = s.ny;
    }
  }

  function rotatePulseTriangleBody(state, dt) {
    var tri = state && state.pulseTriangle;
    if (!tri || !tri.restVerts) return;
    var omega = tri.spin != null ? tri.spin : 0;
    if (omega > TRIANGLE_SPIN_MAX) omega = TRIANGLE_SPIN_MAX;
    if (omega < -TRIANGLE_SPIN_MAX) omega = -TRIANGLE_SPIN_MAX;
    tri.angle = (tri.angle || 0) + omega * dt;
    var decayed = omega * Math.exp(-TRIANGLE_SPIN_FRICTION * dt);
    if (Math.abs(decayed) < TRIANGLE_SPIN_STOP) decayed = 0;
    tri.spin = decayed;
    var c = Math.cos(tri.angle);
    var s = Math.sin(tri.angle);
    var cx = tri.cx;
    var cy = tri.cy;
    var i;
    for (i = 0; i < tri.restVerts.length; i++) {
      var p = tri.restVerts[i];
      var dx = p.x - cx;
      var dy = p.y - cy;
      if (!tri.verts[i]) tri.verts[i] = { x: 0, y: 0 };
      // y-down rotation: +angle is CW on screen. Negative omega = CCW (top vertex moves left).
      tri.verts[i].x = cx + dx * c - dy * s;
      tri.verts[i].y = cy + dx * s + dy * c;
    }
    var themes = [];
    for (i = 0; i < tri.sides.length; i++) themes.push(tri.sides[i].color);
    tri.sides = buildPulseTriangleSides(tri.verts, themes, tri.sides);
    syncTriangleSolidWalls(state);
  }

  function createPulseTriangle() {
    // Lower-middle-left above the left flipper. Same ~52x44 size as the old mid-field tri.
    var verts = [
      { x: 186, y: 529 },
      { x: 212, y: 572 },
      { x: 160, y: 573 }
    ];
    var themes = [
      { id: 'copper', core: '#e8a04a', glow: 'rgba(255,160,50,0.55)', hi: '#ffe2b0' },
      { id: 'cyan', core: '#3ad4ff', glow: 'rgba(50,220,255,0.55)', hi: '#c4f4ff' },
      { id: 'violet', core: '#b46cff', glow: 'rgba(180,100,255,0.55)', hi: '#ead4ff' }
    ];
    var cx = (verts[0].x + verts[1].x + verts[2].x) / 3;
    var cy = (verts[0].y + verts[1].y + verts[2].y) / 3;
    var restVerts = [
      { x: verts[0].x, y: verts[0].y },
      { x: verts[1].x, y: verts[1].y },
      { x: verts[2].x, y: verts[2].y }
    ];
    return {
      id: 'pulse-tri',
      verts: verts,
      restVerts: restVerts,
      cx: cx,
      cy: cy,
      angle: 0,
      spin: 0,
      sides: buildPulseTriangleSides(verts, themes, null),
      radius: 8,
      cycleT: 0,
      sweepSec: 15
    };
  }

  function triangleSidePulse(side, cycleT) {
    var sweep = 15;
    var age = cycleT % sweep;
    if (age < 0) age += sweep;
    var u = age / sweep;
    var hz = 4.6 * (1 - u) + 0.52 * u;
    return 0.38 + 0.62 * (0.5 + 0.5 * Math.sin(2 * Math.PI * hz * age + (side.phaseOffset || 0)));
  }

  function triangleIsUp(tri) {
    if (!tri) return false;
    var t = (tri.cycleT || 0) % TRIANGLE_CYCLE_SEC;
    if (t < 0) t += TRIANGLE_CYCLE_SEC;
    return t < TRIANGLE_UP_SEC;
  }

  function ejectBallFromTriangle(state, ball, tri) {
    if (!ball || !tri) return;
    var dx = ball.x - tri.cx;
    var dy = ball.y - tri.cy;
    var d = vecLen(dx, dy);
    if (d < 1e-6) { dx = 0; dy = -1; d = 1; }
    ball.x = tri.cx + (dx / d) * 56;
    ball.y = tri.cy + (dy / d) * 56;
    ball.vx += (dx / d) * 260;
    ball.vy += (dy / d) * 260;
  }

  function stepPulseTriangle(state, dt) {
    var tri = state && state.pulseTriangle;
    if (!tri) return;
    var wasUp = triangleIsUp(tri);
    rotatePulseTriangleBody(state, dt);
    tri.cycleT = (tri.cycleT || 0) + dt;
    if (!wasUp && triangleIsUp(tri)) {
      var pack = allLiveBalls(state);
      var bi;
      for (bi = 0; bi < pack.length; bi++) {
        var b = pack[bi];
        if (b && b.inPlay && !skipBallAssist(state, b) && ballInsideTriangle(b, tri)) ejectBallFromTriangle(state, b, tri);
      }
    }
    var i;
    for (i = 0; i < tri.sides.length; i++) {
      var s = tri.sides[i];
      if (s.cooldown > 0) s.cooldown = Math.max(0, s.cooldown - dt);
      if (s.flash > 0) s.flash = Math.max(0, s.flash - dt);
      s.lit = triangleSidePulse(s, tri.cycleT);
    }
  }

  function pointInTriangle(px, py, v) {
    function sign(ax, ay, bx, by, cx, cy) {
      return (ax - cx) * (by - cy) - (bx - cx) * (ay - cy);
    }
    var b1 = sign(px, py, v[0].x, v[0].y, v[1].x, v[1].y) < 0;
    var b2 = sign(px, py, v[1].x, v[1].y, v[2].x, v[2].y) < 0;
    var b3 = sign(px, py, v[2].x, v[2].y, v[0].x, v[0].y) < 0;
    return (b1 === b2) && (b2 === b3);
  }

  function ballInsideTriangle(ball, tri) {
    if (!ball || !tri || !tri.verts) return false;
    return pointInTriangle(ball.x, ball.y, tri.verts);
  }

  function applyTriangleHitSpin(tri, ball, preVx, preVy) {
    if (!tri || !ball) return;
    var rx = ball.x - tri.cx;
    var ry = ball.y - tri.cy;
    var rlen = vecLen(rx, ry);
    if (rlen < 1e-6) return;
    var tangent = (-ry * preVx + rx * preVy) / rlen;
    var add = tangent * TRIANGLE_HIT_SPIN_GAIN;
    var next = (tri.spin || 0) + add;
    if (next > TRIANGLE_SPIN_MAX) next = TRIANGLE_SPIN_MAX;
    if (next < -TRIANGLE_SPIN_MAX) next = -TRIANGLE_SPIN_MAX;
    tri.spin = next;
  }

  function resolvePulseTriangle(state) {
    var tri = state && state.pulseTriangle;
    var ball = state && state.ball;
    if (!tri || !ball || !ball.inPlay) return;
    if (!triangleIsUp(tri)) return;
    var i;
    var r = tri.radius || 8;
    for (i = 0; i < tri.verts.length; i++) {
      var p = tri.verts[i];
      var dx = ball.x - p.x;
      var dy = ball.y - p.y;
      var dist = vecLen(dx, dy);
      var minD = ball.radius + r;
      if (dist < minD && dist > 1e-6) {
        var n = normalize(dx, dy);
        var preVxV = ball.vx;
        var preVyV = ball.vy;
        ball.x = p.x + n.x * minD;
        ball.y = p.y + n.y * minD;
        var rv = reflectVelocity(ball.vx, ball.vy, n.x, n.y, SLING_RESTITUTION * TRIANGLE_RUBBER_MULT);
        ball.vx = rv.vx;
        ball.vy = rv.vy;
        applyTriangleHitSpin(tri, ball, preVxV, preVyV);
      }
    }
    if (ballInsideTriangle(ball, tri)) {
      unstickOneTriangleInterior(state, ball, tri);
      return;
    }
    for (i = 0; i < tri.sides.length; i++) {
      var s = tri.sides[i];
      var preVx = ball.vx;
      var preVy = ball.vy;
      segmentCollision(ball, s.x1, s.y1, s.x2, s.y2, SLING_RESTITUTION * TRIANGLE_RUBBER_MULT, function () {
        var incident = Math.max(0, -dot(preVx, preVy, s.nx, s.ny));
        var kick = clamp(incident * SLING_KICK_GAIN * TRIANGLE_RUBBER_MULT, SLING_KICK_MIN * TRIANGLE_RUBBER_MULT, SLING_KICK_MAX * TRIANGLE_RUBBER_MULT);
        ball.vx += s.nx * kick;
        ball.vy += s.ny * kick - kick * 0.32;
        applyTriangleHitSpin(tri, ball, preVx, preVy);
        if (s.cooldown <= 0 && !lodgeFarming(state, ball) && !ballInsideTriangle(ball, tri)) {
          awardScore(state, s.score, 'tri-rubber', s.theme, (s.x1 + s.x2) * 0.5, (s.y1 + s.y2) * 0.5);
          s.cooldown = HIT_COOLDOWN_SLING;
          s.flash = 0.38;
        }
      });
    }
  }


  function isSlingGuideSeg(seg) {
    if (!seg) return false;
    var slings = createSlingshots();
    var i;
    for (i = 0; i < slings.length; i++) {
      if (slings[i].x1 === seg.x1 && slings[i].y1 === seg.y1 && slings[i].x2 === seg.x2 && slings[i].y2 === seg.y2) {
        return true;
      }
    }
    return false;
  }

  function createTargets() {
    // Grey standup rectangles removed — leftover mid-left/mid-right clutter.
    return [];
  }

  /** Horizontal drop bank mid-table â€” complete all â†’ rush mode */
  function createDropTargets() {
    return [];
  }

  /**
   * Side routes: left captive post, left orbit/slide ramp, right habitrail.
   * Travel geometry lives as wall segments (see createHabitrailWalls);
   * routes hold entry sensors + draw polylines + mild ride boosts.
   */
  function createSideRoutes() {
    // Horseshoe orbit: left slide + top channel + right slide meet under the arch.
    // Outer / inner polylines are also the draw tubes (cyan left, copper right).
    // shoe5: rounded on-ramp + orange elbow. Crown y~18 join x=280. Channel 50-62.
    return {
      leftCaptive: {
        id: 'captive-l',
        x: 110,
        y: 262,
        radius: 8,
        score: 650,
        cooldown: 0
      },
      leftRamp: {
        id: 'ramp-l',
        score: 800,
        cooldown: 0,
        entry: { x: 80, y: 337, w: 44, h: 30 },
        exit: { x: 80, y: 337 },
        boost: 0,
        segments: [
          { x1: 60, y1: 345, x2: 46, y2: 278 },
          { x1: 46, y1: 278, x2: 36, y2: 200 },
          { x1: 36, y1: 200, x2: 36, y2: 118 },
          { x1: 36, y1: 118, x2: 36, y2: 70 },
          { x1: 36, y1: 70, x2: 36, y2: 50 },
          { x1: 36, y1: 50, x2: 38, y2: 36 },
          { x1: 38, y1: 36, x2: 40, y2: 28 },
          { x1: 40, y1: 28, x2: 48, y2: 22 },
          { x1: 48, y1: 22, x2: 60, y2: 18 },
          { x1: 60, y1: 18, x2: 140, y2: 18 },
          { x1: 140, y1: 18, x2: 210, y2: 18 },
          { x1: 210, y1: 18, x2: 280, y2: 18 }
        ],
        guides: [
          { x1: 116, y1: 340, x2: 92, y2: 276 },
          { x1: 92, y1: 276, x2: 92, y2: 200 },
          { x1: 92, y1: 200, x2: 98, y2: 161 },
          { x1: 98, y1: 161, x2: 92, y2: 100 },
          { x1: 92, y1: 100, x2: 92, y2: 78 },
          { x1: 92, y1: 78, x2: 100, y2: 68 },
          { x1: 100, y1: 68, x2: 120, y2: 66 },
          { x1: 120, y1: 66, x2: 150, y2: 70 },
          { x1: 150, y1: 70, x2: 180, y2: 74 },
          { x1: 180, y1: 74, x2: 220, y2: 76 },
          { x1: 220, y1: 76, x2: 255, y2: 78 },
          { x1: 255, y1: 78, x2: 280, y2: 80 }
                ]
      },
      rightRamp: {
        id: 'ramp-r',
        score: 750,
        cooldown: 0,
        entry: { x: 430, y: 335, w: 32, h: 26 },
        exit: { x: 430, y: 335 },
        boost: 0,
        segments: [
          { x1: 458, y1: 80, x2: 470, y2: 88 },
          { x1: 470, y1: 88, x2: 470, y2: 159 },
          { x1: 470, y1: 159, x2: 470, y2: 216 },
          { x1: 470, y1: 216, x2: 468, y2: 286 },
          { x1: 468, y1: 286, x2: 444, y2: 345 }
        ],
        guides: [
          { x1: 424, y1: 73, x2: 432, y2: 100 },
          { x1: 432, y1: 100, x2: 438, y2: 124 },
          { x1: 438, y1: 124, x2: 444, y2: 159 },
          { x1: 444, y1: 159, x2: 444, y2: 216 },
          { x1: 444, y1: 216, x2: 442, y2: 250 },
          { x1: 442, y1: 250, x2: 436, y2: 335 },
          { x1: 436, y1: 335, x2: 428, y2: 420 }
        ],
        // shoe5: rounded NE elbow continues the crown (478,18)-(502,26)-(518,42)-(524,64).
        mergeOuter: [
          { x1: 524, y1: 103, x2: 524, y2: 88 },
          { x1: 524, y1: 88, x2: 524, y2: 64 },
          { x1: 524, y1: 64, x2: 518, y2: 42 },
          { x1: 518, y1: 42, x2: 502, y2: 26 },
          { x1: 502, y1: 26, x2: 478, y2: 18 },
          { x1: 478, y1: 18, x2: 420, y2: 18 },
          { x1: 420, y1: 18, x2: 348, y2: 18 },
          { x1: 348, y1: 18, x2: 280, y2: 18 }
        ],
        // shoe5: inner parallels NE elbow after the plunge mouth. Join (280,80).
        mergeInner: [
          { x1: 470, y1: 88, x2: 458, y2: 80 },
          { x1: 458, y1: 80, x2: 442, y2: 76 },
          { x1: 442, y1: 76, x2: 424, y2: 73 },
          { x1: 424, y1: 73, x2: 390, y2: 76 },
          { x1: 390, y1: 76, x2: 350, y2: 78 },
          { x1: 350, y1: 78, x2: 315, y2: 79 },
          { x1: 315, y1: 79, x2: 280, y2: 80 }
                ]
      },
      leftFiller: {
        id: 'fill-l',
        theme: 'copper',
        // opt1: thin two-tube sausage. Peel off the rail so a real left outlane
        // stays open (dying ball at ~50,720 drains). Climb + bulge 122,712 kept.
        segments: [
          { x1: 36, y1: 568, x2: 48, y2: 588 },
          { x1: 48, y1: 588, x2: 60, y2: 628 },
          { x1: 60, y1: 628, x2: 68, y2: 668 },
          { x1: 68, y1: 668, x2: 80, y2: 704 },
          { x1: 80, y1: 704, x2: 96, y2: 732 },
          { x1: 96, y1: 732, x2: 104, y2: 744 }
        ],
        guides: [
          { x1: 36, y1: 568, x2: 48, y2: 578 },
          { x1: 48, y1: 578, x2: 64, y2: 598 },
          { x1: 64, y1: 598, x2: 76, y2: 628 },
          { x1: 76, y1: 628, x2: 80, y2: 652 },
          { x1: 80, y1: 652, x2: 82, y2: 670 },
          { x1: 82, y1: 670, x2: 122, y2: 712 },
          { x1: 122, y1: 712, x2: 112, y2: 728 },
          { x1: 112, y1: 728, x2: 104, y2: 744 }
        ]
      },
      rightFiller: {
        id: 'fill-r',
        theme: 'cyan',
        segments: [
          { x1: 472, y1: 538, x2: 472, y2: 590 },
          { x1: 472, y1: 590, x2: 472, y2: 640 },
          { x1: 472, y1: 640, x2: 472, y2: 690 },
          { x1: 472, y1: 690, x2: 472, y2: 720 },
          { x1: 472, y1: 720, x2: 472, y2: 744 }
        ],
        guides: [
          { x1: 472, y1: 538, x2: 462, y2: 546 },
          { x1: 462, y1: 546, x2: 450, y2: 558 },
          { x1: 450, y1: 558, x2: 438, y2: 570 },
          { x1: 438, y1: 570, x2: 428, y2: 580 },
          { x1: 428, y1: 580, x2: 418, y2: 622 },
          { x1: 418, y1: 622, x2: 414, y2: 662 },
          { x1: 414, y1: 662, x2: 420, y2: 698 },
          { x1: 420, y1: 698, x2: 428, y2: 714 },
          { x1: 428, y1: 714, x2: 442, y2: 728 },
          { x1: 442, y1: 728, x2: 458, y2: 738 },
          { x1: 458, y1: 738, x2: 472, y2: 744 }
        ]
      }
    };
  }

  /** Habitrail / orbit wall segments shared by createWalls. */
  function createHabitrailWalls() {
    var routes = createSideRoutes();
    var walls = [];
    function pushPath(segs, kind, flags) {
      if (!segs) return;
      var i;
      for (i = 0; i < segs.length; i++) {
        var w = {
          x1: segs[i].x1,
          y1: segs[i].y1,
          x2: segs[i].x2,
          y2: segs[i].y2,
          kind: kind
        };
        if (flags && flags.cyan) w.cyan = true;
        walls.push(w);
      }
    }
    function subdivideSeg(seg, maxLen) {
      var dx = seg.x2 - seg.x1;
      var dy = seg.y2 - seg.y1;
      var len = Math.sqrt(dx * dx + dy * dy);
      var n = Math.max(1, Math.ceil(len / Math.max(8, maxLen || 22)));
      var out = [];
      var i;
      for (i = 0; i < n; i++) {
        var t0 = i / n;
        var t1 = (i + 1) / n;
        out.push({
          x1: seg.x1 + dx * t0,
          y1: seg.y1 + dy * t0,
          x2: seg.x1 + dx * t1,
          y2: seg.y1 + dy * t1
        });
      }
      return out;
    }
    function pushInner(segs, flags) {
      if (!segs) return;
      var i;
      for (i = 0; i < segs.length; i++) {
        var seg = segs[i];
        var top = seg.y1 < 200 && seg.y2 < 200;
        var pieces = top ? subdivideSeg(seg, 20) : [seg];
        pushPath(pieces, top ? 'habitrail' : 'guide', flags);
      }
    }
    pushPath(routes.leftRamp.segments, 'habitrail', { cyan: true });
    pushInner(routes.leftRamp.guides, { cyan: true });
    pushPath(routes.rightRamp.segments, 'habitrail');
    pushInner(routes.rightRamp.guides);
    function pushMerge(segs, kind) {
      if (!segs) return;
      var m;
      for (m = 0; m < segs.length; m++) {
        var pieces = subdivideSeg(segs[m], 16);
        var p;
        for (p = 0; p < pieces.length; p++) {
          walls.push({
            x1: pieces[p].x1,
            y1: pieces[p].y1,
            x2: pieces[p].x2,
            y2: pieces[p].y2,
            kind: kind,
            merge: true
          });
        }
      }
    }
    pushMerge(routes.rightRamp.mergeOuter, 'habitrail');
    pushMerge(routes.rightRamp.mergeInner, 'habitrail');
    // merge3 closer: vertical launch join then rounded into the floor. No bird-beak.
    walls.push({ x1: LAUNCH_LANE_LEFT, y1: 103, x2: LAUNCH_LANE_LEFT, y2: 94, kind: 'habitrail', merge: true });
    walls.push({ x1: LAUNCH_LANE_LEFT, y1: 94, x2: LAUNCH_LANE_LEFT - 2, y2: 88, kind: 'habitrail', merge: true });
    function pushFiller(fill) {
      if (!fill) return;
      pushPath(fill.segments, 'filler');
      if (!fill.guides) return;
      var kept = [];
      var g;
      for (g = 0; g < fill.guides.length; g++) {
        if (!isSlingGuideSeg(fill.guides[g])) kept.push(fill.guides[g]);
      }
      pushPath(kept, 'filler');
    }
    pushFiller(routes.leftFiller);
    pushFiller(routes.rightFiller);
    return walls;
  }

  function createRollovers() {
    return [
      { id: 'lane-l', x1: 64, y1: 180, x2: 64, y2: 280, width: 18, score: 500, lit: false, occupied: false },
      // Playfield side of launch wall (not inside shooter lane)
      { id: 'lane-r', x1: LAUNCH_LANE_LEFT - 28, y1: 190, x2: LAUNCH_LANE_LEFT - 28, y2: 290, width: 18, score: 500, lit: false, occupied: false },
      // Mid-field rollover â€” shot path without bumper party
      { id: 'lane-mid', x1: 195, y1: 412, x2: 285, y2: 412, width: 16, score: 600, lit: false, occupied: false }
    ];
  }

  /**
   * Vertical dash lights centered in the launch/shooter lane.
   * Light when the ball travels over each segment (bottom â†’ top on launch).
   * Index 0 = nearest plunger; last = nearest wireform.
   */
  function createLaunchLaneDashes() {
    var dashes = [];
    var count = 15;
    var yBot = PLUNGER_REST_Y - 40;
    var yTop = LAUNCH_WIRE_Y1; // hall lights run from plunger berth up to the merge join
    var i;
    for (i = 0; i < count; i++) {
      var t = count === 1 ? 0 : i / (count - 1);
      dashes.push({
        id: 'll-dash-' + i,
        x: LAUNCH_LANE_X,
        y: yBot + (yTop - yBot) * t,
        w: 12,
        h: 22,
        lit: false,
        intensity: 0.26,
        flash: 0,
        occupied: false
      });
    }
    return dashes;
  }

  function resetLaunchDashSequence(state) {
    state.launchDashHoldT = 0;
    state.launchDashReversing = false;
    state.launchDashReverseI = -1;
    state.launchDashFadeT = 0;
  }

  function createKickers() {
    return [];
  }

  function createPosts() {
    // Circled glowing posts stay gone. Small pins at the new left-sausage rubber ends.
    return [
      { id: 'pin-ls-top', kind: 'pin', x: 48, y: 578, radius: 4.5, score: 0 },
      { id: 'pin-ls-bot', kind: 'pin', x: 64, y: 598, radius: 4.5, score: 0 }
    ];
  }

  function createSaucer() {
    return {
      x: 95,
      y: 520,
      radius: 15,
      score: 1500,
      holdSec: 1.2,
      holdT: 0,
      captured: false,
      cooldown: 0,
      lit: false,
      flash: 0
    };
  }

  function createSaucer2() {
    // Upper-right pocket just below the copper ramp (not in the shooter).
    return {
      x: 410,
      y: 148,
      radius: 15,
      score: 1500,
      holdSec: 1.2,
      holdT: 0,
      captured: false,
      cooldown: 0,
      lit: false,
      flash: 0
    };
  }

  function createSaucer3() {
    // Open pocket inside the cyan inner curve, above-right of the old (100,208) hole.
    return {
      x: 138,
      y: 168,
      radius: 15,
      score: 1500,
      holdSec: 1.2,
      holdT: 0,
      captured: false,
      cooldown: 0,
      lit: false,
      flash: 0
    };
  }


  function createBoinger(opts) {
    opts = opts || {};
    var phase = opts.phase || 'a';
    var invert = phase === 'b' || !!opts.invert;
    return {
      x: opts.x != null ? opts.x : BOINGER_X,
      y: opts.y != null ? opts.y : BOINGER_Y,
      radius: BOINGER_R,
      score: BOINGER_SCORE,
      phase: phase,
      invert: invert,
      theme: opts.theme || (phase === 'b' ? 'cyan' : 'copper'),
      cycleT: 0,
      up: invert ? false : true,
      pop: invert ? 0 : 1,
      cooldown: 0,
      flash: 0
    };
  }

  function createBoingers() {
    return [
      createBoinger({ x: BOINGER_X, y: BOINGER_Y, phase: 'a', theme: 'copper' }),
      createBoinger({ x: BOINGER_B_X, y: BOINGER_B_Y, phase: 'b', theme: 'cyan' }),
      createBoinger({ x: BOINGER_C_X, y: BOINGER_C_Y, phase: 'b', theme: 'cyan' })
    ];
  }

  function boingersOf(state) {
    if (state && state.boingers && state.boingers.length) return state.boingers;
    if (state && state.boinger) return [state.boinger];
    return [];
  }

  function stepOneBoinger(b, dt, wantUp) {
    if (!b) return;
    if (b.cooldown > 0) b.cooldown = Math.max(0, b.cooldown - dt);
    if (b.flash > 0) b.flash = Math.max(0, b.flash - dt);
    b.up = wantUp;
    var target = wantUp ? 1 : 0;
    if (BOINGER_POP_SEC <= 0) { b.pop = target; }
    else {
      var k = dt / BOINGER_POP_SEC;
      if (b.pop < target) b.pop = Math.min(target, b.pop + k);
      else if (b.pop > target) b.pop = Math.max(target, b.pop - k);
    }
  }

  function stepBoinger(state, dt) {
    if (!state) return;
    var period = BOINGER_UP_SEC + BOINGER_DOWN_SEC;
    state.boingerT = (state.boingerT || 0) + dt;
    if (state.boingerT >= period) state.boingerT -= period;
    if (state.boingerT < 0) state.boingerT = 0;
    var t = state.boingerT;
    var list = boingersOf(state);
    var i;
    for (i = 0; i < list.length; i++) {
      var b = list[i];
      var invert = b.phase === 'b' || !!b.invert;
      var wantUp = invert ? (t >= BOINGER_UP_SEC) : (t < BOINGER_UP_SEC);
      stepOneBoinger(b, dt, wantUp);
    }
    if (list.length) state.boinger = list[0];
  }

  function collideOneBoinger(state, b, ball) {
    if (!b || !ball) return;
    if (!b.up || b.pop < 0.55) return;
    var dx = ball.x - b.x;
    var dy = ball.y - b.y;
    var dist = vecLen(dx, dy);
    var minDist = ball.radius + b.radius;
    if (dist >= minDist || dist < 1e-6) return;
    var n = normalize(dx, dy);
    var sep = minDist + 2;
    ball.x = b.x + n.x * sep;
    ball.y = b.y + n.y * sep;
    var rv = reflectVelocity(ball.vx, ball.vy, n.x, n.y, BOINGER_RESTITUTION);
    ball.vx = rv.vx;
    ball.vy = rv.vy;
    applyBumperExitSpeed(ball, n.x, n.y, BOINGER_EXIT_SPEED);
    if (b.cooldown <= 0) {
      b.cooldown = HIT_COOLDOWN_BOINGER;
      b.flash = 0.28;
      awardScore(state, b.score, 'boinger', 'boinger', b.x, b.y);
    }
  }

  function collideBoinger(state) {
    var ball = state && state.ball;
    if (!ball) return;
    var list = boingersOf(state);
    var i;
    for (i = 0; i < list.length; i++) collideOneBoinger(state, list[i], ball);
  }

  function saucersOf(state) {
    var out = [];
    if (state && state.saucer) out.push(state.saucer);
    if (state && state.saucer2) out.push(state.saucer2);
    if (state && state.saucer3) out.push(state.saucer3);
    return out;
  }

  function saucerHoldingBall(state, ball) {
    var list = saucersOf(state);
    var i;
    for (i = 0; i < list.length; i++) {
      if (list[i].captured && list[i].heldBall === ball) return list[i];
    }
    return null;
  }

  function lightLockSaucers(state, on) {
    var list = saucersOf(state);
    var i;
    for (i = 0; i < list.length; i++) list[i].lit = !!on;
  }

  function anySaucerLit(state) {
    var list = saucersOf(state);
    var i;
    for (i = 0; i < list.length; i++) {
      if (list[i].lit) return true;
    }
    return false;
  }

  function createGateSpinner() {
    // Vertical spinner above the lower-left HOLE / left of the 120 saver, under the cyan mouth.
    return {
      x: 108,
      y: 416,
      h: 42,
      angle: 0,
      spinVel: 0,
      score: 200,
      hitCooldown: 0
    };
  }

  /** Ellipse arc as wall segments (canvas y+ down). a0â†’a1 radians. */
  function ellipseArcSegments(cx, cy, rx, ry, a0, a1, n, kind) {
    var segs = [];
    var i;
    var steps = Math.max(4, n | 0);
    for (i = 0; i < steps; i++) {
      var t0 = a0 + (a1 - a0) * (i / steps);
      var t1 = a0 + (a1 - a0) * ((i + 1) / steps);
      segs.push({
        x1: cx + rx * Math.cos(t0),
        y1: cy + ry * Math.sin(t0),
        x2: cx + rx * Math.cos(t1),
        y2: cy + ry * Math.sin(t1),
        kind: kind || 'rail',
        arc: true
      });
    }
    return segs;
  }

  /** Approx underside Y of top arch at playfield x (for clamps / unstick). */
  function topArchFloorY(x) {
    // Match createWalls top ellipse: cx=240, cy=76, rx=200, ry=50, upper half
    var cx = ARCH_CX;
    var cy = ARCH_CY;
    var rx = ARCH_RX;
    var ry = ARCH_RY;
    var dx = (x - cx) / rx;
    if (dx < -1) dx = -1;
    if (dx > 1) dx = 1;
    // Upper half of ellipse: y = cy - ry * sqrt(1 - dx^2)  (smaller y = higher on screen)
    return cy - ry * Math.sqrt(Math.max(0, 1 - dx * dx));
  }

  function createSpinner() {
    // Open inner field below the U â€” clear of lower apex (240,310) and left habitrail exit (~150,136)
    return { x: 200, y: 210, radius: 15, angle: 0, score: 200, spinVel: 0, hitCooldown: 0 };
  }

  function getRestDrainBounds() {
    var leftRest = createFlipper('left');
    var rightRest = createFlipper('right');
    var lt = flipperTip(leftRest);
    var rt = flipperTip(rightRest);
    return {
      // Slightly greedier drains (P1 outlane tension)
      centerLeft: lt.x + 2,
      centerRight: rt.x - 2,
      leftOutlaneRight: FLIPPER_INLANE_X + 8,
      rightOutlaneLeft: FLIPPER_RIGHT_PIVOT_X + 12,
      leftOutlaneLeft: 40,
      rightOutlaneRight: LAUNCH_LANE_LEFT
    };
  }

  function getDrainBounds(state) {
    return getRestDrainBounds();
  }

  function createWalls() {
    var bounds = getRestDrainBounds();
    var leftRest = createFlipper('left');
    var rightRest = createFlipper('right');
    var lt = flipperTip(leftRest);
    var rt = flipperTip(rightRest);
    var drainL = lt.x + 4;
    var drainR = rt.x - 4;
    var rightInlaneX = FLIPPER_RIGHT_PIVOT_X + 18;
    var chuteBottom = TABLE_H - 16;
    var walls = [];

    // Rounded top arch (ball rides underside â€” green path annotation)
    // Ellipse upper half: PI â†’ 2PI (left â†’ top center â†’ right)
    var archCx = ARCH_CX;
    var archCy = ARCH_CY;
    var archRx = ARCH_RX;
    var archRy = ARCH_RY;
    walls = walls.concat(ellipseArcSegments(archCx, archCy, archRx, archRy, Math.PI, Math.PI * 2, 18, 'rail'));

    // Left side rail from arch end down
    var archLeftX = archCx - archRx;
    var archLeftY = archCy;
    // orbit1: leftover (40,76)->(36,76) L-corner deleted. Cabinet vertical remains.
    walls.push({ x1: 36, y1: archLeftY, x2: 36, y2: TABLE_H - 80, kind: 'rail', cyan: true });

    // Outer right (cabinet edge past launch lane)
    walls.push({ x1: TABLE_W - 36, y1: LAUNCH_WIRE_Y1, x2: TABLE_W - 36, y2: TABLE_H - 80, kind: 'rail' });

    // Launch lane
    // orbit1: leftover wireform beak (392,103)->(360,80) deleted. Vertical shooter wall stays.
    walls.push({ x1: LAUNCH_LANE_LEFT, y1: LAUNCH_WIRE_Y1, x2: LAUNCH_LANE_LEFT, y2: TABLE_H - 80, rail: true, kind: 'lane' });

    // Merge lane (wireform + copper hull) replaces the old upper-right rail bulge.

    // Tiny deck stubs under pivots only â€” longer stubs shelved balls in the inlanes
    var leftPivot = FLIPPER_LEFT_PIVOT_X;
    var rightPivot = FLIPPER_RIGHT_PIVOT_X;
    walls.push({
      x1: leftPivot - 16,
      y1: FLIPPER_ROW_Y,
      x2: leftPivot + 16,
      y2: FLIPPER_ROW_Y,
      kind: 'deck'
    });
    walls.push({
      x1: rightPivot - 16,
      y1: FLIPPER_ROW_Y,
      x2: rightPivot + 16,
      y2: FLIPPER_ROW_Y,
      kind: 'deck'
    });
    // Drain chutes (minimum for drain holes) - skinny inlane plastics removed
    walls.push({ x1: FLIPPER_INLANE_X + 6, y1: FLIPPER_ROW_Y, x2: FLIPPER_INLANE_X + 6, y2: chuteBottom, kind: 'chute' });
    walls.push({ x1: rightInlaneX - 4, y1: FLIPPER_ROW_Y, x2: rightInlaneX - 4, y2: chuteBottom, kind: 'chute' });
    walls.push({ x1: bounds.centerLeft, y1: FLIPPER_ROW_Y, x2: bounds.centerLeft, y2: chuteBottom, kind: 'chute' });
    walls.push({ x1: bounds.centerRight, y1: FLIPPER_ROW_Y, x2: bounds.centerRight, y2: chuteBottom, kind: 'chute' });
    walls.push({ x1: bounds.rightOutlaneLeft, y1: FLIPPER_ROW_Y, x2: bounds.rightOutlaneLeft, y2: chuteBottom, kind: 'chute' });

    // Slide mouths dump into open playfield. No extra inlane plastics (red-X delete).

    // Real left orbit / right habitrail travel paths (replaces token diagonal kick chutes)
    walls = walls.concat(createHabitrailWalls());

    var triBody = createPulseTriangle();
    if (triBody && triBody.sides) {
      var ti;
      for (ti = 0; ti < triBody.sides.length; ti++) {
        var ts = triBody.sides[ti];
        walls.push({
          x1: ts.x1,
          y1: ts.y1,
          x2: ts.x2,
          y2: ts.y2,
          kind: 'tri-solid',
          nx: ts.nx,
          ny: ts.ny
        });
      }
    }

    // Chrome safety-cage bars — short steel outlane rails just above the
    // flipper row, framing the timed cyan boingers (VOID PULSE annotation).
    // orbit1: cages still guard the lower boingers, but no longer form a V
    // with the sausage tips (gap >=28 or flush).
    // opt1: frame C / sausage nose, do not bar the left outlane slot.
    walls.push({
      x1: 108,
      y1: 728,
      x2: 136,
      y2: 734,
      kind: 'cage',
      id: 'cage-l',
      chrome: true
    });


    return walls;
  }

  function createInitialState() {
    var boingers = createBoingers();
    return {
      tableW: TABLE_W,
      tableH: TABLE_H,
      ball: {
        x: LAUNCH_LANE_X,
        y: PLUNGER_REST_Y,
        vx: 0,
        vy: 0,
        radius: BALL_RADIUS,
        inPlay: false
      },
      flippers: [createFlipper('left'), createFlipper('right'), createUpperRightFlipper()],
      bumpers: createBumpers(),
      slingshots: createSlingshots(),
      pulseTriangle: createPulseTriangle(),
      targets: createTargets(),
      dropTargets: createDropTargets(),
      sideRoutes: createSideRoutes(),
      rollovers: createRollovers(),
      launchLaneDashes: createLaunchLaneDashes(),
      launchDashHoldT: 0,
      launchDashReversing: false,
      launchDashReverseI: -1,
      launchDashFadeT: 0,
      launchDashIdleT: 0,
      kickers: createKickers(),
      posts: createPosts(),
      spinner: createSpinner(),
      saucer: createSaucer(),
      saucer2: createSaucer2(),
      saucer3: createSaucer3(),
      boingerT: 0,
      boingers: boingers,
      boinger: boingers[0],
      gateSpinner: createGateSpinner(),
      walls: createWalls(),
      lockCount: 0,
      multiball: false,
      multiballBanner: null,
      multiballBannerLife: 0,
      balls: null,
      score: 0,
      ballsRemaining: 3,
      launchPower: 0,
      launchCharging: false,
      phase: 'ready',
      exitedLaunchLane: false,
      skillShotWindow: false,
      skillShotGrade: null,
      skillShotBanner: null,
      skillShotBannerLife: 0,
      launchTick: 0,
      launchRailT: null,
      activeLaunchPower: 0,
      plungerFollowFrames: 0,
      plungerFollowPower: 0,
      multiplier: 1,
      comboCount: 0,
      comboTimer: 0,
      bonusBank: 0,
      jackpotLit: false,
      lastHitBumper: null,
      lastHitType: null,
      lastHitId: null,
      lastScorePopup: null,
      drainEvents: 0,
      drainFlash: 0,
      ballSaveArmed: false,
      ballSaveUsed: false,
      ballSaveTimer: 0,
      ballSaveFlash: 0,
      launchDashRewarded: false,
      themeId: 'void-pulse',
      themeFlash: 0,
      rushTimer: 0,
      rushName: null,
      rushMult: 1,
      eobTimer: 0,
      eobDuration: EOB_DURATION,
      eobBreakdown: null,
      eobTotal: 0,
      eobDisplay: 0,
      eobStep: 0,
      tiltWarnings: 0,
      tiltCooldown: 0
    };
  }

  function flipperTip(flipper) {
    return {
      x: flipper.pivotX + Math.cos(flipper.angle) * flipper.length,
      y: flipper.pivotY + Math.sin(flipper.angle) * flipper.length
    };
  }

  function ballSpeed(ball) {
    return vecLen(ball.vx, ball.vy);
  }

  function awardScore(state, base, hitType, hitId, popupX, popupY) {
    if (state.comboTimer > 0) {
      state.comboCount += 1;
    } else {
      state.comboCount = 1;
    }
    state.comboTimer = COMBO_WINDOW;

    var comboBoost = 1 + Math.min(state.comboCount - 1, 8) * 0.12;
    var rush = state.rushTimer > 0 ? (state.rushMult || RUSH_SCORE_MULT) : 1;
    var points = Math.round(base * state.multiplier * comboBoost * rush);
    state.score += points;
    state.bonusBank += Math.floor(points * 0.04);

    if (state.comboCount >= 4 && state.multiplier < MAX_MULTIPLIER) {
      state.multiplier += 1;
      state.comboCount = 0;
    }

    state.lastHitType = hitType;
    state.lastHitId = hitId;

    // High-combo: merge rapid awards into one floating total
    var pop = state.lastScorePopup;
    var canMerge =
      state.comboCount >= POPUP_MERGE_COMBO &&
      pop &&
      pop.life > POPUP_MERGE_LIFE_MIN &&
      hitType !== 'skillshot' &&
      hitType !== 'skillshot-near' &&
      hitType !== 'jackpot' &&
      hitType !== 'ballsave' &&
      hitType !== 'lanedash';
    if (canMerge) {
      pop.points += points;
      pop.life = Math.min(1.45, pop.life + 0.28);
      pop.x = popupX != null ? popupX : pop.x;
      pop.y = popupY != null ? popupY : pop.y;
      pop.merged = true;
      pop.type = 'combo';
    } else {
      state.lastScorePopup = {
        points: points,
        x: popupX,
        y: popupY,
        life: 1.2,
        type: hitType,
        merged: false
      };
    }
    return points;
  }

  /**
   * Grade skill shot from ball distance to top bumper.
   * center = tight hit; near = graze ring outside center.
   */
  function gradeSkillShot(ball, topBumper) {
    if (!ball || !topBumper) return null;
    var d = vecLen(ball.x - topBumper.x, ball.y - topBumper.y);
    var touch = topBumper.radius + ball.radius;
    if (d < touch + 10) {
      return {
        grade: 'center',
        bonus: SKILL_SHOT_CENTER_BONUS,
        label: 'SKILL SHOT CENTER!',
        hitType: 'skillshot'
      };
    }
    if (d < touch + 32) {
      return {
        grade: 'near',
        bonus: SKILL_SHOT_NEAR_BONUS,
        label: 'SKILL SHOT NEAR!',
        hitType: 'skillshot-near'
      };
    }
    return null;
  }

  function applySkillShot(state, gradeInfo) {
    if (!gradeInfo) return false;
    var top = state.bumpers[0];
    awardScore(
      state,
      gradeInfo.bonus,
      gradeInfo.hitType,
      gradeInfo.grade,
      top ? top.x : TABLE_W * 0.5,
      top ? top.y : 200
    );
    state.skillShotWindow = false;
    state.skillShotGrade = gradeInfo.grade;
    state.skillShotBanner = gradeInfo.label;
    state.skillShotBannerLife = 2.2;
    if (gradeInfo.grade === 'center') {
      state.multiplier = Math.min(MAX_MULTIPLIER, state.multiplier + 1);
      // Explicit arm: CENTER skill shot only â€” one timed save, then drain sticks
      state.ballSaveArmed = true;
      state.ballSaveUsed = false;
      state.ballSaveTimer = BALL_SAVE_DURATION;
    }
    // Near grade: points/banner only â€” does NOT arm ball-save
    return true;
  }

  function decayCombo(state, dt) {
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) {
        state.comboTimer = 0;
        state.comboCount = 0;
      }
    }
    if (state.lastScorePopup && state.lastScorePopup.life > 0) {
      state.lastScorePopup.life -= dt;
    }
    if (state.skillShotBannerLife > 0) {
      state.skillShotBannerLife -= dt;
      if (state.skillShotBannerLife <= 0) {
        state.skillShotBannerLife = 0;
        state.skillShotBanner = null;
      }
    }
    if (state.drainFlash > 0) {
      state.drainFlash = Math.max(0, state.drainFlash - dt);
    }
    if (state.ballSaveFlash > 0) {
      state.ballSaveFlash = Math.max(0, state.ballSaveFlash - dt);
    }
    if (state.ballSaveArmed && !state.ballSaveUsed && state.ballSaveTimer > 0) {
      state.ballSaveTimer = Math.max(0, state.ballSaveTimer - dt);
      if (state.ballSaveTimer <= 0) {
        state.ballSaveArmed = false;
        state.ballSaveTimer = 0;
      }
    }
    if (state.rushTimer > 0) {
      state.rushTimer = Math.max(0, state.rushTimer - dt);
      if (state.rushTimer <= 0) {
        state.rushTimer = 0;
        state.rushName = null;
        state.rushMult = 1;
        resetDropTargets(state);
      }
    }
    state.targets.forEach(function (t) {
      if (t.flash > 0) t.flash -= dt;
    });
    if (state.dropTargets) {
      state.dropTargets.forEach(function (d) {
        if (d.flash > 0) d.flash -= dt;
      });
    }
    if (state.sideRoutes) {
      if (state.sideRoutes.leftCaptive && state.sideRoutes.leftCaptive.cooldown > 0) {
        state.sideRoutes.leftCaptive.cooldown -= dt;
      }
      if (state.sideRoutes.leftRamp && state.sideRoutes.leftRamp.cooldown > 0) {
        state.sideRoutes.leftRamp.cooldown -= dt;
      }
      if (state.sideRoutes.rightRamp && state.sideRoutes.rightRamp.cooldown > 0) {
        state.sideRoutes.rightRamp.cooldown -= dt;
      }
    }
    if (state.spinner && state.spinner.hitCooldown > 0) {
      state.spinner.hitCooldown -= dt;
    }
    if (state.gateSpinner && state.gateSpinner.hitCooldown > 0) {
      state.gateSpinner.hitCooldown -= dt;
    }
    var holes = saucersOf(state);
    var hi;
    for (hi = 0; hi < holes.length; hi++) {
      if (holes[hi].cooldown > 0) holes[hi].cooldown -= dt;
      if (holes[hi].flash > 0) holes[hi].flash = Math.max(0, holes[hi].flash - dt);
    }
    if (state.multiballBannerLife > 0) {
      state.multiballBannerLife -= dt;
      if (state.multiballBannerLife <= 0) {
        state.multiballBannerLife = 0;
        state.multiballBanner = null;
      }
    }
    state.slingshots.forEach(function (s) {
      if (s.cooldown > 0) s.cooldown -= dt;
    });
    state.bumpers.forEach(function (b) {
      if (b.hitCooldown > 0) b.hitCooldown -= dt;
    });
    if (state.tiltCooldown > 0) {
      state.tiltCooldown -= dt;
      if (state.tiltCooldown < 0) state.tiltCooldown = 0;
    }
    if (state.skillShotWindow) {
      state.launchTick += dt;
      if (state.launchTick > 1.8) state.skillShotWindow = false;
    }
  }

  function updateFlippers(state, dt) {
    state.flippers.forEach(function (f) {
      if (f.sinceLastPress == null) f.sinceLastPress = 99;
        f.sinceLastPress += dt;
      if (f.chargeLeft > 0) {
        f.chargeLeft = Math.max(0, f.chargeLeft - dt);
        var u = 1 - f.chargeLeft / FLIPPER_CHARGE_SEC;
        var hz = FLIPPER_GLOW_HZ_START + (FLIPPER_GLOW_HZ_END - FLIPPER_GLOW_HZ_START) * u;
        f.glowPhase = (f.glowPhase || 0) + hz * dt;
        f.tapBoost = true;
      } else {
        f.tapBoost = false;
      }
      if (f.active) {
        f.pressAge = (f.pressAge || 0) + dt;
      }
      var prevAngle = f.angle;
      f.targetAngle = f.active ? f.activeAngle : f.restAngle;
      var diff = f.targetAngle - f.angle;
      var maxStep = FLIPPER_SPEED * dt;
      if (Math.abs(diff) <= maxStep) {
        f.angle = f.targetAngle;
      } else {
        f.angle += Math.sign(diff) * maxStep;
      }
      f.omega = dt > 1e-8 ? (f.angle - prevAngle) / dt : 0;
    });
  }

  /** True while the bat is sweeping toward the raised (active) pose. */
  function flipperIsSweeping(flipper) {
    var towardActive = Math.sign(flipper.activeAngle - flipper.restAngle);
    if (towardActive === 0) return false;
    return Math.abs(flipper.omega) > FLIPPER_OMEGA_DEAD && Math.sign(flipper.omega) === towardActive;
  }

  function reflectVelocity(vx, vy, nx, ny, restitution) {
    var vn = dot(vx, vy, nx, ny);
    if (vn >= 0) return { vx: vx, vy: vy };
    var bounce = -(1 + restitution) * vn;
    return {
      vx: vx + bounce * nx,
      vy: vy + bounce * ny
    };
  }

  function isBallInLaunchLane(state) {
    var ball = state.ball;
    if (ball.x + ball.radius <= LAUNCH_LANE_LEFT - 4) return false;
    if (ball.y <= LAUNCH_WIRE_Y2 - 24) return false;
    if (state.exitedLaunchLane && ball.y > FLIPPER_ROW_Y - 36) return false;
    return true;
  }

  function ejectFromShooterLaneApron(state) {
    var ball = state.ball;
    if (skipBallAssist(state, state.ball)) return;
    if (ball.y < LAUNCH_WIRE_Y1 + 48 || state.skillShotWindow) return;
    var r = ball.radius;
    ball.x = LAUNCH_LANE_LEFT - r - 2;
    ball.vx = -Math.max(Math.abs(ball.vx), 220);
    // Never loft when already at/below flipper line or draining
    if (ball.y >= FLIPPER_ROW_Y - 8 || apronAssistsBlocked(state)) {
      if (ball.vy < 0) ball.vy = Math.abs(ball.vy) * 0.25;
    } else {
      ball.vy = Math.min(ball.vy, -120);
    }
  }

  function canChargePlunger(state) {
    return countLiveBalls(state) === 0 && !state.ball.inPlay && state.ballsRemaining > 0 && state.phase !== 'game_over' && state.phase !== 'eob_bonus';
  }

  function wireformTangent() {
    var len = vecLen(WIRE_FORM_DX, WIRE_FORM_DY);
    if (len < 1e-6) return { ux: -1, uy: 0, px: 0, py: 1, len: 1 };
    return {
      ux: WIRE_FORM_DX / len,
      uy: WIRE_FORM_DY / len,
      px: -WIRE_FORM_DY / len,
      py: WIRE_FORM_DX / len,
      len: len
    };
  }

  function wireformProgress(ball) {
    var tan = wireformTangent();
    var relX = ball.x - WIRE_FORM_X1;
    var relY = ball.y - WIRE_FORM_Y1;
    return clamp((relX * WIRE_FORM_DX + relY * WIRE_FORM_DY) / (tan.len * tan.len), 0, 1);
  }

  function releaseFromWireform(state, speed) {
    var ball = state.ball;
    state.exitedLaunchLane = true;
    state.skillShotWindow = true;
    state.launchTick = 0;
    if (state.launchRailT == null) state.launchRailT = 0;
    var dumpSlide = (state.activeLaunchPower || 0) < 950;
    var targetX = dumpSlide ? 430 : 410;
    var targetY = dumpSlide ? 160 : 40;
    state.activeHabitrail = 'ramp-r';
    var tx = targetX - ball.x;
    var ty = targetY - ball.y;
    var dist = vecLen(tx, ty);
    var curSp = vecLen(ball.vx, ball.vy);
    var exitSpeed = Math.max(curSp, speed, 380);
    if (dist > 1e-6) {
      var ax = tx / dist;
      var ay = ty / dist;
      ball.vx = ball.vx * 0.42 + ax * exitSpeed * 0.58;
      ball.vy = ball.vy * 0.42 + ay * exitSpeed * 0.58;
    } else {
      ball.vx = -Math.max(Math.abs(ball.vx), exitSpeed * 0.7);
      ball.vy = Math.min(ball.vy, -exitSpeed * 0.35);
    }
  }

  var MIN_RAIL_LAUNCH_U = 0.12;
  var RIDE_MERGE_U = 0.42;
  var RIDE_FLOOR_U = 0.78;

  function launchRailBoost(state) {
    var power = state.activeLaunchPower || 0;
    return clamp(power / 820, 0, 1.15);
  }

  function launchChargeU(state) {
    if (state && state.launchChargeU != null) return clamp(state.launchChargeU, 0, 1);
    var p = state && state.activeLaunchPower;
    if (p == null) return 0;
    return clamp((p - MIN_LAUNCH_POWER) / (MAX_LAUNCH_POWER - MIN_LAUNCH_POWER), 0, 1);
  }

  function guideShooterLane(state, dt) {
    if (state.exitedLaunchLane) return;
    var ball = state.ball;
    var r = ball.radius;
    if (ball.y <= LAUNCH_WIRE_Y2 - 24) return;
    var u = launchChargeU(state);
    var boost = u;
    var inLaneBoost = u >= MIN_RAIL_LAUNCH_U;
    var canRideRail = u >= RIDE_MERGE_U;
    var canRideFloor = u >= RIDE_FLOOR_U;

    if (ball.vy > 160 && ball.y > PLUNGER_REST_Y - 50) return;

    // Teleport guard: only refuse the wire snap from cyan / lower playfield.
    // Do not mark exited while the snap is still on the merge (x~329-397) —
    // medium plunge tests assert x < 352 at the moment the flag flips.
    if (ball.x < 400) {
      state.exitedLaunchLane = true;
      state.skillShotWindow = true;
      state.launchTick = 0;
      state.launchRailT = null;
      return;
    }
    // On the merge / U floor the ball has left the vertical shooter.
    if (ball.y < 100 && ball.x < LAUNCH_LANE_LEFT - 10 && ball.x > 100) {
      state.exitedLaunchLane = true;
      state.skillShotWindow = true;
      if (!state.activeHabitrail) state.activeHabitrail = 'ramp-r';
    }
    if (ball.y > 140 && ball.x < LAUNCH_LANE_LEFT) {
      state.exitedLaunchLane = true;
      if (ball.x < 430) state.launchRailT = null;
      if (ball.y > 200) state.activeHabitrail = null;
      return;
    }
    if (ball.y > 500 && ball.x < LAUNCH_LANE_LEFT) {
      state.exitedLaunchLane = true;
      state.launchRailT = null;
      state.activeHabitrail = null;
      return;
    }

    if (ball.y <= LAUNCH_WIRE_Y1 && state.launchRailT == null) state.launchRailT = 0;
    var atMerge = ball.y <= LAUNCH_WIRE_Y1 || state.launchRailT != null;

    if (!atMerge) {
      if (ball.x + r < LAUNCH_LANE_LEFT - 6) return;
      if (ball.x - r < LAUNCH_LANE_LEFT) {
        ball.x = LAUNCH_LANE_LEFT + r;
        if (ball.vx < 0) ball.vx *= -0.08;
      }
      if (ball.x + r > LAUNCH_LANE_RIGHT) {
        ball.x = LAUNCH_LANE_RIGHT - r;
        if (ball.vx > 0) ball.vx *= -0.08;
      }
      if (ball.vx < 0) ball.vx *= 0.55;
      if (ball.vx < -8) ball.vx = -8;
      var laneCenter = (LAUNCH_LANE_LEFT + LAUNCH_LANE_RIGHT) * 0.5;
      ball.vx += (laneCenter - ball.x) * 5.5 * dt;
      if (inLaneBoost) {
        var minRise = 420 + u * 500;
        if (ball.vy > -minRise) ball.vy = -minRise;
      }
      return;
    }

    if (!canRideRail) {
      // Tap / low charge: pop out of the shooter onto the playfield, then die before the U.
      if (atMerge || ball.y <= LAUNCH_WIRE_Y1 + 40) {
        state.exitedLaunchLane = true;
        state.skillShotWindow = true;
        state.launchRailT = null;
        state.activeHabitrail = "ramp-r";
        if (ball.x > 456) ball.x = 452;
        if (ball.vx > -40) ball.vx = -60;
        ball.vy = Math.max(ball.vy, 140);
      }
      return;
    }

    if (!canRideFloor) {
      // Mid charge: dump onto the right copper slide, not the U floor.
      if (ball.vx > -140) ball.vx = -140;
      if (ball.y < 150) ball.vy = Math.max(ball.vy, 90);
      if (ball.x > LAUNCH_LANE_LEFT - 4 && ball.y > 100 && ball.y < 220) {
        ball.x = LAUNCH_LANE_LEFT - r - 8;
        if (ball.vx > -80) ball.vx = -160;
        state.exitedLaunchLane = true;
        state.skillShotWindow = true;
        state.launchRailT = null;
      }
    }

    // Roll onto the merge. No ball.x/y rewrite onto the short wire.
    if (ball.x + r > LAUNCH_LANE_RIGHT) {
      ball.x = LAUNCH_LANE_RIGHT - r;
      if (ball.vx > 0) ball.vx *= -0.08;
    }
    var cur = vecLen(ball.vx, ball.vy);
    var assist = canRideFloor ? Math.max(cur, 360 + boost * 220) : Math.max(cur * 0.55, 160 + boost * 90);
    var mx = (canRideFloor ? (LAUNCH_LANE_LEFT - 20) : 438) - ball.x;
    var my = (canRideFloor ? 80 : 158) - ball.y;
    var md = vecLen(mx, my);
    if (md > 1e-6) {
      var blend = Math.min(0.55, 9.5 * dt);
      ball.vx += ((mx / md) * assist - ball.vx) * blend;
      ball.vy += ((my / md) * assist - ball.vy) * blend;
    }
    if (ball.x > LAUNCH_LANE_LEFT - 6 && ball.y < 80) {
      if (ball.vy < 0) ball.vy *= 0.25;
      ball.vy += 240 * dt;
    }
    if (ball.x < LAUNCH_LANE_LEFT - 6 && ball.y >= 66 && ball.y <= 102) {
      releaseFromWireform(state, assist);
    }
  }

  function resetDropTargets(state) {
    state.dropTargets = createDropTargets();
  }

  function resetBallProgress(state) {
    state.targets = createTargets();
    state.dropTargets = createDropTargets();
    state.sideRoutes = createSideRoutes();
    state.rollovers = createRollovers();
    state.posts = createPosts();
    state.launchLaneDashes = createLaunchLaneDashes();
    resetLaunchDashSequence(state);
    state.launchDashRewarded = false;
    state.jackpotLit = false;
    state.skillShotWindow = false;
    state.skillShotGrade = null;
    state.comboCount = 0;
    state.comboTimer = 0;
    // rush continues across ball unless expired
    if (state.spinner) state.spinner.hitCooldown = 0;
    state.slingshots.forEach(function (s) { s.cooldown = 0; });
    if (state.bumpers) {
      state.bumpers.forEach(function (b) {
        if (!b.saver) b.hit = false;
        b.hitCooldown = 0;
      });
    }
  }

  function setThemeId(state, id) {
    if (id) state.themeId = String(id);
    return state;
  }

  function startRushMode(state) {
    if (state.rushTimer > 0) return false;
    var tid = (state.themeId || 'void-pulse').toLowerCase();
    state.rushTimer = RUSH_MODE_DURATION;
    state.rushMult = RUSH_SCORE_MULT;
    state.rushName = tid.indexOf('ember') >= 0 ? 'EMBER RUSH' : 'VOID RUSH';
    state.lastHitType = 'rushstart';
    state.lastHitId = state.rushName;
    state.lastScorePopup = {
      points: 0,
      x: TABLE_W * 0.5,
      y: TABLE_H * 0.28,
      life: 1.4,
      type: 'rushstart',
      merged: false
    };
    return true;
  }

  function allScoringBumpersHit(bumpers) {
    if (!bumpers || !bumpers.length) return false;
    var i;
    var seen = false;
    for (i = 0; i < bumpers.length; i++) {
      if (bumpers[i].saver || bumpers[i].rubber) continue;
      seen = true;
      if (!bumpers[i].hit) return false;
    }
    return seen;
  }

  function allDropsDown(drops) {
    if (!drops || !drops.length) return false;
    var i;
    for (i = 0; i < drops.length; i++) {
      if (!drops[i].down) return false;
    }
    return true;
  }

  function resolveDropTargetCollisions(state) {
    if (!state.dropTargets || !state.ball.inPlay || !state.exitedLaunchLane) return;
    var ball = state.ball;
    state.dropTargets.forEach(function (drop) {
      if (drop.down) return;
      var halfW = drop.w * 0.5;
      var halfH = drop.h * 0.5;
      var closestX = clamp(ball.x, drop.x - halfW, drop.x + halfW);
      var closestY = clamp(ball.y, drop.y - halfH, drop.y + halfH);
      var dx = ball.x - closestX;
      var dy = ball.y - closestY;
      var dist = vecLen(dx, dy);
      if (dist < ball.radius + 1) {
        if (!drop.occupied) {
          drop.occupied = true;
          drop.down = true;
          drop.flash = 0.35;
          var n = dist > 1e-6 ? normalize(dx, dy) : { x: 0, y: -1 };
          ball.x = closestX + n.x * (ball.radius + 2);
          ball.y = closestY + n.y * (ball.radius + 2);
          ball.vx += n.x * 80;
          ball.vy += n.y * 120 - 40;
          awardScore(state, drop.score, 'drop', drop.id, drop.x, drop.y);
          if (allDropsDown(state.dropTargets)) {
            startRushMode(state);
          }
        }
      } else {
        drop.occupied = false;
      }
    });
  }

  function pointInRouteEntry(ball, entry) {
    if (!entry) return false;
    var hw = (entry.w || 30) * 0.5;
    var hh = (entry.h || 36) * 0.5;
    return (
      ball.x > entry.x - hw &&
      ball.x < entry.x + hw &&
      ball.y > entry.y - hh &&
      ball.y < entry.y + hh
    );
  }

  /** Along-path boost when entering a habitrail from below (carry through, not crawl). */
  /** Award when the ball actually enters a mouth going up. Keep its momentum. */
  function tryHabitrailEntry(state, route, towardCenterSign) {
    if (!route || route.cooldown > 0) return false;
    var ball = state.ball;
    if (!pointInRouteEntry(ball, route.entry)) return false;
    if (ball.vy > -20) return false;
    // Already in/near the tube — do not steal bumper / mid-field shots.
    if (routeChannelDist(ball, route) > ball.radius + 16) return false;
    route.cooldown = SIDE_ROUTE_COOLDOWN * 1.6;
    state.activeHabitrail = route.id;
    if (state.sideRoutes) {
      var other = route.id === 'ramp-l' ? state.sideRoutes.rightRamp : state.sideRoutes.leftRamp;
      if (other) other.cooldown = Math.max(other.cooldown || 0, SIDE_ROUTE_COOLDOWN);
    }
    awardScore(state, route.score, 'route', route.id, ball.x, ball.y);
    if (route.id === 'ramp-l') {
      // Credit lock at the cyan mouth. Ball keeps rolling — no saucer teleport.
      awardLock(state, { keepBall: true, x: route.entry.x, y: route.entry.y });
    }
    return true;
  }

  function horseshoeTravelSegs(leftRamp, rightRamp) {
    var segs = [];
    if (leftRamp && leftRamp.segments) {
      var i;
      for (i = 0; i < leftRamp.segments.length; i++) segs.push(leftRamp.segments[i]);
    }
    function addUnique(list) {
      if (!list) return;
      var j;
      for (j = 0; j < list.length; j++) {
        var s = list[j];
        var dup = false;
        var k;
        for (k = 0; k < segs.length; k++) {
          var t = segs[k];
          if (t.x1 === s.x1 && t.y1 === s.y1 && t.x2 === s.x2 && t.y2 === s.y2) {
            dup = true;
            break;
          }
        }
        if (!dup) segs.push(s);
      }
    }
    addUnique(rightRamp && rightRamp.segments);
    addUnique(rightRamp && rightRamp.mergeOuter);
    return segs;
  }

  function peelHabitrailDump(state, route) {
    if (!route || !state.sideRoutes) return false;
    var ball = state.ball;
    var other = route.id === 'ramp-l' ? state.sideRoutes.rightRamp : state.sideRoutes.leftRamp;
    var mouth = other && other.entry;
    if (!mouth || !pointInRouteEntry(ball, mouth)) return false;
    if (ball.y < 300) return false;
    // Leaving the mouth — drop the rider flag only. No teleport / velocity rewrite.
    state.activeHabitrail = null;
    if (state.sideRoutes && state.sideRoutes.leftRamp) {
      state.sideRoutes.leftRamp.cooldown = Math.max(state.sideRoutes.leftRamp.cooldown || 0, SIDE_ROUTE_COOLDOWN);
    }
    if (state.sideRoutes && state.sideRoutes.rightRamp) {
      state.sideRoutes.rightRamp.cooldown = Math.max(state.sideRoutes.rightRamp.cooldown || 0, SIDE_ROUTE_COOLDOWN);
    }
    return true;
  }

  function allLiveBalls(state) {
    var seen = [];
    function add(b) {
      if (b && b.inPlay && seen.indexOf(b) < 0) seen.push(b);
    }
    add(state && state.ball);
    if (state && state.balls) {
      var i;
      for (i = 0; i < state.balls.length; i++) add(state.balls[i]);
    }
    return seen;
  }


  function skipBallAssist(state, ball) {
    var b = ball || (state && state.ball);
    if (!b) return true;
    if (!b.inPlay) return true;
    if (b.y > FLIPPER_ROW_Y + 20) return true;
    if (b.y > 780) return true;
    return false;
  }

  function triangle500Wedged(state, ball) {
    var tri = state && state.pulseTriangle;
    var rubber = copperRubberMid(state);
    if (!tri || !tri.verts || !rubber || !ball) return false;
    var bot = Math.max(tri.verts[0].y, tri.verts[1].y, tri.verts[2].y);
    var left = Math.min(tri.verts[0].x, tri.verts[1].x, tri.verts[2].x);
    var right = Math.max(tri.verts[0].x, tri.verts[1].x, tri.verts[2].x);
    var inX = ball.x > left - 8 && ball.x < right + 8;
    var nearTri = ball.y - (ball.radius || BALL_RADIUS) < bot + 6;
    var nearRub = vecLen(ball.x - rubber.x, ball.y - rubber.y) < rubber.radius + (ball.radius || BALL_RADIUS) + 6;
    var inSlot = ball.y > bot - 4 && ball.y < rubber.y + 4;
    var inGap = inX && ball.y > bot - 6 && ball.y < rubber.y - 2;
    if (inGap && vecLen(ball.vx, ball.vy) < 130) return true;
    return !!(inX && inSlot && nearTri && nearRub);
  }

  function lodgeFarming(state, ball) {
    if (!ball) return false;
    if (sausageFarmPocket(state, ball)) return true;
    if (horseshoeFarmPocket(state, ball) && vecLen(ball.vx, ball.vy) < 70) return true;
    if (state && ballInsideTriangle(ball, state.pulseTriangle)) return true;
    if ((ball._copperStuck || 0) >= 4) return true;
    if ((ball._sausageStuck || 0) >= 4) return true;
    if ((ball._triPinchStuck || 0) >= 3) return true;
    if ((ball._topLeftStuck || 0) >= 4) return true;
    if (triangle500Wedged(state, ball)) return true;
    if (ball.x < 120 && ball.y < 130 && ball.y > 28 && vecLen(ball.vx, ball.vy) < 80) return true;
    return false;
  }

  function unstickOneTriangleInterior(state, ball, tri) {
    if (!triangleIsUp(tri)) return false;
    if (skipBallAssist(state, ball)) return false;
    if (!ball || !ball.inPlay || !tri) return false;
    if (!ballInsideTriangle(ball, tri)) {
      ball._triInsideStuck = 0;
      return false;
    }
    ball._triInsideStuck = (ball._triInsideStuck || 0) + 1;
    var cx = (tri.verts[0].x + tri.verts[1].x + tri.verts[2].x) / 3;
    var cy = (tri.verts[0].y + tri.verts[1].y + tri.verts[2].y) / 3;
    var bot = Math.max(tri.verts[0].y, tri.verts[1].y, tri.verts[2].y);
    var best = null;
    var i;
    for (i = 0; i < tri.sides.length; i++) {
      var side = tri.sides[i];
      var near = nearestPointOnSegments(ball.x, ball.y, [side]);
      if (near && (!best || near.dist < best.dist)) {
        best = { dist: near.dist, side: side, x: near.x, y: near.y };
      }
    }
    var nx;
    var ny;
    if (best) {
      nx = best.side.nx;
      ny = best.side.ny;
    } else {
      nx = ball.x - cx;
      ny = ball.y - cy;
    }
    // Never eject down through the flat bottom into the 500 / drain.
    if (ny > 0.18) {
      nx = ball.x >= cx ? 0.94 : -0.94;
      ny = -0.34;
    }
    var nlen = vecLen(nx, ny) || 1;
    nx /= nlen;
    ny /= nlen;
    var r = ball.radius || BALL_RADIUS;
    if (best) {
      ball.x = best.x + nx * (r + 6);
      ball.y = best.y + ny * (r + 6);
    } else {
      ball.x = cx + nx * (r + 16);
      ball.y = cy + ny * (r + 16);
    }
    if (ball.y > bot - 4) {
      ball.y = bot - (r + 8);
      if (Math.abs(ball.x - cx) < r + 4) {
        ball.x = cx + (ball.x >= cx ? 1 : -1) * (r + 20);
      }
    }
    var sp = vecLen(ball.vx, ball.vy);
    var keep = Math.max(sp, 160);
    ball.vx = ball.vx * 0.12 + nx * keep * 0.88;
    ball.vy = ball.vy * 0.12 + ny * keep * 0.88;
    if (vecLen(ball.vx, ball.vy) < 120) {
      ball.vx += nx * 120;
      ball.vy += ny * 120;
    }
    if (ball.vy > 30) ball.vy = -Math.abs(ny) * 140 - 40;
    return true;
  }

  function unstickTriangleInterior(state) {
    var tri = state && state.pulseTriangle;
    if (!tri) return;
    var balls = allLiveBalls(state);
    var i;
    for (i = 0; i < balls.length; i++) {
      unstickOneTriangleInterior(state, balls[i], tri);
    }
  }

  function unstickTriangle500(state) {
    unstickTriangleInterior(state);
    var ball = state && state.ball;
    if (skipBallAssist(state, ball)) return;
    if (!triangle500Wedged(state, ball)) {
      if (ball) ball._triPinchStuck = 0;
      return;
    }
    ball._triPinchStuck = (ball._triPinchStuck || 0) + 1;
    if (ball._triPinchStuck < 4 && vecLen(ball.vx, ball.vy) > 80) return;
    var rubber = copperRubberMid(state);
    var side = ball.x >= rubber.x ? 1 : -1;
    ball.x = rubber.x + side * (rubber.radius + (ball.radius || BALL_RADIUS) + 10);
    ball.y = rubber.y + 6;
    ball.vx = side * 180;
    ball.vy = 140;
  }


  function nearestPointOnSegments(px, py, segs) {
    if (!segs || !segs.length) return null;
    var best = null;
    var i;
    for (i = 0; i < segs.length; i++) {
      var s = segs[i];
      var dx = s.x2 - s.x1;
      var dy = s.y2 - s.y1;
      var lenSq = dx * dx + dy * dy;
      if (lenSq < 1e-6) continue;
      var t = clamp(((px - s.x1) * dx + (py - s.y1) * dy) / lenSq, 0, 1);
      var cx = s.x1 + t * dx;
      var cy = s.y1 + t * dy;
      var d = vecLen(px - cx, py - cy);
      if (!best || d < best.dist) best = { dist: d, x: cx, y: cy, t: t, seg: s };
    }
    return best;
  }

﻿  function fillerHullPoints(fill) {
    var pts = [];
    function pushPt(x, y) {
      var n = pts.length;
      if (n && pts[n - 1].x === x && pts[n - 1].y === y) return;
      pts.push({ x: x, y: y });
    }
    var i;
    var segs = (fill && fill.segments) || [];
    var guides = (fill && fill.guides) || [];
    for (i = 0; i < segs.length; i++) {
      pushPt(segs[i].x1, segs[i].y1);
      pushPt(segs[i].x2, segs[i].y2);
    }
    for (i = guides.length - 1; i >= 0; i--) {
      pushPt(guides[i].x2, guides[i].y2);
      pushPt(guides[i].x1, guides[i].y1);
    }
    return pts;
  }

  function fillerBoundarySegs(fill) {
    var segs = [];
    if (!fill) return segs;
    if (fill.segments) segs = segs.concat(fill.segments);
    if (fill.guides) segs = segs.concat(fill.guides);
    return segs;
  }

  function pointInPoly(x, y, pts) {
    if (!pts || pts.length < 3) return false;
    var inside = false;
    var j = pts.length - 1;
    var i;
    for (i = 0; i < pts.length; i++) {
      var yi = pts[i].y;
      var yj = pts[j].y;
      var xi = pts[i].x;
      var xj = pts[j].x;
      if ((yi > y) !== (yj > y)) {
        var xHit = (xj - xi) * (y - yi) / ((yj - yi) || 1e-12) + xi;
        if (x < xHit) inside = !inside;
      }
      j = i;
    }
    return inside;
  }

  function ballInsideFiller(ball, fill) {
    if (!ball || !fill) return false;
    return pointInPoly(ball.x, ball.y, fillerHullPoints(fill));
  }

  // cyan1: right top cusp unstick box (playfield side of launch rail)
  function sausageCuspBox(ball) {
    if (!ball) return false;
    // cyan1 leftover: right top cusp (playfield side of launch rail)
    if (ball.x >= 440 && ball.x <= 480 && ball.y >= 520 && ball.y <= 560) return true;
    // orbit1: right sausage tip vs cage / inlane join
    if (ball.x >= 408 && ball.x <= 452 && ball.y >= 698 && ball.y <= 740) return true;
    // opt1: left sausage tip only — not the outlane slot along x=36-80
    if (ball.x >= 96 && ball.x <= 132 && ball.y >= 688 && ball.y <= 746) return true;
    return false;
  }

  function horseshoeFarmPocket(state, ball) {
    return !!(ball && ball.x >= 170 && ball.x <= 310 && ball.y >= 6 && ball.y <= 110);
  }

  function sausageFarmPocket(state, ball) {
    if (!ball) return false;
    if (sausageCuspBox(ball)) return true;
    var routes = state && state.sideRoutes;
    if (!routes) return false;
    return ballInsideFiller(ball, routes.leftFiller) || ballInsideFiller(ball, routes.rightFiller);
  }

  function ejectOneFromFiller(ball, fill) {
    if (!ball || !fill || !ballInsideFiller(ball, fill)) return false;
    var r = ball.radius || BALL_RADIUS;
    var inner = nearestPointOnSegments(ball.x, ball.y, fill.guides || []);
    var outer = nearestPointOnSegments(ball.x, ball.y, fill.segments || []);
    var near = nearestPointOnSegments(ball.x, ball.y, fillerBoundarySegs(fill));
    if (fill.id === 'fill-r' && inner) {
      if (!near || (outer && outer.dist <= inner.dist + 0.5) || (near.x >= LAUNCH_LANE_LEFT - 6)) {
        near = inner;
      }
    }
    if (fill.id === 'fill-l' && inner) {
      if (!near || (outer && outer.dist <= inner.dist + 0.5) || (near.x <= 42)) {
        near = inner;
      }
    }
    if (!near) {
      ball.x += fill.id === 'fill-r' ? -(r + 6) : (r + 6);
      return true;
    }
    var nx = ball.x - near.x;
    var ny = ball.y - near.y;
    var nlen = vecLen(nx, ny);
    if (nlen < 1e-6) {
      nx = fill.id === 'fill-r' ? -1 : 1;
      ny = 0.15;
      nlen = vecLen(nx, ny);
    }
    nx /= nlen;
    ny /= nlen;
    nx = -nx;
    ny = -ny;
    if (fill.id === 'fill-r' && nx > -0.2) {
      nx = -0.82;
      ny = 0.45;
      nlen = vecLen(nx, ny);
      nx /= nlen;
      ny /= nlen;
    }
    if (fill.id === 'fill-l' && nx < 0.2) {
      nx = 0.82;
      ny = 0.45;
      nlen = vecLen(nx, ny);
      nx /= nlen;
      ny /= nlen;
    }
    ball.x = near.x + nx * (r + 3);
    ball.y = near.y + ny * (r + 3);
    if (fill.id === 'fill-r' && ball.x >= LAUNCH_LANE_LEFT - r) {
      ball.x = LAUNCH_LANE_LEFT - r - 4;
    }
    if (fill.id === 'fill-l' && ball.x <= 36 + r) {
      ball.x = 36 + r + 4;
    }
    var sp = vecLen(ball.vx, ball.vy);
    var keep = Math.max(sp, 130);
    ball.vx = ball.vx * 0.2 + nx * keep * 0.8;
    ball.vy = ball.vy * 0.2 + ny * keep * 0.8;
    if (vecLen(ball.vx, ball.vy) < 90) {
      ball.vx += nx * 90;
      ball.vy += ny * 90;
    }
    return true;
  }

  function ejectSausageInteriors(state) {
    var routes = state && state.sideRoutes;
    if (!routes) return;
    var balls = allLiveBalls(state);
    var i;
    for (i = 0; i < balls.length; i++) {
      var ball = balls[i];
      if (skipBallAssist(state, ball)) continue;
      if (!ball || !ball.inPlay) continue;
      // merge3: solid hull. Eject every frame if inside either sausage.
      // Do not skip near LAUNCH_LANE_LEFT — that join is where balls tunnel.
      ejectOneFromFiller(ball, routes.rightFiller);
      ejectOneFromFiller(ball, routes.leftFiller);
    }
  }

  function peelSausageCusp(ball) {
    var r = ball.radius || BALL_RADIUS;
    var leftTip = ball.x < 200;
    var nx = leftTip ? 0.94 : -0.84;
    var ny = leftTip ? 0.18 : 0.36;
    var peel = leftTip ? 16 : 8;
    ball.x += nx * peel;
    ball.y += ny * peel;
    if (ball.x >= LAUNCH_LANE_LEFT) ball.x = LAUNCH_LANE_LEFT - r - 4;
    if (ball.x <= 36 + r) ball.x = 36 + r + 4;
    var sp = vecLen(ball.vx, ball.vy);
    var keep = Math.max(sp, leftTip ? 240 : 160);
    ball.vx = ball.vx * 0.12 + nx * keep * 0.88;
    ball.vy = ball.vy * 0.12 + ny * keep * 0.88;
    var floor = leftTip ? 170 : 110;
    if (vecLen(ball.vx, ball.vy) < floor) {
      ball.vx += nx * floor;
      ball.vy += ny * floor;
    }
  }

  function unstickOneSausageCusp(state, ball, dt) {
    if (skipBallAssist(state, ball)) return;
    if (!ball || !ball.inPlay) return;
    if (state.launchRailT != null && ball === state.ball) return;
    if (ball.x >= LAUNCH_LANE_LEFT) {
      ball._sausageStuck = 0;
      ball._sausageStuckT = 0;
      return;
    }
    if (!sausageCuspBox(ball)) {
      ball._sausageStuck = 0;
      ball._sausageStuckT = 0;
      return;
    }
    var sp = vecLen(ball.vx, ball.vy);
    var leftTip = ball.x < 200;
    var sittingStill = sp < (leftTip ? 120 : 90);
    if (ball._sausageNearX != null && Math.abs(ball.x - ball._sausageNearX) < 16 && Math.abs(ball.y - ball._sausageNearY) < 16) {
      ball._sausageStuck = (ball._sausageStuck || 0) + 1;
      ball._sausageStuckT = (ball._sausageStuckT || 0) + (dt || 1 / 60);
    } else {
      ball._sausageStuck = 1;
      ball._sausageStuckT = dt || 1 / 60;
      ball._sausageNearX = ball.x;
      ball._sausageNearY = ball.y;
    }
    var stuckLong = (ball._sausageStuck || 0) >= (leftTip ? 2 : 3);
    var stuckTime = (ball._sausageStuckT || 0) >= 0.2;
    if (sp >= (leftTip ? 200 : 160) && !stuckLong && !stuckTime) return;
    if (!sittingStill && !stuckLong && !stuckTime) return;
    peelSausageCusp(ball);
  }

  function unstickSausageCusp(state, dt) {
    var balls = allLiveBalls(state);
    var i;
    for (i = 0; i < balls.length; i++) unstickOneSausageCusp(state, balls[i], dt);
  }

  function unstickOneHorseshoeCrown(state, ball, dt) {
    if (skipBallAssist(state, ball)) return;
    if (!ball || !ball.inPlay) return;
    if (!horseshoeFarmPocket(state, ball)) {
      ball._horseStuckT = 0;
      return;
    }
    var sp = vecLen(ball.vx, ball.vy);
    if (sp < 40) {
      ball._horseStuckT = (ball._horseStuckT || 0) + (dt || 1 / 60);
    } else {
      ball._horseStuckT = 0;
      return;
    }
    if ((ball._horseStuckT || 0) < 0.2) return;
    // Along the tube toward the copper dump (+x, slight +y). Not through the inner rail, not into the shooter.
    var tx = 0.96;
    var ty = 0.18;
    if (ball.x > 430) {
      tx = 0.2;
      ty = 0.4;
    }
    var keep = Math.max(sp, 180);
    ball.vx = ball.vx * 0.15 + tx * keep * 0.85;
    ball.vy = ball.vy * 0.15 + ty * keep * 0.85;
    if (ball.x > LAUNCH_LANE_LEFT - 24) {
      ball.vx = Math.min(ball.vx, 30);
    }
    if (ball.vy > 90) ball.vy = 90;
    ball._horseStuckT = 0;
  }

  function unstickHorseshoeCrown(state, dt) {
    var balls = allLiveBalls(state);
    var i;
    for (i = 0; i < balls.length; i++) unstickOneHorseshoeCrown(state, balls[i], dt);
  }

  function topHorseshoeInnerSegs(leftRamp, rightRamp) {
    var segs = [];
    function add(list) {
      if (!list) return;
      var i;
      for (i = 0; i < list.length; i++) {
        var s = list[i];
        if (s.y1 < 200 || s.y2 < 200) segs.push(s);
      }
    }
    add(leftRamp && leftRamp.guides);
    add(rightRamp && rightRamp.guides);
    add(rightRamp && rightRamp.mergeInner);
    return segs;
  }

  /**
   * If the ball slips through the inner U in the top band, push it back
   * into the channel. Tight gate so open-playfield bumper shots stay free.
   */
  function horseshoeOuterSegs(leftRamp, rightRamp) {
    var outers = [];
    if (leftRamp && leftRamp.segments) {
      var oi;
      for (oi = 0; oi < leftRamp.segments.length; oi++) outers.push(leftRamp.segments[oi]);
    }
    if (rightRamp && rightRamp.segments) {
      var oj;
      for (oj = 0; oj < rightRamp.segments.length; oj++) outers.push(rightRamp.segments[oj]);
    }
    if (rightRamp && rightRamp.mergeOuter) {
      var om;
      for (om = 0; om < rightRamp.mergeOuter.length; om++) outers.push(rightRamp.mergeOuter[om]);
    }
    return outers;
  }

  function nearHorseshoeSpinner(state, ball) {
    var sp = state.spinner;
    return !!(sp && vecLen(ball.x - sp.x, ball.y - sp.y) < sp.radius + ball.radius + 18);
  }

  /** Playfield ball that tunneled up through the inner U — bounce it back down. */
  function rejectPlayfieldTunnelIn(state) {
    var ball = state.ball;
    if (skipBallAssist(state, state.ball)) return;
    if (!ball || state.activeHabitrail) return;
    if (ball.y < 24 || ball.y > 140) return;
    if (ball.vy >= -20) return;
    if (ball.x < 120 || ball.x > 510) return;
    var left = state.sideRoutes.leftRamp;
    var right = state.sideRoutes.rightRamp;
    var nearInner = nearestPointOnSegments(ball.x, ball.y, topHorseshoeInnerSegs(left, right));
    if (!nearInner || nearInner.dist > 28) return;
    if (ball.y >= nearInner.y) return;
    ball.y = nearInner.y + ball.radius + 3;
    if (ball.vy < 0) ball.vy = Math.abs(ball.vy) * 0.72;
  }

  /**
   * If a channel rider slips through the inner U in the top band, push it
   * back into the channel. Tight gate so open-playfield bumper shots stay free.
   */
  function containHorseshoeInner(state) {
    var ball = state.ball;
    if (skipBallAssist(state, state.ball)) return;
    if (!ball || !state.activeHabitrail) return;
    if (ball.y < 24 || ball.y > 140) return;
    if (ball.x < 88 || ball.x > 448) return;
    // Copper lodge box: do not snap the ball into the orange inner V.
    if (ball.x >= 368 && ball.x <= 480) return;
    if (ball.vy < 20) return;
    if (nearHorseshoeSpinner(state, ball)) return;
    var left = state.sideRoutes.leftRamp;
    var right = state.sideRoutes.rightRamp;
    var inners = topHorseshoeInnerSegs(left, right);
    var outers = horseshoeOuterSegs(left, right);
    var nearInner = nearestPointOnSegments(ball.x, ball.y, inners);
    var nearOuter = nearestPointOnSegments(ball.x, ball.y, outers);
    if (!nearInner) return;
    var nearDist = nearInner.dist;
    if (nearOuter) nearDist = Math.min(nearDist, nearOuter.dist);
    if (nearInner.dist > 16) return;
    if (ball.y <= nearInner.y + 2) return;
    ball.y = nearInner.y - 1;
    if (ball.vy > 0) ball.vy *= 0.25;
  }

  /** Leak-contain only. No snap-to-path, no constant-speed conveyor. */
  function assistHabitrails(state, dt) {
    if (skipBallAssist(state, state.ball)) return;
    if (!state.sideRoutes || !state.ball.inPlay || !state.exitedLaunchLane) return;
    var ball = state.ball;
    if (state.launchRailT != null && (ball.x < 390 || ball.y > 140)) state.launchRailT = null;
    var left = state.sideRoutes.leftRamp;
    var right = state.sideRoutes.rightRamp;
    rejectPlayfieldTunnelIn(state);
    containHorseshoeInner(state);
    var travel = horseshoeTravelSegs(left, right);
    var nearTravel = nearestPointOnSegments(ball.x, ball.y, travel);
    var routes = [left, right];
    var ri;
    var inChannel = false;
    for (ri = 0; ri < routes.length; ri++) {
      var route = routes[ri];
      if (!route || !route.segments) continue;
      var nearOuter = nearestPointOnSegments(ball.x, ball.y, route.segments);
      var nearGuide = nearestPointOnSegments(ball.x, ball.y, route.guides);
      if (!nearOuter) continue;
      var channelDist = nearOuter.dist;
      if (nearGuide) channelDist = Math.min(channelDist, nearGuide.dist);
      if (channelDist > ball.radius + 16) continue;
      if (nearGuide) {
        var loX = Math.min(nearOuter.x, nearGuide.x) - 6;
        var hiX = Math.max(nearOuter.x, nearGuide.x) + 6;
        var loY = Math.min(nearOuter.y, nearGuide.y) - 6;
        var hiY = Math.max(nearOuter.y, nearGuide.y) + 6;
        if (ball.x < loX || ball.x > hiX || ball.y < loY || ball.y > hiY) continue;
      }
      inChannel = true;
    }
    if (state.activeHabitrail === 'ramp-l' && left) peelHabitrailDump(state, left);
    if (state.activeHabitrail === 'ramp-r' && right) peelHabitrailDump(state, right);
    if (state.activeHabitrail && !inChannel && nearTravel && nearTravel.dist > ball.radius + 40) {
      state.activeHabitrail = null;
    }
  }

  function peelLeftInlaneWedge(/* state */) {
    // Ghost leftover (invisible inlane-wedge kick) removed. Dash corridors stay open.
    return;
    var ball = state.ball;
    if (!ball || !ball.inPlay || !state.exitedLaunchLane) return;
    if (ball.x < 60 || ball.x > 130 || ball.y < 465 || ball.y > 545) return;
    if (saucersOf(state).some(function (hole) {
      return vecLen(ball.x - hole.x, ball.y - hole.y) < hole.radius + 40;
    })) return;
    if (ballSpeed(ball) > 90) return;
    var left = state.sideRoutes && state.sideRoutes.leftRamp;
    if (left && pointInRouteEntry(ball, left.entry)) return;
    ball.x = Math.max(ball.x, 108);
    ball.vx = Math.max(ball.vx, 150);
    if (ball.vy < 80) ball.vy = 80;
  }

  function resolveSideRouteCollisions(state) {
    if (!state.sideRoutes || !state.ball.inPlay || !state.exitedLaunchLane) return;
    var ball = state.ball;
    var cap = state.sideRoutes.leftCaptive;
    if (cap && cap.cooldown <= 0) {
      var cdx = ball.x - cap.x;
      var cdy = ball.y - cap.y;
      var cdist = vecLen(cdx, cdy);
      var cmin = ball.radius + cap.radius;
      if (cdist < cmin && cdist > 1e-6) {
        var cn = normalize(cdx, cdy);
        ball.x = cap.x + cn.x * cmin;
        ball.y = cap.y + cn.y * cmin;
        // Kick into upper center playfield
        ball.vx = Math.max(ball.vx, 0) + 280;
        ball.vy = -Math.max(Math.abs(ball.vy), 320);
        cap.cooldown = SIDE_ROUTE_COOLDOWN;
        awardScore(state, cap.score, 'route', cap.id, cap.x, cap.y);
      }
    }
    // Real travel paths: walls guide the ball; entry sensors award + mild boost
    tryHabitrailEntry(state, state.sideRoutes.leftRamp, 1);
    tryHabitrailEntry(state, state.sideRoutes.rightRamp, -1);
  }

  function beginEndOfBallBonus(state) {
    if (countLiveBalls(state) > 1) return state;
    var multPts = state.multiplier * 500;
    var dashPts = state.launchDashRewarded ? 1000 : 0;
    var jackPts = state.jackpotLit ? 2500 : 0;
    var bankPts = Math.floor(state.bonusBank || 0);
    var steps = [];
    if (multPts > 0) steps.push({ label: 'MULT x' + state.multiplier, points: multPts });
    if (dashPts > 0) steps.push({ label: 'LANE DASH', points: dashPts });
    if (jackPts > 0) steps.push({ label: 'JACKPOT', points: jackPts });
    steps.push({ label: 'BONUS BANK', points: bankPts });
    var total = 0;
    var i;
    for (i = 0; i < steps.length; i++) total += steps[i].points;
    state.phase = 'eob_bonus';
    state.ball.inPlay = false;
    state.ball.vx = 0;
    state.ball.vy = 0;
    state.eobTimer = 0;
    state.eobDuration = EOB_DURATION;
    state.eobBreakdown = steps;
    state.eobTotal = total;
    state.eobDisplay = 0;
    state.eobStep = 0;
    state.eobAwarded = false;
    return state;
  }

  function updateEndOfBallBonus(state, dt) {
    if (state.phase !== 'eob_bonus') return state;
    state.eobTimer += dt;
    var steps = state.eobBreakdown || [];
    var n = Math.max(1, steps.length);
    var stepDur = state.eobDuration / n;
    state.eobStep = Math.min(n - 1, Math.floor(state.eobTimer / stepDur));
    // Progressive display of tally
    var shown = 0;
    var i;
    for (i = 0; i <= state.eobStep && i < steps.length; i++) {
      shown += steps[i].points;
    }
    state.eobDisplay = shown;

    if (state.eobTimer >= state.eobDuration && !state.eobAwarded) {
      state.eobAwarded = true;
      state.score += state.eobTotal;
      state.bonusBank = 0;
      state.lastScorePopup = {
        points: state.eobTotal,
        x: TABLE_W * 0.5,
        y: TABLE_H * 0.36,
        life: 1.3,
        type: 'eob',
        merged: false
      };
      state.lastHitType = 'eob';
      if (state.ballsRemaining <= 0) {
        state.phase = 'game_over';
      } else {
        resetBallToPlunger(state);
      }
    }
    return state;
  }

  /**
   * Light dashes when the ball rolls over them (bottom â†’ top).
   * After all are on for 3s, reverse top â†’ bottom with a slow pulse-fade off.
   */
  function updateLaunchLaneDashes(state, dt) {
    var dashes = state.launchLaneDashes;
    if (!dashes || !dashes.length) return;
    var i;
    var n = dashes.length;

    for (i = 0; i < n; i++) {
      if (dashes[i].flash > 0) dashes[i].flash = Math.max(0, dashes[i].flash - dt);
    }

    // Reverse extinguish: top (last lit) â†’ plunger (first), staggered pulse-fade
    if (state.launchDashReversing) {
      var ri = state.launchDashReverseI;
      if (ri < 0) {
        resetLaunchDashSequence(state);
        return;
      }
      // step 0 = top (slowest), higher steps = closer to plunger (faster)
      var stepFromTop = (n - 1) - ri;
      var fadeSec = LAUNCH_DASH_FADE_MAX * Math.pow(LAUNCH_DASH_FADE_ACCEL, stepFromTop);
      if (fadeSec < LAUNCH_DASH_FADE_MIN) fadeSec = LAUNCH_DASH_FADE_MIN;
      state.launchDashFadeT += dt;
      var u = clamp(state.launchDashFadeT / fadeSec, 0, 1);
      // Pulse while fading: brighter mid-dip, then settle off
      var pulse = 0.55 + 0.45 * Math.sin(u * Math.PI * 2.2);
      var fade = 1 - u;
      dashes[ri].intensity = clamp(fade * pulse, 0, 1);
      dashes[ri].lit = dashes[ri].intensity > 0.04;
      if (u >= 1) {
        dashes[ri].intensity = 0;
        dashes[ri].lit = false;
        dashes[ri].occupied = false;
        dashes[ri].flash = 0;
        state.launchDashReverseI = ri - 1;
        state.launchDashFadeT = 0;
        if (state.launchDashReverseI < 0) {
          resetLaunchDashSequence(state);
        }
      }
      return;
    }

    // While ball climbs the lane: light each dash once on contact
    var ball = state.ball;
    if (ball.inPlay && !state.exitedLaunchLane && isBallInLaunchLane(state)) {
      var halfW = 16;
      var halfH = 14;
      for (i = 0; i < n; i++) {
        var d = dashes[i];
        var dx = Math.abs(ball.x - d.x);
        var dy = Math.abs(ball.y - d.y);
        if (dx < halfW && dy < halfH + ball.radius * 0.35) {
          if (!d.occupied) {
            d.occupied = true;
            if (!d.lit || d.intensity < 1) {
              d.lit = true;
              d.intensity = 1;
              d.flash = 0.4;
              // New light cancels a pending reverse/hold
              if (state.launchDashHoldT > 0 && !allLaunchDashesLit(dashes)) {
                state.launchDashHoldT = 0;
              }
            }
          }
        } else {
          d.occupied = false;
        }
      }
    }

    // Keep fully-on dashes at full intensity until reverse
    for (i = 0; i < n; i++) {
      if (dashes[i].lit && dashes[i].intensity < 1 && !state.launchDashReversing) {
        dashes[i].intensity = 1;
      }
    }

    // Idle running glow: hall lights stay dim bulbs, not empty holes.
    if (state.launchDashIdleT == null) state.launchDashIdleT = 0;
    state.launchDashIdleT += dt;
    if (!state.launchDashReversing) {
      for (i = 0; i < n; i++) {
        if (dashes[i].lit && dashes[i].intensity >= 0.95) continue;
        if (dashes[i].occupied) continue;
        var wave = 0.5 + 0.5 * Math.sin(state.launchDashIdleT * 3.4 + i * 0.72);
        dashes[i].intensity = 0.22 + 0.20 * wave;
      }
    }

    if (allLaunchDashesLit(dashes)) {
      // Full stack only: one bonus when first completed (partial = no reward)
      if (!state.launchDashRewarded) {
        state.launchDashRewarded = true;
        var midY = dashes[Math.floor(n / 2)].y;
        awardScore(state, LAUNCH_DASH_FULL_BONUS, 'lanedash', 'full', LAUNCH_LANE_X, midY);
      }
      state.launchDashHoldT += dt;
      if (state.launchDashHoldT >= LAUNCH_DASH_HOLD_SEC) {
        state.launchDashReversing = true;
        state.launchDashReverseI = n - 1;
        state.launchDashFadeT = 0;
        state.launchDashHoldT = 0;
      }
    } else {
      state.launchDashHoldT = 0;
    }
  }

  function allLaunchDashesLit(dashes) {
    var i;
    for (i = 0; i < dashes.length; i++) {
      if (!dashes[i].lit || dashes[i].intensity < 0.95) return false;
    }
    return true;
  }

  function resetBallToPlunger(state) {
    var others = extraLiveBalls(state);
    if (others.length) {
      retireDrainedBall(state, state.ball);
      bindBall(state, others[0]);
      if (countLiveBalls(state) < 2) state.multiball = false;
      return;
    }
    state.ball.inPlay = false;
    state.ball.x = LAUNCH_LANE_X;
    state.ball.y = PLUNGER_REST_Y;
    state.ball.vx = 0;
    state.ball.vy = 0;
    state.exitedLaunchLane = false;
    state.launchCharging = false;
    state.launchPower = 0;
    state.launchRailT = null;
    state.activeLaunchPower = 0;
    state.plungerFollowFrames = 0;
    state.plungerFollowPower = 0;
    state.phase = 'ready';
    state.tiltWarnings = 0;
    state.tiltCooldown = 0;
    state.multiball = false;
    state.balls = null;
    state.ballSaveArmed = false;
    state.ballSaveUsed = false;
    state.ballSaveTimer = 0;
    state.multiplier = Math.max(1, state.multiplier - 1);
    resetBallProgress(state);
  }

  function ensureBallAtPlunger(state) {
    if (!state.ball.inPlay && state.phase === 'ready' && state.ballsRemaining > 0) {
      state.ball.x = LAUNCH_LANE_X;
      state.ball.y = PLUNGER_REST_Y;
      state.ball.vx = 0;
      state.ball.vy = 0;
    }
    return state;
  }

  /**
   * Apron / inlane assists must never loft a ball that is already draining.
   * Block when inside a drain slot near/below the flipper line, or clearly
   past the bats with downward velocity on the playfield side of the plunger.
   */
  function apronAssistsBlocked(state) {
    var ball = state.ball;
    if (!ball || !ball.inPlay || !state.exitedLaunchLane) return true;
    var zones = getDrainBounds(state);
    if (ball.y > FLIPPER_ROW_Y + 20) return true;
    if (ball.y >= FLIPPER_ROW_Y - 4 && ball.vy > 0 && isBallInDrainZone(ball, zones)) {
      return true;
    }
    if (ball.y > FLIPPER_ROW_Y + 8 && ball.vy > 40 && ball.x < LAUNCH_LANE_LEFT) {
      return true;
    }
    return false;
  }

  function isFreshShooterTravel(state) {
    // Only a plunged ball that has not yet exited may travel the lane
    // (up into the merge, or back down a failed plunge to the berth).
    if (!state || !state.ball || !state.ball.inPlay || !isBallInLaunchLane(state)) return false;
    if (!state.exitedLaunchLane) return true;
    var u = launchChargeU(state);
    return u > 0 && u < RIDE_MERGE_U;
  }

  function peelOutOfShooterLane(ball, intoU) {
    var r = ball.radius || BALL_RADIUS;
    ball.x = LAUNCH_LANE_LEFT - r - 6;
    if (ball.vx > -40) ball.vx = -Math.max(Math.abs(ball.vx), 200);
    if (intoU) ball.vy = Math.min(ball.vy, -140);
    else if (ball.vy < -40) ball.vy *= 0.35;
  }

  function sealSausageRailJoin(state, ball) {
    if (!ball || !ball.inPlay) return;
    var r = ball.radius || BALL_RADIUS;
    if (ball.y < 528 || ball.y > 752) return;
    var routes = state.sideRoutes;
    if (routes && ballInsideFiller(ball, routes.rightFiller)) return;
    // Shooter-well side of the cyan outer: keep a plunge in the well.
    if (ball.x >= LAUNCH_LANE_LEFT - 2 && ball.x < LAUNCH_LANE_LEFT + r + 2) {
      ball.x = LAUNCH_LANE_LEFT + r + 2;
      if (ball.vx < 0) ball.vx = Math.abs(ball.vx) * 0.25;
    }
  }

  function blockShooterLaneIntrusion(state) {
    if (!state.ball || !state.ball.inPlay) return;
    var ball = state.ball;
    var r = ball.radius;
    var fresh = isFreshShooterTravel(state);

    // Apron: keep playfield balls out of the plunger berth.
    if (state.exitedLaunchLane) {
      if (ball.x + r >= LAUNCH_LANE_LEFT - 1 && ball.y > FLIPPER_ROW_Y - 44) {
        ball.x = LAUNCH_LANE_LEFT - r - 2;
        if (ball.vx > -40) {
          ball.vx = -Math.max(Math.abs(ball.vx), 200) * WALL_RESTITUTION;
        }
        if (ball.y >= FLIPPER_ROW_Y - 8 || apronAssistsBlocked(state)) {
          // Drain/apron: kill upward kick only
          if (ball.vy < 0) ball.vy = Math.abs(ball.vy) * 0.25;
        } else if (ball.vy > -80) {
          ball.vy = -Math.max(Math.abs(ball.vy), 140);
        }
      }
    }

    if (fresh) {
      // Plunge may travel the lane UP into the merge. Seal the sausage/
      // rail join so a shooter ball cannot slip sideways into the cyan hull.
      sealSausageRailJoin(state, ball);
      return;
    }

    var inLaneX = ball.x + r >= LAUNCH_LANE_LEFT - 1;
    var belowJoin = ball.y > LAUNCH_WIRE_Y1;

    // Already falling down the lane from the merge: peel to playfield
    // before the sausage (do not drop to y=538+ inside the lane).
    if (ball.x > LAUNCH_LANE_LEFT && belowJoin) {
      if (ball.y >= 528 && ball.y <= 744 && ball.y < FLIPPER_ROW_Y - 80) {
        ball.y = 520;
      }
      peelOutOfShooterLane(ball, false);
      return;
    }

    // One-way at the merge mouth: playfield / merge balls cannot enter
    // the lane (rightward / downward re-entry). Plunge UP is not blocked.
    if (inLaneX && ball.y <= LAUNCH_WIRE_Y1 + 16) {
      peelOutOfShooterLane(ball, ball.y <= LAUNCH_WIRE_Y1 + 6);
      return;
    }

    if (inLaneX && belowJoin) {
      peelOutOfShooterLane(ball, false);
    }
  }



  function segmentCollision(ball, x1, y1, x2, y2, restitution, impulseFn) {
    var dx = x2 - x1;
    var dy = y2 - y1;
    var lenSq = dx * dx + dy * dy;
    if (lenSq < 1e-6) return false;

    var t = clamp(((ball.x - x1) * dx + (ball.y - y1) * dy) / lenSq, 0, 1);
    var cx = x1 + t * dx;
    var cy = y1 + t * dy;
    var distX = ball.x - cx;
    var distY = ball.y - cy;
    var dist = vecLen(distX, distY);
    var r = ball.radius;

    if (dist < r && dist > 1e-6) {
      var n = normalize(distX, distY);
      ball.x = cx + n.x * r;
      ball.y = cy + n.y * r;
      var rv = reflectVelocity(ball.vx, ball.vy, n.x, n.y, restitution);
      ball.vx = rv.vx;
      ball.vy = rv.vy;
      if (impulseFn) impulseFn(n);
      return true;
    }
    return false;
  }

  function resolveWallCollisions(state) {
    var ball = state.ball;
    var r = ball.radius;

    state.walls.forEach(function (wall) {
      if (!state.exitedLaunchLane && (wall.wireform || wall.kind === 'lane')) {
        var playfieldSide = ball.x + r < LAUNCH_LANE_LEFT + 1 && ball.y > LAUNCH_WIRE_Y1 + 8;
        if (!(wall.kind === 'lane' && playfieldSide)) return;
      }
      if (wall.kind === 'tri-solid') return; // rubber + solid live in resolvePulseTriangle
      if (wall.kind === 'filler' && ball.y < 500 && (state.activeHabitrail ||
          inHabitrailChannel(state, state.sideRoutes && state.sideRoutes.leftRamp) ||
          inHabitrailChannel(state, state.sideRoutes && state.sideRoutes.rightRamp))) {
        return;
      }
      // Raised horseshoe rides over the launch wireform (different height).
      if (wall.wireform && (state.activeHabitrail ||
          inHabitrailChannel(state, state.sideRoutes && state.sideRoutes.leftRamp) ||
          inHabitrailChannel(state, state.sideRoutes && state.sideRoutes.rightRamp))) {
        return;
      }
      // Raised merge sits over the right-orbit corner in 2D.
      // Plunge / merge riders must hit the floor; RTL climbers in the right slide must not.
      if (wall.arc && ball.y < 88 && ball.x > 40 && ball.x < LAUNCH_LANE_LEFT - 4) {
        // Horseshoe tubes are the orbit ceiling; the leftover ellipse must not
        // hang a second roof in the channel.
        return;
      }
      if (wall.merge) {
        // merge3: plunge / launchRailT riders MUST hit the floor.
        // RTL climbers below the raised floor skip so they do not bounce from under.
        if (state.activeHabitrail === 'ramp-l' && ball.y > 90) return;
        // RTL in the right slide skips the raised underside. Once in the U, the floor holds.
        if (state.activeHabitrail === 'ramp-r' && ball.x > 420 && ball.y > 78) return;
        var ridingPlunge = state.launchRailT != null || (!state.exitedLaunchLane && isBallInLaunchLane(state));
        if (!ridingPlunge) {
          var underFloor = ball.y > 115 && state.exitedLaunchLane && !isBallInLaunchLane(state);
          if (underFloor) return;
          if (state.activeHabitrail === 'ramp-r' && ball.y > 115) return;
        }
      } else if (!state.exitedLaunchLane && state.launchRailT != null && wall.kind === 'habitrail' && !wall.merge && ball.y < 115) {
        var minX = Math.min(wall.x1, wall.x2);
        var maxX = Math.max(wall.x1, wall.x2);
        var minY = Math.min(wall.y1, wall.y2);
        if (minX > 408 && maxX < 476 && minY < 90 && minX > 280) return;
      }
      // Soft short deck stubs â€” less bounce so they don't steal lower play
      var rest = WALL_RESTITUTION;
      if (wall.kind === 'deck') rest = WALL_RESTITUTION * 0.55;
      else if (wall.kind === 'habitrail') rest = HABITRAIL_RESTITUTION;
      else if (wall.kind === 'guide') rest = GUIDE_RESTITUTION;
      else if (wall.kind === 'filler') rest = GUIDE_RESTITUTION;
      segmentCollision(ball, wall.x1, wall.y1, wall.x2, wall.y2, rest, null);
    });

    if (ball.x - r < 36) {
      ball.x = 36 + r;
      ball.vx = Math.abs(ball.vx) * WALL_RESTITUTION;
    }
    // Cabinet arch underside. Horseshoe riders sit in the U (outer y=32) under the
    // real arch (y~26) — never apply the leftover y=48/52 ceiling that cut the channel.
    var ridingHorse = !!(state.activeHabitrail ||
      (ball.y < 160 && (
        inHabitrailChannel(state, state.sideRoutes && state.sideRoutes.leftRamp) ||
        inHabitrailChannel(state, state.sideRoutes && state.sideRoutes.rightRamp)
      )));
    if (!ridingHorse && ball.x > 40 && ball.x < LAUNCH_LANE_LEFT + 10) {
      var floorY = topArchFloorY(ball.x);
      if (ball.y - r < floorY) {
        ball.y = floorY + r + 0.5;
        if (ball.vy < 0) ball.vy = Math.abs(ball.vy) * WALL_RESTITUTION;
        var mid = TABLE_W * 0.5;
        ball.vx += (ball.x < mid ? -1 : 1) * 25;
      }
    } else if (!ridingHorse && ball.y - r < 22) {
      ball.y = 22 + r;
      if (ball.vy < 0) ball.vy = Math.abs(ball.vy) * WALL_RESTITUTION;
    }
  }

  function resolveSlingshotCollisions(state) {
    var ball = state.ball;
    state.slingshots.forEach(function (sling) {
      var scored = false;
      var preVx = ball.vx;
      var preVy = ball.vy;
      var hit = segmentCollision(ball, sling.x1, sling.y1, sling.x2, sling.y2, SLING_RESTITUTION, function (n) {
        var incident = Math.max(0, -dot(preVx, preVy, n.x, n.y));
        var kick = clamp(incident * SLING_KICK_GAIN, SLING_KICK_MIN, SLING_KICK_MAX);
        var up = kick * SLING_UP_BIAS;
        if (sling.side === 'left') {
          ball.vx += kick;
          ball.vy -= up;
        } else {
          ball.vx -= kick;
          ball.vy -= up;
        }
        if (sling.cooldown <= 0 && !lodgeFarming(state, ball)) {
          awardScore(state, sling.score, 'sling', sling.side, (sling.x1 + sling.x2) * 0.5, (sling.y1 + sling.y2) * 0.5);
          sling.cooldown = HIT_COOLDOWN_SLING;
          scored = true;
        }
      });
      if (hit && scored) return;
    });
  }

  function applyBumperExitSpeed(ball, nx, ny, minSpeed) {
    var vn = dot(ball.vx, ball.vy, nx, ny);
    if (vn < minSpeed) {
      ball.vx += nx * (minSpeed - vn);
      ball.vy += ny * (minSpeed - vn);
    }
  }

  function resolveBumperCollisions(state) {
    var ball = state.ball;
    state.bumpers.forEach(function (bumper, idx) {
      if (bumper.hitCooldown > 0) return;
      var dx = ball.x - bumper.x;
      var dy = ball.y - bumper.y;
      var dist = vecLen(dx, dy);
      var minDist = ball.radius + bumper.radius;

      if (dist < minDist && dist > 1e-6) {
        var n = normalize(dx, dy);
        var sep = minDist + 2;
        ball.x = bumper.x + n.x * sep;
        ball.y = bumper.y + n.y * sep;
        var rest = bumper.restitution != null ? bumper.restitution : BUMPER_RESTITUTION;
        var rv = reflectVelocity(ball.vx, ball.vy, n.x, n.y, rest);
        ball.vx = rv.vx;
        ball.vy = rv.vy;
        if (bumper.saver) {
          if (ballSpeed(ball) < 140) {
            ball.vx += 80;
            ball.vy -= 30;
          }
          applyBumperExitSpeed(ball, n.x, n.y, SAVER_BUMPER_EXIT_SPEED);
        } else {
          var exitSp = bumper.exitSpeed != null ? bumper.exitSpeed : MIN_BUMPER_EXIT_SPEED;
          applyBumperExitSpeed(ball, n.x, n.y, exitSp);
        }
        bumper.hitCooldown = HIT_COOLDOWN_BUMPER;
        if (!bumper.saver) {
          bumper.hit = true;
          if (allScoringBumpersHit(state.bumpers)) {
            startRushMode(state);
          }
        }
        if (!sausageFarmPocket(state, ball)) {
          if (!lodgeFarming(state, ball)) {
          awardScore(state, bumper.score, 'bumper', String(idx), bumper.x, bumper.y);
        }
        }
        state.lastHitBumper = idx;
        if (state.jackpotLit) {
          awardScore(state, 5000, 'jackpot', 'jackpot', bumper.x, bumper.y - 30);
          state.jackpotLit = false;
        }
      }
    });
  }

  function unstickFromBumpers(state) {
    var ball = state.ball;
    if (skipBallAssist(state, state.ball)) return;
    var speed = ballSpeed(ball);
    if (speed > BUMPER_UNSTICK_SPEED) return;
    state.bumpers.forEach(function (bumper) {
      var dx = ball.x - bumper.x;
      var dy = ball.y - bumper.y;
      var dist = vecLen(dx, dy);
      var minDist = ball.radius + bumper.radius;
      // Saver: always free if overlapping. Other bumpers: free if slow + very close.
      var sticky = bumper.saver
        ? dist < minDist - 0.5
        : dist < minDist + 4;
      if (!sticky) return;
      var n = normalize(dx || 0.2, dy || -1);
      ball.x = bumper.x + n.x * (minDist + 4);
      ball.y = bumper.y + n.y * (minDist + 4);
      var kick = bumper.saver ? 200 : 160;
      ball.vx = n.x * kick + (bumper.saver ? 80 : 40);
      ball.vy = n.y * kick - 60;
      bumper.hitCooldown = HIT_COOLDOWN_BUMPER;
    });
  }

  /**
   * Free ball wedged in upper rail corners / wireform entry pocket.
   * User-reported hang: top-right under arch (wireform Ã— top rail Ã— lane wall).
   */
  /**
   * Copper U / merge pocket: ball lodges in the inner V where mergeInner
   * meets the right habitrail guide (around 322,74). Peel along the ramp
   * tangent into the channel — nudge, no teleport, no rail snap.
   */
  function copperLodgeBox(ball) {
    return !!(ball && ball.x >= 430 && ball.x <= 524 && ball.y >= 50 && ball.y <= 110);
  }

  function copperDumpMouthBox(ball) {
    return !!(ball && ball.x >= 400 && ball.x <= 460 && ball.y >= 320 && ball.y <= 390);
  }

  function copperRubberMid(state) {
    var list = state && state.bumpers;
    if (!list) return null;
    var i;
    for (i = 0; i < list.length; i++) {
      if (list[i] && list[i].id === 'rubber-mid') return list[i];
    }
    return null;
  }

  function peelCopperBall(ball, nx, ny, px) {
    var nlen = vecLen(nx, ny) || 1;
    nx /= nlen;
    ny /= nlen;
    var peel = 7;
    ball.x += nx * peel;
    ball.y += ny * peel;
    var tx = -ny;
    var ty = nx;
    var along = ball.vx * tx + ball.vy * ty;
    if (Math.abs(along) < 12) {
      tx = px || 0.86;
      ty = px ? 0 : -0.5;
      var tlen = vecLen(tx, ty) || 1;
      tx /= tlen;
      ty /= tlen;
    } else if (along < 0) {
      tx = -tx;
      ty = -ty;
    }
    var sp = vecLen(ball.vx, ball.vy);
    var keep = Math.max(sp, 140);
    ball.vx = ball.vx * 0.22 + tx * keep * 0.78;
    ball.vy = ball.vy * 0.22 + ty * keep * 0.78;
    if (vecLen(ball.vx, ball.vy) < 90) {
      ball.vx += tx * 90;
      ball.vy += ty * 90;
    }
  }

  function unstickOneCopper(state, ball) {
    if (skipBallAssist(state, ball)) return;
    if (!ball || !ball.inPlay) return;
    var rideHab = state.activeHabitrail === 'ramp-l' || state.activeHabitrail === 'ramp-r';
    if (rideHab && vecLen(ball.vx, ball.vy) > 50) return;
    if (state.launchRailT != null && ball === state.ball && vecLen(ball.vx, ball.vy) > 180) return;
    var top = copperLodgeBox(ball);
    var dump = copperDumpMouthBox(ball);
    if (!top && !dump) {
      ball._copperStuck = 0;
      return;
    }
    var right = state.sideRoutes && state.sideRoutes.rightRamp;
    if (!right) return;
    var r = ball.radius || BALL_RADIUS;
    var nearMerge = nearestPointOnSegments(ball.x, ball.y, right.mergeInner || []);
    var nearGuide = nearestPointOnSegments(ball.x, ball.y, right.guides || []);
    var nearSeg = nearestPointOnSegments(ball.x, ball.y, right.segments || []);
    var rubber = copperRubberMid(state);
    var nearWall = null;
    var wallDist = 999;
    function consider(hit) {
      if (hit && hit.dist < wallDist) {
        wallDist = hit.dist;
        nearWall = hit;
      }
    }
    if (top) {
      consider(nearMerge);
      consider(nearGuide);
      consider(nearSeg);
    }
    var wedgedDump = false;
    if (dump && rubber && nearGuide) {
      var dRub = vecLen(ball.x - rubber.x, ball.y - rubber.y);
      wedgedDump = dRub < rubber.radius + r + 8 && nearGuide.dist < r + 12;
      if (wedgedDump && nearGuide.dist < wallDist) {
        nearWall = nearGuide;
        wallDist = nearGuide.dist;
      }
    }
    var slot = 999;
    if (nearMerge && nearGuide) {
      slot = vecLen(nearMerge.x - nearGuide.x, nearMerge.y - nearGuide.y);
    }
    var inSlot = slot < 26 && slot > 2 && nearMerge && nearGuide && nearMerge.dist < r + 8 && nearGuide.dist < r + 8;
    var atVertex = wallDist < r + 8;
    var sp = vecLen(ball.vx, ball.vy);
    var sittingStill = (atVertex || inSlot || wedgedDump) && sp < 180;
    var sitting = sittingStill || wedgedDump || inSlot;
    if (!sitting) {
      ball._copperStuck = 0;
      return;
    }
    if (ball._copperNearX != null && Math.abs(ball.x - ball._copperNearX) < 10 && Math.abs(ball.y - ball._copperNearY) < 10) {
      ball._copperStuck = (ball._copperStuck || 0) + 1;
    } else {
      ball._copperStuck = 1;
      ball._copperNearX = ball.x;
      ball._copperNearY = ball.y;
    }
    var stuckLong = (ball._copperStuck || 0) >= 4;
    if (!stuckLong) return;
    if (sp >= 180) return;
    var nx = -0.72;
    var ny = 0.28;
    if (nearWall && wallDist > 1e-6) {
      nx = (ball.x - nearWall.x) / wallDist;
      ny = (ball.y - nearWall.y) / wallDist;
    }
    if (top) {
      if (sp > 90 && ball.vx > 40) return;
      ball.x -= 10;
      if (ball.y > 66) ball.y = 64;
      ball.vx = -Math.max(Math.abs(ball.vx), 220);
      ball.vy = -24;
      return;
    }
    if (wedgedDump) {
      nx = -0.72;
      ny = 0.7;
    }
    var preferX = -0.86;
    peelCopperBall(ball, nx, ny, preferX);
  }

  /**
   * Copper U / merge pocket: peel every live ball out of the orange V and
   * the 500 dump-mouth pinch. Nudge only - no teleport, no rail snap.
   */
  function unstickCopperMergePocket(state) {
    var balls = allLiveBalls(state);
    var i;
    for (i = 0; i < balls.length; i++) unstickOneCopper(state, balls[i]);
  }
  function unstickFromCorners(state) {
    var ball = state.ball;
    if (skipBallAssist(state, state.ball)) return;
    if (!ball.inPlay || !state.exitedLaunchLane) return;
    var speed = ballSpeed(ball);
    var r = ball.radius;
    var upper = ball.y < 300;
    if (!upper) return;
    if (state.activeHabitrail) return;
    if (nearHabitrailMouthOrWall(state)) return;
    if (ball.y < 160 && (
      inHabitrailChannel(state, state.sideRoutes && state.sideRoutes.leftRamp) ||
      inHabitrailChannel(state, state.sideRoutes && state.sideRoutes.rightRamp)
    )) return;

    // Spinner-left cusp vs habitrail/arch: kick into playfield (right+down), never outlane.
    // Live bounce-loops here can exceed the slow-crawl speed gate.
    var spn = state.spinner;
    if (spn && ball.y > 108 && ball.x < spn.x + 6 && ball.x > spn.x - 70 && ball.y < spn.y + 42 && ball.y > spn.y - 40) {
      var sdist = vecLen(ball.x - spn.x, ball.y - spn.y);
      var nearSp = sdist < spn.radius + r + 24;
      var nearShelf = false;
      var leftRt = state.sideRoutes && state.sideRoutes.leftRamp;
      if (leftRt && leftRt.segments) {
        var np = nearestPointOnSegments(ball.x, ball.y, leftRt.segments);
        nearShelf = np && np.dist < r + 18;
      }
      if (nearSp && nearShelf && (speed <= 160 || sdist < spn.radius + r + 4)) {
        ball.x = spn.x + 12;
        ball.y = Math.max(spn.y + spn.radius + r + 6, ball.y + 10);
        ball.vx = Math.max(200, Math.abs(ball.vx) * 0.35 + 140);
        ball.vy = Math.max(170, Math.abs(ball.vy) * 0.35 + 90);
        return;
      }
    }

    if (speed > 70) return;

    // Top-left pocket: near left rail + upper third
    var topLeftCusp = ball.x < 120 && ball.y < 130 && ball.y > 28;
    if (topLeftCusp && speed <= 90) {
      if (ball._topLeftNearX != null && Math.abs(ball.x - ball._topLeftNearX) < 14 && Math.abs(ball.y - ball._topLeftNearY) < 14) {
        ball._topLeftStuck = (ball._topLeftStuck || 0) + 1;
      } else {
        ball._topLeftStuck = 1;
        ball._topLeftNearX = ball.x;
        ball._topLeftNearY = ball.y;
      }
      if ((ball._topLeftStuck || 0) >= 6 || speed <= 40) {
        ball.x = Math.max(ball.x + 18, 150);
        ball.y = Math.max(ball.y + 16, 140);
        ball.vx = Math.max(160, Math.abs(ball.vx));
        ball.vy = Math.max(140, Math.abs(ball.vy));
        return;
      }
    } else if (ball.x >= 120 || ball.y >= 130) {
      ball._topLeftStuck = 0;
    }

    // Top-right outer corner (outer right rail, above play â€” rare)
    var nearOuterRight = ball.x + r > TABLE_W - 36 - 10;
    if (nearOuterRight && ball.y < 140 && speed <= 70) {
      ball.x = Math.min(ball.x, LAUNCH_LANE_LEFT - r - 12);
      ball.vx = -Math.max(Math.abs(ball.vx), 180);
      ball.vy = Math.max(ball.vy, 80);
      return;
    }

    // Playfield side of launch lane wall (wide band â€” old 4px band was too thin)
    var nearLaneWall =
      ball.x + r > LAUNCH_LANE_LEFT - 48 &&
      ball.x < LAUNCH_LANE_LEFT + r + 2;
    if (nearLaneWall && ball.y < 220 && speed <= 70) {
      ball.x = Math.min(ball.x, LAUNCH_LANE_LEFT - r - 14);
      ball.vx = -Math.max(Math.abs(ball.vx), 170);
      ball.vy = Math.max(ball.vy, 90);
      return;
    }

    // Wireform Ã— top-rail wedge (skill-shot entry pocket â€” annotated stuck spot)
    // Wire: (LAUNCH_LANE_LEFT, LAUNCH_WIRE_Y1) â†’ (LAUNCH_WIRE_X2, LAUNCH_WIRE_Y2)
    var wx1 = WIRE_FORM_X1;
    var wy1 = WIRE_FORM_Y1;
    var wx2 = WIRE_FORM_X2;
    var wy2 = WIRE_FORM_Y2;
    var wdx = wx2 - wx1;
    var wdy = wy2 - wy1;
    var wlenSq = wdx * wdx + wdy * wdy;
    var ridingHorse = !!(state.activeHabitrail ||
      inHabitrailChannel(state, state.sideRoutes && state.sideRoutes.leftRamp) ||
      inHabitrailChannel(state, state.sideRoutes && state.sideRoutes.rightRamp));
    if (!ridingHorse && wlenSq > 1e-6 && ball.y < LAUNCH_WIRE_Y1 + 40 && ball.x > WIRE_FORM_X2 - 12 && ball.x < LAUNCH_LANE_LEFT - 10) {
      var wt = clamp(((ball.x - wx1) * wdx + (ball.y - wy1) * wdy) / wlenSq, 0, 1);
      var wcx = wx1 + wt * wdx;
      var wcy = wy1 + wt * wdy;
      var wdist = vecLen(ball.x - wcx, ball.y - wcy);
      var nearTopRail = ball.y - r < 60 + 28;
      var inWirePocket = wdist < r + 18 || (nearTopRail && ball.x > 220 && ball.x < LAUNCH_LANE_LEFT + 8);
      if (inWirePocket && speed <= 70) {
        // Push into center playfield below the arch
        ball.x = clamp(ball.x - 24, 36 + r + 8, LAUNCH_LANE_LEFT - r - 16);
        ball.y = Math.max(ball.y, 60 + r + 20);
        if (ball.y < 120) ball.y = 130 + r;
        ball.vx = -Math.max(Math.abs(ball.vx), 140);
        ball.vy = Math.max(Math.abs(ball.vy), 160); // fall into bumpers
        return;
      }
    }

    // Apex / wing bumper vs top-arch pinch (playtest soft-trap)
    if (state.bumpers && state.bumpers.length && speed <= 120) {
      var bi;
      for (bi = 0; bi < Math.min(3, state.bumpers.length); bi++) {
        var bum = state.bumpers[bi];
        if (!bum || bum.saver) continue;
        var bdx = ball.x - bum.x;
        var bdy = ball.y - bum.y;
        var bdist = vecLen(bdx, bdy);
        var bmin = ball.radius + bum.radius;
        var archY = topArchFloorY(ball.x);
        var nearArch = ball.y - r < archY + 42;
        var nearBump = bdist < bmin + 22;
        if (nearArch && nearBump && ball.y < bum.y + 12) {
          var kickN = normalize(bdx || 0.15, Math.max(0.45, bdy + 0.55));
          ball.x = bum.x + kickN.x * (bmin + 14);
          ball.y = Math.max(bum.y + kickN.y * (bmin + 14), archY + r + 18);
          ball.vx = kickN.x * 260 + (ball.x < TABLE_W * 0.5 ? 60 : -60);
          ball.vy = Math.max(180, Math.abs(kickN.y) * 220);
          return;
        }
      }
    }

    // Generic upper-slow only near rails (not left spinner / top bumper zone)
    var nearRail =
      ball.x - r < 36 + 30 ||
      ball.x + r > LAUNCH_LANE_LEFT - 20 ||
      ball.y - r < 60 + 22;
    if (speed < 28 && ball.y < 160 && nearRail) {
      var cx = TABLE_W * 0.5;
      var cy = 220;
      var n = normalize(cx - ball.x, cy - ball.y);
      ball.vx = n.x * 150;
      ball.vy = n.y * 150;
      if (ball.y - r < 60 + 4) ball.y = 60 + r + 10;
    }
  }

  function resolvePostCollisions(state) {
    if (!state.posts || !state.ball.inPlay) return;
    var ball = state.ball;
    state.posts.forEach(function (post) {
      var dx = ball.x - post.x;
      var dy = ball.y - post.y;
      var dist = vecLen(dx, dy);
      var minDist = ball.radius + post.radius;
      if (dist < minDist && dist > 1e-6) {
        var n = normalize(dx, dy);
        ball.x = post.x + n.x * minDist;
        ball.y = post.y + n.y * minDist;
        var rv = reflectVelocity(ball.vx, ball.vy, n.x, n.y, WALL_RESTITUTION + 0.08);
        ball.vx = rv.vx;
        ball.vy = rv.vy;
        if (ballSpeed(ball) < 120) {
          var inwardP = post.x < TABLE_W * 0.5 ? 1 : -1;
          if (n.y < -0.35) {
            ball.x = post.x + inwardP * (minDist + 10);
            ball.y = post.y + 2;
            ball.vx = inwardP * 150;
            ball.vy = Math.max(ball.vy, 100);
          } else {
            ball.vx += n.x * 80 + inwardP * 40;
            ball.vy += n.y * 70 + 40;
          }
        }
        if (!post._hitLock) {
          post._hitLock = true;
          post.flash = 0.3;
          if (post.score) awardScore(state, post.score, 'post', post.id, post.x, post.y);
        }
      } else {
        post._hitLock = false;
      }
      if (post.flash > 0) post.flash = Math.max(0, post.flash - 0.016);
    });
  }

  function resolveKickerCollisions(state) {
    var ball = state.ball;
    state.kickers.forEach(function (kicker) {
      var dx = ball.x - kicker.x;
      var dy = ball.y - kicker.y;
      var dist = vecLen(dx, dy);
      var minDist = ball.radius + kicker.radius;
      if (dist < minDist && dist > 1e-6) {
        var n = normalize(dx, dy);
        ball.x = kicker.x + n.x * minDist;
        ball.y = kicker.y + n.y * minDist;
        var rv = reflectVelocity(ball.vx, ball.vy, n.x, n.y, KICKER_RESTITUTION);
        ball.vx = rv.vx * 1.1;
        ball.vy = rv.vy * 1.1;
        if (ballSpeed(ball) < 130 && n.y < -0.35) {
          var inwardK = kicker.x < TABLE_W * 0.5 ? 1 : -1;
          ball.x = kicker.x + inwardK * (minDist + 10);
          ball.y = Math.max(ball.y, kicker.y + 4);
          ball.vx = inwardK * Math.max(160, Math.abs(ball.vx));
          ball.vy = Math.max(ball.vy, 110);
        }
        awardScore(state, kicker.score, 'kicker', kicker.id, kicker.x, kicker.y);
      }
    });
  }

  function resolveTargetCollisions(state) {
    var ball = state.ball;
    state.targets.forEach(function (target) {
      var halfW = target.w * 0.5;
      var halfH = target.h * 0.5;
      var closestX = clamp(ball.x, target.x - halfW, target.x + halfW);
      var closestY = clamp(ball.y, target.y - halfH, target.y + halfH);
      var dx = ball.x - closestX;
      var dy = ball.y - closestY;
      var dist = vecLen(dx, dy);
      if (dist < ball.radius && dist > 1e-6) {
        var n = normalize(dx, dy);
        ball.x = closestX + n.x * ball.radius;
        ball.y = closestY + n.y * ball.radius;
        var rv = reflectVelocity(ball.vx, ball.vy, n.x, n.y, WALL_RESTITUTION);
        ball.vx = rv.vx;
        ball.vy = rv.vy;
        // Flat standup tops are shelves — peel inward + down into play.
        if (ballSpeed(ball) < 150 && n.y < -0.2) {
          var inwardT = target.x < TABLE_W * 0.5 ? 1 : -1;
          ball.x = target.x + inwardT * (halfW + ball.radius + 10);
          ball.y = target.y + halfH + ball.radius + 2;
          ball.vx = inwardT * Math.max(170, Math.abs(ball.vx));
          ball.vy = Math.max(ball.vy, 110);
        }
        if (!target.occupied) {
          target.occupied = true;
          target.flash = 0.35;
          if (!target.lit) {
            target.lit = true;
            state.jackpotLit = state.targets.length > 0 && state.targets.every(function (t) { return t.lit; });
          }
          var bonus = target.lit ? target.score : Math.floor(target.score * 0.5);
          awardScore(state, bonus, 'target', target.id, target.x, target.y);
        }
      } else {
        target.occupied = false;
      }
    });
  }

  function resolveRolloverCollisions(state) {
    var ball = state.ball;
    state.rollovers.forEach(function (lane) {
      var dx = lane.x2 - lane.x1;
      var dy = lane.y2 - lane.y1;
      var lenSq = dx * dx + dy * dy;
      if (lenSq < 1e-6) return;
      var t = clamp(((ball.x - lane.x1) * dx + (ball.y - lane.y1) * dy) / lenSq, 0, 1);
      var cx = lane.x1 + t * dx;
      var cy = lane.y1 + t * dy;
      var dist = vecLen(ball.x - cx, ball.y - cy);
      var hitDist = ball.radius + lane.width * 0.5;
      if (dist < hitDist) {
        if (!lane.occupied) {
          lane.occupied = true;
          if (!lane.lit) {
            lane.lit = true;
            state.multiplier = Math.min(MAX_MULTIPLIER, state.multiplier + 1);
          }
          awardScore(state, lane.score, 'rollover', lane.id, lane.x1, (lane.y1 + lane.y2) * 0.5);
        }
      } else {
        lane.occupied = false;
      }
    });
  }

  function resolveSpinnerCollision(state) {
    var ball = state.ball;
    var sp = state.spinner;
    if (!sp) return;
    var dx = ball.x - sp.x;
    var dy = ball.y - sp.y;
    var dist = vecLen(dx, dy);
    var minDist = ball.radius + sp.radius;
    if (dist < minDist && dist > 1e-6) {
      var nrm = normalize(dx, dy);
      ball.x = sp.x + nrm.x * minDist;
      ball.y = sp.y + nrm.y * minDist;
      var rv = reflectVelocity(ball.vx, ball.vy, nrm.x, nrm.y, 0.9);
      ball.vx = rv.vx;
      ball.vy = rv.vy;
      var spinImpulse = Math.abs(ball.vx) + Math.abs(ball.vy);
      var tangential = Math.abs(ball.vx * nrm.y - ball.vy * nrm.x);
      sp.spinVel += Math.max(0.55, spinImpulse * 0.0055 + tangential * 0.004);
      if (sp.hitCooldown <= 0) {
        awardScore(state, sp.score, 'spinner', 'spinner', sp.x, sp.y);
        sp.hitCooldown = HIT_COOLDOWN_SPINNER;
      }
    }
    // Coast: keep star rotating after contact (renderer reads sp.angle each frame)
    sp.angle += sp.spinVel;
    if (Math.abs(sp.spinVel) < 0.0015) sp.spinVel = 0;
    else sp.spinVel *= 0.978;
  }

  function performDrain(state) {
    var others = extraLiveBalls(state);
    if (others.length) {
      retireDrainedBall(state, state.ball);
      bindBall(state, others[0]);
      state.drainFlash = 0.28;
      if (countLiveBalls(state) < 2) state.multiball = false;
      return state;
    }
    // One save only when explicitly armed (center skill shot) and not yet used/expired
    if (state.ballSaveArmed && !state.ballSaveUsed && state.ball.inPlay) {
      state.ballSaveUsed = true;
      state.ballSaveArmed = false;
      state.ballSaveTimer = 0;
      state.ballSaveFlash = 0.7;
      state.drainFlash = 0.35;
      state.lastHitType = 'ballsave';
      state.lastHitId = 'save';
      state.lastScorePopup = {
        points: 0,
        x: TABLE_W * 0.5,
        y: TABLE_H * 0.42,
        life: 1.1,
        type: 'ballsave',
        merged: false
      };
      var ball = state.ball;
      ball.x = TABLE_W * 0.5;
      ball.y = FLIPPER_ROW_Y - 90;
      ball.vx = (Math.random() - 0.5) * 100;
      ball.vy = -380;
      state.exitedLaunchLane = true;
      state.skillShotWindow = false;
      return state;
    }

    state.ballsRemaining -= 1;
    state.drainEvents += 1;
    state.drainFlash = 0.55;
    state.exitedLaunchLane = false;
    state.skillShotWindow = false;
    state.ballSaveArmed = false;
    state.ballSaveUsed = true;
    state.ballSaveTimer = 0;
    state.multiball = false;
    state.balls = null;
    saucersOf(state).forEach(function (hole) {
      hole.captured = false;
      hole.heldBall = null;
      hole.holdT = 0;
    });
    // Park off-table so nothing can soft-kick the lost ball back into the apron
    state.ball.inPlay = false;
    state.ball.x = TABLE_W * 0.5;
    state.ball.y = TABLE_H + 80;
    state.ball.vx = 0;
    state.ball.vy = 0;
    // SFX via drainEvents in audio.processState (avoid double-fire from lastHitType)
    // End-of-ball bonus sequence (then plunger or game over)
    return beginEndOfBallBonus(state);
  }

  function isBallInDrainZone(ball, zones) {
    var r = ball.radius;
    if (ball.x < zones.leftOutlaneRight) return 'left';
    if (ball.x > zones.centerLeft && ball.x < zones.centerRight) return 'center';
    if (ball.x > zones.rightOutlaneLeft && ball.x < LAUNCH_LANE_LEFT) return 'right';
    // Past flipper line: widen slots so apron dead-zones drain instead of looping
    if (ball.y > FLIPPER_ROW_Y + 12) {
      if (ball.x < zones.leftOutlaneRight + r + 8) return 'left';
      if (ball.x > zones.centerLeft - r - 10 && ball.x < zones.centerRight + r + 10) return 'center';
      if (ball.x > zones.rightOutlaneLeft - r - 8 && ball.x < LAUNCH_LANE_LEFT + r) return 'right';
      if (ball.y > FLIPPER_ROW_Y + 36 && ball.x < LAUNCH_LANE_LEFT) return 'center';
    }
    return null;
  }

  function resolveFlipperPivotCollisions(state) {
    var ball = state.ball;
    state.flippers.forEach(function (flipper) {
      var dx = ball.x - flipper.pivotX;
      var dy = ball.y - flipper.pivotY;
      var dist = vecLen(dx, dy);
      var minDist = ball.radius + FLIPPER_PIVOT_R;
      if (dist < minDist && dist > 1e-6) {
        var n = normalize(dx, dy);
        ball.x = flipper.pivotX + n.x * minDist;
        ball.y = flipper.pivotY + n.y * minDist;
        var rv = reflectVelocity(ball.vx, ball.vy, n.x, n.y, WALL_RESTITUTION);
        ball.vx = rv.vx;
        ball.vy = rv.vy;
      }
    });
  }

  function unstickFromStandupShelves(state) {
    var ball = state.ball;
    if (skipBallAssist(state, state.ball)) return;
    if (!ball.inPlay || !state.exitedLaunchLane || !state.targets) return;
    if (ballSpeed(ball) > 90) return;
    var r = ball.radius;
    var i;
    for (i = 0; i < state.targets.length; i++) {
      var t = state.targets[i];
      var halfW = t.w * 0.5;
      var halfH = t.h * 0.5;
      var onTop =
        ball.x > t.x - halfW - r - 4 &&
        ball.x < t.x + halfW + r + 4 &&
        ball.y + r > t.y - halfH - 6 &&
        ball.y < t.y - halfH + r + 2;
      if (!onTop) continue;
      var inward = t.x < TABLE_W * 0.5 ? 1 : -1;
      ball.x = t.x + inward * (halfW + r + 10);
      ball.y = t.y + halfH + r + 2;
      ball.vx = inward * 180;
      ball.vy = Math.max(ball.vy, 120);
      return;
    }
  }

  function unstickFromFlippers(state) {
    if (!state.ball || !state.ball.inPlay) return;
    if (!state.exitedLaunchLane) return;
    if (state.ball.y > FLIPPER_ROW_Y + 24) return;
    if (apronAssistsBlocked(state)) return;
    var ball = state.ball;
    var speed = ballSpeed(ball);
    // Crawl / tip-trap rescue only — no rocket impulses (those caused apron jumps)
    if (speed > 120) return;
    if (ball.y < FLIPPER_ROW_Y - 16 || ball.y > FLIPPER_ROW_Y + 40) return;
    var zones = getDrainBounds(state);
    // Already deep in a drain slot — let checkDrain finish the job
    if (ball.y > FLIPPER_ROW_Y + 24 && isBallInDrainZone(ball, zones)) return;

    var leftFlip = null;
    var rightFlip = null;
    var fi;
    for (fi = 0; fi < state.flippers.length; fi++) {
      if (state.flippers[fi].side === 'left' && state.flippers[fi].role !== 'upper') leftFlip = state.flippers[fi];
      if (state.flippers[fi].side === 'right' && state.flippers[fi].role !== 'upper') rightFlip = state.flippers[fi];
    }
    // Between rest tips: do not peel — kill loft so gravity takes the center hole
    if (leftFlip && rightFlip) {
      var ltGap = flipperTip(leftFlip);
      var rtGap = flipperTip(rightFlip);
      if (ball.x > ltGap.x + 1 && ball.x < rtGap.x - 1) {
        if (ball.vy < 0) ball.vy = Math.abs(ball.vy) * 0.2;
        if (ball.vy < 70) ball.vy = 70;
        return;
      }
    }

    state.flippers.forEach(function (flipper) {
      var tip = flipperTip(flipper);
      var dx = tip.x - flipper.pivotX;
      var dy = tip.y - flipper.pivotY;
      var segLen = vecLen(dx, dy);
      if (segLen < 1e-6) return;

      var ux = dx / segLen;
      var uy = dy / segLen;
      var relX = ball.x - flipper.pivotX;
      var relY = ball.y - flipper.pivotY;
      var t = clamp(dot(relX, relY, ux, uy), 0, segLen);
      var cx = flipper.pivotX + ux * t;
      var cy = flipper.pivotY + uy * t;
      var dist = vecLen(ball.x - cx, ball.y - cy);
      var hitDist = ball.radius + flipper.width * 0.5;
      var intoGap = flipper.side === 'left' ? 1 : -1;

      if (dist < hitDist + 3 && speed < 110) {
        // Tip crawl: drop into the hole rather than oscillating forever on the bat face
        if (t > segLen * 0.5 && Math.abs(ball.x - tip.x) < 28) {
          ball.x = tip.x + intoGap * (ball.radius + 4);
          ball.vx = intoGap * Math.max(55, Math.abs(ball.vx) * 0.35);
          ball.vy = Math.max(Math.abs(ball.vy), 120);
          return;
        }
        // Mid-bat crawl: decisive slide toward tip/gap (no loft assist)
        ball.vx = intoGap * Math.max(90, Math.abs(ball.vx));
        if (ball.y >= flipper.pivotY - 4 && ball.vy < 70) ball.vy = 70;
      }
    });
  }

  /**
   * Kill multi-second crawls on outer left rail (x~36) and playfield-side launch wall.
   * Also frees wing-bumper + outer-wall pinches with an inward (toward playfield) impulse.
   */
  function unstickWallSlide(state) {
    var ball = state.ball;
    if (skipBallAssist(state, state.ball)) return;
    if (!ball.inPlay || !state.exitedLaunchLane) return;
    if (state.activeHabitrail) return;
    if (nearHabitrailMouthOrWall(state)) return;
    var r = ball.radius;
    var speed = ballSpeed(ball);
    var absVx = Math.abs(ball.vx);
    var absVy = Math.abs(ball.vy);
    var crawling = speed < 160 || (absVx < 55 && absVy < 180);

    // Right orbit vs shooter slot: live bounce-loops are often faster than the crawl gate.
    var rightRtEarly = state.sideRoutes && state.sideRoutes.rightRamp;
    if (state.activeHabitrail === 'ramp-r') {
      rightRtEarly = null;
    }
    if (rightRtEarly && rightRtEarly.segments && ball.y > 70 && ball.y < 360 && ball.x < LAUNCH_LANE_LEFT) {
      var npRE = nearestPointOnSegments(ball.x, ball.y, rightRtEarly.segments);
      var inSlotEarly =
        ball.x + r > LAUNCH_LANE_LEFT - 40 &&
        npRE &&
        npRE.dist < r + 22 &&
        ball.x > npRE.x;
      if (inSlotEarly) {
        ball.x = npRE.x - r - 12;
        ball.vx = -Math.max(Math.abs(ball.vx), 220);
        ball.vy = Math.max(ball.vy, 140);
        return;
      }
    }

    if (!crawling) return;

    if (state.bumpers && state.bumpers.length) {
      var wi;
      for (wi = 1; wi <= 2 && wi < state.bumpers.length; wi++) {
        var wing = state.bumpers[wi];
        if (!wing || wing.saver) continue;
        var wdx = ball.x - wing.x;
        var wdy = ball.y - wing.y;
        var wdist = vecLen(wdx, wdy);
        var wmin = r + wing.radius;
        if (wdist > wmin + 16) continue;
        var leftSide = wing.x < TABLE_W * 0.5;
        var nearOuter = leftSide
          ? ball.x - r < 36 + 36
          : ball.x + r > LAUNCH_LANE_LEFT - 40;
        if (!nearOuter && speed > 90) continue;
        if (!nearOuter && wdist > wmin + 6) continue;
        var inward = leftSide ? 1 : -1;
        var n = normalize(Math.max(0.35, Math.abs(wdx)) * inward, wdy < 0 ? -0.15 : 0.55);
        if (leftSide && n.x < 0.25) n = normalize(0.85, 0.35);
        if (!leftSide && n.x > -0.25) n = normalize(-0.85, 0.35);
        ball.x = wing.x + n.x * (wmin + 12);
        ball.y = wing.y + n.y * (wmin + 12);
        ball.vx = n.x * 280 + inward * 40;
        ball.vy = Math.min(ball.vy, 60) + n.y * 120;
        return;
      }
    }

    var onLeftRail = ball.x - r <= 36 + 8 && ball.y > 155 && ball.y < LEFT_INLANE_POST_TOP;
    var onRightPlay =
      ball.x + r >= LAUNCH_LANE_LEFT - 8 &&
      ball.x < LAUNCH_LANE_LEFT + r + 2 &&
      ball.y > 155 &&
      ball.y < LEFT_INLANE_POST_TOP;
    if (onLeftRail && (absVx < 50 || speed < 130)) {
      ball.x = (ball.y >= 175 && ball.y <= 325) ? (88 + r) : (36 + r + 18);
      ball.vx = Math.max(ball.vx, 240);
      if (ball.vy > 120) ball.vy *= 0.55;
      return;
    }
    if (onRightPlay && (absVx < 50 || speed < 130)) {
      ball.x = (ball.y >= 175 && ball.y <= 325) ? (420 - r) : (LAUNCH_LANE_LEFT - r - 18);
      ball.vx = -Math.max(Math.abs(ball.vx), 240);
      if (ball.vy > 120) ball.vy *= 0.55;
      return;
    }
    // Live ping-pong in the slot between right orbit outer and shooter wall
    var rightRt = state.sideRoutes && state.sideRoutes.rightRamp;
    if (state.activeHabitrail === 'ramp-r') {
      rightRt = null;
    }
    if (rightRt && rightRt.segments && ball.y > 70 && ball.y < 360 && ball.x < LAUNCH_LANE_LEFT) {
      var npR = nearestPointOnSegments(ball.x, ball.y, rightRt.segments);
      var inSlot =
        ball.x + r > LAUNCH_LANE_LEFT - 36 &&
        npR &&
        npR.dist < r + 20 &&
        ball.x > npR.x;
      if (inSlot) {
        ball.x = Math.min(ball.x, LAUNCH_LANE_LEFT - r - 20);
        if (npR.x + r + 8 > ball.x) ball.x = npR.x - r - 10;
        ball.vx = -Math.max(Math.abs(ball.vx), 220);
        ball.vy = Math.max(ball.vy, 140);
      }
    }
  }

  function getOutlaneSaverBumper(state) {
    for (var i = 0; i < state.bumpers.length; i++) {
      if (state.bumpers[i].saver) return state.bumpers[i];
    }
    return null;
  }


  function routeChannelDist(ball, route) {
    if (!ball || !route || !route.segments) return 999;
    var nearOuter = nearestPointOnSegments(ball.x, ball.y, route.segments);
    var nearGuide = nearestPointOnSegments(ball.x, ball.y, route.guides);
    var d = nearOuter ? nearOuter.dist : 999;
    if (nearGuide) d = Math.min(d, nearGuide.dist);
    return d;
  }

  function inHabitrailChannel(state, route) {
    var ball = state.ball;
    if (!ball || !route) return false;
    return routeChannelDist(ball, route) < ball.radius + 14;
  }

  /** Mouths + habitrail walls: unstick must not yank a ball leaving a slide. */
  function nearHabitrailMouthOrWall(state) {
    var ball = state.ball;
    if (!ball || !state.sideRoutes) return false;
    var left = state.sideRoutes.leftRamp;
    var right = state.sideRoutes.rightRamp;
    if (inHabitrailChannel(state, left) || inHabitrailChannel(state, right)) return true;
    if (pointInRouteEntry(ball, left && left.entry) || pointInRouteEntry(ball, right && right.entry)) return true;
    function nearPt(pt, rad) {
      return !!(pt && vecLen(ball.x - pt.x, ball.y - pt.y) < rad);
    }
    return false;
  }

  function guardLeftOutlaneShelf(state) {
    // Leftover invisible shelf kick -- left dash/outlane stays open.
    return;
    if (!state.ball.inPlay || !state.exitedLaunchLane) return;
    if (apronAssistsBlocked(state)) return;
    if (inHabitrailChannel(state, state.sideRoutes && state.sideRoutes.leftRamp)) return;
    if (nearHabitrailMouthOrWall(state)) return;
    var ball = state.ball;
    if (ball.y < 470) return;
    var zones = getDrainBounds(state);
    var r = ball.radius;
    // Return assist ABOVE flipper line only â€” never shelf-boost a true drain
    if (ball.y >= FLIPPER_ROW_Y - 8) return;
    if (
      ball.x + r < zones.leftOutlaneRight + 14 &&
      ball.y > LEFT_INLANE_POST_TOP - 40 &&
      ball.y < FLIPPER_ROW_Y - 8
    ) {
      var safeX = zones.leftOutlaneRight + r + 6;
      var saver = getOutlaneSaverBumper(state);
      if (saver && saver.x < 180 && ball.y > saver.y - saver.radius - r - 20 && ball.y < saver.y + saver.radius + r + 20) {
        safeX = Math.max(safeX, saver.x + saver.radius + r + 6);
      }
      if (ball.x < safeX) ball.x = safeX;
      if (ball.vx < 90) ball.vx = 90;
      if (ball.vy > 140) ball.vy -= 40;
    }
  }

  function guardRightOutlaneShelf(state) {
    // Leftover invisible shelf kick -- right dash/outlane stays open.
    return;
    if (!state.ball.inPlay || !state.exitedLaunchLane) return;
    if (apronAssistsBlocked(state)) return;
    if (inHabitrailChannel(state, state.sideRoutes && state.sideRoutes.rightRamp)) return;
    if (nearHabitrailMouthOrWall(state)) return;
    var ball = state.ball;
    if (ball.y < 470) return;
    var zones = getDrainBounds(state);
    var r = ball.radius;
    if (ball.y >= FLIPPER_ROW_Y - 8) return;
    if (
      ball.x - r > zones.rightOutlaneLeft - 14 &&
      ball.x < LAUNCH_LANE_LEFT + 4 &&
      ball.y > LEFT_INLANE_POST_TOP - 40 &&
      ball.y < FLIPPER_ROW_Y - 8
    ) {
      var safeXr = zones.rightOutlaneLeft - r - 6;
      if (ball.x > safeXr) ball.x = safeXr;
      if (ball.vx > -90) ball.vx = -90;
      if (ball.vy > 140) ball.vy -= 40;
    }
  }

  function nudgeInlaneApron(state) {
    if (!state.ball.inPlay || !state.exitedLaunchLane) return;
    if (apronAssistsBlocked(state)) return;
    var ball = state.ball;
    var speed = ballSpeed(ball);
    if (speed > DECK_DRAIN_SPEED) return;
    var zones = getDrainBounds(state);
    var centerX = (zones.centerLeft + zones.centerRight) * 0.5;
    var inLeftInlane = ball.x >= zones.leftOutlaneRight && ball.x <= zones.centerLeft;
    var inRightInlane = ball.x >= zones.centerRight && ball.x <= zones.rightOutlaneLeft;
    var nearFlipRow =
      ball.y > FLIPPER_ROW_Y - ball.radius - 8 && ball.y < FLIPPER_ROW_Y + ball.radius + 6;
    // On/near flipper row in an inlane: slide horizontally into the center hole.
    // Never force +vy here â€” that fought deck bounce and pinned the ball.
    if (nearFlipRow && (inLeftInlane || inRightInlane) && speed < 160) {
      ball.vx += (centerX - ball.x) * 0.55;
      return;
    }
    // Fully below the bats: feed toward center drain with a mild downward floor
    if (ball.y >= FLIPPER_ROW_Y + ball.radius + 2 && (inLeftInlane || inRightInlane) && speed < 160) {
      ball.vx += (centerX - ball.x) * 0.4;
      if (ball.vy < 100) ball.vy = 100;
    }
  }

  function closestPointOnFlipper(ballX, ballY, flipper) {
    var tip = flipperTip(flipper);
    var dx = tip.x - flipper.pivotX;
    var dy = tip.y - flipper.pivotY;
    var segLen = vecLen(dx, dy);
    if (segLen < 1e-6) return null;
    var ux = dx / segLen;
    var uy = dy / segLen;
    var relX = ballX - flipper.pivotX;
    var relY = ballY - flipper.pivotY;
    var t = clamp(dot(relX, relY, ux, uy), 0, segLen);
    var cx = flipper.pivotX + ux * t;
    var cy = flipper.pivotY + uy * t;
    return { t: t, cx: cx, cy: cy, dist: vecLen(ballX - cx, ballY - cy), segLen: segLen, ux: ux, uy: uy };
  }

  /** Discrete capsule hit on either face. Parked = passive; sweeping = slap. */
  function collideBallWithFlipper(state, ball, flipper) {
    var hit = closestPointOnFlipper(ball.x, ball.y, flipper);
    if (!hit) return false;
    var hitDist = ball.radius + flipper.width * 0.5;
    if (hit.dist >= hitDist) return false;

    var n;
    if (hit.dist > 1e-6) {
      n = normalize(ball.x - hit.cx, ball.y - hit.cy);
    } else {
      var nx = -hit.uy;
      var ny = hit.ux;
      if (dot(ball.vx, ball.vy, nx, ny) > 0) {
        nx = -nx;
        ny = -ny;
      }
      if (Math.abs(nx) < 1e-8 && Math.abs(ny) < 1e-8) {
        nx = 0;
        ny = -1;
      }
      n = normalize(nx, ny);
    }
    ball.x = hit.cx + n.x * hitDist;
    ball.y = hit.cy + n.y * hitDist;
    var sweeping = flipperIsSweeping(flipper);
    var rest = sweeping ? FLIPPER_RESTITUTION_SWEEP : FLIPPER_RESTITUTION_PASSIVE;
    var rv = reflectVelocity(ball.vx, ball.vy, n.x, n.y, rest);
    ball.vx = rv.vx;
    ball.vy = rv.vy;

    if (sweeping) {
      var tapMult = flipper.tapBoost ? FLIPPER_TAP_MULT : 1;
      var tipFrac = Math.pow(hit.t / hit.segLen, FLIPPER_TIP_POWER);
      var contactVx = -Math.sin(flipper.angle) * flipper.omega * hit.t;
      var contactVy = Math.cos(flipper.angle) * flipper.omega * hit.t;
      var addVx = contactVx * FLIPPER_IMPULSE_GAIN * tipFrac * tapMult;
      var addVy = contactVy * FLIPPER_IMPULSE_GAIN * tipFrac * tapMult;
      var addSpeed = vecLen(addVx, addVy);
      var maxAdd = FLIPPER_MAX_ADD_SPEED * tapMult;
      if (addSpeed > maxAdd && addSpeed > 1e-6) {
        var scale = maxAdd / addSpeed;
        addVx *= scale;
        addVy *= scale;
      }
      ball.vx += addVx;
      ball.vy += addVy;
      state.lastHitType = 'flipper';
      state.lastHitId = flipper.side;
    }
    return true;
  }

  /**
   * Swept / sub-step capsule tests so a fast ball cannot tunnel a 14px bat
   * in one tick (game dt can be 1/30). Both faces; mains and upper.
   * No extra geometry — hold-both still leaves the center hole.
   */
  function resolveFlipperCollisions(state, dt) {
    var ball = state.ball;
    if (!ball || !ball.inPlay) return;
    var flippers = state.flippers;
    if (!flippers || !flippers.length) return;

    var x1 = ball.x;
    var y1 = ball.y;
    var x0 = ball._prevX != null ? ball._prevX : x1;
    var y0 = ball._prevY != null ? ball._prevY : y1;
    var move = vecLen(x1 - x0, y1 - y0);
    var maxStep = 3.5;
    var steps = Math.max(1, Math.ceil(move / maxStep));

    var i;
    var fi;
    for (i = 0; i <= steps; i++) {
      var u = i / steps;
      ball.x = x0 + (x1 - x0) * u;
      ball.y = y0 + (y1 - y0) * u;
      for (fi = 0; fi < flippers.length; fi++) {
        if (collideBallWithFlipper(state, ball, flippers[fi])) {
          if (dt && u < 1) {
            var rem = (1 - u) * dt;
            if (rem > 1e-8) {
              ball.x += ball.vx * rem;
              ball.y += ball.vy * rem;
              var fj;
              for (fj = 0; fj < flippers.length; fj++) {
                collideBallWithFlipper(state, ball, flippers[fj]);
              }
            }
          }
          return;
        }
      }
    }
  }

  function applyBallDragAndSpeedCeiling(ball) {
    var speed = ballSpeed(ball);
    var speedRatio = clamp(speed / MAX_BALL_SPEED, 0, 1.5);
    var damp = 1 - (BALL_DRAG_BASE + BALL_DRAG_SPEED * speedRatio);
    if (damp < 0.97) damp = 0.97;
    ball.vx *= damp;
    ball.vy *= damp;
    speed = ballSpeed(ball);
    if (speed > MAX_BALL_SPEED) {
      var soft = MAX_BALL_SPEED / speed;
      // Soft blend rather than a hard wall â€” still clamps runaway speeds.
      var blend = 0.55 + 0.45 * soft;
      ball.vx *= blend;
      ball.vy *= blend;
      speed = ballSpeed(ball);
      if (speed > MAX_BALL_SPEED * 1.08) {
        var hard = (MAX_BALL_SPEED * 1.08) / speed;
        ball.vx *= hard;
        ball.vy *= hard;
      }
    }
  }

  function applyPlungerFollow(state) {
    if (!state.plungerFollowFrames || state.plungerFollowFrames <= 0) return;
    if (state.exitedLaunchLane || !state.ball.inPlay) {
      state.plungerFollowFrames = 0;
      return;
    }
    if (!isBallInLaunchLane(state)) {
      state.plungerFollowFrames = 0;
      return;
    }
    var ball = state.ball;
    var target = -state.plungerFollowPower;
    if (ball.vy > target * 0.92) {
      ball.vy = Math.min(ball.vy, target * 0.94);
    }
    state.plungerFollowFrames -= 1;
  }

  function extraLiveBalls(state) {
    var ball = state && state.ball;
    return allLiveBalls(state).filter(function (b) { return b !== ball; });
  }

  function bindBall(state, ball) {
    state.ball = ball;
    if (typeof ball._exited === 'boolean') state.exitedLaunchLane = ball._exited;
    if (Object.prototype.hasOwnProperty.call(ball, '_habitrail')) {
      state.activeHabitrail = ball._habitrail || null;
    }
    if (Object.prototype.hasOwnProperty.call(ball, '_railT')) {
      state.launchRailT = ball._railT;
    }
  }

  function unbindBall(state, ball) {
    ball._exited = !!state.exitedLaunchLane;
    ball._habitrail = state.activeHabitrail;
    ball._railT = state.launchRailT;
  }

  function kickSaucer(state, ball, hole) {
    if (!ball) ball = state.ball;
    if (!hole) hole = saucerHoldingBall(state, ball) || state.saucer;
    if (!hole || !ball) return;
    ball.x = hole.x + 10;
    ball.y = hole.y - 6;
    ball.vx = 200;
    ball.vy = -240;
    ball.inPlay = true;
    hole.captured = false;
    hole.heldBall = null;
    hole.holdT = 0;
    hole.cooldown = 0.55;
    hole.flash = 0.45;
  }

  function awardLock(state, opts) {
    opts = opts || {};
    var alreadyLit = anySaucerLit(state);
    state.lockCount = (state.lockCount || 0) + 1;
    if (state.lockCount >= 1) lightLockSaucers(state, true);
    var startMB = !state.multiball && (state.lockCount >= 2 || alreadyLit);
    if (startMB) {
      if (opts.holdForSaucer && opts.hole) {
        opts.hole._pendingMB = true;
      } else {
        startMultiball(state, opts.ball || state.ball, { keepBall: true });
      }
    }
    return startMB;
  }

  function countLiveBalls(state) {
    return allLiveBalls(state).length;
  }

  function startMultiball(state, currentBall, opts) {
    opts = opts || {};
    if (state.multiball && countLiveBalls(state) >= 2) {
      if (!opts.keepBall) kickSaucer(state, currentBall);
      return;
    }
    state.multiball = true;
    state.multiballBanner = 'MULTIBALL';
    state.multiballBannerLife = 2.4;
    state.lockCount = 0;
    lightLockSaucers(state, false);
    if (!(opts && opts.keepBall)) kickSaucer(state, currentBall);
    if (state.ball) state.ball._exited = true;
    state.exitedLaunchLane = true;
    if (countLiveBalls(state) >= 2) return;
    var b2 = {
      x: LAUNCH_LANE_X,
      y: PLUNGER_REST_Y,
      vx: 8,
      vy: -1080,
      radius: BALL_RADIUS,
      inPlay: true,
      _exited: false,
      _habitrail: null,
      _railT: null
    };
    if (!state.balls) state.balls = [];
    if (state.balls.indexOf(state.ball) < 0) state.balls.push(state.ball);
    state.balls.push(b2);
  }

  function resolveOneSaucer(state, s, dt) {
    if (!s) return;
    var ball = state.ball;
    if (s.captured && s.heldBall === ball) {
      ball.x = s.x;
      ball.y = s.y;
      ball.vx = 0;
      ball.vy = 0;
      s.holdT -= dt;
      if (s.holdT <= 0) {
        s.captured = false;
        s.heldBall = null;
        if (s._pendingMB) {
          s._pendingMB = false;
          startMultiball(state, ball);
        } else {
          kickSaucer(state, ball, s);
        }
      }
      return;
    }
    if (s.captured) return;
    if (s.cooldown > 0) return;
    if (!ball || !ball.inPlay || !state.exitedLaunchLane) return;
    if (saucerHoldingBall(state, ball)) return;
    var dist = vecLen(ball.x - s.x, ball.y - s.y);
    if (dist < s.radius + ball.radius * 0.42) {
      s.captured = true;
      s.heldBall = ball;
      s.holdT = s.holdSec;
      ball.x = s.x;
      ball.y = s.y;
      ball.vx = 0;
      ball.vy = 0;
      s.flash = 0.6;
      var holeId = 'saucer';
      if (s === state.saucer2) holeId = 'saucer2';
      else if (s === state.saucer3) holeId = 'saucer3';
      awardScore(state, s.score, 'saucer', holeId, s.x, s.y);
      awardLock(state, { holdForSaucer: true, hole: s, ball: ball });
    }
  }

  function resolveSaucer(state, dt) {
    var list = saucersOf(state);
    var i;
    for (i = 0; i < list.length; i++) resolveOneSaucer(state, list[i], dt);
  }

  function resolveGateSpinner(state) {
    var g = state.gateSpinner;
    if (!g) return;
    var ball = state.ball;
    if (ball && ball.inPlay) {
      var inY = ball.y > g.y - g.h * 0.5 && ball.y < g.y + g.h * 0.5;
      var dx = ball.x - g.x;
      if (inY && Math.abs(dx) < ball.radius + 7) {
        if (g.hitCooldown <= 0) {
          awardScore(state, g.score, 'spinner', 'gate', g.x, g.y);
          g.hitCooldown = HIT_COOLDOWN_SPINNER;
          g.spinVel += Math.max(0.45, Math.abs(ball.vx) * 0.009 + Math.abs(ball.vy) * 0.003);
        }
      }
    }
    g.angle += g.spinVel;
    if (Math.abs(g.spinVel) < 0.0015) g.spinVel = 0;
    else g.spinVel *= 0.978;
  }

  function stepOneBallPhysics(state, dt) {
    var ball = state.ball;
    if (saucerHoldingBall(state, ball)) {
      resolveSaucer(state, dt);
      resolveGateSpinner(state);
      return;
    }
    ball._prevX = ball.x;
    ball._prevY = ball.y;
    ball.vy += GRAVITY * dt;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    applyPlungerFollow(state);
    guideShooterLane(state, dt);
    blockShooterLaneIntrusion(state);
    resolveWallCollisions(state);
    ejectSausageInteriors(state);
    unstickTriangleInterior(state);
    assistHabitrails(state, dt);
    peelLeftInlaneWedge(state);
    guardLeftOutlaneShelf(state);
    guardRightOutlaneShelf(state);
    resolveSlingshotCollisions(state);
    resolvePulseTriangle(state);
    resolveBumperCollisions(state);
    collideBoinger(state);
    unstickFromBumpers(state);
    unstickTriangle500(state);
    unstickFromCorners(state);
    unstickWallSlide(state);
    unstickCopperMergePocket(state);
    unstickSausageCusp(state, dt);
    unstickHorseshoeCrown(state, dt);
    resolvePostCollisions(state);
    resolveKickerCollisions(state);
    resolveTargetCollisions(state);
    resolveDropTargetCollisions(state);
    resolveSideRouteCollisions(state);
    resolveRolloverCollisions(state);
    resolveSpinnerCollision(state);
    resolveGateSpinner(state);
    resolveSaucer(state, dt);

    if (!isBallInLaunchLane(state)) {
      resolveFlipperCollisions(state, dt);
      resolveFlipperPivotCollisions(state);
      unstickFromFlippers(state);
      nudgeInlaneApron(state);
    } else if (state.exitedLaunchLane) {
      ejectFromShooterLaneApron(state);
    }

    if (state.skillShotWindow && state.exitedLaunchLane) {
      var topBumper = state.bumpers[0];
      var gradeInfo = gradeSkillShot(ball, topBumper);
      if (gradeInfo) {
        applySkillShot(state, gradeInfo);
      }
    }

    applyBallDragAndSpeedCeiling(ball);
  }

  function stepPhysics(state, dt) {
    dt = clamp(dt, 0.001, 0.05);
    updateFlippers(state, dt);

    var extras = extraLiveBalls(state);
    if (!state.ball.inPlay && !extras.length) return state;

    if (!extras.length) {
      if (!state.ball.inPlay) return state;
      stepOneBallPhysics(state, dt);
      return state;
    }

    var pack = [state.ball].concat(extras);
    var i;
    var primary = state.ball;
    unbindBall(state, primary);
    for (i = 0; i < pack.length; i++) {
      if (!pack[i] || !pack[i].inPlay) continue;
      bindBall(state, pack[i]);
      stepOneBallPhysics(state, dt);
      unbindBall(state, pack[i]);
    }
    var keep = primary && primary.inPlay ? primary : null;
    if (!keep) {
      for (i = 0; i < pack.length; i++) {
        if (pack[i] && pack[i].inPlay) { keep = pack[i]; break; }
      }
    }
    if (keep) bindBall(state, keep);
    return state;
  }

  function activateFlipper(state, side, active) {
    state.flippers.forEach(function (f) {
      if (f.side !== side) return;
      var next = !!active;
      if (next && !f.active) {
        f.pressAge = 0;
        if (f.chargeLeft > 0) {
          // Already flashing — flip only; do not re-arm or chain into a new charge.
          f.sinceLastPress = 99;
        } else if ((f.sinceLastPress != null ? f.sinceLastPress : 99) <= FLIPPER_DBL_TAP_WINDOW) {
          f.chargeLeft = FLIPPER_CHARGE_SEC;
          f.glowPhase = 0;
          f.tapBoost = true;
          f.sinceLastPress = 0;
        } else {
          f.sinceLastPress = 0;
        }
      }
      f.active = next;
    });
    return state;
  }

  function setLaunchCharging(state, charging) {
    state.launchCharging = !!charging;
    if (!state.launchCharging) state.launchPower = 0;
    return state;
  }

  function chargeLaunch(state, dt) {
    if (state.launchCharging && !state.ball.inPlay) {
      // Hold at full power (1.0). Do NOT wrap â€” wrapping made the red max meter
      // drop to ~0 and launch weakly right when the bar looked full.
      state.launchPower = Math.min(1, state.launchPower + dt * LAUNCH_CHARGE_RATE);
    }
    return state;
  }

  function easeLaunchMeter(meter) {
    var m = clamp(meter, 0, 1);
    // Linear when EASE=1: the bar fill IS the speed fraction.
    return Math.pow(m, LAUNCH_METER_EASE);
  }

  function meterToLaunchPower(meter) {
    return MIN_LAUNCH_POWER + easeLaunchMeter(meter) * (MAX_LAUNCH_POWER - MIN_LAUNCH_POWER);
  }

  function launchBall(state, power) {
    if (state.ball.inPlay || countLiveBalls(state) > 0 || state.ballsRemaining <= 0) return state;
    var p;
    var chargeU;
    if (power != null && power > 1) {
      p = clamp(power, MIN_LAUNCH_POWER, MAX_LAUNCH_POWER);
      chargeU = (p - MIN_LAUNCH_POWER) / (MAX_LAUNCH_POWER - MIN_LAUNCH_POWER);
    } else if (power != null) {
      chargeU = easeLaunchMeter(power);
      p = MIN_LAUNCH_POWER + chargeU * (MAX_LAUNCH_POWER - MIN_LAUNCH_POWER);
    } else {
      chargeU = easeLaunchMeter(state.launchPower);
      p = MIN_LAUNCH_POWER + chargeU * (MAX_LAUNCH_POWER - MIN_LAUNCH_POWER);
    }
    state.ball.inPlay = true;
    state.ball._exited = false;
    state.ball.x = LAUNCH_LANE_X;
    state.ball.y = PLUNGER_REST_Y;
    // Gauge is speed only — no hidden English off the bar.
    state.ball.vx = 0;
    state.ball.vy = -p;
    state.exitedLaunchLane = false;
    state.skillShotWindow = false;
    state.launchTick = 0;
    state.launchRailT = null;
    state.activeLaunchPower = p;
    state.launchChargeU = chargeU;
    state.plungerFollowFrames = PLUNGER_FOLLOW_FRAMES;
    state.plungerFollowPower = p;
    state.phase = 'playing';
    state.launchPower = 0;
    state.launchCharging = false;
    return state;
  }

  function ballShouldDrain(state, ball) {
    if (!ball || !ball.inPlay) return false;
    var zones = getDrainBounds(state);
    var drainZone = isBallInDrainZone(ball, zones);
    if (drainZone) {
      if (ball.y - ball.radius > DRAIN_Y) return true;
      if (ball.y > TABLE_H - 28) return true;
    }
    if (ball.y > TABLE_H + 40) return true;
    return false;
  }

  function retireDrainedBall(state, ball) {
    ball.inPlay = false;
    ball.vx = 0;
    ball.vy = 0;
    ball.y = TABLE_H + 80;
    if (state.balls) {
      state.balls = state.balls.filter(function (b) { return b !== ball && b && b.inPlay; });
      if (!state.balls.length) state.balls = null;
    }
  }

  function checkDrain(state) {
    var extras = extraLiveBalls(state);
    if (!state.ball.inPlay && !extras.length) return state;

    if (!extras.length) {
      var ball = state.ball;
      if (!ball.inPlay) return state;
      if (!state.exitedLaunchLane && isBallInLaunchLane(state)) {
        if (ball.y > PLUNGER_REST_Y + 8 && ball.vy > 0) resetBallToPlunger(state);
        return state;
      }
      var zones = getDrainBounds(state);
      var drainZone = isBallInDrainZone(ball, zones);
      if (drainZone) {
        if (ball.y - ball.radius > DRAIN_Y) return performDrain(state);
        if (ball.y > TABLE_H - 28) return performDrain(state);
      }
      if (ball.y > TABLE_H + 40) return performDrain(state);
      if (ball.y + ball.radius > FLIPPER_ROW_Y && ball.vy > 0 && !drainZone) {
        var nudge = zones.centerLeft + (zones.centerRight - zones.centerLeft) * 0.5;
        ball.vx += (nudge - ball.x) * 2.5 * 0.016;
      }
      return state;
    }

    var pack = [state.ball].concat(extras);
    var i;
    var lost = [];
    for (i = 0; i < pack.length; i++) {
      if (!pack[i] || !pack[i].inPlay) continue;
      var savedBall = state.ball;
      var savedEx = state.exitedLaunchLane;
      bindBall(state, pack[i]);
      if (!state.exitedLaunchLane && isBallInLaunchLane(state)) {
        if (pack[i].y > PLUNGER_REST_Y + 8 && pack[i].vy > 0) {
          pack[i].x = LAUNCH_LANE_X;
          pack[i].y = PLUNGER_REST_Y;
          pack[i].vx = 0;
          pack[i].vy = 0;
        }
      } else if (ballShouldDrain(state, pack[i])) {
        lost.push(pack[i]);
      }
      unbindBall(state, pack[i]);
      state.ball = savedBall;
      state.exitedLaunchLane = savedEx;
    }
    if (lost.length) {
      for (i = 0; i < lost.length; i++) retireDrainedBall(state, lost[i]);
      var live = [];
      if (state.ball && state.ball.inPlay) live.push(state.ball);
      live = live.concat(extraLiveBalls(state));
      if (live.length) {
        state.ball = live[0];
        bindBall(state, live[0]);
        state.drainFlash = 0.28;
        if (live.length < 2) state.multiball = false;
        return state;
      }
      return performDrain(state);
    }
    return state;
  }

  function tilt(state) {
    if (!state.ball.inPlay || state.phase === 'game_over') return state;
    if (state.tiltCooldown > 0) return state;
    state.tiltCooldown = TILT_COOLDOWN;
    var ball = state.ball;
    ball.vx += (Math.random() - 0.25) * 520;
    ball.vy += -260 + Math.random() * 180;
    state.tiltWarnings += 1;
    state.lastHitType = 'tilt';
    state.lastScorePopup = {
      points: 0,
      x: TABLE_W * 0.5,
      y: TABLE_H * 0.34,
      life: 1.35,
      type: state.tiltWarnings > MAX_TILT_WARNINGS ? 'tiltout' : 'tilt'
    };
    if (state.tiltWarnings > MAX_TILT_WARNINGS) {
      state.tiltWarnings = 0;
      performDrain(state);
    }
    return state;
  }

  function tick(state, dt) {
    if (state.phase === 'eob_bonus') {
      decayCombo(state, dt);
      updateEndOfBallBonus(state, dt);
      return state;
    }
    ensureBallAtPlunger(state);
    decayCombo(state, dt);
    chargeLaunch(state, dt);
    stepBoinger(state, dt);
    stepPulseTriangle(state, dt);
    stepPhysics(state, dt);
    updateLaunchLaneDashes(state, dt);
    checkDrain(state);
    ensureBallAtPlunger(state);
    return state;
  }

  var api = {
    GRAVITY: GRAVITY,
    GRAVITY_1G: GRAVITY_1G,
    TABLE_PITCH_DEG: TABLE_PITCH_DEG,
    ARCH_CX: ARCH_CX,
    ARCH_CY: ARCH_CY,
    ARCH_RX: ARCH_RX,
    ARCH_RY: ARCH_RY,
    BUMPER_RESTITUTION: BUMPER_RESTITUTION,
    MIN_BUMPER_EXIT_SPEED: MIN_BUMPER_EXIT_SPEED,
    RUBBER_BUMPER_RESTITUTION: RUBBER_BUMPER_RESTITUTION,
    RUBBER_BUMPER_EXIT_SPEED: RUBBER_BUMPER_EXIT_SPEED,
    RUBBER_BUMPER_SCORE: RUBBER_BUMPER_SCORE,
    HABITRAIL_RESTITUTION: HABITRAIL_RESTITUTION,
    HABITRAIL_MIN_SPEED: HABITRAIL_MIN_SPEED,
    BALL_DRAG_BASE: BALL_DRAG_BASE,
    BALL_DRAG_SPEED: BALL_DRAG_SPEED,
    BALL_RADIUS: BALL_RADIUS,
    TABLE_W: TABLE_W,
    TABLE_H: TABLE_H,
    DRAIN_Y: DRAIN_Y,
    BALL_SAVE_DURATION: BALL_SAVE_DURATION,
    DRAIN_SLOT_TOP: DRAIN_SLOT_TOP,
    DRAIN_SLOT_H: DRAIN_SLOT_H,
    LAUNCH_LANE_X: LAUNCH_LANE_X,
    LAUNCH_LANE_LEFT: LAUNCH_LANE_LEFT,
    LAUNCH_LANE_RIGHT: LAUNCH_LANE_RIGHT,
    PLUNGER_REST_Y: PLUNGER_REST_Y,
    PLUNGER_FOLLOW_FRAMES: PLUNGER_FOLLOW_FRAMES,
    LAUNCH_LANE_TOP: LAUNCH_LANE_TOP,
    LAUNCH_WIRE_Y1: LAUNCH_WIRE_Y1,
    LAUNCH_WIRE_Y2: LAUNCH_WIRE_Y2,
    LAUNCH_WIRE_X2: LAUNCH_WIRE_X2,
    LEFT_INLANE_POST_TOP: LEFT_INLANE_POST_TOP,
    FLIPPER_INLANE_X: FLIPPER_INLANE_X,
    MAX_LAUNCH_POWER: MAX_LAUNCH_POWER,
    MIN_LAUNCH_POWER: MIN_LAUNCH_POWER,
    LAUNCH_CHARGE_RATE: LAUNCH_CHARGE_RATE,
    MAX_BALL_SPEED: MAX_BALL_SPEED,
    FLIPPER_SPEED: FLIPPER_SPEED,
    FLIPPER_OMEGA_DEAD: FLIPPER_OMEGA_DEAD,
    FLIPPER_RESTITUTION_PASSIVE: FLIPPER_RESTITUTION_PASSIVE,
    FLIPPER_RESTITUTION_SWEEP: FLIPPER_RESTITUTION_SWEEP,
    HABITRAIL_ASSIST: HABITRAIL_ASSIST,
    TRIANGLE_SPIN: TRIANGLE_SPIN,
    TRIANGLE_HIT_SPIN_GAIN: TRIANGLE_HIT_SPIN_GAIN,
    TRIANGLE_SPIN_MAX: TRIANGLE_SPIN_MAX,
    TRIANGLE_SPIN_FRICTION: TRIANGLE_SPIN_FRICTION,
    TRIANGLE_SPIN_STOP: TRIANGLE_SPIN_STOP,
    TRIANGLE_UP_SEC: TRIANGLE_UP_SEC,
    TRIANGLE_DOWN_SEC: TRIANGLE_DOWN_SEC,
    TRIANGLE_CYCLE_SEC: TRIANGLE_CYCLE_SEC,
    TRIANGLE_RUBBER_MULT: TRIANGLE_RUBBER_MULT,
    triangleIsUp: triangleIsUp,
    createUpperRightFlipper: createUpperRightFlipper,
    FLIPPER_IMPULSE_GAIN: FLIPPER_IMPULSE_GAIN,
    FLIPPER_TAP_MULT: FLIPPER_TAP_MULT,
    FLIPPER_DBL_TAP_WINDOW: FLIPPER_DBL_TAP_WINDOW,
    FLIPPER_CHARGE_SEC: FLIPPER_CHARGE_SEC,
    FLIPPER_GLOW_HZ_START: FLIPPER_GLOW_HZ_START,
    FLIPPER_GLOW_HZ_END: FLIPPER_GLOW_HZ_END,
    FLIPPER_MAX_ADD_SPEED: FLIPPER_MAX_ADD_SPEED,
    FLIPPER_TIP_POWER: FLIPPER_TIP_POWER,
    FLIPPER_PIVOT_SPACING: FLIPPER_PIVOT_SPACING,
    FLIPPER_LEFT_PIVOT_X: FLIPPER_LEFT_PIVOT_X,
    FLIPPER_RIGHT_PIVOT_X: FLIPPER_RIGHT_PIVOT_X,
    FLIPPER_ROW_Y: FLIPPER_ROW_Y,
    flipperIsSweeping: flipperIsSweeping,
    MAX_MULTIPLIER: MAX_MULTIPLIER,
    SKILL_SHOT_BONUS: SKILL_SHOT_BONUS,
    SKILL_SHOT_CENTER_BONUS: SKILL_SHOT_CENTER_BONUS,
    SKILL_SHOT_NEAR_BONUS: SKILL_SHOT_NEAR_BONUS,
    LAUNCH_DASH_FULL_BONUS: LAUNCH_DASH_FULL_BONUS,
    MAX_TILT_WARNINGS: MAX_TILT_WARNINGS,
    LAUNCH_ENGLISH_MAX: LAUNCH_ENGLISH_MAX,
    meterToLaunchPower: meterToLaunchPower,
    easeLaunchMeter: easeLaunchMeter,
    launchChargeU: launchChargeU,
    LAUNCH_METER_EASE: LAUNCH_METER_EASE,
    canChargePlunger: canChargePlunger,
    ensureBallAtPlunger: ensureBallAtPlunger,
    createInitialState: createInitialState,
    stepPhysics: stepPhysics,
    activateFlipper: activateFlipper,
    setLaunchCharging: setLaunchCharging,
    chargeLaunch: chargeLaunch,
    launchBall: launchBall,
    tilt: tilt,
    checkDrain: checkDrain,
    tick: tick,
    flipperTip: flipperTip,
    getDrainBounds: getDrainBounds,
    getRestDrainBounds: getRestDrainBounds,
    awardScore: awardScore,
    gradeSkillShot: gradeSkillShot,
    applySkillShot: applySkillShot,
    allLaunchDashesLit: allLaunchDashesLit,
    performDrain: performDrain,
    startRushMode: startRushMode,
    setThemeId: setThemeId,
    beginEndOfBallBonus: beginEndOfBallBonus,
    updateEndOfBallBonus: updateEndOfBallBonus,
    allDropsDown: allDropsDown,
    resetDropTargets: resetDropTargets,
    RUSH_MODE_DURATION: RUSH_MODE_DURATION,
    RUSH_SCORE_MULT: RUSH_SCORE_MULT,
    EOB_DURATION: EOB_DURATION,
    DROP_BANK_SIZE: DROP_BANK_SIZE,
    topArchFloorY: topArchFloorY,
    ellipseArcSegments: ellipseArcSegments,
    createBoinger: createBoinger,
    createBoingers: createBoingers,
    boingersOf: boingersOf,
    stepBoinger: stepBoinger,
    collideBoinger: collideBoinger,
    createPulseTriangle: createPulseTriangle,
    stepPulseTriangle: stepPulseTriangle,
    resolvePulseTriangle: resolvePulseTriangle,
    triangleSidePulse: triangleSidePulse,
    ballInsideTriangle: ballInsideTriangle,
    unstickTriangleInterior: unstickTriangleInterior,
    countLiveBalls: countLiveBalls,
    extraLiveBalls: extraLiveBalls,
    allLiveBalls: allLiveBalls,
    BOINGER_X: BOINGER_X,
    BOINGER_Y: BOINGER_Y,
    BOINGER_B_X: BOINGER_B_X,
    BOINGER_B_Y: BOINGER_B_Y,
    BOINGER_C_X: BOINGER_C_X,
    BOINGER_C_Y: BOINGER_C_Y,
    BOINGER_R: BOINGER_R,
    BOINGER_UP_SEC: BOINGER_UP_SEC,
    BOINGER_DOWN_SEC: BOINGER_DOWN_SEC,
    BOINGER_RESTITUTION: BOINGER_RESTITUTION,
    BOINGER_EXIT_SPEED: BOINGER_EXIT_SPEED,
    BOINGER_SCORE: BOINGER_SCORE
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof root !== 'undefined') {
    root.PinballSim = api;
  }
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
