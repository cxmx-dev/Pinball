var fs = require('fs');
var s = fs.readFileSync('simulation.js', 'utf8');
function once(a, b, l) {
  var n = s.split(a).length - 1;
  if (n !== 1) throw new Error(l + ' got ' + n);
  s = s.split(a).join(b);
}
once(
  '    var dumpSlide = (state.activeLaunchPower || 0) < 800;',
  '    var dumpSlide = (state.activeLaunchPower || 0) < 860;',
  'dumpSlide'
);
once(
  '    if (!canRideFloor) {\n      // dump2: entered the elbow but cannot crest. Do not hall-return.\n      // Physical inner-wall window dumps them — no teleport onto play.\n      if (ball.x > 456 && ball.y < 140 && ball.vy > 20) {\n        if (ball.vx > -80) ball.vx = -80;\n      }\n    }',
  '    if (!canRideFloor) {\n      // dump2: reached the mouth but cannot crest the U. Pull left into the\n      // orange elbow so the inner-wall window can dump — no hall rollback.\n      if (ball.y < 120 && ball.x > 448) {\n        if (ball.vx > -140) ball.vx = -140;\n      }\n    }',
  'floor'
);
once(
  '    var mx = (canRideFloor ? (LAUNCH_LANE_LEFT - 20) : 438) - ball.x;\n    var my = (canRideFloor ? 80 : 158) - ball.y;',
  '    var mx = (canRideFloor ? (LAUNCH_LANE_LEFT - 20) : 450) - ball.x;\n    var my = (canRideFloor ? 80 : 96) - ball.y;',
  'assist'
);
fs.writeFileSync('simulation.js', s);
console.log('ok');
