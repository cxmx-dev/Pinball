var sim = require('./simulation.js');
function fresh() { return sim.createInitialState(); }
function run(power) {
  var st = fresh();
  sim.launchBall(st, power);
  var minX = 999, minY = 999, left280 = false, cyan = false, dump361 = false, hall = false, entered = false;
  var path = [];
  for (var i = 0; i < 320; i++) {
    sim.tick(st, 1/60);
    var b = st.ball;
    if (!b || !b.inPlay) break;
    if (b.x < 500 && b.x > 400 && b.y < 180) entered = true;
    if (entered && b.x > sim.LAUNCH_LANE_LEFT && b.y > 200) hall = true;
    if (st.exitedLaunchLane && b.y < 110 && b.x < 280) left280 = true;
    if (st.exitedLaunchLane && b.y < 90 && b.x < 280) cyan = true;
    if (Math.abs(b.x-361)<18 && Math.abs(b.y-238)<18) dump361 = true;
    if (b.x < minX) minX = b.x;
    if (b.y < minY) minY = b.y;
    if (i % 8 === 0) path.push(b.x.toFixed(0)+','+b.y.toFixed(0));
    if (b.y > 520 && st.exitedLaunchLane) break;
    if (st.phase === 'ready' && i > 30) break;
  }
  var b = st.ball;
  console.log('P'+power+' end='+b.x.toFixed(1)+','+b.y.toFixed(1)+
    ' minX='+minX.toFixed(1)+' minY='+minY.toFixed(1)+
    ' left280='+left280+' cyan='+cyan+' dump361='+dump361+' hall='+hall+
    ' rem='+st.ballsRemaining+' exited='+st.exitedLaunchLane+
    ' path='+path.slice(0,14).join(' > '));
}
[500,600,650,700,750,800,850,900,1000,1100,1200,1400].forEach(run);
