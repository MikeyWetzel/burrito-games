/* Anonymous play counter: one POST per round start. No cookies, IDs or third parties. Never throws. */
(function () {
  var base = '';
  try { base = new URL('../stats/', document.currentScript.src).href; } catch (e) {}
  var last = {};
  window.BurritoPlay = function (g) {
    try {
      var now = Date.now(); if (last[g] && now - last[g] < 3000) return; last[g] = now;
      var u = base + 'play.php?g=' + encodeURIComponent(g);
      if (navigator.sendBeacon && navigator.sendBeacon(u, '')) return;
      fetch(u, { method: 'POST', keepalive: true, credentials: 'omit' }).catch(function () {});
    } catch (e) {}
  };
  window.BurritoCounts = function (cb) {
    try { fetch(base + 'counts.php', { credentials: 'omit' }).then(function (r) { return r.json(); }).then(function (d) { cb(d.games || {}); }).catch(function () {}); } catch (e) {}
  };
  window.BurritoFmtPlays = function (n) {
    var s = n >= 1e6 ? (n / 1e6).toFixed(n < 1e7 ? 1 : 0).replace(/\.0$/, '') + 'M' : n >= 1e3 ? (n / 1e3).toFixed(n < 1e4 ? 1 : 0).replace(/\.0$/, '') + 'K' : String(n);
    return s + (n === 1 ? ' play' : ' plays');
  };
  try { var pl = document.currentScript.getAttribute('data-pageload'); if (pl) window.BurritoPlay(pl); } catch (e) {}
})();
