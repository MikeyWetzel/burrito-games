(function () {
  var LEVELS = {
    beginner: { w: 9, h: 9, m: 10, label: 'Beginner' },
    intermediate: { w: 16, h: 16, m: 40, label: 'Intermediate' },
    expert: { w: 30, h: 16, m: 99, label: 'Expert' }
  };
  var Art = window.BurritoArt;
  var boardEl = document.getElementById('board'), faceEl = document.getElementById('face');
  var mineEl = document.getElementById('mines'), timeEl = document.getElementById('timer');
  var bestEl = document.getElementById('best');
  var level = localStorage.getItem('bs-level') || 'beginner';
  if (!LEVELS[level]) level = 'beginner';
  var eng, cells = [], timer = null, seconds = 0, started = false;

  function led(n) { var neg = n < 0; n = Math.min(999, Math.abs(n)); var s = String(n).padStart(neg ? 2 : 3, '0'); return (neg ? '-' : '') + s; }
  function setFace(s) { faceEl.innerHTML = Art.face(s, 26); faceEl.dataset.state = s; }
  function bests() { try { return JSON.parse(localStorage.getItem('bs-best') || '{}'); } catch (e) { return {}; } }
  function showBest() {
    var b = bests();
    bestEl.textContent = 'Best times — ' + Object.keys(LEVELS).map(function (k) { return LEVELS[k].label + ': ' + (b[k] != null ? b[k] + 's' : '—'); }).join(' · ');
  }
  function stopTimer() { clearInterval(timer); timer = null; }
  function startTimer() {
    started = true; seconds = 1; timeEl.textContent = led(seconds);
    timer = setInterval(function () { if (seconds < 999) seconds++; timeEl.textContent = led(seconds); }, 1000);
  }

  function isPhone() { return window.matchMedia('(max-width: 600px), (pointer: coarse) and (orientation: portrait)').matches; }
  function sizeCells(w) {
    var avail = Math.min(window.innerWidth, document.documentElement.clientWidth) - 26;
    var c = isPhone() ? Math.floor(avail / w) : 24;
    c = Math.max(isPhone() ? 22 : 16, Math.min(c, isPhone() ? 48 : 24));
    document.documentElement.style.setProperty('--cell', c + 'px');
  }
  var flagMode = false, modeBtn = document.getElementById('mode');
  function setMode(f) { flagMode = f; modeBtn.innerHTML = f ? Art.hotSauce(18) + ' Flag' : '👆 Reveal'; modeBtn.classList.toggle('active', f); }
  modeBtn.addEventListener('click', function () { setMode(!flagMode); });
  setMode(false);
  var lastW = window.innerWidth;
  window.addEventListener('resize', function () { if (Math.abs(window.innerWidth - lastW) > 50 && !started) { lastW = window.innerWidth; newGame(); } else if (eng) sizeCells(eng.w); });
  function newGame() {
    var L0 = LEVELS[level], L = { w: L0.w, h: L0.h, m: L0.m };
    if (isPhone() && L.w > L.h) { var t = L.w; L.w = L.h; L.h = t; } // tall board on phones
    stopTimer(); started = false; seconds = 0;
    eng = new window.SweeperEngine(L.w, L.h, L.m);
    boardEl.style.gridTemplateColumns = 'repeat(' + L.w + ', var(--cell))';
    sizeCells(L.w);
    boardEl.innerHTML = ''; cells = [];
    for (var i = 0; i < L.w * L.h; i++) {
      var c = document.createElement('div');
      c.className = 'cell'; c.dataset.i = i;
      boardEl.appendChild(c); cells.push(c);
    }
    document.querySelectorAll('[data-level]').forEach(function (b) { b.classList.toggle('active', b.dataset.level === level); });
    timeEl.textContent = led(0); setFace('normal'); render(); showBest();
  }

  function render() {
    for (var i = 0; i < cells.length; i++) {
      var c = cells[i], st = eng.state[i], cls = 'cell', html = '';
      if (st === 1) {
        cls += ' open';
        if (eng.mine[i]) { cls += ' boom'; html = Art.salsa(24) + Art.burrito(20); }
        else if (eng.adj[i]) { cls += ' n' + eng.adj[i]; html = eng.adj[i]; }
      } else if (st === 2) {
        if (eng.over && !eng.won && !eng.mine[i]) { cls += ' open wrong'; html = Art.burrito(18) + '<span class="x">✕</span>'; }
        else html = Art.hotSauce(18);
      } else if (eng.over && !eng.won && eng.mine[i]) {
        cls += ' open'; html = Art.burrito(20);
      }
      if (c.className !== cls) c.className = cls;
      if (c._h !== html) { c.innerHTML = html; c._h = html; }
    }
    mineEl.textContent = led(eng.mines - eng.flags);
  }

  function after() {
    if (eng.over) {
      stopTimer();
      if (eng.won) {
        setFace('cool');
        var b = bests(), t = Math.max(1, seconds);
        if (b[level] == null || t < b[level]) { b[level] = t; localStorage.setItem('bs-best', JSON.stringify(b)); }
        showBest();
      } else setFace('dead');
    }
    render();
  }

  function act(i, kind) {
    if (eng.over) return;
    if (kind === 'flag') eng.toggleFlag(i);
    else {
      if (!started && eng.state[i] === 0) startTimer();
      if (kind === 'chord' || eng.state[i] === 1) eng.chord(i); else eng.reveal(i);
    }
    after();
  }

  // Mouse (desktop)
  var buttons = 0;
  boardEl.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  boardEl.addEventListener('mousedown', function (e) {
    if (eng.over || Date.now() - lastTouch < 800) return;
    buttons = e.buttons;
    if (e.button === 2 && !(e.buttons & 1)) { var t = e.target.closest('.cell'); if (t) act(+t.dataset.i, 'flag'); return; }
    setFace('oh');
  });
  document.addEventListener('mouseup', function (e) {
    if (eng.over || Date.now() - lastTouch < 800) { return; }
    if (faceEl.dataset.state === 'oh') setFace('normal');
    var t = e.target.closest && e.target.closest('.cell');
    var both = (buttons & 3) === 3; buttons = 0;
    if (!t || !boardEl.contains(t)) return;
    if (both || e.button === 1) act(+t.dataset.i, 'chord');
    else if (e.button === 0) act(+t.dataset.i, flagMode && eng.state[+t.dataset.i] !== 1 ? 'flag' : 'reveal');
  });

  // Touch (mobile): tap reveal/chord, long-press flag
  var lastTouch = 0, lp = null, lpFired = false, touchCell = null;
  boardEl.addEventListener('touchstart', function (e) {
    lastTouch = Date.now(); var t = e.target.closest('.cell'); if (!t || eng.over) return;
    touchCell = t; lpFired = false; setFace('oh');
    lp = setTimeout(function () { lpFired = true; if (navigator.vibrate) navigator.vibrate(30); act(+t.dataset.i, 'flag'); if (!eng.over) setFace('normal'); }, 350);
  }, { passive: true });
  boardEl.addEventListener('touchmove', function () { clearTimeout(lp); touchCell = null; if (!eng.over) setFace('normal'); }, { passive: true });
  boardEl.addEventListener('touchend', function (e) {
    clearTimeout(lp); lastTouch = Date.now(); if (e.cancelable) e.preventDefault();
    if (!eng.over) setFace('normal');
    if (touchCell && !lpFired) act(+touchCell.dataset.i, flagMode && eng.state[+touchCell.dataset.i] !== 1 ? 'flag' : 'reveal');
    touchCell = null;
  });

  faceEl.addEventListener('mousedown', function () { faceEl.classList.add('pressed'); });
  faceEl.addEventListener('mouseup', function () { faceEl.classList.remove('pressed'); });
  faceEl.addEventListener('click', newGame);
  document.querySelectorAll('[data-level]').forEach(function (b) {
    b.addEventListener('click', function () { level = b.dataset.level; localStorage.setItem('bs-level', level); newGame(); });
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'F2') newGame(); });
  window.BurritoSweeper = { newGame: newGame, get engine() { return eng; }, act: act };
  newGame();
})();
