/**
 * Pure pinball simulation — no DOM, no rendering.
 * Loadable in browser (window.PinballSim) and Node (module.exports).
 */
(function (root) {
  'use strict';

  var GRAVITY = 1240;
  var BALL_RADIUS = 12;
  var TABLE_W = 480;
  var TABLE_H = 860;
  var FLIPPER_INLANE_X = 88;
  var LEFT_INLANE_POST_TOP = 400;
  var FLIPPER_ROW_Y = TABLE_H - 148;
  var FLIPPER_LEFT_PIVOT_X = Math.round(4.5 / 20.25 * TABLE_W);
  var FLIPPER_RIGHT_PIVOT_X = Math.round(11.625 / 20.25 * TABLE_W);
  var FLIPPER_PIVOT_SPACING = FLIPPER_RIGHT_PIVOT_X - FLIPPER_LEFT_PIVOT_X;
  var FLIPPER_LEN = Math.round(2.75 / 20.25 * TABLE_W);
  var FLIPPER_W = 14;
  var FLIPPER_PIVOT_R = 16;
  var FLIPPER_SPEED = 14;
  /** Powered bat slap only while |omega| exceeds this (rad/s). */
  var FLIPPER_OMEGA_DEAD = 2;
  /** Scales tip velocity → ball Δv while sweeping. */
  var FLIPPER_IMPULSE_GAIN = 0.85;
  /** Cap on powered add-speed from a flipper slap (px/s). */
  var FLIPPER_MAX_ADD_SPEED = 1150;
  /** Tip-weight exponent on contact fraction t/segLen. */
  var FLIPPER_TIP_POWER = 1.2;
  var FLIPPER_RESTITUTION_SWEEP = 1.26;
  var FLIPPER_RESTITUTION_PASSIVE = 1.05;
  var DECK_DRAIN_SPEED = 220;
  var WALL_RESTITUTION = 0.72;
  /** Habitrail/guide bounce — livelier than cabinet rails so channels do not crawl. */
  var HABITRAIL_RESTITUTION = 0.92;
  var GUIDE_RESTITUTION = 0.88;
  /** Min along-rail speed (px/s) while ball is inside a habitrail channel. */
  var HABITRAIL_MIN_SPEED = 240;
  /** Continuous along-path assist while riding a habitrail (px/s^2). */
  var HABITRAIL_ASSIST = 520;
  var BUMPER_RESTITUTION = 1.15;
  var FLIPPER_RESTITUTION = FLIPPER_RESTITUTION_PASSIVE;
  var SLING_RESTITUTION = 1.08;
  var KICKER_RESTITUTION = 1.2;
  /** Soft ball speed ceiling (px/s). */
  var MAX_BALL_SPEED = 1600;
  /** Base linear damp per physics step (~16ms); rises with speed. */
  var BALL_DRAG_BASE = 0.0007;
  var BALL_DRAG_SPEED = 0.0014;
  var MAX_LAUNCH_POWER = 1400;
  var MIN_LAUNCH_POWER = 200;
  var LAUNCH_CHARGE_RATE = 1.1;
  /** Meter→power ease exponent (1 = linear). */
  var LAUNCH_METER_EASE = 1.25;
  /** Frames of plunger follow thrust while still in shooter lane. */
  var PLUNGER_FOLLOW_FRAMES = 3;
  /** Max |vx| English from launch charge (aim skill). */
  var LAUNCH_ENGLISH_MAX = 12;
  var DRAIN_SLOT_TOP = TABLE_H - 14;
  var DRAIN_SLOT_H = 12;
  var DRAIN_Y = DRAIN_SLOT_TOP - BALL_RADIUS;
  /** Seconds of ball-save after a CENTER skill shot before it expires unused. */
  var BALL_SAVE_DURATION = 8;
  var HIT_COOLDOWN_SPINNER = 0.35;
  var HIT_COOLDOWN_SLING = 0.18;
  var SLING_KICK_GAIN = 1.05;
  var SLING_KICK_MIN = 90;
  var SLING_KICK_MAX = 300;
  var SLING_UP_BIAS = 0.38;
  var HIT_COOLDOWN_BUMPER = 0.24;
  var MIN_BUMPER_EXIT_SPEED = 185;
  var SAVER_BUMPER_EXIT_SPEED = 150;
  var BUMPER_UNSTICK_SPEED = 125;
  var MAX_TILT_WARNINGS = 2;
  var TILT_COOLDOWN = 0.55;
  var LAUNCH_LANE_X = TABLE_W - 62;
  var LAUNCH_LANE_LEFT = TABLE_W - 88;
  var LAUNCH_LANE_RIGHT = TABLE_W - 36;
  var PLUNGER_REST_Y = TABLE_H - 88;
  var LAUNCH_LANE_TOP = TABLE_H - 200;
  var LAUNCH_WIRE_Y1 = 130;
  var LAUNCH_WIRE_Y2 = 94;
  var LAUNCH_WIRE_X2 = 252;
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
  /** @deprecated alias — center grade (tests / exports) */
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
      active: false,
      omega: 0
    };
  }

  /**
   * Classic 3-bumper triangle high on the table + optional lower feeder.
   * Clears mid-table for left/right orbits; saver stays near left outlane.
   * bumpers[0] remains the skill-shot apex.
   */
  function createBumpers() {
    return [
      // Skill / apex - keep clear of arch pocket
      { x: 240, y: 198, radius: 26, score: 500, color: '#ff3366', kind: 'bumper', hitCooldown: 0 },
      // Upper wings - inset so ball cannot pinch vs outer rail / habitrail guide
      { x: 200, y: 252, radius: 22, score: 300, color: '#33ccff', kind: 'bumper', hitCooldown: 0 },
      { x: 268, y: 252, radius: 22, score: 300, color: '#ffcc00', kind: 'bumper', hitCooldown: 0 },
      // Single lower feeder (above drop bank; mid toys fill empty band above)
      { x: 240, y: 455, radius: 16, score: 180, color: '#cc66ff', kind: 'bumper', hitCooldown: 0 },
      {
        // Weaker / smaller saver - outlane tension
        x: 138,
        y: 478,
        radius: 14,
        score: 120,
        color: '#55ffaa',
        kind: 'bumper',
        saver: true,
        id: 'outlane-saver',
        hitCooldown: 0
      }
    ];
  }

  function createSlingshots() {
    var rightInlaneX = FLIPPER_RIGHT_PIVOT_X + 18;
    return [
      {
        side: 'left',
        x1: FLIPPER_INLANE_X,
        y1: FLIPPER_ROW_Y - 4,
        x2: FLIPPER_LEFT_PIVOT_X - 6,
        y2: FLIPPER_ROW_Y - 42,
        score: 150,
        cooldown: 0
      },
      {
        side: 'right',
        x1: rightInlaneX,
        y1: FLIPPER_ROW_Y - 4,
        x2: FLIPPER_RIGHT_PIVOT_X + 6,
        y2: FLIPPER_ROW_Y - 42,
        score: 150,
        cooldown: 0
      }
    ];
  }

  function createTargets() {
    return [
      { id: 'standup-l', x: 118, y: 540, w: 10, h: 30, score: 1000, lit: true, flash: 0, occupied: false },
      { id: 'standup-r', x: 362, y: 540, w: 10, h: 30, score: 1000, lit: true, flash: 0, occupied: false },
      { id: 'standup-c', x: 240, y: 575, w: 10, h: 26, score: 1500, lit: false, flash: 0, occupied: false },
      // Mid-field standup bank (readable toys; keeps side orbits clear)
      { id: 'standup-m1', x: 200, y: 338, w: 10, h: 26, score: 800, lit: true, flash: 0, occupied: false },
      { id: 'standup-m2', x: 240, y: 338, w: 10, h: 26, score: 800, lit: false, flash: 0, occupied: false },
      { id: 'standup-m3', x: 280, y: 338, w: 10, h: 26, score: 800, lit: true, flash: 0, occupied: false }
    ];
  }

  /** Horizontal drop bank mid-table — complete all → rush mode */
  function createDropTargets() {
    var drops = [];
    var baseX = 188;
    var y = 488;
    var i;
    for (i = 0; i < DROP_BANK_SIZE; i++) {
      drops.push({
        id: 'drop-' + i,
        x: baseX + i * 28,
        y: y,
        w: 20,
        h: 12,
        down: false,
        score: 350,
        occupied: false,
        flash: 0
      });
    }
    return drops;
  }

  /**
   * Side routes: left captive post, left orbit/slide ramp, right habitrail.
   * Travel geometry lives as wall segments (see createHabitrailWalls);
   * routes hold entry sensors + draw polylines + mild ride boosts.
   */
  function createSideRoutes() {
    return {
      leftCaptive: {
        id: 'captive-l',
        x: 62,
        y: 318,
        radius: 12,
        score: 650,
        cooldown: 0
      },
      leftRamp: {
        id: 'ramp-l',
        score: 800,
        cooldown: 0,
        entry: { x: 78, y: 545, w: 36, h: 40 },
        exit: { x: 150, y: 148 },
        boost: 340,
        // Wider outer/inner gap so ball cannot pinch & crawl
        segments: [
          { x1: 68, y1: 560, x2: 50, y2: 470 },
          { x1: 50, y1: 470, x2: 40, y2: 360 },
          { x1: 40, y1: 360, x2: 38, y2: 245 },
          { x1: 38, y1: 245, x2: 52, y2: 175 },
          { x1: 52, y1: 175, x2: 100, y2: 140 },
          { x1: 100, y1: 140, x2: 150, y2: 136 }
        ],
        guides: [
          { x1: 108, y1: 555, x2: 96, y2: 465 },
          { x1: 96, y1: 465, x2: 90, y2: 355 },
          { x1: 90, y1: 355, x2: 88, y2: 250 },
          { x1: 88, y1: 250, x2: 106, y2: 180 }
        ]
      },
      rightRamp: {
        id: 'ramp-r',
        score: 750,
        cooldown: 0,
        entry: { x: 355, y: 540, w: 34, h: 44 },
        exit: { x: 285, y: 150 },
        boost: 360,
        // Stay left of shooter lane; widen channel vs crawl
        segments: [
          { x1: 384, y1: 555, x2: 378, y2: 450 },
          { x1: 378, y1: 450, x2: 372, y2: 330 },
          { x1: 372, y1: 330, x2: 360, y2: 215 },
          { x1: 360, y1: 215, x2: 332, y2: 158 },
          { x1: 332, y1: 158, x2: 295, y2: 142 }
        ],
        guides: [
          { x1: 346, y1: 550, x2: 340, y2: 445 },
          { x1: 340, y1: 445, x2: 334, y2: 330 },
          { x1: 334, y1: 330, x2: 326, y2: 225 },
          { x1: 326, y1: 225, x2: 308, y2: 168 }
        ],
        x1: LAUNCH_LANE_LEFT - 14,
        y1: 540,
        x2: LAUNCH_LANE_LEFT - 60,
        y2: 200
      }
    };
  }

  /** Habitrail / orbit wall segments shared by createWalls. */
  function createHabitrailWalls() {
    var routes = createSideRoutes();
    var walls = [];
    function pushPath(segs, kind) {
      if (!segs) return;
      var i;
      for (i = 0; i < segs.length; i++) {
        walls.push({
          x1: segs[i].x1,
          y1: segs[i].y1,
          x2: segs[i].x2,
          y2: segs[i].y2,
          kind: kind
        });
      }
    }
    pushPath(routes.leftRamp.segments, 'habitrail');
    pushPath(routes.leftRamp.guides, 'guide');
    pushPath(routes.rightRamp.segments, 'habitrail');
    pushPath(routes.rightRamp.guides, 'guide');
    return walls;
  }

  function createRollovers() {
    return [
      { id: 'lane-l', x1: 72, y1: 180, x2: 72, y2: 280, width: 18, score: 500, lit: false, occupied: false },
      // Playfield side of launch wall (not inside shooter lane)
      { id: 'lane-r', x1: LAUNCH_LANE_LEFT - 36, y1: 260, x2: LAUNCH_LANE_LEFT - 36, y2: 360, width: 18, score: 500, lit: false, occupied: false },
      // Mid-field rollover — shot path without bumper party
      { id: 'lane-mid', x1: 195, y1: 412, x2: 285, y2: 412, width: 16, score: 600, lit: false, occupied: false }
    ];
  }

  /**
   * Vertical dash lights centered in the launch/shooter lane.
   * Light when the ball travels over each segment (bottom → top on launch).
   * Index 0 = nearest plunger; last = nearest wireform.
   */
  function createLaunchLaneDashes() {
    var dashes = [];
    var count = 9;
    var yBot = PLUNGER_REST_Y - 40;
    var yTop = LAUNCH_WIRE_Y1 + 28;
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
        intensity: 0,
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
    // Above flipper line, clear of rest pose — feed cross-shots without trapping bats
    return [
      { id: 'kicker-l', x: 148, y: 575, radius: 14, score: 750, color: '#ff8844' },
      { id: 'kicker-r', x: 332, y: 575, radius: 14, score: 750, color: '#44ffaa' }
    ];
  }

  /** Small mid-field posts — deflect without recreating bumper chaos. */
  function createPosts() {
    return [
      { id: 'post-ml', x: 175, y: 385, radius: 9, score: 200, color: '#88ccee', flash: 0 },
      { id: 'post-mr', x: 305, y: 385, radius: 9, score: 200, color: '#eecc88', flash: 0 },
      // Above outlanes: kick outer-wall slides inward (not 100% death)
      { id: 'post-ol-l', x: 66, y: 500, radius: 11, score: 150, color: '#88ffcc', flash: 0 },
      { id: 'post-ol-r', x: LAUNCH_LANE_LEFT - 44, y: 500, radius: 11, score: 150, color: '#ffcc88', flash: 0 }
    ];
  }

  /** Ellipse arc as wall segments (canvas y+ down). a0→a1 radians. */
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
    // Match createWalls top ellipse: cx=240, cy=100, rx=200, ry=52, upper half
    var cx = TABLE_W * 0.5;
    var cy = 100;
    var rx = 200;
    var ry = 52;
    var dx = (x - cx) / rx;
    if (dx < -1) dx = -1;
    if (dx > 1) dx = 1;
    // Upper half of ellipse: y = cy - ry * sqrt(1 - dx^2)  (smaller y = higher on screen)
    return cy - ry * Math.sqrt(Math.max(0, 1 - dx * dx));
  }

  function createSpinner() {
    // Left under arch — clear of apex bumper (240,198) and left habitrail exit (~150,136)
    return { x: 168, y: 124, radius: 16, angle: 0, score: 200, spinVel: 0, hitCooldown: 0 };
  }

  function getRestDrainBounds() {
    var leftRest = createFlipper('left');
    var rightRest = createFlipper('right');
    var lt = flipperTip(leftRest);
    var rt = flipperTip(rightRest);
    return {
      // Slightly greedier drains (P1 outlane tension)
      centerLeft: lt.x + 4,
      centerRight: rt.x - 4,
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
    var drainL = lt.x + 6;
    var drainR = rt.x - 6;
    var rightInlaneX = FLIPPER_RIGHT_PIVOT_X + 18;
    var chuteBottom = TABLE_H - 16;
    var walls = [];

    // Rounded top arch (ball rides underside — green path annotation)
    // Ellipse upper half: PI → 2PI (left → top center → right)
    var archCx = TABLE_W * 0.5;
    var archCy = 100;
    var archRx = 200;
    var archRy = 52;
    walls = walls.concat(ellipseArcSegments(archCx, archCy, archRx, archRy, Math.PI, Math.PI * 2, 18, 'rail'));

    // Left side rail from arch end down
    var archLeftX = archCx - archRx;
    var archLeftY = archCy;
    walls.push({ x1: archLeftX, y1: archLeftY, x2: 36, y2: 140, kind: 'rail' });
    walls.push({ x1: 36, y1: 140, x2: 36, y2: TABLE_H - 80, kind: 'rail' });

    // Outer right (cabinet edge past launch lane)
    walls.push({ x1: TABLE_W - 36, y1: 90, x2: TABLE_W - 36, y2: TABLE_H - 80, kind: 'rail' });

    // Launch lane
    walls.push({ x1: LAUNCH_LANE_LEFT, y1: 90, x2: LAUNCH_LANE_LEFT, y2: LAUNCH_WIRE_Y1, rail: true, kind: 'lane' });
    walls.push({ x1: LAUNCH_LANE_LEFT, y1: LAUNCH_WIRE_Y1, x2: LAUNCH_WIRE_X2, y2: LAUNCH_WIRE_Y2, wireform: true, kind: 'lane' });
    walls.push({ x1: LAUNCH_LANE_LEFT, y1: LAUNCH_WIRE_Y1, x2: LAUNCH_LANE_LEFT, y2: TABLE_H - 80, rail: true, kind: 'lane' });

    // Soft upper-right round into launch (yellow annotation)
    walls = walls.concat(
      ellipseArcSegments(LAUNCH_LANE_LEFT - 8, 118, 42, 38, -Math.PI * 0.15, Math.PI * 0.55, 8, 'rail')
    );

    // Tiny deck stubs under pivots only — longer stubs shelved balls in the inlanes
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
    // Inlane posts + return plastics: wall-hug must hit shelf/post before free outlane fall
    walls.push({ x1: FLIPPER_INLANE_X + 6, y1: 440, x2: FLIPPER_INLANE_X + 6, y2: FLIPPER_ROW_Y - 20, kind: 'inlane' });
    walls.push({ x1: FLIPPER_INLANE_X + 6, y1: FLIPPER_ROW_Y - 20, x2: FLIPPER_INLANE_X + 6, y2: chuteBottom, kind: 'chute' });
    // Left return shelf (outer rail -> inlane): kicks inward/down toward flipper
    walls.push({ x1: 42, y1: 455, x2: FLIPPER_INLANE_X + 4, y2: FLIPPER_ROW_Y - 40, kind: 'guide' });
    walls.push({ x1: 36, y1: 420, x2: 72, y2: 505, kind: 'guide' });
    // Right inlane post (mirror left) + return plastics
    walls.push({ x1: rightInlaneX - 4, y1: 440, x2: rightInlaneX - 4, y2: FLIPPER_ROW_Y - 20, kind: 'inlane' });
    walls.push({ x1: rightInlaneX - 4, y1: FLIPPER_ROW_Y - 20, x2: rightInlaneX - 4, y2: chuteBottom, kind: 'chute' });
    walls.push({ x1: LAUNCH_LANE_LEFT - 10, y1: 455, x2: rightInlaneX, y2: FLIPPER_ROW_Y - 40, kind: 'guide' });
    walls.push({ x1: LAUNCH_LANE_LEFT - 4, y1: 420, x2: rightInlaneX + 6, y2: 505, kind: 'guide' });
    walls.push({ x1: bounds.centerLeft, y1: FLIPPER_ROW_Y, x2: bounds.centerLeft, y2: chuteBottom, kind: 'chute' });
    walls.push({ x1: bounds.centerRight, y1: FLIPPER_ROW_Y, x2: bounds.centerRight, y2: chuteBottom, kind: 'chute' });
    walls.push({ x1: bounds.rightOutlaneLeft, y1: FLIPPER_ROW_Y, x2: bounds.rightOutlaneLeft, y2: chuteBottom, kind: 'chute' });

    // Real left orbit / right habitrail travel paths (replaces token diagonal kick chutes)
    walls = walls.concat(createHabitrailWalls());

    return walls;
  }

  function createInitialState() {
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
      flippers: [createFlipper('left'), createFlipper('right')],
      bumpers: createBumpers(),
      slingshots: createSlingshots(),
      targets: createTargets(),
      dropTargets: createDropTargets(),
      sideRoutes: createSideRoutes(),
      rollovers: createRollovers(),
      launchLaneDashes: createLaunchLaneDashes(),
      launchDashHoldT: 0,
      launchDashReversing: false,
      launchDashReverseI: -1,
      launchDashFadeT: 0,
      kickers: createKickers(),
      posts: createPosts(),
      spinner: createSpinner(),
      walls: createWalls(),
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
      // Explicit arm: CENTER skill shot only — one timed save, then drain sticks
      state.ballSaveArmed = true;
      state.ballSaveUsed = false;
      state.ballSaveTimer = BALL_SAVE_DURATION;
    }
    // Near grade: points/banner only — does NOT arm ball-save
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
    return !state.ball.inPlay && state.ballsRemaining > 0 && state.phase !== 'game_over';
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
    var targetX = TABLE_W * 0.46;
    var targetY = 148;
    var tx = targetX - ball.x;
    var ty = targetY - ball.y;
    var dist = vecLen(tx, ty);
    var exitSpeed = Math.max(speed, 420);
    if (dist > 1e-6) {
      ball.vx = (tx / dist) * exitSpeed;
      ball.vy = (ty / dist) * exitSpeed;
    } else {
      ball.vx = -exitSpeed * 0.55;
      ball.vy = -exitSpeed * 0.82;
    }
  }

  var MIN_RAIL_LAUNCH_POWER = 380;

  function launchRailBoost(state) {
    var power = state.activeLaunchPower || 0;
    return clamp(power / 820, 0, 1.15);
  }

  function guideShooterLane(state, dt) {
    if (state.exitedLaunchLane) return;
    var ball = state.ball;
    var r = ball.radius;
    if (ball.y <= LAUNCH_WIRE_Y2 - 24) return;
    var boost = launchRailBoost(state);
    var canRideRail = state.activeLaunchPower >= MIN_RAIL_LAUNCH_POWER;

    if (ball.vy > 160 && ball.y > PLUNGER_REST_Y - 50) return;

    var onWireform = state.launchRailT != null || ball.y < WIRE_FORM_Y1;

    if (!onWireform) {
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
      if (canRideRail) {
        var minRise = 760 * boost;
        if (ball.vy > -minRise) ball.vy = -minRise;
      }
      return;
    }

    if (!canRideRail) return;

    var tan = wireformTangent();
    var offset = r + 4;
    if (state.launchRailT == null) state.launchRailT = wireformProgress(ball);
    state.launchRailT = clamp(
      state.launchRailT + (4.2 + boost * 1.6) * dt,
      0,
      1
    );
    var t = state.launchRailT;
    var railX = WIRE_FORM_X1 + WIRE_FORM_DX * t + tan.px * offset;
    var railY = WIRE_FORM_Y1 + WIRE_FORM_DY * t + tan.py * offset;
    ball.x = railX;
    ball.y = railY;

    var speed = Math.max(340, 520 * boost);
    ball.vx = tan.ux * speed;
    ball.vy = tan.uy * speed;

    if (t >= 0.995) {
      releaseFromWireform(state, speed);
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
  function tryHabitrailEntry(state, route, towardCenterSign) {
    if (!route || route.cooldown > 0) return false;
    var ball = state.ball;
    if (!pointInRouteEntry(ball, route.entry)) return false;
    if (ball.vy > 40) return false;
    var boost = route.boost || 280;
    var ex = route.exit ? route.exit.x : ball.x;
    var ey = route.exit ? route.exit.y : ball.y - 80;
    var dir = normalize(ex - ball.x, ey - ball.y);
    var along = Math.max(boost, HABITRAIL_MIN_SPEED + 40);
    ball.vx = dir.x * along + towardCenterSign * 25;
    ball.vy = Math.min(ball.vy, dir.y * along);
    if (ball.vy > -boost * 0.45) ball.vy = dir.y * along;
    route.cooldown = SIDE_ROUTE_COOLDOWN * 1.6;
    awardScore(state, route.score, 'route', route.id, (ball.x + ex) * 0.5, (ball.y + ey) * 0.5);
    return true;
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

  /** Keep ball moving through habitrail/guide channels; kill multi-second crawls. */
  function assistHabitrails(state, dt) {
    if (!state.sideRoutes || !state.ball.inPlay || !state.exitedLaunchLane) return;
    var ball = state.ball;
    var routes = [state.sideRoutes.leftRamp, state.sideRoutes.rightRamp];
    var ri;
    for (ri = 0; ri < routes.length; ri++) {
      var route = routes[ri];
      if (!route || !route.segments) continue;
      var nearOuter = nearestPointOnSegments(ball.x, ball.y, route.segments);
      var nearGuide = nearestPointOnSegments(ball.x, ball.y, route.guides);
      if (!nearOuter) continue;
      var channelDist = nearOuter.dist;
      if (nearGuide) channelDist = Math.min(channelDist, nearGuide.dist);
      if (channelDist > ball.radius + 22) continue;
      // Must sit between outer rail and inner guide - not playfield-side wall hug
      if (nearGuide) {
        var loX = Math.min(nearOuter.x, nearGuide.x) - 6;
        var hiX = Math.max(nearOuter.x, nearGuide.x) + 6;
        if (ball.x < loX || ball.x > hiX) continue;
      }
      var ex = route.exit ? route.exit.x : ball.x;
      var ey = route.exit ? route.exit.y : ball.y - 60;
      var dir = normalize(ex - ball.x, ey - ball.y);
      var speed = ballSpeed(ball);
      var along = dot(ball.vx, ball.vy, dir.x, dir.y);
      ball.vx += dir.x * HABITRAIL_ASSIST * dt;
      ball.vy += dir.y * HABITRAIL_ASSIST * dt;
      if (speed < HABITRAIL_MIN_SPEED || along < HABITRAIL_MIN_SPEED * 0.35) {
        var need = HABITRAIL_MIN_SPEED - Math.max(0, along);
        ball.vx += dir.x * need;
        ball.vy += dir.y * need;
        var wall = nearGuide && nearGuide.dist < nearOuter.dist ? nearGuide : nearOuter;
        var n = normalize(ball.x - wall.x, ball.y - wall.y);
        ball.x += n.x * 1.5;
        ball.y += n.y * 1.5;
        ball.vx += n.x * 40;
        ball.vy += n.y * 20;
      }
    }
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
    var multPts = state.multiplier * 500;
    var dashPts = state.launchDashRewarded ? 1000 : 0;
    var jackPts = state.jackpotLit ? 2500 : 0;
    var bankPts = Math.floor(state.bonusBank || 0);
    var steps = [];
    if (multPts > 0) steps.push({ label: 'MULT ×' + state.multiplier, points: multPts });
    if (dashPts > 0) steps.push({ label: 'LANE DASH', points: dashPts });
    if (jackPts > 0) steps.push({ label: 'JACKPOT FLAG', points: jackPts });
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
   * Light dashes when the ball rolls over them (bottom → top).
   * After all are on for 3s, reverse top → bottom with a slow pulse-fade off.
   */
  function updateLaunchLaneDashes(state, dt) {
    var dashes = state.launchLaneDashes;
    if (!dashes || !dashes.length) return;
    var i;
    var n = dashes.length;

    for (i = 0; i < n; i++) {
      if (dashes[i].flash > 0) dashes[i].flash = Math.max(0, dashes[i].flash - dt);
    }

    // Reverse extinguish: top (last lit) → plunger (first), staggered pulse-fade
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

  function blockShooterLaneIntrusion(state) {
    if (!state.ball.inPlay || !state.exitedLaunchLane) return;
    var ball = state.ball;
    var r = ball.radius;
    // Keep playfield balls out of the plunger lane near the apron.
    // Always allow a horizontal eject; never loft when draining / below bats.
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
      if (!state.exitedLaunchLane && (wall.wireform || wall.kind === 'lane')) return;
      // Soft short deck stubs — less bounce so they don't steal lower play
      var rest = WALL_RESTITUTION;
      if (wall.kind === 'deck') rest = WALL_RESTITUTION * 0.55;
      else if (wall.kind === 'habitrail') rest = HABITRAIL_RESTITUTION;
      else if (wall.kind === 'guide') rest = GUIDE_RESTITUTION;
      segmentCollision(ball, wall.x1, wall.y1, wall.x2, wall.y2, rest, null);
    });

    if (ball.x - r < 36) {
      ball.x = 36 + r;
      ball.vx = Math.abs(ball.vx) * WALL_RESTITUTION;
    }
    // Follow rounded top arch (no flat y=60 ceiling)
    if (ball.x > 40 && ball.x < LAUNCH_LANE_LEFT + 10) {
      var floorY = topArchFloorY(ball.x);
      if (ball.y - r < floorY) {
        ball.y = floorY + r + 0.5;
        if (ball.vy < 0) ball.vy = Math.abs(ball.vy) * WALL_RESTITUTION;
        // Nudge along tangent so ball "rides" the curve instead of sticking
        var mid = TABLE_W * 0.5;
        ball.vx += (ball.x < mid ? -1 : 1) * 25;
      }
    } else if (ball.y - r < 48) {
      ball.y = 48 + r;
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
        if (sling.cooldown <= 0) {
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
        var rv = reflectVelocity(ball.vx, ball.vy, n.x, n.y, BUMPER_RESTITUTION);
        ball.vx = rv.vx;
        ball.vy = rv.vy;
        if (bumper.saver) {
          if (ballSpeed(ball) < 140) {
            ball.vx += 80;
            ball.vy -= 30;
          }
          applyBumperExitSpeed(ball, n.x, n.y, SAVER_BUMPER_EXIT_SPEED);
        } else {
          applyBumperExitSpeed(ball, n.x, n.y, MIN_BUMPER_EXIT_SPEED);
        }
        bumper.hitCooldown = HIT_COOLDOWN_BUMPER;
        awardScore(state, bumper.score, 'bumper', String(idx), bumper.x, bumper.y);
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
   * User-reported hang: top-right under arch (wireform × top rail × lane wall).
   */
  function unstickFromCorners(state) {
    var ball = state.ball;
    if (!ball.inPlay || !state.exitedLaunchLane) return;
    var speed = ballSpeed(ball);
    if (speed > 70) return;
    var r = ball.radius;
    var upper = ball.y < 300;
    if (!upper) return;

    // Top-left pocket: near left rail + upper third
    var nearLeft = ball.x - r < 36 + 28;
    if (nearLeft && speed <= 70) {
      ball.x = Math.max(ball.x, 36 + r + 14);
      ball.y = Math.max(ball.y, 60 + r + 8);
      ball.vx = Math.max(ball.vx, 160);
      ball.vy = Math.min(ball.vy, 40); // drop back into play, not into ceiling
      return;
    }

    // Top-right outer corner (outer right rail, above play — rare)
    var nearOuterRight = ball.x + r > TABLE_W - 36 - 10;
    if (nearOuterRight && ball.y < 140 && speed <= 70) {
      ball.x = Math.min(ball.x, LAUNCH_LANE_LEFT - r - 12);
      ball.vx = -Math.max(Math.abs(ball.vx), 180);
      ball.vy = Math.max(ball.vy, 80);
      return;
    }

    // Playfield side of launch lane wall (wide band — old 4px band was too thin)
    var nearLaneWall =
      ball.x + r > LAUNCH_LANE_LEFT - 48 &&
      ball.x < LAUNCH_LANE_LEFT + r + 2;
    if (nearLaneWall && ball.y < 220 && speed <= 70) {
      ball.x = Math.min(ball.x, LAUNCH_LANE_LEFT - r - 14);
      ball.vx = -Math.max(Math.abs(ball.vx), 170);
      ball.vy = Math.max(ball.vy, 90);
      return;
    }

    // Wireform × top-rail wedge (skill-shot entry pocket — annotated stuck spot)
    // Wire: (LAUNCH_LANE_LEFT, LAUNCH_WIRE_Y1) → (LAUNCH_WIRE_X2, LAUNCH_WIRE_Y2)
    var wx1 = WIRE_FORM_X1;
    var wy1 = WIRE_FORM_Y1;
    var wx2 = WIRE_FORM_X2;
    var wy2 = WIRE_FORM_Y2;
    var wdx = wx2 - wx1;
    var wdy = wy2 - wy1;
    var wlenSq = wdx * wdx + wdy * wdy;
    if (wlenSq > 1e-6 && ball.y < LAUNCH_WIRE_Y1 + 40 && ball.x > WIRE_FORM_X2 - 30) {
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
        if (ballSpeed(ball) < 90) {
          ball.vx += n.x * 70;
          ball.vy += n.y * 70 - 30;
        }
        if (!post._hitLock) {
          post._hitLock = true;
          post.flash = 0.3;
          awardScore(state, post.score, 'post', post.id, post.x, post.y);
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
        if (!target.occupied) {
          target.occupied = true;
          target.flash = 0.35;
          if (!target.lit) {
            target.lit = true;
            state.jackpotLit = state.targets.every(function (t) { return t.lit; });
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
    // Park off-table so nothing can soft-kick the lost ball back into the apron
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

  function unstickFromFlippers(state) {
    if (!state.ball.inPlay || !state.exitedLaunchLane) return;
    if (apronAssistsBlocked(state)) return;
    var ball = state.ball;
    var speed = ballSpeed(ball);
    // Crawl / tip-trap rescue only — no rocket impulses (those caused apron jumps)
    if (speed > 120) return;
    if (ball.y < FLIPPER_ROW_Y - 16 || ball.y > FLIPPER_ROW_Y + 40) return;
    var zones = getDrainBounds(state);
    // Already deep in a drain slot — let checkDrain finish the job
    if (ball.y > FLIPPER_ROW_Y + 24 && isBallInDrainZone(ball, zones)) return;
    var centerX = (zones.centerLeft + zones.centerRight) * 0.5;

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

      if (dist < hitDist + 3 && speed < 110) {
        // Peel into the center hole; prefer x over huge vy so we don't loft
        ball.vx += (centerX - ball.x) * 1.1;
        if (ball.y >= flipper.pivotY - 4) {
          ball.vy = Math.max(ball.vy, 90);
        }
        // If parked on the tip, snap slightly into the drain gap
        if (t > segLen * 0.55 && Math.abs(ball.x - tip.x) < 22) {
          ball.x += (centerX - ball.x) * 0.2;
        }
      }
    });
  }

  /**
   * Kill multi-second crawls on outer left rail (x~36) and playfield-side launch wall.
   * Also frees wing-bumper + outer-wall pinches with an inward (toward playfield) impulse.
   */
  function unstickWallSlide(state) {
    var ball = state.ball;
    if (!ball.inPlay || !state.exitedLaunchLane) return;
    var r = ball.radius;
    var speed = ballSpeed(ball);
    var absVx = Math.abs(ball.vx);
    var absVy = Math.abs(ball.vy);
    var crawling = speed < 160 || (absVx < 55 && absVy < 180);
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

    var onLeftRail = ball.x - r <= 36 + 8 && ball.y > 155 && ball.y < FLIPPER_ROW_Y - 24;
    var onRightPlay =
      ball.x + r >= LAUNCH_LANE_LEFT - 8 &&
      ball.x < LAUNCH_LANE_LEFT + r + 2 &&
      ball.y > 155 &&
      ball.y < FLIPPER_ROW_Y - 24;
    if (onLeftRail && (absVx < 50 || speed < 130)) {
      ball.x = 36 + r + 18;
      ball.vx = Math.max(ball.vx, 240);
      if (ball.vy > 120) ball.vy *= 0.55;
      return;
    }
    if (onRightPlay && (absVx < 50 || speed < 130)) {
      ball.x = LAUNCH_LANE_LEFT - r - 18;
      ball.vx = -Math.max(Math.abs(ball.vx), 240);
      if (ball.vy > 120) ball.vy *= 0.55;
    }
  }

  function getOutlaneSaverBumper(state) {
    for (var i = 0; i < state.bumpers.length; i++) {
      if (state.bumpers[i].saver) return state.bumpers[i];
    }
    return null;
  }

  function guardLeftOutlaneShelf(state) {
    if (!state.ball.inPlay || !state.exitedLaunchLane) return;
    if (apronAssistsBlocked(state)) return;
    var ball = state.ball;
    var zones = getDrainBounds(state);
    var r = ball.radius;
    // Return assist ABOVE flipper line only — never shelf-boost a true drain
    if (ball.y >= FLIPPER_ROW_Y - 8) return;
    if (
      ball.x + r < zones.leftOutlaneRight + 14 &&
      ball.y > LEFT_INLANE_POST_TOP - 40 &&
      ball.y < FLIPPER_ROW_Y - 8
    ) {
      var safeX = zones.leftOutlaneRight + r + 6;
      var saver = getOutlaneSaverBumper(state);
      if (saver && ball.y > saver.y - saver.radius - r - 20 && ball.y < saver.y + saver.radius + r + 20) {
        safeX = Math.max(safeX, saver.x + saver.radius + r + 6);
      }
      if (ball.x < safeX) ball.x = safeX;
      if (ball.vx < 90) ball.vx = 90;
      if (ball.vy > 140) ball.vy -= 40;
    }
  }

  function guardRightOutlaneShelf(state) {
    if (!state.ball.inPlay || !state.exitedLaunchLane) return;
    if (apronAssistsBlocked(state)) return;
    var ball = state.ball;
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
    // Never force +vy here — that fought deck bounce and pinned the ball.
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

  function resolveFlipperCollisions(state) {
    var ball = state.ball;
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

      if (dist < hitDist && dist > 1e-6) {
        var n = normalize(ball.x - cx, ball.y - cy);
        ball.x = cx + n.x * hitDist;
        ball.y = cy + n.y * hitDist;
        var sweeping = flipperIsSweeping(flipper);
        var rest = sweeping ? FLIPPER_RESTITUTION_SWEEP : FLIPPER_RESTITUTION_PASSIVE;
        var rv = reflectVelocity(ball.vx, ball.vy, n.x, n.y, rest);
        ball.vx = rv.vx;
        ball.vy = rv.vy;

        if (sweeping) {
          // Contact-point bat velocity (omega × r), tip-weighted.
          var tipFrac = Math.pow(t / segLen, FLIPPER_TIP_POWER);
          var contactVx = -Math.sin(flipper.angle) * flipper.omega * t;
          var contactVy = Math.cos(flipper.angle) * flipper.omega * t;
          var addVx = contactVx * FLIPPER_IMPULSE_GAIN * tipFrac;
          var addVy = contactVy * FLIPPER_IMPULSE_GAIN * tipFrac;
          var addSpeed = vecLen(addVx, addVy);
          if (addSpeed > FLIPPER_MAX_ADD_SPEED && addSpeed > 1e-6) {
            var scale = FLIPPER_MAX_ADD_SPEED / addSpeed;
            addVx *= scale;
            addVy *= scale;
          }
          ball.vx += addVx;
          ball.vy += addVy;
          state.lastHitType = 'flipper';
          state.lastHitId = flipper.side;
        }
      }
    });
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
      // Soft blend rather than a hard wall — still clamps runaway speeds.
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

  function stepPhysics(state, dt) {
    dt = clamp(dt, 0.001, 0.05);
    updateFlippers(state, dt);

    if (!state.ball.inPlay) return state;

    var ball = state.ball;
    ball.vy += GRAVITY * dt;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    applyPlungerFollow(state);
    guideShooterLane(state, dt);
    blockShooterLaneIntrusion(state);
    resolveWallCollisions(state);
    assistHabitrails(state, dt);
    guardLeftOutlaneShelf(state);
    guardRightOutlaneShelf(state);
    resolveSlingshotCollisions(state);
    resolveBumperCollisions(state);
    unstickFromBumpers(state);
    unstickFromCorners(state);
    unstickWallSlide(state);
    resolvePostCollisions(state);
    resolveKickerCollisions(state);
    resolveTargetCollisions(state);
    resolveDropTargetCollisions(state);
    resolveSideRouteCollisions(state);
    resolveRolloverCollisions(state);
    resolveSpinnerCollision(state);

    if (!isBallInLaunchLane(state)) {
      resolveFlipperCollisions(state);
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
    return state;
  }

  function activateFlipper(state, side, active) {
    state.flippers.forEach(function (f) {
      if (f.side === side) f.active = !!active;
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
      // Hold at full power (1.0). Do NOT wrap — wrapping made the red max meter
      // drop to ~0 and launch weakly right when the bar looked full.
      state.launchPower = Math.min(1, state.launchPower + dt * LAUNCH_CHARGE_RATE);
    }
    return state;
  }

  function easeLaunchMeter(meter) {
    var m = clamp(meter, 0, 1);
    // pow ease keeps full-meter = max power; softens mid-charge feel.
    return Math.pow(m, LAUNCH_METER_EASE);
  }

  function meterToLaunchPower(meter) {
    return MIN_LAUNCH_POWER + easeLaunchMeter(meter) * (MAX_LAUNCH_POWER - MIN_LAUNCH_POWER);
  }

  function launchBall(state, power) {
    if (state.ball.inPlay || state.ballsRemaining <= 0) return state;
    var p;
    var chargeU;
    if (power != null && power > 1) {
      p = clamp(power, MIN_LAUNCH_POWER, MAX_LAUNCH_POWER);
      chargeU = (p - MIN_LAUNCH_POWER) / (MAX_LAUNCH_POWER - MIN_LAUNCH_POWER);
    } else {
      chargeU = easeLaunchMeter(state.launchPower);
      p = MIN_LAUNCH_POWER + chargeU * (MAX_LAUNCH_POWER - MIN_LAUNCH_POWER);
    }
    state.ball.inPlay = true;
    state.ball.x = LAUNCH_LANE_X;
    state.ball.y = PLUNGER_REST_Y;
    // Tiny lateral English from charge — aim skill without shoving into flippers.
    state.ball.vx = 5 + (chargeU - 0.5) * 2 * LAUNCH_ENGLISH_MAX;
    state.ball.vy = -p;
    state.exitedLaunchLane = false;
    state.skillShotWindow = false;
    state.launchTick = 0;
    state.launchRailT = null;
    state.activeLaunchPower = p;
    state.plungerFollowFrames = PLUNGER_FOLLOW_FRAMES;
    state.plungerFollowPower = p;
    state.phase = 'playing';
    state.launchPower = 0;
    state.launchCharging = false;
    return state;
  }

  function checkDrain(state) {
    if (!state.ball.inPlay) return state;
    var ball = state.ball;

    if (!state.exitedLaunchLane && isBallInLaunchLane(state)) {
      if (ball.y > PLUNGER_REST_Y + 8 && ball.vy > 0) resetBallToPlunger(state);
      return state;
    }

    var zones = getDrainBounds(state);
    var drainZone = isBallInDrainZone(ball, zones);

    if (drainZone) {
      if (ball.y - ball.radius > DRAIN_Y) {
        return performDrain(state);
      }
      if (ball.y > TABLE_H - 28) {
        return performDrain(state);
      }
    }

    if (ball.y > TABLE_H + 40) {
      return performDrain(state);
    }

    if (ball.y + ball.radius > FLIPPER_ROW_Y && ball.vy > 0 && !drainZone) {
      var nudge = zones.centerLeft + (zones.centerRight - zones.centerLeft) * 0.5;
      ball.vx += (nudge - ball.x) * 2.5 * 0.016;
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
    stepPhysics(state, dt);
    updateLaunchLaneDashes(state, dt);
    checkDrain(state);
    ensureBallAtPlunger(state);
    return state;
  }

  var api = {
    GRAVITY: GRAVITY,
    BUMPER_RESTITUTION: BUMPER_RESTITUTION,
    MIN_BUMPER_EXIT_SPEED: MIN_BUMPER_EXIT_SPEED,
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
    FLIPPER_IMPULSE_GAIN: FLIPPER_IMPULSE_GAIN,
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
    meterToLaunchPower: meterToLaunchPower,
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
    ellipseArcSegments: ellipseArcSegments
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof root !== 'undefined') {
    root.PinballSim = api;
  }
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);