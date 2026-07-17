/**
 * Pure high-score ranking helpers (Node + browser).
 * Browser persistence is wired from game.js via localStorage.
 */
(function (root) {
  'use strict';

  var DEFAULT_MAX = 5;
  var STORAGE_KEY = 'pinball-v2-highscores';

  function normalizeEntry(entry) {
    if (typeof entry === 'number') {
      return { score: Math.floor(entry), at: 0 };
    }
    if (!entry || typeof entry !== 'object') return null;
    var score = Math.floor(Number(entry.score));
    if (!isFinite(score) || score < 0) return null;
    var at = Number(entry.at);
    if (!isFinite(at)) at = 0;
    return { score: score, at: at };
  }

  /**
   * Insert score into ranked list, keep top max entries (highest first).
   * @param {Array} list prior entries
   * @param {number} score final score
   * @param {number} [max]
   * @param {number} [at] timestamp
   */
  function updateHighScores(list, score, max, at) {
    var cap = max != null ? max : DEFAULT_MAX;
    if (cap < 1) cap = 1;
    var prev = Array.isArray(list) ? list : [];
    var next = [];
    var i;
    for (i = 0; i < prev.length; i++) {
      var e = normalizeEntry(prev[i]);
      if (e) next.push(e);
    }
    var entry = normalizeEntry({ score: score, at: at != null ? at : Date.now() });
    if (entry) next.push(entry);
    next.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return (a.at || 0) - (b.at || 0);
    });
    return next.slice(0, cap);
  }

  function isHighScore(list, score, max) {
    var cap = max != null ? max : DEFAULT_MAX;
    var s = Math.floor(Number(score));
    if (!isFinite(s) || s < 0) return false;
    var ranked = Array.isArray(list) ? list.slice() : [];
    ranked = ranked.map(normalizeEntry).filter(Boolean);
    ranked.sort(function (a, b) { return b.score - a.score; });
    if (ranked.length < cap) return true;
    return s > ranked[ranked.length - 1].score;
  }

  function formatShareLine(score, rank) {
    var s = Math.floor(Number(score)) || 0;
    var line = 'Void Pulse Pinball — score ' + s.toLocaleString('en-US');
    if (rank != null && rank > 0) line += ' (#' + rank + ' local)';
    return line;
  }

  function rankOfScore(list, score) {
    var ranked = updateHighScores(list, score, 99);
    var s = Math.floor(Number(score));
    var i;
    for (i = 0; i < ranked.length; i++) {
      if (ranked[i].score === s) return i + 1;
    }
    return null;
  }

  var api = {
    DEFAULT_MAX: DEFAULT_MAX,
    STORAGE_KEY: STORAGE_KEY,
    updateHighScores: updateHighScores,
    isHighScore: isHighScore,
    formatShareLine: formatShareLine,
    rankOfScore: rankOfScore,
    normalizeEntry: normalizeEntry
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof root !== 'undefined') {
    root.PinballHighScores = api;
  }
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
