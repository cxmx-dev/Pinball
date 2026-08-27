var sim = require('./simulation.js');
function dropFrom(x,y) {
  var st = sim.createInitialState();
  st.ball.inPlay = true; st.exitedLaunchLane = true; st.phase = 'playing';
  st.ball.x = x; st.ball.y = y; st.ball.vx = 0; st.ball.vy = 0;
  st.activeHabitrail = null; st.launchRailT = null;
  var t=0, hit=null, ys=[];
  for (var i=0;i<240;i++) {
    sim.stepPhysics(st, 1/60);
    t += 1/60;
    if (i%15===0) ys.push(+st.ball.y.toFixed(0));
    if (st.ball.y >= sim.FLIPPER_ROW_Y && hit==null) hit=t;
    if (!st.ball.inPlay || st.ball.y > sim.TABLE_H) break;
  }
  return {x:x,y0:y,t:hit, endY:+st.ball.y.toFixed(1), ys:ys, inPlay:st.ball.inPlay};
}
[[280,90],[280,110],[200,90],[240,80],[186,200]].forEach(function(p){ console.log(JSON.stringify(dropFrom(p[0],p[1]))); });
console.log('flipperRow', sim.FLIPPER_ROW_Y);
