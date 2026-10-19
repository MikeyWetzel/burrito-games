// In-page greedy solver for Angry Burritos (deterministic Planck replay). Exposes window.ABSolve.
(function () {
  var A = window.AngryBurritos;
  function run(L, shots, maxShots) {
    A.loadLevel(L); A.skipOverview(); A.doneDelay = 0;
    var n = 0; while (A.s.simTime < 1.6) A.step();
    for (var i = 0; i < shots.length; i++) {
      if (A.s.state !== 'aim') break;
      var sh = shots[i]; A.launch(sh[0], sh[1]); var k = 0;
      while (A.s.state === 'fly' && k < 2000) { if (k === sh[2]) A.ability(); A.step(); k++; }
    }
    var s = A.s; return { state: s.state, avos: s.avos, blocks: s.blocks, down: s.blocksDown, left: s.birdsLeft, reason: s.clearReason, score: s.score };
  }
  function value(r) { if (r.state === 'won') return 1e6 + r.left * 1e4 + r.score / 100; return -r.avos * 100 + r.down * 5 - r.blocks + r.score / 10000; }
  function solve(L) {
    var shots = [], nb = window.AB_LEVELS[L].birds.length, tried = 0;
    for (var i = 0; i < nb; i++) {
      var best = null;
      for (var th = -25; th <= 65; th += 6) for (var m = 1.1; m <= 1.81; m += 0.35) for (var ai = 0; ai < 4; ai++) {
        var ab = [-1, 35, 55, 75][ai]; if (window.AB_LEVELS[L].birds[i] === 'classic' && ai > 1) continue;
        var t = th * Math.PI / 180, cand = [-m * Math.cos(t), -m * Math.sin(t), ab];
        var r = run(L, shots.concat([cand])); tried++;
        var v = value(r); if (!best || v > best.v) best = { v: v, c: cand, r: r };
      }
      shots.push(best.c);
      if (best.r.state === 'won') return { level: L + 1, won: true, shots: shots, result: best.r, sims: tried };
    }
    return { level: L + 1, won: false, shots: shots, result: run(L, shots), sims: tried };
  }
  window.ABSolve = { run: run, solve: solve };
})();
