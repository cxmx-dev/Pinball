var sim = require('../simulation.js');
var st = sim.createInitialState();
var left = st.flippers[0], right = st.flippers[1];
var lt = sim.flipperTip(left), rt = sim.flipperTip(right);
console.log({
  lenL: left.length, lenR: right.length,
  pivots: [left.pivotX, right.pivotX],
  spacing: sim.FLIPPER_PIVOT_SPACING,
  tips: [lt.x, rt.x],
  tipGap: rt.x - lt.x,
  bounds: sim.getRestDrainBounds()
});
