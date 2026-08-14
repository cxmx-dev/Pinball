/**
 * Standard Gamepad map (W3C) — Xbox layout in the browser.
 * Equivalents: PS (✕○□△ L1/R1 L2/R2 Options/Create R3),
 * Switch (B/A/Y/X L/R ZL/ZR Plus/Minus R-stick in).
 */
(function (root) {
  'use strict';

  var BTN = {
    A: 0, B: 1, X: 2, Y: 3,
    LB: 4, RB: 5, LT: 6, RT: 7,
    SELECT: 8, START: 9,
    L3: 10, R3: 11,
    DUP: 12, DDOWN: 13, DLEFT: 14, DRIGHT: 15
  };
  var DEAD = 0.35;
  var TRIG = 0.45;

  function pressed(b) {
    if (!b) return false;
    if (b.pressed) return true;
    return (b.value || 0) >= TRIG;
  }

  function firstPad() {
    if (!navigator.getGamepads) return null;
    var pads = navigator.getGamepads();
    var i;
    for (i = 0; i < pads.length; i++) {
      if (pads[i] && pads[i].connected) return pads[i];
    }
    return null;
  }

  function poll() {
    var gp = firstPad();
    var empty = {
      connected: false,
      id: '',
      left: false,
      right: false,
      launch: false,
      tilt: false,
      theme: false,
      menu: false,
      navX: 0,
      navY: 0
    };
    if (!gp) return empty;
    var b = gp.buttons || [];
    var ax = gp.axes || [];
    var lt = pressed(b[BTN.LT]);
    var rt = pressed(b[BTN.RT]);
    var lb = pressed(b[BTN.LB]);
    var rb = pressed(b[BTN.RB]);
    var lx = ax[0] || 0;
    var ly = ax[1] || 0;
    var navX = 0;
    var navY = 0;
    if (pressed(b[BTN.DLEFT]) || lx < -DEAD) navX = -1;
    else if (pressed(b[BTN.DRIGHT]) || lx > DEAD) navX = 1;
    if (pressed(b[BTN.DUP]) || ly < -DEAD) navY = -1;
    else if (pressed(b[BTN.DDOWN]) || ly > DEAD) navY = 1;
    return {
      connected: true,
      id: gp.id || '',
      left: lt || lb || pressed(b[BTN.A]),
      right: rt || rb || pressed(b[BTN.B]),
      launch: pressed(b[BTN.X]) || pressed(b[BTN.SELECT]) || pressed(b[BTN.R3]),
      tilt: lt && rt && lb && rb,
      theme: pressed(b[BTN.Y]),
      menu: pressed(b[BTN.START]),
      navX: navX,
      navY: navY
    };
  }

  root.PinballPad = { poll: poll, BTN: BTN };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PinballPad;
})(typeof window !== 'undefined' ? window : global);
