/* Angry Burritos levels. Units: meters, ground at y=0, slingshot at x=0.
   Builders return lists of {t:'block',m,x,y,w,h} (wood=crate, glass=salsa jar, stone=molcajete slab)
   and {t:'avo',kind,x,y} hiding snacks (plain=avocado/chip/lime/jalapeno, helmet=salsa cup, king=taco). */
(function () {
  var P = 0.24; // plank thickness
  function block(m, x, y, w, h) { return { t: 'block', m: m, x: x, y: y, w: w, h: h }; } // x,y = bottom-center
  function avo(x, y, kind) { return { t: 'avo', kind: kind || 'plain', x: x, y: y }; } // y = bottom
  // a box frame: two posts + roof; returns [items, topY]
  function frame(out, m, x, y, w, h, roofM) {
    out.push(block(m, x - w / 2 + P / 2, y, P, h));
    out.push(block(m, x + w / 2 - P / 2, y, P, h));
    out.push(block(roofM || m, x, y + h, w + 0.3, P));
    return y + h + P;
  }
  function L1() { var o = []; var t = frame(o, 'wood', 13, 0, 1.6, 1.4); o.push(avo(13, 0)); o.push(avo(13, t)); return o; }
  function L2() { var o = []; var t = frame(o, 'wood', 11.5, 0, 1.6, 1.4); frame(o, 'wood', 11.5, t, 1.2, 1.0); o.push(avo(11.5, 0)); o.push(avo(11.5, t));
    var t2 = frame(o, 'wood', 15, 0, 1.6, 1.4); o.push(avo(15, 0)); o.push(avo(15, t2)); return o; }
  function L3() { var o = []; var y = 0; for (var i = 0; i < 3; i++) { var ny = frame(o, 'glass', 13, y, 1.6, 1.2); o.push(avo(13, y)); y = ny; } o.push(avo(13, y, 'helmet')); return o; }
  function L4() { var o = []; var t = frame(o, 'stone', 12.5, 0, 2.2, 1.2); var t2 = frame(o, 'wood', 12.5, t, 1.8, 1.2); frame(o, 'glass', 12.5, t2, 1.2, 0.9);
    o.push(avo(12.5, 0, 'helmet')); o.push(avo(12.5, t)); o.push(avo(12.5, t2)); o.push(block('wood', 15, 0, 0.6, 0.6)); o.push(avo(15, 0.6)); return o; }
  function L5() { var o = []; // salsa-jar pyramid with snacks tucked inside hollow crates
    var rows = [[11, 12.2, 13.4, 14.6, 15.8], [11.6, 12.8, 14, 15.2], [12.2, 13.4, 14.6], [12.8, 14], [13.4]];
    rows.forEach(function (r, i) { r.forEach(function (x) { o.push(block(i % 2 ? 'glass' : 'wood', x, i * 1.0, 1.0, 1.0)); }); });
    o.push(avo(13.4, 5)); var t = frame(o, 'stone', 17.4, 0, 1.3, 1.0); o.push(avo(17.4, 0, 'helmet')); o.push(avo(17.4, t)); return o; }
  function L6() { var o = []; // taller molcajete fortress behind a slab wall
    o.push(block('stone', 9.4, 0, 0.5, 2.2));
    o.push(block('stone', 11, 0, 0.5, 2.8)); o.push(block('stone', 15, 0, 0.5, 2.8));
    o.push(block('stone', 13, 2.8, 4.6, P)); o.push(block('wood', 12, 0, P, 1.8)); o.push(block('wood', 14, 0, P, 1.8)); o.push(block('wood', 13, 1.8, 2.3, P));
    o.push(avo(13, 0, 'king')); var t = frame(o, 'wood', 13, 2.8 + P, 1.6, 1.0); o.push(avo(13, 2.8 + P, 'helmet')); var t2 = frame(o, 'glass', 13, t, 1.2, 0.9); o.push(avo(13, t)); o.push(avo(13, t2)); return o; }
  function L7() { var o = []; // elevated molcajete plinth far away, stone-roofed
    o.push(block('stone', 15, 0, 3.6, 2.2)); var t = frame(o, 'wood', 14.15, 2.2, 1.3, 1.4); frame(o, 'stone', 15.85, 2.2, 1.3, 1.4);
    o.push(block('glass', 15, t, 3.4, P)); o.push(avo(14.15, 2.2)); o.push(avo(15.85, 2.2, 'helmet')); o.push(avo(15, t + P, 'king'));
    o.push(block('stone', 9.2, 0, 0.5, 2.0));
    var t3 = frame(o, 'wood', 11, 0, 1.1, 1.0); o.push(avo(11, 0)); o.push(block('wood', 11, t3, 0.5, 0.5)); return o; }
  function L8() { var o = []; // three-tower castle, all towers 3 storeys
    [11, 14, 17].forEach(function (x, i) { var y = 0; for (var k = 0; k < 3; k++) { var m = k === 0 ? 'stone' : k === 1 ? 'wood' : 'glass'; var ny = frame(o, m, x, y, 1.5, 1.2); o.push(avo(x, y, k === 0 ? 'helmet' : 'plain')); y = ny; } o.push(avo(x, y, i === 1 ? 'king' : 'helmet')); });
    o.push(block('stone', 12.5, 1.44, 1.3, P)); o.push(block('stone', 15.5, 1.44, 1.3, P)); o.push(block('stone', 9.3, 0, 0.5, 2.6)); return o; }
  window.AB_LEVELS = [
    { name: 'Breakfast', build: L1, birds: ['classic', 'classic', 'classic'], right: 15 },
    { name: 'Twin Crates', build: L2, birds: ['classic', 'classic', 'classic'], right: 17 },
    { name: 'Jar Tower', build: L3, birds: ['classic', 'breakfast', 'classic'], right: 15 },
    { name: 'Rock Bottom', build: L4, birds: ['classic', 'breakfast', 'wet', 'classic'], right: 17 },
    { name: 'Salsa Pyramid', build: L5, birds: ['breakfast', 'wet', 'classic'], right: 19 },
    { name: 'Molcajete Fort', build: L6, birds: ['wet', 'classic', 'breakfast'], right: 17 },
    { name: 'High Counter', build: L7, birds: ['classic', 'breakfast', 'wet'], right: 18 },
    { name: 'Guac Castle', build: L8, birds: ['wet', 'breakfast', 'classic', 'wet'], right: 19 }
  ];
})();
