/* Pure Minesweeper logic (no DOM) — testable in Node. */
(function (root) {
  function Engine(w, h, mines, rng) {
    this.w = w; this.h = h; this.mines = mines; this.rng = rng || Math.random;
    this.reset();
  }
  Engine.prototype.reset = function () {
    var n = this.w * this.h;
    this.mine = new Array(n).fill(false);
    this.adj = new Array(n).fill(0);
    this.state = new Array(n).fill(0); // 0 hidden, 1 revealed, 2 flagged
    this.placed = false; this.over = false; this.won = false;
    this.revealedCount = 0; this.flags = 0; this.exploded = -1;
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
  Engine.prototype.place = function (safe) {
    var n = this.w * this.h, excl = {}, self = this;
    excl[safe] = 1;
    // Keep the whole 3x3 opening safe when the board has room for it.
    if (n - 9 >= this.mines) this.neighbors(safe).forEach(function (j) { excl[j] = 1; });
    var cand = [];
    for (var i = 0; i < n; i++) if (!excl[i]) cand.push(i);
    for (var k = 0; k < this.mines; k++) {
      var r = k + Math.floor(this.rng() * (cand.length - k));
      var t = cand[k]; cand[k] = cand[r]; cand[r] = t;
      this.mine[cand[k]] = true;
    }
    for (i = 0; i < n; i++) this.adj[i] = this.neighbors(i).filter(function (j) { return self.mine[j]; }).length;
    this.placed = true;
  };
  Engine.prototype.reveal = function (i) {
    if (this.over || this.state[i] !== 0) return [];
    if (!this.placed) this.place(i);
    if (this.mine[i]) { this.state[i] = 1; this.over = true; this.exploded = i; return [i]; }
    var changed = [], stack = [i];
    while (stack.length) {
      var c = stack.pop();
      if (this.state[c] !== 0) continue;
      this.state[c] = 1; this.revealedCount++; changed.push(c);
      if (this.adj[c] === 0) stack.push.apply(stack, this.neighbors(c));
    }
    this.checkWin();
    return changed;
  };
  Engine.prototype.toggleFlag = function (i) {
    if (this.over || this.state[i] === 1) return;
    if (this.state[i] === 0) { this.state[i] = 2; this.flags++; } else { this.state[i] = 0; this.flags--; }
  };
  Engine.prototype.chord = function (i) {
    if (this.over || this.state[i] !== 1 || this.adj[i] === 0) return [];
    var nb = this.neighbors(i), self = this;
    var f = nb.filter(function (j) { return self.state[j] === 2; }).length;
    if (f !== this.adj[i]) return [];
    var changed = [];
    nb.forEach(function (j) { if (self.state[j] === 0) changed = changed.concat(self.reveal(j)); });
    return changed;
  };
  Engine.prototype.checkWin = function () {
    if (!this.over && this.revealedCount === this.w * this.h - this.mines) {
      this.over = true; this.won = true;
      for (var i = 0; i < this.mine.length; i++) if (this.mine[i] && this.state[i] !== 2) { this.state[i] = 2; this.flags++; }
    }
  };
  root.SweeperEngine = Engine;
  if (typeof module !== 'undefined') module.exports = Engine;
})(typeof window !== 'undefined' ? window : globalThis);
