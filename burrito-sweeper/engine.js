/* Burrito Sweeper engine + logical no-guess generator. Node + browser. */
(function (root) {
  'use strict';

  // state: 0 hidden, 1 revealed, 2 burrito-mark, 3 avocado-maybe, 4 nacho-maybe
  var MARK_BURRITO = 2, MARK_AVOCADO = 3, MARK_NACHO = 4;

  function Engine(w, h, mines, rng) {
    this.w = w; this.h = h; this.mines = mines;
    this.rng = typeof rng === 'function' ? rng : Math.random;
    this.reset();
  }

  Engine.prototype.reset = function () {
    var n = this.w * this.h;
    this.mine = new Array(n).fill(false);
    this.adj = new Array(n).fill(0);
    this.state = new Array(n).fill(0);
    this.placed = false; this.over = false; this.won = false;
    this.revealedCount = 0; this.flags = 0; this.exploded = -1;
    this.firstClick = -1;
  };

  Engine.prototype.idx = function (x, y) { return y * this.w + x; };

  Engine.prototype.neighbors = function (i) {
    var x = i % this.w, y = (i / this.w) | 0, out = [];
    for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      var nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < this.w && ny < this.h) out.push(ny * this.w + nx);
    }
    return out;
  };

  Engine.prototype.isMark = function (i) {
    var s = this.state[i];
    return s === MARK_BURRITO || s === MARK_AVOCADO || s === MARK_NACHO;
  };

  Engine.prototype.isBurrito = function (i) { return this.state[i] === MARK_BURRITO; };

  /** Cycle: empty -> burrito -> avocado -> nacho -> empty. Only burrito counts. */

  /** Set absolute mark: 0 clear, MARK_* values. Updates burrito flag count. */
  Engine.prototype.setMark = function (i, next) {
    if (this.over || this.state[i] === 1) return null;
    var prev = this.state[i];
    if (prev === MARK_BURRITO) this.flags--;
    if (next === MARK_BURRITO) this.flags++;
    this.state[i] = next;
    return next;
  };

  /** Single mark kind. mark(i): hidden+unmarked -> marked. unmark(i): marked -> hidden. */
  Engine.prototype.mark = function (i) {
    if (this.over || this.state[i] !== 0) return false;
    this.state[i] = MARK_BURRITO; this.flags++; return true;
  };
  Engine.prototype.unmark = function (i) {
    if (this.over || this.state[i] !== MARK_BURRITO) return false;
    this.state[i] = 0; this.flags--; return true;
  };
  /** Count of true hidden items (burritos) among the 8 neighbours (0 before board exists). */
  Engine.prototype.neighborMines = function (i) {
    if (!this.placed) return 0;
    var nb = this.neighbors(i), c = 0;
    for (var k = 0; k < nb.length; k++) if (this.mine[nb[k]]) c++;
    return c;
  };
  /** Cosmetic icon: 0-1 nacho, 2-3 avocado, 4+ burrito. */
  Engine.iconForCount = function (n) { return n >= 4 ? 'burrito' : n >= 2 ? 'avocado' : 'nacho'; };
  Engine.prototype.markIcon = function (i) { return Engine.iconForCount(this.neighborMines(i)); };
  Engine.prototype.cycleMark = function (i) {
    if (this.over || this.state[i] === 1) return null;
    var prev = this.state[i];
    var next;
    if (prev === 0) next = MARK_BURRITO;
    else if (prev === MARK_BURRITO) next = MARK_AVOCADO;
    else if (prev === MARK_AVOCADO) next = MARK_NACHO;
    else next = 0;
    if (prev === MARK_BURRITO) this.flags--;
    if (next === MARK_BURRITO) this.flags++;
    this.state[i] = next;
    return next;
  };

  /** Set or clear burrito mark (for tests / helpers). Maybes are cleared. */
  Engine.prototype.toggleFlag = function (i) {
    if (this.over || this.state[i] === 1) return;
    if (this.state[i] === MARK_BURRITO) {
      this.state[i] = 0; this.flags--;
    } else {
      this.state[i] = MARK_BURRITO; this.flags++;
    }
  };

  Engine.prototype.placeMines = function (safe, mineList) {
    var n = this.w * this.h, self = this;
    this.mine = new Array(n).fill(false);
    if (mineList) {
      for (var k = 0; k < mineList.length; k++) this.mine[mineList[k]] = true;
    } else {
      var excl = {};
      excl[safe] = 1;
      if (n - 9 >= this.mines) this.neighbors(safe).forEach(function (j) { excl[j] = 1; });
      var cand = [];
      for (var i = 0; i < n; i++) if (!excl[i]) cand.push(i);
      for (k = 0; k < this.mines; k++) {
        var r = k + Math.floor(this.rng() * (cand.length - k));
        var t = cand[k]; cand[k] = cand[r]; cand[r] = t;
        this.mine[cand[k]] = true;
      }
    }
    for (i = 0; i < n; i++) {
      this.adj[i] = this.neighbors(i).filter(function (j) { return self.mine[j]; }).length;
    }
    this.placed = true;
  };

  Engine.prototype.reveal = function (i) {
    if (this.over || this.state[i] === 1 || this.state[i] === MARK_BURRITO) return [];
    // clearing maybe marks before reveal
    if (this.state[i] === MARK_AVOCADO || this.state[i] === MARK_NACHO) this.state[i] = 0;
    if (!this.placed) {
      // deferred: caller should use generateSolvable
      this.placeMines(i, null);
      this.firstClick = i;
    }
    if (this.mine[i]) {
      this.state[i] = 1; this.over = true; this.exploded = i;
      return [i];
    }
    var changed = [], stack = [i];
    while (stack.length) {
      var c = stack.pop();
      if (this.state[c] === 1) continue;
      if (this.state[c] === MARK_BURRITO) continue;
      if (this.state[c] === MARK_AVOCADO || this.state[c] === MARK_NACHO) this.state[c] = 0;
      if (this.state[c] !== 0) continue;
      this.state[c] = 1; this.revealedCount++; changed.push(c);
      if (this.adj[c] === 0) {
        var nb = this.neighbors(c);
        for (var ni = 0; ni < nb.length; ni++) stack.push(nb[ni]);
      }
    }
    this.checkWin();
    return changed;
  };

  Engine.prototype.chord = function (i) {
    if (this.over || this.state[i] !== 1 || this.adj[i] === 0) return [];
    var nb = this.neighbors(i), self = this;
    var f = nb.filter(function (j) { return self.state[j] === MARK_BURRITO; }).length;
    if (f !== this.adj[i]) return [];
    var changed = [];
    nb.forEach(function (j) {
      if (self.state[j] === 0 || self.state[j] === MARK_AVOCADO || self.state[j] === MARK_NACHO) {
        changed = changed.concat(self.reveal(j));
      }
    });
    return changed;
  };

  Engine.prototype.checkWin = function () {
    if (!this.over && this.revealedCount === this.w * this.h - this.mines) {
      this.over = true; this.won = true;
      for (var i = 0; i < this.mine.length; i++) {
        if (this.mine[i] && this.state[i] !== MARK_BURRITO) {
          this.state[i] = MARK_BURRITO; this.flags++;
        }
      }
    }
  };

  // ---------- Solver (pure logic, no guessing) ----------

  function SolverBoard(w, h, adj, mineOrNull, revealed, burritoMarks) {
    this.w = w; this.h = h; this.adj = adj;
    this.mine = mineOrNull; // known truth for verification, or null
    this.revealed = revealed.slice();
    this.mark = new Array(w * h).fill(false); // burrito certainty from solver
    if (burritoMarks) for (var i = 0; i < burritoMarks.length; i++) if (burritoMarks[i]) this.mark[i] = true;
  }

  SolverBoard.prototype.neighbors = Engine.prototype.neighbors;

  /** Apply single-cell + subset rules; returns {progress, stuck}. */
  function solveStep(sb) {
    var progress = false, n = sb.w * sb.h;

    function unknown(j) { return !sb.revealed[j] && !sb.mark[j]; }

    // Single-cell deductions
    for (var i = 0; i < n; i++) {
      if (!sb.revealed[i]) continue;
      var need = sb.adj[i];
      var nb = sb.neighbors(i);
      var marks = 0, unk = [];
      for (var k = 0; k < nb.length; k++) {
        if (sb.mark[nb[k]]) marks++;
        else if (unknown(nb[k])) unk.push(nb[k]);
      }
      if (unk.length === 0) continue;
      if (marks === need) {
        // all unknown are safe
        for (k = 0; k < unk.length; k++) {
          sb.revealed[unk[k]] = true; progress = true;
        }
      } else if (marks + unk.length === need) {
        for (k = 0; k < unk.length; k++) {
          sb.mark[unk[k]] = true; progress = true;
        }
      }
    }
    if (progress) return { progress: true };

    // Build constraints: for each numbered revealed cell
    var cons = [];
    for (i = 0; i < n; i++) {
      if (!sb.revealed[i] || sb.adj[i] === 0) continue;
      nb = sb.neighbors(i);
      marks = 0; unk = [];
      for (k = 0; k < nb.length; k++) {
        if (sb.mark[nb[k]]) marks++;
        else if (unknown(nb[k])) unk.push(nb[k]);
      }
      var rem = sb.adj[i] - marks;
      if (unk.length && rem >= 0) cons.push({ cells: unk, rem: rem });
    }

    // Subset / pair reasoning
    for (var a = 0; a < cons.length; a++) {
      for (var b = 0; b < cons.length; b++) {
        if (a === b) continue;
        var A = cons[a], B = cons[b];
        if (A.cells.length >= B.cells.length) continue;
        // is A subset of B?
        var setB = {};
        for (k = 0; k < B.cells.length; k++) setB[B.cells[k]] = 1;
        var subset = true;
        for (k = 0; k < A.cells.length; k++) if (!setB[A.cells[k]]) { subset = false; break; }
        if (!subset) continue;
        var diff = [];
        for (k = 0; k < B.cells.length; k++) if (!A.cells.includes(B.cells[k]) && !A.cells.some(function (x) { return x === B.cells[k]; })) {
          // manual
        }
        diff = B.cells.filter(function (c) { return A.cells.indexOf(c) < 0; });
        var remDiff = B.rem - A.rem;
        if (diff.length === 0) continue;
        if (remDiff === 0) {
          for (k = 0; k < diff.length; k++) { sb.revealed[diff[k]] = true; progress = true; }
        } else if (remDiff === diff.length) {
          for (k = 0; k < diff.length; k++) { sb.mark[diff[k]] = true; progress = true; }
        }
      }
    }
    if (progress) return { progress: true };

    // Exhaustive enumeration on small frontier
    var frontierSet = {};
    for (a = 0; a < cons.length; a++) {
      for (k = 0; k < cons[a].cells.length; k++) frontierSet[cons[a].cells[k]] = 1;
    }
    var frontier = Object.keys(frontierSet).map(Number);
    if (frontier.length === 0 || frontier.length > 16) return { progress: false };

    var idxMap = {};
    for (k = 0; k < frontier.length; k++) idxMap[frontier[k]] = k;
    var F = frontier.length;
    var validCount = new Array(F).fill(0);
    var totalValid = 0;
    var maxEnum = 1 << F;
    // prune with early constraint check per assignment via recursion
    function okPartial(assign, assigned) {
      for (var ci = 0; ci < cons.length; ci++) {
        var c = cons[ci], minM = 0, maxM = 0, known = true;
        for (var j = 0; j < c.cells.length; j++) {
          var fi = idxMap[c.cells[j]];
          if (fi < assigned) {
            if (assign[fi]) minM++;
            maxM = minM;
          } else {
            known = false;
            maxM++;
          }
        }
        if (maxM < c.rem || minM > c.rem) return false;
      }
      return true;
    }

    function rec(pos, assign) {
      if (pos === F) {
        // fully check
        for (var ci = 0; ci < cons.length; ci++) {
          var c = cons[ci], m = 0;
          for (var j = 0; j < c.cells.length; j++) if (assign[idxMap[c.cells[j]]]) m++;
          if (m !== c.rem) return;
        }
        totalValid++;
        for (var t = 0; t < F; t++) if (assign[t]) validCount[t]++;
        return;
      }
      // try 0
      assign[pos] = 0;
      if (okPartial(assign, pos + 1)) rec(pos + 1, assign);
      assign[pos] = 1;
      if (okPartial(assign, pos + 1)) rec(pos + 1, assign);
      assign[pos] = 0;
    }
    rec(0, new Array(F).fill(0));
    if (totalValid === 0) return { progress: false };

    for (k = 0; k < F; k++) {
      if (validCount[k] === 0) { sb.revealed[frontier[k]] = true; progress = true; }
      else if (validCount[k] === totalValid) { sb.mark[frontier[k]] = true; progress = true; }
    }
    return { progress: progress };
  }

  /**
   * Try to solve board completely from an initial opening at `start`.
   * Uses truth adj/mine. Returns true if fully solvable by logic.
   */
  function isSolvable(w, h, adj, mine, start) {
    var n = w * h;
    var revealed = new Array(n).fill(false);
    var sb = new SolverBoard(w, h, adj, mine, revealed, null);
    // flood open from start (must be safe 0 ideally)
    var stack = [start];
    while (stack.length) {
      var c = stack.pop();
      if (sb.revealed[c] || mine[c]) continue;
      sb.revealed[c] = true;
      if (adj[c] === 0) {
        var nb = sb.neighbors(c);
        for (var i = 0; i < nb.length; i++) stack.push(nb[i]);
      }
    }
    var guard = 0;
    while (guard++ < n * 4) {
      var step = solveStep(sb);
      if (!step.progress) break;
      // flood any newly revealed zeros
      for (var i2 = 0; i2 < n; i2++) {
        if (!sb.revealed[i2] || mine[i2]) continue;
        if (adj[i2] === 0) {
          var nb2 = sb.neighbors(i2);
          for (var j = 0; j < nb2.length; j++) {
            if (!sb.revealed[nb2[j]] && !sb.mark[nb2[j]] && !mine[nb2[j]]) {
              sb.revealed[nb2[j]] = true;
            }
          }
        }
      }
    }
    for (var i3 = 0; i3 < n; i3++) {
      if (mine[i3]) {
        if (!sb.mark[i3] && !sb.revealed[i3]) {
          // mine must be marked OR we never need to open it — all non-mines must be revealed
        }
      } else {
        if (!sb.revealed[i3]) return false;
      }
    }
    return true;
  }

  /**
   * Generate a solvable board for first click at `safe`.
   * Returns { mine, adj, attempts, ms } or null.
   */
  function generateSolvable(w, h, mines, safe, rng, maxMs) {
    rng = rng || Math.random;
    maxMs = maxMs || 280;
    var t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    var attempts = 0;
    var n = w * h;
    var eng = new Engine(w, h, mines, rng);

    function neighborsOf(i) { return eng.neighbors.call({ w: w, h: h }, i); }

    while (true) {
      attempts++;
      var now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      if (now - t0 > maxMs && attempts > 1) break;

      var excl = {};
      excl[safe] = 1;
      var openNb = neighborsOf(safe);
      if (n - 9 >= mines) openNb.forEach(function (j) { excl[j] = 1; });

      var cand = [];
      for (var i = 0; i < n; i++) if (!excl[i]) cand.push(i);
      // shuffle first `mines` via Fisher-Yates partial
      for (var k = 0; k < mines; k++) {
        var r = k + Math.floor(rng() * (cand.length - k));
        var tmp = cand[k]; cand[k] = cand[r]; cand[r] = tmp;
      }
      var mine = new Array(n).fill(false);
      for (k = 0; k < mines; k++) mine[cand[k]] = true;

      // ensure safe is not mine and preferably adj 0
      if (mine[safe]) continue;
      var adj = new Array(n).fill(0);
      for (i = 0; i < n; i++) {
        var nb = neighborsOf(i), c = 0;
        for (var j = 0; j < nb.length; j++) if (mine[nb[j]]) c++;
        adj[i] = c;
      }
      // Prefer opening: if adj[safe] !== 0 and we have room, retry (soft)
      if (adj[safe] !== 0 && attempts < 40) continue;

      if (isSolvable(w, h, adj, mine, safe)) {
        return {
          mine: mine,
          adj: adj,
          attempts: attempts,
          ms: (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0
        };
      }
    }
    // Fallback: last random opening board (may require guess) — still first-click safe
    eng.placeMines(safe, null);
    return {
      mine: eng.mine,
      adj: eng.adj,
      attempts: attempts,
      ms: (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0,
      fallback: true
    };
  }

  Engine.generateSolvable = generateSolvable;
  Engine.isSolvable = isSolvable;
  Engine.solveStep = solveStep;
  Engine.SolverBoard = SolverBoard;
  Engine.MARK_BURRITO = MARK_BURRITO;
  Engine.MARK_AVOCADO = MARK_AVOCADO;
  Engine.MARK_NACHO = MARK_NACHO;

  Engine.prototype.applyGenerated = function (gen, safe) {
    this.mine = gen.mine.slice();
    this.adj = gen.adj.slice();
    this.placed = true;
    this.firstClick = safe;
  };

  Engine.prototype.revealFirst = function (i) {
    if (this.placed) return this.reveal(i);
    var gen = generateSolvable(this.w, this.h, this.mines, i, this.rng, 280);
    this.applyGenerated(gen, i);
    return this.reveal(i);
  };

  root.SweeperEngine = Engine;
  if (typeof module !== 'undefined' && module.exports) module.exports = Engine;
})(typeof window !== 'undefined' ? window : globalThis);
