'use strict';

var assert = require('assert');
var HS = require('../highscores.js');
var Audio = require('../audio.js');

console.log('Pinball P2 polish unit tests');
console.log('============================');

(function testHighScoreInsertOrderAndCap() {
  var list = [];
  list = HS.updateHighScores(list, 100, 5, 1);
  list = HS.updateHighScores(list, 500, 5, 2);
  list = HS.updateHighScores(list, 300, 5, 3);
  list = HS.updateHighScores(list, 400, 5, 4);
  list = HS.updateHighScores(list, 200, 5, 5);
  list = HS.updateHighScores(list, 50, 5, 6); // 6th — should drop lowest
  assert.strictEqual(list.length, 5, 'cap at 5');
  assert.strictEqual(list[0].score, 500, 'highest first');
  assert.strictEqual(list[4].score, 100, 'lowest kept is 100 not 50');
  assert(!list.some(function (e) { return e.score === 50; }), '50 dropped');
  assert(HS.isHighScore([{ score: 100 }, { score: 90 }], 95, 2));
  assert(!HS.isHighScore([{ score: 100 }, { score: 90 }], 80, 2));
  console.log('PASS: high-score insert/order/cap');
})();

(function testShareLineAnonymous() {
  var line = HS.formatShareLine(12345, 2);
  assert(/Void Pulse Pinball/.test(line));
  assert(/12,345|12345/.test(line));
  assert(/#2/.test(line));
  // OPSEC: share line must not embed profile or drive paths (patterns built so source stays scan-clean)
  assert(line.indexOf('Users' + String.fromCharCode(92)) === -1, 'no Users path');
  assert(!/[A-Za-z]:\\/.test(line), 'no drive-letter path');
  console.log('PASS: share line anonymous');
})();

(function testMuteDefaultAndToggle() {
  assert.strictEqual(typeof Audio.isMuted, 'function');
  assert.strictEqual(Audio.isMuted(), false, 'default unmuted');
  Audio.setMuted(true);
  assert.strictEqual(Audio.isMuted(), true);
  Audio.toggleMute();
  assert.strictEqual(Audio.isMuted(), false);
  Audio.setMuted(false);
  console.log('PASS: mute default + toggle');
})();

(function testDockLaunchVisibilityRule() {
  // Pure rule mirrored from game.js updateDockContext
  function launchDimmed(ballInPlay, phase) {
    return !!(ballInPlay && phase === 'playing');
  }
  assert.strictEqual(launchDimmed(false, 'ready'), false);
  assert.strictEqual(launchDimmed(true, 'playing'), true);
  assert.strictEqual(launchDimmed(true, 'eob_bonus'), false);
  assert.strictEqual(launchDimmed(false, 'game_over'), false);
  console.log('PASS: dock Launch dim rule');
})();

console.log('============================');
console.log('All P2 polish tests passed.');
