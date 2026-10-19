/**
 * Queso v2 — slow, gooey melted-cheese transition (vector/procedural, theme colours).
 *
 * Rendering: metaballs. Every blob (sheet lobes, drip segments, drop heads, strings,
 * pinched-off droplets) is stamped as a soft radial "field" sprite with additive
 * blending onto a HALF-RES offscreen canvas. One pixel pass thresholds the field
 * (so neighbours merge/neck like real goo) and shades it: top-to-bottom cheese
 * gradient, darker orange rim, translucency where thin, and a specular term from
 * the field gradient (pseudo-normal). Crisp gloss streaks + bubbles are drawn on top.
 *
 * Timing: cover 2500ms (sheet sags down, drips creep → hesitate → accelerate),
 * hold 150ms, retract 1600ms (whole mass slides off the bottom with ease-in while
 * hanging strings thin out and drop). Tap anywhere skips. Reduced motion → fade.
 * Overlay is always pointer-events:none; a safety timer always clears it.
 */
(function (root) {
  'use strict';

  var COVER = 2500, HOLD = 150, RETRACT = 1600, TOTAL = COVER + HOLD + RETRACT;
  var TH = 0.42; // field threshold

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function hex(c) { c = String(c).replace('#', ''); if (c.length === 3) c = c.replace(/./g, '$&$&'); var n = parseInt(c, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function rnd(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

  // Viscous drip progress: creep, hesitate, then accelerate (0..1 in -> 0..~1 out)
  function visc(s, hes) {
    if (s <= 0) return 0;
    var creep = 0.22 * smooth(0, 0.35, s);              // slow ooze
    var go = Math.max(0, s - hes); go = go * go * go * 3.2; // late ease-in acceleration
    return creep + go;
  }

  function Queso(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.active = false;
    this.t0 = 0;
    this.duration = TOTAL;
    this.drips = [];
    this.onDone = null;
    this.reduced = false;
    try { this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
    this.field = document.createElement('canvas');
    this.fctx = this.field.getContext('2d', { willReadFrequently: true });
    this.sprite = document.createElement('canvas');
    this.sprite.width = this.sprite.height = 64;
    var s = this.sprite.getContext('2d');
    var g = s.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,0.62)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.40)');
    g.addColorStop(0.75, 'rgba(255,255,255,0.12)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    s.fillStyle = g; s.fillRect(0, 0, 64, 64);
    var self = this;
    this._skip = function () { if (self.active) self.finish(); };
  }

  Queso.TIMING = { cover: COVER, hold: HOLD, retract: RETRACT, total: TOTAL };

  Queso.prototype._themeColors = function () {
    var th = root.SweeperTheme && root.SweeperTheme.current;
    return (th && th.colors && th.colors.cheese) || ['#FFD25A', '#F6B23A', '#E8A020'];
  };

  Queso.prototype.resize = function () {
    var dpr = Math.min(window.devicePixelRatio || 1, 3);
    var w = this.canvas.clientWidth || window.innerWidth;
    var h = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.dpr = dpr; this.cssW = w; this.cssH = h;
    this.fs = 0.5; // half-res field
    this.field.width = Math.max(2, Math.ceil(w * this.fs));
    this.field.height = Math.max(2, Math.ceil(h * this.fs));
    this.img = null;
  };

  Queso.prototype._build = function () {
    var W = this.cssW, R = rnd((Math.random() * 1e9) | 0 || 7);
    var n = Math.round(9 + W / 32), drips = [];
    for (var i = 0; i < n; i++) {
      var w = 12 + R() * 30;
      drips.push({
        x: (i + 0.15 + R() * 0.7) * (W / n),
        w: w,
        len: 0.4 + R() * 0.8,         // relative max stretch
        delay: R() * 0.3,
        hes: 0.35 + R() * 0.25,          // hesitation point
        wob: R() * Math.PI * 2,
        pinch: R() < 0.35,               // drop head pinches off
        pinchAt: 0.55 + R() * 0.3,
        bubble: R()
      });
    }
    drips.sort(function (a, b) { return a.x - b.x; });
    this.drips = drips;
    this.lobes = [];
    for (var k = 0; k < 14; k++) this.lobes.push({ ph: R() * 6.28, a: 6 + R() * 10 });
    this.bubbles = [];
    for (var b = 0; b < 16; b++) this.bubbles.push({ x: R(), y: 0.1 + R() * 0.8, r: 1.4 + R() * 3.2, ph: R() * 6.28 });
  };

  Queso.prototype.start = function (opts) {
    opts = opts || {};
    this.resize();
    this.duration = this.reduced ? 900 : TOTAL;
    this.onDone = opts.onDone || null;
    this.t0 = performance.now();
    this.active = true; this._frozen = false;
    var cs = this.canvas.style;
    cs.display = 'block'; cs.opacity = '1'; cs.pointerEvents = 'none';
    this.canvas.setAttribute('aria-hidden', 'false');
    var self = this;
    clearTimeout(this._safety);
    this._safety = setTimeout(function () { self.forceClear(); }, this.duration + 1500);
    // tap-to-skip (overlay itself stays pointer-events:none). Armed a beat later so the
    // tap that triggered the transition doesn't instantly skip it.
    document.removeEventListener('pointerdown', this._skip, true);
    clearTimeout(this._arm);
    this._arm = setTimeout(function () { if (self.active) document.addEventListener('pointerdown', self._skip, true); }, 250);
    this._mode = this.reduced ? 'fade' : 'drip';
    if (!this.reduced) this._build();
  };

  Queso.prototype._stamp = function (x, y, r) {
    if (r <= 0.3) return;
    var s = this.fs, d = r * 2 * s * 1.25;
    this.fctx.drawImage(this.sprite, x * s - d / 2, y * s - d / 2, d, d);
  };
  // capsule-ish chain of blobs from (x0,y0) to (x1,y1), radius r0 -> r1
  Queso.prototype._chain = function (x0, y0, r0, x1, y1, r1) {
    var dist = Math.hypot(x1 - x0, y1 - y0), steps = Math.max(1, Math.ceil(dist / Math.max(2.5, Math.min(r0, r1) * 0.7)));
    for (var i = 0; i <= steps; i++) {
      var t = i / steps;
      this._stamp(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r0 + (r1 - r0) * t);
    }
  };

  /** ms since start -> draw */
  Queso.prototype._drawDrip = function (ms) {
    var W = this.cssW, H = this.cssH, f = this.fctx, FW = this.field.width, FH = this.field.height;
    f.setTransform(1, 0, 0, 1, 0, 0);
    f.globalCompositeOperation = 'source-over';
    f.clearRect(0, 0, FW, FH);
    f.globalCompositeOperation = 'lighter';

    var cover = clamp(ms / COVER, 0, 1);
    var ret = clamp((ms - COVER - HOLD) / RETRACT, 0, 1);
    var tsec = ms / 1000;
    // sheet bottom: sags down with viscous ease (slow start, gooey finish)
    // sheet sags slowly to ~40% then the whole mass lets go and slumps down (viscous)
    var lead = Math.max(0, cover - 0.6) / 0.4;
    var sheet = H * (0.06 + 0.34 * smooth(0, 0.6, cover)) + H * 0.8 * lead * lead;
    var slide = ret > 0 ? H * 1.25 * ret * ret * ret + H * 0.05 * ret : 0; // ease-in slide-off
    var topEdge = ret > 0 ? slide - 30 : -60;
    var thin = ret > 0 ? 1 - ret * 0.55 : 1;

    // solid body above the wavy bottom
    var top = Math.max(-40, topEdge), bodyBot = sheet - 18 + slide;
    if (bodyBot > top) {
      f.fillStyle = 'rgba(255,255,255,1)';
      var ftop = ret > 0 ? top + 34 : top;
      f.fillRect(0, Math.max(0, ftop * this.fs), FW, Math.max(0, (bodyBot - ftop) * this.fs));
    }
    // wavy sagging bottom lip + wavy top during retract
    var lobes = this.lobes, nl = lobes.length;
    for (var x = -10; x <= W + 10; x += 9) {
      var u = x / W, wav = 0;
      for (var k = 0; k < 3; k++) { var L = lobes[k]; wav += Math.sin(u * (4 + k * 3) + L.ph + tsec * (0.9 + k * 0.4)) * L.a * 0.5; }
      var sag = Math.sin(u * Math.PI) * 10 * cover;
      this._stamp(x, sheet + slide + wav * 1.6 + sag * 1.8 - 6, 26);
      if (ret > 0) {
        var wt = 0; for (var k2 = 3; k2 < 6; k2++) { var L2 = lobes[k2]; wt += Math.sin(u * (5 + k2) + L2.ph + tsec) * L2.a * 0.6; }
        this._stamp(x, top + 34 + wt * 1.5, 26);
      }
    }

    // gooey strands still clinging to the top while the mass slides away, thinning out
    if (ret > 0 && ret < 0.97) {
      for (var si = 0; si < this.drips.length; si += 2) {
        var sd = this.drips[si], sr = Math.max(0, (1 - ret * 1.15)) * sd.w * 0.22 + 0.4;
        var sx = sd.x + Math.sin(tsec * 1.7 + sd.wob) * 3;
        var cut = sd.pinch ? ret > 0.55 : ret > 0.8;
        var endY = top + 40;
        if (cut) { this._chain(sx, -6, sd.w * 0.35, sx, endY * (0.25 + sd.bubble * 0.2), sr); this._stamp(sx, endY * (0.25 + sd.bubble * 0.2) + 3, sr * 2.2); }
        else { this._chain(sx, -6, sd.w * 0.3, sx, endY, sr); }
      }
    }
    // drips
    var ds = this.drips, heads = [];
    for (var i = 0; i < ds.length; i++) {
      var d = ds[i];
      var s = clamp((cover - d.delay * 0.6) / (0.78 - d.delay * 0.6), 0, 1.3) + ret * 1.4;
      var p = visc(s, d.hes);
      var len = p * d.len * H * 0.62;
      var base = sheet + slide - 8;
      var wob = Math.sin(tsec * 2.3 + d.wob) * (2 + p * 3);
      var hx = d.x + wob, hy = base + len;
      var rB = d.w * 0.55 * thin, rH = d.w * (0.42 + 0.18 * Math.sin(tsec * 3 + d.wob) * 0.3) * (0.7 + 0.5 * Math.min(1, p)) * thin;
      var neck = Math.max(2.2, d.w * (0.4 - Math.min(0.2, p * 0.14))) * thin;
      if (len < 2) { this._stamp(d.x, base + 4, rB); continue; }
      // root -> neck -> head (bulbous drop head that necks down above it)
      var midY = base + len * 0.62;
      this._chain(d.x, base, rB, d.x + wob * 0.5, midY, neck);
      var detached = d.pinch && s > d.pinchAt;
      if (!detached) {
        this._chain(d.x + wob * 0.5, midY, neck, hx, hy - rH * 0.4, neck * 0.9);
        this._stamp(hx, hy, rH * 1.15);
      } else {
        // stub recoils a bit, droplet falls free with gravity
        var dt = (s - d.pinchAt) * (COVER / 1000) * 1.2;
        this._chain(d.x + wob * 0.5, midY, neck, hx, midY + len * 0.18, neck * 0.7);
        this._stamp(hx, midY + len * 0.18 + 3, neck * 1.6);
        var fy = hy + 0.5 * 2200 * dt * dt;
        this._stamp(hx, fy, rH);
        this._stamp(hx, fy - rH * 0.9, rH * 0.45); // teardrop tail
      }
      heads.push({ x: hx, y: hy, r: rH, len: len, p: p, det: detached });
    }
    // stretched strings between close neighbours (form while slow, snap when fast)
    for (var j = 0; j + 1 < heads.length; j++) {
      var a = heads[j], b = heads[j + 1];
      if (a.det || b.det) continue;
      var gap = b.x - a.x;
      if (gap > 46 || a.len < 30 || b.len < 30) continue;
      var sy = Math.min(a.y, b.y) - Math.min(a.len, b.len) * 0.45;
      var life = 1 - smooth(0.6, 1.0, Math.max(a.p, b.p));
      if (life <= 0.05) continue;
      var sag2 = 10 + gap * 0.25;
      var steps = Math.ceil(gap / 3);
      for (var q = 0; q <= steps; q++) {
        var tq = q / steps;
        this._stamp(a.x + gap * tq, sy + Math.sin(tq * Math.PI) * sag2, 2.6 * life * thin + 0.6);
      }
    }
    f.globalCompositeOperation = 'source-over';
    this._shade();

    // crisp extras on main canvas
    var ctx = this.ctx, dpr = this.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this.field, 0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // glossy specular streaks on the sheet
    var by0 = Math.max(top + 30, 0), by1 = sheet + slide - 30;
    if (by1 - by0 > 40) {
      ctx.save();
      ctx.globalAlpha = 0.55 * thin;
      ctx.strokeStyle = 'rgba(255,250,225,0.9)'; ctx.lineCap = 'round';
      ctx.lineWidth = 5;
      ctx.beginPath();
      var sy0 = by0 + (by1 - by0) * 0.18;
      ctx.moveTo(W * 0.08, sy0 + 10);
      ctx.bezierCurveTo(W * 0.25, sy0 - 8, W * 0.42, sy0 + 14, W * 0.6, sy0 + 2);
      ctx.stroke();
      ctx.lineWidth = 2.5; ctx.globalAlpha = 0.4 * thin;
      ctx.beginPath(); ctx.moveTo(W * 0.66, sy0 + 4); ctx.lineTo(W * 0.74, sy0 + 1); ctx.stroke();
      // bubbles
      ctx.globalAlpha = 0.85 * thin;
      for (var bi = 0; bi < this.bubbles.length; bi++) {
        var bb = this.bubbles[bi], bx = bb.x * W, byy = by0 + bb.y * (by1 - by0) + Math.sin(tsec * 1.3 + bb.ph) * 2;
        if (byy > by1 - 6) continue;
        ctx.fillStyle = 'rgba(232,150,30,0.35)';
        ctx.beginPath(); ctx.arc(bx, byy, bb.r, 0, 6.283); ctx.fill();
        ctx.strokeStyle = 'rgba(255,248,215,0.8)'; ctx.lineWidth = 0.9;
        ctx.beginPath(); ctx.arc(bx, byy, bb.r, 3.6, 5.2); ctx.stroke();
      }
      ctx.restore();
    }
    // tiny highlight dot on each drop head
    ctx.fillStyle = 'rgba(255,252,235,0.75)';
    for (var hi = 0; hi < heads.length; hi++) {
      var h = heads[hi]; if (h.len < 14 || h.det) continue;
      ctx.beginPath(); ctx.ellipse(h.x - h.r * 0.35, h.y - h.r * 0.3, Math.max(0.6, h.r * 0.22), Math.max(0.6, h.r * 0.34), -0.5, 0, 6.283); ctx.fill();
    }
  };

  // threshold + shade the half-res field in place
  Queso.prototype._shade = function () {
    var FW = this.field.width, FH = this.field.height, f = this.fctx;
    var im = f.getImageData(0, 0, FW, FH), px = im.data;
    var src = this._fieldBuf && this._fieldBuf.length === FW * FH ? this._fieldBuf : (this._fieldBuf = new Float32Array(FW * FH));
    for (var i = 0, j = 3; i < src.length; i++, j += 4) src[i] = px[j] / 255;
    var cols = this._themeColors().map(hex), c0 = cols[0], c1 = cols[1], c2 = cols[2] || cols[1];
    var rim = [Math.round(c2[0] * 0.86), Math.round(c2[1] * 0.72), Math.round(c2[2] * 0.6)];
    for (var y = 0; y < FH; y++) {
      var gy = y / FH, r0 = c0[0] + (c1[0] - c0[0]) * gy, g0 = c0[1] + (c1[1] - c0[1]) * gy, b0 = c0[2] + (c1[2] - c0[2]) * gy;
      for (var x = 0; x < FW; x++) {
        var k = y * FW + x, v = src[k], o = k * 4;
        if (v < TH) { px[o + 3] = 0; continue; }
        var e = clamp((v - TH) / 0.2, 0, 1);         // 0 at edge -> 1 inside
        var nx = (x > 0 ? src[k - 1] : v) - (x < FW - 1 ? src[k + 1] : v);
        var ny = (y > 0 ? src[k - FW] : v) - (y < FH - 1 ? src[k + FW] : v);
        var lit = clamp((-nx * 0.7 - ny * 0.7) * 5, -1, 1);   // light from top-left
        var rimT = 1 - smooth(0, 0.55, e);
        var r = r0 + (rim[0] - r0) * rimT * 0.8, g = g0 + (rim[1] - g0) * rimT * 0.8, b = b0 + (rim[2] - b0) * rimT * 0.8;
        if (lit > 0) { var sp = Math.pow(lit, 3) * 0.6; r += (255 - r) * sp; g += (250 - g) * sp; b += (225 - b) * sp; }
        else { r *= 1 + lit * 0.12; g *= 1 + lit * 0.16; b *= 1 + lit * 0.2; }
        px[o] = r; px[o + 1] = g; px[o + 2] = b;
        px[o + 3] = 255 * (0.62 + 0.38 * smooth(0, 1, e)) * smooth(TH, TH + 0.04, v) ; // translucent where thin
      }
    }
    f.putImageData(im, 0, 0);
  };

  Queso.prototype._drawFade = function (p) {
    var ctx = this.ctx, dpr = this.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.cssW, this.cssH);
    ctx.fillStyle = this._themeColors()[0];
    ctx.globalAlpha = clamp(p < 0.5 ? p * 2 : (1 - p) * 2, 0, 1);
    ctx.fillRect(0, 0, this.cssW, this.cssH);
    ctx.globalAlpha = 1;
  };

  Queso.prototype.finish = function () {
    var done = this.onDone; this.onDone = null;
    this.forceClear();
    if (done) try { done(); } catch (e) {}
  };

  Queso.prototype.forceClear = function () {
    this.active = false;
    clearTimeout(this._safety); clearTimeout(this._arm);
    try { document.removeEventListener('pointerdown', this._skip, true); } catch (e) {}
    var cs = this.canvas.style;
    cs.display = 'none'; cs.opacity = '0'; cs.pointerEvents = 'none';
    this.canvas.setAttribute('aria-hidden', 'true');
    try { this.ctx.setTransform(1, 0, 0, 1, 0, 0); this.ctx.clearRect(0, 0, this.canvas.width || 0, this.canvas.height || 0); } catch (e) {}
  };

  Queso.prototype.frame = function (now) {
    if (!this.active || this._frozen) return false;
    var ms = now - this.t0;
    if (ms >= this.duration) { this.finish(); return false; }
    try {
      if (this._mode === 'fade') this._drawFade(ms / this.duration);
      else this._drawDrip(ms);
    } catch (e) { this.forceClear(); return false; }
    return true;
  };

  /** QA: render at progress p (0..1 of total) without running the clock. */
  Queso.prototype.seek = function (p) {
    if (!this.active) this.start({});
    this.t0 = performance.now() + 1e9; // freeze live frames (frame() sees negative ms -> we draw manually)
    this._frozen = true;
    p = clamp(p, 0, 1);
    if (this._mode === 'fade') this._drawFade(p); else this._drawDrip(p * TOTAL);
  };

  root.SweeperQueso = Queso;
  if (typeof module !== 'undefined' && module.exports) module.exports = Queso;
})(typeof window !== 'undefined' ? window : globalThis);
