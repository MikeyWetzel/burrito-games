/**
 * Burrito Sweeper themes — Flat Calm (style B) is the active skin.
 * All drawing is vector canvas paths; no bitmap sprites.
 */
(function (root) {
  'use strict';

  function ell(ctx, cx, cy, rx, ry, rot) {
    rx = Math.max(0.01, Math.abs(rx));
    ry = Math.max(0.01, Math.abs(ry));
    ctx.ellipse(cx, cy, rx, ry, rot || 0, 0, Math.PI * 2);
  }
  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function softShadow(ctx, drawFn) {
    ctx.save();
    ctx.shadowColor = 'rgba(58,74,102,0.14)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
    drawFn();
    ctx.restore();
  }

  /** Draw Style-B burrito marker in a size×size box (vector, from concept SVG). */
  function drawBurritoB(ctx, x, y, size) {
    var s = size / 100;
    ctx.save();
    ctx.translate(x + size / 2, y + size / 2);
    ctx.scale(s * 1.02, s * 1.02);
    ctx.translate(-53, -50);
    ctx.translate(50, 52);
    ctx.rotate(-28 * Math.PI / 180);
    ctx.translate(-50, -52);
    // tortilla body
    roundRect(ctx, 26, 34, 56, 36, 6);
    ctx.fillStyle = '#F1C27D';
    ctx.fill();
    // open end
    ctx.fillStyle = '#D9A25C';
    ctx.beginPath(); ell(ctx, 26, 52, 10, 18, 0); ctx.fill();
    ctx.fillStyle = '#7BC96F';
    ctx.beginPath(); ell(ctx, 26, 52, 7, 14, 0); ctx.fill();
    // rice / beans / tomato
    [[24, 46, 3.6, '#FFFFFF'], [27, 53, 3.8, '#FFFFFF'], [23, 58, 3.2, '#FFFFFF'],
     [27, 46, 2.4, '#5A3A32'], [22, 52, 2.2, '#5A3A32'], [26, 59, 2.3, '#EF6B5B']].forEach(function (p) {
      ctx.fillStyle = p[3];
      ctx.beginPath(); ctx.arc(p[0], p[1], p[2], 0, Math.PI * 2); ctx.fill();
    });
    // grill lines
    ctx.strokeStyle = '#C58A4A';
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = 3.4;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(40, 38); ctx.lineTo(48, 66); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(52, 38); ctx.lineTo(60, 66); ctx.stroke();
    ctx.globalAlpha = 1;
    // foil
    ctx.fillStyle = '#C4CEDB';
    ctx.beginPath();
    ctx.moveTo(62, 31);
    ctx.quadraticCurveTo(58, 52, 62, 73);
    ctx.lineTo(86, 73);
    ctx.quadraticCurveTo(92, 52, 86, 31);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#98A5B8';
    ctx.lineWidth = 1.6;
    ctx.globalAlpha = 0.8;
    [[68, 36, 70, 68], [75, 35, 77, 69], [82, 37, 83, 67]].forEach(function (L) {
      ctx.beginPath(); ctx.moveTo(L[0], L[1]); ctx.lineTo(L[2], L[3]); ctx.stroke();
    });
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawAvocadoB(ctx, x, y, size) {
    var s = size / 100;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    // skin
    ctx.fillStyle = '#2E6F4E';
    ctx.beginPath();
    ctx.moveTo(50, 6);
    ctx.bezierCurveTo(63, 6, 67, 24, 71, 38);
    ctx.bezierCurveTo(79, 52, 86, 61, 82, 75);
    ctx.bezierCurveTo(78, 90, 63, 96, 50, 96);
    ctx.bezierCurveTo(37, 96, 22, 90, 18, 75);
    ctx.bezierCurveTo(14, 61, 21, 52, 29, 38);
    ctx.bezierCurveTo(33, 24, 37, 6, 50, 6);
    ctx.closePath();
    ctx.fill();
    // flesh
    ctx.fillStyle = '#BFE08A';
    ctx.beginPath();
    ctx.moveTo(50, 14);
    ctx.bezierCurveTo(60, 14, 63, 28, 66, 40);
    ctx.bezierCurveTo(73, 52, 78, 60, 75, 72);
    ctx.bezierCurveTo(72, 84, 61, 89, 50, 89);
    ctx.bezierCurveTo(39, 89, 28, 84, 25, 72);
    ctx.bezierCurveTo(22, 60, 27, 52, 34, 40);
    ctx.bezierCurveTo(37, 28, 40, 14, 50, 14);
    ctx.closePath();
    ctx.fill();
    // pit
    ctx.fillStyle = '#9A5B3A';
    ctx.beginPath(); ctx.arc(50, 68, 16, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#C98B63';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(42, 62);
    ctx.quadraticCurveTo(44, 58, 48, 58);
    ctx.stroke();
    ctx.restore();
  }

  function drawChipB(ctx, x, y, size) {
    var s = size / 100;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillStyle = '#F4C04E';
    ctx.strokeStyle = '#E0A12E';
    ctx.lineWidth = 9;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(50, 9); ctx.lineTo(91, 83); ctx.lineTo(9, 83); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#FFD97A';
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(50, 24); ctx.lineTo(77, 74); ctx.lineTo(23, 74); ctx.closePath();
    ctx.stroke();
    ctx.globalAlpha = 1;
    // cheese drizzle
    ctx.strokeStyle = '#F28C3A';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(36, 58);
    ctx.quadraticCurveTo(44, 52, 52, 60);
    ctx.quadraticCurveTo(60, 66, 66, 56);
    ctx.stroke();
    ctx.lineWidth = 5.4;
    ctx.beginPath(); ctx.moveTo(60, 56); ctx.lineTo(61, 66); ctx.stroke();
    ctx.fillStyle = '#D96A2B';
    [[50, 44, 2.4], [43, 68, 2.2], [58, 72, 2], [31, 72, 1.9], [68, 68, 1.9], [54, 31, 1.8]].forEach(function (p) {
      ctx.beginPath(); ctx.arc(p[0], p[1], p[2], 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();
  }

  var flatCalm = {
    id: 'flat-calm',
    name: 'Flat Calm',
    cellSize: 36,
    fontFamily: '"Poppins", system-ui, -apple-system, "Segoe UI", sans-serif',
    colors: {
      bgTop: '#F3EFE8',
      bgBot: '#E4ECF2',
      bgBlobPeach: '#F6C7A8',
      bgBlobTeal: '#A9D8CF',
      bg: '#F3EFE8',
      hudBg: 'transparent',
      hudText: '#24324A',
      hudMuted: '#7B879A',
      card: '#FFFFFF',
      tileClosedA: '#4DAE9F',
      tileClosedB: '#55B6A7',
      tileOpen: '#F3EEE6',
      tileStroke: 'transparent',
      accent: '#FDEBD9',
      danger: '#E24B36',
      success: '#1F9A63',
      cheese: ['#FFD25A', '#F6B23A', '#E8A020'],
      markBurrito: '#F1C27D',
      markAvocado: '#2E6F4E',
      markNacho: '#F4C04E',
      numbers: {
        1: '#2F6FDE', 2: '#1F9A63', 3: '#E24B36', 4: '#7A44C9',
        5: '#E67E22', 6: '#1abc9c', 7: '#24324A', 8: '#7B879A'
      }
    },

    drawBackground: function (ctx, w, h) {
      var g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, this.colors.bgTop);
      g.addColorStop(1, this.colors.bgBot);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = this.colors.bgBlobPeach;
      ctx.globalAlpha = 0.35;
      ctx.beginPath(); ctx.arc(w * 0.9, h * 0.08, Math.max(80, w * 0.35), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = this.colors.bgBlobTeal;
      ctx.beginPath(); ctx.arc(w * 0.05, h * 0.92, Math.max(90, w * 0.38), 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    },

    drawTileClosed: function (ctx, x, y, size, opts) {
      opts = opts || {};
      var i = opts.i || 0, j = opts.j || 0;
      var c = ((i + j) % 2) ? this.colors.tileClosedA : this.colors.tileClosedB;
      var r = size * (8 / 34);
      ctx.save();
      ctx.shadowColor = 'rgba(31,77,71,0.22)';
      ctx.shadowBlur = Math.max(1, size * 0.04);
      ctx.shadowOffsetY = Math.max(1, size * 0.05);
      roundRect(ctx, x, y, size, size, r);
      ctx.fillStyle = c;
      ctx.fill();
      ctx.restore();
      // soft top highlight
      ctx.save();
      ctx.beginPath();
      var k = size / 34;
      ctx.moveTo(x + 8 * k, y);
      ctx.lineTo(x + size - 8 * k, y);
      ctx.arcTo(x + size, y, x + size, y + 8 * k, 8 * k);
      ctx.lineTo(x + size, y + size * 0.45);
      ctx.lineTo(x, y + size * 0.45);
      ctx.lineTo(x, y + 8 * k);
      ctx.arcTo(x, y, x + 8 * k, y, 8 * k);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.fill();
      ctx.restore();
    },

    drawTileOpen: function (ctx, x, y, size, number) {
      var r = size * (8 / 34);
      roundRect(ctx, x, y, size, size, r);
      ctx.fillStyle = this.colors.tileOpen;
      ctx.fill();
      if (number > 0) {
        ctx.fillStyle = this.colors.numbers[number] || this.colors.hudText;
        ctx.font = '800 ' + Math.floor(size * 0.62) + 'px ' + this.fontFamily;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(number), x + size / 2, y + size / 2 + size * 0.05);
      }
    },

    drawMark: function (ctx, x, y, size, kind, popT) {
      popT = popT == null ? 1 : Math.max(0, Math.min(1, popT));
      var scale = popT >= 1 ? 1 : 0.55 + 0.45 * (1 - Math.pow(1 - popT, 3));
      // gentle overshoot
      if (popT < 1) scale = 0.5 + 0.55 * Math.sin(popT * Math.PI * 0.5);
      if (popT > 0.85) scale = 1 + (1 - popT) * 0.15;
      if (popT >= 1) scale = 1;
      ctx.save();
      ctx.translate(x + size / 2, y + size / 2);
      ctx.scale(scale, scale);
      ctx.translate(-(x + size / 2), -(y + size / 2));
      var pad = size * 0.08;
      if (kind === 'burrito') drawBurritoB(ctx, x + pad, y + pad, size - pad * 2);
      else if (kind === 'avocado') drawAvocadoB(ctx, x + pad, y + pad, size - pad * 2);
      else if (kind === 'nacho' || kind === 'chip') drawChipB(ctx, x + pad, y + pad, size - pad * 2);
      ctx.restore();
    },

    drawMine: function (ctx, x, y, size, exploded, kind) {
      var pad = size * 0.08;
      if (kind === 'avocado') drawAvocadoB(ctx, x + pad, y + pad, size - pad * 2);
      else if (kind === 'nacho' || kind === 'chip') drawChipB(ctx, x + pad, y + pad, size - pad * 2);
      else drawBurritoB(ctx, x + pad, y + pad, size - pad * 2);
      if (exploded) {
        ctx.save();
        ctx.strokeStyle = this.colors.danger;
        ctx.lineWidth = size * 0.05;
        ctx.lineCap = 'round';
        var cx = x + size / 2, cy = y + size / 2, r = size * 0.38;
        for (var a = 0; a < 8; a++) {
          var ang = (a / 8) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(ang) * r * 0.6, cy + Math.sin(ang) * r * 0.6);
          ctx.lineTo(cx + Math.cos(ang) * r * 1.15, cy + Math.sin(ang) * r * 1.15);
          ctx.stroke();
        }
        ctx.restore();
      }
    },

    drawHudIcon: function (ctx, kind, x, y, size) {
      ctx.save();
      ctx.translate(x, y);
      ctx.strokeStyle = this.colors.hudText;
      ctx.fillStyle = this.colors.hudText;
      ctx.lineWidth = Math.max(2, size * 0.1);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (kind === 'restart') {
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size * 0.28, 0.35, Math.PI * 1.75);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(size * 0.72, size * 0.22);
        ctx.lineTo(size * 0.72, size * 0.42);
        ctx.lineTo(size * 0.52, size * 0.38);
        ctx.fill();
      } else if (kind === 'fit') {
        var m = size * 0.22, L = size * 0.22;
        [[m, m, 1, 1], [size - m, m, -1, 1], [m, size - m, 1, -1], [size - m, size - m, -1, -1]].forEach(function (p) {
          ctx.beginPath();
          ctx.moveTo(p[0], p[1] + p[3] * L);
          ctx.lineTo(p[0], p[1]);
          ctx.lineTo(p[0] + p[2] * L, p[1]);
          ctx.stroke();
        });
        roundRect(ctx, size * 0.38, size * 0.38, size * 0.24, size * 0.24, 2);
        ctx.globalAlpha = 0.5; ctx.fill(); ctx.globalAlpha = 1;
      } else if (kind === 'mute' || kind === 'unmute') {
        ctx.beginPath();
        ctx.moveTo(size * 0.18, size * 0.38);
        ctx.lineTo(size * 0.38, size * 0.38);
        ctx.lineTo(size * 0.58, size * 0.22);
        ctx.lineTo(size * 0.58, size * 0.78);
        ctx.lineTo(size * 0.38, size * 0.62);
        ctx.lineTo(size * 0.18, size * 0.62);
        ctx.closePath();
        ctx.fill();
        if (kind === 'mute') {
          ctx.beginPath();
          ctx.moveTo(size * 0.68, size * 0.32);
          ctx.lineTo(size * 0.88, size * 0.68);
          ctx.moveTo(size * 0.88, size * 0.32);
          ctx.lineTo(size * 0.68, size * 0.68);
          ctx.stroke();
        }
      } else if (kind === 'help') {
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size * 0.34, 0, Math.PI * 2);
        ctx.stroke();
        ctx.font = '700 ' + Math.floor(size * 0.48) + 'px ' + this.fontFamily;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', size / 2, size / 2 + 1);
      } else if (kind === 'clock') {
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size * 0.32, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(size / 2, size * 0.32);
        ctx.lineTo(size / 2, size / 2);
        ctx.lineTo(size * 0.68, size * 0.58);
        ctx.stroke();
      }
      ctx.restore();
    },

    /** Soft confetti dots for win (calm). */
    drawWinFx: function (ctx, w, h, t) {
      var cols = ['#4DAE9F', '#F6B23A', '#F6C7A8', '#2F6FDE', '#1F9A63'];
      for (var i = 0; i < 28; i++) {
        var px = ((i * 97) % 100) / 100 * w;
        var py = (((i * 53 + t * 40) % 120) / 120) * h;
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = cols[i % cols.length];
        ctx.beginPath();
        ctx.arc(px, py, 3 + (i % 3), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    },

    /** Soft salsa burst for loss. */
    drawLossFx: function (ctx, w, h, t) {
      var cx = w / 2, cy = h / 2;
      ctx.globalAlpha = 0.35 * (1 - Math.min(1, t));
      ctx.fillStyle = '#E24B36';
      for (var i = 0; i < 12; i++) {
        var ang = (i / 12) * Math.PI * 2 + t;
        var dist = 20 + t * 80;
        ctx.beginPath();
        ell(ctx, cx + Math.cos(ang) * dist, cy + Math.sin(ang) * dist, 10, 6, ang);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  };

  // Keep minimal placeholder for tests / fallback
  var placeholder = Object.assign({}, flatCalm, { id: 'placeholder', name: 'Neutral Placeholder' });

  var Themes = {
    'flat-calm': flatCalm,
    placeholder: placeholder,
    current: flatCalm,
    set: function (id) {
      if (this[id]) this.current = this[id];
      return this.current;
    },
    register: function (theme) { this[theme.id] = theme; },
    zoomBucket: function (zoom, dpr) {
      var z = zoom * (dpr || 1);
      return Math.round(z * 4) / 4;
    }
  };

  root.SweeperTheme = Themes;
  if (typeof module !== 'undefined' && module.exports) module.exports = Themes;
})(typeof window !== 'undefined' ? window : globalThis);
