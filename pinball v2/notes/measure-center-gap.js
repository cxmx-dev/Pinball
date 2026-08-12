var sim = require('../simulation.js');
var LEN = Math.round(2.75 / 20.25 * sim.TABLE_W);
var left = { pivotX: sim.FLIPPER_LEFT_PIVOT_X, pivotY: sim.FLIPPER_ROW_Y, angle: 0.42, length: LEN, width: 14 };
var right = { pivotX: sim.FLIPPER_RIGHT_PIVOT_X, pivotY: sim.FLIPPER_ROW_Y, angle: Math.PI - 0.42, length: LEN, width: 14 };
function tip(f){ return { x: f.pivotX + Math.cos(f.angle)*f.length, y: f.pivotY + Math.sin(f.angle)*f.length }; }
var lt=tip(left), rt=tip(right);
console.log('LEFT_PIVOT', sim.FLIPPER_LEFT_PIVOT_X, 'RIGHT_PIVOT', sim.FLIPPER_RIGHT_PIVOT_X);
console.log('SPACING', sim.FLIPPER_PIVOT_SPACING, 'LEN', LEN, 'ROW_Y', sim.FLIPPER_ROW_Y);
console.log('tips', JSON.stringify(lt), JSON.stringify(rt), 'gap', (rt.x-lt.x).toFixed(2));
console.log('centerZone', (lt.x+4).toFixed(2), (rt.x-4).toFixed(2), 'width', ((rt.x-4)-(lt.x+4)).toFixed(2));

function smoke(label, x, y, vx, vy) {
  var st = sim.createInitialState();
  st.exitedLaunchLane = true;
  st.ball.inPlay = true;
  st.phase = 'playing';
  st.ballSaveTimer = 0;
  st.ball.x = x; st.ball.y = y; st.ball.vx = vx; st.ball.vy = vy;
  var minY = y, maxY = y, drained = false, lofted = false, frames = 0;
  var balls0 = st.ballsRemaining;
  for (var i = 0; i < 360; i++) {
    sim.tick(st, 1/60);
    frames = i + 1;
    if (st.ball && st.ball.inPlay) {
      minY = Math.min(minY, st.ball.y);
      maxY = Math.max(maxY, st.ball.y);
      if (i > 8 && st.ball.y < sim.FLIPPER_ROW_Y - 40) lofted = true;
    }
    if (st.ballsRemaining < balls0 || st.phase === 'eob_bonus' || (st.ball && !st.ball.inPlay)) {
      drained = true;
      break;
    }
  }
  console.log(label, {
    drained: drained, frames: frames, minY: minY.toFixed(1), maxY: maxY.toFixed(1),
    lofted: lofted,
    final: st.ball ? { x: +st.ball.x.toFixed(1), y: +st.ball.y.toFixed(1), vx: +st.ball.vx.toFixed(1), vy: +st.ball.vy.toFixed(1), inPlay: st.ball.inPlay } : null,
    balls: st.ballsRemaining, phase: st.phase
  });
}
var cx = (lt.x + rt.x) / 2;
smoke('center-low-vy', cx, sim.FLIPPER_ROW_Y - 28, 0, 40);
smoke('center-crawl', cx, sim.FLIPPER_ROW_Y - 8, 0, 20);
smoke('tip-left', lt.x - 2, sim.FLIPPER_ROW_Y - 4, 5, 15);
smoke('tip-right', rt.x + 2, sim.FLIPPER_ROW_Y - 4, -5, 15);
smoke('between-tips-deep', cx, sim.FLIPPER_ROW_Y + 8, 0, 60);
