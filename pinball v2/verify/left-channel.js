#!/usr/bin/env node
'use strict';
/**
 * dump32: left-wall channel check. Fires balls into the left side of the
 * table and fails if any ball center ever sits behind the cyan tube's outer
 * rail (the wedge between the cabinet wall x=36 and the tube, y 200..360).
 *   node verify/left-channel.js
 */
var path = require('path');
var S = require(path.join(__dirname, '..', 'simulation.js'));

function outerX(y) { // tube outer rail: (36,200)->(46,278)->(60,345)
  if (y <= 278) return 36 + (y - 200) * 10 / 78;
  return 46 + (y - 278) * 14 / 67;
}
function inChannel(b) {
  return b.y > 205 && b.y < 345 && b.x < outerX(b.y) - 1;
}
function rng(seed) { var s = seed; return function () { s = (s * 16807) % 2147483647; return s / 2147483647; }; }

var r = rng(32), hits = 0, shots = 0, firstHit = null;
for (var i = 0; i < 4000; i++) {
  var s = S.createInitialState();
  var b = s.ball;
  b.x = 40 + r() * 60; b.y = 385 + r() * 200; // below the seal foot (36,372)
  var ang = -Math.PI / 2 + (r() - 0.6) * 1.2; var sp = 300 + r() * 1300;
  b.vx = Math.cos(ang) * sp; b.vy = Math.sin(ang) * sp;
  b.inPlay = true; s.exitedLaunchLane = true; if ('launched' in s) s.launched = true;
  shots++;
  for (var t = 0; t < 240; t++) {
    S.stepPhysics(s, 1 / 120);
    var bb = s.ball;
    if (inChannel(bb)) { hits++; if (!firstHit) firstHit = { shot: i, x: +bb.x.toFixed(1), y: +bb.y.toFixed(1) }; break; }
  }
}
console.log('left-channel: shots=' + shots + ' inChannel=' + hits + (firstHit ? ' first=' + JSON.stringify(firstHit) : ''));
console.log(hits === 0 ? 'PASS' : 'FAIL');
process.exit(hits === 0 ? 0 : 1);
