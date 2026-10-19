#!/usr/bin/env node
'use strict';
/**
 * VOID PULSE table verify: runs every rule in spec/TABLE-SPEC.md headless.
 *   node verify/run-verify.js            full run (300 seeded games)
 *   node verify/run-verify.js --quick    50 games, smaller targeted sets
 *   options: --games N  --seed S  --no-json
 * Prints one PASS/FAIL row per rule, writes verify/last-run.json,
 * exits 1 if any rule that is not marked expected-fail fails.
 * Read-only against the game: it only calls simulation.js / renderer.js.
 */
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');
var S = require(path.join(ROOT, 'simulation.js'));

// ---- args ----
var argv = process.argv.slice(2);
function argVal(name, dflt) {
  var i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] != null ? argv[i + 1] : dflt;
}
var QUICK = argv.indexOf('--quick') >= 0;
var GAMES = +argVal('--games', QUICK ? 50 : 300);
var SEED = +argVal('--seed', 5);
var WRITE_JSON = argv.indexOf('--no-json') < 0;
var TARGET_N = QUICK ? 1000 : 6000;

// ---- expected-fail (known open bugs; see spec/TABLE-SPEC.md) ----
var EXPECTED_FAIL = {
  // S8 favicon: fixed in dump19.
};
// S9 known pinch objects (expected-fail only while these are the only ones).
var S9_KNOWN = {}; // dump21: copper and cyan C boingers moved clear (pass A done)
// S5 known invisible-wall regions (counted as expected, not hidden).
var S5_KNOWN = [
  { id: 'cyan-ramp-gap', why: 'cyan ramp gap does not match its invisible wall (pass B)', x0: 95, y0: 80, x1: 250, y1: 135 }
];

var LL = S.LAUNCH_LANE_LEFT;
var LR = S.LAUNCH_LANE_RIGHT;
var R = S.BALL_RADIUS;
var W = S.TABLE_W;
var H = S.TABLE_H;
var WIRE_Y1 = S.LAUNCH_WIRE_Y1;

function rng(seed) {
  var s = (seed >>> 0) % 2147483647;
  if (s <= 0) s += 2147483646;
  return function () { s = (s * 16807) % 2147483647; return s / 2147483647; };
}
function hypot(a, b) { return Math.sqrt(a * a + b * b); }
function segDist(px, py, x1, y1, x2, y2) {
  var dx = x2 - x1, dy = y2 - y1, L = dx * dx + dy * dy;
  var t = L ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / L)) : 0;
  return hypot(x1 + t * dx - px, y1 + t * dy - py);
}
function saucersOf(s) { return [s.saucer, s.saucer2, s.saucer3].filter(Boolean); }
function inSaucer(s, b) {
  return saucersOf(s).some(function (h) { return hypot(b.x - h.x, b.y - h.y) < (h.radius || 15) + 2; });
}
function bucket(x, y) { return (Math.round(x / 10) * 10) + ',' + (Math.round(y / 10) * 10); }
function topBuckets(h, n) {
  return Object.keys(h).sort(function (a, b) { return h[b] - h[a]; }).slice(0, n || 6).map(function (k) { return k + ' x' + h[k]; });
}

var results = [];
function record(id, name, pass, numbers, notes) {
  var xf = EXPECTED_FAIL[id];
  var status = pass ? (xf ? 'XPASS' : 'PASS') : (xf ? 'XFAIL' : 'FAIL');
  results.push({ id: id, name: name, status: status, pass: !!pass, expectedFail: xf || null, numbers: numbers, notes: notes || [] });
}

var t0 = Date.now();

// ---------------------------------------------------------------------------
// Natural play: N seeded games, random plunge power, simple flipper bot.
// Feeds S3 (field->lane crossing), S4 (stationary), S6 (out of bounds), and
// the in-game lane-fallback count used by S1.
// ---------------------------------------------------------------------------
var nat = { games: 0, plunges: 0, ticks: 0, crossings: 0, crossAt: {}, stuck: 0, stuckAt: {}, oob: 0, oobAt: {}, fallbacks: 0, fallbackAt: {} };
(function naturalPlay() {
  var rnd = rng(SEED);
  for (var g = 0; g < GAMES; g++) {
    var s = S.createInitialState();
    nat.games++;
    var ticks = 0, anchor = null, held = 0, stuckFlag = false, oobFlag = false, inLane = false, fbFlag = false;
    var lastBall = null;
    while (s.phase !== 'game_over' && ticks < 60 * 240) {
      var dt = rnd() < 0.5 ? 1 / 60 : 1 / 30;
      if (!s.ball.inPlay && s.phase !== 'eob_bonus' && !(s.balls && s.balls.length)) {
        S.launchBall(s, 0.1 + rnd() * 0.9);
        nat.plunges++;
        anchor = null; held = 0; stuckFlag = false; oobFlag = false; inLane = false; fbFlag = false;
      }
      var b = s.ball;
      S.activateFlipper(s, 'left', b.y > 600 && b.x < 280 && rnd() < 0.7);
      S.activateFlipper(s, 'right', b.y > 600 && b.x >= 200 && rnd() < 0.7);
      var pre = { x: b.x, y: b.y, ex: s.exitedLaunchLane, inPlay: b.inPlay, ball: b };
      S.tick(s, dt);
      ticks++; nat.ticks++;
      b = s.ball;
      if (b !== lastBall) { anchor = null; held = 0; lastBall = b; }
      if (!b.inPlay || !pre.inPlay || pre.ball !== b) { inLane = false; continue; }
      // S3: field side -> lane side across the divider (below the lane top)
      if (pre.ex && s.exitedLaunchLane && pre.x < LL && b.x > LL + 2 && b.y > WIRE_Y1) {
        nat.crossings++; var ck = bucket(b.x, b.y); nat.crossAt[ck] = (nat.crossAt[ck] || 0) + 1;
      }
      // S1 (in game): a ball that has left the lane falls back down it
      var nowLane = b.x > LL + 2 && b.y > WIRE_Y1;
      if (nowLane && !inLane && pre.ex && s.exitedLaunchLane) inLane = true;
      if (!nowLane) inLane = false;
      if (inLane && !fbFlag && b.y > 300) { fbFlag = true; nat.fallbacks++; }
      // S6: center outside the cabinet
      if (!oobFlag && (b.x < 35 || b.x > W - 35 || b.y < 18)) {
        oobFlag = true; nat.oob++; var ok = bucket(b.x, b.y); nat.oobAt[ok] = (nat.oobAt[ok] || 0) + 1;
      }
      // S4: stationary > 1 s outside saucers
      if (anchor && Math.abs(b.x - anchor[0]) < 10 && Math.abs(b.y - anchor[1]) < 10) held += dt;
      else { anchor = [b.x, b.y]; held = 0; }
      if (held > 1 && !stuckFlag && !inSaucer(s, b) && s.phase !== 'eob_bonus') {
        stuckFlag = true; nat.stuck++; var sk = bucket(b.x, b.y); nat.stuckAt[sk] = (nat.stuckAt[sk] || 0) + 1;
      }
    }
  }
})();

// ---------------------------------------------------------------------------
// S1 soft plunge 20-40%: reaches field or returns to plunger, never falls back
// down the lane after it has left it.
// ---------------------------------------------------------------------------
(function s1() {
  var rnd = rng(SEED + 101);
  var n = QUICK ? 60 : 300, field = 0, returned = 0, fallback = 0, other = 0, at = {};
  for (var k = 0; k < n; k++) {
    var meter = 0.2 + 0.2 * rnd();
    var dt = rnd() < 0.5 ? 1 / 60 : 1 / 30;
    var s = S.createInitialState();
    S.launchBall(s, meter);
    var outcome = null, wasOut = false;
    for (var i = 0; i < 60 * 8 && !outcome; i++) {
      S.tick(s, dt);
      var b = s.ball;
      if (!b.inPlay) { outcome = wasOut ? 'other' : 'returned'; break; }
      if (s.exitedLaunchLane) wasOut = true;
      if (wasOut && b.x > LL + 2 && b.y > 300) { outcome = 'fallback'; at[meter.toFixed(2)] = 1; break; }
      if (b.x < LL - 30 && b.y > 140) { outcome = 'field'; break; }
    }
    if (outcome === 'field') field++; else if (outcome === 'returned') returned++; else if (outcome === 'fallback') fallback++; else other++;
  }
  var pass = fallback === 0 && nat.fallbacks === 0;
  record('S1', 'soft plunge 20-40% reaches field, no lane fallback', pass,
    { plunges: n, field: field, returnedToPlunger: returned, laneFallback: fallback, otherOrTimeout: other, inGameFallbacks: nat.fallbacks, inGamePlunges: nat.plunges },
    fallback ? ['fallback meters: ' + Object.keys(at).slice(0, 8).join(' ')] : []);
})();

// ---------------------------------------------------------------------------
// S2 full plunge rides the U.
// ---------------------------------------------------------------------------
(function s2() {
  var cases = [[1, 1 / 60], [1, 1 / 30], [0.95, 1 / 60], [0.95, 1 / 30]];
  var ok = 0, fails = [];
  cases.forEach(function (c) {
    var s = S.createInitialState();
    S.launchBall(s, c[0]);
    var inU = false;
    for (var i = 0; i < 240 && s.ball.inPlay; i++) {
      S.tick(s, c[1]);
      var b = s.ball;
      if (s.exitedLaunchLane && b.y < 90 && b.x > 160 && b.x < 400) { inU = true; break; }
    }
    if (inU) ok++; else fails.push('meter ' + c[0] + ' dt 1/' + Math.round(1 / c[1]));
  });
  record('S2', 'full plunge rides the U', ok === cases.length, { cases: cases.length, rodeU: ok }, fails);
})();

// ---------------------------------------------------------------------------
// S3 no field ball crosses the x=472 divider into the lane.
// ---------------------------------------------------------------------------
(function s3() {
  var rnd = rng(SEED + 202);
  var leaks = 0, at = {};
  for (var k = 0; k < TARGET_N; k++) {
    var s = S.createInitialState();
    var b = s.ball;
    b.inPlay = true;
    b.x = 300 + rnd() * (LL - 12 - 300); b.y = 110 + rnd() * 640;
    var sp = 200 + rnd() * 1400, a = (rnd() - 0.5) * Math.PI * 1.6;
    b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp;
    s.exitedLaunchLane = true; s.phase = 'playing';
    var dt = [1 / 120, 1 / 60, 1 / 30][k % 3];
    for (var i = 0; i < 90; i++) {
      var px = s.ball.x;
      S.stepPhysics(s, dt);
      if (!s.ball.inPlay) break;
      if (px < LL && s.ball.x > LL + 2 && s.ball.y > WIRE_Y1 && s.ball.y < 780) {
        leaks++; var kk = bucket(s.ball.x, s.ball.y); at[kk] = (at[kk] || 0) + 1; break;
      }
    }
  }
  record('S3', 'no field ball crosses the x=472 divider into the lane', leaks === 0 && nat.crossings === 0,
    { targeted: TARGET_N, targetedLeaks: leaks, inGameCrossings: nat.crossings },
    leaks || nat.crossings ? ['at: ' + topBuckets(at).concat(topBuckets(nat.crossAt)).join('; ')] : []);
})();

// ---------------------------------------------------------------------------
// S4 no ball stationary > 1 s outside saucers.
// ---------------------------------------------------------------------------
record('S4', 'no ball stationary >1s outside saucers', nat.stuck === 0,
  { games: nat.games, plunges: nat.plunges, stuckEvents: nat.stuck },
  nat.stuck ? ['where (x,y bucket): ' + topBuckets(nat.stuckAt, 8).join('; ')] : []);

// ---------------------------------------------------------------------------
// S5 drawn walls == collision walls. Renderer is run headless into a
// recording canvas; strokes/fills are compared with simulation geometry.
// ---------------------------------------------------------------------------
(function s5() {
  var notes = [];
  var drawn;
  try { drawn = recordRender(); } catch (e) {
    record('S5', 'drawn walls == collision walls', false, { manual: true }, ['headless render failed: ' + e.message + ' - check by eye']);
    return;
  }
  var state = drawn.state, segs = drawn.segs, circles = drawn.circles;
  function drawnNear(px, py, tol) {
    var i;
    for (i = 0; i < segs.length; i++) if (segDist(px, py, segs[i].x1, segs[i].y1, segs[i].x2, segs[i].y2) <= segs[i].w / 2 + tol) return true;
    for (i = 0; i < circles.length; i++) {
      var c = circles[i], d = hypot(px - c.x, py - c.y);
      if (Math.abs(d - c.r) <= c.w / 2 + tol || (c.fill && d <= c.r + tol)) return true;
    }
    return false;
  }
  // (a) collision without drawing = invisible wall
  var invisible = [], known = [], inactive = 0;
  state.walls.forEach(function (w, wi) {
    var L = hypot(w.x2 - w.x1, w.y2 - w.y1), n = Math.max(1, Math.ceil(L / 4)), run = null;
    for (var k = 0; k <= n; k++) {
      var t = k / n, x = w.x1 + (w.x2 - w.x1) * t, y = w.y1 + (w.y2 - w.y1) * t;
      // Arch arc pieces are skipped in resolveWallCollisions for any ball in
      // the top band (y<88, 40<x<LL-4); points a ball can only touch from
      // there are inactive, not invisible.
      var off = w.arc && y < 76 && x > 52 && x < LL - 16;
      if (off) inactive++;
      var ok = off || drawnNear(x, y, 5);
      if (!ok) { if (!run) run = { a: [x, y], b: [x, y] }; run.b = [x, y]; }
      if ((ok || k === n) && run) {
        if (hypot(run.b[0] - run.a[0], run.b[1] - run.a[1]) >= 10) {
          var item = { wall: wi, kind: w.kind, from: run.a.map(Math.round), to: run.b.map(Math.round) };
          var kn = S5_KNOWN.filter(function (r) {
            return Math.min(run.a[0], run.b[0]) >= r.x0 && Math.max(run.a[0], run.b[0]) <= r.x1 && Math.min(run.a[1], run.b[1]) >= r.y0 && Math.max(run.a[1], run.b[1]) <= r.y1;
          })[0];
          if (kn) { item.known = kn.id; known.push(item); } else invisible.push(item);
        }
        run = null;
      }
    }
  });
  // (b) drawn rail/tube without collision: thick strokes vs collidable geometry
  var coll = collidableSegs(state);
  var ghost = [];
  drawn.thick.forEach(function (st) {
    var run = null;
    st.pts.forEach(function (p, i) {
      var ok = coll.some(function (c) {
        if (c.circle) return Math.abs(hypot(p.x - c.x, p.y - c.y) - c.r) <= st.w / 2 + 7 || hypot(p.x - c.x, p.y - c.y) <= c.r + 4;
        return segDist(p.x, p.y, c.x1, c.y1, c.x2, c.y2) <= st.w / 2 + 7;
      });
      var outside = p.x < 0 || p.y < 0 || p.x > W || p.y > H;
      if (!ok && !outside) { if (!run) run = { a: p, b: p }; run.b = p; }
      if ((ok || outside || i === st.pts.length - 1) && run) {
        if (hypot(run.b.x - run.a.x, run.b.y - run.a.y) >= 10) ghost.push({ style: st.style.slice(0, 24), from: [Math.round(run.a.x), Math.round(run.a.y)], to: [Math.round(run.b.x), Math.round(run.b.y)] });
        run = null;
      }
    });
  });
  invisible.forEach(function (v) { notes.push('invisible wall #' + v.wall + ' ' + v.kind + ' ' + v.from.join(',') + ' -> ' + v.to.join(',')); });
  ghost.forEach(function (v) { notes.push('drawn, no collision ' + v.from.join(',') + ' -> ' + v.to.join(',') + ' (' + v.style + ')'); });
  known.forEach(function (v) { notes.push('known (' + v.known + ') #' + v.wall + ' ' + v.from.join(',') + ' -> ' + v.to.join(',')); });
  var pass = invisible.length === 0 && ghost.length === 0 && known.length === 0;
  var id = 'S5';
  // Only-known items -> XFAIL; anything new -> FAIL.
  if (!pass && invisible.length === 0 && ghost.length === 0) EXPECTED_FAIL.S5 = S5_KNOWN.map(function (r) { return r.why; }).join('; ');
  record(id, 'drawn walls == collision walls', pass,
    { walls: state.walls.length, drawnSegs: segs.length, invisibleRuns: invisible.length, drawnNoCollision: ghost.length, knownRuns: known.length, arcInactivePts: inactive },
    notes.concat(['scope: initial table state (elbow down, triangle up); moving parts and conditional walls are not compared']));
})();

// ---------------------------------------------------------------------------
// S6 no ball leaves the table bounds.
// ---------------------------------------------------------------------------
(function s6() {
  var rnd = rng(SEED + 303);
  var n = QUICK ? 1000 : 4000, oob = 0, at = {};
  for (var k = 0; k < n; k++) {
    var s = S.createInitialState(); var b = s.ball;
    b.inPlay = true; s.phase = 'playing'; s.exitedLaunchLane = true;
    b.x = 60 + rnd() * (LL - 80); b.y = 40 + rnd() * 680;
    var sp = 300 + rnd() * 1300, a = rnd() * Math.PI * 2;
    b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp;
    var dt = rnd() < 0.5 ? 1 / 60 : 1 / 30;
    for (var i = 0; i < 120; i++) {
      S.stepPhysics(s, dt);
      var B = s.ball;
      if (!B.inPlay || B.y > H) break;
      if (B.x < 35 || B.x > W - 35 || B.y < 18) { oob++; var kk = bucket(B.x, B.y); at[kk] = (at[kk] || 0) + 1; break; }
    }
  }
  record('S6', 'no ball leaves the table bounds', oob === 0 && nat.oob === 0,
    { targeted: n, targetedOob: oob, inGameOob: nat.oob },
    oob || nat.oob ? ['at: ' + topBuckets(at).concat(topBuckets(nat.oobAt)).join('; ')] : []);
})();

// ---------------------------------------------------------------------------
// S7 no tunneling through the main flippers (rest and held up).
// ---------------------------------------------------------------------------
(function s7() {
  var rnd = rng(SEED + 404);
  var n = QUICK ? 400 : 2000, through = 0, at = {};
  for (var k = 0; k < n; k++) {
    var s = S.createInitialState();
    var side = k % 2 ? 'right' : 'left';
    var held = (k >> 1) % 2 === 1;
    if (held) { S.activateFlipper(s, side, true); for (var w = 0; w < 30; w++) S.stepPhysics(s, 1 / 60); }
    var f = s.flippers.filter(function (q) { return q.side === side && q.role === 'main'; })[0];
    var tip = S.flipperTip(f);
    var u = 0.15 + 0.7 * rnd();
    var tx = f.pivotX + (tip.x - f.pivotX) * u, ty = f.pivotY + (tip.y - f.pivotY) * u;
    var b = s.ball; b.inPlay = true; s.phase = 'playing'; s.exitedLaunchLane = true;
    var sp = 600 + rnd() * 1000, ang = Math.PI / 2 + (rnd() - 0.5) * 0.8;
    b.x = tx - Math.cos(ang) * 40; b.y = ty - Math.sin(ang) * 40;
    b.vx = Math.cos(ang) * sp; b.vy = Math.sin(ang) * sp;
    var dt = rnd() < 0.5 ? 1 / 60 : 1 / 30;
    function sideOf(px, py) {
      var ff = s.flippers.filter(function (q) { return q.side === side && q.role === 'main'; })[0], tt = S.flipperTip(ff);
      var dx = tt.x - ff.pivotX, dy = tt.y - ff.pivotY, L = dx * dx + dy * dy;
      var t = ((px - ff.pivotX) * dx + (py - ff.pivotY) * dy) / L;
      return { s: Math.sign(dx * (py - ff.pivotY) - dy * (px - ff.pivotX)), t: t };
    }
    // dump21: a pass-through is a step whose path crosses the bat itself
    // (between 10% and 90% of its length). Side flips far from the bat (a ball
    // that bounced away and fell past the tip) are not tunneling.
    function crossesBat(x0, y0, x1, y1) {
      var ff = s.flippers.filter(function (q) { return q.side === side && q.role === 'main'; })[0], tt = S.flipperTip(ff);
      var ex = tt.x - ff.pivotX, ey = tt.y - ff.pivotY, mx = x1 - x0, my = y1 - y0;
      var den = mx * ey - my * ex;
      if (Math.abs(den) < 1e-9) return false;
      var qx = ff.pivotX - x0, qy = ff.pivotY - y0;
      var tm = (qx * ey - qy * ex) / den, tb = (qx * my - qy * mx) / den;
      return tm >= 0 && tm <= 1 && tb > 0.1 && tb < 0.9;
    }
    var s0 = sideOf(b.x, b.y).s;
    for (var i = 0; i < 20; i++) {
      var bx0 = s.ball.x, by0 = s.ball.y;
      S.stepPhysics(s, dt);
      if (!s.ball.inPlay) break;
      var q = sideOf(s.ball.x, s.ball.y);
      if (q.s !== s0 && q.s !== 0 && q.t > 0.1 && q.t < 0.9 && crossesBat(bx0, by0, s.ball.x, s.ball.y)) {
        through++; var kk = side + (held ? '-up' : '-rest'); at[kk] = (at[kk] || 0) + 1; break;
      }
    }
  }
  record('S7', 'no tunneling through flippers', through === 0, { shots: n, passedThrough: through },
    through ? ['by flipper: ' + JSON.stringify(at)] : []);
})();

// ---------------------------------------------------------------------------
// S8 every Pages HTML (root, v1, v2) declares an icon (no favicon.ico 404).
// ---------------------------------------------------------------------------
(function s8() {
  var pages = ['../index.html', '../pinball v1/index.html', 'index.html'];
  var missing = [];
  pages.forEach(function (rel) {
    var html = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    if (!/<link[^>]+rel=["'](?:shortcut )?icon["']/i.test(html)) missing.push(rel);
  });
  record('S8', 'page declares an icon (no favicon 404)', missing.length === 0,
    { pages: pages.length, missingIcon: missing.length },
    missing.map(function (m) { return m + ' has no <link rel="icon">; browsers request /favicon.ico and log a 404'; }));
})();

// ---------------------------------------------------------------------------
// S9 posts/boingers leave ball room: no pinch gap between a post/boinger and
// any other collidable (walls, rails, slings, fillers, flipper sweep) that is
// wider than 0 but narrower than a ball (2 * radius). Mounted pins (gap < 1)
// are part of their sling and are skipped.
// ---------------------------------------------------------------------------
(function s9() {
  var s = S.createInitialState();
  var objs = [];
  // Sling pins (kind 'pin') are mounted on their sling and are not checked.
  (s.posts || []).forEach(function (p) { if (p.kind === 'pin') return; objs.push({ id: p.id || 'post', x: p.x, y: p.y, r: p.radius || 4 }); });
  (s.boingers || []).forEach(function (p, i) { objs.push({ id: 'boinger' + i + (p.theme ? '-' + p.theme : ''), x: p.x, y: p.y, r: p.radius || 12 }); });
  var coll = collidableSegs(s);
  var pinches = [], minGap = null;
  objs.forEach(function (o) {
    coll.forEach(function (c) {
      var gap;
      if (c.circle) { if (Math.abs(c.x - o.x) < 0.5 && Math.abs(c.y - o.y) < 0.5) return; gap = hypot(c.x - o.x, c.y - o.y) - c.r - o.r; }
      else gap = segDist(o.x, o.y, c.x1, c.y1, c.x2, c.y2) - o.r;
      if (minGap == null || (gap >= 1 && gap < minGap)) minGap = gap >= 1 ? gap : minGap;
      if (gap >= 1 && gap < 2 * R) pinches.push({ obj: o.id, at: [Math.round(o.x), Math.round(o.y)], gap: +gap.toFixed(1), to: c.circle ? 'circle ' + Math.round(c.x) + ',' + Math.round(c.y) : 'seg ' + [c.x1, c.y1, c.x2, c.y2].map(Math.round).join(',') });
    });
    // flipper sweep (rest..active)
    s.flippers.forEach(function (f) {
      var a0 = Math.min(f.restAngle, f.activeAngle), a1 = Math.max(f.restAngle, f.activeAngle), best = 1e9;
      for (var a = a0; a <= a1 + 1e-9; a += (a1 - a0) / 24) {
        best = Math.min(best, segDist(o.x, o.y, f.pivotX, f.pivotY, f.pivotX + Math.cos(a) * f.length, f.pivotY + Math.sin(a) * f.length) - (f.width || 14) / 2 - o.r);
      }
      if (best >= 1 && best < 2 * R) pinches.push({ obj: o.id, at: [Math.round(o.x), Math.round(o.y)], gap: +best.toFixed(1), to: f.side + ' ' + (f.role || '') + ' flipper sweep' });
    });
  });
  // keep the tightest pinch per object
  var byObj = {};
  pinches.forEach(function (p) { if (!byObj[p.obj] || p.gap < byObj[p.obj].gap) byObj[p.obj] = p; });
  var list = Object.keys(byObj).map(function (k) { return byObj[k]; });
  var unknown = list.filter(function (t) { return !S9_KNOWN[t.obj]; });
  if (list.length && !unknown.length) EXPECTED_FAIL.S9 = list.map(function (t) { return S9_KNOWN[t.obj]; }).join('; ');
  record('S9', 'posts/boingers leave a ball-width gap (no pinch pockets)', list.length === 0,
    { checked: objs.length, pinches: pinches.length, objectsPinched: list.length, needGap: 2 * R },
    list.map(function (t) { return (S9_KNOWN[t.obj] ? 'known ' : '') + t.obj + ' at ' + t.at.join(',') + ': ' + t.gap + 'px to ' + t.to; }));
})();

// ---------------------------------------------------------------------------
// helpers: recording canvas for renderer.js, collidable geometry
// ---------------------------------------------------------------------------
function recordRender() {
  var M = [1, 0, 0, 1, 0, 0], stack = [], cur = [], sub = null, out = [];
  function tp(x, y) { return { x: M[0] * x + M[2] * y + M[4], y: M[1] * x + M[3] * y + M[5] }; }
  function mul(a, b, c, d, e, f) {
    var m = M;
    M = [m[0] * a + m[2] * b, m[1] * a + m[3] * b, m[0] * c + m[2] * d, m[1] * c + m[3] * d, m[0] * e + m[2] * f + m[4], m[1] * e + m[3] * f + m[5]];
  }
  var grad = { addColorStop: function () {} };
  var ctx = {
    save: function () { stack.push({ M: M.slice(), lw: ctx.lineWidth, ss: ctx.strokeStyle, fs: ctx.fillStyle }); },
    restore: function () { var st = stack.pop(); if (st) { M = st.M; ctx.lineWidth = st.lw; ctx.strokeStyle = st.ss; ctx.fillStyle = st.fs; } },
    translate: function (x, y) { mul(1, 0, 0, 1, x, y); },
    scale: function (x, y) { mul(x, 0, 0, y, 0, 0); },
    rotate: function (a) { var c = Math.cos(a), s = Math.sin(a); mul(c, s, -s, c, 0, 0); },
    setTransform: function (a, b, c, d, e, f) { M = [a, b, c, d, e, f]; },
    resetTransform: function () { M = [1, 0, 0, 1, 0, 0]; },
    beginPath: function () { cur = []; sub = null; },
    moveTo: function (x, y) { sub = [tp(x, y)]; cur.push(sub); },
    lineTo: function (x, y) { if (!sub) { sub = []; cur.push(sub); } sub.push(tp(x, y)); },
    quadraticCurveTo: function (cx, cy, x, y) { ctx.lineTo(x, y); },
    bezierCurveTo: function (a, b, c, d, x, y) { ctx.lineTo(x, y); },
    arcTo: function (a, b, x, y) { ctx.lineTo(x, y); },
    arc: function (x, y, r) { var c = tp(x, y); cur.push({ circle: true, x: c.x, y: c.y, r: r * hypot(M[0], M[1]) }); },
    ellipse: function (x, y, rx, ry) { var c = tp(x, y); cur.push({ circle: true, x: c.x, y: c.y, r: Math.max(rx, ry) }); },
    rect: function (x, y, w, h) { cur.push([tp(x, y), tp(x + w, y), tp(x + w, y + h), tp(x, y + h), tp(x, y)]); },
    closePath: function () { if (sub && sub.length) sub.push(sub[0]); },
    stroke: function () { out.push({ op: 'stroke', lw: ctx.lineWidth * hypot(M[0], M[1]), style: String(ctx.strokeStyle), paths: cur.slice() }); },
    fill: function () { out.push({ op: 'fill', style: String(ctx.fillStyle), paths: cur.slice() }); },
    fillRect: function (x, y, w, h) { out.push({ op: 'fill', style: String(ctx.fillStyle), paths: [[tp(x, y), tp(x + w, y), tp(x + w, y + h), tp(x, y + h), tp(x, y)]] }); },
    strokeRect: function (x, y, w, h) { out.push({ op: 'stroke', lw: ctx.lineWidth, style: String(ctx.strokeStyle), paths: [[tp(x, y), tp(x + w, y), tp(x + w, y + h), tp(x, y + h), tp(x, y)]] }); },
    clearRect: function () {}, clip: function () {},
    createLinearGradient: function () { return grad; }, createRadialGradient: function () { return grad; }, createPattern: function () { return null; },
    setLineDash: function () {}, fillText: function () {}, strokeText: function () {}, measureText: function () { return { width: 10 }; }, drawImage: function () {},
    lineWidth: 1, strokeStyle: '', fillStyle: '', lineCap: '', lineJoin: '', font: '', textAlign: '', textBaseline: '',
    shadowColor: '', shadowBlur: 0, globalAlpha: 1, globalCompositeOperation: ''
  };
  var window = { PinballSim: S, PinballAssets: null };
  var context = { window: window, Math: Math, console: { log: function () {}, warn: function () {}, error: function () {} }, Image: function () { this.complete = false; } };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets.js'), 'utf8'), context, { filename: 'assets.js' });
  window.PinballAssets = context.window.PinballAssets;
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'renderer.js'), 'utf8'), context, { filename: 'renderer.js' });
  var state = S.createInitialState();
  window.PinballRender.render({ width: 600, height: 980, getContext: function () { return ctx; } }, state, 0.016);
  // table space = translate(20, 80) in drawPlayfield
  var OX = 20, OY = 80, segs = [], circles = [], thick = [];
  out.forEach(function (o) {
    if (o.op === 'stroke' && o.lw < 1.5) return;
    var w = o.op === 'stroke' ? o.lw : 2;
    o.paths.forEach(function (pth) {
      if (pth.circle) { circles.push({ x: pth.x - OX, y: pth.y - OY, r: pth.r, w: w, fill: o.op === 'fill' }); return; }
      var pts = pth.map(function (p) { return { x: p.x - OX, y: p.y - OY }; });
      for (var i = 1; i < pts.length; i++) segs.push({ x1: pts[i - 1].x, y1: pts[i - 1].y, x2: pts[i].x, y2: pts[i].y, w: w });
      // Rail/tube strokes: solid-colour strokes >= 4px (gradients are bats/slings).
      if (o.op === 'stroke' && o.lw >= 4 && /^(rgba?\(|#)/.test(o.style) && !/rgba\(0,\s*0,\s*0/.test(o.style) && !/rgba\(255,\s*255,\s*255/.test(o.style)) {
        var dense = [];
        for (var j = 1; j < pts.length; j++) {
          var L = hypot(pts[j].x - pts[j - 1].x, pts[j].y - pts[j - 1].y), n = Math.max(1, Math.ceil(L / 4));
          for (var k = 0; k < n; k++) dense.push({ x: pts[j - 1].x + (pts[j].x - pts[j - 1].x) * k / n, y: pts[j - 1].y + (pts[j].y - pts[j - 1].y) * k / n });
        }
        if (pts.length) dense.push(pts[pts.length - 1]);
        thick.push({ w: o.lw, style: o.style, pts: dense });
      }
    });
  });
  return { state: state, segs: segs, circles: circles, thick: thick };
}

function collidableSegs(state) {
  var out = [];
  function addSeg(s) { if (s && s.x1 != null) out.push({ x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2 }); }
  function walk(v, depth) {
    if (!v || depth > 4) return;
    if (Array.isArray(v)) { v.forEach(function (x) { if (x && x.x1 != null) addSeg(x); else walk(x, depth + 1); }); return; }
    if (typeof v === 'object') Object.keys(v).forEach(function (k) { if (k !== 'entry' && k !== 'exit') walk(v[k], depth + 1); });
  }
  state.walls.forEach(addSeg);
  walk(state.sideRoutes, 0);
  (state.slingshots || []).forEach(addSeg);
  if (state.pulseTriangle && state.pulseTriangle.sides) state.pulseTriangle.sides.forEach(addSeg);
  state.flippers.forEach(function (f) { var t = S.flipperTip(f); out.push({ x1: f.pivotX, y1: f.pivotY, x2: t.x, y2: t.y }); });
  [].concat(state.posts || [], state.bumpers || [], state.boingers || [], saucersOf(state), state.sideRoutes && state.sideRoutes.leftCaptive ? [state.sideRoutes.leftCaptive] : [])
    .forEach(function (c) { if (c && c.x != null) out.push({ circle: true, x: c.x, y: c.y, r: c.radius || 8 }); });
  if (state.spinner) out.push({ circle: true, x: state.spinner.x, y: state.spinner.y, r: state.spinner.radius || 15 });
  if (state.gateSpinner) out.push({ x1: state.gateSpinner.x, y1: state.gateSpinner.y - state.gateSpinner.h / 2, x2: state.gateSpinner.x, y2: state.gateSpinner.y + state.gateSpinner.h / 2 });
  return out;
}

// ---------------------------------------------------------------------------
// report
// ---------------------------------------------------------------------------
var order = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9'];
results.sort(function (a, b) { return order.indexOf(a.id) - order.indexOf(b.id); });
results.forEach(function (r) { if (r.id === 'S5' && EXPECTED_FAIL.S5 && !r.pass) { r.status = 'XFAIL'; r.expectedFail = EXPECTED_FAIL.S5; } });
var secs = ((Date.now() - t0) / 1000).toFixed(1);
console.log('VOID PULSE table verify  games=' + GAMES + ' seed=' + SEED + (QUICK ? ' (quick)' : '') + '  ' + secs + 's');
console.log('');
console.log('ID   Status  Rule');
results.forEach(function (r) {
  var nums = Object.keys(r.numbers).map(function (k) { return k + '=' + r.numbers[k]; }).join(' ');
  console.log((r.id + '   ').slice(0, 5) + (r.status + '      ').slice(0, 8) + r.name);
  console.log('             ' + nums);
  if (r.expectedFail && !r.pass) console.log('             expected-fail: ' + r.expectedFail);
  r.notes.slice(0, 12).forEach(function (n) { console.log('             - ' + n); });
});
results.forEach(function (r) { if (r.id === 'S9' && EXPECTED_FAIL.S9 && !r.pass) { r.status = 'XFAIL'; r.expectedFail = EXPECTED_FAIL.S9; } });
var hardFail = results.filter(function (r) { return r.status === 'FAIL'; });
console.log('');
console.log(hardFail.length ? 'RESULT: FAIL (' + hardFail.map(function (r) { return r.id; }).join(', ') + ')' : 'RESULT: PASS (expected-fail rules still open: ' + results.filter(function (r) { return r.status === 'XFAIL'; }).map(function (r) { return r.id; }).join(', ') + ')');
if (WRITE_JSON) {
  fs.writeFileSync(path.join(__dirname, 'last-run.json'), JSON.stringify({
    date: new Date().toISOString().slice(0, 10), games: GAMES, seed: SEED, quick: QUICK, seconds: +secs,
    result: hardFail.length ? 'FAIL' : 'PASS', rules: results
  }, null, 2) + '\n');
}
process.exit(hardFail.length ? 1 : 0);
