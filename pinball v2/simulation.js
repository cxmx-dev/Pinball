/**
 * Pure pinball simulation — no DOM, no rendering.
 * Loadable in browser (window.PinballSim) and Node (module.exports).
 */
(function (root) {
  'use strict';

  var GRAVITY = 980;
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
  var DECK_DRAIN_SPEED = 220;
  var WALL_RESTITUTION = 0.72;
  var BUMPER_RESTITUTION = 1.15;
  var FLIPPER_RESTITUTION = 1.05;
  var SLING_RESTITUTION = 1.08;
  var KICKER_RESTITUTION = 1.2;
  var MAX_LAUNCH_POWER = 1400;
  var MIN_LAUNCH_POWER = 200;
  var LAUNCH_CHARGE_RATE = 0.9;
  var DRAIN_SLOT_TOP = TABLE_H - 14;
  var DRAIN_SLOT_H = 12;
  var DRAIN_Y = DRAIN_SLOT_TOP - BALL_RADIUS;
  var HIT_COOLDOWN_SPINNER = 0.35;
  var HIT_COOLDOWN_SLING = 0.25;
  var HIT_COOLDOWN_BUMPER = 0.24;
  var MIN_BUMPER_EXIT_SPEED = 130;
  var SAVER_BUMPER_EXIT_SPEED = 155;
  var BUMPER_UNSTICK_SPEED = 85;
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
      active: false
    };
  }

  function createBumpers() {
    return [
      { x: TABLE_W * 0.5, y: 200, radius: 36, score: 500, color: '#ff3366', kind: 'bumper', hitCooldown: 0 },
      { x: TABLE_W * 0.28, y: 300, radius: 28, score: 300, color: '#33ccff', kind: 'bumper', hitCooldown: 0 },
      { x: TABLE_W * 0.72, y: 300, radius: 28, score: 300, color: '#ffcc00', kind: 'bumper', hitCooldown: 0 },
      { x: TABLE_W * 0.5, y: 390, radius: 24, score: 250, color: '#aa66ff', kind: 'bumper', hitCooldown: 0 },
      {
        x: 148,
        y: 452,
        radius: 20,
        score: 150,
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
      { id: 'standup-l', x: 108, y: 520, w: 10, h: 32, score: 1000, lit: true, flash: 0, occupied: false },
      { id: 'standup-r', x: 352, y: 520, w: 10, h: 32, score: 1000, lit: true, flash: 0, occupied: false },
      { id: 'standup-c', x: 232, y: 560, w: 10, h: 28, score: 1500, lit: false, flash: 0, occupied: false }
    ];
  }

  function createRollovers() {
    return [
      { id: 'lane-l', x1: 72, y1: 180, x2: 72, y2: 280, width: 18, score: 500, lit: false, occupied: false },
      // Playfield side of launch wall (not inside shooter lane); mid table so top spinner path is free
      { id: 'lane-r', x1: LAUNCH_LANE_LEFT - 36, y1: 260, x2: LAUNCH_LANE_LEFT - 36, y2: 360, width: 18, score: 500, lit: false, occupied: false }
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
    return [
      { id: 'kicker-l', x: 155, y: 640, radius: 14, score: 750, color: '#ff8844' },
      { id: 'kicker-r', x: 325, y: 640, radius: 14, score: 750, color: '#44ffaa' }
    ];
  }

  function createSpinner() {
    return { x: TABLE_W * 0.5, y: 130, radius: 18, angle: 0, score: 200, spinVel: 0, hitCooldown: 0 };
  }

  function getRestDrainBounds() {
    var leftRest = createFlipper('left');
    var rightRest = createFlipper('right');
    var lt = flipperTip(leftRest);
    var rt = flipperTip(rightRest);
    return {
      centerLeft: lt.x + 8,
      centerRight: rt.x - 8,
      leftOutlaneRight: FLIPPER_INLANE_X,
      rightOutlaneLeft: FLIPPER_RIGHT_PIVOT_X + 18,
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

    return [
      { x1: 36, y1: 60, x2: TABLE_W - 36, y2: 60, kind: 'rail' },
      { x1: 36, y1: 60, x2: 36, y2: TABLE_H - 80, kind: 'rail' },
      { x1: TABLE_W - 36, y1: 60, x2: TABLE_W - 36, y2: TABLE_H - 80, kind: 'rail' },
      { x1: LAUNCH_LANE_LEFT, y1: 60, x2: LAUNCH_LANE_LEFT, y2: LAUNCH_WIRE_Y1, rail: true, kind: 'lane' },
      { x1: LAUNCH_LANE_LEFT, y1: LAUNCH_WIRE_Y1, x2: LAUNCH_WIRE_X2, y2: LAUNCH_WIRE_Y2, wireform: true, kind: 'lane' },
      { x1: LAUNCH_LANE_LEFT, y1: LAUNCH_WIRE_Y1, x2: LAUNCH_LANE_LEFT, y2: TABLE_H - 80, rail: true, kind: 'lane' },
      { x1: FLIPPER_INLANE_X, y1: FLIPPER_ROW_Y, x2: drainL, y2: FLIPPER_ROW_Y, kind: 'deck' },
      { x1: drainR, y1: FLIPPER_ROW_Y, x2: rightInlaneX, y2: FLIPPER_ROW_Y, kind: 'deck' },
      { x1: FLIPPER_INLANE_X, y1: LEFT_INLANE_POST_TOP, x2: FLIPPER_INLANE_X, y2: FLIPPER_ROW_Y - 20, kind: 'inlane' },
      { x1: FLIPPER_INLANE_X, y1: FLIPPER_ROW_Y - 20, x2: FLIPPER_INLANE_X, y2: chuteBottom, kind: 'chute' },
      { x1: 36, y1: 540, x2: FLIPPER_INLANE_X + 6, y2: LEFT_INLANE_POST_TOP + 20, kind: 'chute' },
      // Upper-left deflector: keep OFF the left rail so ball diameter fits (old 36,210→92,145 wedged).
      { x1: 78, y1: 195, x2: 128, y2: 118, kind: 'chute' },
      { x1: rightInlaneX, y1: FLIPPER_ROW_Y - 20, x2: rightInlaneX, y2: chuteBottom, kind: 'chute' },
      { x1: bounds.centerLeft, y1: FLIPPER_ROW_Y, x2: bounds.centerLeft, y2: chuteBottom, kind: 'chute' },
      { x1: bounds.centerRight, y1: FLIPPER_ROW_Y, x2: bounds.centerRight, y2: chuteBottom, kind: 'chute' },
      { x1: bounds.rightOutlaneLeft, y1: FLIPPER_ROW_Y, x2: bounds.rightOutlaneLeft, y2: chuteBottom, kind: 'chute' }
    ];
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
      rollovers: createRollovers(),
      launchLaneDashes: createLaunchLaneDashes(),
      launchDashHoldT: 0,
      launchDashReversing: false,
      launchDashReverseI: -1,
      launchDashFadeT: 0,
      kickers: createKickers(),
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
      ballSaveFlash: 0,
      launchDashRewarded: false,
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
    var points = Math.round(base * state.multiplier * comboBoost);
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
      state.ballSaveArmed = true;
    } else {
      // Near-miss still arms a weaker save? Plan: optional after skill shot — arm for both grades
      state.ballSaveArmed = true;
    }
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
    state.targets.forEach(function (t) {
      if (t.flash > 0) t.flash -= dt;
    });
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
      f.targetAngle = f.active ? f.activeAngle : f.restAngle;
      var diff = f.targetAngle - f.angle;
      var maxStep = FLIPPER_SPEED * dt;
      if (Math.abs(diff) <= maxStep) {
        f.angle = f.targetAngle;
      } else {
        f.angle += Math.sign(diff) * maxStep;
      }
    });
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
    ball.vy = Math.min(ball.vy, -120);
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

  function resetBallProgress(state) {
    state.targets = createTargets();
    state.rollovers = createRollovers();
    state.launchLaneDashes = createLaunchLaneDashes();
    resetLaunchDashSequence(state);
    state.launchDashRewarded = false;
    state.jackpotLit = false;
    state.skillShotWindow = false;
    state.skillShotGrade = null;
    state.comboCount = 0;
    state.comboTimer = 0;
    if (state.spinner) state.spinner.hitCooldown = 0;
    state.slingshots.forEach(function (s) { s.cooldown = 0; });
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
    state.phase = 'ready';
    state.tiltWarnings = 0;
    state.tiltCooldown = 0;
    state.ballSaveArmed = false;
    state.ballSaveUsed = false;
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

  function blockShooterLaneIntrusion(state) {
    if (!state.ball.inPlay || !state.exitedLaunchLane) return;
    var ball = state.ball;
    var r = ball.radius;
    if (ball.x + r >= LAUNCH_LANE_LEFT - 1 && ball.y > FLIPPER_ROW_Y - 44) {
      ball.x = LAUNCH_LANE_LEFT - r - 2;
      ball.vx = -Math.max(Math.abs(ball.vx), 220) * WALL_RESTITUTION;
      if (ball.vy > -80) ball.vy = -Math.max(Math.abs(ball.vy), 140);
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
      segmentCollision(ball, wall.x1, wall.y1, wall.x2, wall.y2, WALL_RESTITUTION, null);
    });

    if (ball.x - r < 36) {
      ball.x = 36 + r;
      ball.vx = Math.abs(ball.vx) * WALL_RESTITUTION;
    }
    if (ball.y - r < 60) {
      ball.y = 60 + r;
      ball.vy = Math.abs(ball.vy) * WALL_RESTITUTION;
    }
  }

  function resolveSlingshotCollisions(state) {
    var ball = state.ball;
    state.slingshots.forEach(function (sling) {
      var scored = false;
      var hit = segmentCollision(ball, sling.x1, sling.y1, sling.x2, sling.y2, SLING_RESTITUTION, function () {
        if (sling.side === 'left') {
          ball.vx += 200;
          ball.vy -= 80;
        } else {
          ball.vx -= 200;
          ball.vy -= 80;
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
        if (bumper.saver && ballSpeed(ball) < 120) {
          ball.vx += 70;
          ball.vy -= 20;
          applyBumperExitSpeed(ball, n.x, n.y, SAVER_BUMPER_EXIT_SPEED);
        } else if (!bumper.saver && ballSpeed(ball) < 70) {
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

    // Generic upper-slow only near rails (not center spinner / top bumper zone)
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
    var dx = ball.x - sp.x;
    var dy = ball.y - sp.y;
    var dist = vecLen(dx, dy);
    var minDist = ball.radius + sp.radius;
    if (dist < minDist && dist > 1e-6) {
      var n = normalize(dx, dy);
      ball.x = sp.x + n.x * minDist;
      ball.y = sp.y + n.y * minDist;
      var rv = reflectVelocity(ball.vx, ball.vy, n.x, n.y, 0.9);
      ball.vx = rv.vx;
      ball.vy = rv.vy;
      var spinImpulse = Math.abs(ball.vx) + Math.abs(ball.vy);
      sp.spinVel += spinImpulse * 0.004;
      sp.angle += sp.spinVel;
      sp.spinVel *= 0.985;
      if (sp.hitCooldown <= 0) {
        awardScore(state, sp.score, 'spinner', 'spinner', sp.x, sp.y);
        sp.hitCooldown = HIT_COOLDOWN_SPINNER;
      }
    } else {
      sp.spinVel *= 0.99;
    }
  }

  function performDrain(state) {
    // One ball-save after a skill shot (any grade), then consume
    if (state.ballSaveArmed && !state.ballSaveUsed && state.ball.inPlay) {
      state.ballSaveUsed = true;
      state.ballSaveArmed = false;
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
    // SFX via drainEvents in audio.processState (avoid double-fire from lastHitType)
    if (state.ballsRemaining <= 0) {
      state.phase = 'game_over';
      state.ball.inPlay = false;
      state.ball.vx = 0;
      state.ball.vy = 0;
    } else {
      resetBallToPlunger(state);
    }
    return state;
  }

  function isBallInDrainZone(ball, zones) {
    var r = ball.radius;
    if (ball.x < zones.leftOutlaneRight) return 'left';
    if (ball.x > zones.centerLeft && ball.x < zones.centerRight) return 'center';
    if (ball.x > zones.rightOutlaneLeft && ball.x < LAUNCH_LANE_LEFT) return 'right';
    if (ball.y > FLIPPER_ROW_Y + 20) {
      if (ball.x < zones.leftOutlaneRight + r) return 'left';
      if (ball.x > zones.centerLeft - r && ball.x < zones.centerRight + r) return 'center';
      if (ball.x > zones.rightOutlaneLeft - r && ball.x < LAUNCH_LANE_LEFT + r) return 'right';
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
    var ball = state.ball;
    var speed = ballSpeed(ball);
    if (speed > DECK_DRAIN_SPEED || ball.y < FLIPPER_ROW_Y - 24) return;
    var zones = getDrainBounds(state);
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

      if (dist < hitDist + 6 && speed < 170 && ball.y >= flipper.pivotY - 20) {
        ball.vy += 380;
        ball.vx += (centerX - ball.x) * 2.4;
        ball.vx += flipper.side === 'left' ? 110 : -110;
      }
    });
  }

  function getOutlaneSaverBumper(state) {
    for (var i = 0; i < state.bumpers.length; i++) {
      if (state.bumpers[i].saver) return state.bumpers[i];
    }
    return null;
  }

  function guardLeftOutlaneShelf(state) {
    if (!state.ball.inPlay || !state.exitedLaunchLane) return;
    var ball = state.ball;
    var zones = getDrainBounds(state);
    var r = ball.radius;
    if (
      ball.x + r < zones.leftOutlaneRight + 14 &&
      ball.y > LEFT_INLANE_POST_TOP - 30 &&
      ball.y < FLIPPER_ROW_Y + 8
    ) {
      var safeX = zones.leftOutlaneRight + r + 8;
      var saver = getOutlaneSaverBumper(state);
      if (saver && ball.y > saver.y - saver.radius - r - 24 && ball.y < saver.y + saver.radius + r + 24) {
        safeX = Math.max(safeX, saver.x + saver.radius + r + 10);
      }
      if (ball.x < safeX) ball.x = safeX;
      if (ball.vx < 90) ball.vx = 90;
      if (ball.vy > 120) ball.vy -= 40;
    }
  }

  function nudgeInlaneApron(state) {
    if (!state.ball.inPlay || !state.exitedLaunchLane) return;
    var ball = state.ball;
    if (ball.y + ball.radius < FLIPPER_ROW_Y - 2) return;
    var speed = ballSpeed(ball);
    if (speed > DECK_DRAIN_SPEED) return;
    var zones = getDrainBounds(state);
    var inLeftInlane = ball.x >= zones.leftOutlaneRight && ball.x <= zones.centerLeft;
    var inRightInlane = ball.x >= zones.centerRight && ball.x <= zones.rightOutlaneLeft;
    if ((inLeftInlane || inRightInlane) && speed < 140) {
      var targetX = inRightInlane ? zones.rightOutlaneLeft + 36 : zones.centerLeft - 12;
      ball.vx += (targetX - ball.x) * 0.45;
      ball.vy += Math.max(ball.vy, 200);
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
        var rest = flipper.active ? FLIPPER_RESTITUTION * 1.2 : FLIPPER_RESTITUTION;
        var rv = reflectVelocity(ball.vx, ball.vy, n.x, n.y, rest);
        ball.vx = rv.vx;
        ball.vy = rv.vy;
        if (flipper.active) {
          var impulse = 720;
          ball.vx += Math.cos(flipper.angle) * impulse * 0.022;
          ball.vy += Math.sin(flipper.angle) * impulse * 0.022;
          state.lastHitType = 'flipper';
          state.lastHitId = flipper.side;
        }
      }
    });
  }

  function stepPhysics(state, dt) {
    dt = clamp(dt, 0.001, 0.05);
    updateFlippers(state, dt);

    if (!state.ball.inPlay) return state;

    var ball = state.ball;
    ball.vy += GRAVITY * dt;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    guideShooterLane(state, dt);
    blockShooterLaneIntrusion(state);
    resolveWallCollisions(state);
    guardLeftOutlaneShelf(state);
    resolveSlingshotCollisions(state);
    resolveBumperCollisions(state);
    unstickFromBumpers(state);
    unstickFromCorners(state);
    resolveKickerCollisions(state);
    resolveTargetCollisions(state);
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

    ball.vx *= 0.9995;
    ball.vy *= 0.9995;
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

  function meterToLaunchPower(meter) {
    return MIN_LAUNCH_POWER + clamp(meter, 0, 1) * (MAX_LAUNCH_POWER - MIN_LAUNCH_POWER);
  }

  function launchBall(state, power) {
    if (state.ball.inPlay || state.ballsRemaining <= 0) return state;
    var p;
    if (power != null && power > 1) {
      p = clamp(power, MIN_LAUNCH_POWER, MAX_LAUNCH_POWER);
    } else {
      p = meterToLaunchPower(state.launchPower);
    }
    state.ball.inPlay = true;
    state.ball.x = LAUNCH_LANE_X;
    state.ball.y = PLUNGER_REST_Y;
    state.ball.vx = 5;
    state.ball.vy = -p;
    state.exitedLaunchLane = false;
    state.skillShotWindow = false;
    state.launchTick = 0;
    state.launchRailT = null;
    state.activeLaunchPower = p;
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
    BALL_RADIUS: BALL_RADIUS,
    TABLE_W: TABLE_W,
    TABLE_H: TABLE_H,
    DRAIN_Y: DRAIN_Y,
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
    LAUNCH_CHARGE_RATE: LAUNCH_CHARGE_RATE,
    FLIPPER_PIVOT_SPACING: FLIPPER_PIVOT_SPACING,
    FLIPPER_LEFT_PIVOT_X: FLIPPER_LEFT_PIVOT_X,
    FLIPPER_RIGHT_PIVOT_X: FLIPPER_RIGHT_PIVOT_X,
    FLIPPER_ROW_Y: FLIPPER_ROW_Y,
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
    performDrain: performDrain
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof root !== 'undefined') {
    root.PinballSim = api;
  }
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);