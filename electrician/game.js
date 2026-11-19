/* Sparky — One More Outlet
   Portrait puzzle-arcade: rotate and drop wires before the dog, the puddle, or Hank wins.
*/
(function () {
  'use strict';

  var Lib = window.SparkyLib;
  var Audio = window.SparkyAudio;
  var canvas = document.getElementById('c');
  var ctx = canvas.getContext('2d');
  var live = document.getElementById('live');

  var W = 360, H = 640, DPR = 1;
  var ZAPS = ['ZAP!', 'EXTRA CRISPY', 'HAIR GOALS', 'OSHA CALLED', 'NOT A FEATURE'];
  var LOAD_QUIP = {
    lamp: "Bulb's in.",
    outlet: "Outlet's grinning.",
    toaster: 'Toast protocol: go.',
    fridge: 'Hummus is safe.',
    tv: 'Static counts as a show.',
    fan: 'Wind achieved.'
  };

  var S = {
    mode: 'title',
    run: 'campaign',
    levelIndex: 0,
    endlessN: 1,
    score: 0,
    scoreAtLevel: 0,
    best: 0,
    starsSave: {},
    lives: 3,
    board: null,
    time: 0,
    timeMax: 1,
    hints: 0,
    breakerOn: true,
    tripped: null,
    shorts: 0,
    shoos: 0,
    intro: 0,
    celebrating: false,
    celT: 0,
    dying: false,
    dyingT: 0,
    overReason: '',
    levelStars: 0,
    levelGained: 0,
    lifeBack: false,
    dog: null,
    leak: null,
    owner: null,
    dogTimer: 99,
    leakTimer: 99,
    ownerTimer: 99,
    hair: 0,
    shake: 0,
    bright: 0,
    speech: null,
    particles: [],
    floaters: [],
    pointer: null,
    selected: null,
    keyNav: false,
    cursor: { x: 0, y: 0 },
    mute: false,
    t: 2.6,
    last: 0,
    flash: 0,
    shortLock: false,
    coach: true,
    prevOn: new Set(),
    prevHot: new Set(),
    litCount: 0,
    uid: 10,
    frozen: false,
    ready: false,
    helpFrom: 'title',
    helpPage: 0,
    dripAcc: 0,
    tickAt: 99,
    hits: []
  };

  function $(id) { return document.getElementById(id); }

  function cssPx(name) {
    var v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
    return isNaN(v) ? 0 : v;
  }

  function pick(a) { return a[(Math.random() * a.length) | 0]; }

  function commas(n) {
    return String(Math.max(0, n | 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function rgb(hex) {
    hex = hex.replace('#', '');
    return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
  }

  function mix(a, b, t) {
    var A = rgb(a), B = rgb(b);
    t = Math.max(0, Math.min(1, t));
    return 'rgb(' + ((A[0] + (B[0] - A[0]) * t) | 0) + ',' + ((A[1] + (B[1] - A[1]) * t) | 0) + ',' + ((A[2] + (B[2] - A[2]) * t) | 0) + ')';
  }

  function setLive(text) {
    if (live) live.textContent = text || '';
  }

  function vibrate(p) {
    try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* optional */ }
  }

  function save() {
    try {
      if (S.score > S.best) S.best = S.score;
      localStorage.setItem('sparky-best', String(S.best));
      localStorage.setItem('sparky-mute', S.mute ? '1' : '0');
      localStorage.setItem('sparky-stars', JSON.stringify(S.starsSave));
    } catch (e) { /* private mode */ }
  }

  function loadSave() {
    try {
      S.best = +localStorage.getItem('sparky-best') || 0;
      S.mute = localStorage.getItem('sparky-mute') === '1';
      S.starsSave = JSON.parse(localStorage.getItem('sparky-stars') || '{}') || {};
    } catch (e) {
      S.best = 0;
      S.mute = false;
      S.starsSave = {};
    }
    Audio.setMute(S.mute);
  }

  function say(text, life) {
    if (!text) { S.speech = null; return; }
    S.speech = { text: text, life: life || 2.8, t: 0 };
    setLive(text);
  }

  function floater(text, x, y, color, big) {
    S.floaters.push({ text: text, x: x, y: y, color: color || '#2a2110', t: 0, life: big ? 1.15 : 0.9, big: !!big });
    if (S.floaters.length > 12) S.floaters.shift();
  }

  function burst(x, y, n, colors, speed) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2;
      var s = (speed || 70) * (0.35 + Math.random());
      S.particles.push({
        x: x, y: y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 20,
        t: 0,
        life: 0.35 + Math.random() * 0.45,
        color: colors[i % colors.length],
        r: 1.5 + Math.random() * 2.4
      });
    }
    if (S.particles.length > 100) S.particles.splice(0, S.particles.length - 100);
  }

  function cellAt(x, y) {
    if (!S.board) return null;
    var cells = S.board.cells;
    for (var i = 0; i < cells.length; i++) {
      if (cells[i].x === x && cells[i].y === y) return cells[i];
    }
    return null;
  }

  function matches(c) {
    if (!c || c.role !== 'wire') return true;
    if (c.wire === 'straight' || c.wire === 'cross') return (c.rot % 2) === ((c.sol || 0) % 2);
    return c.rot === c.sol;
  }

  function bump(c, dir) {
    c.rot = (c.rot + dir + 4) % 4;
    c.spin = (c.spinShown != null ? c.spinShown : c.spin || 0) + dir * 90;
    Audio.play('rotate');
  }

  function stepToward(c) {
    var dir = 1;
    if (c.wire !== 'straight' && c.wire !== 'cross') {
      var cw = (c.sol - c.rot + 4) % 4;
      var ccw = (c.rot - c.sol + 4) % 4;
      if (ccw < cw) dir = -1;
    }
    bump(c, dir);
  }

  function easeSpin(obj, dt) {
    if (obj.spin == null) return;
    if (obj.spinShown == null) obj.spinShown = obj.spin;
    var d = obj.spin - obj.spinShown;
    obj.spinShown += d * Math.min(1, dt * 16);
    if (Math.abs(d) < 0.35) obj.spinShown = obj.spin;
  }

  function launch() {
    var board;
    if (S.run === 'campaign') board = Lib.cloneBoard(Lib.LEVELS[S.levelIndex]);
    else board = Lib.generateLevel(S.endlessN, (Date.now() ^ (S.endlessN * 9973) ^ (Math.random() * 1e9)) >>> 0);
    board.tray.forEach(function (t) { t.uid = ++S.uid; });
    Lib.scramble(board);
    S.board = board;
    S.timeMax = board.time;
    S.time = board.time;
    S.hints = board.hints;
    S.breakerOn = true;
    S.tripped = null;
    S.shorts = 0;
    S.shoos = 0;
    S.intro = 2.15;
    S.celebrating = false;
    S.celT = 0;
    S.dying = false;
    S.dyingT = 0;
    S.dog = null;
    S.leak = null;
    S.owner = null;
    S.dogTimer = board.dog ? board.dog.first : 99;
    S.leakTimer = board.leak ? board.leak.first : 99;
    S.ownerTimer = board.owner ? board.owner.first : 99;
    S.hair = 0;
    S.shake = 0;
    S.bright = 0;
    S.prevOn = new Set();
    S.prevHot = new Set();
    S.litCount = 0;
    S.selected = null;
    S.pointer = null;
    S.shortLock = false;
    S.coach = true;
    S.tickAt = 99;
    S.dripAcc = 0;
    S.scoreAtLevel = S.score;
    var first = board.cells[0];
    S.cursor = { x: first.x, y: first.y };
    S.mode = 'play';
    say(board.joke, 3.6);
    setLive((S.run === 'campaign' ? 'Job ' + (S.levelIndex + 1) : 'Overtime ' + S.endlessN) + '. ' + board.name + '. ' + board.joke);
  }

  function startRun(kind) {
    Audio.resume();
    Audio.play('ui');
    S.run = kind === 'endless' ? 'endless' : 'campaign';
    S.levelIndex = 0;
    S.endlessN = 1;
    S.score = 0;
    S.lives = 3;
    S.helpFrom = 'title';
    launch();
  }

  function reshuffle() {
    S.score = S.scoreAtLevel;
    launch();
  }

  function placePiece(piece, cell) {
    if (!cell || cell.role !== 'gap') return false;
    cell.role = 'wire';
    cell.wire = piece.wire;
    cell.rot = ((piece.rot || 0) % 4 + 4) % 4;
    cell.sol = cell.need.sol;
    cell.spin = cell.rot * 90;
    cell.spinShown = cell.spin;
    cell.placed = true;
    cell.trap = false;
    cell.hold = false;
    cell.fixed = false;
    var idx = S.board.tray.indexOf(piece);
    if (idx >= 0) S.board.tray.splice(idx, 1);
    if (S.selected === piece.uid) S.selected = null;
    Audio.play('place');
    S.intro = 0;
    S.coach = false;
    return true;
  }

  function yank(cell) {
    if (!cell || !cell.placed || cell.role !== 'wire') return false;
    S.board.tray.push({ uid: ++S.uid, wire: cell.wire, rot: cell.rot, spin: cell.rot * 90, spinShown: cell.spinShown || cell.rot * 90 });
    cell.role = 'gap';
    cell.wire = null;
    cell.rot = 0;
    cell.spin = 0;
    cell.spinShown = 0;
    cell.placed = false;
    cell.fixed = false;
    Audio.play('yank');
    return true;
  }

  function rotateCell(cell) {
    if (!cell || cell.role !== 'wire' || cell.fixed) return false;
    bump(cell, 1);
    S.intro = 0;
    S.coach = false;
    return true;
  }

  function resetBreaker() {
    S.breakerOn = true;
    S.tripped = null;
    S.shortLock = false;
    Audio.play('breaker');
    say('Main is closed. Try not to regret it.');
    S.intro = 0;
  }

  function useHint() {
    if (S.hints <= 0 || S.celebrating || S.dying || !S.board) return;
    var board = S.board;
    var gaps = board.cells.filter(function (c) { return c.role === 'gap'; });
    for (var i = 0; i < gaps.length; i++) {
      var g = gaps[i];
      var piece = null;
      for (var t = 0; t < board.tray.length; t++) {
        if (board.tray[t].wire === g.need.wire) { piece = board.tray[t]; break; }
      }
      if (piece) {
        piece.rot = g.need.sol;
        placePiece(piece, g);
        g.rot = g.need.sol;
        g.spin = g.need.sol * 90;
        g.spinShown = g.spin;
        S.hints--;
        Audio.play('hint');
        say('Blueprint says: that piece, that way.');
        return;
      }
    }
    var misplaced = null;
    board.cells.forEach(function (c) {
      if (!misplaced && c.placed && c.role === 'wire' && c.need && c.wire !== c.need.wire) misplaced = c;
    });
    if (misplaced && gaps.length) {
      yank(misplaced);
      S.hints--;
      Audio.play('hint');
      say('Wrong hole. Back in the tray.');
      return;
    }
    var bad = null;
    board.cells.forEach(function (c) {
      if (!bad && c.role === 'wire' && !c.trap && !c.fixed && !matches(c)) bad = c;
    });
    if (bad) {
      stepToward(bad);
      S.hints--;
      S.intro = 0;
      Audio.play('hint');
      say('A quarter-turn, as the ancestors intended.');
      return;
    }
    var trap = null;
    board.cells.forEach(function (c) {
      if (!trap && c.trap && !matches(c)) trap = c;
    });
    if (trap) {
      stepToward(trap);
      S.hints--;
      Audio.play('hint');
      say('Leave the soggy one sideways.');
      return;
    }
    say("Blueprint's blank. You're already right.");
  }

  function spawnDog() {
    var opts = S.board.cells.filter(function (c) { return c.role === 'wire' && !c.fixed && !c.trap; });
    var good = opts.filter(matches);
    var pool = good.length ? good : opts;
    if (!pool.length) { S.dogTimer = 2.5; return; }
    var c = pool[(Math.random() * pool.length) | 0];
    S.dog = { x: c.x, y: c.y, t: 0, phase: 'sniff' };
    Audio.play('dog');
    say(pick(['nom?', 'This one smells live.', 'Bork?']));
  }

  function spawnLeak(liveNow) {
    var traps = S.board.cells.filter(function (c) { return c.trap; });
    if (!traps.length) { S.leakTimer = 99; return; }
    var c = traps[(Math.random() * traps.length) | 0];
    S.leak = { x: c.x, y: c.y, t: 0, phase: liveNow ? 'live' : 'warn' };
    if (!liveNow) say('Drip incoming. Keep that wire dark.');
    Audio.play('drip');
  }

  function spawnOwner() {
    S.owner = { t: 0, phase: 'walk' };
    say(pick(["I'll get that switch!", 'Helping!', 'This one does something.']));
  }

  function shooDog() {
    if (!S.dog) return;
    S.dog = null;
    S.dogTimer = (S.board.dog ? S.board.dog.every : 10) + 1.5;
    S.shoos++;
    S.score += 80;
    save();
    Audio.play('shoo');
    vibrate(18);
    say('Hey! Not a chew toy.');
    var L = layout();
    floater('+80', L.gx + 20, L.gy + 16, '#2f6bff');
    S.intro = 0;
  }

  function shooOwner() {
    if (!S.owner) return;
    S.owner = null;
    S.ownerTimer = (S.board.owner ? S.board.owner.every : 12) + 2;
    S.score += 100;
    save();
    Audio.play('shoo');
    say('Hank. Sit. Please sit.');
    floater('+100', W * 0.7, H * 0.22, '#ff5a3c');
    S.intro = 0;
  }

  function doShort(cell) {
    if (S.shortLock || S.celebrating || S.dying) return;
    S.shortLock = true;
    S.lives -= 1;
    S.shorts += 1;
    S.breakerOn = false;
    S.tripped = 'short';
    S.hair = 2.7;
    S.shake = 1;
    S.flash = 0.42;
    if (cell) cell.scorch = 1;
    Audio.play('zap');
    vibrate([30, 40, 50]);
    var q = pick(ZAPS);
    var L = layout();
    var p = cell ? cellCenter(cell.x, cell.y, L) : { x: W / 2, y: H / 2 };
    floater(q, p.x, p.y - 10, '#fff6bf', true);
    burst(p.x, p.y, 18, ['#fff6bf', '#ffe56a', '#ff8a3d', '#fff'], 140);
    say(q === 'ZAP!' ? 'That is not a feature.' : q);
    if (S.lives <= 0) {
      S.dying = true;
      S.dyingT = 1.3;
      S.overReason = 'The puddle filed a complaint. You are out of hats.';
    }
  }

  function onTimeout() {
    if (S.celebrating || S.dying) return;
    S.lives -= 1;
    S.shake = 0.45;
    Audio.play('off');
    if (S.lives <= 0) {
      S.dying = true;
      S.dyingT = 1.05;
      S.overReason = 'The clock won. They hired a guy from a lawn sign.';
      say('Clock\'s out.');
      return;
    }
    S.time = S.timeMax;
    S.dog = null;
    S.owner = null;
    S.leak = null;
    S.dogTimer = S.board.dog ? S.board.dog.first : 99;
    S.leakTimer = S.board.leak ? S.board.leak.first : 99;
    S.ownerTimer = S.board.owner ? S.board.owner.first : 99;
    say('Out of time. One hat lighter. Clock rewound. Wires stay.');
    floater('TIME!', W / 2, H * 0.28, '#ff5a3c', true);
  }

  function celebrate(power) {
    if (S.celebrating) return;
    S.celebrating = true;
    S.celT = 0;
    var left = Math.max(0, S.time);
    var ratio = S.timeMax ? left / S.timeMax : 0;
    var st = (S.shorts === 0 && ratio >= 0.4) ? 3 : ((S.shorts === 0 || ratio >= 0.22) ? 2 : 1);
    var mult = 1 + ((S.run === 'campaign' ? S.levelIndex : S.endlessN) * 0.08);
    var loads = power.total;
    var gained = Math.round((loads * 150 + Math.ceil(left) * 10 + (S.shorts === 0 ? 300 : 0) + 200) * mult);
    S.levelStars = st;
    S.levelGained = gained;
    S.score += gained;
    S.lifeBack = false;
    if (st === 3 && S.lives < 3) {
      S.lives += 1;
      S.lifeBack = true;
    }
    var id = S.run === 'campaign' ? ('L' + S.levelIndex) : ('E' + S.endlessN);
    if ((S.starsSave[id] || 0) < st) S.starsSave[id] = st;
    save();
    Audio.play('win');
    vibrate(28);
    S.flash = 0.5;
    var L = layout();
    S.board.cells.forEach(function (c) {
      if (c.role !== 'load') return;
      var p = cellCenter(c.x, c.y, L);
      burst(p.x, p.y, 10, ['#fff4c2', '#ffd45a', '#fff', '#ff9a3c'], 90);
    });
    setLive('Lights on. ' + S.board.win + ' ' + st + ' stars. Score ' + S.score);
  }

  function update(dt) {
    S.t += dt;
    if (S.flash > 0) S.flash = Math.max(0, S.flash - dt * 1.4);
    if (S.shake > 0) S.shake = Math.max(0, S.shake - dt * 1.7);
    if (S.hair > 0) S.hair = Math.max(0, S.hair - dt);
    if (S.speech) {
      S.speech.t += dt;
      if (S.speech.t > S.speech.life) S.speech = null;
    }
    if (S.board) {
      S.board.cells.forEach(function (c) { easeSpin(c, dt); });
      S.board.tray.forEach(function (t) { easeSpin(t, dt); });
    }
    for (var i = S.particles.length - 1; i >= 0; i--) {
      var p = S.particles[i];
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 80 * dt;
      if (p.t > p.life) S.particles.splice(i, 1);
    }
    for (var f = S.floaters.length - 1; f >= 0; f--) {
      S.floaters[f].t += dt;
      S.floaters[f].y -= 18 * dt;
      if (S.floaters[f].t > S.floaters[f].life) S.floaters.splice(f, 1);
    }

    if (S.mode !== 'play' || !S.board) return;

    if (S.dying) {
      S.dyingT -= dt;
      if (S.dyingT <= 0) {
        S.mode = 'over';
        save();
        setLive('Game over. ' + S.overReason + ' Score ' + S.score);
      }
      return;
    }

    if (S.celebrating) {
      S.celT += dt;
      S.bright += (1 - S.bright) * Math.min(1, dt * 3.4);
      if (S.celT > 1.7) S.mode = 'clear';
      return;
    }

    if (S.intro > 0) {
      S.intro -= dt;
    } else {
      var board = S.board;
      if (board.dog) {
        if (!S.dog) {
          S.dogTimer -= dt;
          if (S.dogTimer <= 0) spawnDog();
        } else {
          S.dog.t += dt;
          if (S.dog.phase === 'sniff' && S.dog.t > 1.28) {
            var chewed = cellAt(S.dog.x, S.dog.y);
            if (chewed && chewed.role === 'wire' && !chewed.fixed) bump(chewed, 1);
            Audio.play('dog');
            say(pick(['CHOMP.', 'My wire now.', 'Bork.']));
            var dp = cellCenter(S.dog.x, S.dog.y, layout());
            floater('CHOMP', dp.x, dp.y - 8, '#e39b4a', true);
            S.dog = null;
            S.dogTimer = board.dog.every;
          }
        }
      }
      if (board.leak) {
        if (!S.leak) {
          S.leakTimer -= dt;
          if (S.leakTimer <= 0) spawnLeak(false);
        } else {
          S.leak.t += dt;
          S.dripAcc += dt;
          if (S.dripAcc > 0.85) { S.dripAcc = 0; Audio.play('drip'); }
          if (S.leak.phase === 'warn' && S.leak.t > 1.3) {
            S.leak.phase = 'live';
            S.leak.t = 0;
            say('Puddle is live. Do not feed it.');
          } else if (S.leak.phase === 'live' && S.leak.t > 4.4) {
            S.leak = null;
            S.leakTimer = board.leak.every;
          }
        }
      }
      if (board.owner) {
        if (!S.owner) {
          S.ownerTimer -= dt;
          if (S.ownerTimer <= 0) spawnOwner();
        } else {
          S.owner.t += dt;
          if (S.owner.t > 1.4) {
            S.breakerOn = false;
            S.tripped = 'hank';
            S.owner = null;
            S.ownerTimer = board.owner.every;
            Audio.play('off');
            say('Hank flipped it. Tap the MAIN panel.');
            S.shake = Math.max(S.shake, 0.25);
          }
        }
      }
    }

    var power = Lib.powerState(S.board, S.breakerOn);
    var L = layout();
    power.on.forEach(function (id) {
      if (!S.prevOn.has(id)) {
        var parts = id.split(',');
        var lc = cellAt(+parts[0], +parts[1]);
        var pos = cellCenter(+parts[0], +parts[1], L);
        Audio.play('on', S.litCount++);
        burst(pos.x, pos.y, 8, ['#fff4c2', '#ffd45a', '#fff'], 60);
        if (lc) floater(LOAD_QUIP[lc.loadType] || 'Power!', pos.x, pos.y - 8, '#2a2110');
      }
    });
    power.hot.forEach(function (id) {
      if (!S.prevHot.has(id)) {
        var parts = id.split(',');
        var pos = cellCenter(+parts[0], +parts[1], L);
        burst(pos.x, pos.y, 3, ['#fff', '#ffe56a'], 40);
      }
    });
    S.prevOn = power.on;
    S.prevHot = power.hot;

    if (S.leak && S.leak.phase === 'live' && S.breakerOn) {
      var trap = cellAt(S.leak.x, S.leak.y);
      if (trap && power.hot.has(trap.x + ',' + trap.y)) doShort(trap);
    }

    if (!S.dying && !S.celebrating && S.breakerOn && power.total > 0 && power.on.size === power.total) {
      celebrate(power);
      return;
    }

    if (S.intro <= 0 && !S.celebrating && !S.dying) {
      var prev = S.time;
      S.time -= dt;
      if (S.time < 6 && Math.ceil(S.time) !== S.tickAt && S.time > 0) {
        S.tickAt = Math.ceil(S.time);
        Audio.play('tick');
      }
      if (prev > 0 && S.time <= 0) {
        S.time = 0;
        onTimeout();
      }
    }

    var target = 0;
    if (S.breakerOn && power.total) target = power.on.size / power.total;
    if (S.celebrating) target = 1;
    S.bright += (target - S.bright) * Math.min(1, dt * 3.2);
  }

  function layout() {
    var b = S.board;
    var sat = cssPx('--sat');
    var sab = cssPx('--sab');
    var sal = cssPx('--sal');
    var sar = cssPx('--sar');
    var trayN = b && b.tray ? b.tray.length : 0;
    var landscape = W > H;
    var topH = sat + (landscape ? 60 : Math.max(76, Math.min(112, H * 0.112)));
    var trayH = trayN ? Math.max(76, Math.min(118, H * 0.12)) : 0;
    var statusH = landscape ? 50 : Math.max(64, Math.min(88, H * 0.09));
    var gridTop = topH + 2;
    var gridBot = H - sab - trayH - statusH - 6;
    var availH = Math.max(32, gridBot - gridTop);
    var availW = Math.max(32, W - sal - sar - 16);
    var cols = b ? b.cols : 4;
    var rows = b ? b.rows : 4;
    var cell = Math.floor(Math.min(availW / cols, availH / rows));
    if (cell < 30) cell = 30;
    var gw = cell * cols;
    var gh = cell * rows;
    var gx = Math.round(sal + (W - sal - sar - gw) / 2);
    var gy = Math.round(gridTop + Math.max(0, (availH - gh) / 2));
    return {
      sat: sat, sab: sab, sal: sal, sar: sar,
      topH: topH,
      trayH: trayH,
      trayY: H - sab - trayH,
      statusH: statusH,
      statusY: H - sab - trayH - statusH,
      cell: cell, gx: gx, gy: gy, gw: gw, gh: gh,
      cols: cols, rows: rows
    };
  }

  function cellCenter(x, y, L) {
    return { x: L.gx + (x + 0.5) * L.cell, y: L.gy + (y + 0.5) * L.cell };
  }

  function cellRect(x, y, L) {
    return { x: L.gx + x * L.cell, y: L.gy + y * L.cell, w: L.cell, h: L.cell };
  }

  function traySlots(L) {
    var n = S.board && S.board.tray ? S.board.tray.length : 0;
    var slots = [];
    if (!n) return slots;
    var gap = 10;
    var slot = Math.min(78, Math.floor((W - 28 - gap * (n - 1)) / n));
    var total = n * slot + (n - 1) * gap;
    var x0 = Math.round((W - total) / 2);
    var y = L.trayY + Math.round((L.trayH - slot) / 2);
    for (var i = 0; i < n; i++) slots.push({ x: x0 + i * (slot + gap), y: y, w: slot, h: slot, i: i });
    return slots;
  }

  function pointIn(h, x, y) {
    return x >= h.x && y >= h.y && x < h.x + h.w && y < h.y + h.h;
  }

  function hitTest(x, y) {
    for (var i = S.hits.length - 1; i >= 0; i--) {
      if (pointIn(S.hits[i], x, y)) return S.hits[i];
    }
    return null;
  }

  function pushHit(x, y, w, h, kind, extra) {
    var hit = { x: x, y: y, w: w, h: h, kind: kind };
    if (extra) Object.keys(extra).forEach(function (k) { hit[k] = extra[k]; });
    S.hits.push(hit);
    return hit;
  }

  function statusLine() {
    if (!S.board) return '';
    if (S.dying) return 'That was your last hat.';
    if (S.celebrating) return 'Lights on. Try not to high-five the panel.';
    if (!S.breakerOn && S.tripped === 'short') return 'Tripped! Darken the puddle, then tap MAIN.';
    if (!S.breakerOn) return 'Breaker is open. Tap the MAIN panel.';
    if (S.dog) return 'Tap the dog before it unions your wire.';
    if (S.owner) return 'Hank is helping. This is bad. Tap him.';
    if (S.leak && S.leak.phase === 'warn') return 'Drip incoming. That wire stays dark.';
    if (S.leak && S.leak.phase === 'live') return 'Puddle is live. Do not feed it power.';
    if (S.selected != null) return 'Tap the spare again to spin it, or tap a dashed box.';
    if (S.board.tray.length) return 'Drag a spare wire into a dashed box.';
    if (S.time < 8) return 'The homeowner is checking a watch.';
    if (S.coach && S.run === 'campaign' && S.levelIndex === 0) return 'Tap a wire to spin it. Glow means power.';
    return 'Line the wires up. Light every gadget.';
  }

  function onDown(e) {
    if (e.cancelable) e.preventDefault();
    if (S.pointer && S.pointer.id !== e.pointerId) return;
    Audio.resume();
    var pos = eventPos(e);
    S.pointer = {
      id: e.pointerId, x: pos.x, y: pos.y, sx: pos.x, sy: pos.y,
      drag: false, hit: hitTest(pos.x, pos.y), dragPiece: null
    };
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  }

  function onMove(e) {
    if (!S.pointer || e.pointerId !== S.pointer.id) return;
    if (e.cancelable) e.preventDefault();
    var pos = eventPos(e);
    S.pointer.x = pos.x;
    S.pointer.y = pos.y;
    if (!S.pointer.drag && Math.hypot(pos.x - S.pointer.sx, pos.y - S.pointer.sy) > 14) {
      S.pointer.drag = true;
      beginDrag(S.pointer);
    }
  }

  function beginDrag(p) {
    if (S.mode !== 'play' || S.celebrating || S.dying) return;
    var h = p.hit;
    if (!h) return;
    if (h.kind === 'tray') {
      var piece = null;
      S.board.tray.forEach(function (t) { if (t.uid === h.uid) piece = t; });
      if (!piece) return;
      p.dragPiece = { wire: piece.wire, rot: piece.rot || 0, uid: piece.uid, from: null };
      S.board.tray.splice(S.board.tray.indexOf(piece), 1);
      S.selected = null;
    } else if (h.kind === 'cell' && h.cell && h.cell.placed && h.cell.role === 'wire') {
      var c = h.cell;
      p.dragPiece = { wire: c.wire, rot: c.rot, uid: ++S.uid, from: { x: c.x, y: c.y } };
      c.role = 'gap';
      c.wire = null;
      c.rot = 0;
      c.spin = 0;
      c.spinShown = 0;
      c.placed = false;
      c.fixed = false;
    }
  }

  function endDrag(p) {
    var piece = p.dragPiece;
    var target = cellFromPoint(p.x, p.y);
    if (target && target.role === 'gap') {
      placePiece(piece, target);
      return;
    }
    if (piece.from) {
      var back = cellAt(piece.from.x, piece.from.y);
      if (back && back.role === 'gap') { placePiece(piece, back); return; }
    }
    S.board.tray.push({ uid: piece.uid || ++S.uid, wire: piece.wire, rot: piece.rot || 0, spin: (piece.rot || 0) * 90, spinShown: (piece.rot || 0) * 90 });
    if (!piece.from) Audio.play('yank');
  }

  function onUp(e) {
    if (!S.pointer || (e.pointerId != null && e.pointerId !== S.pointer.id)) return;
    var p = S.pointer;
    S.pointer = null;
    var pos = eventPos(e);
    p.x = pos.x;
    p.y = pos.y;
    if (!p.drag && Math.hypot(p.x - p.sx, p.y - p.sy) > 14) {
      p.drag = true;
      beginDrag(p);
    }
    if (p.dragPiece) { endDrag(p); return; }
    if (p.drag) return;
    activate(p.hit);
  }

  function activate(hit) {
    if (!hit) return;
    var overlay = S.mode === 'title' || S.mode === 'help' || S.mode === 'pause' || S.mode === 'clear' || S.mode === 'over' || S.mode === 'done';
    if ((overlay || S.celebrating || S.dying) && hit.kind !== 'btn') return;
    if (hit.kind === 'btn') { onButton(hit.id); return; }
    if (S.mode !== 'play' || S.celebrating || S.dying) return;
    if (hit.kind === 'dog') { shooDog(); return; }
    if (hit.kind === 'owner') { shooOwner(); return; }
    if (hit.kind === 'tray') {
      if (S.selected === hit.uid) {
        var piece = null;
        S.board.tray.forEach(function (t) { if (t.uid === hit.uid) piece = t; });
        if (piece) {
          piece.rot = ((piece.rot || 0) + 1) % 4;
          piece.spin = (piece.spinShown || 0) + 90;
          Audio.play('rotate');
          S.intro = 0;
        }
      } else {
        S.selected = hit.uid;
        Audio.play('ui');
      }
      return;
    }
    if (hit.kind === 'cell') {
      var c = hit.cell;
      if (!c) return;
      if (c.role === 'source') {
        if (!S.breakerOn) resetBreaker();
        else say("Main's already closed. Don't poke a gift breaker.");
        return;
      }
      if (c.role === 'load') {
        say(LOAD_QUIP[c.loadType] || 'It wants electricity.');
        return;
      }
      if (c.role === 'gap') {
        if (S.selected == null) { say('Grab a spare from the tray first.'); return; }
        var piece = null;
        S.board.tray.forEach(function (t) { if (t.uid === S.selected) piece = t; });
        if (piece) placePiece(piece, c);
        return;
      }
      if (c.role === 'wire') rotateCell(c);
    }
  }

  function onButton(id) {
    if (id === 'mute') { toggleMute(); return; }
    Audio.resume();
    Audio.play('ui');
    if (id === 'play') startRun('campaign');
    else if (id === 'endless') startRun('endless');
    else if (id === 'help') { S.helpFrom = S.mode === 'pause' ? 'pause' : (S.board && S.mode === 'play' ? 'pause' : 'title'); S.helpPage = 0; S.mode = 'help'; }
    else if (id === 'help-next') { S.helpPage = Math.min(2, S.helpPage + 1); }
    else if (id === 'help-back') { if (S.helpPage > 0) S.helpPage--; else closeHelp(); }
    else if (id === 'help-done' || id === 'help-close') closeHelp();
    else if (id === 'pause') { if (S.mode === 'play' && !S.celebrating && !S.dying) S.mode = 'pause'; }
    else if (id === 'resume') S.mode = 'play';
    else if (id === 'reshuffle') reshuffle();
    else if (id === 'hint') useHint();
    else if (id === 'next') goNext();
    else if (id === 'overtime') {
      S.run = 'endless';
      S.endlessN = 4;
      launch();
    }
    else if (id === 'retry') {
      S.score = S.scoreAtLevel;
      S.lives = 3;
      launch();
    }
    else if (id === 'newshift') startRun(S.run === 'endless' ? 'endless' : 'campaign');
    else if (id === 'title') { S.mode = 'title'; S.pointer = null; setLive('Sparky. Best score ' + S.best); }
  }

  function closeHelp() {
    S.mode = S.helpFrom === 'pause' ? 'pause' : 'title';
  }

  function goNext() {
    if (S.run === 'campaign' && S.levelIndex >= Lib.LEVELS.length - 1) {
      S.mode = 'done';
      setLive('Shift complete. Score ' + S.score);
      return;
    }
    if (S.run === 'campaign') S.levelIndex++;
    else S.endlessN++;
    launch();
  }

  function toggleMute() {
    S.mute = !S.mute;
    Audio.setMute(S.mute);
    if (!S.mute) { Audio.resume(); Audio.play('ui'); }
    save();
  }

  function eventPos(e) {
    var r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function cellFromPoint(x, y) {
    if (!S.board) return null;
    var L = layout();
    var cx = Math.floor((x - L.gx) / L.cell);
    var cy = Math.floor((y - L.gy) / L.cell);
    if (cx < 0 || cy < 0 || cx >= L.cols || cy >= L.rows) return null;
    return cellAt(cx, cy);
  }

  function onKey(e) {
    var k = e.key;
    if (k === 'm' || k === 'M') { e.preventDefault(); toggleMute(); return; }
    if (S.mode === 'title') {
      if (k === 'Enter' || k === ' ') { e.preventDefault(); onButton('play'); }
      else if (k === 'h' || k === 'H' || k === '?') onButton('help');
      else if (k === 'o' || k === 'O') onButton('endless');
      return;
    }
    if (S.mode === 'help') {
      if (k === 'Escape' || k === 'Enter') { e.preventDefault(); onButton(S.helpPage >= 2 ? 'help-done' : 'help-next'); }
      else if (k === 'ArrowRight') onButton('help-next');
      else if (k === 'ArrowLeft') onButton('help-back');
      return;
    }
    if (S.mode === 'pause') {
      if (k === 'Escape' || k === 'p' || k === 'P' || k === 'Enter') { e.preventDefault(); S.mode = 'play'; }
      return;
    }
    if (S.mode === 'clear') {
      if (k === 'Enter' || k === ' ') { e.preventDefault(); onButton('next'); }
      return;
    }
    if (S.mode === 'over') {
      if (k === 'Enter') { e.preventDefault(); onButton('retry'); }
      return;
    }
    if (S.mode === 'done') {
      if (k === 'Enter') { e.preventDefault(); onButton('overtime'); }
      return;
    }
    if (S.mode !== 'play' || !S.board) return;
    if (k === 'Escape' || k === 'p' || k === 'P') { e.preventDefault(); if (!S.celebrating && !S.dying) S.mode = 'pause'; return; }
    if (k === 'r' || k === 'R') { e.preventDefault(); if (!S.celebrating && !S.dying) reshuffle(); return; }
    if (k === 'h' || k === 'H') { e.preventDefault(); useHint(); return; }
    if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowUp' || k === 'ArrowDown' || k === 'a' || k === 'd' || k === 'w' || k === 's') {
      e.preventDefault();
      S.keyNav = true;
      var dx = (k === 'ArrowLeft' || k === 'a') ? -1 : (k === 'ArrowRight' || k === 'd') ? 1 : 0;
      var dy = (k === 'ArrowUp' || k === 'w') ? -1 : (k === 'ArrowDown' || k === 's') ? 1 : 0;
      var nx = Math.max(0, Math.min(S.board.cols - 1, S.cursor.x + dx));
      var ny = Math.max(0, Math.min(S.board.rows - 1, S.cursor.y + dy));
      S.cursor.x = nx;
      S.cursor.y = ny;
      return;
    }
    if (k === ' ' || k === 'Enter') {
      e.preventDefault();
      S.keyNav = true;
      var c = cellAt(S.cursor.x, S.cursor.y);
      if (c) activate({ kind: 'cell', cell: c });
      else if (S.dog && S.dog.x === S.cursor.x && S.dog.y === S.cursor.y) shooDog();
      return;
    }
    if (k === 'Backspace') {
      e.preventDefault();
      yank(cellAt(S.cursor.x, S.cursor.y));
      return;
    }
    if (k >= '1' && k <= '9') {
      var idx = +k - 1;
      if (S.board.tray[idx]) {
        var piece = S.board.tray[idx];
        if (S.selected === piece.uid) {
          piece.rot = (piece.rot + 1) % 4;
          piece.spin = (piece.spinShown || 0) + 90;
          Audio.play('rotate');
        } else S.selected = piece.uid;
      }
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    var rr = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function wrap(text, maxW) {
    var words = String(text).split(' ');
    var lines = [];
    var cur = '';
    for (var i = 0; i < words.length; i++) {
      var t = cur ? cur + ' ' + words[i] : words[i];
      if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = words[i]; }
      else cur = t;
    }
    if (cur) lines.push(cur);
    return lines;
  }

  function drawButton(x, y, w, h, label, id, opt) {
    opt = opt || {};
    var r = Math.min(16, h / 2);
    var fill = opt.ghost ? '#2a2110' : (opt.ink || '#ffc83d');
    var text = opt.ghost ? '#fff8e6' : '#2a2110';
    ctx.save();
    ctx.fillStyle = 'rgba(40,28,10,0.18)';
    roundRect(x, y + 3, w, h, r);
    ctx.fill();
    ctx.fillStyle = fill;
    roundRect(x, y, w, h, r);
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#2a2110';
    ctx.stroke();
    ctx.fillStyle = text;
    ctx.font = '800 ' + (opt.size || Math.max(16, Math.min(20, h * 0.36))) + 'px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + h / 2 + 1);
    ctx.restore();
    if (id) pushHit(x, y, w, h, 'btn', { id: id });
  }

  function drawStar(x, y, r, on) {
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var rad = i % 2 === 0 ? r : r * 0.46;
      var a = -Math.PI / 2 + i * Math.PI / 5;
      var px = x + Math.cos(a) * rad;
      var py = y + Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = on ? '#ffd45a' : 'rgba(40,30,20,0.15)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#2a2110';
    ctx.stroke();
  }

  function drawHardHat(x, y, s, tilt, lamp) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt || 0);
    ctx.fillStyle = '#ffc83d';
    ctx.strokeStyle = '#2a2110';
    ctx.lineWidth = Math.max(1.5, 2 * s);
    ctx.beginPath();
    ctx.ellipse(0, 0, 16 * s, 8 * s, 0, Math.PI, 0);
    ctx.ellipse(0, 2 * s, 11 * s, 9 * s, 0, Math.PI, 0, true);
    ctx.fill();
    ctx.stroke();
    roundRect(-18 * s, 0, 36 * s, 6 * s, 2 * s);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = lamp ? '#fff6c8' : '#8a7340';
    ctx.beginPath();
    ctx.arc(0, -2 * s, 3.2 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function strokePorts(mask, len) {
    ctx.beginPath();
    if (mask & 1) { ctx.moveTo(0, 0); ctx.lineTo(0, -len); }
    if (mask & 2) { ctx.moveTo(0, 0); ctx.lineTo(len, 0); }
    if (mask & 4) { ctx.moveTo(0, 0); ctx.lineTo(0, len); }
    if (mask & 8) { ctx.moveTo(0, 0); ctx.lineTo(-len, 0); }
    ctx.stroke();
  }

  function drawWireGraphic(wire, angle, hot, size, wet) {
    ctx.save();
    ctx.rotate(angle * Math.PI / 180);
    var m = Lib.mask(wire, 0);
    var len = size * 0.52;
    var w = Math.max(7, size * 0.2);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#3a2c12';
    ctx.lineWidth = w + 3.5;
    strokePorts(m, len);
    ctx.strokeStyle = wet ? '#8fd4f2' : (hot ? '#ffe56a' : '#e2b34a');
    ctx.lineWidth = w;
    strokePorts(m, len);
    ctx.strokeStyle = wet ? 'rgba(255,255,255,0.45)' : (hot ? 'rgba(255,255,255,0.9)' : 'rgba(255,236,180,0.45)');
    ctx.lineWidth = Math.max(2, w * 0.28);
    if (hot) {
      ctx.setLineDash([5, 9]);
      ctx.lineDashOffset = -S.t * 36;
    }
    strokePorts(m, len);
    ctx.setLineDash([]);
    ctx.fillStyle = hot ? '#fff' : '#f4e2b4';
    ctx.strokeStyle = '#3a2c12';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, w * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawLoad(type, hot, size) {
    var s = size * 0.34;
    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#2a2110';
    if (type === 'lamp') {
      if (hot) {
        ctx.fillStyle = 'rgba(255, 220, 120, 0.45)';
        ctx.beginPath();
        ctx.arc(0, 2, s * 1.35, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = hot ? '#fff6c4' : '#d9d0c2';
      ctx.beginPath();
      ctx.arc(0, 2, s * 0.72, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = hot ? '#e0a020' : '#9a907f';
      ctx.beginPath();
      ctx.moveTo(-s * 0.22, -2);
      ctx.lineTo(s * 0.22, 6);
      ctx.moveTo(s * 0.22, -2);
      ctx.lineTo(-s * 0.22, 6);
      ctx.stroke();
      ctx.fillStyle = '#6d624e';
      roundRect(-s * 0.28, s * 0.7, s * 0.56, s * 0.28, 2);
      ctx.fill();
    } else if (type === 'outlet') {
      ctx.fillStyle = hot ? '#fff' : '#e6e0d6';
      roundRect(-s * 0.7, -s * 0.85, s * 1.4, s * 1.7, s * 0.2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#2a2110';
      roundRect(-s * 0.28, -s * 0.35, s * 0.16, s * 0.42, 1);
      ctx.fill();
      roundRect(s * 0.12, -s * 0.35, s * 0.16, s * 0.42, 1);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, s * 0.28, s * 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = hot ? '#2f6bff' : '#8a8175';
      ctx.beginPath();
      ctx.arc(0, s * 0.55, s * 0.22, hot ? 0.15 : 0.3, hot ? Math.PI - 0.15 : Math.PI - 0.3);
      ctx.stroke();
    } else if (type === 'toaster') {
      ctx.fillStyle = hot ? '#ff8b6a' : '#c98570';
      roundRect(-s * 0.85, -s * 0.35, s * 1.7, s * 1.05, s * 0.18);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#2a2110';
      roundRect(-s * 0.48, -s * 0.55, s * 0.32, s * 0.28, 2);
      ctx.fill();
      roundRect(s * 0.16, -s * 0.55, s * 0.32, s * 0.28, 2);
      ctx.fill();
      if (hot) {
        ctx.fillStyle = '#f3d2a2';
        roundRect(-s * 0.42, -s * 0.85, s * 0.22, s * 0.4, 2);
        ctx.fill();
        roundRect(s * 0.2, -s * 0.85, s * 0.22, s * 0.4, 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = '#2a2110';
      roundRect(s * 0.62, -s * 0.05, s * 0.16, s * 0.42, 2);
      ctx.fill();
    } else if (type === 'fridge') {
      ctx.fillStyle = hot ? '#f4fbff' : '#d5dde3';
      roundRect(-s * 0.7, -s * 0.95, s * 1.4, s * 1.9, s * 0.16);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-s * 0.7, -s * 0.05);
      ctx.lineTo(s * 0.7, -s * 0.05);
      ctx.stroke();
      ctx.strokeStyle = '#8aa0b0';
      ctx.beginPath();
      ctx.moveTo(s * 0.42, -s * 0.55);
      ctx.lineTo(s * 0.42, -s * 0.25);
      ctx.moveTo(s * 0.42, s * 0.25);
      ctx.lineTo(s * 0.42, s * 0.62);
      ctx.stroke();
      if (hot) {
        ctx.fillStyle = 'rgba(120, 200, 255, 0.35)';
        roundRect(-s * 0.5, -s * 0.8, s * 0.7, s * 0.5, 3);
        ctx.fill();
      }
    } else if (type === 'tv') {
      ctx.fillStyle = '#2a2110';
      roundRect(-s * 0.9, -s * 0.7, s * 1.8, s * 1.25, s * 0.12);
      ctx.fill();
      ctx.fillStyle = hot ? '#7fd0ff' : '#1b2430';
      roundRect(-s * 0.75, -s * 0.55, s * 1.5, s * 0.95, 4);
      ctx.fill();
      if (hot) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(-s * 0.2, -s * 0.15, s * 0.5, s * 0.12);
        ctx.fillStyle = '#ffd45a';
        ctx.fillRect(-s * 0.45, s * 0.05, s * 0.3, s * 0.12);
      }
      ctx.strokeStyle = '#2a2110';
      ctx.beginPath();
      ctx.moveTo(-s * 0.2, s * 0.55);
      ctx.lineTo(s * 0.2, s * 0.55);
      ctx.moveTo(0, s * 0.55);
      ctx.lineTo(0, s * 0.85);
      ctx.stroke();
    } else {
      ctx.strokeStyle = '#2a2110';
      ctx.fillStyle = hot ? '#d7ecff' : '#c5d0da';
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.78, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.save();
      ctx.rotate(hot ? S.t * 8 : S.t * 0.4);
      ctx.fillStyle = hot ? '#2f6bff' : '#7d8b99';
      for (var b = 0; b < 3; b++) {
        ctx.rotate((Math.PI * 2) / 3);
        ctx.beginPath();
        ctx.ellipse(s * 0.28, 0, s * 0.34, s * 0.16, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  function drawBreaker(on, size) {
    var s = size * 0.4;
    ctx.save();
    ctx.fillStyle = '#5c6773';
    ctx.strokeStyle = '#1b2330';
    ctx.lineWidth = 2;
    roundRect(-s, -s * 1.05, s * 2, s * 2.1, s * 0.16);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#2a2110';
    ctx.font = '800 ' + Math.max(8, s * 0.38) + 'px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f4efe4';
    ctx.fillText('MAIN', 0, -s * 0.62);
    ctx.fillStyle = on ? '#3ddc84' : '#ff4d4d';
    ctx.beginPath();
    ctx.arc(0, -s * 0.15, s * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1b2330';
    ctx.lineWidth = Math.max(3, s * 0.16);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, s * 0.15);
    ctx.lineTo(on ? s * 0.35 : -s * 0.05, on ? s * 0.55 : s * 0.7);
    ctx.stroke();
    if (!on) {
      ctx.strokeStyle = 'rgba(255,77,77,' + (0.45 + Math.sin(S.t * 8) * 0.35) + ')';
      ctx.lineWidth = 3;
      roundRect(-s - 3, -s * 1.05 - 3, s * 2 + 6, s * 2.1 + 6, s * 0.2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawScorch(size, a) {
    ctx.save();
    ctx.globalAlpha = 0.45 * Math.max(0.4, a);
    ctx.fillStyle = '#2a211c';
    ctx.beginPath();
    ctx.ellipse(0, size * 0.08, size * 0.32, size * 0.2, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.ellipse(-size * 0.08, size * 0.02, size * 0.16, size * 0.1, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPuddle(phase, size) {
    ctx.save();
    var live = phase === 'live';
    ctx.fillStyle = live ? 'rgba(60, 180, 255, 0.55)' : 'rgba(90, 190, 255, 0.28)';
    ctx.beginPath();
    ctx.ellipse(0, size * 0.22, size * 0.34, size * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(20, 90, 150, 0.45)';
    ctx.stroke();
    ctx.strokeStyle = live ? '#1a6ea8' : '#3aa0e0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(size * 0.02, -size * 0.18 + Math.sin(S.t * 6) * 2, 3.2, 0, Math.PI * 2);
    ctx.stroke();
    if (!live) {
      ctx.beginPath();
      ctx.moveTo(0, -size * 0.42);
      ctx.lineTo(0, -size * 0.22);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawSparky(x, y, h, mood) {
    var s = h / 86;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    var blink = Math.sin(S.t * 0.7) > 0.97;
    var zap = mood === 'zap' || S.hair > 0;
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = '#1b2330';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.fillStyle = '#2a2110';
    roundRect(-11, -8, 10, 8, 2);
    ctx.fill();
    roundRect(2, -8, 10, 8, 2);
    ctx.fill();
    ctx.fillStyle = '#2f6bff';
    roundRect(-13, -34, 12, 28, 4);
    ctx.fill();
    ctx.stroke();
    roundRect(1, -34, 12, 28, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ff5a3c';
    roundRect(-16, -52, 32, 24, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffc83d';
    roundRect(-14, -46, 28, 8, 3);
    ctx.fill();
    ctx.fillStyle = '#ffcc9a';
    ctx.beginPath();
    ctx.arc(-18, -40, 5, 0, Math.PI * 2);
    ctx.arc(18, -40, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -64, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (zap) {
      ctx.strokeStyle = '#2a2110';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-8, -76); ctx.lineTo(-14, -90);
      ctx.moveTo(0, -78); ctx.lineTo(2, -94);
      ctx.moveTo(8, -76); ctx.lineTo(16, -88);
      ctx.stroke();
    }
    ctx.save();
    ctx.translate(0, -78);
    ctx.rotate(zap ? -0.25 : 0);
    drawHardHat(0, 0, 1, 0, true);
    ctx.restore();
    ctx.fillStyle = '#1b2330';
    if (zap) {
      ctx.beginPath();
      ctx.arc(-5, -66, 2.2, 0, Math.PI * 2);
      ctx.arc(5, -66, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-5, -66, 3.4, 0, Math.PI * 1.4);
      ctx.stroke();
    } else if (blink) {
      ctx.strokeStyle = '#1b2330';
      ctx.beginPath();
      ctx.moveTo(-8, -66); ctx.lineTo(-2, -66);
      ctx.moveTo(2, -66); ctx.lineTo(8, -66);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(-5, -66, 1.8, 0, Math.PI * 2);
      ctx.arc(5, -66, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = '#1b2330';
    ctx.beginPath();
    ctx.arc(0, -60, 5.5, 0.15, Math.PI - 0.15);
    ctx.stroke();
    ctx.fillStyle = '#6a3a2a';
    ctx.fillRect(-7, -59, 14, 3);
    if (mood === 'worry' && !zap) {
      ctx.strokeStyle = '#3aa0e0';
      ctx.beginPath();
      ctx.moveTo(12, -70);
      ctx.quadraticCurveTo(16, -62, 13, -56);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawDog(x, y, size) {
    var s = size / 70;
    ctx.save();
    ctx.translate(x, y + Math.sin(S.t * 10) * 1.5);
    ctx.scale(s, s);
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = '#2a2110';
    ctx.fillStyle = '#e39b4a';
    ctx.beginPath();
    ctx.ellipse(0, 6, 24, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(-20, -2, 12, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f3d2a4';
    ctx.beginPath();
    ctx.ellipse(-24, 2, 6, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e39b4a';
    ctx.beginPath();
    ctx.moveTo(-28, -10); ctx.lineTo(-22, -2); ctx.lineTo(-32, -2); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-16, -12); ctx.lineTo(-12, -2); ctx.lineTo(-22, -2); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#1b2330';
    ctx.beginPath();
    ctx.arc(-26, -2, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff8b8b';
    ctx.beginPath();
    ctx.ellipse(-30, 4, 3, 2, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.rotate(Math.sin(S.t * 14) * 0.4);
    ctx.fillStyle = '#e39b4a';
    ctx.beginPath();
    ctx.ellipse(22, 2, 8, 4, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#f3d2a4';
    for (var i = 0; i < 4; i++) {
      var lx = -12 + i * 8;
      roundRect(lx, 14, 5, 8, 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawHank(x, y, size) {
    var s = size / 78;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = '#1b2330';
    ctx.fillStyle = '#7f8cff';
    roundRect(-16, -36, 32, 34, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffcc9a';
    ctx.beginPath();
    ctx.arc(0, -48, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#2a2110';
    ctx.beginPath();
    ctx.moveTo(-4, -60); ctx.lineTo(-6, -68);
    ctx.moveTo(5, -60); ctx.lineTo(8, -69);
    ctx.stroke();
    ctx.strokeStyle = '#1b2330';
    ctx.beginPath();
    ctx.arc(-4, -48, 4, 0, Math.PI * 2);
    ctx.arc(5, -48, 4, 0, Math.PI * 2);
    ctx.moveTo(-8, -48); ctx.lineTo(9, -48);
    ctx.stroke();
    ctx.fillStyle = '#1b2330';
    ctx.beginPath();
    ctx.arc(-4, -48, 1.2, 0, Math.PI * 2);
    ctx.arc(5, -48, 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffcc9a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(14, -24);
    ctx.lineTo(28, -8);
    ctx.stroke();
    ctx.fillStyle = '#3a2a22';
    roundRect(-12, -4, 10, 6, 2);
    ctx.fill();
    roundRect(2, -4, 10, 6, 2);
    ctx.fill();
    ctx.restore();
  }

  function drawRoom(L) {
    var b = S.bright;
    var sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, mix('#1c2744', '#ffd7a1', b));
    sky.addColorStop(0.45, mix('#31456f', '#f7e7c4', b));
    sky.addColorStop(1, mix('#243044', '#e7c89a', b));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = mix('#2a241e', '#c4a574', b);
    ctx.fillRect(0, L.statusY - 6, W, H);
    ctx.fillStyle = mix('#3a4258', '#f4e2c4', b);
    ctx.fillRect(0, L.topH * 0.45, W, L.statusY - L.topH * 0.45);
    var winX = W - cssPx('--sar') - 58;
    var winY = L.topH * 0.55;
    if (winY + 70 < L.gy - 4) {
      ctx.fillStyle = mix('#142033', '#fff1c9', Math.min(1, b + 0.15));
      roundRect(winX, winY, 46, 64, 6);
      ctx.fill();
      ctx.strokeStyle = mix('#d7c4a3', '#fff', b);
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(winX + 23, winY);
      ctx.lineTo(winX + 23, winY + 64);
      ctx.moveTo(winX, winY + 32);
      ctx.lineTo(winX + 46, winY + 32);
      ctx.stroke();
    }
    if (L.gy > L.topH + 18) {
      var lx = L.gx + L.gw / 2;
      var ly = L.gy - 8;
      ctx.strokeStyle = mix('#6a6248', '#5a4630', b);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(lx, L.topH * 0.5);
      ctx.lineTo(lx, ly - 10);
      ctx.stroke();
      ctx.fillStyle = b > 0.25 ? 'rgba(255,226,140,' + (0.25 + b * 0.45) + ')' : 'rgba(20,24,40,0.2)';
      ctx.beginPath();
      ctx.arc(lx, ly, 8 + b * 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = b > 0.2 ? '#fff6c9' : '#3a4258';
      ctx.beginPath();
      ctx.arc(lx, ly, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPegboard(L) {
    var b = S.bright;
    ctx.save();
    ctx.fillStyle = 'rgba(40,28,16,0.18)';
    roundRect(L.gx - 8, L.gy - 8 + 4, L.gw + 16, L.gh + 16, 16);
    ctx.fill();
    ctx.fillStyle = mix('#b08968', '#f0d7aa', Math.min(1, 0.35 + b * 0.65));
    roundRect(L.gx - 8, L.gy - 8, L.gw + 16, L.gh + 16, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(70,46,24,0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = 'rgba(90, 60, 30, 0.28)';
    for (var y = 0; y <= L.rows; y++) {
      for (var x = 0; x <= L.cols; x++) {
        ctx.beginPath();
        ctx.arc(L.gx + x * L.cell, L.gy + y * L.cell, 2.1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawBoard(L) {
    var hot = Lib.powerState(S.board, S.breakerOn);
    S.board.cells.forEach(function (c) {
      if (c.scorch) {
        var p = cellCenter(c.x, c.y, L);
        ctx.save();
        ctx.translate(p.x, p.y);
        drawScorch(L.cell, c.scorch);
        ctx.restore();
      }
    });
    S.board.cells.forEach(function (c) {
      var r = cellRect(c.x, c.y, L);
      var p = cellCenter(c.x, c.y, L);
      if (c.role === 'gap') {
        ctx.save();
        ctx.strokeStyle = '#2f6bff';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([5, 5]);
        ctx.lineDashOffset = -S.t * 16;
        roundRect(r.x + 8, r.y + 8, r.w - 16, r.h - 16, 10);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(47,107,255,0.08)';
        ctx.fill();
        ctx.restore();
        pushHit(r.x, r.y, r.w, r.h, 'cell', { cell: c });
        return;
      }
      ctx.save();
      ctx.translate(p.x, p.y);
      if (c.role === 'wire') {
        var wet = S.leak && S.leak.x === c.x && S.leak.y === c.y;
        var powered = !!hot.hot.has(c.x + ',' + c.y);
        drawWireGraphic(c.wire, c.spinShown || 0, powered && S.breakerOn, L.cell, wet && S.leak.phase === 'live');
        if (wet) drawPuddle(S.leak.phase, L.cell);
      } else if (c.role === 'load') {
        drawLoad(c.loadType, hot.on.has(c.x + ',' + c.y), L.cell);
      } else if (c.role === 'source') {
        drawBreaker(S.breakerOn, L.cell);
      }
      ctx.restore();
      pushHit(r.x, r.y, r.w, r.h, 'cell', { cell: c });
      if (S.keyNav && S.cursor.x === c.x && S.cursor.y === c.y && S.mode === 'play') {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        roundRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6, 8);
        ctx.stroke();
      }
    });
    if (S.coach && S.mode === 'play' && !S.celebrating && S.run === 'campaign' && S.levelIndex === 0) {
      var target = null;
      S.board.cells.forEach(function (c) {
        if (!target && c.role === 'wire' && !matches(c)) target = c;
      });
      if (target) {
        var tp = cellCenter(target.x, target.y, L);
        var bob = Math.sin(S.t * 5) * 6;
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#2a2110';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(tp.x + 16, tp.y + 18 + bob, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(tp.x + 22, tp.y + 26 + bob);
        ctx.lineTo(tp.x + 30, tp.y + 36 + bob);
        ctx.stroke();
      }
    }
  }

  function drawActors(L) {
    if (S.dog) {
      var p = cellCenter(S.dog.x, S.dog.y, L);
      drawDog(p.x, p.y - 6, L.cell * 1.25);
      var pad = 16;
      pushHit(p.x - L.cell * 0.7 - pad, p.y - L.cell * 0.7 - pad, L.cell * 1.4 + pad * 2, L.cell * 1.4 + pad * 2, 'dog', {});
    }
    if (S.owner) {
      var src = null;
      S.board.cells.forEach(function (c) { if (c.role === 'source') src = c; });
      if (src) {
        var sp = cellCenter(src.x, src.y, L);
        var prog = Math.min(1, S.owner.t / 1.35);
        var hx = sp.x + (1 - prog) * L.cell * 1.35 + L.cell * 0.15;
        var hy = sp.y + 4;
        drawHank(hx, hy, L.cell * 1.15);
        pushHit(hx - 36, hy - 70, 78, 90, 'owner', {});
      }
    }
  }

  function drawSparkyStrip(L) {
    var mood = 'idle';
    if (S.hair > 0 || S.dying) mood = 'zap';
    else if (S.celebrating) mood = 'happy';
    else if (S.time < 8 || S.dog || S.owner || (S.leak && S.leak.phase === 'live')) mood = 'worry';
    drawSparky(L.sal + 40, L.statusY + L.statusH - 6, Math.min(78, L.statusH + 10), mood);
    var text = S.speech ? S.speech.text : statusLine();
    if (!text) return;
    ctx.font = '700 13.5px system-ui, sans-serif';
    var maxW = Math.max(80, W - L.sal - L.sar - 92);
    var lines = wrap(text, maxW);
    if (lines.length > 3) lines = lines.slice(0, 3);
    var tw = 0;
    lines.forEach(function (ln) { tw = Math.max(tw, ctx.measureText(ln).width); });
    var bw = tw + 18;
    var bh = lines.length * 16 + 12;
    var bx = L.sal + 72;
    var by = L.statusY + (L.statusH - bh) / 2;
    ctx.fillStyle = 'rgba(255,248,230,0.94)';
    roundRect(bx, by, bw, bh, 10);
    ctx.fill();
    ctx.strokeStyle = '#2a2110';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#2a2110';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    lines.forEach(function (ln, i) {
      ctx.fillText(ln, bx + 9, by + 14 + i * 16);
    });
  }

  function drawTray(L) {
    if (!S.board.tray.length && !(S.pointer && S.pointer.dragPiece)) return;
    ctx.fillStyle = mix('#6a4a2e', '#8a6240', 0.4);
    roundRect(10, L.trayY + 4, W - 20, L.trayH - 10, 14);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,248,230,0.7)';
    ctx.font = '800 10px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('SPARES', 22, L.trayY + 8);
    var slots = traySlots(L);
    slots.forEach(function (slot, i) {
      var piece = S.board.tray[i];
      var sel = piece && S.selected === piece.uid;
      ctx.fillStyle = sel ? '#fff4c8' : '#f0d7aa';
      roundRect(slot.x, slot.y, slot.w, slot.h, 12);
      ctx.fill();
      ctx.lineWidth = sel ? 3.5 : 2;
      ctx.strokeStyle = sel ? '#2f6bff' : '#2a2110';
      ctx.stroke();
      if (piece) {
        ctx.save();
        ctx.translate(slot.x + slot.w / 2, slot.y + slot.h / 2);
        drawWireGraphic(piece.wire, piece.spinShown || 0, false, slot.w * 0.92, false);
        ctx.restore();
        pushHit(slot.x, slot.y, slot.w, slot.h, 'tray', { uid: piece.uid });
      }
    });
  }

  function drawFuse(x, y, w, h) {
    var frac = S.timeMax ? Math.max(0, S.time / S.timeMax) : 0;
    ctx.fillStyle = 'rgba(20,16,12,0.35)';
    roundRect(x, y, w, h, h / 2);
    ctx.fill();
    ctx.fillStyle = frac < 0.22 ? '#ff5a5a' : (frac < 0.45 ? '#ff9a3c' : '#ffd45a');
    roundRect(x, y, Math.max(h, w * frac), h, h / 2);
    ctx.fill();
    var sx = x + Math.max(h * 0.5, w * frac);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(Math.min(x + w - 4, sx), y + h / 2, h * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a2110';
    ctx.font = '800 ' + Math.round(h * 0.7) + 'px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(Math.ceil(Math.max(0, S.time)) + 's', x + w / 2, y + h / 2 + 0.5);
  }

  function drawHUD(L) {
    var name = S.board.name;
    var tag = S.run === 'campaign' ? ((S.levelIndex + 1) + '/' + Lib.LEVELS.length) : ('OT ' + S.endlessN);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = mix('#d7e2ff', '#2a2110', Math.min(1, S.bright + 0.15));
    ctx.font = '800 13px system-ui, sans-serif';
    ctx.fillText(tag, L.sal + 58, L.sat + 22);
    ctx.font = '800 16px system-ui, sans-serif';
    ctx.fillText(name, L.sal + 58, L.sat + 42);
    ctx.textAlign = 'right';
    ctx.font = '800 18px system-ui, sans-serif';
    ctx.fillText(commas(S.score), W - L.sar - 64, L.sat + 28);
    var btn = 44;
    drawMiniButton(L.sal + 8, L.sat + 10, btn, 'II', 'pause');
    drawMiniButton(W - L.sar - 8 - btn, L.sat + 10, btn, S.mute ? 'x' : '~', 'mute');
    var hatY = L.sat + 80;
    for (var i = 0; i < 3; i++) {
      ctx.globalAlpha = i < S.lives ? 1 : 0.28;
      drawHardHat(L.sal + 22 + i * 28, hatY, 0.55, 0, i < S.lives);
      ctx.globalAlpha = 1;
    }
    var fuseX = L.sal + 108;
    var fuseW = W - fuseX - L.sar - 78;
    if (fuseW > 40) drawFuse(fuseX, hatY - 12, fuseW, 22);
    var hintLabel = 'HINT ' + S.hints;
    ctx.font = '800 12px system-ui, sans-serif';
    var hw = 62;
    var hx = W - L.sar - 8 - hw;
    var hy = hatY - 14;
    ctx.globalAlpha = S.hints > 0 ? 1 : 0.4;
    drawButton(hx, hy, hw, 28, hintLabel, S.hints > 0 && S.mode === 'play' && !S.celebrating ? 'hint' : null, { size: 12 });
    ctx.globalAlpha = 1;
  }

  function drawMiniButton(x, y, s, glyph, id) {
    ctx.save();
    ctx.fillStyle = 'rgba(20,24,40,0.45)';
    ctx.beginPath();
    ctx.arc(x + s / 2, y + s / 2, s / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,248,230,0.85)';
    ctx.stroke();
    ctx.fillStyle = '#fff8e6';
    ctx.font = '800 16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (glyph === 'II') {
      ctx.fillRect(x + s * 0.32, y + s * 0.28, 4, s * 0.44);
      ctx.fillRect(x + s * 0.52, y + s * 0.28, 4, s * 0.44);
    } else {
      ctx.beginPath();
      ctx.moveTo(x + s * 0.28, y + s * 0.42);
      ctx.lineTo(x + s * 0.28, y + s * 0.58);
      ctx.lineTo(x + s * 0.4, y + s * 0.58);
      ctx.lineTo(x + s * 0.52, y + s * 0.7);
      ctx.lineTo(x + s * 0.52, y + s * 0.3);
      ctx.lineTo(x + s * 0.4, y + s * 0.42);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + s * 0.5, y + s * 0.5, s * 0.16, -0.7, 0.7);
      ctx.stroke();
      if (glyph === 'x') {
        ctx.beginPath();
        ctx.moveTo(x + s * 0.62, y + s * 0.32);
        ctx.lineTo(x + s * 0.82, y + s * 0.68);
        ctx.moveTo(x + s * 0.82, y + s * 0.32);
        ctx.lineTo(x + s * 0.62, y + s * 0.68);
        ctx.stroke();
      }
    }
    ctx.restore();
    if (id) pushHit(x, y, s, s, 'btn', { id: id });
  }

  function drawFloaters() {
    S.floaters.forEach(function (f) {
      var a = 1 - f.t / f.life;
      ctx.globalAlpha = Math.max(0, a);
      ctx.font = (f.big ? '900 28px ' : '800 14px ') + 'system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = f.big ? 6 : 3;
      ctx.strokeStyle = '#2a2110';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
      ctx.globalAlpha = 1;
    });
    S.particles.forEach(function (p) {
      ctx.globalAlpha = Math.max(0, 1 - p.t / p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });
  }

  function drawDrag() {
    var p = S.pointer;
    if (!p || !p.dragPiece) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.globalAlpha = 0.92;
    drawWireGraphic(p.dragPiece.wire, (p.dragPiece.rot || 0) * 90, false, 64, false);
    ctx.restore();
  }

  function drawBanner(text) {
    ctx.save();
    ctx.font = '900 ' + Math.round(Math.min(40, W * 0.09)) + 'px system-ui, sans-serif';
    var w = Math.min(W - 40, ctx.measureText(text).width + 36);
    var x = (W - w) / 2;
    var y = H * 0.4;
    ctx.fillStyle = 'rgba(255,248,230,0.94)';
    roundRect(x, y - 28, w, 56, 14);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#2a2110';
    ctx.stroke();
    ctx.fillStyle = '#2a2110';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, W / 2, y);
    ctx.restore();
  }

  function drawPlay() {
    var L = layout();
    ctx.save();
    if (S.shake > 0.02) {
      var m = S.shake * 8;
      ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
    }
    drawRoom(L);
    drawPegboard(L);
    drawBoard(L);
    drawActors(L);
    drawSparkyStrip(L);
    drawTray(L);
    drawDrag();
    ctx.restore();
    drawHUD(L);
    drawFloaters();
    if (S.celebrating && S.mode === 'play') {
      var a = Math.min(1, S.celT * 1.6);
      ctx.globalAlpha = a;
      drawBanner('LIGHTS ON!');
      ctx.globalAlpha = 1;
    }
    if (S.flash > 0) {
      ctx.fillStyle = 'rgba(255,244,210,' + (S.flash * 0.7) + ')';
      ctx.fillRect(0, 0, W, H);
    }
  }

  function card(y, h) {
    var x = 22;
    var w = W - 44;
    ctx.fillStyle = 'rgba(16, 20, 32, 0.45)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff8e6';
    roundRect(x, y, w, h, 18);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#2a2110';
    ctx.stroke();
    return { x: x, y: y, w: w, h: h };
  }

  function drawPause() {
    drawPlay();
    var c = card(H * 0.22, Math.min(360, H * 0.52));
    ctx.fillStyle = '#2a2110';
    ctx.textAlign = 'center';
    ctx.font = '900 28px system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText('PAUSED', W / 2, c.y + 42);
    var bw = c.w - 48;
    drawButton(c.x + 24, c.y + 78, bw, 52, 'RESUME', 'resume');
    drawButton(c.x + 24, c.y + 140, bw, 48, 'RESHUFFLE', 'reshuffle', { ink: '#fff3d0' });
    drawButton(c.x + 24, c.y + 198, bw, 48, 'HOW TO PLAY', 'help', { ink: '#fff3d0' });
    drawButton(c.x + 24, c.y + 256, bw, 48, 'CLOCK OUT', 'title', { ghost: true });
  }

  function drawClear() {
    drawPlay();
    var c = card(H * 0.16, Math.min(460, H * 0.66));
    ctx.fillStyle = '#2a2110';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 15px system-ui, sans-serif';
    ctx.fillText(S.board.name.toUpperCase(), W / 2, c.y + 32);
    ctx.font = '900 30px system-ui, sans-serif';
    ctx.fillText('JOB DONE', W / 2, c.y + 68);
    var shown = S.mode === 'clear' ? S.levelStars : 0;
    for (var i = 0; i < 3; i++) drawStar(W / 2 - 48 + i * 48, c.y + 112, 16, i < shown);
    ctx.font = '800 16px system-ui, sans-serif';
    ctx.fillText('+' + commas(S.levelGained) + '    TOTAL ' + commas(S.score), W / 2, c.y + 150);
    if (S.lifeBack) {
      ctx.fillStyle = '#2f6bff';
      ctx.fillText('3 stars. Hat returned.', W / 2, c.y + 174);
    }
    ctx.fillStyle = '#2a2110';
    ctx.font = '700 14px system-ui, sans-serif';
    var lines = wrap(S.board.win, c.w - 48);
    lines.forEach(function (ln, i) { ctx.fillText(ln, W / 2, c.y + 196 + i * 18); });
    var last = S.run === 'campaign' && S.levelIndex >= Lib.LEVELS.length - 1;
    var bw = c.w - 48;
    if (last) {
      drawButton(c.x + 24, c.y + c.h - 124, bw, 50, 'OVERTIME', 'overtime');
      drawButton(c.x + 24, c.y + c.h - 66, bw, 46, 'CLOCK OUT', 'title', { ghost: true });
    } else {
      drawButton(c.x + 24, c.y + c.h - 78, bw, 54, 'NEXT JOB', 'next');
    }
  }

  function drawOver() {
    var L = layout();
    drawRoom(L);
    drawSparky(W / 2, H * 0.34, 120, 'zap');
    var c = card(H * 0.38, Math.min(380, H * 0.5));
    ctx.fillStyle = '#2a2110';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 28px system-ui, sans-serif';
    ctx.fillText("YOU'RE FIRED", W / 2, c.y + 36);
    ctx.font = '700 14px system-ui, sans-serif';
    var lines = wrap(S.overReason, c.w - 40);
    lines.forEach(function (ln, i) { ctx.fillText(ln, W / 2, c.y + 68 + i * 18); });
    ctx.font = '800 16px system-ui, sans-serif';
    ctx.fillText('Score ' + commas(S.score) + '   Best ' + commas(S.best), W / 2, c.y + 128);
    var bw = c.w - 48;
    drawButton(c.x + 24, c.y + 152, bw, 48, 'RETRY JOB', 'retry');
    drawButton(c.x + 24, c.y + 208, bw, 44, 'NEW SHIFT', 'newshift', { ink: '#fff6dc' });
    drawButton(c.x + 24, c.y + 260, bw, 42, 'TITLE', 'title', { ghost: true });
  }

  function drawDone() {
    drawPlay();
    var c = card(H * 0.2, Math.min(420, H * 0.58));
    ctx.fillStyle = '#2a2110';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 26px system-ui, sans-serif';
    ctx.fillText('SHIFT COMPLETE', W / 2, c.y + 48);
    ctx.font = '700 15px system-ui, sans-serif';
    var lines = wrap('The house is bright. The invoice is a problem for tomorrow.', c.w - 40);
    lines.forEach(function (ln, i) { ctx.fillText(ln, W / 2, c.y + 86 + i * 18); });
    ctx.font = '800 18px system-ui, sans-serif';
    ctx.fillText(commas(S.score), W / 2, c.y + 140);
    var bw = c.w - 48;
    drawButton(c.x + 24, c.y + c.h - 130, bw, 52, 'OVERTIME', 'overtime');
    drawButton(c.x + 24, c.y + c.h - 68, bw, 48, 'CLOCK OUT', 'title', { ghost: true });
  }

  function drawTitle() {
    var b = 0.5 + Math.sin(S.t * 1.6) * 0.5;
    var phase = (S.t % 6);
    var lit = phase > 1.6 && phase < 4.5;
    var zapped = phase >= 4.5 && phase < 5.4;
    var bright = lit ? 0.75 : (zapped ? 0.15 : 0.05);
    var sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, mix('#1c2744', '#ffd7a1', bright));
    sky.addColorStop(1, mix('#243044', '#f0d2a4', bright));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,248,220,' + (0.15 + bright * 0.5) + ')';
    ctx.beginPath();
    ctx.arc(W * 0.82, H * 0.1, 22, 0, Math.PI * 2);
    ctx.fill();
    var hx = W * 0.5;
    var hy = H * 0.3;
    ctx.fillStyle = mix('#3a4258', '#f7e7c8', bright);
    roundRect(hx - 90, hy - 50, 180, 130, 8);
    ctx.fill();
    ctx.strokeStyle = '#2a2110';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = lit ? '#fff1c2' : '#1a2438';
    roundRect(hx + 28, hy - 24, 42, 52, 4);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = lit ? '#ffe56a' : '#6a5428';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(hx - 70, hy + 20);
    ctx.lineTo(hx + 40, hy + 20);
    ctx.lineTo(hx + 40, hy + 2);
    ctx.stroke();
    if (zapped) {
      ctx.font = '900 18px system-ui, sans-serif';
      ctx.fillStyle = '#fff6bf';
      ctx.textAlign = 'center';
      ctx.fillText('ZAP!', hx + 48, hy - 36);
    }
    var mood = zapped ? 'zap' : (lit ? 'happy' : 'idle');
    drawSparky(hx - 20, hy + 130, 110, mood);
    if (phase > 4.3 && phase < 5.5) drawDog(hx + 70, hy + 78, 54);
    ctx.fillStyle = '#fff8e6';
    ctx.strokeStyle = '#2a2110';
    ctx.lineWidth = 6;
    ctx.font = '900 ' + Math.round(Math.min(68, W * 0.16)) + 'px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var titleY = Math.max(cssPx('--sat') + 54, H * 0.1);
    ctx.strokeText('SPARKY', W / 2, titleY);
    ctx.fillText('SPARKY', W / 2, titleY);
    ctx.font = '800 14px system-ui, sans-serif';
    ctx.lineWidth = 0;
    ctx.fillStyle = mix('#d5def5', '#2a2110', bright);
    ctx.fillText('ONE MORE OUTLET', W / 2, titleY + 36);
    var bw = Math.min(300, W - 48);
    var bh = Math.max(52, Math.min(60, H * 0.07));
    var bx = (W - bw) / 2;
    var by = Math.min(H * 0.58, H - cssPx('--sab') - bh * 3 - 120);
    if (by < titleY + 160) by = titleY + 160;
    drawButton(bx, by, bw, bh, 'PLAY', 'play');
    drawButton(bx, by + bh + 12, bw, bh - 4, 'HOW TO PLAY', 'help', { ink: '#fff6dc' });
    drawButton(bx, by + bh + 12 + bh + 8, bw, bh - 4, 'OVERTIME', 'endless', { ink: '#fff6dc' });
    ctx.fillStyle = mix('#d5def5', '#2a2110', Math.max(bright, 0.2));
    ctx.font = '800 16px system-ui, sans-serif';
    ctx.fillText('BEST  ' + commas(S.best), W / 2, by + bh * 3 + 36);
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.fillText('8 house calls. The dog is not on the permit.', W / 2, by + bh * 3 + 58);
    drawMiniButton(W - cssPx('--sar') - 54, cssPx('--sat') + 10, 44, S.mute ? 'x' : '~', 'mute');
  }

  function drawHelp() {
    ctx.fillStyle = '#1c2744';
    ctx.fillRect(0, 0, W, H);
    var pages = [
      ['SPIN', 'Tap a wire to turn it a quarter turn. When it glows, power is getting through. Light every gadget.'],
      ['DROP', 'Drag a spare from the tray into a dashed box. Tap a selected spare to spin it. Drag a placed spare back to yank it.'],
      ['DON\'T', 'Shoo the dog before it chews. Don\'t let a puddle get power or you zap. Tap Hank. If the breaker trips, tap MAIN. Beat the clock.']
    ];
    var page = pages[S.helpPage];
    var c = card(cssPx('--sat') + 70, Math.min(H - 180, 460));
    ctx.fillStyle = '#ffc83d';
    ctx.font = '900 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('HOW TO PLAY', W / 2, c.y + 28);
    ctx.fillStyle = '#2a2110';
    ctx.font = '900 28px system-ui, sans-serif';
    ctx.fillText(page[0], W / 2, c.y + 68);
    ctx.font = '700 16px system-ui, sans-serif';
    var lines = wrap(page[1], c.w - 48);
    lines.forEach(function (ln, i) { ctx.fillText(ln, W / 2, c.y + 110 + i * 22); });
    if (S.helpPage === 0) {
      ctx.save();
      ctx.translate(W / 2, c.y + 210);
      drawWireGraphic('corner', (S.t * 40) % 360, true, 70, false);
      ctx.restore();
    } else if (S.helpPage === 1) {
      ctx.save();
      ctx.translate(W / 2 - 40, c.y + 220);
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#2f6bff';
      ctx.lineWidth = 2;
      roundRect(-24, -24, 48, 48, 8);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.translate(80, 0);
      drawWireGraphic('straight', 90, false, 56, false);
      ctx.restore();
    } else {
      drawDog(W / 2 - 50, c.y + 230, 60);
      ctx.font = '900 18px system-ui, sans-serif';
      ctx.fillStyle = '#3aa0e0';
      ctx.fillText('drip', W / 2 + 40, c.y + 220);
    }
    for (var i = 0; i < 3; i++) {
      ctx.fillStyle = i === S.helpPage ? '#ffc83d' : 'rgba(42,33,16,0.2)';
      ctx.beginPath();
      ctx.arc(W / 2 - 16 + i * 16, c.y + c.h - 78, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    var bw = (c.w - 60) / 2;
    if (S.helpPage < 2) {
      drawButton(c.x + 24, c.y + c.h - 60, bw, 46, 'BACK', 'help-back', { ink: '#fff6dc' });
      drawButton(c.x + 36 + bw, c.y + c.h - 60, bw, 46, 'NEXT', 'help-next');
    } else {
      drawButton(c.x + 24, c.y + c.h - 60, bw, 46, 'BACK', 'help-back', { ink: '#fff6dc' });
      drawButton(c.x + 36 + bw, c.y + c.h - 60, bw, 46, 'GOT IT', 'help-done');
    }
    drawMiniButton(W - cssPx('--sar') - 54, cssPx('--sat') + 10, 44, S.mute ? 'x' : '~', 'mute');
  }

  function render() {
    S.hits = [];
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (S.mode === 'title') drawTitle();
    else if (S.mode === 'help') drawHelp();
    else if (S.mode === 'pause') drawPause();
    else if (S.mode === 'clear') drawClear();
    else if (S.mode === 'over') drawOver();
    else if (S.mode === 'done') drawDone();
    else drawPlay();
  }

  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth;
    H = window.innerHeight;
    if (window.visualViewport) {
      W = window.visualViewport.width;
      H = window.visualViewport.height;
    }
    canvas.width = Math.max(1, Math.round(W * DPR));
    canvas.height = Math.max(1, Math.round(H * DPR));
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
  }

  function frame(ts) {
    if (!S.last) S.last = ts;
    var dt = Math.min(0.05, (ts - S.last) / 1000);
    S.last = ts;
    if (!S.frozen) update(dt);
    render();
    S.ready = true;
    requestAnimationFrame(frame);
  }

  function describeNext() {
    if (S.mode !== 'play' || !S.board || S.celebrating || S.dying) return null;
    var L = layout();
    if (!S.breakerOn) {
      var src = null;
      S.board.cells.forEach(function (c) { if (c.role === 'source') src = c; });
      if (src) {
        var p = cellCenter(src.x, src.y, L);
        return { type: 'tap', x: p.x, y: p.y, why: 'breaker' };
      }
    }
    if (S.dog && S.dog.phase === 'sniff') {
      var dp = cellCenter(S.dog.x, S.dog.y, L);
      return { type: 'tap', x: dp.x, y: dp.y, why: 'dog' };
    }
    if (S.owner) {
      var src2 = null;
      S.board.cells.forEach(function (c) { if (c.role === 'source') src2 = c; });
      if (src2) {
        var sp = cellCenter(src2.x, src2.y, L);
        var prog = Math.min(1, S.owner.t / 1.35);
        return { type: 'tap', x: sp.x + (1 - prog) * L.cell * 1.35 + L.cell * 0.15, y: sp.y - 10, why: 'hank' };
      }
    }
    var gap = null;
    var trayIndex = -1;
    for (var gi = 0; gi < S.board.cells.length; gi++) {
      var g = S.board.cells[gi];
      if (g.role !== 'gap') continue;
      for (var ti = 0; ti < S.board.tray.length; ti++) {
        if (S.board.tray[ti].wire === g.need.wire) { gap = g; trayIndex = ti; break; }
      }
      if (gap) break;
    }
    if (gap && trayIndex >= 0) {
      var slots = traySlots(L);
      var slot = slots[trayIndex];
      var dest = cellCenter(gap.x, gap.y, L);
      return {
        type: 'drag',
        x1: slot.x + slot.w / 2, y1: slot.y + slot.h / 2,
        x2: dest.x, y2: dest.y,
        why: 'place'
      };
    }
    var bad = null;
    S.board.cells.forEach(function (c) {
      if (!bad && c.role === 'wire' && !c.fixed && !c.trap && !matches(c)) bad = c;
    });
    if (bad) {
      var bp = cellCenter(bad.x, bad.y, L);
      return { type: 'tap', x: bp.x, y: bp.y, why: 'rotate' };
    }
    var trap = null;
    S.board.cells.forEach(function (c) {
      if (!trap && c.trap && !matches(c)) trap = c;
    });
    if (trap && S.leak && S.leak.phase === 'live') {
      var tp = cellCenter(trap.x, trap.y, L);
      return { type: 'tap', x: tp.x, y: tp.y, why: 'safe-trap' };
    }
    return null;
  }

  function applyNext() {
    var mv = describeNext();
    if (!mv) return null;
    if (mv.why === 'dog') shooDog();
    else if (mv.why === 'hank') shooOwner();
    else if (mv.why === 'breaker') resetBreaker();
    else if (mv.why === 'place') {
      var gap = null;
      var piece = null;
      S.board.cells.forEach(function (c) {
        if (!gap && c.role === 'gap') {
          S.board.tray.forEach(function (t) {
            if (!piece && t.wire === c.need.wire) { gap = c; piece = t; }
          });
        }
      });
      if (gap && piece) {
        piece.rot = gap.need.sol;
        placePiece(piece, gap);
      }
    } else if (mv.why === 'rotate' || mv.why === 'safe-trap') {
      var hit = hitTest(mv.x, mv.y);
      if (hit && hit.kind === 'cell') rotateCell(hit.cell);
    }
    return mv.why;
  }

  window.__sparky = {
    ready: function () { return S.ready; },
    mode: function () { return S.mode; },
    freeze: function (v) { S.frozen = !!v; },
    step: function (dt) { update(dt == null ? 0.016 : dt); render(); },
    start: function (kind) { startRun(kind || 'campaign'); },
    nextMove: describeNext,
    applyNext: applyNext,
    solve: function () { if (S.board) Lib.applySolution(S.board); },
    forceDog: function () { spawnDog(); },
    forceOwner: function () { spawnOwner(); },
    forceLeak: function () { spawnLeak(true); },
    setRot: function (x, y, r) {
      var c = cellAt(x, y);
      if (!c) return;
      c.rot = r;
      c.spin = r * 90;
      c.spinShown = c.spin;
    },
    cell: function (x, y) {
      var c = cellAt(x, y);
      if (!c) return null;
      return { role: c.role, wire: c.wire || null, rot: c.rot || 0, sol: c.sol || 0, trap: !!c.trap, placed: !!c.placed, type: c.loadType || null };
    },
    hits: function () {
      return S.hits.map(function (h) {
        return { kind: h.kind, id: h.id || '', x: h.x, y: h.y, w: h.w, h: h.h, cx: h.x + h.w / 2, cy: h.y + h.h / 2 };
      });
    },
    cells: function () {
      if (!S.board) return [];
      return S.board.cells.map(function (c) {
        return { x: c.x, y: c.y, role: c.role, wire: c.wire || null, rot: c.rot || 0, sol: c.sol || 0, trap: !!c.trap, placed: !!c.placed, type: c.loadType || null, need: c.need ? c.need.wire : null };
      });
    },
    setTime: function (t) { S.time = t; S.intro = 0; },
    snapshot: function () {
      var power = S.board ? Lib.powerState(S.board, S.breakerOn) : { on: new Set(), total: 0 };
      return {
        mode: S.mode,
        score: S.score,
        best: S.best,
        lives: S.lives,
        level: S.levelIndex,
        endless: S.endlessN,
        time: S.time,
        loadsOn: power.on.size,
        loadsTotal: power.total,
        breaker: S.breakerOn,
        shorts: S.shorts,
        shoos: S.shoos,
        hints: S.hints,
        celebrating: S.celebrating,
        tray: S.board ? S.board.tray.length : 0,
        name: S.board ? S.board.name : '',
        muted: S.mute,
        stars: S.levelStars,
        run: S.run,
        dog: !!S.dog,
        owner: !!S.owner,
        leak: S.leak ? S.leak.phase : ''
      };
    }
  };

  loadSave();
  resize();
  window.addEventListener('resize', resize);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
  window.addEventListener('keydown', onKey);
  canvas.addEventListener('pointerdown', onDown, { passive: false });
  canvas.addEventListener('pointermove', onMove, { passive: false });
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  document.addEventListener('touchmove', function (e) { if (e.cancelable) e.preventDefault(); }, { passive: false });
  setLive('Sparky. One more outlet. Best ' + commas(S.best));
  requestAnimationFrame(frame);
})();
