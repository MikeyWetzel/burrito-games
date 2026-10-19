/* Shared burrito SVG art for the Burrito Games suite. */
(function (root) {
  var Art = {
    burrito: function (size) {
      size = size || 20;
      return '<svg viewBox="0 0 32 32" width="' + size + '" height="' + size + '" aria-label="burrito">' +
        '<g transform="rotate(-35 16 16)">' +
        '<rect x="4" y="10" width="24" height="12" rx="6" fill="#e9c27a" stroke="#7a5320" stroke-width="1.5"/>' +
        '<path d="M8 10 q2 6 0 12 M14 10 q2 6 0 12 M20 10 q2 6 0 12" stroke="#c89548" stroke-width="1.2" fill="none"/>' +
        '<ellipse cx="27" cy="16" rx="3" ry="5.5" fill="#6b3d1e" stroke="#7a5320"/>' +
        '<circle cx="27" cy="14" r="1.3" fill="#3fa34d"/><circle cx="27.5" cy="17.5" r="1.3" fill="#d33"/>' +
        '<circle cx="26.3" cy="16.3" r="1" fill="#fff3c4"/></g></svg>';
    },
    hotSauce: function (size) {
      size = size || 20;
      return '<svg viewBox="0 0 32 32" width="' + size + '" height="' + size + '" aria-label="flag">' +
        '<rect x="13" y="3" width="6" height="5" fill="#222"/>' +
        '<rect x="14" y="8" width="4" height="4" fill="#d22"/>' +
        '<path d="M11 12 h10 l1 3 v13 a2 2 0 0 1 -2 2 h-8 a2 2 0 0 1 -2 -2 v-13z" fill="#d22" stroke="#600" stroke-width="1"/>' +
        '<rect x="11" y="17" width="10" height="6" fill="#fff4d6"/>' +
        '<path d="M14 20 q2 -3 4 0 q-2 3 -4 0" fill="#2a8f2a"/></svg>';
    },
    salsa: function (size) {
      size = size || 24;
      return '<svg viewBox="0 0 32 32" width="' + size + '" height="' + size + '" style="position:absolute;inset:0;margin:auto">' +
        '<path d="M16 3 l3 7 7-3 -3 7 7 3 -7 3 3 7 -7-3 -3 7 -3-7 -7 3 3-7 -7-3 7-3 -3-7 7 3z" fill="#b30000" opacity=".85"/></svg>';
    },
    face: function (state, size) {
      size = size || 26;
      var eyes = '<circle cx="12" cy="15" r="1.6" fill="#000"/><circle cx="20" cy="15" r="1.6" fill="#000"/>';
      var mouth = '<path d="M11 20 q5 4 10 0" stroke="#000" stroke-width="1.5" fill="none"/>';
      if (state === 'oh') mouth = '<ellipse cx="16" cy="21" rx="2.2" ry="2.6" fill="#000"/>';
      if (state === 'dead') {
        eyes = '<path d="M10 13l4 4M14 13l-4 4M18 13l4 4M22 13l-4 4" stroke="#000" stroke-width="1.5"/>';
        mouth = '<path d="M11 23 q5 -4 10 0" stroke="#000" stroke-width="1.5" fill="none"/>';
      }
      if (state === 'cool') {
        eyes = '<path d="M7 13 h18" stroke="#000" stroke-width="1.5"/><rect x="8.5" y="13" width="6" height="4" rx="1.5" fill="#000"/><rect x="17.5" y="13" width="6" height="4" rx="1.5" fill="#000"/>';
      }
      return '<svg viewBox="0 0 32 32" width="' + size + '" height="' + size + '">' +
        '<path d="M5 9 q11 -9 22 0 v15 q-11 8 -22 0z" fill="#efcf8d" stroke="#7a5320" stroke-width="1.5"/>' +
        '<path d="M5 9 q11 5 22 0" stroke="#c89548" stroke-width="1.2" fill="none"/>' +
        '<circle cx="9" cy="6.5" r="1.5" fill="#3fa34d"/><circle cx="16" cy="4.5" r="1.5" fill="#d33"/><circle cx="23" cy="6.5" r="1.5" fill="#3fa34d"/>' +
        eyes + mouth + '</svg>';
    }
  };
  root.BurritoArt = Art;
  if (typeof module !== 'undefined') module.exports = Art;
})(typeof window !== 'undefined' ? window : globalThis);
