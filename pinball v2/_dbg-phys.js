var sim = require('./simulation.js');
function dropTime() {
  var st = sim.createInitialState();
  st.ball.inPlay = true; st.exitedLaunchLane = true; st.phase = 'playing';
  st.ball.x = 280; st.ball.y = 56; st.ball.vx = 0; st.ball.vy = 0;
  st.activeHabitrail = null;
  var t = 0, hit = null;
  for (var i = 0; i < 240; i++) {
    sim.stepPhysics(st, 1/60);
    t += 1/60;
    if (st.ball.y >= sim.FLIPPER_ROW_Y && hit == null) hit = t;
    if (!st.ball.inPlay) break;
  }
  return {t:hit, endY:st.ball.y, endX:st.ball.x, inPlay:st.ball.inPlay};
}
function runMeter(m) {
  var st = sim.createInitialState();
  st.launchPower = m;
  sim.launchBall(st, m);
  var inU=false, dumped=false, maxY=st.ball.y, minY=st.ball.y, exited=false;
  var path=[];
  for (var i=0;i<200;i++) {
    sim.tick(st, 1/60);
    var b=st.ball;
    if (b.y<minY) minY=b.y;
    if (b.y>maxY) maxY=b.y;
    if (st.exitedLaunchLane) exited=true;
    if (st.exitedLaunchLane && b.y<90 && b.x>140 && b.x<440) inU=true;
    if (!inU && b.x>420 && b.x<500 && b.y>120 && b.y<280) dumped=true;
    if (i%20===0) path.push({i:i,x:+b.x.toFixed(0),y:+b.y.toFixed(0),ex:!!st.exitedLaunchLane});
    if (!b.inPlay && i>12) break;
  }
  return {m:m, vy0: -Math.round(Math.abs(/*relaunch*/0)), speed: Math.round(Math.hypot(0,0)), exited:exited, inU:inU, dumped:dumped, minY:+minY.toFixed(1), end:[+st.ball.x.toFixed(1),+st.ball.y.toFixed(1)], path:path};
}
function runMeter2(m) {
  var st = sim.createInitialState();
  sim.launchBall(st, m);
  var vy0 = st.ball.vy;
  var inU=false, dumped=false, minY=st.ball.y, exited=false, fellLane=false;
  for (var i=0;i<200;i++) {
    sim.tick(st, 1/60);
    var b=st.ball;
    if (b.y<minY) minY=b.y;
    if (st.exitedLaunchLane) exited=true;
    if (st.exitedLaunchLane && b.y<90 && b.x>140 && b.x<440) inU=true;
    if (!inU && b.x>420 && b.x<500 && b.y>120 && b.y<280) dumped=true;
    if (b.x>sim.LAUNCH_LANE_LEFT && b.y>400 && st.exitedLaunchLane===false && b.vy>0) fellLane=true;
    if (!b.inPlay && i>12) break;
  }
  return {m:m, vy0:vy0, p:st.activeLaunchPower, exited:exited, inU:inU, dumped:dumped, fellLane:fellLane, minY:+minY.toFixed(1), end:[+st.ball.x.toFixed(1),+st.ball.y.toFixed(1)]};
}
console.log('drop', dropTime());
console.log('g', sim.GRAVITY, 'pitch', sim.TABLE_PITCH_DEG, 'drag', sim.BALL_DRAG_BASE, sim.BALL_DRAG_SPEED);
[0.15,0.5,1.0,600,800,1400].forEach(function(m){ console.log(JSON.stringify(runMeter2(m))); });
