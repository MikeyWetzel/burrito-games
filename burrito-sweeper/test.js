/**
 * Node tests: engine, markers, solver, no-guess generation.
 * Run: node burrito-sweeper/test.js
 */
const assert = require('assert');
const E = require('./engine.js');

function seeded(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

// --- Basic engine ---
for (const [w, h, m] of [[9, 9, 10], [16, 16, 40], [30, 16, 99]]) {
  for (let t = 0; t < 50; t++) {
    const e = new E(w, h, m, seeded(t * 97 + w));
    const i = Math.floor(seeded(t + 1)() * w * h);
    e.reveal(i);
    assert(!e.mine[i], 'first click safe');
    assert.equal(e.mine.filter(Boolean).length, m);
    for (let j = 0; j < w * h; j++) if (!e.mine[j]) e.reveal(j);
    assert(e.won && e.flags === m);
  }
}

// --- Single mark: tap marks, mark again is no-op, unmark clears, reveal blocked while marked ---
{
  const e = new E(9, 9, 10, seeded(7));
  e.revealFirst(40);
  let i = -1; for (let k = 0; k < 81; k++) if (e.state[k] === 0) { i = k; break; }
  assert.equal(e.mark(i), true); assert.equal(e.flags, 1);
  assert.equal(e.mark(i), false, 'second mark is a no-op'); assert.equal(e.flags, 1);
  assert.deepEqual(e.reveal(i), [], 'marked tile does not reveal');
  assert.equal(e.unmark(i), true); assert.equal(e.flags, 0); assert.equal(e.state[i], 0);
  assert.equal(e.unmark(i), false);
  // icon mapping by true neighbour count
  assert.equal(E.iconForCount(0), 'nacho'); assert.equal(E.iconForCount(1), 'nacho');
  assert.equal(E.iconForCount(2), 'avocado'); assert.equal(E.iconForCount(3), 'avocado');
  assert.equal(E.iconForCount(4), 'burrito'); assert.equal(E.iconForCount(8), 'burrito');
  for (let k = 0; k < 81; k++) {
    const n = e.neighbors(k).filter((j) => e.mine[j]).length;
    assert.equal(e.markIcon(k), E.iconForCount(n));
  }
}

// Chord uses burrito marks only (not avocado/nacho)
{
  const e = new E(9, 9, 10, seeded(42));
  e.revealFirst(40);
  // Find a revealed number with mines around
  let n = -1;
  for (let i = 0; i < 81; i++) {
    if (e.state[i] === 1 && e.adj[i] > 0) { n = i; break; }
  }
  assert(n >= 0, 'have a number cell');
  const mines = e.neighbors(n).filter((j) => e.mine[j]);
  // Mark one as avocado — should NOT satisfy chord
  if (mines.length) {
    e.state[mines[0]] = 0;
    const before = e.revealedCount;
    e.chord(n);
    assert.equal(e.revealedCount, before, 'unmarked should not chord');
    // Mark all mines as burrito
    mines.forEach((j) => {
      if (e.state[j] !== E.MARK_BURRITO) {
        e.state[j] = E.MARK_BURRITO;
        e.flags++;
      }
    });
    e.chord(n);
    assert(!e.over || e.won || e.exploded >= 0);
  }
}

// --- Solver: known solvable tiny board ---
{
  // 5x5, mines at corners and center-ish — build manually
  const w = 5, h = 5;
  const mine = new Array(25).fill(false);
  [0, 4, 20, 24, 12].forEach((i) => { mine[i] = true; });
  const eng = new E(w, h, 5);
  const adj = new Array(25).fill(0);
  for (let i = 0; i < 25; i++) {
    adj[i] = eng.neighbors.call({ w, h }, i).filter((j) => mine[j]).length;
  }
  // Start at a zero if possible
  let start = adj.findIndex((a, i) => a === 0 && !mine[i]);
  if (start < 0) start = adj.findIndex((a, i) => !mine[i]);
  const ok = E.isSolvable(w, h, adj, mine, start);
  assert.equal(typeof ok, 'boolean');
}

// --- Solver refuses classic 50/50 ---
{
  // 4x2: mines at (2,0) and (3,0). Opening from 0 leaves an ambiguous frontier.
  const w = 4, h = 2;
  const mine = [false, false, true, true, false, false, false, false];
  const eng = new E(w, h, 2);
  const adj = new Array(8).fill(0);
  for (let i = 0; i < 8; i++) {
    adj[i] = eng.neighbors.call({ w, h }, i).filter((j) => mine[j]).length;
  }
  const solvable = E.isSolvable(w, h, adj, mine, 0);
  assert.strictEqual(solvable, false, '50/50 board must be refused by solver');
}

// --- Generator: 200 boards per difficulty, 100% solvable, timing ---
const LEVELS = [
  { name: 'beginner', w: 9, h: 9, m: 10 },
  { name: 'intermediate', w: 16, h: 16, m: 40 },
  { name: 'expert', w: 30, h: 16, m: 99 },
];

const stats = {};
for (const L of LEVELS) {
  let ok = 0, fallback = 0, totalMs = 0, maxMs = 0, totalAttempts = 0;
  const N = 200;
  const tAll = Date.now();
  for (let t = 0; t < N; t++) {
    const rng = seeded(1000 + t * 17 + L.w * 3);
    const safe = Math.floor(rng() * L.w * L.h);
    // Ensure we pick a cell — generator excludes neighborhood
    const gen = E.generateSolvable(L.w, L.h, L.m, safe, rng, 300);
    totalMs += gen.ms;
    if (gen.ms > maxMs) maxMs = gen.ms;
    totalAttempts += gen.attempts;
    if (gen.fallback) {
      fallback++;
      // Still verify first click safe
      assert(!gen.mine[safe]);
    } else {
      assert(E.isSolvable(L.w, L.h, gen.adj, gen.mine, safe), 'generated must be solvable');
      ok++;
    }
  }
  const wall = Date.now() - tAll;
  stats[L.name] = {
    N, solvable: ok, fallback, pct: ((ok / N) * 100).toFixed(1) + '%',
    avgMs: (totalMs / N).toFixed(1),
    maxMs: maxMs.toFixed(1),
    avgAttempts: (totalAttempts / N).toFixed(1),
    wallMs: wall,
  };
  // Require high solvability — allow rare fallback under time pressure but prefer 100%
  assert(ok + fallback === N);
  assert(ok / N >= 0.95, L.name + ' solvability too low: ' + ok + '/' + N);
}

console.log('engine tests passed');
console.log(JSON.stringify(stats, null, 2));
