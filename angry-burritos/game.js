/* Angry Burritos — portrait Angry Birds-style physics game using vendored Planck.js. */
(function () {
  'use strict';
  var pl = window.planck, Vec2 = pl.Vec2;
  var cv = document.getElementById('c'), ctx = cv.getContext('2d');
  var W, H, DPR;
  var $ = function (id) { return document.getElementById(id); };
  var TAU = Math.PI * 2, rand = function (a, b) { return a + Math.random() * (b - a); };

  var MAT = {
    wood: { density: 0.7, friction: 0.8, hp: 6, score: 500, colors: ['#e0a85a', '#b8783a', '#8a5226'] },
    glass: { density: 0.4, friction: 0.4, hp: 2.2, score: 500, colors: ['rgba(170,225,255,.65)', '#7cc8f0', '#e8f8ff'] },
    stone: { density: 2.2, friction: 0.9, hp: 16, score: 500, colors: ['#9aa0a6', '#6e747a', '#c4c9cd'] }
  };
  var AVO = { plain: { r: 0.4, hp: 2.2 }, helmet: { r: 0.42, hp: 5 }, king: { r: 0.56, hp: 7 } };
  var BIRD = { red: { r: 0.36, density: 3 }, taco: { r: 0.28, density: 3 }, chimi: { r: 0.42, density: 5 } };
  var SLING = { x: 0, y: 2.1 }, MAX_PULL = 1.8, LAUNCH_K = 9.6;
  var GROUND_FRAC = 0.8; // ground sits at 80% of screen height in the default view

  /* ---------- persistence ---------- */
  var prog; try { prog = JSON.parse(localStorage.getItem('ab-progress') || '{}'); } catch (e) { prog = {}; }
  function saveProg() { localStorage.setItem('ab-progress', JSON.stringify(prog)); }

  /* ---------- audio ---------- */
  var actx = null, muted = localStorage.getItem('ab-muted') === '1';
  function ac() { if (!actx) try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } if (actx && actx.state === 'suspended') actx.resume(); return actx; }
  function tone(f0, f1, d, v, type, delay) { if (muted) return; var a = ac(); if (!a) return; var t = a.currentTime + (delay || 0); var o = a.createOscillator(), g = a.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + d); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d); o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + d); }
  function noise(d, f0, f1, v, type) { if (muted) return; var a = ac(); if (!a) return; var n = a.sampleRate * d | 0, b = a.createBuffer(1, n, a.sampleRate), dd = b.getChannelData(0); for (var i = 0; i < n; i++) dd[i] = (Math.random() * 2 - 1) * (1 - i / n); var s = a.createBufferSource(); s.buffer = b; var f = a.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.setValueAtTime(f0, a.currentTime); f.frequency.exponentialRampToValueAtTime(f1, a.currentTime + d); var g = a.createGain(); g.gain.value = v; s.connect(f); f.connect(g); g.connect(a.destination); s.start(); }
  var sfx = {
    stretch: function () { tone(200, 500, 0.25, 0.08, 'sawtooth'); },
    launch: function () { noise(0.3, 500, 2500, 0.3); tone(400, 900, 0.2, 0.1, 'triangle'); },
    wood: function () { noise(0.12, 700, 300, 0.35); }, glass: function () { noise(0.25, 4000, 2500, 0.3, 'highpass'); tone(2000, 3000, 0.1, 0.05); },
    stone: function () { noise(0.15, 300, 120, 0.45, 'lowpass'); }, pop: function () { tone(600, 150, 0.2, 0.2, 'square'); noise(0.2, 1500, 300, 0.2); },
    boom: function () { noise(0.8, 900, 40, 1, 'lowpass'); tone(110, 30, 0.6, 0.5, 'sawtooth'); }, split: function () { tone(800, 1600, 0.15, 0.12, 'triangle'); },
    win: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, f, 0.25, 0.12, 'triangle', i * 0.12); }); }, lose: function () { [392, 330, 262].forEach(function (f, i) { tone(f, f * 0.98, 0.3, 0.12, 'triangle', i * 0.18); }); }
  };
  function buzz(ms) { if (navigator.vibrate) try { navigator.vibrate(ms); } catch (e) { } }

  /* ---------- state ---------- */
  var world, levelIdx = 0, level, blocks = [], avos = [], birdsLeft = [], bird = null, extraBirds = [], particles = [], popups = [], trail = [], lastTrail = [];
  var state = 'menu', score = 0, simTime = 0, launchTime = 0, abilityUsed = false, settleT = 0, endTimer = 0, paused = false;
  var cam = { x: 8, y: 6, s: 20 }, camT = { x: 8, y: 6, s: 20 }, drag = null, toDestroy = [];

  function fitView() {
    var xl = -3, xr = (level ? level.right : 16) + 2.5, s = W / (xr - xl);
    // also ensure the scene's height (~11m above ground) fits under the HUD
    s = Math.min(s, (H * GROUND_FRAC - 70) / 11);
    var cx = (xl + xr) / 2; if (W / s > xr - xl) cx = xl + W / s / 2;
    return { x: cx, y: (H * (GROUND_FRAC - 0.5)) / s, s: s };
  }
  function w2s(x, y) { return [W / 2 + (x - cam.x) * cam.s, H / 2 - (y - cam.y) * cam.s]; }
  function s2w(px, py) { return [cam.x + (px - W / 2) / cam.s, cam.y - (py - H / 2) / cam.s]; }

  function resize() { DPR = Math.min(window.devicePixelRatio || 1, 3); W = window.innerWidth; H = window.innerHeight; cv.width = W * DPR; cv.height = H * DPR; var f = fitView(); camT = f; if (state !== 'fly') { cam.x = f.x; cam.y = f.y; cam.s = f.s; } }

  /* ---------- level setup ---------- */
  var loadId = 0;
  function loadLevel(i) {
    loadId++; levelIdx = i; level = window.AB_LEVELS[i];
    world = pl.World({ gravity: Vec2(0, -10) });
    var ground = world.createBody({ type: 'static', position: Vec2(0, 0) });
    ground.createFixture(pl.Box(200, 5, Vec2(0, -5), 0), { friction: 0.9 });
    ground.setUserData({ kind: 'ground' });
    blocks = []; avos = []; particles = []; popups = []; trail = []; lastTrail = []; extraBirds = []; bird = null; toDestroy = [];
    level.build().forEach(function (it) {
      if (it.t === 'block') {
        var m = MAT[it.m], b = world.createBody({ type: 'dynamic', position: Vec2(it.x, it.y + it.h / 2) });
        b.createFixture(pl.Box(it.w / 2, it.h / 2), { density: m.density, friction: m.friction, restitution: 0.05 });
        var d = { kind: 'block', m: it.m, w: it.w, h: it.h, hp: m.hp * Math.sqrt(it.w * it.h / 0.3), dmg: 0, seed: Math.random() * 1000, body: b };
        b.setUserData(d); blocks.push(d);
      } else {
        var a = AVO[it.kind], ab = world.createBody({ type: 'dynamic', position: Vec2(it.x, it.y + a.r), angularDamping: 2 });
        ab.createFixture(pl.Circle(a.r), { density: 0.8, friction: 0.8, restitution: 0.1 });
        var ad = { kind: 'avo', type: it.kind, r: a.r, hp: a.hp, dmg: 0, body: ab, blink: rand(0, 4) };
        ab.setUserData(ad); avos.push(ad);
      }
    });
    world.on('post-solve', onPostSolve);
    birdsLeft = level.birds.slice(); score = 0; simTime = 0; settleT = 0; endTimer = 0;
    state = 'aim'; paused = false; overviewT = 1.8; panX = 0;
    var f = fitView(); camT = f; cam.x = f.x; cam.y = f.y; cam.s = f.s;
    hideAll(); $('hud').style.display = 'flex'; updateHud();
  }

  function onPostSolve(contact, impulse) {
    if (simTime < 1.2) return; // let structures settle without damage
    var ni = impulse.normalImpulses, sum = 0; for (var i = 0; i < ni.length; i++) sum += ni[i];
    var A = contact.getFixtureA().getBody(), B = contact.getFixtureB().getBody();
    var da = A.getUserData() || {}, db = B.getUserData() || {};
    [[da, db, B], [db, da, A]].forEach(function (p) {
      var me = p[0], other = p[1]; if (me.kind !== 'block' && me.kind !== 'avo') return;
      var thr = me.kind === 'avo' ? 0.6 : 1.0, mult = other.kind === 'bird' ? 1.4 : 1;
      var dmg = (sum - thr) * mult; if (dmg <= 0) return;
      hurt(me, dmg);
    });
    if ((da.kind === 'bird' || db.kind === 'bird') && sum > 2) { var bd = da.kind === 'bird' ? da : db; if (!bd.hitOnce) { bd.hitOnce = true; buzz(25); } }
  }
  function hurt(d, dmg) {
    if (d.dead) return; d.dmg += dmg;
    if (d.kind === 'block' && dmg > 0.5) { var nowT = simTime; if (!d.lastSnd || nowT - d.lastSnd > 0.15) { d.lastSnd = nowT; sfx[d.m](); } }
    if (d.dmg >= d.hp) { d.dead = true; toDestroy.push(d); }
  }

  function destroyDead() {
    toDestroy.forEach(function (d) {
      var p = d.body.getPosition();
      if (d.kind === 'block') {
        var m = MAT[d.m]; score += m.score; addPopup(String(m.score), p.x, p.y, d.m === 'glass' ? '#bfe8ff' : '#fff', 0.7);
        for (var i = 0; i < 10; i++) particles.push({ x: p.x + rand(-d.w / 2, d.w / 2), y: p.y + rand(-d.h / 2, d.h / 2), vx: rand(-3, 3), vy: rand(0, 5), a: rand(0, TAU), va: rand(-8, 8), sz: rand(0.08, 0.22), c: m.colors[i % 3], t: rand(0.8, 1.5), rect: true });
        for (i = 0; i < 4; i++) smoke(p.x + rand(-d.w / 2, d.w / 2), p.y + rand(-d.h / 2, d.h / 2), 0.35);
        blocks.splice(blocks.indexOf(d), 1);
      } else if (d.kind === 'avo') {
        score += 5000; addPopup('5000', p.x, p.y + 0.6, '#9be04a', 1.1); sfx.pop(); buzz(40);
        for (i = 0; i < 9; i++) smoke(p.x + rand(-0.5, 0.5), p.y + rand(-0.5, 0.5), rand(0.4, 0.7));
        for (i = 0; i < 8; i++) particles.push({ x: p.x, y: p.y, vx: rand(-4, 4), vy: rand(1, 6), a: 0, va: 0, sz: rand(0.08, 0.15), c: i % 2 ? '#7cbf3a' : '#d8ef9a', t: 1 });
        avos.splice(avos.indexOf(d), 1);
      }
      world.destroyBody(d.body);
    });
    toDestroy = []; updateHud();
  }
  function smoke(x, y, r) { particles.push({ x: x, y: y, vx: rand(-0.6, 0.6), vy: rand(0.2, 1.2), sz: r, c: 'smoke', t: rand(0.6, 1.1), t0: 1 }); }
  function addPopup(txt, x, y, color, size) { popups.push({ txt: txt, x: x, y: y, c: color, s: size || 0.8, t: 1.3 }); }
  function crumbs(x, y, n) { // "feathers": tortilla bits, rice, beans
    var cols = ['#f2cf86', '#fff', '#fff', '#6b3d1e', '#d8321e'];
    for (var i = 0; i < n; i++) particles.push({ x: x, y: y, vx: rand(-3, 3), vy: rand(-1, 4), a: rand(0, TAU), va: rand(-6, 6), sz: rand(0.05, 0.12), c: cols[i % cols.length], t: rand(0.7, 1.4), g: 0.4 });
  }

  /* ---------- birds ---------- */
  function spawnBird(type, x, y, vx, vy) {
    var bt = BIRD[type], b = world.createBody({ type: 'dynamic', position: Vec2(x, y), bullet: true, angularDamping: 0.6 });
    b.createFixture(pl.Circle(bt.r), { density: bt.density, friction: 0.6, restitution: 0.25 });
    b.setLinearVelocity(Vec2(vx, vy)); var d = { kind: 'bird', type: type, r: bt.r, body: b }; b.setUserData(d); return d;
  }
  function launch(pullX, pullY) {
    var type = birdsLeft.shift(), vx = -pullX * LAUNCH_K, vy = -pullY * LAUNCH_K;
    bird = spawnBird(type, SLING.x + pullX, SLING.y + pullY, vx, vy);
    extraBirds = []; lastTrail = trail; trail = []; panX = 0; abilityUsed = false; launchTime = simTime; settleT = 0; state = 'fly';
    sfx.launch(); updateHud();
  }
  function ability() {
    if (!bird || abilityUsed || bird.hitOnce) return; abilityUsed = true;
    var p = bird.body.getPosition(), v = bird.body.getLinearVelocity();
    if (bird.type === 'taco') {
      sfx.split(); [-0.22, 0.22].forEach(function (da) { var c = Math.cos(da), s = Math.sin(da); extraBirds.push(spawnBird('taco', p.x, p.y + da * 0.8, v.x * c - v.y * s, v.x * s + v.y * c)); });
      crumbs(p.x, p.y, 8);
    } else if (bird.type === 'chimi') {
      explode(p.x, p.y);
    } else if (bird.type === 'red') { // battle cry: small speed boost
      bird.body.setLinearVelocity(Vec2(v.x * 1.35, v.y * 1.1)); addPopup('¡AY!', p.x, p.y + 0.8, '#ff5a3a', 0.7); tone(300, 700, 0.2, 0.15, 'square');
    }
  }
  function explode(x, y) {
    sfx.boom(); buzz([60, 30, 120]); var R = 3.4;
    for (var b = world.getBodyList(); b; b = b.getNext()) {
      var d = b.getUserData(); if (!d || d.kind === 'ground' || b === bird.body) continue;
      var p = b.getPosition(), dx = p.x - x, dy = p.y - y, dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > R) continue; var f = 1 - dist / R; dist = Math.max(dist, 0.2);
      b.applyLinearImpulse(Vec2(dx / dist * 18 * f * Math.min(4, b.getMass()), dy / dist * 18 * f * Math.min(4, b.getMass()) + 3 * f), b.getWorldCenter(), true);
      if (d.kind === 'block' || d.kind === 'avo') hurt(d, (d.kind === 'avo' ? 9 : 14) * f);
    }
    for (var i = 0; i < 16; i++) smoke(x + rand(-1, 1), y + rand(-1, 1), rand(0.5, 1.0));
    particles.push({ x: x, y: y, sz: R, c: 'flash', t: 0.25, t0: 0.25 });
    world.destroyBody(bird.body); bird.dead = true;
  }

  /* ---------- input ---------- */
  function slingScreen() { return w2s(SLING.x, SLING.y); }
  cv.addEventListener('pointerdown', function (e) {
    e.preventDefault(); ac(); if (paused) return;
    if (overviewT > 0) { overviewT = 0; return; }
    if (state === 'aim' && birdsLeft.length) {
      var ss = slingScreen(), dx = e.clientX - ss[0], dy = e.clientY - ss[1];
      if (!(dx * dx + dy * dy < Math.pow(Math.max(70, cam.s * 2.5), 2) || e.clientX < W * 0.45)) { pan = { id: e.pointerId, x: e.clientX, p0: panX }; return; }
      { drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; sfx.stretch(); try { cv.setPointerCapture(e.pointerId); } catch (x) { } }
    } else if (state === 'fly') ability();
  });
  cv.addEventListener('pointermove', function (e) { if (drag && e.pointerId === drag.id) { drag.x = e.clientX; drag.y = e.clientY; } if (pan && e.pointerId === pan.id) { var a = aimView(); panX = Math.max(0, Math.min(a.maxX - a.minX, pan.p0 - (e.clientX - pan.x) / cam.s)); } });
  function release(e) {
    if (pan && e.pointerId === pan.id) pan = null;
    if (!drag || e.pointerId !== drag.id) return; var p = pullVec(); drag = null;
    if (Math.hypot(p[0], p[1]) > 0.35) launch(p[0], p[1]);
  }
  cv.addEventListener('pointerup', release); cv.addEventListener('pointercancel', function () { drag = null; pan = null; });
  function pullVec() {
    var ss = slingScreen(), dx = (drag.x - ss[0]) / cam.s, dy = -(drag.y - ss[1]) / cam.s, l = Math.hypot(dx, dy);
    if (l > MAX_PULL) { dx *= MAX_PULL / l; dy *= MAX_PULL / l; }
    // keep the burrito above the ground
    if (SLING.y + dy < 0.4) dy = 0.4 - SLING.y;
    return [dx, dy];
  }
  document.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
  document.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  /* ---------- UI ---------- */
  function hideAll() { ['menu', 'levels', 'pause', 'done'].forEach(function (id) { $(id).classList.remove('show'); }); }
  function show(id) { hideAll(); $(id).classList.add('show'); }
  function starsHtml(n) { var s = ''; for (var i = 0; i < 3; i++) s += i < n ? '★' : '<span class="off">★</span>'; return s; }
  function showLevels() {
    state = 'select'; $('hud').style.display = 'none'; var g = $('grid'); g.innerHTML = '';
    window.AB_LEVELS.forEach(function (L, i) {
      var p = prog[i] || {}, locked = i > 0 && !prog[i - 1];
      var b = document.createElement('button'); b.className = 'lvl' + (locked ? ' locked' : '');
      b.innerHTML = (locked ? '🔒' : (i + 1)) + '<small>' + (locked ? '' : starsHtml(p.stars || 0).replace(/<span class="off">★<\/span>/g, '☆')) + '</small>';
      if (!locked) b.addEventListener('click', function () { loadLevel(i); });
      g.appendChild(b);
    });
    show('levels');
  }
  function updateHud() {
    $('score').textContent = score.toLocaleString();
    var best = (prog[levelIdx] || {}).best || 0;
    $('lvlinfo').textContent = 'Level ' + (levelIdx + 1) + ' · Best ' + best.toLocaleString();
  }
  $('playBtn').onclick = function () { ac(); showLevels(); };
  $('lvBack').onclick = function () { show('menu'); };
  $('pauseBtn').onclick = function () { if (state === 'aim' || state === 'fly') { paused = true; show('pause'); } };
  $('resume').onclick = function () { paused = false; hideAll(); };
  $('restart').onclick = function () { loadLevel(levelIdx); };
  $('toLevels').onclick = showLevels; $('dLevels').onclick = showLevels; $('dRetry').onclick = function () { loadLevel(levelIdx); };
  $('dNext').onclick = function () { if (levelIdx + 1 < window.AB_LEVELS.length) loadLevel(levelIdx + 1); else showLevels(); };
  var mb = $('muteBtn'); mb.textContent = muted ? '🔇' : '🔊';
  mb.onclick = function () { muted = !muted; localStorage.setItem('ab-muted', muted ? '1' : '0'); mb.textContent = muted ? '🔇' : '🔊'; };

  function finish(won) {
    state = won ? 'won' : 'lost';
    var stars = 0;
    if (won) {
      var bonus = birdsLeft.length * 10000; if (bonus) addPopup('+' + bonus, SLING.x, SLING.y + 2, '#ffd84a', 1);
      score += bonus; stars = birdsLeft.length >= 2 ? 3 : birdsLeft.length === 1 ? 2 : 1;
      var p = prog[levelIdx] || { stars: 0, best: 0 }; p.stars = Math.max(p.stars, stars); p.best = Math.max(p.best, score); prog[levelIdx] = p; saveProg();
      sfx.win();
    } else sfx.lose();
    updateHud(); var myId = loadId;
    setTimeout(function () {
      if (myId !== loadId) return;
      $('doneTitle').textContent = won ? 'LEVEL CLEARED!' : 'LEVEL FAILED';
      $('doneStars').innerHTML = won ? starsHtml(stars) : '🥑';
      $('doneScore').textContent = score.toLocaleString();
      $('doneBest').textContent = 'Best: ' + ((prog[levelIdx] || {}).best || 0).toLocaleString();
      $('dNext').style.display = won ? '' : 'none';
      show('done');
    }, 900);
  }

  /* ---------- simulation ---------- */
  var STEP = 1 / 60;
  function step() {
    world.step(STEP, 10, 8); simTime += STEP; destroyDead();
    // avocados that fall off the world
    avos.forEach(function (a) { var p = a.body.getPosition(); if (p.y < -3 || Math.abs(p.x) > 60) { if (!a.dead) { a.dead = true; toDestroy.push(a); } } });
    blocks.forEach(function (b) { var p = b.body.getPosition(); if (p.y < -3 && !b.dead) { b.dead = true; toDestroy.push(b); } });
    if (state === 'fly') {
      var tb = bird && !bird.dead ? bird : null;
      if (tb) { var p = tb.body.getPosition(); var last = trail[trail.length - 1]; if (!tb.hitOnce && (!last || Math.hypot(p.x - last.x, p.y - last.y) > 0.45)) trail.push({ x: p.x, y: p.y, big: trail.length % 3 === 0 }); }
      // settle detection: everything slow for 1.2s, or 9s cap
      var moving = false;
      for (var b = world.getBodyList(); b; b = b.getNext()) { if (b.isAwake() && b.getType() === 'dynamic') { var v = b.getLinearVelocity(); if (v.x * v.x + v.y * v.y > 0.05) { moving = true; break; } } }
      settleT = moving ? 0 : settleT + STEP;
      var allBirds = [bird].concat(extraBirds).filter(function (x) { return x && !x.dead; });
      allBirds.forEach(function (x) { var q = x.body.getPosition(); if (q.x > level.right + 15 || q.x < -10 || q.y < -3) { x.dead = true; world.destroyBody(x.body); } });
      if (!avos.length && settleT > 0.4) return finish(true);
      if (settleT > 1.2 || simTime - launchTime > 9) {
        allBirds.forEach(function (x) { if (!x.dead) { var q = x.body.getPosition(); crumbs(q.x, q.y, 10); smoke(q.x, q.y, 0.5); x.dead = true; world.destroyBody(x.body); } });
        bird = null; extraBirds = [];
        if (!avos.length) return finish(true);
        if (!birdsLeft.length) return finish(false);
        state = 'aim'; panX = 0;
      }
    }
  }

  /* ---------- camera ---------- */
  var overviewT = 0, panX = 0, pan = null;
  function aimView() {
    var f = fitView(), s = Math.max(f.s, Math.min(W / 11, (H * GROUND_FRAC - 80) / 9));
    var minX = -2.6 + W / s / 2, maxX = Math.max(minX, (level ? level.right : 16) + 2.5 - W / s / 2);
    return { x: Math.max(minX, Math.min(maxX, minX + panX)), y: (H * (GROUND_FRAC - 0.5)) / s, s: s, minX: minX, maxX: maxX };
  }
  function updateCamera(dt) {
    var f = fitView(), a = aimView();
    if (overviewT > 0) { overviewT -= dt; camT = f; }
    else if (state === 'fly' && bird && !bird.dead) {
      var p = bird.body.getPosition(), s = a.s;
      var minY = (H * (GROUND_FRAC - 0.5)) / s;
      camT = { x: Math.max(a.minX, Math.min(a.maxX + 3, p.x + 1.5)), y: Math.max(minY, p.y - H * 0.1 / s), s: s };
    } else if (state === 'fly') { /* hold position while things settle */ }
    else if (state === 'won' || state === 'lost') camT = f;
    else camT = a;
    var k = 1 - Math.pow(overviewT > 0 ? 0.2 : 0.03, dt);
    cam.x += (camT.x - cam.x) * k; cam.y += (camT.y - cam.y) * k; cam.s += (camT.s - cam.s) * k;
  }

  /* ---------- drawing ---------- */
  var clouds = []; for (var i = 0; i < 9; i++) clouds.push({ x: rand(-20, 40), y: rand(7, 16), s: rand(0.8, 1.6) });
  function drawBg() {
    var gy = w2s(0, 0)[1];
    var gr = ctx.createLinearGradient(0, 0, 0, gy); gr.addColorStop(0, '#3fa9e8'); gr.addColorStop(1, '#bfe9ff'); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, gy + 2);
    // clouds (parallax 0.3)
    clouds.forEach(function (c) {
      var px = W / 2 + (c.x - cam.x * 0.3) * cam.s * 0.6, py = H / 2 - (c.y - cam.y * 0.6) * cam.s * 0.6, r = 22 * c.s * cam.s / 20;
      ctx.fillStyle = 'rgba(255,255,255,.95)'; [[0, 0, 1], [-1, .25, .7], [1, .25, .75], [.5, -.35, .7], [-.5, -.3, .6]].forEach(function (q) { ctx.beginPath(); ctx.arc(px + q[0] * r * 1.2, py + q[1] * r, r * q[2], 0, TAU); ctx.fill(); });
    });
    // hills (two parallax layers)
    [[0.45, '#8fd36a', 3.5, 0.18], [0.7, '#6cc04a', 2.2, 0.28]].forEach(function (L) {
      ctx.fillStyle = L[1]; ctx.beginPath(); ctx.moveTo(0, gy);
      for (var x = 0; x <= W; x += 6) { var wx = (x - W / 2) / cam.s + cam.x * L[0]; var h = L[2] + Math.sin(wx * L[3]) * 1.4 + Math.sin(wx * L[3] * 2.3 + 1) * 0.6; ctx.lineTo(x, gy - h * cam.s * 0.9); }
      ctx.lineTo(W, gy); ctx.closePath(); ctx.fill();
    });
    // ground
    ctx.fillStyle = '#c99a5a'; ctx.fillRect(0, gy, W, H - gy); ctx.fillStyle = '#b3844a';
    for (var k = 0; k < 40; k++) { var sx = ((k * 97 - cam.x * cam.s) % (W + 40) + W + 40) % (W + 40) - 20, sy = gy + 14 + (k * 53 % Math.max(20, H - gy - 14)); ctx.fillRect(sx, sy, 6, 3); }
    ctx.fillStyle = '#5cbf2a'; ctx.fillRect(0, gy - 2, W, Math.max(8, cam.s * 0.35)); ctx.fillStyle = '#3e9a18'; ctx.fillRect(0, gy - 2 + Math.max(8, cam.s * 0.35), W, 3);
    ctx.fillStyle = '#7ad84a'; for (var x = ((-cam.x * cam.s) % 10 + 10) % 10 - 10; x < W; x += 10) { ctx.beginPath(); ctx.moveTo(x, gy - 1); ctx.lineTo(x + 3, gy - 6); ctx.lineTo(x + 6, gy - 1); ctx.fill(); }
  }
  function worldTx(x, y, a) { var p = w2s(x, y); ctx.translate(p[0], p[1]); ctx.rotate(-a); ctx.scale(cam.s, cam.s); }
  function drawBlock(d) {
    var b = d.body, p = b.getPosition(), m = MAT[d.m], w = d.w, h = d.h;
    ctx.save(); worldTx(p.x, p.y, b.getAngle());
    ctx.fillStyle = m.colors[0]; ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.lineWidth = 0.035; ctx.strokeStyle = m.colors[1];
    if (d.m === 'wood') { var horiz = w > h; ctx.beginPath(); for (var i = 1; i < 4; i++) { if (horiz) { var yy = -h / 2 + h * i / 4; ctx.moveTo(-w / 2 + 0.05, yy); ctx.bezierCurveTo(-w / 6, yy + 0.04, w / 6, yy - 0.04, w / 2 - 0.05, yy); } else { var xx = -w / 2 + w * i / 4; ctx.moveTo(xx, -h / 2 + 0.05); ctx.bezierCurveTo(xx + 0.04, -h / 6, xx - 0.04, h / 6, xx, h / 2 - 0.05); } } ctx.stroke(); }
    if (d.m === 'glass') { ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.moveTo(-w / 2 + 0.06, -h / 2 + 0.06); ctx.lineTo(-w / 2 + Math.min(w, h) * 0.5, -h / 2 + 0.06); ctx.lineTo(-w / 2 + 0.06, -h / 2 + Math.min(w, h) * 0.5); ctx.fill(); }
    if (d.m === 'stone') { ctx.fillStyle = m.colors[1]; for (i = 0; i < 6; i++) { var sx = Math.sin(d.seed + i * 7) * w * 0.4, sy = Math.cos(d.seed + i * 3) * h * 0.4; ctx.beginPath(); ctx.arc(sx, sy, 0.04, 0, TAU); ctx.fill(); } ctx.fillStyle = m.colors[2]; ctx.fillRect(-w / 2, -h / 2, w, 0.05); }
    ctx.strokeStyle = d.m === 'glass' ? '#4a9ad0' : 'rgba(0,0,0,.6)'; ctx.lineWidth = 0.05; ctx.strokeRect(-w / 2, -h / 2, w, h);
    // cracks
    var f = d.dmg / d.hp; if (f > 0.25) {
      ctx.strokeStyle = d.m === 'glass' ? '#fff' : 'rgba(40,20,0,.75)'; ctx.lineWidth = 0.035; ctx.beginPath();
      var n = f > 0.6 ? 4 : 2; for (i = 0; i < n; i++) { var cx = Math.sin(d.seed * (i + 1)) * w * 0.3, cy = Math.cos(d.seed * (i + 2)) * h * 0.3; ctx.moveTo(cx, cy); for (var k = 0; k < 3; k++) { cx += Math.sin(d.seed + i * 5 + k) * 0.18; cy += Math.cos(d.seed + i * 3 + k * 2) * 0.18; ctx.lineTo(Math.max(-w / 2, Math.min(w / 2, cx)), Math.max(-h / 2, Math.min(h / 2, cy))); } }
      ctx.stroke();
    }
    ctx.restore();
  }
  function drawAvo(d, t) {
    var b = d.body, p = b.getPosition(), r = d.r;
    ctx.save(); worldTx(p.x, p.y, b.getAngle());
    ctx.fillStyle = '#2f5a14'; ctx.beginPath(); ctx.ellipse(0, 0, r * 1.03, r, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#7cbf3a'; ctx.beginPath(); ctx.ellipse(0, -0.02, r * 0.92, r * 0.9, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#b5e06a'; ctx.beginPath(); ctx.ellipse(-r * 0.3, -r * 0.4, r * 0.25, r * 0.14, -0.5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#d8ef9a'; ctx.beginPath(); ctx.ellipse(0, r * 0.35, r * 0.5, r * 0.4, 0, 0, TAU); ctx.fill();
    // smug face (y is flipped: +y is down in this local frame)
    var blink = ((t + d.blink) % 4) < 0.12;
    ctx.fillStyle = '#fff'; [-1, 1].forEach(function (s) { ctx.beginPath(); ctx.ellipse(s * r * 0.33, -r * 0.08, r * 0.2, blink ? r * 0.03 : r * 0.17, 0, 0, TAU); ctx.fill(); });
    if (!blink) { ctx.fillStyle = '#000'; [-1, 1].forEach(function (s) { ctx.beginPath(); ctx.arc(s * r * 0.33 + r * 0.04, -r * 0.03, r * 0.08, 0, TAU); ctx.fill(); });
      ctx.fillStyle = '#7cbf3a'; [-1, 1].forEach(function (s) { ctx.fillRect(s * r * 0.33 - r * 0.22, -r * 0.27, r * 0.44, r * 0.13); }); } // half-lidded
    ctx.strokeStyle = '#1e3a0a'; ctx.lineWidth = r * 0.07; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-r * 0.2, r * 0.28); ctx.quadraticCurveTo(r * 0.08, r * 0.42, r * 0.32, r * 0.2); ctx.stroke(); // smirk
    // pit-nose
    ctx.fillStyle = '#7a4a22'; ctx.beginPath(); ctx.ellipse(0, r * 0.1, r * 0.12, r * 0.09, 0, 0, TAU); ctx.fill();
    // bruises when damaged
    if (d.dmg / d.hp > 0.4) { ctx.fillStyle = 'rgba(80,40,90,.45)'; ctx.beginPath(); ctx.arc(r * 0.45, -r * 0.35, r * 0.15, 0, TAU); ctx.fill(); }
    if (d.type === 'helmet') { ctx.fillStyle = '#a0a6ac'; ctx.beginPath(); ctx.arc(0, -r * 0.35, r * 0.85, Math.PI * 1.05, -Math.PI * 0.05); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#555'; ctx.lineWidth = r * 0.06; ctx.stroke(); ctx.fillStyle = '#7a8086'; ctx.fillRect(-r * 0.9, -r * 0.42, r * 1.8, r * 0.1); }
    if (d.type === 'king') { ctx.fillStyle = '#ffd23a'; ctx.strokeStyle = '#a87c0c'; ctx.lineWidth = r * 0.05; ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.75); ctx.lineTo(-r * 0.55, -r * 1.25); ctx.lineTo(-r * 0.25, -r * 1.0); ctx.lineTo(0, -r * 1.35); ctx.lineTo(r * 0.25, -r * 1.0); ctx.lineTo(r * 0.55, -r * 1.25); ctx.lineTo(r * 0.5, -r * 0.75); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#e8381e'; ctx.beginPath(); ctx.arc(0, -r * 0.9, r * 0.08, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  function drawBirdShape(type, r) {
    ctx.lineJoin = 'round';
    if (type === 'taco') {
      ctx.fillStyle = '#5cbf2a'; ctx.beginPath(); ctx.ellipse(0, -r * 0.2, r * 1.0, r * 0.5, 0, Math.PI, TAU); ctx.fill();
      ctx.fillStyle = '#d8321e'; ctx.beginPath(); ctx.arc(-r * 0.4, -r * 0.45, r * 0.15, 0, TAU); ctx.arc(r * 0.3, -r * 0.5, r * 0.15, 0, TAU); ctx.fill();
      ctx.fillStyle = '#4aa8f0'; ctx.strokeStyle = '#1a4a80'; ctx.lineWidth = r * 0.1; ctx.beginPath(); ctx.arc(0, -r * 0.25, r * 1.05, 0.05, Math.PI - 0.05); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#f1c04d'; ctx.beginPath(); ctx.arc(0, -r * 0.25, r * 0.85, 0.3, Math.PI - 0.3); ctx.lineTo(-r * 0.6, -r * 0.1); ctx.closePath(); ctx.globalAlpha = 0.35; ctx.fill(); ctx.globalAlpha = 1;
      faceAngry(r * 0.15, r * 0.15, r * 0.75); return;
    }
    var body = type === 'chimi' ? ['#7a4416', '#4a2408', '#a0622a'] : ['#e8452c', '#8a1a0a', '#f7b39a'];
    ctx.fillStyle = body[0]; ctx.strokeStyle = body[1]; ctx.lineWidth = r * 0.1;
    ctx.beginPath(); ctx.ellipse(0, 0, r * 1.15, r * 0.95, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = body[2]; ctx.lineWidth = r * 0.08; ctx.beginPath(); ctx.moveTo(-r * 0.7, -r * 0.7); ctx.quadraticCurveTo(-r * 0.35, 0, -r * 0.7, r * 0.7); ctx.moveTo(-r * 0.3, -r * 0.85); ctx.quadraticCurveTo(r * 0.05, 0, -r * 0.3, r * 0.85); ctx.stroke();
    // filling peeking from the front
    ctx.fillStyle = '#5cbf2a'; ctx.beginPath(); ctx.arc(r * 1.05, -r * 0.25, r * 0.18, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.arc(r * 1.1, r * 0.15, r * 0.15, 0, TAU); ctx.fill();
    if (type === 'chimi') { ctx.fillStyle = '#ffd84a'; for (var i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(Math.cos(i * 2.1) * r * 0.6, Math.sin(i * 1.7) * r * 0.55, r * 0.05, 0, TAU); ctx.fill(); } }
    faceAngry(r * 0.35, -r * 0.05, r);
  }
  function faceAngry(cx, cy, r) {
    ctx.fillStyle = '#fff'; [-1, 1].forEach(function (s) { ctx.beginPath(); ctx.arc(cx + s * r * 0.27, cy - r * 0.12, r * 0.2, 0, TAU); ctx.fill(); });
    ctx.fillStyle = '#000'; [-1, 1].forEach(function (s) { ctx.beginPath(); ctx.arc(cx + s * r * 0.27 + r * 0.06, cy - r * 0.08, r * 0.09, 0, TAU); ctx.fill(); });
    ctx.fillStyle = '#1a0a00'; ctx.beginPath(); // furrowed unibrow
    ctx.moveTo(cx - r * 0.55, cy - r * 0.5); ctx.lineTo(cx, cy - r * 0.22); ctx.lineTo(cx + r * 0.55, cy - r * 0.5); ctx.lineTo(cx + r * 0.55, cy - r * 0.32); ctx.lineTo(cx, cy - r * 0.08); ctx.lineTo(cx - r * 0.55, cy - r * 0.32); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#1a0a00'; ctx.lineWidth = r * 0.08; ctx.beginPath(); ctx.moveTo(cx - r * 0.15, cy + r * 0.3); ctx.quadraticCurveTo(cx + r * 0.05, cy + r * 0.2, cx + r * 0.25, cy + r * 0.32); ctx.stroke();
  }
  function drawBird(type, x, y, a) { ctx.save(); worldTx(x, y, a); drawBirdShape(type, BIRD[type].r); ctx.restore(); }
  function drawSlingPost(front) {
    ctx.save(); worldTx(SLING.x, 0, 0); ctx.lineCap = 'round';
    ctx.strokeStyle = '#6b3d1e'; ctx.lineWidth = 0.3;
    if (!front) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -1.2); ctx.lineTo(-0.35, -SLING.y - 0.15); ctx.stroke(); ctx.strokeStyle = '#8a5226'; ctx.lineWidth = 0.12; ctx.beginPath(); ctx.moveTo(0.05, 0); ctx.lineTo(0.05, -1.2); ctx.stroke(); }
    else { ctx.beginPath(); ctx.moveTo(0, -1.2); ctx.lineTo(0.35, -SLING.y - 0.15); ctx.stroke(); ctx.strokeStyle = '#4a2408'; ctx.lineWidth = 0.08; for (var i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(0.18 - 0.1 + i * 0.02, -1.4 - i * 0.12); ctx.lineTo(0.3 + i * 0.02, -1.45 - i * 0.12); ctx.stroke(); } }
    ctx.restore();
  }
  function band(px, py, prongX) {
    var a = w2s(SLING.x + prongX, SLING.y + 0.1), b = w2s(px, py);
    ctx.strokeStyle = '#3a1a06'; ctx.lineWidth = Math.max(3, cam.s * 0.14); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  }
  function render(t) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    drawBg();
    // previous + current trajectory dots
    [lastTrail, trail].forEach(function (tr, idx) { ctx.fillStyle = idx ? '#fff' : 'rgba(255,255,255,.55)'; tr.forEach(function (p) { var s = w2s(p.x, p.y); ctx.beginPath(); ctx.arc(s[0], s[1], Math.max(1.5, cam.s * (p.big ? 0.09 : 0.055)), 0, TAU); ctx.fill(); }); });
    drawSlingPost(false);
    // bird on sling
    var onSling = state === 'aim' && birdsLeft.length ? birdsLeft[0] : null, bx = SLING.x, by = SLING.y;
    if (onSling && drag) { var pv = pullVec(); bx += pv[0]; by += pv[1]; }
    if (onSling) { band(bx - 0.25, by, -0.35); drawBird(onSling, bx, by, drag ? Math.atan2(-(by - SLING.y), -(bx - SLING.x)) : 0); band(bx - 0.25, by, 0.35); }
    else { var a1 = w2s(SLING.x - 0.35, SLING.y + 0.1), a2 = w2s(SLING.x + 0.35, SLING.y + 0.1); ctx.strokeStyle = '#3a1a06'; ctx.lineWidth = Math.max(3, cam.s * 0.14); ctx.beginPath(); ctx.moveTo(a1[0], a1[1]); ctx.lineTo(a2[0], a2[1]); ctx.stroke(); }
    drawSlingPost(true);
    // queue of waiting birds on the ground
    birdsLeft.slice(onSling ? 1 : 0).forEach(function (bt, i) { drawBird(bt, -1.1 - i * 0.95, BIRD[bt].r, 0); });
    blocks.forEach(drawBlock);
    avos.forEach(function (a) { drawAvo(a, t); });
    [bird].concat(extraBirds).forEach(function (bd) { if (bd && !bd.dead) { var p = bd.body.getPosition(); drawBird(bd.type, p.x, p.y, bd.body.getAngle()); } });
    // particles
    particles.forEach(function (p) {
      var s = w2s(p.x, p.y);
      if (p.c === 'smoke') { ctx.globalAlpha = Math.max(0, Math.min(1, p.t)) * 0.85; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s[0], s[1], p.sz * cam.s * (1.6 - p.t * 0.5), 0, TAU); ctx.fill(); }
      else if (p.c === 'flash') { ctx.globalAlpha = p.t / p.t0; var g = ctx.createRadialGradient(s[0], s[1], 0, s[0], s[1], p.sz * cam.s); g.addColorStop(0, '#fff'); g.addColorStop(0.4, '#ffd84a'); g.addColorStop(1, 'rgba(255,90,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s[0], s[1], p.sz * cam.s, 0, TAU); ctx.fill(); }
      else { ctx.globalAlpha = Math.min(1, p.t * 2); ctx.fillStyle = p.c; ctx.save(); ctx.translate(s[0], s[1]); ctx.rotate(p.a || 0); var z = p.sz * cam.s; if (p.rect) ctx.fillRect(-z, -z / 2, z * 2, z); else { ctx.beginPath(); ctx.ellipse(0, 0, z, z * 0.6, 0, 0, TAU); ctx.fill(); } ctx.restore(); }
    });
    ctx.globalAlpha = 1;
    popups.forEach(function (p) {
      var s = w2s(p.x, p.y), sz = Math.max(18, p.s * cam.s * 1.1) * (p.t > 1.1 ? 1 + (p.t - 1.1) * 2 : 1);
      ctx.globalAlpha = Math.min(1, p.t * 2); ctx.font = '900 ' + sz + 'px "Arial Black", Impact, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = sz / 6; ctx.strokeStyle = '#000'; ctx.strokeText(p.txt, s[0], s[1]); ctx.fillStyle = p.c; ctx.fillText(p.txt, s[0], s[1]);
    });
    ctx.globalAlpha = 1;
    if (state === 'aim' && !drag && birdsLeft.length && simTime > 2 && simTime < 9 && !lastTrail.length) {
      var ty = H * 0.22; ctx.font = '900 18px Arial'; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = '#000'; ctx.fillStyle = '#fff'; ['Drag back & release to fling!', 'Swipe the right side to look around'].forEach(function (s, j) { ctx.font = '900 ' + (j ? 14 : 18) + 'px Arial'; ctx.strokeText(s, W / 2, ty + j * 24); ctx.fillText(s, W / 2, ty + j * 24); });
    }
  }
  function updateFx(dt) {
    particles.forEach(function (p) { p.t -= dt; if (p.c !== 'flash') { p.x += (p.vx || 0) * dt; p.y += (p.vy || 0) * dt; if (p.c !== 'smoke') { p.vy -= 10 * (p.g || 1) * dt; p.a += (p.va || 0) * dt; if (p.y < 0.05) { p.y = 0.05; p.vy *= -0.3; p.vx *= 0.6; } } } });
    particles = particles.filter(function (p) { return p.t > 0; });
    popups.forEach(function (p) { p.t -= dt; p.y += 0.6 * dt; }); popups = popups.filter(function (p) { return p.t > 0; });
  }

  var last = performance.now(), acc = 0;
  function frame(now) {
    var dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (world && !paused && state !== 'select' && state !== 'menu') {
      acc += dt; var n = 0; while (acc >= STEP && n < 6) { step(); acc -= STEP; n++; } if (n === 6) acc = 0;
      updateFx(dt);
    }
    updateCamera(dt);
    if (world) render(now / 1000); else { ctx.setTransform(DPR, 0, 0, DPR, 0, 0); drawBg(); }
    requestAnimationFrame(frame);
  }
  window.addEventListener('resize', resize);
  resize(); requestAnimationFrame(frame);

  // menu backdrop: show level 1 scenery behind the title
  level = window.AB_LEVELS[0];

  window.AngryBurritos = {
    loadLevel: loadLevel, step: step, launch: launch, ability: ability, w2s: w2s, s2w: s2w,
    get cam() { return cam; }, skipOverview: function () { overviewT = 0; }, updateCamera: updateCamera,
    get s() { return { state: state, score: score, blocks: blocks.length, avos: avos.length, birdsLeft: birdsLeft.length, simTime: simTime }; },
    get blocks() { return blocks; }, get avos() { return avos; }, get bird() { return bird; }, sling: SLING
  };
})();
