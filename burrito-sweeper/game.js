/**
 * Burrito Sweeper — Flat Calm canvas view + input.
 * Vector redraw at zoom × DPR. Theme-swappable.
 */
(function () {
  'use strict';

  var LEVELS_P = {
    beginner: { w: 9, h: 9, m: 10, label: 'Easy', dots: 1 },
    intermediate: { w: 16, h: 16, m: 40, label: 'Medium', dots: 2 },
    expert: { w: 16, h: 30, m: 99, label: 'Expert', dots: 3 }
  };
  var LEVELS_L = {
    beginner: { w: 9, h: 9, m: 10, label: 'Easy', dots: 1 },
    intermediate: { w: 16, h: 16, m: 40, label: 'Medium', dots: 2 },
    expert: { w: 30, h: 16, m: 99, label: 'Expert', dots: 3 }
  };
  var LEVEL_ORDER = ['beginner', 'intermediate', 'expert'];

  var Theme = window.SweeperTheme;
  var Eng = window.SweeperEngine;
  var MARK_NAME = { 2: 'burrito', 3: 'avocado', 4: 'nacho' };
  var MARK_VAL = { burrito: Eng.MARK_BURRITO, avocado: Eng.MARK_AVOCADO, nacho: Eng.MARK_NACHO };

  var canvas = document.getElementById('board');
  var ctx = canvas.getContext('2d');
  var queso = new window.SweeperQueso(document.getElementById('queso'));
  var hud = {
    mines: document.getElementById('mines'),
    timer: document.getElementById('timer'),
    status: document.getElementById('status'),
    help: document.getElementById('helpPanel'),
    levelLabel: document.getElementById('levelLabel'),
    diffText: document.getElementById('diffText'),
    markerLabel: document.getElementById('markerLabel')
  };

  var level = localStorage.getItem('bs-level') || 'beginner';
  if (!LEVELS_P[level]) level = 'beginner';
  var eng = null;
  var zoom = 1, panX = 0, panY = 0;
  var minZoom = 0.45, maxZoom = 3.2;
  var dpr = 1;
  var timer = null, seconds = 0, started = false;
  var anims = {};
  var overScreen = null; // 'win'|'loss'|null
  var overT0 = 0;
  var muted = localStorage.getItem('bs-mute') === '1';
  var running = true, lastFrame = 0, fpsSamples = [], lastFps = 60;
  var fontsReady = false;
  /** null = cycle mode; else 'burrito'|'avocado'|'nacho' */
  var markPick = null;

  function isPortraitPhone() {
    return window.matchMedia('(max-width: 600px), ((pointer: coarse) and (orientation: portrait))').matches;
  }
  function levelSpec() { return (isPortraitPhone() ? LEVELS_P : LEVELS_L)[level]; }
  function cell() { return (Theme.current.cellSize || 36) * zoom; }
  function boardPx() {
    if (!eng) return { w: 0, h: 0 };
    return { w: eng.w * cell(), h: eng.h * cell() };
  }
  function viewSize() {
    var r = canvas.getBoundingClientRect();
    return { w: r.width, h: r.height };
  }
  function clampPan() {
    if (!eng) return;
    var v = viewSize(), b = boardPx();
    var maxX = 20, maxY = 20;
    var minX = Math.min(20, v.w - b.w - 20);
    var minY = Math.min(20, v.h - b.h - 20);
    if (b.w + 40 <= v.w) panX = (v.w - b.w) / 2;
    else panX = Math.max(minX, Math.min(maxX, panX));
    if (b.h + 40 <= v.h) panY = (v.h - b.h) / 2;
    else panY = Math.max(minY, Math.min(maxY, panY));
  }
  function fitBoard() {
    if (!eng) return;
    var v = viewSize();
    var cs = Theme.current.cellSize || 36;
    var zx = (v.w - 16) / (eng.w * cs);
    var zy = (v.h - 16) / (eng.h * cs);
    zoom = Math.max(minZoom, Math.min(maxZoom, Math.min(zx, zy)));
    var b = boardPx();
    panX = (v.w - b.w) / 2;
    panY = (v.h - b.h) / 2;
  }
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    var r = canvas.getBoundingClientRect();
    canvas.width = Math.floor(Math.max(1, r.width) * dpr);
    canvas.height = Math.floor(Math.max(1, r.height) * dpr);
    clampPan();
    queso.resize();
  }

  function screenToCell(sx, sy) {
    if (!eng) return -1;
    var r = canvas.getBoundingClientRect();
    var x = sx - r.left - panX;
    var y = sy - r.top - panY;
    var c = cell();
    var cx = Math.floor(x / c), cy = Math.floor(y / c);
    if (cx < 0 || cy < 0 || cx >= eng.w || cy >= eng.h) return -1;
    return eng.idx(cx, cy);
  }

  function fmtTime(s) {
    var m = (s / 60) | 0, sec = s % 60;
    return String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
  }
  function stopTimer() { clearInterval(timer); timer = null; }
  function startTimer() {
    started = true; seconds = 0;
    hud.timer.textContent = fmtTime(0);
    timer = setInterval(function () {
      if (seconds < 9999) seconds++;
      hud.timer.textContent = fmtTime(seconds);
    }, 1000);
  }
  function updateHud() {
    if (!eng) return;
    hud.mines.textContent = String(Math.max(0, eng.mines - eng.flags));
    var L = levelSpec();
    hud.levelLabel.textContent = L.label;
    hud.diffText.textContent = L.label.toUpperCase();
    var dots = document.querySelectorAll('.diff-dots i');
    dots.forEach(function (d, i) { d.classList.toggle('on', i < L.dots); });
    updateMarkerLabel();
  }
  function updateMarkerLabel() {
    var text = markPick ? ('Marker: ' + markPick.charAt(0).toUpperCase() + markPick.slice(1)) : 'Marker: Cycle';
    hud.markerLabel.textContent = text;
    document.querySelectorAll('#markerBar button').forEach(function (b) {
      b.classList.toggle('selected', markPick != null && b.dataset.mark === markPick);
    });
  }

  function newGame(opts) {
    opts = opts || {};
    var stored = localStorage.getItem('bs-level');
    if (stored && LEVELS_P[stored]) level = stored;
    var L = levelSpec();
    stopTimer(); started = false; seconds = 0;
    eng = new Eng(L.w, L.h, L.m);
    anims = {}; overScreen = null;
    hud.timer.textContent = fmtTime(0);
    hud.status.textContent = '';
    updateHud();
    fitBoard();
    if (!opts.skipQueso) queso.start({ duration: 1000 });
  }

  function staggerReveal(indices) {
    var t0 = performance.now();
    indices.forEach(function (i, k) {
      anims[i] = { type: 'reveal', t0: t0 + Math.min(k * 14, 480), dur: 220 };
    });
  }

  function afterMove() {
    updateHud();
    if (eng.over) {
      stopTimer();
      overScreen = eng.won ? 'win' : 'loss';
      overT0 = performance.now();
      setTimeout(function () { queso.start({ duration: eng.won ? 1100 : 950 }); }, 180);
      hud.status.textContent = eng.won ? 'Nice work!' : 'Splat!';
      hud.status.style.color = eng.won ? '#1F9A63' : '#E24B36';
      if (eng.won) {
        try {
          var b = JSON.parse(localStorage.getItem('bs-best') || '{}');
          var t = Math.max(1, seconds);
          if (b[level] == null || t < b[level]) {
            b[level] = t; localStorage.setItem('bs-best', JSON.stringify(b));
          }
        } catch (e) {}
      }
    }
  }

  function doReveal(i) {
    if (!eng || eng.over) return;
    if (eng.state[i] === 1) {
      var ch = eng.chord(i);
      if (ch.length) { staggerReveal(ch); afterMove(); }
      return;
    }
    if (eng.state[i] === Eng.MARK_BURRITO) return;
    if (!started) startTimer();
    var changed = eng.placed ? eng.reveal(i) : eng.revealFirst(i);
    staggerReveal(changed);
    afterMove();
  }

  function doMark(i) {
    if (!eng || eng.over) return;
    if (eng.state[i] === 1) return;
    var next;
    if (markPick) {
      var want = MARK_VAL[markPick];
      next = eng.state[i] === want ? eng.setMark(i, 0) : eng.setMark(i, want);
    } else {
      next = eng.cycleMark(i);
    }
    anims[i] = { type: 'mark', t0: performance.now(), dur: 260, kind: MARK_NAME[next] || null };
    updateHud();
    beep(next === Eng.MARK_BURRITO ? 520 : next ? 380 : 220, 0.035);
  }

  var ac = null;
  function beep(freq, dur) {
    if (muted) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      var o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = freq; o.type = 'sine';
      g.gain.value = 0.035;
      o.connect(g); g.connect(ac.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
      o.stop(ac.currentTime + dur);
    } catch (e) {}
  }

  function draw(now) {
    if (!eng) return;
    var th = Theme.current;
    var v = viewSize();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, v.w, v.h);
    if (th.drawBackground) th.drawBackground(ctx, v.w, v.h);
    else { ctx.fillStyle = th.colors.bg; ctx.fillRect(0, 0, v.w, v.h); }

    var c = cell();
    var x0 = Math.max(0, Math.floor(-panX / c) - 1);
    var y0 = Math.max(0, Math.floor(-panY / c) - 1);
    var x1 = Math.min(eng.w - 1, Math.ceil((v.w - panX) / c) + 1);
    var y1 = Math.min(eng.h - 1, Math.ceil((v.h - panY) / c) + 1);

    for (var y = y0; y <= y1; y++) {
      for (var x = x0; x <= x1; x++) {
        var i = eng.idx(x, y);
        var px = panX + x * c, py = panY + y * c;
        var st = eng.state[i];
        var a = anims[i];
        var revealT = 1, markT = 1;
        if (a && a.type === 'reveal') {
          revealT = Math.max(0, Math.min(1, (now - a.t0) / a.dur));
          if (revealT >= 1 && now - a.t0 > a.dur) delete anims[i];
        }
        if (a && a.type === 'mark') {
          markT = Math.max(0, Math.min(1, (now - a.t0) / a.dur));
          if (markT >= 1 && now - a.t0 > a.dur + 40) delete anims[i];
        }

        if (st === 1) {
          if (a && a.type === 'reveal' && revealT < 1) {
            th.drawTileClosed(ctx, px, py, c, { i: x, j: y });
            ctx.save();
            var ease = 1 - Math.pow(1 - revealT, 3);
            ctx.globalAlpha = ease;
            ctx.translate(px + c / 2, py + c / 2);
            ctx.scale(0.92 + 0.08 * ease, 0.92 + 0.08 * ease);
            ctx.translate(-(px + c / 2), -(py + c / 2));
            th.drawTileOpen(ctx, px, py, c, eng.mine[i] ? 0 : eng.adj[i]);
            if (eng.mine[i]) th.drawMine(ctx, px, py, c, i === eng.exploded);
            ctx.restore();
          } else {
            th.drawTileOpen(ctx, px, py, c, eng.mine[i] ? 0 : eng.adj[i]);
            if (eng.mine[i]) th.drawMine(ctx, px, py, c, i === eng.exploded);
          }
        } else {
          th.drawTileClosed(ctx, px, py, c, { i: x, j: y });
          if (st === Eng.MARK_BURRITO || st === Eng.MARK_AVOCADO || st === Eng.MARK_NACHO) {
            th.drawMark(ctx, px, py, c, MARK_NAME[st], markT);
          } else if (eng.over && !eng.won && eng.mine[i]) {
            th.drawMine(ctx, px, py, c, false);
          }
        }
      }
    }

    if (overScreen) {
      var ot = Math.min(1, (now - overT0) / 900);
      ctx.fillStyle = 'rgba(36,50,74,' + (0.18 + 0.12 * ot) + ')';
      ctx.fillRect(0, 0, v.w, v.h);
      if (overScreen === 'win' && th.drawWinFx) th.drawWinFx(ctx, v.w, v.h, ot);
      if (overScreen === 'loss' && th.drawLossFx) th.drawLossFx(ctx, v.w, v.h, ot);
      ctx.fillStyle = overScreen === 'win' ? th.colors.success : th.colors.danger;
      ctx.font = '700 28px ' + (th.fontFamily || 'system-ui');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(overScreen === 'win' ? 'Nice work!' : 'Splat!', v.w / 2, v.h / 2);
    }
  }

  function loop(now) {
    if (!running) return;
    if (lastFrame) {
      var dt = now - lastFrame;
      if (dt > 0) {
        fpsSamples.push(1000 / dt);
        if (fpsSamples.length > 30) fpsSamples.shift();
        lastFps = fpsSamples.reduce(function (a, b) { return a + b; }, 0) / fpsSamples.length;
      }
    }
    lastFrame = now;
    draw(now);
    queso.frame(now);
    requestAnimationFrame(loop);
  }

  // ---- input ----
  var pointers = new Map();
  var gest = {
    mode: null, moved: false, startX: 0, startY: 0,
    pan0x: 0, pan0y: 0, pinchDist0: 0, zoom0: 1,
    cell: -1, tapTimer: null, lastTapT: 0, lastTapCell: -1, suppressMark: false
  };
  var MOVE_THRESH = 9, DBL_MS = 280;

  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function clearTapTimer() {
    if (gest.tapTimer) { clearTimeout(gest.tapTimer); gest.tapTimer = null; }
  }

  canvas.addEventListener('pointerdown', function (e) {
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      clearTapTimer();
      gest.mode = 'pinch'; gest.moved = true; gest.suppressMark = true;
      var pts = Array.from(pointers.values());
      gest.pinchDist0 = dist(pts[0], pts[1]);
      gest.zoom0 = zoom; gest.pan0x = panX; gest.pan0y = panY;
    } else if (pointers.size === 1) {
      gest.mode = 'pan'; gest.moved = false; gest.suppressMark = false;
      gest.startX = e.clientX; gest.startY = e.clientY;
      gest.pan0x = panX; gest.pan0y = panY;
      gest.cell = screenToCell(e.clientX, e.clientY);
    }
  });

  canvas.addEventListener('pointermove', function (e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (gest.mode === 'pinch' && pointers.size >= 2) {
      var pts = Array.from(pointers.values());
      var d = dist(pts[0], pts[1]);
      if (gest.pinchDist0 > 0) {
        var r = canvas.getBoundingClientRect();
        var mx = (pts[0].x + pts[1].x) / 2 - r.left;
        var my = (pts[0].y + pts[1].y) / 2 - r.top;
        var bx = (mx - panX) / zoom, by = (my - panY) / zoom;
        zoom = Math.max(minZoom, Math.min(maxZoom, gest.zoom0 * (d / gest.pinchDist0)));
        panX = mx - bx * zoom; panY = my - by * zoom; clampPan();
      }
      gest.moved = true; gest.suppressMark = true;
    } else if (gest.mode === 'pan' && pointers.size === 1) {
      var dx = e.clientX - gest.startX, dy = e.clientY - gest.startY;
      if (!gest.moved && Math.hypot(dx, dy) > MOVE_THRESH) {
        gest.moved = true; gest.suppressMark = true; clearTapTimer();
      }
      if (gest.moved) { panX = gest.pan0x + dx; panY = gest.pan0y + dy; clampPan(); }
    }
  });

  function endPointer(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2 && gest.mode === 'pinch') gest.mode = pointers.size === 1 ? 'pan' : null;
    if (pointers.size === 0) {
      var wasMoved = gest.moved, cellIdx = gest.cell, suppressed = gest.suppressMark;
      gest.mode = null;
      if (!wasMoved && !suppressed && cellIdx >= 0 && eng && !eng.over) {
        var now = performance.now();
        if (now - gest.lastTapT < DBL_MS && gest.lastTapCell === cellIdx) {
          clearTapTimer(); gest.lastTapT = 0; gest.lastTapCell = -1;
          doReveal(cellIdx);
        } else {
          gest.lastTapT = now; gest.lastTapCell = cellIdx; clearTapTimer();
          gest.tapTimer = setTimeout(function () {
            gest.tapTimer = null;
            if (gest.lastTapCell === cellIdx) doMark(cellIdx);
            gest.lastTapT = 0; gest.lastTapCell = -1;
          }, DBL_MS);
        }
      }
      gest.cell = -1; gest.moved = false; gest.suppressMark = false;
    }
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('wheel', function (e) {
    e.preventDefault();
    var r = canvas.getBoundingClientRect();
    var mx = e.clientX - r.left, my = e.clientY - r.top;
    var bx = (mx - panX) / zoom, by = (my - panY) / zoom;
    zoom = Math.max(minZoom, Math.min(maxZoom, zoom * (e.deltaY < 0 ? 1.1 : 0.9)));
    panX = mx - bx * zoom; panY = my - by * zoom; clampPan();
  }, { passive: false });
  canvas.addEventListener('contextmenu', function (e) {
    e.preventDefault();
    var i = screenToCell(e.clientX, e.clientY);
    if (i >= 0) doMark(i);
  });
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });

  // ---- HUD wiring ----
  function paintIcon(canvasEl, kind, css) {
    css = css || 22;
    var idpr = Math.min(window.devicePixelRatio || 1, 3);
    canvasEl.width = Math.floor(css * idpr);
    canvasEl.height = Math.floor(css * idpr);
    canvasEl.style.width = css + 'px';
    canvasEl.style.height = css + 'px';
    var cctx = canvasEl.getContext('2d');
    cctx.setTransform(idpr, 0, 0, idpr, 0, 0);
    cctx.clearRect(0, 0, css, css);
    Theme.current.drawHudIcon(cctx, kind, 0, 0, css);
  }
  function paintMarkers() {
    document.querySelectorAll('#markerBar button').forEach(function (b) {
      var c = b.querySelector('canvas');
      var idpr = Math.min(window.devicePixelRatio || 1, 3);
      var css = 34;
      c.width = Math.floor(css * idpr); c.height = Math.floor(css * idpr);
      var cctx = c.getContext('2d');
      cctx.setTransform(idpr, 0, 0, idpr, 0, 0);
      cctx.clearRect(0, 0, css, css);
      Theme.current.drawMark(cctx, 0, 0, css, b.dataset.mark, 1);
    });
    var mine = document.getElementById('icoMine');
    var idpr = Math.min(window.devicePixelRatio || 1, 3);
    mine.width = Math.floor(22 * idpr); mine.height = Math.floor(22 * idpr);
    var mctx = mine.getContext('2d');
    mctx.setTransform(idpr, 0, 0, idpr, 0, 0);
    Theme.current.drawMark(mctx, 0, 0, 22, 'burrito', 1);
    paintIcon(document.getElementById('icoClock'), 'clock', 22);
    paintIcon(document.querySelector('#btnRestart canvas'), 'restart', 26);
    paintIcon(document.querySelector('#btnFit canvas'), 'fit', 26);
    paintIcon(document.querySelector('#btnMute canvas'), muted ? 'mute' : 'unmute', 20);
    paintIcon(document.querySelector('#btnHelp canvas'), 'help', 20);
  }

  document.getElementById('btnRestart').addEventListener('click', function () { newGame(); });
  document.getElementById('btnFit').addEventListener('click', function () { fitBoard(); });
  document.getElementById('btnMute').addEventListener('click', function () {
    muted = !muted;
    localStorage.setItem('bs-mute', muted ? '1' : '0');
    document.getElementById('btnMute').setAttribute('aria-pressed', muted ? 'true' : 'false');
    paintIcon(document.querySelector('#btnMute canvas'), muted ? 'mute' : 'unmute', 20);
  });
  document.getElementById('btnHelp').addEventListener('click', function () {
    hud.help.hidden = !hud.help.hidden;
  });
  document.getElementById('btnHome').addEventListener('click', function () { location.href = '../'; });
  document.getElementById('pillDiff').addEventListener('click', function () {
    var i = LEVEL_ORDER.indexOf(level);
    level = LEVEL_ORDER[(i + 1) % LEVEL_ORDER.length];
    localStorage.setItem('bs-level', level);
    newGame();
  });
  document.querySelectorAll('#markerBar button').forEach(function (b) {
    b.addEventListener('click', function () {
      if (markPick === b.dataset.mark) markPick = null;
      else markPick = b.dataset.mark;
      updateMarkerLabel();
    });
  });

  window.addEventListener('resize', function () {
    resize();
    if (!started) fitBoard(); else clampPan();
    paintMarkers();
  });

  function applyPinch(scaleFactor, cx, cy) {
    var r = canvas.getBoundingClientRect();
    var mx = cx != null ? cx : r.width / 2;
    var my = cy != null ? cy : r.height / 2;
    var bx = (mx - panX) / zoom, by = (my - panY) / zoom;
    zoom = Math.max(minZoom, Math.min(maxZoom, zoom * scaleFactor));
    panX = mx - bx * zoom; panY = my - by * zoom; clampPan();
    return zoom;
  }
  function showOver(kind) {
    overScreen = kind === 'win' ? 'win' : 'loss';
    overT0 = performance.now();
    eng.over = true; eng.won = kind === 'win';
    hud.status.textContent = eng.won ? 'Nice work!' : 'Splat!';
    hud.status.style.color = eng.won ? '#1F9A63' : '#E24B36';
  }

  window.BurritoSweeper = {
    newGame: newGame,
    get engine() { return eng; },
    get zoom() { return zoom; },
    setZoom: function (z) { zoom = Math.max(minZoom, Math.min(maxZoom, z)); clampPan(); },
    fitBoard: fitBoard,
    doReveal: doReveal,
    doMark: doMark,
    get pan() { return { x: panX, y: panY }; },
    setPan: function (x, y) { panX = x; panY = y; clampPan(); },
    get fps() { return lastFps; },
    queso: queso,
    Theme: Theme,
    screenToCell: screenToCell,
    applyPinch: applyPinch,
    showOver: showOver,
    get markPick() { return markPick; },
    setMarkPick: function (v) { markPick = v; updateMarkerLabel(); },
    MOVE_THRESH: MOVE_THRESH,
    DBL_MS: DBL_MS,
    fontsReady: function () { return fontsReady; }
  };

  Theme.set('flat-calm');
  function boot() {
    paintMarkers();
    newGame({ skipQueso: false });
    resize();
    requestAnimationFrame(loop);
  }

  // Load Poppins into document fonts so canvas can use it
  var faces = [
    new FontFace('Poppins', 'url(fonts/Poppins-Regular.woff2)', { weight: '400' }),
    new FontFace('Poppins', 'url(fonts/Poppins-SemiBold.woff2)', { weight: '600' }),
    new FontFace('Poppins', 'url(fonts/Poppins-Bold.woff2)', { weight: '700' }),
    new FontFace('Poppins', 'url(fonts/Poppins-ExtraBold.woff2)', { weight: '800' })
  ];
  Promise.all(faces.map(function (f) { return f.load().then(function (ff) { document.fonts.add(ff); }); }))
    .then(function () { fontsReady = true; boot(); })
    .catch(function () { fontsReady = false; boot(); });
})();
