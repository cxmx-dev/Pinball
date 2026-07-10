'use strict';

/**
 * Procedural PNG art generator for Void Pulse table themes.
 * No external deps beyond Node zlib — produces real image files under assets/.
 */
var fs = require('fs');
var path = require('path');
var zlib = require('zlib');

var root = path.join(__dirname, '..');
var themesRoot = path.join(root, 'assets', 'themes');

function crc32(buf) {
  var table = crc32.table;
  if (!table) {
    table = crc32.table = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  var crc = 0xffffffff;
  for (var i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function u32(n) {
  var b = Buffer.alloc(4);
  b.writeUInt32BE(n >>> 0, 0);
  return b;
}

function chunk(type, data) {
  var typeBuf = Buffer.from(type, 'ascii');
  var len = u32(data.length);
  var crcBuf = Buffer.concat([typeBuf, data]);
  var crc = u32(crc32(crcBuf));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function writePng(filePath, width, height, rgbaFn) {
  var raw = Buffer.alloc((width * 4 + 1) * height);
  for (var y = 0; y < height; y++) {
    var row = y * (width * 4 + 1);
    raw[row] = 0;
    for (var x = 0; x < width; x++) {
      var c = rgbaFn(x, y, width, height);
      var i = row + 1 + x * 4;
      raw[i] = c[0];
      raw[i + 1] = c[1];
      raw[i + 2] = c[2];
      raw[i + 3] = c[3];
    }
  }
  var compressed = zlib.deflateSync(raw, { level: 9 });
  var ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  var png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0))
  ]);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, png);
  return filePath;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function mix(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function dist(x, y, cx, cy) {
  var dx = x - cx;
  var dy = y - cy;
  return Math.sqrt(dx * dx + dy * dy);
}

function genPlayfield(themeId, palette) {
  var w = 480;
  var h = 860;
  return writePng(path.join(themesRoot, themeId, 'playfield', 'base.png'), w, h, function (x, y) {
    var ny = y / h;
    var nx = x / w;
    var r = mix(palette.bg0[0], palette.bg1[0], ny);
    var g = mix(palette.bg0[1], palette.bg1[1], ny);
    var b = mix(palette.bg0[2], palette.bg1[2], ny);

    // circuit grid
    if (x % 40 === 0 || y % 40 === 0) {
      r = mix(r, palette.grid[0], 0.18);
      g = mix(g, palette.grid[1], 0.18);
      b = mix(b, palette.grid[2], 0.18);
    }

    // neon lane rails
    if (x > 20 && x < 40) {
      r = mix(r, palette.neonA[0], 0.55);
      g = mix(g, palette.neonA[1], 0.55);
      b = mix(b, palette.neonA[2], 0.55);
    }
    if (x > w - 100 && x < w - 40 && y > 50) {
      r = mix(r, palette.neonB[0], 0.35);
      g = mix(g, palette.neonB[1], 0.35);
      b = mix(b, palette.neonB[2], 0.35);
    }

    // bumper pads (visual only)
    var pads = [
      [w * 0.5, 200, 42],
      [w * 0.28, 300, 34],
      [w * 0.72, 300, 34],
      [w * 0.5, 390, 30]
    ];
    for (var i = 0; i < pads.length; i++) {
      var p = pads[i];
      var d = dist(x, y, p[0], p[1]);
      if (d < p[2]) {
        var t = 1 - d / p[2];
        r = mix(r, palette.pad[0], 0.25 + t * 0.35);
        g = mix(g, palette.pad[1], 0.25 + t * 0.35);
        b = mix(b, palette.pad[2], 0.25 + t * 0.35);
      } else if (d < p[2] + 3) {
        r = mix(r, palette.neonA[0], 0.7);
        g = mix(g, palette.neonA[1], 0.7);
        b = mix(b, palette.neonA[2], 0.7);
      }
    }

    // top starfield
    if (y < 160 && ((x * 17 + y * 31) % 97) === 0) {
      r = g = b = 220;
    }

    // vignette
    var vx = (nx - 0.5) * 2;
    var vy = (ny - 0.5) * 2;
    var vig = clamp(1 - (vx * vx + vy * vy) * 0.35, 0.55, 1);
    r = Math.round(r * vig);
    g = Math.round(g * vig);
    b = Math.round(b * vig);

    return [r, g, b, 255];
  });
}

function genBumper(themeId, name, palette, hot) {
  var size = 128;
  var cx = size / 2;
  var cy = size / 2;
  var maxR = size / 2 - 4;
  return writePng(path.join(themesRoot, themeId, 'bumpers', name + '.png'), size, size, function (x, y) {
    var d = dist(x, y, cx, cy);
    if (d > maxR) return [0, 0, 0, 0];
    var t = d / maxR;
    var core = hot ? palette.hitCore : palette.idleCore;
    var rim = hot ? palette.hitRim : palette.idleRim;
    var r, g, b, a;
    if (t < 0.25) {
      r = mix(255, core[0], t / 0.25);
      g = mix(255, core[1], t / 0.25);
      b = mix(255, core[2], t / 0.25);
      a = 255;
    } else if (t < 0.75) {
      var u = (t - 0.25) / 0.5;
      r = mix(core[0], rim[0], u);
      g = mix(core[1], rim[1], u);
      b = mix(core[2], rim[2], u);
      a = 255;
    } else {
      var v = (t - 0.75) / 0.25;
      r = mix(rim[0], 20, v);
      g = mix(rim[1], 20, v);
      b = mix(rim[2], 40, v);
      a = Math.round(255 * (1 - v * 0.15));
    }
    if (hot && t < 0.9) {
      r = clamp(r + 40, 0, 255);
      g = clamp(g + 20, 0, 255);
    }
    // ring
    if (d > maxR - 5 && d < maxR - 1) {
      r = palette.neonA[0];
      g = palette.neonA[1];
      b = palette.neonA[2];
      a = 255;
    }
    return [r, g, b, a];
  });
}

function genSparkSheet(themeId, palette) {
  var frames = 6;
  var fw = 96;
  var fh = 96;
  var w = fw * frames;
  var h = fh;
  return writePng(path.join(themesRoot, themeId, 'vfx', 'spark-sheet.png'), w, h, function (x, y) {
    var frame = Math.floor(x / fw);
    var lx = x - frame * fw;
    var ly = y;
    var cx = fw / 2;
    var cy = fh / 2;
    var progress = frame / (frames - 1);
    var maxR = 8 + progress * 38;
    var d = dist(lx, ly, cx, cy);
    if (d > maxR + 2) return [0, 0, 0, 0];

    // radial spokes
    var ang = Math.atan2(ly - cy, lx - cx);
    var spoke = Math.abs(Math.sin(ang * (4 + frame)));
    var edge = Math.abs(d - maxR);
    var alpha = 0;
    var r = palette.spark[0];
    var g = palette.spark[1];
    var b = palette.spark[2];

    if (d < maxR * 0.35) {
      alpha = 230 - progress * 80;
      r = 255;
      g = 255;
      b = 255;
    } else if (edge < 4 + spoke * 6) {
      alpha = Math.round((180 - progress * 100) * (0.4 + spoke * 0.6));
      if (frame % 2 === 0) {
        r = palette.neonA[0];
        g = palette.neonA[1];
        b = palette.neonA[2];
      } else {
        r = palette.neonB[0];
        g = palette.neonB[1];
        b = palette.neonB[2];
      }
    } else if (d < maxR) {
      alpha = Math.round(40 * (1 - progress) * (1 - d / maxR));
    }

    // fade last frames
    alpha = Math.round(alpha * (1 - progress * 0.55));
    alpha = clamp(alpha, 0, 255);
    return [r, g, b, alpha];
  });
}

function genAmbientFrames(themeId, palette) {
  // 4 soft glow frames used as optional motion underlay (image sequence ≈ ambient video)
  var w = 240;
  var h = 430;
  var paths = [];
  for (var f = 0; f < 4; f++) {
    var phase = f / 4;
    var p = writePng(
      path.join(themesRoot, themeId, 'playfield', 'ambient-' + f + '.png'),
      w,
      h,
      function (x, y) {
        var nx = x / w;
        var ny = y / h;
        var pulse = 0.5 + 0.5 * Math.sin((nx + ny + phase) * Math.PI * 2);
        var a = Math.round(18 + pulse * 28);
        var r = mix(palette.neonA[0], palette.neonB[0], pulse);
        var g = mix(palette.neonA[1], palette.neonB[1], pulse);
        var b = mix(palette.neonA[2], palette.neonB[2], pulse);
        // sparse dots
        if (((x + f * 7) * 13 + y * 17) % 89 === 0) {
          a = 90;
          r = g = b = 255;
        }
        return [r, g, b, a];
      }
    );
    paths.push(p);
  }
  return paths;
}

function writeManifest(themeId, meta) {
  var manifest = {
    id: themeId,
    name: meta.name,
    tagline: meta.tagline,
    tableTitle: meta.tableTitle,
    hudAccent: meta.hudAccent,
    playfield: {
      still: 'playfield/base.png',
      ambientFrames: [
        'playfield/ambient-0.png',
        'playfield/ambient-1.png',
        'playfield/ambient-2.png',
        'playfield/ambient-3.png'
      ],
      ambientFps: 6,
      ambientVideo: meta.ambientVideo || null
    },
    bumpers: {
      idle: 'bumpers/idle.png',
      hit: 'bumpers/hit.png'
    },
    sparks: {
      sheet: 'vfx/spark-sheet.png',
      frames: 6,
      frameWidth: 96,
      frameHeight: 96,
      fps: 18,
      scale: 1.15
    }
  };
  var out = path.join(themesRoot, themeId, 'manifest.json');
  fs.writeFileSync(out, JSON.stringify(manifest, null, 2) + '\n');
  return out;
}

var voidPulse = {
  bg0: [12, 8, 28],
  bg1: [6, 14, 32],
  grid: [40, 90, 160],
  neonA: [0, 240, 255],
  neonB: [255, 40, 180],
  pad: [30, 40, 80],
  idleCore: [40, 220, 255],
  idleRim: [20, 80, 160],
  hitCore: [255, 120, 220],
  hitRim: [255, 40, 160],
  spark: [120, 255, 255]
};

var emberRail = {
  bg0: [28, 10, 8],
  bg1: [12, 6, 18],
  grid: [160, 60, 40],
  neonA: [255, 140, 40],
  neonB: [255, 50, 80],
  pad: [60, 25, 20],
  idleCore: [255, 160, 60],
  idleRim: [180, 40, 30],
  hitCore: [255, 240, 120],
  hitRim: [255, 80, 40],
  spark: [255, 200, 80]
};

var generated = [];
['void-pulse', 'ember-rail'].forEach(function (id) {
  var pal = id === 'void-pulse' ? voidPulse : emberRail;
  var meta =
    id === 'void-pulse'
      ? {
          name: 'Void Pulse',
          tagline: 'Cyan-magenta cyber rail',
          tableTitle: 'VOID PULSE',
          hudAccent: '#00f0ff',
          ambientVideo: null
        }
      : {
          name: 'Ember Rail',
          tagline: 'Molten copper night table',
          tableTitle: 'EMBER RAIL',
          hudAccent: '#ff8c28',
          ambientVideo: null
        };
  generated.push(genPlayfield(id, pal));
  generated.push(genBumper(id, 'idle', pal, false));
  generated.push(genBumper(id, 'hit', pal, true));
  generated.push(genSparkSheet(id, pal));
  genAmbientFrames(id, pal).forEach(function (p) {
    generated.push(p);
  });
  generated.push(writeManifest(id, meta));
});

// Root themes index
var index = {
  defaultTheme: 'void-pulse',
  themes: {
    'void-pulse': 'themes/void-pulse/manifest.json',
    'ember-rail': 'themes/ember-rail/manifest.json'
  }
};
var indexPath = path.join(root, 'assets', 'themes.json');
fs.writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n');
generated.push(indexPath);

console.log('Generated ' + generated.length + ' asset files:');
generated.forEach(function (p) {
  console.log('  ' + path.relative(root, p));
});
