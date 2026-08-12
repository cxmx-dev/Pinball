var sim = require('../simulation.js');
var LEN = Math.round(2.75 / 20.25 * sim.TABLE_W);
function tip(f){ return { x: f.pivotX + Math.cos(f.angle)*f.length, y: f.pivotY + Math.sin(f.angle)*f.length }; }
var st0 = sim.createInitialState();
var left = st0.flippers[0], right = st0.flippers[1];
var lt = tip(left), rt = tip(right);
var cx = (lt.x + rt.x) / 2;

function smoke(label, x, y, vx, vy, framesMax) {
  var st = sim.createInitialState();
  st.exitedLaunchLane = true;
  st.ball.inPlay = true;
  st.phase = 'playing';
  st.ballSaveTimer = 0;
  st.ball.x = x; st.ball.y = y; st.ball.vx = vx; st.ball.vy = vy;
  var minY = y, maxY = y, drained = false, lofted = false, frames = 0;
  var balls0 = st.ballsRemaining;
  var path = [];
  for (var i = 0; i < (framesMax||240); i++) {
    sim.tick(st, 1/60);
    frames = i + 1;
    if (st.ball && st.ball.inPlay) {
      minY = Math.min(minY, st.ball.y);
      maxY = Math.max(maxY, st.ball.y);
      if (i < 40 || i % 20 === 0) path.push([i, +st.ball.x.toFixed(1), +st.ball.y.toFixed(1), +st.ball.vx.toFixed(0), +st.ball.vy.toFixed(0)]);
      if (i > 8 && st.ball.y < sim.FLIPPER_ROW_Y - 40) lofted = true;
    }
    if (st.ballsRemaining < balls0 || st.phase === 'eob_bonus' || (st.ball && !st.ball.inPlay)) {
      drained = true;
      break;
    }
  }
  console.log(label, { drained: drained, frames: frames, minY: +minY.toFixed(1), maxY: +maxY.toFixed(1), lofted: lofted });
  if (!drained) console.log('  path sample', JSON.stringify(path.slice(0,12)), '...', JSON.stringify(path.slice(-3)));
}

// near gap edges / tip crawl corridor
smoke('gap-left-edge', lt.x + 8, sim.FLIPPER_ROW_Y - 10, 0, 25);
smoke('gap-right-edge', rt.x - 8, sim.FLIPPER_ROW_Y - 10, 0, 25);
smoke('on-left-tip', lt.x, lt.y - 14, 0, 10);
smoke('on-right-tip', rt.x, rt.y - 14, 0, 10);
smoke('just-above-gap', cx, sim.FLIPPER_ROW_Y - 2, 15, 10);
smoke('slow-diagonal-into-gap', lt.x + 5, sim.FLIPPER_ROW_Y - 40, 30, 50);
smoke('slow-from-inlane-L', (lt.x + 107)/2, sim.FLIPPER_ROW_Y - 20, 40, 30);
