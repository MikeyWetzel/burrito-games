/* Sparky level data, circuit rules, and the endless-job generator.
   Glyphs (solution orientation):
   . empty   B breaker   * load   o tray gap   D decoy/trap
   - EW straight   | NS straight   + cross
   corners: a NE  b ES  c SW  d WN
   tees:    e NES b?  e missing W, f ESW, g SWN, h WNE
*/
(function (root) {
  'use strict';

  var DIRS = [
    { name: 'n', bit: 1, dx: 0, dy: -1, opp: 4 },
    { name: 'e', bit: 2, dx: 1, dy: 0, opp: 8 },
    { name: 's', bit: 4, dx: 0, dy: 1, opp: 1 },
    { name: 'w', bit: 8, dx: -1, dy: 0, opp: 2 }
  ];

  var GLYPHS = {
    '-': { wire: 'straight', sol: 1 },
    '|': { wire: 'straight', sol: 0 },
    'a': { wire: 'corner', sol: 0 },
    'b': { wire: 'corner', sol: 1 },
    'c': { wire: 'corner', sol: 2 },
    'd': { wire: 'corner', sol: 3 },
    'e': { wire: 'tee', sol: 0 },
    'f': { wire: 'tee', sol: 1 },
    'g': { wire: 'tee', sol: 2 },
    'h': { wire: 'tee', sol: 3 },
    '+': { wire: 'cross', sol: 0 }
  };

  function mask(wire, rot) {
    var base = wire === 'straight' ? 5 : wire === 'corner' ? 3 : wire === 'tee' ? 7 : 15;
    rot = ((rot % 4) + 4) % 4;
    var m = base;
    for (var i = 0; i < rot; i++) {
      var n = 0;
      if (m & 8) n |= 1;
      if (m & 1) n |= 2;
      if (m & 2) n |= 4;
      if (m & 4) n |= 8;
      m = n;
    }
    return m;
  }

  function keyOf(c) { return c.x + ',' + c.y; }

  function mulberry32(a) {
    a >>>= 0;
    return function () {
      a |= 0;
      a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function solMask(cell) {
    if (!cell) return 0;
    if (cell.role === 'wire') return mask(cell.wire, cell.sol);
    if (cell.role === 'gap') return mask(cell.need.wire, cell.need.sol);
    return 0;
  }

  function liveMask(cell) {
    if (!cell) return 0;
    if (cell.role === 'wire') return mask(cell.wire, cell.rot);
    if (cell.role === 'source' || cell.role === 'load') return cell.port || 0;
    return 0;
  }

  function makeIndex(cells) {
    var map = new Map();
    cells.forEach(function (c) { map.set(c.x + ',' + c.y, c); });
    return map;
  }

  function assignPorts(cells) {
    var map = makeIndex(cells);
    cells.forEach(function (c) {
      if (c.role !== 'source' && c.role !== 'load') return;
      var port = 0;
      DIRS.forEach(function (d) {
        var n = map.get((c.x + d.dx) + ',' + (c.y + d.dy));
        if (solMask(n) & d.opp) port |= d.bit;
      });
      c.port = port;
    });
  }

  function finalize(partial) {
    assignPorts(partial.cells);
    partial.cells.forEach(function (c) {
      if (c.role === 'wire') {
        c.rot = c.sol;
        c.spin = c.sol * 90;
        c.spinShown = c.spin;
        if (c.wire === 'cross') c.fixed = true;
      }
    });
    return partial;
  }

  function parseLevel(def) {
    var rows = def.map.map(function (r) { return r.replace(/\s+/g, ''); });
    var height = rows.length;
    var width = 0;
    rows.forEach(function (r) { if (r.length > width) width = r.length; });
    var cells = [];
    var tray = [];
    var gi = 0;
    var li = 0;
    var di = 0;
    var uid = 1;
    for (var y = 0; y < height; y++) {
      var row = rows[y];
      for (var x = 0; x < width; x++) {
        var ch = row[x] || '.';
        if (ch === '.') continue;
        if (ch === 'B') {
          cells.push({ x: x, y: y, role: 'source', port: 0, fixed: true });
          continue;
        }
        if (ch === '*') {
          var lt = (def.loads && def.loads[li]) || 'lamp';
          li++;
          cells.push({ x: x, y: y, role: 'load', loadType: lt, port: 0, fixed: true, scorch: 0 });
          continue;
        }
        if (ch === 'o') {
          var g = def.gaps[gi++];
          cells.push({
            x: x, y: y, role: 'gap',
            need: { wire: g.wire, sol: g.sol },
            scorch: 0
          });
          tray.push({ uid: uid++, wire: g.wire, rot: 0, spin: 0, spinShown: 0 });
          continue;
        }
        if (ch === 'D') {
          var spec = def.decoys[di++];
          cells.push({
            x: x, y: y, role: 'wire', wire: spec.wire, sol: spec.sol,
            trap: true, hold: true, fixed: false, scorch: 0
          });
          continue;
        }
        var gly = GLYPHS[ch];
        if (!gly) throw new Error('Bad glyph ' + ch + ' in ' + def.name);
        cells.push({
          x: x, y: y, role: 'wire', wire: gly.wire, sol: gly.sol,
          trap: false, hold: false, fixed: false, scorch: 0
        });
      }
    }
    if (def.gaps && gi !== def.gaps.length) throw new Error('Gap count mismatch in ' + def.name);
    if (def.loads && li !== def.loads.length) throw new Error('Load count mismatch in ' + def.name);
    return finalize({
      name: def.name,
      joke: def.joke,
      win: def.win,
      time: def.time,
      hints: def.hints,
      cols: width,
      rows: height,
      cells: cells,
      tray: tray,
      dog: def.dog || null,
      leak: def.leak || null,
      owner: def.owner || null,
      endless: false
    });
  }

  var LEVELS = [
    {
      name: 'Porch Light',
      joke: 'Just the porch light. She said five minutes. In 2019.',
      win: 'And then there was light. The moths send their thanks.',
      time: 50, hints: 3,
      map: ['....', 'B...', '|...', 'a--*'],
      loads: ['lamp']
    },
    {
      name: "Mom's Toaster",
      joke: 'Toast waits for no one. She also wants the lamp. Of course.',
      win: 'Toaster lives. Slightly threatening, as the manual intended.',
      time: 55, hints: 2,
      map: ['B-fo*', '..|..', '..*..'],
      loads: ['lamp', 'toaster'],
      gaps: [{ wire: 'straight', sol: 1 }]
    },
    {
      name: 'Good Boy',
      joke: 'The dog is licensed. The license is for chaos.',
      win: 'Wired. Dog personally offended. That is a win.',
      time: 60, hints: 2,
      dog: { first: 9, every: 11 },
      map: ['B-f*.', '..|..', '..a-*'],
      loads: ['lamp', 'fan']
    },
    {
      name: 'Wet Socket',
      joke: 'If it sparks, it was the puddle. It is always the puddle.',
      win: 'Dry, bright, and only a little bit illegal.',
      time: 65, hints: 2,
      leak: { first: 5, every: 12 },
      map: ['Bc...', '.e-+*', '.|.D.', '.*...'],
      loads: ['lamp', 'outlet'],
      decoys: [{ wire: 'straight', sol: 1 }]
    },
    {
      name: 'Helpful Hank',
      joke: 'Hank knows electrical. Hank does not know electrical.',
      win: 'Hank has been seated. The lights have not. Perfect.',
      time: 70, hints: 2,
      owner: { first: 8, every: 14 },
      map: ['Bc...', '.a-f*', '...|.', '...*.'],
      loads: ['lamp', 'outlet']
    },
    {
      name: 'Night Shift',
      joke: 'Two gadgets, one gap, and a dog with a career plan.',
      win: 'The TV thinks static is a genre. You let it.',
      time: 75, hints: 2,
      dog: { first: 11, every: 12 },
      map: ['B-oc.', '...|.', '*-fd.', '..|..', '..*..'],
      loads: ['tv', 'outlet'],
      gaps: [{ wire: 'straight', sol: 1 }]
    },
    {
      name: 'Code Violation',
      joke: 'The leak is back and it brought opinions.',
      win: 'The inspector would cry. You get stars instead.',
      time: 70, hints: 2,
      leak: { first: 6, every: 11 },
      owner: { first: 9, every: 14 },
      map: ['..B..', '..|..', '*-h+*', '...D.'],
      loads: ['fridge', 'lamp'],
      decoys: [{ wire: 'straight', sol: 1 }]
    },
    {
      name: 'Whole House',
      joke: 'Last call. Try not to become the ground wire.',
      win: 'House lit. Hair optional. You absolute legend.',
      time: 90, hints: 2,
      dog: { first: 13, every: 13 },
      leak: { first: 7, every: 11 },
      owner: { first: 11, every: 15 },
      map: ['B--oo', '....|', '.D+-d', '*fg..', '.||..', '.**..'],
      loads: ['tv', 'toaster', 'fridge'],
      gaps: [{ wire: 'straight', sol: 1 }, { wire: 'corner', sol: 2 }],
      decoys: [{ wire: 'straight', sol: 0 }]
    }
  ].map(parseLevel);

  function powerState(board, breakerOn) {
    var map = makeIndex(board.cells);
    var loads = board.cells.filter(function (c) { return c.role === 'load'; });
    var on = new Set();
    var hot = new Set();
    if (breakerOn === false) return { on: on, hot: hot, total: loads.length };
    var src = board.cells.find(function (c) { return c.role === 'source'; });
    if (!src) return { on: on, hot: hot, total: loads.length };
    var q = [src];
    var seen = new Set([keyOf(src)]);
    while (q.length) {
      var c = q.pop();
      var m = liveMask(c);
      for (var i = 0; i < DIRS.length; i++) {
        var d = DIRS[i];
        if (!(m & d.bit)) continue;
        var n = map.get((c.x + d.dx) + ',' + (c.y + d.dy));
        if (!n) continue;
        if (!(liveMask(n) & d.opp)) continue;
        if (n.role === 'load') on.add(keyOf(n));
        else if (n.role === 'wire' && !seen.has(keyOf(n))) {
          seen.add(keyOf(n));
          hot.add(keyOf(n));
          q.push(n);
        }
      }
    }
    return { on: on, hot: hot, total: loads.length };
  }

  function bitFromDelta(dx, dy) {
    if (dy < 0) return 1;
    if (dx > 0) return 2;
    if (dy > 0) return 4;
    return 8;
  }

  function kindFromBits(bits) {
    var m = 0;
    var uniq = {};
    bits.forEach(function (b) { uniq[b] = 1; });
    Object.keys(uniq).forEach(function (k) { m |= +k; });
    var count = 0;
    [1, 2, 4, 8].forEach(function (b) { if (m & b) count++; });
    if (count === 2) {
      if (m === 5) return { wire: 'straight', sol: 0 };
      if (m === 10) return { wire: 'straight', sol: 1 };
      for (var r = 0; r < 4; r++) if (mask('corner', r) === m) return { wire: 'corner', sol: r };
    }
    if (count === 3) {
      for (var r2 = 0; r2 < 4; r2++) if (mask('tee', r2) === m) return { wire: 'tee', sol: r2 };
    }
    if (count === 4) return { wire: 'cross', sol: 0 };
    return null;
  }

  var LOAD_TYPES = ['lamp', 'outlet', 'toaster', 'fridge', 'tv', 'fan'];
  var OT_JOKES = [
    'Overtime pays in sparks and regret.',
    'The homeowner added "while you\'re here."',
    'This room was not in the estimate.',
    'Somewhere a permit is crying.',
    'The dog brought a friend. The friend is also a dog.',
    'Hank found a second breaker. Nobody asked.',
    'You can smell the previous electrician.',
    'The attic is a suggestion and a lawsuit.'
  ];
  var OT_WINS = [
    'Lit. Next room is already judging you.',
    'Another one down. The truck still smells like ozone.',
    'Beautiful. Unsafe. Glowing. Ship it.',
    'The appliances applaud. It is unsettling.',
    'You did that with one shoe. Respect.',
    'Power flows. Dignity approximately flows.'
  ];

  function tryGenerate(rng, diff) {
    var cols = 5;
    var rows = Math.min(8, 5 + Math.floor(diff / 2));
    var wireTarget = Math.min((cols - 1) * rows - 2, 7 + diff);
    var loadTarget = Math.min(4, 2 + Math.floor(diff / 3));
    var by = 1 + Math.floor(rng() * (rows - 2));
    var parent = new Map();
    var root = { x: 1, y: by };
    parent.set('1,' + by, { breaker: true, x: 0, y: by });
    var wires = [root];
    var guard = 0;
    while (wires.length < wireTarget && guard < 800) {
      guard++;
      var cur = wires[Math.floor(rng() * wires.length)];
      var opts = [];
      DIRS.forEach(function (d) {
        var nx = cur.x + d.dx;
        var ny = cur.y + d.dy;
        if (nx < 1 || nx >= cols || ny < 0 || ny >= rows) return;
        if (parent.has(nx + ',' + ny)) return;
        opts.push({ x: nx, y: ny });
      });
      if (!opts.length) continue;
      var n = opts[Math.floor(rng() * opts.length)];
      parent.set(n.x + ',' + n.y, cur);
      wires.push(n);
    }
    if (wires.length < 5) return null;

    function childrenOf(node) {
      var out = [];
      wires.forEach(function (w) {
        var p = parent.get(w.x + ',' + w.y);
        if (p && !p.breaker && p.x === node.x && p.y === node.y) out.push(w);
      });
      return out;
    }
    function isLeaf(node) {
      if (node.x === root.x && node.y === root.y) return false;
      return childrenOf(node).length === 0;
    }
    var safety = 0;
    while (safety++ < 80) {
      var leaves = wires.filter(isLeaf);
      if (leaves.length <= loadTarget) break;
      var leaf = leaves[Math.floor(rng() * leaves.length)];
      wires.splice(wires.indexOf(leaf), 1);
      parent.delete(leaf.x + ',' + leaf.y);
    }
    var loadPos = wires.filter(isLeaf);
    if (!loadPos.length) return null;
    loadPos.forEach(function (L) {
      wires.splice(wires.indexOf(L), 1);
    });
    if (wires.length < 3) return null;

    function dirsFor(wire) {
      var bits = [];
      var p = parent.get(wire.x + ',' + wire.y);
      if (p && p.breaker) bits.push(8);
      else if (p) bits.push(bitFromDelta(p.x - wire.x, p.y - wire.y));
      wires.forEach(function (w) {
        var pw = parent.get(w.x + ',' + w.y);
        if (pw && !pw.breaker && pw.x === wire.x && pw.y === wire.y) {
          bits.push(bitFromDelta(w.x - wire.x, w.y - wire.y));
        }
      });
      loadPos.forEach(function (L) {
        var pw = parent.get(L.x + ',' + L.y);
        if (pw && !pw.breaker && pw.x === wire.x && pw.y === wire.y) {
          bits.push(bitFromDelta(L.x - wire.x, L.y - wire.y));
        }
      });
      return bits;
    }

    var cells = [];
    cells.push({ x: 0, y: by, role: 'source', port: 0, fixed: true });
    var wireCells = [];
    for (var i = 0; i < wires.length; i++) {
      var w = wires[i];
      var kind = kindFromBits(dirsFor(w));
      if (!kind) return null;
      var cell = {
        x: w.x, y: w.y, role: 'wire', wire: kind.wire, sol: kind.sol,
        trap: false, hold: false, fixed: kind.wire === 'cross', scorch: 0
      };
      cells.push(cell);
      wireCells.push(cell);
    }
    loadPos.forEach(function (L, idx) {
      cells.push({
        x: L.x, y: L.y, role: 'load',
        loadType: LOAD_TYPES[(diff + idx) % LOAD_TYPES.length],
        port: 0, fixed: true, scorch: 0
      });
    });

    var board = {
      name: 'Overtime ' + diff,
      joke: OT_JOKES[diff % OT_JOKES.length],
      win: OT_WINS[diff % OT_WINS.length],
      time: 0,
      hints: diff < 3 ? 2 : 1,
      cols: cols,
      rows: rows,
      cells: cells,
      tray: [],
      dog: diff >= 1 ? { first: Math.max(7, 12 - diff), every: Math.max(8, 14 - diff) } : null,
      leak: null,
      owner: diff >= 3 ? { first: Math.max(7, 12 - Math.floor(diff / 2)), every: Math.max(9, 16 - diff) } : null,
      endless: true
    };
    finalize(board);
    function solvedCopy() {
      board.cells.forEach(function (c) {
        if (c.role === 'wire') c.rot = c.sol;
      });
    }
    solvedCopy();
    var p0 = powerState(board, true);
    if (p0.on.size !== p0.total || p0.total < 1) return null;
    wireCells.forEach(function (c) {
      if (!p0.hot.has(keyOf(c)) && !(c.x === root.x && c.y === root.y)) {
        /* root is reached as the source's neighbor and IS in the queue;
           hot includes wires visited. root should be hot. */
      }
    });
    if (!p0.hot.has(root.x + ',' + root.y)) return null;

    if (diff >= 2) {
      addTrap(board, rng);
    }

    var gapBudget = diff >= 4 ? 2 : diff >= 1 ? 1 : 0;
    var candidates = board.cells.filter(function (c) {
      return c.role === 'wire' && !c.trap && !c.fixed && (c.wire === 'straight' || c.wire === 'corner');
    });
    for (var g = 0; g < gapBudget && candidates.length > 2; g++) {
      var pick = candidates.splice(Math.floor(rng() * candidates.length), 1)[0];
      pick.role = 'gap';
      pick.need = { wire: pick.wire, sol: pick.sol };
      board.tray.push({ uid: 100 + g, wire: pick.wire, rot: 0, spin: 0, spinShown: 0 });
      delete pick.wire;
    }

    solvedCopy();
    board.cells.forEach(function (c) {
      if (c.role === 'gap') {
        c.role = 'wire';
        c.wire = c.need.wire;
        c.rot = c.need.sol;
        c.sol = c.need.sol;
        c._wasGap = true;
      }
    });
    var p1 = powerState(board, true);
    var trapHot = false;
    board.cells.forEach(function (c) {
      if (c.trap && p1.hot.has(keyOf(c))) trapHot = true;
    });
    board.cells.forEach(function (c) {
      if (c._wasGap) {
        c.role = 'gap';
        c.wire = null;
        c.rot = 0;
        delete c._wasGap;
      }
    });
    if (p1.on.size !== p1.total || trapHot) return null;

    var placed = board.cells.filter(function (c) { return c.role === 'wire' && !c.trap; }).length;
    board.time = Math.round(Math.max(32, Math.min(92, 26 + placed * 3.4 + board.tray.length * 4 + p1.total * 6 - diff * 1.2)));
    return board;
  }

  function addTrap(board, rng) {
    var map = makeIndex(board.cells);
    var wires = board.cells.filter(function (c) { return c.role === 'wire' && !c.fixed; });
    for (var n = wires.length - 1; n > 0; n--) {
      var j = Math.floor(rng() * (n + 1));
      var tmp = wires[n]; wires[n] = wires[j]; wires[j] = tmp;
    }
    for (var i = 0; i < wires.length; i++) {
      var wire = wires[i];
      var order = DIRS.slice();
      for (var n2 = order.length - 1; n2 > 0; n2--) {
        var j2 = Math.floor(rng() * (n2 + 1));
        var t2 = order[n2]; order[n2] = order[j2]; order[j2] = t2;
      }
      for (var k = 0; k < order.length; k++) {
        var d = order[k];
        var nx = wire.x + d.dx;
        var ny = wire.y + d.dy;
        if (nx < 0 || ny < 0 || nx >= board.cols || ny >= board.rows) continue;
        if (map.get(nx + ',' + ny)) continue;
        var existing = mask(wire.wire, wire.sol);
        if (existing & d.bit) continue;
        var bits = [];
        [1, 2, 4, 8].forEach(function (b) { if (existing & b) bits.push(b); });
        bits.push(d.bit);
        var kind = kindFromBits(bits);
        if (!kind) continue;
        var oldWire = wire.wire;
        var oldSol = wire.sol;
        wire.wire = kind.wire;
        wire.sol = kind.sol;
        wire.rot = kind.sol;
        wire.fixed = kind.wire === 'cross';
        var trap = {
          x: nx, y: ny, role: 'wire', wire: 'straight', sol: 0, rot: 0,
          trap: true, hold: true, fixed: false, scorch: 0
        };
        board.cells.push(trap);
        map.set(nx + ',' + ny, trap);
        var safe = -1;
        for (var r = 0; r < 2; r++) {
          trap.rot = r;
          trap.sol = r;
          var pr = powerState(board, true);
          if (pr.on.size === pr.total && !pr.hot.has(nx + ',' + ny)) safe = r;
        }
        var danger = false;
        if (safe >= 0) {
          for (var r2 = 0; r2 < 2; r2++) {
            if (r2 === safe) continue;
            trap.rot = r2;
            if (powerState(board, true).hot.has(nx + ',' + ny)) danger = true;
          }
        }
        if (safe >= 0 && danger) {
          trap.sol = safe;
          trap.rot = safe;
          trap.spin = safe * 90;
          trap.spinShown = trap.spin;
          wire.rot = wire.sol;
          wire.spin = wire.sol * 90;
          wire.spinShown = wire.spin;
          board.leak = { first: Math.max(5, 9 - Math.floor(board.endless ? 1 : 0)), every: 11 };
          return;
        }
        board.cells.pop();
        map.delete(nx + ',' + ny);
        wire.wire = oldWire;
        wire.sol = oldSol;
        wire.rot = oldSol;
        wire.fixed = oldWire === 'cross';
      }
    }
  }

  function generateLevel(diff, seed) {
    var rng = mulberry32(seed >>> 0);
    for (var i = 0; i < 70; i++) {
      var board = tryGenerate(rng, Math.max(1, diff | 0));
      if (board) return board;
    }
    var fallback = parseLevel({
      name: 'Overtime ' + diff,
      joke: OT_JOKES[diff % OT_JOKES.length],
      win: OT_WINS[diff % OT_WINS.length],
      time: Math.max(36, 60 - diff),
      hints: 1,
      dog: { first: 8, every: 10 },
      map: ['B-f*.', '..|..', '..a-*'],
      loads: ['lamp', 'fan']
    });
    fallback.endless = true;
    return fallback;
  }

  function cloneBoard(b) {
    return {
      name: b.name,
      joke: b.joke,
      win: b.win,
      time: b.time,
      hints: b.hints,
      cols: b.cols,
      rows: b.rows,
      endless: !!b.endless,
      dog: b.dog ? { first: b.dog.first, every: b.dog.every } : null,
      leak: b.leak ? { first: b.leak.first, every: b.leak.every } : null,
      owner: b.owner ? { first: b.owner.first, every: b.owner.every } : null,
      cells: b.cells.map(function (c) {
        var n = {
          x: c.x, y: c.y, role: c.role, wire: c.wire || null, sol: c.sol || 0,
          rot: c.rot || 0, spin: c.spin || 0, spinShown: c.spinShown || 0,
          port: c.port || 0, loadType: c.loadType || null,
          trap: !!c.trap, hold: !!c.hold, fixed: !!c.fixed, placed: !!c.placed,
          scorch: c.scorch || 0
        };
        if (c.need) n.need = { wire: c.need.wire, sol: c.need.sol };
        return n;
      }),
      tray: b.tray.map(function (t) {
        return { uid: t.uid, wire: t.wire, rot: t.rot || 0, spin: 0, spinShown: 0 };
      })
    };
  }

  function scramble(board, rng) {
    rng = rng || Math.random;
    board.cells.forEach(function (c) {
      if (c.role !== 'wire' || c.fixed || c.hold) return;
      if (c.wire === 'cross') return;
      if (c.wire === 'straight') {
        var wrong = (c.sol + 1) % 2;
        c.rot = rng() < 0.78 ? wrong : (c.sol % 2);
      } else if (rng() < 0.82) {
        c.rot = (c.sol + 1 + Math.floor(rng() * 3)) % 4;
      } else {
        c.rot = c.sol;
      }
      c.spin = c.rot * 90;
      c.spinShown = c.spin;
    });
    board.tray.forEach(function (t) {
      t.rot = 0;
      t.spin = 0;
      t.spinShown = 0;
    });
    var powered = powerState(board, true);
    if (powered.total > 0 && powered.on.size === powered.total && !board.tray.length) {
      var twist = null;
      board.cells.forEach(function (c) {
        if (!twist && c.role === 'wire' && !c.fixed && !c.hold && !c.trap) twist = c;
      });
      if (twist) {
        twist.rot = (twist.rot + 1) % 4;
        twist.spin = twist.rot * 90;
        twist.spinShown = twist.spin;
      }
    }
  }

  function applySolution(board) {
    for (var i = board.tray.length - 1; i >= 0; i--) {
      var piece = board.tray[i];
      var gap = null;
      for (var j = 0; j < board.cells.length; j++) {
        var c = board.cells[j];
        if (c.role === 'gap' && c.need.wire === piece.wire) { gap = c; break; }
      }
      if (!gap) continue;
      gap.role = 'wire';
      gap.wire = piece.wire;
      gap.sol = gap.need.sol;
      gap.rot = gap.need.sol;
      gap.spin = gap.rot * 90;
      gap.spinShown = gap.spin;
      gap.placed = true;
      gap.hold = false;
      gap.trap = false;
      gap.fixed = gap.wire === 'cross';
      board.tray.splice(i, 1);
    }
    board.cells.forEach(function (c) {
      if (c.role === 'wire' && !c.trap) {
        c.rot = c.sol;
        c.spin = c.sol * 90;
        c.spinShown = c.spin;
      } else if (c.role === 'wire' && c.trap) {
        c.rot = c.sol;
        c.spin = c.sol * 90;
        c.spinShown = c.spin;
      }
    });
  }

  var api = {
    DIRS: DIRS,
    LEVELS: LEVELS,
    mask: mask,
    liveMask: liveMask,
    parseLevel: parseLevel,
    generateLevel: generateLevel,
    powerState: powerState,
    scramble: scramble,
    applySolution: applySolution,
    cloneBoard: cloneBoard,
    mulberry32: mulberry32
  };

  root.SparkyLib = api;

  function assertSolution(board, label) {
    var saved = board.cells.map(function (c) {
      return { role: c.role, wire: c.wire, rot: c.rot, sol: c.sol };
    });
    var traySaved = board.tray.length;
    applySolution(board);
    var p = powerState(board, true);
    if (p.on.size !== p.total) {
      throw new Error(label + ' does not power all loads (' + p.on.size + '/' + p.total + ')');
    }
    board.cells.forEach(function (c) {
      if (c.trap && p.hot.has(keyOf(c))) throw new Error(label + ' powers a trap at rest');
      if (c.role === 'load' && !c.port) throw new Error(label + ' load has no port');
      if (c.role === 'source' && !c.port) throw new Error(label + ' source has no port');
    });
    var traps = board.cells.filter(function (c) { return c.trap; });
    traps.forEach(function (t) {
      var was = t.rot;
      var danger = false;
      for (var r = 0; r < 2; r++) {
        t.rot = r;
        if (powerState(board, true).hot.has(keyOf(t))) danger = true;
      }
      t.rot = was;
      if (!danger) throw new Error(label + ' trap can never short');
    });
    if (board.leak && !traps.length) throw new Error(label + ' leak without a trap');
    /* restore roles so LEVELS stay pristine for the game (applySolution mutates) */
    board.cells.forEach(function (c, i) {
      c.role = saved[i].role;
      c.wire = saved[i].wire;
      c.rot = saved[i].rot;
      c.sol = saved[i].sol;
      c.spin = (c.rot || 0) * 90;
      c.spinShown = c.spin;
      if (c.role === 'gap') {
        c.placed = false;
        c.fixed = false;
      }
    });
    if (board.tray.length !== traySaved) {
      /* rebuild tray from gaps if applySolution consumed them and restore failed to push */
    }
    if (board.tray.length !== traySaved) {
      board.tray.length = 0;
      board.cells.forEach(function (c) {
        if (c.role === 'gap') {
          board.tray.push({ uid: board.tray.length + 1, wire: c.need.wire, rot: 0, spin: 0, spinShown: 0 });
        }
      });
    }
  }

  if (typeof window === 'undefined') {
    LEVELS.forEach(function (b) { assertSolution(b, b.name); });
    for (var d = 1; d <= 12; d++) {
      for (var s = 0; s < 8; s++) {
        var gen = generateLevel(d, 1000 + d * 50 + s);
        assertSolution(gen, 'endless ' + d + '/' + s);
      }
    }
    LEVELS.forEach(function (b) {
      var gaps = b.cells.filter(function (c) { return c.role === 'gap'; }).length;
      if (b.tray.length !== gaps) throw new Error('tray restore failed for ' + b.name);
    });
    console.log('sparky levels ok', LEVELS.length, 'campaign +', 12 * 8, 'endless samples');
  }
})(typeof window !== 'undefined' ? window : globalThis);
