/**
 * Queso drip transition — vector canvas drips, theme-driven colors.
 * Mechanics only; visuals pulled from SweeperTheme.current.colors.cheese.
 */
(function (root) {
  'use strict';

  function Queso(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.active = false;
    this.t0 = 0;
    this.duration = 1000; // ms, 0.8–1.2s range
    this.drips = [];
    this.onDone = null;
    this.reduced = false;
    try {
      this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) {}
  }

  Queso.prototype._themeColors = function () {
    var th = root.SweeperTheme && root.SweeperTheme.current;
    return (th && th.colors && th.colors.cheese) || ['#f2c94c', '#f2994a', '#e8a838'];
  };

  Queso.prototype.resize = function () {
    var dpr = Math.min(window.devicePixelRatio || 1, 3);
    var w = this.canvas.clientWidth || window.innerWidth;
    var h = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.dpr = dpr;
    this.cssW = w;
    this.cssH = h;
  };

  Queso.prototype.start = function (opts) {
    opts = opts || {};
    this.resize();
    this.duration = opts.duration || (800 + Math.random() * 400);
    this.onDone = opts.onDone || null;
    this.t0 = performance.now();
    this.active = true;
    this.canvas.style.display = 'block';
    this.canvas.style.opacity = '1';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.setAttribute('aria-hidden', 'false');
    // Safety: never leave overlay stuck
    var self = this;
    clearTimeout(this._safety);
    this._safety = setTimeout(function () { self.forceClear(); }, (this.duration || 1000) + 800);

    if (this.reduced) {
      this._mode = 'fade';
      return;
    }
    this._mode = 'drip';
    var colors = this._themeColors();
    var n = Math.floor(10 + this.cssW / 40);
    this.drips = [];
    for (var i = 0; i < n; i++) {
      this.drips.push({
        x: (i + 0.5) * (this.cssW / n) + (Math.random() - 0.5) * 8,
        w: 14 + Math.random() * 28,
        speed: 0.7 + Math.random() * 0.7,
        phase: Math.random() * 0.35,
        blob: 0.6 + Math.random() * 0.8,
        color: colors[i % colors.length]
      });
    }
  };

  /** progress 0..1 */
  Queso.prototype._drawDrip = function (p) {
    var ctx = this.ctx, dpr = this.dpr, W = this.cssW, H = this.cssH;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // Sheet of cheese descending
    var sheetY = H * Math.min(1, p * 1.15);
    var colors = this._themeColors();
    var g = ctx.createLinearGradient(0, 0, 0, sheetY + 40);
    g.addColorStop(0, colors[0]);
    g.addColorStop(0.55, colors[1]);
    g.addColorStop(1, colors[2] || colors[0]);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(W, 0);
    ctx.lineTo(W, Math.max(0, sheetY - 20));
    // wavy bottom
    var waves = 8;
    for (var i = waves; i >= 0; i--) {
      var x = (i / waves) * W;
      var y = sheetY + Math.sin(i * 1.7 + p * 6) * 12;
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();

    // Gloss highlight (vector)
    ctx.fillStyle = 'rgba(255,246,200,0.45)';
    ctx.beginPath();
    var ery=Math.max(0.01, sheetY * 0.15); ctx.ellipse(W * 0.35, Math.max(0.01,sheetY * 0.35), Math.max(0.01,W * 0.25), ery, 0, 0, Math.PI * 2);
    ctx.fill();

    // Individual drips ahead of the sheet
    for (var d = 0; d < this.drips.length; d++) {
      var dr = this.drips[d];
      var local = Math.max(0, Math.min(1, (p - dr.phase) / (1 - dr.phase + 0.01)));
      var tip = local * H * dr.speed * 1.1;
      if (tip <= 0) continue;
      var hw = dr.w / 2;
      ctx.fillStyle = dr.color;
      ctx.beginPath();
      ctx.moveTo(dr.x - hw, 0);
      ctx.bezierCurveTo(dr.x - hw * 0.7, tip * 0.4, dr.x - hw * dr.blob, tip * 0.75, dr.x, tip);
      ctx.bezierCurveTo(dr.x + hw * dr.blob, tip * 0.75, dr.x + hw * 0.7, tip * 0.4, dr.x + hw, 0);
      ctx.closePath();
      ctx.fill();
      // tip blob
      ctx.beginPath();
      ctx.arc(dr.x, tip, hw * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }

    // Clear phase near end: fade out
    if (p > 0.75) {
      ctx.fillStyle = 'rgba(243,239,232,' + ((p - 0.75) / 0.25) + ')';
      ctx.fillRect(0, 0, W, H);
    }
  };

  Queso.prototype._drawFade = function (p) {
    var ctx = this.ctx, dpr = this.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.cssW, this.cssH);
    var colors = this._themeColors();
    var alpha = p < 0.5 ? p * 2 : (1 - p) * 2;
    ctx.fillStyle = colors[0];
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.fillRect(0, 0, this.cssW, this.cssH);
    ctx.globalAlpha = 1;
  };


  Queso.prototype.forceClear = function () {
    this.active = false;
    clearTimeout(this._safety);
    this.canvas.style.display = 'none';
    this.canvas.style.opacity = '0';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.setAttribute('aria-hidden', 'true');
    try {
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.clearRect(0, 0, this.canvas.width || 0, this.canvas.height || 0);
    } catch (e) {}
  };

  Queso.prototype.frame = function (now) {
    if (!this.active) return false;
    var p = (now - this.t0) / this.duration;
    if (p >= 1) {
      var done = this.onDone;
      this.onDone = null;
      this.forceClear();
      if (done) done();
      return false;
    }
    if (this._mode === 'fade') this._drawFade(p);
    else this._drawDrip(p);
    return true;
  };

  /** Force mid-transition for QA screenshots. */
  Queso.prototype.seek = function (p) {
    this.resize();
    this.active = true;
    this.canvas.style.display = 'block';
    if (!this.drips.length && this._mode !== 'fade') {
      this._mode = 'drip';
      this.start({ duration: this.duration });
      this.active = true;
    }
    p = Math.max(0, Math.min(1, p));
    if (this._mode === 'fade') this._drawFade(p);
    else this._drawDrip(p);
  };

  root.SweeperQueso = Queso;
  if (typeof module !== 'undefined' && module.exports) module.exports = Queso;
})(typeof window !== 'undefined' ? window : globalThis);
