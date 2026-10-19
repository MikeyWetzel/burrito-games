/* Angry Burritos — portrait kitchen-counter physics game: fling burritos off a giant fork at the
   Tex-Mex snack gang hiding in crates, salsa jars and molcajete slabs. Uses vendored Planck.js. */
(function () {
  'use strict';
  var pl = window.planck, Vec2 = pl.Vec2;
  var cv = document.getElementById('c'), ctx = cv.getContext('2d');
  var W, H, DPR;
  var $ = function (id) { return document.getElementById(id); };
  var TAU = Math.PI * 2, rand = function (a, b) { return a + Math.random() * (b - a); };

  // Materials keep their physics keys (wood/glass/stone) but are drawn as crates, salsa jars and molcajete slabs.
  var MAT = {
    wood: { density: 0.7, friction: 0.8, hp: 6, score: 500, colors: ['#d9a066', '#a8692f', '#f0c48a'] },
    glass: { density: 0.4, friction: 0.4, hp: 2.2, score: 500, colors: ['#d8432a', '#f4e9d8', '#7cb342'] },
    stone: { density: 2.2, friction: 0.9, hp: 16, score: 500, colors: ['#55504c', '#3b3734', '#7a736d'] }
  };
  // Hiding snacks (targets). Level kinds: plain -> rotating avocado/chip/lime/jalapeno, helmet -> salsa cup, king -> taco.
  var TGT = { avocado: { r: 0.4, hp: 2.2 }, chip: { r: 0.38, hp: 2.0 }, lime: { r: 0.36, hp: 2.2 }, jalapeno: { r: 0.38, hp: 2.4 }, salsa: { r: 0.42, hp: 5 }, taco: { r: 0.56, hp: 7 } };
  var PLAIN_CYCLE = ['avocado', 'chip', 'lime', 'jalapeno', 'avocado', 'chip'];
  // Burritos: classic = speed boost, breakfast = splits into 3, wet = heavy + salsa blast.
  var BIRD = { classic: { r: 0.36, density: 3, name: 'Classic' }, breakfast: { r: 0.28, density: 3, name: 'Breakfast' }, wet: { r: 0.42, density: 5, name: 'Wet' } };
  var SLING = { x: 0, y: 2.1 }, MAX_PULL = 1.8, LAUNCH_K = 9.6;
  var GROUND_FRAC = 0.8;
  // win-rule tuning
  var TGT_DROP = 0.9, TGT_TIP = Math.PI / 3, BLK_TIP = Math.PI / 4, BLK_DROP = 1.0, SETTLE_V2 = 0.05, SETTLE_T = 0.6, SHOT_CAP = 4, CLEAR_HOLD = 0.35;

  /* ---------- persistence ---------- */
  var prog; try { prog = JSON.parse(localStorage.getItem('ab-progress') || '{}'); } catch (e) { prog = {}; }
  function saveProg() { try { localStorage.setItem('ab-progress', JSON.stringify(prog)); } catch (e) { } }

  /* ---------- audio ---------- */
  var actx = null, muted = localStorage.getItem('ab-muted') === '1';
  function ac() { if (!actx) try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } if (actx && actx.state === 'suspended') actx.resume(); return actx; }
  function tone(f0, f1, d, v, type, delay) { if (muted) return; var a = ac(); if (!a) return; var t = a.currentTime + (delay || 0); var o = a.createOscillator(), g = a.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + d); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d); o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + d); }
  function noise(d, f0, f1, v, type) { if (muted) return; var a = ac(); if (!a) return; var n = a.sampleRate * d | 0, b = a.createBuffer(1, n, a.sampleRate), dd = b.getChannelData(0); for (var i = 0; i < n; i++) dd[i] = (Math.random() * 2 - 1) * (1 - i / n); var s = a.createBufferSource(); s.buffer = b; var f = a.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.setValueAtTime(f0, a.currentTime); f.frequency.exponentialRampToValueAtTime(f1, a.currentTime + d); var g = a.createGain(); g.gain.value = v; s.connect(f); f.connect(g); g.connect(a.destination); s.start(); }
  var sfx = {
    stretch: function () { tone(200, 500, 0.25, 0.08, 'sawtooth'); },
    launch: function () { noise(0.3, 500, 2500, 0.3); tone(400, 900, 0.2, 0.1, 'triangle'); },
    wood: function () { noise(0.12, 700, 300, 0.35); }, glass: function () { noise(0.25, 4000, 2500, 0.3, 'highpass'); tone(2000, 3000, 0.1, 0.05); },
    stone: function () { noise(0.15, 300, 120, 0.45, 'lowpass'); },
    pop: function () { noise(0.25, 900, 200, 0.3, 'lowpass'); tone(300, 90, 0.2, 0.2, 'sine'); },
    crunch: function () { noise(0.18, 3500, 1200, 0.35, 'highpass'); noise(0.12, 2000, 800, 0.25); },
    boom: function () { noise(0.8, 900, 40, 1, 'lowpass'); tone(110, 30, 0.6, 0.5, 'sawtooth'); }, split: function () { tone(800, 1600, 0.15, 0.12, 'triangle'); },
    win: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, f, 0.25, 0.12, 'triangle', i * 0.12); }); }, lose: function () { [392, 330, 262].forEach(function (f, i) { tone(f, f * 0.98, 0.3, 0.12, 'triangle', i * 0.18); }); }
  };
  function buzz(ms) { if (navigator.vibrate) try { navigator.vibrate(ms); } catch (e) { } }

  /* ---------- state ---------- */
  var world, levelIdx = 0, level, blocks = [], avos = [], birdsLeft = [], bird = null, extraBirds = [], particles = [], popups = [], trail = [], lastTrail = [];
  var state = 'menu', score = 0, simTime = 0, launchTime = 0, abilityUsed = false, settleT = 0, paused = false;
  var armed = false, clearT = 0, clearReason = '';
  var cam = { x: 8, y: 6, s: 20 }, camT = { x: 8, y: 6, s: 20 }, drag = null, toDestroy = [];

  function fitView() {
    var xl = -3, xr = (level ? level.right : 16) + 2.5, s = W / (xr - xl);
    s = Math.min(s, (H * GROUND_FRAC - 70) / 11);
    var cx = (xl + xr) / 2; if (W / s > xr - xl) cx = xl + W / s / 2;
    return { x: cx, y: (H * (GROUND_FRAC - 0.5)) / s, s: s };
  }
  function w2s(x, y) { return [W / 2 + (x - cam.x) * cam.s, H / 2 - (y - cam.y) * cam.s]; }
  function s2w(px, py) { return [cam.x + (px - W / 2) / cam.s, cam.y - (py - H / 2) / cam.s]; }

  function resize() { DPR = Math.min(window.devicePixelRatio || 1, 3); W = window.innerWidth; H = window.innerHeight; cv.width = W * DPR; cv.height = H * DPR; var f = fitView(); camT = f; if (state !== 'fly') { cam.x = f.x; cam.y = f.y; cam.s = f.s; } }

  /* ---------- level setup ---------- */
  var loadId = 0;
  var abBooted = false;
  function loadLevel(i) {
    if (abBooted) { try { window.BurritoPlay && window.BurritoPlay('angry-burritos'); } catch (e) {} }
    loadId++; levelIdx = i; level = window.AB_LEVELS[i];
    world = pl.World({ gravity: Vec2(0, -10) });
    var ground = world.createBody({ type: 'static', position: Vec2(0, 0) });
    ground.createFixture(pl.Box(200, 5, Vec2(0, -5), 0), { friction: 0.9 });
    ground.setUserData({ kind: 'ground' });
    blocks = []; avos = []; particles = []; popups = []; trail = []; lastTrail = []; extraBirds = []; bird = null; toDestroy = [];
    armed = false; clearT = 0; clearReason = '';
    var plainN = 0;
    level.build().forEach(function (it) {
      if (it.t === 'block') {
        var m = MAT[it.m], b = world.createBody({ type: 'dynamic', position: Vec2(it.x, it.y + it.h / 2) });
        b.createFixture(pl.Box(it.w / 2, it.h / 2), { density: m.density, friction: m.friction, restitution: 0.05 });
        var d = { kind: 'block', m: it.m, w: it.w, h: it.h, hp: m.hp * Math.sqrt(it.w * it.h / 0.3), dmg: 0, seed: Math.random() * 1000, body: b };
        b.setUserData(d); blocks.push(d);
      } else {
        var tk = it.kind === 'helmet' ? 'salsa' : it.kind === 'king' ? 'taco' : TGT[it.kind] ? it.kind : PLAIN_CYCLE[(levelIdx + plainN++) % PLAIN_CYCLE.length];
        var a = TGT[tk], ab = world.createBody({ type: 'dynamic', position: Vec2(it.x, it.y + a.r), angularDamping: 2 });
        ab.createFixture(pl.Circle(a.r), { density: 0.8, friction: 0.8, restitution: 0.1 });
        var ad = { kind: 'avo', type: tk, r: a.r, hp: a.hp, dmg: 0, body: ab, blink: rand(0, 4), hitT: 0 };
        ab.setUserData(ad); avos.push(ad);
      }
    });
    world.on('post-solve', onPostSolve);
    birdsLeft = level.birds.slice(); score = 0; simTime = 0; settleT = 0;
    state = 'aim'; paused = false; overviewT = 1.8; panX = 0;
    var f = fitView(); camT = f; cam.x = f.x; cam.y = f.y; cam.s = f.s;
    hideAll(); $('hud').style.display = 'flex'; updateHud();
  }
  // Snapshot every body's resting pose at the first shot (after the initial settle) so "knocked over" is
  // measured against where things actually rest, not where the builder spawned them.
  function arm() {
    armed = true;
    blocks.forEach(function (d) { d.y0 = d.body.getPosition().y; d.a0 = d.body.getAngle(); });
    avos.forEach(function (d) { d.y0 = d.body.getPosition().y; d.a0 = d.body.getAngle(); });
  }
  function angDiff(a, b) { var d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return Math.abs(d); }
  function blockDown(d) { if (d.dead) return true; var p = d.body.getPosition(); var drop = d.y0 - p.y, lift = d.y0 - Math.min(d.w, d.h) / 2; // lift = how high it rested above the counter
    return angDiff(d.body.getAngle(), d.a0) > BLK_TIP || drop > BLK_DROP || (drop > 0.3 && drop > lift * 0.5); }
  function targetOut(d) {
    if (d.dead) return true; var p = d.body.getPosition();
    return p.y < d.y0 - TGT_DROP || Math.abs(d.body.getAngle() - d.a0) > TGT_TIP || p.y < -1 || p.x > level.right + 8 || p.x < -6;
  }

  function onPostSolve(contact, impulse) {
    if (simTime < 1.2) return;
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
    if (d.kind === 'avo' && dmg > 0.15) d.hitT = 0.35;
    if (d.kind === 'block' && dmg > 0.5) { var nowT = simTime; if (!d.lastSnd || nowT - d.lastSnd > 0.15) { d.lastSnd = nowT; sfx[d.m](); } }
    if (d.dmg >= d.hp) kill(d);
  }
  function kill(d) { if (!d.dead) { d.dead = true; toDestroy.push(d); } }

  function destroyDead() {
    toDestroy.forEach(function (d) {
      var p = d.body.getPosition(), i;
      if (d.kind === 'block') {
        var m = MAT[d.m]; score += m.score; addPopup(String(m.score), p.x, p.y, '#fff3c4', 0.7);
        var cols = d.m === 'glass' ? ['rgba(225,240,255,.8)', '#d8432a', '#d8432a', '#7cb342'] : m.colors;
        for (i = 0; i < 10; i++) particles.push({ x: p.x + rand(-d.w / 2, d.w / 2), y: p.y + rand(-d.h / 2, d.h / 2), vx: rand(-3, 3), vy: rand(0, 5), a: rand(0, TAU), va: rand(-8, 8), sz: rand(0.08, 0.22), c: cols[i % cols.length], t: rand(0.8, 1.5), rect: d.m !== 'glass', tri: d.m === 'glass', stick: d.m === 'glass' && i % 4 === 1 });
        for (i = 0; i < 3; i++) smoke(p.x + rand(-d.w / 2, d.w / 2), p.y + rand(-d.h / 2, d.h / 2), 0.3);
        blocks.splice(blocks.indexOf(d), 1);
      } else if (d.kind === 'avo') {
        score += 5000; addPopup('5000', p.x, p.y + 0.7, '#ffe14a', 0.75); buzz(40); snackPop(d, p.x, p.y);
        avos.splice(avos.indexOf(d), 1);
      }
      world.destroyBody(d.body);
    });
    toDestroy = []; updateHud();
  }
  // per-snack pop animations
  function burst(x, y, n, cols, o) { for (var i = 0; i < n; i++) { var q = { x: x, y: y, vx: rand(-4, 4), vy: rand(1, 6), a: rand(0, TAU), va: rand(-9, 9), sz: rand(0.07, 0.16), c: cols[i % cols.length], t: rand(0.9, 1.6) }; for (var k in o) q[k] = typeof o[k] === 'function' ? o[k](i) : o[k]; particles.push(q); } }
  function snackPop(d, x, y) {
    var r = d.r;
    particles.push({ x: x, y: y, sz: r * 2.2, c: 'ring', t: 0.35, t0: 0.35, col: d.type === 'salsa' ? '#e0452a' : d.type === 'chip' || d.type === 'taco' ? '#ffcf3a' : '#9bd14a' });
    if (d.type === 'avocado') { // guac splat + bouncing pit
      sfx.pop(); burst(x, y, 14, ['#8cc63f', '#b8dc6a', '#6aa22a'], { stick: true, sz: function () { return rand(0.1, 0.2); } });
      particles.push({ x: x, y: y, vx: rand(-1.5, 1.5), vy: 5, a: 0, va: 6, sz: r * 0.35, c: '#7a4a22', t: 1.8, ball: true, g: 1 });
      addPopup('GUAC!', x, y + 1.9, '#b8e06a', 0.55);
    } else if (d.type === 'chip') { // crunch shards
      sfx.crunch(); burst(x, y, 16, ['#f4c542', '#e8a72a', '#ffdf7a', '#ff9f1c'], { tri: true, sz: function () { return rand(0.09, 0.2); } });
      addPopup('CRUNCH!', x, y + 1.9, '#ffd23a', 0.55);
    } else if (d.type === 'lime') {
      sfx.pop(); burst(x, y, 12, ['#c7ea7a', '#e8f7b0', '#5aa02c'], { sz: function () { return rand(0.05, 0.11); } });
      addPopup('SQUEEZE!', x, y + 1.9, '#d4f07a', 0.55);
    } else if (d.type === 'jalapeno') {
      sfx.pop(); burst(x, y, 12, ['#3f8f2a', '#2e6e1e', '#f4ead0', '#f4ead0'], { sz: function () { return rand(0.05, 0.12); } });
      for (var i = 0; i < 6; i++) particles.push({ x: x + rand(-0.3, 0.3), y: y, vx: rand(-0.5, 0.5), vy: rand(1.5, 3), sz: rand(0.15, 0.3), c: 'flame', t: rand(0.4, 0.8), t0: 0.8 });
      addPopup('HOT!', x, y + 1.9, '#ff7a2a', 0.55);
    } else if (d.type === 'salsa') {
      sfx.pop(); burst(x, y, 14, ['#d8432a', '#b52a18', '#f4e9d8', '#5aa02c'], { stick: function (i) { return i % 3 !== 2; } });
      burst(x, y, 6, ['rgba(230,240,250,.9)'], { tri: true });
      addPopup('SPLAT!', x, y + 1.9, '#ff6a4a', 0.55);
    } else { // taco
      sfx.crunch(); burst(x, y, 12, ['#f2c14e', '#e3a63a'], { tri: true }); burst(x, y, 10, ['#6cbf3a', '#8a4b22', '#d8432a', '#ffd23a'], {});
      addPopup('TACO DOWN!', x, y + 1.9, '#ffd23a', 0.55);
    }
  }
  function smoke(x, y, r) { particles.push({ x: x, y: y, vx: rand(-0.6, 0.6), vy: rand(0.2, 1.2), sz: r, c: 'smoke', t: rand(0.6, 1.1), t0: 1 }); }
  function addPopup(txt, x, y, color, size) { popups.push({ txt: txt, x: x, y: y, c: color, s: size || 0.8, t: 1.3 }); }
  function crumbs(x, y, n) { // tortilla bits, rice, beans
    var cols = ['#f2d38f', '#fff', '#fff', '#6b3d1e', '#d8321e'];
    for (var i = 0; i < n; i++) particles.push({ x: x, y: y, vx: rand(-3, 3), vy: rand(-1, 4), a: rand(0, TAU), va: rand(-6, 6), sz: rand(0.05, 0.12), c: cols[i % cols.length], t: rand(0.7, 1.4), g: 0.4 });
  }

  /* ---------- burritos ---------- */
  function spawnBird(type, x, y, vx, vy) {
    var bt = BIRD[type], b = world.createBody({ type: 'dynamic', position: Vec2(x, y), bullet: true, angularDamping: 0.6 });
    b.createFixture(pl.Circle(bt.r), { density: bt.density, friction: 0.6, restitution: 0.25 });
    b.setLinearVelocity(Vec2(vx, vy)); var d = { kind: 'bird', type: type, r: bt.r, body: b }; b.setUserData(d); return d;
  }
  function launch(pullX, pullY) {
    if (!birdsLeft.length || (state !== 'aim')) return;
    if (!armed) arm();
    var type = birdsLeft.shift(), vx = -pullX * LAUNCH_K, vy = -pullY * LAUNCH_K;
    bird = spawnBird(type, SLING.x + pullX, SLING.y + pullY, vx, vy);
    extraBirds = []; lastTrail = trail; trail = []; panX = 0; abilityUsed = false; launchTime = simTime; settleT = 0; state = 'fly';
    sfx.launch(); updateHud();
  }
  function ability() {
    if (!bird || bird.dead || abilityUsed || bird.hitOnce) return; abilityUsed = true;
    var p = bird.body.getPosition(), v = bird.body.getLinearVelocity();
    if (bird.type === 'breakfast') {
      sfx.split(); [-0.22, 0.22].forEach(function (da) { var c = Math.cos(da), s = Math.sin(da); extraBirds.push(spawnBird('breakfast', p.x, p.y + da * 0.8, v.x * c - v.y * s, v.x * s + v.y * c)); });
      crumbs(p.x, p.y, 8); addPopup('SPLIT!', p.x, p.y + 0.8, '#ffd23a', 0.6);
    } else if (bird.type === 'wet') {
      explode(p.x, p.y);
    } else if (bird.type === 'classic') {
      bird.body.setLinearVelocity(Vec2(v.x * 1.35, v.y * 1.1)); addPopup('¡OLÉ!', p.x, p.y + 0.8, '#ff7a2a', 0.7); tone(300, 700, 0.2, 0.15, 'square');
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
    burst(x, y, 22, ['#d8432a', '#b52a18', '#f4e9d8', '#f2d38f'], { stick: function (i) { return i % 2 === 0; }, vx: function () { return rand(-7, 7); }, vy: function () { return rand(-2, 8); } });
    particles.push({ x: x, y: y, sz: R, c: 'flash', t: 0.25, t0: 0.25 });
    addPopup('SALSA BLAST!', x, y + 1, '#ff5a3a', 0.8);
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
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; sfx.stretch(); try { cv.setPointerCapture(e.pointerId); } catch (x) { }
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
    $('lvlinfo').textContent = 'Level ' + (levelIdx + 1) + ' · ' + (level ? level.name : '') + ' · 🌯×' + birdsLeft.length;
    $('lvlbest').textContent = 'Best ' + best.toLocaleString();
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

  var DONE_DELAY = 900;
  function finish(won) {
    if (state === 'won' || state === 'lost') return;
    state = won ? 'won' : 'lost';
    var stars = 0;
    if (won) {
      // any snack still standing gets popped for the celebration
      avos.slice().forEach(function (a) { kill(a); }); destroyDead();
      [bird].concat(extraBirds).forEach(function (x) { if (x && !x.dead) { x.dead = true; world.destroyBody(x.body); } }); bird = null; extraBirds = [];
      var bonus = birdsLeft.length * 10000; if (bonus) addPopup('+' + bonus, SLING.x + 1, SLING.y + 2, '#ffd84a', 1);
      score += bonus; stars = birdsLeft.length >= 2 ? 3 : birdsLeft.length === 1 ? 2 : 1;
      var p = prog[levelIdx] || { stars: 0, best: 0 }; p.stars = Math.max(p.stars, stars); p.best = Math.max(p.best, score); prog[levelIdx] = p; saveProg();
      sfx.win();
    } else sfx.lose();
    updateHud(); var myId = loadId;
    setTimeout(function () {
      if (myId !== loadId) return;
      $('doneTitle').textContent = won ? 'Level cleared!' : 'Out of burritos!';
      $('doneSub').textContent = won ? (clearReason === 'structures' ? 'Every structure knocked over!' : 'All the snacks are knocked out!') : 'Some snacks are still hiding. Try again!';
      $('doneStars').innerHTML = won ? starsHtml(stars) : '🥑🌶️';
      $('doneScore').textContent = score.toLocaleString();
      $('doneBest').textContent = 'Best: ' + ((prog[levelIdx] || {}).best || 0).toLocaleString();
      $('dNext').style.display = won ? '' : 'none';
      show('done');
    }, DONE_DELAY);
  }

  /* ---------- simulation ---------- */
  var STEP = 1 / 60;
  // Clear rule: every snack knocked out (damaged, fallen, dropped > ~1 block, tipped > 60°) OR every block knocked over (> 45° or dropped).
  function clearStatus() {
    if (!armed) return null;
    if (avos.every(targetOut)) return 'snacks';
    if (blocks.every(blockDown)) return 'structures';
    return null;
  }
  function step() {
    world.step(STEP, 10, 8); simTime += STEP;
    avos.forEach(function (a) { var p = a.body.getPosition(); if (p.y < -3 || Math.abs(p.x) > 60) kill(a); if (a.hitT > 0) a.hitT -= STEP; });
    blocks.forEach(function (b) { var p = b.body.getPosition(); if (p.y < -3) kill(b); });
    // a knocked-out snack (fell, dropped, tipped) pops right away so the player sees it count
    if (armed) avos.forEach(function (a) { if (!a.dead && targetOut(a)) kill(a); });
    destroyDead();
    if (state === 'won' || state === 'lost') return;
    var cs = clearStatus();
    clearT = cs ? clearT + STEP : 0;
    if (cs && clearT >= CLEAR_HOLD) { clearReason = cs; return finish(true); }
    if (state === 'fly') {
      var tb = bird && !bird.dead ? bird : null;
      if (tb) { var p = tb.body.getPosition(); var last = trail[trail.length - 1]; if (!tb.hitOnce && (!last || Math.hypot(p.x - last.x, p.y - last.y) > 0.45)) trail.push({ x: p.x, y: p.y, big: trail.length % 3 === 0 }); }
      // settle: every dynamic body (awake or asleep) slow for SETTLE_T, or hard cap after the shot
      var moving = false;
      for (var b = world.getBodyList(); b; b = b.getNext()) { if (b.getType() === 'dynamic') { var v = b.getLinearVelocity(); if (v.x * v.x + v.y * v.y > SETTLE_V2 || Math.abs(b.getAngularVelocity()) > 0.5) { moving = true; break; } } }
      settleT = moving ? 0 : settleT + STEP;
      var allBirds = [bird].concat(extraBirds).filter(function (x) { return x && !x.dead; });
      allBirds.forEach(function (x) { var q = x.body.getPosition(); if (q.x > level.right + 15 || q.x < -10 || q.y < -3) { x.dead = true; world.destroyBody(x.body); } });
      if (settleT > SETTLE_T || simTime - launchTime > SHOT_CAP) {
        allBirds.forEach(function (x) { if (!x.dead) { var q = x.body.getPosition(); crumbs(q.x, q.y, 10); smoke(q.x, q.y, 0.5); x.dead = true; world.destroyBody(x.body); } });
        bird = null; extraBirds = [];
        cs = clearStatus(); if (cs) { clearReason = cs; return finish(true); }
        if (!birdsLeft.length) return finish(false);
        state = 'aim'; panX = 0;
      }
    }
  }

  /* ---------- camera ---------- */
  var overviewT = 0, panX = 0, pan = null;
  function aimView() {
    var f = fitView(), s = Math.max(f.s, Math.min(W / 7.6, (H * GROUND_FRAC - 80) / 8.5));
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
    } else if (state === 'fly') { }
    else if (state === 'won' || state === 'lost' || state === 'menu') camT = f;
    else camT = a;
    var k = 1 - Math.pow(overviewT > 0 ? 0.2 : 0.03, dt);
    cam.x += (camT.x - cam.x) * k; cam.y += (camT.y - cam.y) * k; cam.s += (camT.s - cam.s) * k;
  }

  /* ---------- drawing ---------- */
  function rr(x, y, w, h, r) { r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  var FLAG_COLS = ['#e83f6f', '#ffbf00', '#2bb3a3', '#7d4cdb', '#ff7a2a', '#3a86ff'];
  function drawBg(t) {
    var gy = w2s(0, 0)[1], sc = cam.s;
    // warm cantina wall
    var gr = ctx.createLinearGradient(0, 0, 0, gy); gr.addColorStop(0, '#f3c27a'); gr.addColorStop(0.55, '#eaa25e'); gr.addColorStop(1, '#d9834a'); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, gy + 2);
    // adobe texture speckles
    ctx.fillStyle = 'rgba(160,80,30,.10)'; for (var k = 0; k < 60; k++) { var px = ((k * 137.5 - cam.x * sc * 0.4) % (W + 60) + W + 60) % (W + 60) - 30, py = (k * 71) % Math.max(40, gy - 30); ctx.beginPath(); ctx.ellipse(px, py, 5 + (k % 4) * 3, 2 + (k % 3), 0, 0, TAU); ctx.fill(); }
    // window with desert view (parallax), arched cantina style
    var wx0 = W / 2 + (6 - cam.x * 0.5) * sc * 0.8, wyTop = gy - 9.2 * sc * 0.8, ww = 4.2 * sc * 0.8, wh = 4.2 * sc * 0.8;
    ctx.save(); ctx.beginPath(); ctx.moveTo(wx0, wyTop + wh); ctx.lineTo(wx0, wyTop + ww / 2); ctx.arc(wx0 + ww / 2, wyTop + ww / 2, ww / 2, Math.PI, 0); ctx.lineTo(wx0 + ww, wyTop + wh); ctx.closePath();
    ctx.fillStyle = '#8a4b22'; ctx.lineWidth = Math.max(4, sc * 0.25); ctx.strokeStyle = '#8a4b22'; ctx.stroke(); ctx.clip();
    var dg = ctx.createLinearGradient(0, wyTop, 0, wyTop + wh); dg.addColorStop(0, '#ff9e5e'); dg.addColorStop(0.6, '#ffd59a'); dg.addColorStop(1, '#ffe2b0'); ctx.fillStyle = dg; ctx.fillRect(wx0, wyTop, ww, wh);
    ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.arc(wx0 + ww * 0.7, wyTop + wh * 0.45, ww * 0.12, 0, TAU); ctx.fill();
    ctx.fillStyle = '#c9744a'; ctx.beginPath(); ctx.moveTo(wx0, wyTop + wh); ctx.lineTo(wx0, wyTop + wh * 0.72); ctx.lineTo(wx0 + ww * 0.25, wyTop + wh * 0.62); ctx.lineTo(wx0 + ww * 0.32, wyTop + wh * 0.7); ctx.lineTo(wx0 + ww * 0.6, wyTop + wh * 0.66); ctx.lineTo(wx0 + ww * 0.68, wyTop + wh * 0.58); ctx.lineTo(wx0 + ww, wyTop + wh * 0.7); ctx.lineTo(wx0 + ww, wyTop + wh); ctx.fill();
    ctx.fillStyle = '#4f7d3a'; var cx = wx0 + ww * 0.25, cb = wyTop + wh, cw = ww * 0.07; rr(cx - cw / 2, cb - wh * 0.42, cw, wh * 0.42, cw / 2); ctx.fill(); rr(cx - cw * 2, cb - wh * 0.3, cw * 0.8, wh * 0.14, cw / 2); ctx.fill(); rr(cx - cw * 2, cb - wh * 0.3, cw * 0.8, wh * 0.08 + cw, cw / 2); ctx.fill(); rr(cx + cw * 0.9, cb - wh * 0.36, cw * 0.8, wh * 0.12, cw / 2); ctx.fill();
    ctx.restore();
    // papel picado banners
    [[0.25, gy - 10.6 * sc * 0.8], [0.35, gy - 9.0 * sc * 0.8]].forEach(function (row, ri) {
      var fw = 0.9 * sc * 0.8, off = ((-cam.x * row[0] * sc) % (fw * 1.25) + fw * 1.25) % (fw * 1.25) - fw * 1.25, y0 = row[1];
      ctx.strokeStyle = 'rgba(80,40,20,.6)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, y0); ctx.lineTo(W, y0); ctx.stroke();
      for (var x = off, n = 0; x < W + fw; x += fw * 1.25, n++) {
        var sway = Math.sin(t * 1.5 + n + ri) * 0.05;
        ctx.save(); ctx.translate(x + fw / 2, y0); ctx.rotate(sway);
        ctx.fillStyle = FLAG_COLS[(n + ri * 3 + Math.round(cam.x * row[0] / 1.125)) % FLAG_COLS.length]; ctx.beginPath(); ctx.moveTo(-fw / 2, 0); ctx.lineTo(fw / 2, 0); ctx.lineTo(fw / 2, fw * 0.9); for (var z = 4; z >= 0; z--) ctx.lineTo(-fw / 2 + fw * z / 4, fw * (z % 2 ? 0.9 : 1.05)); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.arc(0, fw * 0.4, fw * 0.14, 0, TAU); ctx.fill(); ctx.fillRect(-fw * 0.32, fw * 0.18, fw * 0.1, fw * 0.1); ctx.fillRect(fw * 0.22, fw * 0.18, fw * 0.1, fw * 0.1); ctx.fillRect(-fw * 0.05, fw * 0.7, fw * 0.1, fw * 0.1);
        ctx.restore();
      }
    });
    // hanging chili ristra + shelf with hot sauce bottles (parallax 0.6)
    var shx = W / 2 + (13 - cam.x * 0.6) * sc * 0.8 - (cam.x * 0.4 - 4) * 0, shy = gy - 5.6 * sc * 0.8, shw = 5 * sc * 0.8, u = sc * 0.8;
    ctx.fillStyle = '#7a4320'; ctx.fillRect(shx, shy, shw, u * 0.18); ctx.fillStyle = '#5a2f14'; ctx.fillRect(shx, shy + u * 0.18, shw, u * 0.06);
    [['#c62828', 0.5], ['#2e7d32', 1.2], ['#ff8f00', 1.9], ['#6a1b9a', 2.6], ['#c62828', 3.4], ['#1565c0', 4.2]].forEach(function (bt, i) {
      var bx = shx + bt[1] * u, bh = (0.9 + (i % 3) * 0.2) * u; ctx.fillStyle = bt[0]; rr(bx - u * 0.17, shy - bh, u * 0.34, bh, u * 0.08); ctx.fill(); ctx.fillRect(bx - u * 0.07, shy - bh - u * 0.25, u * 0.14, u * 0.3);
      ctx.fillStyle = '#fff4d6'; ctx.fillRect(bx - u * 0.14, shy - bh * 0.65, u * 0.28, bh * 0.3); ctx.fillStyle = '#222'; ctx.fillRect(bx - u * 0.08, shy - bh - u * 0.32, u * 0.16, u * 0.1);
    });
    var rx = W / 2 + (1.5 - cam.x * 0.5) * sc * 0.8, ry = gy - 10 * sc * 0.8;
    ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx, ry + 3.3 * u); ctx.stroke();
    for (var c = 0; c < 9; c++) { var cyy = ry + (0.5 + c * 0.32) * u, sd = c % 2 ? 1 : -1; ctx.fillStyle = c % 3 ? '#c62828' : '#b71c1c'; ctx.save(); ctx.translate(rx + sd * u * 0.12, cyy); ctx.rotate(sd * 0.5); ctx.beginPath(); ctx.ellipse(0, 0, u * 0.1, u * 0.26, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#4a7a2a'; ctx.fillRect(-u * 0.04, -u * 0.3, u * 0.08, u * 0.08); ctx.restore(); }
    // talavera tile backsplash just above the counter
    var tileH = 1.6 * sc, ts = Math.max(14, sc * 0.8), tx0 = ((-cam.x * sc) % ts + ts) % ts - ts;
    ctx.fillStyle = '#f7f1e3'; ctx.fillRect(0, gy - tileH, W, tileH);
    for (var row = 0; row * ts < tileH; row++) for (var xx = tx0; xx < W; xx += ts) {
      var yy = gy - tileH + row * ts, h2 = ts / 2, ci = (Math.round((xx - tx0) / ts) + row) % 2;
      ctx.fillStyle = ci ? '#1f5fa8' : '#e6a21f'; ctx.beginPath(); ctx.moveTo(xx + h2, yy + ts * 0.15); ctx.lineTo(xx + ts * 0.85, yy + h2); ctx.lineTo(xx + h2, yy + ts * 0.85); ctx.lineTo(xx + ts * 0.15, yy + h2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#f7f1e3'; ctx.beginPath(); ctx.arc(xx + h2, yy + h2, ts * 0.13, 0, TAU); ctx.fill();
      ctx.fillStyle = ci ? '#e6a21f' : '#1f5fa8'; [[0, 0], [ts, 0], [0, ts], [ts, ts]].forEach(function (q) { ctx.beginPath(); ctx.arc(xx + q[0], yy + q[1], ts * 0.12, 0, TAU); ctx.fill(); });
      ctx.strokeStyle = 'rgba(120,100,80,.35)'; ctx.lineWidth = 1; ctx.strokeRect(xx, yy, ts, ts);
    }
    ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(0, gy - tileH, W, 3);
    // butcher-block counter top + cabinet front
    var top = Math.max(10, sc * 0.45);
    var cg = ctx.createLinearGradient(0, gy, 0, gy + top); cg.addColorStop(0, '#d79a5c'); cg.addColorStop(1, '#b27440'); ctx.fillStyle = cg; ctx.fillRect(0, gy, W, top);
    ctx.strokeStyle = 'rgba(90,45,15,.35)'; ctx.lineWidth = 1; var sx0 = ((-cam.x * sc) % (sc * 1.4) + sc * 1.4) % (sc * 1.4) - sc * 1.4;
    for (var x2 = sx0; x2 < W; x2 += sc * 1.4) { ctx.beginPath(); ctx.moveTo(x2, gy); ctx.lineTo(x2, gy + top); ctx.stroke(); }
    ctx.fillStyle = '#7a3e1c'; ctx.fillRect(0, gy + top, W, H - gy - top); ctx.fillStyle = '#5e2e12'; ctx.fillRect(0, gy + top, W, 4);
    var pw = sc * 3.2, px0 = ((-cam.x * sc) % pw + pw) % pw - pw;
    for (var x3 = px0; x3 < W; x3 += pw) { ctx.strokeStyle = '#5e2e12'; ctx.lineWidth = Math.max(2, sc * 0.08); rr(x3 + pw * 0.08, gy + top + 14, pw * 0.84, H - gy - top - 24, 8); ctx.stroke(); ctx.fillStyle = '#e6b84a'; ctx.beginPath(); ctx.arc(x3 + pw / 2, gy + top + 28, Math.max(3, sc * 0.1), 0, TAU); ctx.fill(); }
  }
  function worldTx(x, y, a) { var p = w2s(x, y); ctx.translate(p[0], p[1]); ctx.rotate(-a); ctx.scale(cam.s, cam.s); }
  function drawBlock(d) {
    var b = d.body, p = b.getPosition(), w = d.w, h = d.h, i, e = Math.min(w, h);
    ctx.save(); worldTx(p.x, p.y, b.getAngle()); ctx.lineJoin = 'round';
    if (d.m === 'wood') { // produce crate
      ctx.fillStyle = '#d9a066'; ctx.fillRect(-w / 2, -h / 2, w, h);
      var horiz = w >= h, n = Math.max(2, Math.round((horiz ? h : w) / 0.12));
      ctx.strokeStyle = 'rgba(120,60,20,.45)'; ctx.lineWidth = 0.02; ctx.beginPath();
      for (i = 1; i < n; i++) { if (horiz) { var yy = -h / 2 + h * i / n; ctx.moveTo(-w / 2, yy); ctx.lineTo(w / 2, yy); } else { var xx = -w / 2 + w * i / n; ctx.moveTo(xx, -h / 2); ctx.lineTo(xx, h / 2); } } ctx.stroke();
      ctx.strokeStyle = '#a8692f'; ctx.lineWidth = Math.min(0.08, e * 0.22); ctx.strokeRect(-w / 2 + ctx.lineWidth / 2, -h / 2 + ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);
      if (e > 0.4) { ctx.beginPath(); ctx.moveTo(-w / 2 + 0.06, -h / 2 + 0.06); ctx.lineTo(w / 2 - 0.06, h / 2 - 0.06); ctx.stroke(); }
      else { ctx.fillStyle = '#6e4220'; var L = Math.max(w, h); for (i = 0; i < 2; i++) { var o = (i ? 1 : -1) * (L / 2 - 0.08); ctx.beginPath(); ctx.arc(horiz ? o : 0, horiz ? 0 : o, 0.025, 0, TAU); ctx.fill(); } }
      if (e > 0.5) { ctx.fillStyle = 'rgba(140,50,20,.55)'; ctx.font = '900 ' + (e * 0.22) + 'px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('CHILES', 0, h * 0.18); }
      ctx.strokeStyle = '#6e3e16'; ctx.lineWidth = 0.035; ctx.strokeRect(-w / 2, -h / 2, w, h);
    } else if (d.m === 'glass') { // glass salsa jar on its side or standing
      var vert = h >= w, lidAt = vert ? -h / 2 : -w / 2, lid = Math.min(0.12, (vert ? h : w) * 0.15);
      rr(-w / 2, -h / 2, w, h, e * 0.3); ctx.fillStyle = 'rgba(225,240,250,.35)'; ctx.fill();
      ctx.save(); rr(-w / 2, -h / 2, w, h, e * 0.3); ctx.clip();
      ctx.fillStyle = 'rgba(206,52,30,.85)'; if (vert) ctx.fillRect(-w / 2, -h / 2 + h * 0.22, w, h); else ctx.fillRect(-w / 2, -h / 2 + h * 0.25, w, h);
      for (i = 0; i < 10; i++) { ctx.fillStyle = i % 3 === 0 ? '#f4e9d8' : i % 3 === 1 ? '#6aa22a' : '#9e1f10'; ctx.beginPath(); ctx.arc(Math.sin(d.seed + i * 7.3) * w * 0.4, Math.abs(Math.cos(d.seed + i * 3.1)) * h * 0.4 - h * 0.05 + h * 0.12, e * 0.07, 0, TAU); ctx.fill(); }
      ctx.restore();
      ctx.fillStyle = '#c9cfd6'; if (vert) ctx.fillRect(-w / 2 - 0.02, lidAt, w + 0.04, lid); else ctx.fillRect(lidAt, -h / 2 - 0.02, lid, h + 0.04);
      ctx.fillStyle = 'rgba(255,255,255,.65)'; if (vert) ctx.fillRect(-w / 2 + w * 0.15, -h / 2 + lid + 0.04, Math.max(0.03, w * 0.12), h * 0.6); else ctx.fillRect(-w / 2 + lid + 0.04, -h / 2 + h * 0.15, w * 0.6, Math.max(0.03, h * 0.12));
      rr(-w / 2, -h / 2, w, h, e * 0.3); ctx.strokeStyle = 'rgba(70,110,140,.9)'; ctx.lineWidth = 0.035; ctx.stroke();
    } else { // basalt molcajete slab
      rr(-w / 2, -h / 2, w, h, e * 0.18); ctx.fillStyle = '#55504c'; ctx.fill();
      ctx.fillStyle = '#3b3734'; var np = Math.max(5, Math.round(w * h * 14)); for (i = 0; i < np; i++) { ctx.beginPath(); ctx.arc(Math.sin(d.seed + i * 7) * w * 0.42, Math.cos(d.seed * 1.3 + i * 3) * h * 0.42, 0.03 + (i % 3) * 0.012, 0, TAU); ctx.fill(); }
      ctx.fillStyle = 'rgba(255,255,255,.14)'; rr(-w / 2 + 0.04, -h / 2 + 0.03, w - 0.08, Math.min(0.07, h * 0.25), 0.03); ctx.fill();
      rr(-w / 2, -h / 2, w, h, e * 0.18); ctx.strokeStyle = '#26221f'; ctx.lineWidth = 0.05; ctx.stroke();
    }
    var f = d.dmg / d.hp; if (f > 0.25) {
      ctx.strokeStyle = d.m === 'glass' ? '#fff' : d.m === 'stone' ? '#1a1715' : 'rgba(60,25,0,.8)'; ctx.lineWidth = 0.035; ctx.beginPath();
      var nc = f > 0.6 ? 4 : 2; for (i = 0; i < nc; i++) { var cx = Math.sin(d.seed * (i + 1)) * w * 0.3, cy = Math.cos(d.seed * (i + 2)) * h * 0.3; ctx.moveTo(cx, cy); for (var k = 0; k < 3; k++) { cx += Math.sin(d.seed + i * 5 + k) * 0.18; cy += Math.cos(d.seed + i * 3 + k * 2) * 0.18; ctx.lineTo(Math.max(-w / 2, Math.min(w / 2, cx)), Math.max(-h / 2, Math.min(h / 2, cy))); } }
      ctx.stroke();
    }
    ctx.restore();
  }
  // simple cute face (no brows, no beak): dot eyes + smile + blush. +y is down in local frames.
  function cuteFace(cx, cy, s, blink, worried) {
    ctx.fillStyle = '#2a1a0e';
    [-1, 1].forEach(function (k) { ctx.beginPath(); if (blink) ctx.ellipse(cx + k * s * 0.32, cy, s * 0.12, s * 0.03, 0, 0, TAU); else ctx.arc(cx + k * s * 0.32, cy, s * 0.11, 0, TAU); ctx.fill(); });
    if (!blink) { ctx.fillStyle = '#fff'; [-1, 1].forEach(function (k) { ctx.beginPath(); ctx.arc(cx + k * s * 0.32 + s * 0.04, cy - s * 0.04, s * 0.04, 0, TAU); ctx.fill(); }); }
    ctx.fillStyle = 'rgba(255,110,120,.5)'; [-1, 1].forEach(function (k) { ctx.beginPath(); ctx.ellipse(cx + k * s * 0.52, cy + s * 0.2, s * 0.12, s * 0.07, 0, 0, TAU); ctx.fill(); });
    ctx.strokeStyle = '#2a1a0e'; ctx.lineWidth = s * 0.07; ctx.lineCap = 'round'; ctx.beginPath();
    if (worried) ctx.ellipse(cx, cy + s * 0.27, s * 0.09, s * 0.11, 0, 0, TAU); else ctx.arc(cx, cy + s * 0.14, s * 0.15, 0.25, Math.PI - 0.25);
    ctx.stroke();
  }
  function drawTarget(d, t) {
    var b = d.body, p = b.getPosition(), r = d.r, blink = ((t + d.blink) % 4) < 0.12, hit = d.hitT > 0;
    ctx.save(); worldTx(p.x, p.y, d.type === 'lime' || d.type === 'salsa' ? b.getAngle() : b.getAngle() * 0.999);
    if (hit) { var q = d.hitT / 0.35; ctx.scale(1 + 0.25 * q, 1 - 0.2 * q); ctx.rotate(Math.sin(d.hitT * 60) * 0.12 * q); }
    ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.lineWidth = r * 0.08;
    var ty = d.type;
    if (ty === 'avocado') { // half avocado with pit
      ctx.fillStyle = '#2f5a14'; ctx.beginPath(); ctx.moveTo(0, -r * 1.05); ctx.bezierCurveTo(r * 0.55, -r * 1.05, r * 0.6, -r * 0.35, r * 0.9, r * 0.2); ctx.bezierCurveTo(r * 1.1, r * 0.95, -r * 1.1, r * 0.95, -r * 0.9, r * 0.2); ctx.bezierCurveTo(-r * 0.6, -r * 0.35, -r * 0.55, -r * 1.05, 0, -r * 1.05); ctx.fill();
      ctx.fillStyle = '#d6ea8a'; ctx.save(); ctx.translate(0, r * 0.05); ctx.scale(0.84, 0.84); ctx.beginPath(); ctx.moveTo(0, -r * 1.05); ctx.bezierCurveTo(r * 0.55, -r * 1.05, r * 0.6, -r * 0.35, r * 0.9, r * 0.2); ctx.bezierCurveTo(r * 1.1, r * 0.95, -r * 1.1, r * 0.95, -r * 0.9, r * 0.2); ctx.bezierCurveTo(-r * 0.6, -r * 0.35, -r * 0.55, -r * 1.05, 0, -r * 1.05); ctx.fill(); ctx.restore();
      ctx.fillStyle = '#8a5226'; ctx.beginPath(); ctx.arc(0, r * 0.38, r * 0.3, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.arc(-r * 0.09, r * 0.3, r * 0.08, 0, TAU); ctx.fill();
      cuteFace(0, -r * 0.3, r * 0.75, blink, hit);
    } else if (ty === 'chip') { // nacho chip with cheese drip
      ctx.fillStyle = '#f4c542'; ctx.strokeStyle = '#c88a1a'; ctx.beginPath(); ctx.moveTo(0, -r * 1.05); ctx.quadraticCurveTo(r * 0.6, -r * 0.1, r * 1.0, r * 0.75); ctx.quadraticCurveTo(0, r * 0.95, -r * 1.0, r * 0.75); ctx.quadraticCurveTo(-r * 0.6, -r * 0.1, 0, -r * 1.05); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ff9f1c'; ctx.beginPath(); ctx.moveTo(-r * 0.45, -r * 0.2); ctx.quadraticCurveTo(0, -r * 0.45, r * 0.45, -r * 0.2); ctx.lineTo(r * 0.38, r * 0.05); ctx.arc(r * 0.3, r * 0.05, r * 0.08, 0, Math.PI); ctx.lineTo(r * 0.1, -r * 0.05); ctx.lineTo(r * 0.02, r * 0.18); ctx.arc(-r * 0.06, r * 0.18, r * 0.08, 0, Math.PI); ctx.lineTo(-r * 0.2, -r * 0.08); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.7)'; [[-0.5, 0.5], [0.4, 0.6], [0.1, 0.65], [-0.2, 0.55]].forEach(function (s) { ctx.fillRect(s[0] * r, s[1] * r, r * 0.05, r * 0.05); });
      cuteFace(0, r * 0.28, r * 0.6, blink, hit);
    } else if (ty === 'lime') { // lime slice
      ctx.fillStyle = '#3f8f2a'; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
      ctx.fillStyle = '#f2f8d8'; ctx.beginPath(); ctx.arc(0, 0, r * 0.86, 0, TAU); ctx.fill();
      ctx.fillStyle = '#b7e06a'; for (i = 0; i < 8; i++) { ctx.beginPath(); ctx.moveTo(Math.cos(i * TAU / 8 + 0.06) * r * 0.1, Math.sin(i * TAU / 8 + 0.06) * r * 0.1); ctx.arc(0, 0, r * 0.76, i * TAU / 8 + 0.08, (i + 1) * TAU / 8 - 0.08); ctx.closePath(); ctx.fill(); }
      cuteFace(0, -r * 0.05, r * 0.7, blink, hit);
    } else if (ty === 'jalapeno') {
      ctx.fillStyle = '#3f8f2a'; ctx.strokeStyle = '#25591a'; ctx.beginPath(); ctx.moveTo(-r * 0.25, -r * 0.8); ctx.bezierCurveTo(r * 0.75, -r * 0.85, r * 0.75, r * 0.4, r * 0.15, r * 1.0); ctx.bezierCurveTo(r * 0.0, r * 1.05, -r * 0.65, r * 0.4, -r * 0.6, -r * 0.3); ctx.bezierCurveTo(-r * 0.6, -r * 0.65, -r * 0.45, -r * 0.8, -r * 0.25, -r * 0.8); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#6a8a2a'; ctx.lineWidth = r * 0.14; ctx.beginPath(); ctx.moveTo(-r * 0.15, -r * 0.8); ctx.quadraticCurveTo(-r * 0.1, -r * 1.1, r * 0.2, -r * 1.12); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(-r * 0.3, -r * 0.3, r * 0.08, r * 0.3, 0.2, 0, TAU); ctx.fill();
      cuteFace(r * 0.05, -r * 0.15, r * 0.6, blink, hit);
    } else if (ty === 'salsa') { // salsa cup with lid
      ctx.fillStyle = 'rgba(230,240,250,.6)'; ctx.strokeStyle = '#8aa2b4'; ctx.beginPath(); ctx.moveTo(-r * 0.85, -r * 0.6); ctx.lineTo(r * 0.85, -r * 0.6); ctx.lineTo(r * 0.65, r * 0.95); ctx.lineTo(-r * 0.65, r * 0.95); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#d8432a'; ctx.beginPath(); ctx.moveTo(-r * 0.8, -r * 0.4); ctx.lineTo(r * 0.8, -r * 0.4); ctx.lineTo(r * 0.63, r * 0.9); ctx.lineTo(-r * 0.63, r * 0.9); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#f4e9d8'; [[-0.4, 0.6], [0.45, 0.5], [0.0, 0.75]].forEach(function (s) { ctx.fillRect(s[0] * r, s[1] * r, r * 0.1, r * 0.1); }); ctx.fillStyle = '#6aa22a'; [[-0.1, 0.5], [0.3, 0.75]].forEach(function (s) { ctx.fillRect(s[0] * r, s[1] * r, r * 0.08, r * 0.08); });
      ctx.beginPath(); ctx.moveTo(-r * 0.85, -r * 0.6); ctx.lineTo(r * 0.85, -r * 0.6); ctx.lineTo(r * 0.65, r * 0.95); ctx.lineTo(-r * 0.65, r * 0.95); ctx.closePath(); ctx.stroke();
      ctx.fillStyle = '#eef3f7'; rr(-r * 0.98, -r * 0.82, r * 1.96, r * 0.26, r * 0.1); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff4d6'; rr(-r * 0.6, -r * 0.32, r * 1.2, r * 0.66, r * 0.12); ctx.fill();
      cuteFace(0, -r * 0.1, r * 0.55, blink, hit);
    } else { // taco
      ctx.fillStyle = '#6cbf3a'; for (var i = 0; i < 7; i++) { ctx.beginPath(); ctx.arc(-r * 0.75 + i * r * 0.25, -r * 0.05, r * 0.17, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#8a4b22'; ctx.fillRect(-r * 0.7, -r * 0.05, r * 1.4, r * 0.12); ctx.fillStyle = '#d8432a'; [-0.45, 0, 0.45].forEach(function (x) { ctx.beginPath(); ctx.arc(x * r, -r * 0.12, r * 0.1, 0, TAU); ctx.fill(); });
      ctx.fillStyle = '#ffd23a'; ctx.fillRect(-r * 0.6, -r * 0.2, r * 0.2, r * 0.08); ctx.fillRect(r * 0.2, -r * 0.22, r * 0.25, r * 0.08);
      ctx.fillStyle = '#f2c14e'; ctx.strokeStyle = '#c38a2a'; ctx.beginPath(); ctx.arc(0, -r * 0.05, r * 0.98, 0.0, Math.PI); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(160,100,30,.35)'; [[-0.5, 0.3], [0.4, 0.4], [0.0, 0.65], [0.6, 0.15]].forEach(function (s) { ctx.beginPath(); ctx.arc(s[0] * r, s[1] * r, r * 0.05, 0, TAU); ctx.fill(); });
      cuteFace(0, r * 0.32, r * 0.6, blink, hit);
    }
    if (d.dmg / d.hp > 0.4) { ctx.fillStyle = 'rgba(120,60,20,.35)'; ctx.beginPath(); ctx.arc(r * 0.4, -r * 0.35, r * 0.13, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  // Burrito: tortilla-wrapped cylinder with fillings visible at the ends; classic wears foil, wet is smothered in sauce.
  function drawBurritoShape(type, r) {
    var L = r * 1.25, R = r * 0.78; // half-length, half-thickness
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // body
    var g = ctx.createLinearGradient(0, -R, 0, R); g.addColorStop(0, type === 'breakfast' ? '#f6d98c' : '#f8e2a8'); g.addColorStop(1, type === 'breakfast' ? '#d9a750' : '#dcb46a');
    rr(-L, -R, L * 2, R * 2, R * 0.95); ctx.fillStyle = g; ctx.fill();
    // fillings showing at the front end
    ctx.save(); ctx.translate(L - R * 0.25, 0);
    ctx.fillStyle = '#f2e6c6'; ctx.beginPath(); ctx.ellipse(0, 0, R * 0.4, R * 0.86, 0, 0, TAU); ctx.fill();
    if (type === 'breakfast') { ctx.fillStyle = '#ffd23a'; ctx.beginPath(); ctx.ellipse(0, -R * 0.15, R * 0.3, R * 0.5, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#b5402a'; ctx.fillRect(-R * 0.18, R * 0.25, R * 0.36, R * 0.14); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(R * 0.05, R * 0.55, R * 0.12, 0, TAU); ctx.fill(); }
    else { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(0, -R * 0.4, R * 0.28, R * 0.28, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#6b3d1e'; ctx.beginPath(); ctx.ellipse(0, R * 0.1, R * 0.28, R * 0.25, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#5cbf2a'; ctx.beginPath(); ctx.ellipse(-R * 0.02, R * 0.5, R * 0.26, R * 0.2, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#d8432a'; ctx.beginPath(); ctx.arc(R * 0.08, -R * 0.12, R * 0.1, 0, TAU); ctx.arc(-R * 0.1, R * 0.3, R * 0.08, 0, TAU); ctx.fill(); }
    ctx.restore();
    // tortilla lip around the front filling
    ctx.strokeStyle = '#c99a4e'; ctx.lineWidth = R * 0.14; ctx.beginPath(); ctx.ellipse(L - R * 0.25, 0, R * 0.46, R * 0.92, 0, -Math.PI / 2, Math.PI / 2, true); ctx.stroke();
    // wrap fold lines + toast spots
    ctx.strokeStyle = 'rgba(160,110,40,.6)'; ctx.lineWidth = R * 0.08; ctx.beginPath(); ctx.moveTo(-L * 0.55, -R * 0.9); ctx.quadraticCurveTo(-L * 0.2, 0, -L * 0.5, R * 0.9); ctx.moveTo(L * 0.1, -R * 0.95); ctx.quadraticCurveTo(L * 0.35, -R * 0.2, L * 0.15, R * 0.6); ctx.stroke();
    ctx.fillStyle = 'rgba(150,90,30,.35)'; [[-0.2, -0.5], [0.3, 0.55], [-0.6, 0.35], [0.5, -0.55]].forEach(function (s) { ctx.beginPath(); ctx.ellipse(s[0] * L, s[1] * R, R * 0.12, R * 0.07, 0.4, 0, TAU); ctx.fill(); });
    if (type === 'classic') { // foil on the back half
      ctx.save(); rr(-L, -R, L * 2, R * 2, R * 0.95); ctx.clip();
      var fg = ctx.createLinearGradient(0, -R, 0, R); fg.addColorStop(0, '#f4f6f8'); fg.addColorStop(0.45, '#b9c1c9'); fg.addColorStop(1, '#8c959e'); ctx.fillStyle = fg;
      ctx.beginPath(); ctx.moveTo(-L - 0.1, -R - 0.1); ctx.lineTo(-L * 0.25, -R - 0.1); ctx.lineTo(-L * 0.38, -R * 0.4); ctx.lineTo(-L * 0.22, 0); ctx.lineTo(-L * 0.4, R * 0.5); ctx.lineTo(-L * 0.28, R + 0.1); ctx.lineTo(-L - 0.1, R + 0.1); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = R * 0.06; ctx.beginPath(); ctx.moveTo(-L * 0.9, -R * 0.5); ctx.lineTo(-L * 0.6, -R * 0.2); ctx.moveTo(-L * 0.8, R * 0.3); ctx.lineTo(-L * 0.5, R * 0.5); ctx.stroke();
      ctx.restore();
    }
    if (type === 'wet') { // red sauce + crema drizzle
      ctx.save(); rr(-L, -R, L * 2, R * 2, R * 0.95); ctx.clip();
      ctx.fillStyle = '#c43a1e'; ctx.beginPath(); ctx.moveTo(-L, -R); ctx.lineTo(L, -R); ctx.lineTo(L, -R * 0.15);
      for (var k = 6; k >= 0; k--) { var x = -L + (L * 2) * k / 6; ctx.quadraticCurveTo(x + L / 6, -R * (k % 2 ? -0.35 : 0.05), x, -R * 0.15); }
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#fff8ea'; ctx.lineWidth = R * 0.1; ctx.beginPath(); ctx.moveTo(-L * 0.8, -R * 0.6); for (k = 0; k < 6; k++) ctx.lineTo(-L * 0.8 + k * L * 0.3, -R * (k % 2 ? 0.75 : 0.45)); ctx.stroke();
      ctx.fillStyle = '#5cbf2a'; [[-0.4, -0.7], [0.2, -0.8], [0.6, -0.6]].forEach(function (s) { ctx.fillRect(s[0] * L, s[1] * R, R * 0.12, R * 0.08); });
      ctx.restore();
    }
    rr(-L, -R, L * 2, R * 2, R * 0.95); ctx.strokeStyle = '#a7782f'; ctx.lineWidth = R * 0.09; ctx.stroke();
    cuteFace(L * 0.05, R * 0.05, R * 0.95, false, false);
  }
  function drawBird(type, x, y, a) { ctx.save(); worldTx(x, y, a); drawBurritoShape(type, BIRD[type].r); ctx.restore(); }
  // Giant fork stuck in the counter; the "band" is a stretchy melted-cheese strand between the outer tines.
  var TINE_X = [-0.36, -0.12, 0.12, 0.36];
  function drawFork(front) {
    ctx.save(); worldTx(SLING.x, 0, 0); ctx.lineCap = 'round';
    var top = -(SLING.y + 0.45), neck = -(SLING.y - 0.35);
    if (!front) {
      var hg = ctx.createLinearGradient(-0.15, 0, 0.15, 0); hg.addColorStop(0, '#8d969e'); hg.addColorStop(0.4, '#eef2f5'); hg.addColorStop(1, '#7c858d');
      ctx.fillStyle = hg; ctx.beginPath(); ctx.moveTo(-0.13, 0); ctx.lineTo(-0.1, -1.0); ctx.quadraticCurveTo(-0.42, neck + 0.25, -0.44, neck); ctx.lineTo(0.44, neck); ctx.quadraticCurveTo(0.42, neck + 0.25, 0.1, -1.0); ctx.lineTo(0.13, 0); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#5e666d'; ctx.lineWidth = 0.035; ctx.stroke();
      ctx.fillStyle = '#7a4320'; rr(-0.17, -0.95, 0.34, 0.95, 0.08); ctx.fill(); ctx.fillStyle = '#e6b84a'; [-0.25, -0.65].forEach(function (yy) { ctx.beginPath(); ctx.arc(0, yy, 0.04, 0, TAU); ctx.fill(); });
      [0, 1, 2, 3].forEach(function (i) { tine(TINE_X[i], neck, top); });
    }
    ctx.restore();
    function tine(x, y0, y1) { var tg = ctx.createLinearGradient(x - 0.06, 0, x + 0.06, 0); tg.addColorStop(0, '#8d969e'); tg.addColorStop(0.5, '#f4f7f9'); tg.addColorStop(1, '#7c858d'); ctx.fillStyle = tg; rr(x - 0.06, y1, 0.12, y0 - y1 + 0.02, 0.06); ctx.fill(); ctx.strokeStyle = '#5e666d'; ctx.lineWidth = 0.025; ctx.stroke(); }
  }
  function band(px, py, prongX) {
    var a = w2s(SLING.x + prongX, SLING.y + 0.2), b = w2s(px, py), m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + Math.max(4, cam.s * 0.15)];
    ctx.lineCap = 'round'; ctx.strokeStyle = '#d98b0c'; ctx.lineWidth = Math.max(4, cam.s * 0.17); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(m[0], m[1], b[0], b[1]); ctx.stroke();
    ctx.strokeStyle = '#ffc93a'; ctx.lineWidth = Math.max(2, cam.s * 0.09); ctx.stroke();
  }
  function render(t) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    drawBg(t);
    [lastTrail, trail].forEach(function (tr, idx) { tr.forEach(function (p, j) { var s = w2s(p.x, p.y); ctx.fillStyle = idx ? (j % 2 ? '#fff3c4' : '#6b3d1e') : 'rgba(255,243,196,.5)'; ctx.beginPath(); ctx.arc(s[0], s[1], Math.max(1.5, cam.s * (p.big ? 0.08 : 0.05)), 0, TAU); ctx.fill(); }); });
    drawFork(false);
    var onSling = state === 'aim' && birdsLeft.length ? birdsLeft[0] : null, bx = SLING.x, by = SLING.y;
    if (onSling && drag) { var pv = pullVec(); bx += pv[0]; by += pv[1]; }
    if (onSling) { band(bx - 0.2, by, -0.36); band(bx - 0.2, by, 0.36); drawBird(onSling, bx, by, drag ? Math.atan2(-(by - SLING.y), -(bx - SLING.x)) : 0); }
    else { var a1 = w2s(SLING.x - 0.36, SLING.y + 0.2), a2 = w2s(SLING.x + 0.36, SLING.y + 0.2); ctx.strokeStyle = '#ffc93a'; ctx.lineWidth = Math.max(3, cam.s * 0.1); ctx.beginPath(); ctx.moveTo(a1[0], a1[1]); ctx.quadraticCurveTo((a1[0] + a2[0]) / 2, a1[1] + cam.s * 0.25, a2[0], a2[1]); ctx.stroke(); }
    birdsLeft.slice(onSling ? 1 : 0).forEach(function (bt, i) { drawBird(bt, -1.0 - i * 1.0, BIRD[bt].r * 0.78, 0); });
    blocks.forEach(drawBlock);
    avos.forEach(function (a) { drawTarget(a, t); });
    [bird].concat(extraBirds).forEach(function (bd) { if (bd && !bd.dead) { var p = bd.body.getPosition(); drawBird(bd.type, p.x, p.y, bd.body.getAngle()); } });
    particles.forEach(function (p) {
      var s = w2s(p.x, p.y), z = p.sz * cam.s;
      if (p.c === 'smoke') { ctx.globalAlpha = Math.max(0, Math.min(1, p.t)) * 0.7; ctx.fillStyle = '#fff6e0'; ctx.beginPath(); ctx.arc(s[0], s[1], z * (1.6 - p.t * 0.5), 0, TAU); ctx.fill(); }
      else if (p.c === 'flash') { ctx.globalAlpha = p.t / p.t0; var g = ctx.createRadialGradient(s[0], s[1], 0, s[0], s[1], z); g.addColorStop(0, '#fff'); g.addColorStop(0.4, '#ff8a3a'); g.addColorStop(1, 'rgba(200,40,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s[0], s[1], z, 0, TAU); ctx.fill(); }
      else if (p.c === 'ring') { var k = 1 - p.t / p.t0; ctx.globalAlpha = 1 - k; ctx.strokeStyle = p.col; ctx.lineWidth = Math.max(2, cam.s * 0.12 * (1 - k)); ctx.beginPath(); ctx.arc(s[0], s[1], z * (0.4 + k * 0.8), 0, TAU); ctx.stroke(); for (var i = 0; i < 8; i++) { var an = i * TAU / 8; ctx.beginPath(); ctx.moveTo(s[0] + Math.cos(an) * z * (0.5 + k), s[1] + Math.sin(an) * z * (0.5 + k)); ctx.lineTo(s[0] + Math.cos(an) * z * (0.8 + k), s[1] + Math.sin(an) * z * (0.8 + k)); ctx.stroke(); } }
      else if (p.c === 'flame') { ctx.globalAlpha = Math.max(0, p.t / p.t0); ctx.fillStyle = '#ff6a1a'; ctx.beginPath(); ctx.ellipse(s[0], s[1], z * 0.5, z, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#ffd23a'; ctx.beginPath(); ctx.ellipse(s[0], s[1] + z * 0.3, z * 0.25, z * 0.5, 0, 0, TAU); ctx.fill(); }
      else {
        ctx.globalAlpha = Math.min(1, p.t * 2); ctx.fillStyle = p.c; ctx.save(); ctx.translate(s[0], s[1]); ctx.rotate(p.a || 0);
        if (p.landed) { ctx.rotate(-(p.a || 0)); ctx.beginPath(); ctx.ellipse(0, 0, z * 1.8, z * 0.45, 0, 0, TAU); ctx.fill(); }
        else if (p.tri) { ctx.beginPath(); ctx.moveTo(0, -z); ctx.lineTo(z * 0.9, z * 0.7); ctx.lineTo(-z * 0.8, z * 0.6); ctx.closePath(); ctx.fill(); }
        else if (p.rect) ctx.fillRect(-z, -z / 2, z * 2, z);
        else if (p.ball) { ctx.beginPath(); ctx.arc(0, 0, z, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.arc(-z * 0.3, -z * 0.3, z * 0.3, 0, TAU); ctx.fill(); }
        else { ctx.beginPath(); ctx.ellipse(0, 0, z, z * 0.7, 0, 0, TAU); ctx.fill(); }
        ctx.restore();
      }
    });
    ctx.globalAlpha = 1;
    popups.forEach(function (p) {
      var s = w2s(p.x, p.y), sz = Math.max(16, p.s * cam.s * 1.0) * (p.t > 1.1 ? 1 + (p.t - 1.1) * 2 : 1);
      ctx.globalAlpha = Math.min(1, p.t * 2); ctx.font = '900 ' + sz + 'px "Arial Black", Impact, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = sz / 6; ctx.strokeStyle = '#4a1a06'; ctx.strokeText(p.txt, s[0], s[1]); ctx.fillStyle = p.c; ctx.fillText(p.txt, s[0], s[1]);
    });
    ctx.globalAlpha = 1;
    if (state === 'aim' && !drag && birdsLeft.length && simTime > 2 && simTime < 9 && !lastTrail.length) {
      var ty = H * 0.2; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = '#4a1a06'; ctx.fillStyle = '#fff8e8'; ['Pull the burrito back on the fork & let go!', 'Knock out every snack — or topple every crate', 'Swipe right side to look · tap mid-air for a power'].forEach(function (s, j) { ctx.font = '900 ' + (j ? 13 : 16) + 'px Arial'; ctx.strokeText(s, W / 2, ty + j * 22); ctx.fillText(s, W / 2, ty + j * 22); });
    }
    if (state === 'aim' && onSling && !drag) { ctx.font = '900 13px Arial'; ctx.textAlign = 'center'; var ls = w2s(SLING.x, SLING.y + 1.15); ctx.lineWidth = 3; ctx.strokeStyle = '#4a1a06'; ctx.fillStyle = '#ffd23a'; var lb = BIRD[onSling].name + (onSling === 'classic' ? ' · tap: boost' : onSling === 'breakfast' ? ' · tap: split' : ' · tap: salsa blast'); ctx.strokeText(lb, ls[0] + 40, ls[1]); ctx.fillText(lb, ls[0] + 40, ls[1]); }
  }
  function updateFx(dt) {
    particles.forEach(function (p) {
      p.t -= dt; if (p.c === 'flash' || p.c === 'ring') return;
      if (p.landed) { p.t -= dt * 0.2; return; }
      p.x += (p.vx || 0) * dt; p.y += (p.vy || 0) * dt;
      if (p.c !== 'smoke' && p.c !== 'flame') { p.vy -= 10 * (p.g || 1) * dt; p.a += (p.va || 0) * dt; if (p.y < 0.05) { if (p.stick) { p.landed = true; p.y = 0.03; p.t = Math.max(p.t, 1.5); } else { p.y = 0.05; p.vy *= p.ball ? -0.55 : -0.3; p.vx *= 0.6; } } }
    });
    particles = particles.filter(function (p) { return p.t > 0; });
    popups.forEach(function (p) { p.t -= dt; p.y += 0.6 * dt; }); popups = popups.filter(function (p) { return p.t > 0; });
  }

  var last = performance.now(), acc = 0, manual = false; // manual: tests drive physics via stepFrame()
  function frame(now) { tick(Math.min(0.1, (now - last) / 1000), now); last = now; requestAnimationFrame(frame); }
  function tick(dt, now) {
    if (world && !paused && !manual && state !== 'select' && state !== 'menu') {
      acc += dt; var n = 0; while (acc >= STEP && n < 6) { step(); acc -= STEP; n++; } if (n === 6) acc = 0;
      updateFx(dt);
    }
    updateCamera(dt);
    if (world) render(now / 1000); else { ctx.setTransform(DPR, 0, 0, DPR, 0, 0); drawBg(now / 1000); }
  }
  window.addEventListener('resize', resize);
  level = window.AB_LEVELS[0];
  resize();
  // menu backdrop: level 1 scenery behind the title
  (function menuScene() { loadLevel(0); state = 'menu'; overviewT = 0; $('hud').style.display = 'none'; show('menu'); abBooted = true; })();
  requestAnimationFrame(frame);

  window.AngryBurritos = {
    loadLevel: loadLevel, step: step, stepFrame: function () { if (world && state !== 'menu' && state !== 'select') { step(); updateFx(STEP); } updateCamera(STEP); render(performance.now() / 1000); }, launch: launch, ability: ability, w2s: w2s, s2w: s2w, finish: finish, clearStatus: clearStatus,
    get cam() { return cam; }, tick: function (ms, n) { for (var i = 0; i < (n || 1); i++) { var t = performance.now(); tick(ms / 1000, t); } }, aimView: function () { return aimView(); }, fitView: function () { return fitView(); }, skipOverview: function () { overviewT = 0; }, updateCamera: updateCamera,
    get s() { return { state: state, score: score, blocks: blocks.length, avos: avos.length, birdsLeft: birdsLeft.length, simTime: simTime, armed: armed, clearReason: clearReason, blocksDown: blocks.filter(function (b) { return armed && blockDown(b); }).length }; },
    get blocks() { return blocks; }, get avos() { return avos; }, get bird() { return bird; }, sling: SLING, set doneDelay(v) { DONE_DELAY = v; }, set manual(v) { manual = !!v; }
  };
})();
