/* Burrito Ninja — a Fruit Ninja-style slicer. */
(function () {
  'use strict';
  var cv = document.getElementById('c'), ctx = cv.getContext('2d');
  var W = 0, H = 0, DPR = 1, S = 1; // S = item scale relative to a 390px-wide phone
  var bg = document.createElement('canvas'), stain = document.createElement('canvas');
  var TAU = Math.PI * 2, rand = function (a, b) { return a + Math.random() * (b - a); };

  /* ---------- sprites ---------- */
  var TYPES = {
    burrito: { r: 46, juice: ['#c0281c', '#e8a33d', '#fff3d6'], draw: function (g, r) {
      g.rotate(-0.5); rr(g, -r, -r * .5, r * 2, r, r * .5, '#e9c27a', '#7a5320');
      g.strokeStyle = '#c89548'; g.lineWidth = 3; for (var i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(i * r * .5, -r * .5); g.quadraticCurveTo(i * r * .5 + 8, 0, i * r * .5, r * .5); g.stroke(); }
      ell(g, r * .95, 0, r * .25, r * .48, '#6b3d1e'); dot(g, r * .92, -r * .18, 6, '#3fa34d'); dot(g, r, r * .15, 6, '#d33'); dot(g, r * .85, r * .05, 5, '#fff3c4'); } },
    taco: { r: 42, juice: ['#e8a33d', '#3fa34d', '#c0281c'], draw: function (g, r) {
      g.beginPath(); g.arc(0, r * .2, r, Math.PI, 0); g.closePath(); g.fillStyle = '#3fa34d'; g.fill();
      for (var i = 0; i < 5; i++) dot(g, -r * .7 + i * r * .35, -r * .55 + Math.sin(i) * 4, 7, i % 2 ? '#d33' : '#ffd84a');
      g.beginPath(); g.arc(0, r * .35, r * .95, Math.PI * 1.05, -Math.PI * .05); g.lineTo(r * .8, r * .35); g.arc(0, r * .35, r * .95, -0.0, Math.PI, false); g.closePath();
      g.beginPath(); g.moveTo(-r, r * .3); g.quadraticCurveTo(0, -r * 1.4, r, r * .3); g.quadraticCurveTo(0, r * .7, -r, r * .3); g.fillStyle = '#f1c04d'; g.fill(); g.strokeStyle = '#a8761c'; g.lineWidth = 3; g.stroke(); } },
    avocado: { r: 40, juice: ['#9bd04a', '#6aa82e', '#d8ef9a'], draw: function (g, r) {
      g.beginPath(); g.ellipse(0, r * .1, r * .8, r, 0, 0, TAU); g.fillStyle = '#2f4a1a'; g.fill();
      g.beginPath(); g.ellipse(0, r * .15, r * .65, r * .85, 0, 0, TAU); g.fillStyle = '#c8e27a'; g.fill();
      dot(g, 0, r * .3, r * .35, '#7a4a22'); dot(g, -r * .1, r * .2, r * .1, '#a06a3a'); } },
    lime: { r: 34, juice: ['#a8e04a', '#e8ff9a', '#6fbf2a'], draw: function (g, r) {
      g.beginPath(); g.ellipse(0, 0, r * 1.1, r, 0, 0, TAU); g.fillStyle = '#4c9a1e'; g.fill(); g.strokeStyle = '#2e6a10'; g.lineWidth = 3; g.stroke();
      dot(g, -r * .35, -r * .35, r * .22, 'rgba(255,255,255,.35)'); } },
    jalapeno: { r: 38, juice: ['#5fbf2a', '#e8ff9a', '#2e8a10'], draw: function (g, r) {
      g.rotate(0.6); g.beginPath(); g.moveTo(-r * .9, -r * .2); g.quadraticCurveTo(0, -r * .55, r * .9, -r * .05); g.quadraticCurveTo(r * .4, r * .45, -r * .9, r * .2); g.closePath();
      g.fillStyle = '#2f8a1a'; g.fill(); g.strokeStyle = '#185a0a'; g.lineWidth = 3; g.stroke();
      g.fillStyle = '#6b4a1a'; g.fillRect(-r * 1.15, -r * .12, r * .3, r * .22); dot(g, 0, -r * .2, 5, 'rgba(255,255,255,.4)'); } },
    chip: { r: 32, juice: ['#f1c04d', '#fff3d6', '#c0281c'], draw: function (g, r) {
      g.beginPath(); g.moveTo(0, -r); g.lineTo(r * .95, r * .75); g.lineTo(-r * .95, r * .75); g.closePath();
      g.fillStyle = '#f1c04d'; g.fill(); g.strokeStyle = '#b8841c'; g.lineWidth = 3; g.lineJoin = 'round'; g.stroke();
      for (var i = 0; i < 5; i++) dot(g, rand(-r * .4, r * .4), rand(-r * .1, r * .5), 2.5, '#c89548'); } },
    bomb: { r: 40, juice: ['#fff', '#ff8a00'], draw: function (g, r) {
      g.beginPath(); g.moveTo(0, -r * .7); g.bezierCurveTo(r * 1.1, -r * .6, r * .7, r * .9, 0, r * 1.05); g.bezierCurveTo(-r * .7, r * .9, -r * 1.1, -r * .6, 0, -r * .7);
      var gr = g.createRadialGradient(-r * .3, -r * .2, 4, 0, 0, r); gr.addColorStop(0, '#ff4a2a'); gr.addColorStop(1, '#5a0000'); g.fillStyle = gr; g.fill();
      g.strokeStyle = '#200'; g.lineWidth = 3; g.stroke();
      g.fillStyle = '#1e5a12'; g.fillRect(-6, -r * .95, 12, r * .3);
      g.fillStyle = '#000'; g.font = 'bold ' + (r * .55) + 'px sans-serif'; g.textAlign = 'center'; g.fillText('☠', 0, r * .45); } }
  };
  var FOODS = ['burrito', 'burrito', 'taco', 'avocado', 'lime', 'jalapeno', 'chip'];
  function rr(g, x, y, w, h, r, f, s) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); g.fillStyle = f; g.fill(); g.strokeStyle = s; g.lineWidth = 3; g.stroke(); }
  function ell(g, x, y, a, b, f) { g.beginPath(); g.ellipse(x, y, a, b, 0, 0, TAU); g.fillStyle = f; g.fill(); }
  function dot(g, x, y, r, f) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = f; g.fill(); }
  var sprites = {};
  function buildSprites() {
    Object.keys(TYPES).forEach(function (k) {
      var t = TYPES[k], r = t.r * S, size = Math.ceil(r * 2.8 * DPR), c = document.createElement('canvas');
      c.width = c.height = size; var g = c.getContext('2d');
      g.scale(DPR, DPR); g.translate(size / DPR / 2, size / DPR / 2); g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 8 * S; g.shadowOffsetY = 4 * S;
      t.draw(g, r); sprites[k] = { c: c, half: size / DPR / 2 };
    });
  }

  /* ---------- background (wooden dojo planks) ---------- */
  function buildBg() {
    bg.width = stain.width = W * DPR; bg.height = stain.height = H * DPR;
    var g = bg.getContext('2d'); g.scale(DPR, DPR);
    var pw = Math.max(70, W / 5);
    for (var x = 0; x < W; x += pw) {
      var l = 18 + Math.random() * 8; g.fillStyle = 'hsl(24,45%,' + l + '%)'; g.fillRect(x, 0, pw, H);
      g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 1.5;
      for (var i = 0; i < 14; i++) { var gx = x + rand(6, pw - 6); g.beginPath(); g.moveTo(gx, 0); for (var y = 0; y <= H; y += 40) g.lineTo(gx + Math.sin(y / 90 + i) * 5, y); g.stroke(); }
      for (i = 0; i < 2; i++) { var kx = x + rand(15, pw - 15), ky = rand(0, H); g.beginPath(); g.ellipse(kx, ky, 7, 12, 0, 0, TAU); g.fillStyle = 'rgba(40,15,0,.5)'; g.fill(); }
      g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(x, 0, 3, H); g.fillStyle = 'rgba(255,220,170,.08)'; g.fillRect(x + 3, 0, 2, H);
    }
    var v = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .3, W / 2, H / 2, Math.max(W, H) * .75);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.6)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
  }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 3);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = W * DPR; cv.height = H * DPR;
    S = Math.max(0.8, Math.min(1.6, Math.min(W, H * 0.6) / 390));
    buildBg(); buildSprites(); splats.length = 0;
  }

  /* ---------- audio ---------- */
  var actx = null, muted = localStorage.getItem('bn-muted') === '1';
  var muteBtn = document.getElementById('mute');
  muteBtn.textContent = muted ? '🔇' : '🔊';
  muteBtn.addEventListener('click', function (e) { e.stopPropagation(); muted = !muted; localStorage.setItem('bn-muted', muted ? '1' : '0'); muteBtn.textContent = muted ? '🔇' : '🔊'; });
  ['pointerdown', 'touchstart'].forEach(function (ev) { muteBtn.addEventListener(ev, function (e) { e.stopPropagation(); }); });
  function audio() { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } } if (actx && actx.state === 'suspended') actx.resume(); return actx; }
  function noise(dur, f0, f1, vol, type) {
    if (muted) return; var a = audio(); if (!a) return;
    var n = a.sampleRate * dur, b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var s = a.createBufferSource(); s.buffer = b; var f = a.createBiquadFilter(); f.type = type || 'bandpass';
    f.frequency.setValueAtTime(f0, a.currentTime); f.frequency.exponentialRampToValueAtTime(f1, a.currentTime + dur);
    var gn = a.createGain(); gn.gain.value = vol; s.connect(f); f.connect(gn); gn.connect(a.destination); s.start();
  }
  function tone(f0, f1, dur, vol, type) {
    if (muted) return; var a = audio(); if (!a) return;
    var o = a.createOscillator(), g = a.createGain(); o.type = type || 'sine';
    o.frequency.setValueAtTime(f0, a.currentTime); o.frequency.exponentialRampToValueAtTime(f1, a.currentTime + dur);
    g.gain.setValueAtTime(vol, a.currentTime); g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
    o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime + dur);
  }
  var sfx = {
    swoosh: function () { noise(0.18, 600, 3000, 0.25); },
    splat: function () { noise(0.25, 1200, 200, 0.5, 'lowpass'); tone(300, 80, 0.15, 0.3); },
    boom: function () { noise(0.9, 800, 40, 1, 'lowpass'); tone(120, 30, 0.8, 0.6, 'sawtooth'); },
    combo: function () { tone(660, 990, 0.25, 0.2, 'triangle'); },
    miss: function () { tone(220, 110, 0.3, 0.25, 'square'); }
  };
  function buzz(ms) { if (navigator.vibrate) try { navigator.vibrate(ms); } catch (e) { } }

  /* ---------- state ---------- */
  var items = [], halves = [], splats = [], particles = [], popups = [], trail = [];
  var mode = 'menu', score = 0, strikes = 0, timeLeft = 0, spawnT = 0, wave = 0, flash = 0, shake = 0;
  var best = { classic: +localStorage.getItem('bn-best-classic') || 0, arcade: +localStorage.getItem('bn-best-arcade') || 0 };
  var lastMode = 'classic', newBest = false, overT = 0, G = 0;

  function makeItem(type, x, y, vx, vy, extra) {
    var it = { type: type, x: x, y: y, vx: vx, vy: vy, a: rand(0, TAU), va: rand(-3, 3), r: TYPES[type].r * S, alive: true };
    for (var k in extra) it[k] = extra[k];
    items.push(it); return it;
  }
  function toss(type) {
    var x = rand(W * .15, W * .85), tx = rand(W * .25, W * .75);
    var peak = rand(H * .12, H * .4), h = H + 60 * S - peak, vy = -Math.sqrt(2 * G * h), t = -vy / G;
    makeItem(type, x, H + 60 * S, (tx - x) / t * rand(.7, 1.1), vy);
  }
  function menuItems(list) {
    items = [];
    list.forEach(function (m) { makeItem(m.type, m.x, m.y, 0, 0, { menu: m.id, label: m.label, ring: m.ring, va: 0.6, bob: rand(0, 6) }); });
  }
  function showMenu() {
    mode = 'menu'; halves = []; popups = [];
    menuItems([
      { id: 'classic', type: 'burrito', x: W * .3, y: H * .58, label: 'CLASSIC', ring: '#ffcf3a' },
      { id: 'arcade', type: 'taco', x: W * .7, y: H * .58, label: 'ARCADE', ring: '#3ad0ff' }
    ]);
  }
  function start(m) {
    lastMode = m; mode = m; score = 0; strikes = 0; timeLeft = 60; spawnT = 0.6; wave = 0; items = []; newBest = false;
    popups.push({ text: m === 'classic' ? 'GO!' : '60 SECONDS!', x: W / 2, y: H * .4, t: 1.2, size: 46, color: '#fff' });
  }
  function gameOver(reason) {
    mode = 'over'; overT = 0;
    if (score > best[lastMode]) { best[lastMode] = score; newBest = true; localStorage.setItem('bn-best-' + lastMode, score); }
    popups.push({ text: reason, x: W / 2, y: H * .2, t: 1.5, size: 34, color: '#ff5a3a' });
    setTimeout(function () {
      if (mode !== 'over') return;
      menuItems([
        { id: 'retry', type: lastMode === 'classic' ? 'burrito' : 'taco', x: W * .3, y: H * .72, label: 'RETRY', ring: '#ffcf3a' },
        { id: 'menu', type: 'avocado', x: W * .7, y: H * .72, label: 'MENU', ring: '#9be04a' }
      ]);
    }, 900);
  }

  /* ---------- slicing ---------- */
  var pointerDown = false, swipeHits = [], swipeTimer = 0, lastSwoosh = 0;
  function segCircle(ax, ay, bx, by, cx, cy, r) {
    var dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy, t = l2 ? ((cx - ax) * dx + (cy - ay) * dy) / l2 : 0;
    t = Math.max(0, Math.min(1, t)); var px = ax + t * dx - cx, py = ay + t * dy - cy; return px * px + py * py <= r * r;
  }
  function slice(it, ang) {
    it.alive = false; var t = TYPES[it.type];
    if (it.type === 'bomb') {
      sfx.boom(); buzz([80, 40, 160]); flash = 1; shake = 0.6;
      for (var i = 0; i < 40; i++) { var a = rand(0, TAU), sp = rand(100, 700) * S; particles.push({ x: it.x, y: it.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: rand(.4, .9), c: i % 2 ? '#fff' : '#ff8a00', r: rand(2, 6) * S }); }
      if (mode === 'classic') { items.forEach(function (o) { o.alive = false; }); gameOver('GHOST PEPPER!'); }
      else if (mode === 'arcade') { score = Math.max(0, score - 10); popups.push({ text: '-10', x: it.x, y: it.y, t: 1, size: 36, color: '#ff4a2a' }); }
      return;
    }
    sfx.splat(); buzz(18);
    var nx = Math.cos(ang + Math.PI / 2), ny = Math.sin(ang + Math.PI / 2), sp2 = 140 * S;
    [1, -1].forEach(function (side) {
      halves.push({ type: it.type, x: it.x, y: it.y, vx: it.vx * .6 + nx * sp2 * side, vy: Math.min(it.vy, 0) * .4 + ny * sp2 * side - 80 * S, a: it.a, va: it.va + side * 4, cut: ang - it.a, side: side, r: it.r });
    });
    var col = t.juice;
    splats.push({ x: it.x, y: it.y, r: it.r * rand(1.1, 1.6), c: col[0], c2: col[1], t: 0, seed: Math.random() * 1000, ang: ang });
    for (var j = 0; j < 22; j++) { var b = ang + (j % 2 ? 0 : Math.PI) + rand(-.9, .9), v = rand(80, 460) * S; particles.push({ x: it.x, y: it.y, vx: Math.cos(b) * v, vy: Math.sin(b) * v - 100 * S, t: rand(.4, .9), c: col[j % col.length], r: rand(2, 6) * S, g: 1 }); }
  }
  function handleMove(x, y) {
    var now = performance.now();
    var prev = trail.length ? trail[trail.length - 1] : null;
    trail.push({ x: x, y: y, t: now });
    if (!prev || now - prev.t > 120) return;
    var dx = x - prev.x, dy = y - prev.y; if (dx * dx + dy * dy < 9) return;
    if (dx * dx + dy * dy > 400 && now - lastSwoosh > 220) { sfx.swoosh(); lastSwoosh = now; }
    var ang = Math.atan2(dy, dx);
    items.forEach(function (it) {
      if (!it.alive || !segCircle(prev.x, prev.y, x, y, it.x, it.y, it.r * 0.95)) return;
      if (it.menu) {
        var id = it.menu; slice(it, ang); items.forEach(function (o) { o.alive = false; });
        setTimeout(function () { if (id === 'classic' || id === 'arcade') start(id); else if (id === 'retry') start(lastMode); else showMenu(); }, 450);
        return;
      }
      slice(it, ang);
      if (it.type !== 'bomb' && (mode === 'classic' || mode === 'arcade')) {
        var pts = 1;
        if (Math.random() < 0.08) { pts += 10; popups.push({ text: 'CRITICAL! +10', x: it.x, y: it.y - it.r, t: 1.1, size: 30, color: '#ff3a3a', crit: true }); buzz(40); }
        score += pts; swipeHits.push(it); swipeTimer = 0.25;
      }
    });
  }
  function settleCombo() {
    if (swipeHits.length >= 3) {
      var n = swipeHits.length, cx = 0, cy = 0; swipeHits.forEach(function (h) { cx += h.x; cy += h.y; });
      score += n; sfx.combo();
      popups.push({ text: n + ' Burrito Combo', sub: '+' + n, x: Math.max(110, Math.min(W - 110, cx / n)), y: Math.max(120, cy / n - 40), t: 1.3, size: 30, color: '#ffcf3a' });
    }
    swipeHits = [];
  }
  function pos(e) { return { x: e.clientX, y: e.clientY }; }
  cv.addEventListener('pointerdown', function (e) { e.preventDefault(); audio(); pointerDown = true; trail = []; var p = pos(e); handleMove(p.x, p.y); try { cv.setPointerCapture(e.pointerId); } catch (x) { } });
  cv.addEventListener('pointermove', function (e) {
    if (!pointerDown && e.pointerType !== 'mouse') return;
    if (!pointerDown) { return; }
    var list = e.getCoalescedEvents ? e.getCoalescedEvents() : [e]; if (!list.length) list = [e];
    list.forEach(function (ev) { var p = pos(ev); handleMove(p.x, p.y); });
  });
  ['pointerup', 'pointercancel'].forEach(function (n) { cv.addEventListener(n, function () { pointerDown = false; }); });
  document.addEventListener('touchmove', function (e) { if (e.target === cv) e.preventDefault(); }, { passive: false });
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
  document.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  /* ---------- update ---------- */
  function spawnWave() {
    wave++;
    var diff = Math.min(1, (mode === 'arcade' ? (60 - timeLeft) / 50 : wave / 40));
    var n = 1 + Math.floor(Math.random() * (2 + diff * 4));
    var bombChance = mode === 'arcade' ? 0.22 : 0.12 + diff * 0.15;
    for (var i = 0; i < n; i++) (function (i) { setTimeout(function () { if (mode === 'classic' || mode === 'arcade') toss(FOODS[(Math.random() * FOODS.length) | 0]); }, i * rand(60, 220)); })(i);
    if (wave > 2 && Math.random() < bombChance) setTimeout(function () { if (mode === 'classic' || mode === 'arcade') toss('bomb'); }, rand(0, 400));
    spawnT = rand(1.6, 2.4) - diff * 0.9;
  }
  function update(dt) {
    G = 900 * (H / 844);
    var playing = mode === 'classic' || mode === 'arcade';
    if (playing) {
      spawnT -= dt; if (spawnT <= 0) spawnWave();
      if (mode === 'arcade') { timeLeft -= dt; if (timeLeft <= 0) { timeLeft = 0; items.forEach(function (o) { o.alive = false; }); gameOver("TIME'S UP!"); } }
    }
    if (swipeTimer > 0) { swipeTimer -= dt; if (swipeTimer <= 0 || !pointerDown) settleCombo(); }
    var now = performance.now(); while (trail.length && now - trail[0].t > 140) trail.shift();
    items.forEach(function (it) {
      if (!it.alive) return;
      if (it.menu) { it.bob += dt; it.a += it.va * dt; it.dy = Math.sin(it.bob * 2) * 6; return; }
      it.vy += G * dt; it.x += it.vx * dt; it.y += it.vy * dt; it.a += it.va * dt;
      if (it.vy > 0 && it.y > H + it.r * 1.5) {
        it.alive = false;
        if (mode === 'classic' && it.type !== 'bomb') {
          strikes++; sfx.miss(); buzz(60);
          popups.push({ text: '✕', x: Math.max(30, Math.min(W - 30, it.x)), y: H - 40, t: 0.9, size: 44, color: '#ff2a2a' });
          if (strikes >= 3) gameOver('GAME OVER');
        }
      }
    });
    items = items.filter(function (it) { return it.alive; });
    halves.forEach(function (h) { h.vy += G * dt; h.x += h.vx * dt; h.y += h.vy * dt; h.a += h.va * dt; });
    halves = halves.filter(function (h) { return h.y < H + 150; });
    particles.forEach(function (p) { p.t -= dt; p.vy += (p.g ? G : 0) * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.98; });
    particles = particles.filter(function (p) { return p.t > 0; });
    splats.forEach(function (s) { s.t += dt; }); splats = splats.filter(function (s) { return s.t < 4; });
    popups.forEach(function (p) { p.t -= dt; p.y -= 30 * dt; }); popups = popups.filter(function (p) { return p.t > 0; });
    flash = Math.max(0, flash - dt * 1.5); shake = Math.max(0, shake - dt); if (mode === 'over') overT += dt;
  }

  /* ---------- render ---------- */
  function drawSprite(type, x, y, a, k) { var s = sprites[type]; ctx.save(); ctx.translate(x, y); ctx.rotate(a); if (k) ctx.scale(k, k); ctx.drawImage(s.c, -s.half, -s.half, s.half * 2, s.half * 2); ctx.restore(); }
  function drawHalf(h) {
    var s = sprites[h.type]; ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(h.a);
    ctx.save(); ctx.rotate(h.cut); ctx.beginPath(); ctx.rect(-s.half, h.side > 0 ? 0 : -s.half, s.half * 2, s.half); ctx.restore(); ctx.clip();
    ctx.drawImage(s.c, -s.half, -s.half, s.half * 2, s.half * 2);
    ctx.rotate(h.cut); ctx.fillStyle = TYPES[h.type].juice[1]; ctx.globalAlpha = .85; ctx.fillRect(-h.r * .8, -2.5, h.r * 1.6, 5);
    ctx.restore();
  }
  function blob(g, s, scale) {
    g.beginPath(); var n = 14;
    for (var i = 0; i <= n; i++) { var a = i / n * TAU, rr2 = s.r * scale * (0.7 + 0.35 * Math.sin(s.seed + i * 2.3) + 0.15 * Math.sin(s.seed * 2 + i * 5)); var x = s.x + Math.cos(a) * rr2 * 1.25, y = s.y + Math.sin(a) * rr2; i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.closePath(); g.fill();
  }
  function txt(t, x, y, size, color, align) {
    ctx.font = '900 ' + size + 'px "Arial Black", Impact, sans-serif'; ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(3, size / 7); ctx.strokeStyle = '#2a1206'; ctx.lineJoin = 'round'; ctx.strokeText(t, x, y); ctx.fillStyle = color; ctx.fillText(t, x, y);
  }
  var safeTop = 0;
  function render() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    var sx = shake ? rand(-8, 8) * shake : 0, sy = shake ? rand(-8, 8) * shake : 0;
    ctx.save(); ctx.translate(sx, sy);
    ctx.drawImage(bg, 0, 0, W, H);
    splats.forEach(function (s) {
      var a = s.t < 2.5 ? 0.75 : 0.75 * (1 - (s.t - 2.5) / 1.5);
      ctx.globalAlpha = a; ctx.fillStyle = s.c; blob(ctx, s, 1);
      ctx.globalAlpha = a * .6; ctx.fillStyle = s.c2; blob(ctx, { x: s.x + 6, y: s.y - 4, r: s.r * .5, seed: s.seed + 3 }, 1);
      ctx.globalAlpha = a; ctx.fillStyle = s.c;
      for (var i = 0; i < 6; i++) { var d = s.r * (1.3 + (i % 3) * .35), aa = s.ang + (i - 2.5) * .5 + (i % 2 ? Math.PI : 0); ctx.beginPath(); ctx.arc(s.x + Math.cos(aa) * d, s.y + Math.sin(aa) * d, s.r * .12 * (1 + (i % 2)), 0, TAU); ctx.fill(); }
    });
    ctx.globalAlpha = 1;
    halves.forEach(drawHalf);
    items.forEach(function (it) {
      var y = it.y + (it.dy || 0);
      if (it.menu) {
        ctx.save(); ctx.translate(it.x, y); ctx.rotate(performance.now() / 1500);
        ctx.strokeStyle = it.ring; ctx.lineWidth = 6 * S; ctx.setLineDash([18 * S, 10 * S]); ctx.shadowColor = it.ring; ctx.shadowBlur = 16;
        ctx.beginPath(); ctx.arc(0, 0, it.r * 1.75, 0, TAU); ctx.stroke(); ctx.restore();
        drawSprite(it.type, it.x, y, it.a);
        txt(it.label, it.x, y + it.r * 2.35, 20 * S, it.ring);
        if (it.menu === 'classic' || it.menu === 'arcade') txt('BEST ' + best[it.menu], it.x, y + it.r * 2.35 + 24 * S, 13 * S, '#fff');
      } else {
        if (it.type === 'bomb') { ctx.save(); ctx.shadowColor = '#ff3a00'; ctx.shadowBlur = 25 + Math.sin(performance.now() / 60) * 10; drawSprite('bomb', it.x, y, it.a); ctx.restore();
          for (var k = 0; k < 2; k++) particles.push({ x: it.x + Math.cos(it.a - Math.PI / 2) * it.r, y: it.y + Math.sin(it.a - Math.PI / 2) * it.r, vx: rand(-60, 60), vy: rand(-60, 60), t: .25, c: '#ffd84a', r: 2 * S }); }
        else drawSprite(it.type, it.x, y, it.a);
      }
    });
    particles.forEach(function (p) { ctx.globalAlpha = Math.min(1, p.t * 2); ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); });
    ctx.globalAlpha = 1;
    // blade trail
    if (trail.length > 1) {
      var now = performance.now();
      ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.shadowColor = '#bfe8ff'; ctx.shadowBlur = 18;
      for (var i = 1; i < trail.length; i++) {
        var p0 = trail[i - 1], p1 = trail[i], life = 1 - (now - p1.t) / 140, f = i / trail.length;
        ctx.strokeStyle = 'rgba(255,255,255,' + Math.max(0, life) + ')'; ctx.lineWidth = Math.max(1, 10 * S * f * life);
        ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
    // HUD
    var top = 14 + safeTop;
    if (mode === 'classic' || mode === 'arcade' || mode === 'over') {
      drawSprite('burrito', 32 * S, top + 22 * S, 0.5, 0.42);
      txt(String(score), 62 * S, top + 20 * S, 38 * S, '#ffcf3a', 'left');
      txt('BEST ' + best[lastMode], 16, top + 54 * S, 14 * S, '#fff', 'left');
      if (lastMode === 'classic') for (var x = 0; x < 3; x++) {
        var on = x < strikes, sz = (22 + x * 5) * S, xx = W - 18 - (2 - x) * 36 * S - sz / 2;
        txt('✕', xx, top + 20 * S, sz, on ? '#ff2a2a' : 'rgba(255,255,255,.25)');
      } else txt(Math.ceil(timeLeft) + 's', W - 16, top + 20 * S, 32 * S, timeLeft < 10 ? '#ff4a2a' : '#fff', 'right');
    }
    if (mode === 'menu') {
      txt('BURRITO', W / 2, H * .17, 52 * S, '#ffcf3a'); txt('NINJA', W / 2, H * .17 + 54 * S, 64 * S, '#ff5a3a');
      txt('Slice a burrito to start!', W / 2, H * .34, 16 * S, '#fff');
      txt('Avoid the ☠ ghost pepper', W / 2, H * .34 + 24 * S, 14 * S, '#ffb3a0');
    }
    if (mode === 'over') {
      var o = Math.min(1, overT * 2); ctx.globalAlpha = o * .55; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = o;
      txt('GAME OVER', W / 2, H * .33, 48 * S, '#ff5a3a');
      txt('SCORE ' + score, W / 2, H * .43, 34 * S, '#ffcf3a');
      txt(newBest ? 'NEW BEST!' : 'BEST ' + best[lastMode], W / 2, H * .5, 22 * S, newBest ? '#9be04a' : '#fff');
      ctx.globalAlpha = 1;
      items.forEach(function (it) { if (it.menu) { var y = it.y + (it.dy || 0); drawSprite(it.type, it.x, y, it.a); txt(it.label, it.x, y + it.r * 2.35, 20 * S, it.ring); } });
    }
    popups.forEach(function (p) {
      ctx.globalAlpha = Math.min(1, p.t * 2.5); var sc = p.crit ? 1 + Math.sin(p.t * 30) * .05 : 1;
      txt(p.text, p.x, p.y, p.size * S * sc, p.color); if (p.sub) txt(p.sub, p.x, p.y + p.size * S, p.size * 1.2 * S, '#fff');
    });
    ctx.globalAlpha = 1;
    if (flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + flash + ')'; ctx.fillRect(0, 0, W, H); }
  }

  var last = performance.now();
  function frame(t) {
    var dt = Math.min(0.033, (t - last) / 1000); last = t;
    update(dt); render(); requestAnimationFrame(frame);
  }
  window.addEventListener('resize', function () { var wasMenu = mode === 'menu'; resize(); if (wasMenu) showMenu(); });
  var probe = document.createElement('div'); probe.style.cssText = 'position:fixed;top:env(safe-area-inset-top);'; document.body.appendChild(probe);
  resize(); safeTop = probe.getBoundingClientRect().top || 0; showMenu();
  requestAnimationFrame(frame);

  window.BurritoNinja = {
    get state() { return { mode: mode, score: score, strikes: strikes, items: items.length, halves: halves.length, splats: splats.length, timeLeft: timeLeft }; },
    get items() { return items; }, start: start, showMenu: showMenu, toss: toss, swipe: function (pts) { trail = []; pts.forEach(function (p) { handleMove(p[0], p[1]); }); }
  };
})();
