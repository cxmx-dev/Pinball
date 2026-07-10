'use strict';

var fs = require('fs');
var path = require('path');
var os = require('os');
var sim = require('./simulation.js');

var scratch = process.env.SCRATCH || path.join(os.tmpdir(), 'pinball-scratch');
var log = [];

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function runDrainZonePhysics(label, x, vy, vx) {
  vy = vy || 0;
  vx = vx || 0;
  var state = sim.createInitialState();
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  state.ball.x = x;
  state.ball.y = sim.FLIPPER_ROW_Y + 16;
  state.ball.vx = vx;
  state.ball.vy = vy;
  for (var i = 0; i < 600; i++) {
    sim.tick(state, 0.016);
    if (!state.ball.inPlay) break;
    assert(state.ball.y < sim.TABLE_H + 120, label + ': ball must not escape below table');
  }
  assert(state.ball.inPlay === false, label + ': ball should leave play');
  assert(state.ballsRemaining === 2, label + ': should lose one ball');
  log.push('OK ' + label + ' physics drain x=' + x.toFixed(1) + ' vy=' + vy + ' vx=' + vx);
}

function runLaneBlock() {
  var state = sim.createInitialState();
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  state.ball.x = 410;
  state.ball.y = 720;
  state.ball.vx = 100;
  sim.stepPhysics(state, 0.016);
  assert(state.ball.x + state.ball.radius < sim.LAUNCH_LANE_LEFT + 2, 'lane block');
  log.push('OK shooter lane blocks intrusion at flipper height');
}

function runUnstick() {
  var state = sim.createInitialState();
  state.ballsRemaining = 1;
  state.ball.inPlay = true;
  state.exitedLaunchLane = true;
  state.ball.x = 300;
  state.ball.y = 728;
  state.ball.vx = 0;
  state.ball.vy = 0;
  var stuck = 0;
  for (var i = 0; i < 120; i++) {
    sim.tick(state, 0.016);
    if (!state.ball.inPlay) break;
    var sp = Math.sqrt(state.ball.vx * state.ball.vx + state.ball.vy * state.ball.vy);
    if (sp < 35 && state.ball.y > sim.FLIPPER_ROW_Y - 10) stuck++;
    else stuck = 0;
    assert(stuck < 20, 'unstick: no long rest on flipper');
    assert(state.ball.y < sim.TABLE_H + 120, 'unstick: no table escape');
  }
  log.push('OK flipper unstick/drain resolves bottom-right rest');
}

try {
  var zones = sim.getDrainBounds(sim.createInitialState());
  runDrainZonePhysics('left outlane slow', (zones.leftOutlaneLeft + zones.leftOutlaneRight) / 2, 0, 0);
  runDrainZonePhysics('left outlane fast', (zones.leftOutlaneLeft + zones.leftOutlaneRight) / 2, 80, 40);
  runDrainZonePhysics('center slow', (zones.centerLeft + zones.centerRight) / 2, 0, 0);
  runDrainZonePhysics('center vy80', (zones.centerLeft + zones.centerRight) / 2, 80, 0);
  runDrainZonePhysics('center vy80 drift', (zones.centerLeft + zones.centerRight) / 2, 80, 120);
  runDrainZonePhysics('right outlane slow', (zones.rightOutlaneLeft + zones.rightOutlaneRight) / 2, 0, 0);
  runDrainZonePhysics('right outlane fast', (zones.rightOutlaneLeft + zones.rightOutlaneRight) / 2, 80, -30);
  runLaneBlock();
  runUnstick();
  log.push('DRAIN_Y=' + sim.DRAIN_Y + ' DRAIN_SLOT_TOP=' + sim.DRAIN_SLOT_TOP);
  log.push('=== All drain/lane scenarios passed ===');
  fs.mkdirSync(scratch, { recursive: true });
  fs.writeFileSync(path.join(scratch, 'drain-scenarios.log'), log.join('\n') + '\n');
  console.log(log.join('\n'));
} catch (err) {
  log.push('ERROR: ' + err.message);
  fs.mkdirSync(scratch, { recursive: true });
  fs.writeFileSync(path.join(scratch, 'drain-scenarios.log'), log.join('\n') + '\n');
  console.error(err);
  process.exit(1);
}