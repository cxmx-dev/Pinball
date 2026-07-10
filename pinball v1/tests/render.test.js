'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var sim = require('../simulation.js');

function createTrackingContext() {
  var stats = { fillRect: 0, arc: 0, fill: 0, stroke: 0 };
  function track(name) {
    return function () { stats[name]++; };
  }
  var grad = { addColorStop: function () {} };
  return {
    stats: stats,
    ctx: {
      fillRect: track('fillRect'),
      arc: track('arc'),
      fill: track('fill'),
      stroke: track('stroke'),
      createLinearGradient: function () { return grad; },
      createRadialGradient: function () { return grad; },
      save: function () {},
      restore: function () {},
      translate: function () {},
      rotate: function () {},
      beginPath: function () {},
      moveTo: function () {},
      lineTo: function () {},
      quadraticCurveTo: function () {},
      closePath: function () {},
      strokeRect: function () { stats.stroke++; },
      setLineDash: function () {},
      fillText: function () {},
      strokeStyle: '',
      fillStyle: '',
      lineWidth: 0,
      lineCap: '',
      font: '',
      textAlign: '',
      textBaseline: '',
      shadowColor: '',
      shadowBlur: 0,
      globalAlpha: 1
    }
  };
}

console.log('Pinball render unit tests');
console.log('=========================');

(function testRenderDrawsSubstantialPlayfield() {
  var window = { PinballSim: sim };
  var context = { window: window, Math: Math, console: console };
  vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, '../renderer.js'), 'utf8'),
    context,
    { filename: 'renderer.js' }
  );

  var tracking = createTrackingContext();
  var canvas = {
    width: 520,
    height: 980,
    getContext: function () { return tracking.ctx; }
  };
  var state = sim.createInitialState();
  state.ball.inPlay = true;

  window.PinballRender.render(canvas, state, 0.016);

  console.log('  render stats: fillRect=' + tracking.stats.fillRect +
    ' arc=' + tracking.stats.arc +
    ' fill=' + tracking.stats.fill +
    ' stroke=' + tracking.stats.stroke);

  assert(tracking.stats.fillRect >= 4, 'cabinet, HUD, lane, drains fill rects');
  assert(tracking.stats.arc >= 10, 'bumpers, kickers, spinner, flippers, ball use arcs');
  assert(tracking.stats.fill >= 18, 'playfield must have substantial fill ops');
  assert(tracking.stats.stroke >= 8, 'walls, slings, rails must stroke');
  assert(state.slingshots.length >= 2, 'slingshots present in state');
  assert(state.targets.length >= 3, 'targets present in state');
  assert(state.multiplier >= 1, 'multiplier in state');
  console.log('PASS: render draws substantial non-placeholder surface');
})();

console.log('=========================');
console.log('All render tests passed.');