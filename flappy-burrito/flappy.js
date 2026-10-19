/* Flappy Burrito — pixel-faithful Flappy Bird clone at 144x256 logical resolution. */
(function () {
  'use strict';
  var LW = 144, LH = 256, GROUND_Y = 200;
  var cv = document.getElementById('c'), ctx = cv.getContext('2d');
  var off = document.createElement('canvas'); off.width = LW; off.height = LH;
  var g = off.getContext('2d');

  function fitCanvas() {
    var vw = window.innerWidth, vh = window.innerHeight, dpr = window.devicePixelRatio || 1;
    // integer scale in device pixels when it fills >= 88% of the screen, else fractional fit (letterboxed)
    var fit = Math.min(vw * dpr / LW, vh * dpr / LH), scale = Math.floor(fit);
    if (scale < 1 || scale / fit < 0.88) scale = fit;
    cv.width = Math.round(LW * scale); cv.height = Math.round(LH * scale);
    cv.style.width = cv.width / dpr + 'px'; cv.style.height = cv.height / dpr + 'px';
    ctx.imageSmoothingEnabled = false;
  }

  /* ---------- pixel helpers ---------- */
  function px(x, y, w, h, c) { g.fillStyle = c; g.fillRect(x | 0, y | 0, w, h); }
  function sprite(rows, pal) {
    var c = document.createElement('canvas'); c.width = rows[0].length; c.height = rows.length;
    var x2 = c.getContext('2d');
    rows.forEach(function (r, y) { for (var x = 0; x < r.length; x++) if (pal[r[x]]) { x2.fillStyle = pal[r[x]]; x2.fillRect(x, y, 1, 1); } });
    return c;
  }
  // Burrito bird: 17x12. k=outline, t=tortilla, s=shade, h=highlight, r=salsa, g=lettuce, w=eye white, e=pupil, f=flap
  var PAL = { k: '#3a2410', t: '#f2cf86', s: '#c8964a', h: '#fff1c8', r: '#d8321e', g: '#5cbf2a', c: '#fff7dd', w: '#fff', e: '#000', f: '#e3b462', F: '#b07a30', o: '#f08020' };
  var BODY = [
    '....kkkkkkkk.....',
    '..kkhhhhtttkkk...',
    '.khhttttttwwwk...',
    'kkttstttttwwekk..',
    'krgtttsttttwekrk.',
    'kgrcttttsttttkgrk',
    'krgrtttttsttttkrk',
    'kgrtsttttttssskgk',
    '.kkttttstttssskk.',
    '..kkssssssssskk..',
    '....kkkkkkkkk....',
    '.................'];
  var WINGS = [
    ['.kkkk.', 'kffffk', 'kfFFFk', '.kkkk.'],   // mid
    ['kkkk..', 'kffFkk', '.kfffk', '..kkk.'],   // up
    ['.kkkk.', 'kfFFfk', 'kffkk.', '.kk...']];  // down
  var birdBody = sprite(BODY, PAL), wingSp = WINGS.map(function (w) { return sprite(w, PAL); });

  // 5x7 pixel digits + a few letters for banners
  var FONT = {
    '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'], '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
    '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'], '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
    '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'], '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
    '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'], '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
    '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'], '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
    'A': ['01110', '10001', '10001', '11111', '10001', '10001', '10001'], 'B': ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
    'D': ['11110', '10001', '10001', '10001', '10001', '10001', '11110'], 'E': ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
    'F': ['11111', '10000', '10000', '11110', '10000', '10000', '10000'], 'G': ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
    'I': ['01110', '00100', '00100', '00100', '00100', '00100', '01110'], 'K': ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
    'L': ['10000', '10000', '10000', '10000', '10000', '10000', '11111'], 'M': ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
    'N': ['10001', '11001', '10101', '10011', '10001', '10001', '10001'], 'O': ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
    'P': ['11110', '10001', '10001', '11110', '10000', '10000', '10000'], 'R': ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
    'S': ['01111', '10000', '10000', '01110', '00001', '00001', '11110'], 'T': ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
    'U': ['10001', '10001', '10001', '10001', '10001', '10001', '01110'], 'V': ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
    'W': ['10001', '10001', '10001', '10101', '10101', '11011', '10001'], 'Y': ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
    'C': ['01110', '10001', '10000', '10000', '10000', '10001', '01110'], 'H': ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
    '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'], ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000']
  };
  // draw pixel text with a 1px outline; s = pixel size
  function ptext(str, x, y, s, fill, outline, align) {
    str = String(str).toUpperCase(); var cw = 6 * s, w = str.length * cw - s;
    if (align === 'center') x -= Math.floor(w / 2); else if (align === 'right') x -= w;
    for (var pass = 0; pass < 2; pass++) for (var i = 0; i < str.length; i++) {
      var gl = FONT[str[i]] || FONT[' '];
      for (var r = 0; r < 7; r++) for (var c = 0; c < 5; c++) if (gl[r][c] === '1') {
        var X = x + i * cw + c * s, Y = y + r * s;
        if (pass === 0) px(X - 1, Y - 1, s + 2, s + 2, outline); else px(X, Y, s, s, fill);
      }
    }
    return w;
  }

  /* ---------- static background ---------- */
  var bgC = document.createElement('canvas'); bgC.width = LW; bgC.height = LH;
  (function () {
    var b = bgC.getContext('2d'); function r(x, y, w, h, c) { b.fillStyle = c; b.fillRect(x, y, w, h); }
    r(0, 0, LW, LH, '#4ec0ca');
    // clouds
    for (var x = -4; x < LW; x += 11) { var h = 6 + ((x * 7) % 9); r(x, 150 - h, 14, h + 40, '#e9fcd9'); }
    r(0, 150, LW, 50, '#e9fcd9');
    for (x = -4; x < LW; x += 11) { r(x + 2, 148 - (6 + ((x * 7) % 9)), 10, 2, '#fff'); }
    // city skyline
    var bx = 0, hs = [18, 26, 14, 30, 22, 12, 28, 20, 16, 24];
    for (var i = 0; bx < LW; i++) {
      var w = 12 + (i % 3) * 4, hh = hs[i % hs.length];
      r(bx, 170 - hh, w, hh + 30, '#d7f1d0'); r(bx, 170 - hh, w, 1, '#a9d8b8'); r(bx, 170 - hh, 1, hh, '#a9d8b8');
      for (var wy = 173 - hh; wy < 168; wy += 4) for (var wx = bx + 2; wx < bx + w - 2; wx += 3) r(wx, wy, 1, 2, '#a9d8b8');
      bx += w + 1;
    }
    // bushes
    for (x = -6; x < LW; x += 9) { var bh = 6 + ((x * 5) % 7); r(x, 186 - bh, 12, bh + 20, '#5ee270'); r(x + 2, 186 - bh - 1, 8, 1, '#5ee270'); r(x + 1, 186 - bh, 2, 2, '#82f08f'); }
    r(0, 186, LW, 14, '#5ee270'); r(0, 192, LW, 8, '#43c94f');
  })();

  function drawGround(offset) {
    px(0, GROUND_Y, LW, 1, '#543847'); px(0, GROUND_Y + 1, LW, 1, '#73bf2e'); px(0, GROUND_Y + 2, LW, 6, '#9be659');
    px(0, GROUND_Y + 8, LW, 1, '#558022'); px(0, GROUND_Y + 9, LW, 2, '#d7a84c');
    for (var x = -12; x < LW + 12; x += 12) {
      var sx = x - (offset % 12);
      for (var k = 0; k < 6; k++) px(sx + k, GROUND_Y + 2 + k, 6, 1, '#73bf2e');
    }
    px(0, GROUND_Y + 11, LW, LH - GROUND_Y - 11, '#ded895');
    px(0, GROUND_Y + 11, LW, 1, '#d7a84c');
  }

  /* ---------- pipes (classic green w/ salsa drip on the lip) ---------- */
  var PIPE_W = 26, GAP = 50, PIPE_SPACING = 78, SPEED = 1;
  function drawPipeBody(x, y, h) {
    if (h <= 0) return;
    px(x + 1, y, PIPE_W - 2, h, '#73bf2e');
    px(x + 1, y, 1, h, '#543847'); px(x + PIPE_W - 2, y, 1, h, '#543847');
    px(x + 2, y, 2, h, '#9ce659'); px(x + 5, y, 2, h, '#d7f58a'); px(x + 17, y, 3, h, '#558022'); px(x + 20, y, 3, h, '#3e6b18');
  }
  function drawLip(x, y, drip) {
    px(x, y, PIPE_W, 12, '#543847');
    px(x + 1, y + 1, PIPE_W - 2, 10, '#73bf2e'); px(x + 2, y + 1, 2, 10, '#9ce659'); px(x + 5, y + 1, 2, 10, '#d7f58a');
    px(x + 18, y + 1, 3, 10, '#558022'); px(x + 21, y + 1, 3, 10, '#3e6b18');
    // salsa twist: red band + drips
    px(x + 1, y + 1, PIPE_W - 2, 2, '#d8321e'); px(x + 1, y + 3, PIPE_W - 2, 1, '#9a1c10');
    if (drip) { px(x + 8, y + 4, 2, 3, '#d8321e'); px(x + 8, y + 7, 2, 1, '#9a1c10'); px(x + 15, y + 4, 2, 2, '#d8321e'); }
  }
  function drawPipe(p) {
    var x = Math.round(p.x);
    drawPipeBody(x + 1, 0, p.gapY - 12); drawLip(x - 0, p.gapY - 12, false);
    drawLip(x, p.gapY + GAP, true); drawPipeBody(x + 1, p.gapY + GAP + 12, GROUND_Y - (p.gapY + GAP + 12));
  }

  /* ---------- medals ---------- */
  function drawMedal(x, y, kind) {
    var cols = { bronze: ['#c97c3a', '#8a4e1e', '#f0b07a'], silver: ['#d7d7d7', '#8c8c8c', '#ffffff'], gold: ['#f2c12e', '#a87c0c', '#fff1a0'], platinum: ['#e6f2f2', '#9fb5b5', '#ffffff'] }[kind];
    for (var dy = -11; dy <= 11; dy++) { var w = Math.round(Math.sqrt(121 - dy * dy)); px(x - w, y + dy, w * 2, 1, cols[1]); }
    for (dy = -10; dy <= 10; dy++) { w = Math.round(Math.sqrt(100 - dy * dy)); px(x - w, y + dy, w * 2, 1, cols[0]); }
    px(x - 6, y - 7, 3, 2, cols[2]); px(x - 7, y - 5, 2, 3, cols[2]);
    // tiny burrito emblem
    g.save(); g.translate(x - 8, y - 6); g.drawImage(birdBody, 0, 0); g.restore();
  }
  function medalFor(s) { return s >= 40 ? 'platinum' : s >= 30 ? 'gold' : s >= 20 ? 'silver' : s >= 10 ? 'bronze' : null; }

  /* ---------- audio ---------- */
  var actx = null, muted = localStorage.getItem('fb-muted') === '1', muteBtn = document.getElementById('mute');
  muteBtn.textContent = muted ? '🔇' : '🔊';
  function stop(e) { e.stopPropagation(); }
  ['pointerdown', 'touchstart', 'mousedown'].forEach(function (n) { muteBtn.addEventListener(n, stop); document.getElementById('home').addEventListener(n, stop); });
  muteBtn.addEventListener('click', function (e) { e.stopPropagation(); muted = !muted; localStorage.setItem('fb-muted', muted ? '1' : '0'); muteBtn.textContent = muted ? '🔇' : '🔊'; muteBtn.blur(); });
  function ac() { if (!actx) try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } if (actx && actx.state === 'suspended') actx.resume(); return actx; }
  function tone(f0, f1, d, v, type, delay) {
    if (muted) return; var a = ac(); if (!a) return; var t = a.currentTime + (delay || 0);
    var o = a.createOscillator(), gn = a.createGain(); o.type = type || 'square';
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + d);
    gn.gain.setValueAtTime(v, t); gn.gain.exponentialRampToValueAtTime(0.001, t + d); o.connect(gn); gn.connect(a.destination); o.start(t); o.stop(t + d);
  }
  var sfx = {
    wing: function () { tone(500, 900, 0.07, 0.08, 'triangle'); },
    point: function () { tone(988, 988, 0.08, 0.1); tone(1319, 1319, 0.2, 0.1, 'square', 0.08); },
    hit: function () { tone(200, 60, 0.15, 0.3, 'sawtooth'); },
    die: function () { tone(500, 100, 0.5, 0.15, 'square', 0.15); },
    swoosh: function () { tone(300, 1200, 0.15, 0.05, 'sine'); }
  };
  function buzz(ms) { if (navigator.vibrate) try { navigator.vibrate(ms); } catch (e) { } }

  /* ---------- game state ---------- */
  // Additive tap impulse (old: set vy = -3.9 per flap). Each tap adds TAP (~45% of old) to vy,
  // after softening any fall to FALL_SOFT so taps bite while dropping; upward speed capped at UP_CAP.
  var GRAV = 0.25, TAP = -1.75, FALL_SOFT = 1.5, UP_CAP = -3.4, MAXV = 8, FLAP = TAP;
  var state, bird, pipes, score, best = +localStorage.getItem('fb-best') || 0, groundOff = 0, frame = 0, flash = 0, overT = 0, isNewBest = false;
  function reset() {
    state = 'ready'; score = 0; pipes = []; frame = 0; overT = 0; isNewBest = false;
    bird = { x: 38, y: 118, vy: 0, rot: 0, flapT: 0 };
  }
  function spawnPipe(x) { pipes.push({ x: x, gapY: 30 + Math.floor(Math.random() * (GROUND_Y - GAP - 70)), scored: false }); }
  function flap() {
    if (state === 'ready') { state = 'play'; try { window.BurritoPlay && window.BurritoPlay('flappy-burrito'); } catch (e) {} spawnPipe(LW + 40); spawnPipe(LW + 40 + PIPE_SPACING); }
    if (state === 'play') { bird.vy = Math.max(UP_CAP, Math.min(bird.vy, FALL_SOFT) + TAP); sfx.wing(); }
  }
  function die() {
    if (state === 'dead' || state === 'over') return;
    state = 'dead'; flash = 6; sfx.hit(); buzz(120);
    setTimeout(function () { sfx.die(); }, 50);
    if (score > best) { best = score; isNewBest = true; localStorage.setItem('fb-best', best); }
  }
  var OK = { x: 72 - 20, y: 168, w: 40, h: 14 };
  function input(lx, ly) {
    ac();
    if (state === 'over') {
      if (overT > 30 && (lx == null || (lx >= OK.x - 4 && lx <= OK.x + OK.w + 4 && ly >= OK.y - 4 && ly <= OK.y + OK.h + 4))) { sfx.swoosh(); reset(); }
      return;
    }
    if (state === 'dead') return;
    flap();
  }
  function toLogical(e) { var r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * LW, (e.clientY - r.top) / r.height * LH]; }
  document.addEventListener('pointerdown', function (e) { if (e.button > 0) return; e.preventDefault(); var p = toLogical(e); input(p[0], p[1]); }, { passive: false });
  document.addEventListener('keydown', function (e) { if (e.code === 'Space' || e.code === 'ArrowUp' || e.key === 'Enter') { e.preventDefault(); if (!e.repeat) input(null, null); } });
  document.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
  document.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  /* ---------- fixed-step update (60 Hz like the original) ---------- */
  function step() {
    frame++;
    if (state === 'ready' || state === 'play') groundOff += SPEED;
    if (state === 'ready') { bird.y = 118 + Math.sin(frame / 8) * 3; bird.flapT++; bird.rot = 0; return; }
    if (state === 'over') { overT++; return; }
    // play or dead: physics
    bird.vy = Math.min(MAXV, bird.vy + GRAV); bird.y += bird.vy;
    if (bird.vy < 0) bird.rot = -25; else if (bird.vy > 2.5) bird.rot = Math.min(90, bird.rot + 4.5);
    if (state === 'play') {
      bird.flapT++;
      pipes.forEach(function (p) {
        p.x -= SPEED;
        if (!p.scored && p.x + PIPE_W < bird.x) { p.scored = true; score++; sfx.point(); }
      });
      if (pipes.length && pipes[0].x < -PIPE_W - 4) pipes.shift();
      var lastP = pipes[pipes.length - 1]; if (lastP && lastP.x <= LW + 40) spawnPipe(lastP.x + PIPE_SPACING);
      // collisions (hitbox slightly smaller than sprite, like the original)
      var bx0 = bird.x - 7, bx1 = bird.x + 7, by0 = bird.y - 4, by1 = bird.y + 4;
      if (by0 < -20) { bird.y = -15; }
      pipes.forEach(function (p) {
        if (bx1 > p.x && bx0 < p.x + PIPE_W && (by0 < p.gapY || by1 > p.gapY + GAP)) die();
      });
    }
    if (bird.y + 5 >= GROUND_Y) { bird.y = GROUND_Y - 5; if (state === 'play') die(); bird.vy = 0; if (state === 'dead') { state = 'over'; overT = 0; } }
    if (flash > 0) flash--;
  }

  /* ---------- render ---------- */
  function drawBird() {
    var wi = state === 'dead' || state === 'over' ? 0 : [0, 1, 0, 2][Math.floor(bird.flapT / 5) % 4];
    g.save(); g.translate(Math.round(bird.x), Math.round(bird.y)); g.rotate(bird.rot * Math.PI / 180);
    g.drawImage(birdBody, -9, -6); g.drawImage(wingSp[wi], -6, -1 + (wi === 1 ? -2 : wi === 2 ? 1 : 0));
    g.restore();
  }
  function panel(x, y, w, h) {
    px(x, y, w, h, '#543847'); px(x + 1, y + 1, w - 2, h - 2, '#ded895'); px(x + 2, y + 2, w - 4, h - 4, '#d4a64a'); px(x + 3, y + 3, w - 6, h - 6, '#ded895');
  }
  function render() {
    g.drawImage(bgC, 0, 0);
    pipes.forEach(drawPipe);
    drawGround(groundOff);
    drawBird();
    if (state === 'play' || state === 'dead') ptext(score, 72, 20, 3, '#fff', '#000', 'center');
    if (state === 'ready') {
      ptext('GET READY!', 72, 52, 2, '#f0a020', '#fff', 'center');
      // tap hint (hand + arrow), classic style
      var hx = 96, hy = 112;
      px(hx - 1, hy - 18, 3, 8, '#fff'); px(hx - 3, hy - 16, 7, 2, '#fff'); px(hx - 2, hy - 17, 5, 1, '#fff');
      px(hx - 6, hy, 12, 14, '#fff'); px(hx - 2, hy - 8, 4, 10, '#fff'); px(hx - 5, hy + 1, 10, 12, '#f2b98a'); px(hx - 1, hy - 7, 2, 9, '#f2b98a');
      ptext('TAP', hx, hy + 20, 1, '#f04020', '#fff', 'center');
      ptext('FLAPPY BURRITO', 72, 24, 1, '#fff', '#543847', 'center');
    }
    if (state === 'over') {
      var t = Math.min(1, overT / 20), by = Math.round(40 - (1 - t) * 10);
      ptext('GAME OVER', 72, by, 2, '#f0a020', '#fff', 'center');
      var py = Math.round(76 + Math.max(0, 1 - overT / 25) * 120);
      panel(16, py, 112, 58);
      ptext('MEDAL', 24, py + 7, 1, '#e86030', '#ded895');
      ptext('SCORE', 120, py + 7, 1, '#e86030', '#ded895', 'right');
      var shown = overT > 25 ? Math.min(score, Math.floor((overT - 25) / 2)) : 0;
      ptext(shown, 120, py + 17, 2, '#fff', '#000', 'right');
      ptext('BEST', 120, py + 34, 1, '#e86030', '#ded895', 'right');
      ptext(best, 120, py + 43, 2, '#fff', '#000', 'right');
      if (isNewBest && overT > 40) { px(70, py + 34, 18, 7, '#e8381e'); ptext('NEW', 79, py + 34, 1, '#fff', '#e8381e', 'center'); }
      var m = medalFor(score); if (m && overT > 40) drawMedal(36, py + 34, m);
      else { for (var dy = -10; dy <= 10; dy++) { var w = Math.round(Math.sqrt(100 - dy * dy)); px(36 - w, py + 34 + dy, w * 2, 1, '#cfc07a'); } }
      if (overT > 30) {
        px(OK.x, OK.y, OK.w, OK.h, '#543847'); px(OK.x + 1, OK.y + 1, OK.w - 2, OK.h - 2, '#fff'); px(OK.x + 2, OK.y + 2, OK.w - 4, OK.h - 5, '#e86030');
        ptext('OK', 72, OK.y + 3, 1, '#fff', '#543847', 'center');
      }
    }
    if (flash > 0) { g.fillStyle = 'rgba(255,255,255,' + flash / 6 + ')'; g.fillRect(0, 0, LW, LH); }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0, cv.width, cv.height);
  }

  var acc = 0, last = performance.now(), STEP = 1000 / 60;
  function loop(t) {
    acc += Math.min(250, t - last); last = t;
    while (acc >= STEP) { step(); acc -= STEP; }
    render(); requestAnimationFrame(loop);
  }
  window.addEventListener('resize', fitCanvas);
  fitCanvas(); reset(); requestAnimationFrame(loop);

  window.FlappyBurrito = {
    get state() { return { state: state, score: score, best: best, y: bird.y, pipes: pipes.length }; },
    get pipes() { return pipes; }, get bird() { return bird; }, input: input, step: step, render: render, consts: { GAP: GAP, PIPE_W: PIPE_W }
  };
})();
