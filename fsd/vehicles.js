// Rev 1.7: traffic vehicles built from scratch as smooth lofted bodies (no external/extracted assets).
// Each body is one continuous mesh: superellipse cross-sections swept along the length, shaped by
// monotone-cubic profiles (ground clearance with wheel arches, roofline, beltline, plan width, tumblehome).
// Glass/pillars/lower trim are vertex colours, so the shading stays soft and matte like the in-car view.
import * as THREE from './vendor/three.module.min.js?v=r170';

// monotone cubic (PCHIP) through keys [[x, y], ...]
function pchip(xs, ys) {
  const n = xs.length, d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (() => { const w1 = 2 * (xs[i + 1] - xs[i]) + (xs[i] - xs[i - 1]), w2 = (xs[i + 1] - xs[i]) + 2 * (xs[i] - xs[i - 1]); return (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]); })();
  return x => { if (x <= xs[0]) return ys[0]; if (x >= xs[n - 1]) return ys[n - 1]; let i = 0; while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1]; };
}
const prof = keys => pchip(keys.map(k => k[0]), keys.map(k => k[1]));
const sgnpow = (v, p) => Math.sign(v) * Math.pow(Math.abs(v), p);
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// colours (multiplied by the body material colour)
const C_BODY = [1, 1, 1], C_GLASS = [0.44, 0.45, 0.48], C_RIM = [1.1, 1.1, 1.1], C_LOW = [0.7, 0.705, 0.715], C_DARK = [0.3, 0.3, 0.32];

/* loft(spec): spec = { L, top, bot, hw, ht, belt, n1, n2, endF, endR, color(x,y,z,ny,s) }
   all profiles are functions of z in [-L/2 (front), L/2 (rear)] */
const VB = [0, 0.035, 0.069, 0.071, 0.2, 0.4, 0.6, 0.78, 0.839, 0.841, 0.9], NL = 10, NC = 5;
export function loft(S, NZ = 30) {
  const NA = 2 * (NL + VB.length + NC - 1);
  const pos = [], col = [], idx = [], vv = [], h = S.L / 2, ring = NA + 1;
  let zs = []; for (let i = 0; i <= NZ; i++) { const u = i / NZ; zs.push(-h + S.L * (0.35 * u + 0.65 * (0.5 - 0.5 * Math.cos(Math.PI * u)))); } // denser at the ends
  for (const zb of S.zb || []) if (zb > -h + 0.02 && zb < h - 0.02) zs.push(zb - 0.004, zb + 0.004);
  zs.sort((a, b) => a - b); NZ = zs.length - 1;
  for (const z of zs) {
    const yb = S.bot(z), yt = S.top(z), belt = Math.min(yt - 0.02, Math.max(yb + 0.02, S.belt(z))), hw = S.hw(z), ht = Math.min(hw, S.ht(z));
    // rounded nose/tail: shrink section toward its centre within endR of each end
    const dF = z + h, dR = h - z, r = S.endR || 0.4, d = Math.min(dF / (S.endRF || r), dR / r);
    const e = d >= 1 ? 1 : Math.sqrt(Math.max(0, 1 - (1 - d) * (1 - d)));
    const cy = S.endY ? S.endY(z) : (yb + yt) / 2;
    // right half: lower part (bottom centre -> belt) resampled by arc length; upper part at fixed v breakpoints
    // so colour boundaries (belt rim, roof rim) land exactly on vertex rows and stay crisp.
    const p1 = 2 / (S.n1 || 5), p2 = 2 / (S.n2 || 3), sh = (x, y) => [x * e, cy + (y - cy) * (S.endYS ? 1 - (1 - e) * S.endYS : e)];
    const dense = []; for (let k = 0; k <= 120; k++) { const u = -Math.PI / 2 + k / 120 * Math.PI / 2; dense.push([hw * Math.pow(Math.max(0, Math.cos(u)), p1), belt + (belt - yb) * sgnpow(Math.sin(u), p1)]); }
    const acc = [0]; for (let k = 1; k < dense.length; k++) acc.push(acc[k - 1] + Math.hypot(dense[k][0] - dense[k - 1][0], dense[k][1] - dense[k - 1][1]));
    const rs = [], tot = acc[acc.length - 1] || 1; let j = 0;
    for (let k = 0; k < NL; k++) { const t = k / NL * tot; while (j < acc.length - 2 && acc[j + 1] < t) j++; const f = (t - acc[j]) / ((acc[j + 1] - acc[j]) || 1);
      rs.push([...sh(dense[j][0] + (dense[j + 1][0] - dense[j][0]) * f, dense[j][1] + (dense[j + 1][1] - dense[j][1]) * f), -1]); }
    const up = (v) => { const sn = Math.pow(v, 1 / p2), c = Math.sqrt(Math.max(0, 1 - sn * sn)); return [...sh(Math.pow(c, p2) * (hw + (ht - hw) * v), belt + (yt - belt) * v), v]; };
    for (const v of VB) rs.push(up(v));
    const a0 = Math.asin(Math.pow(0.9, 1 / p2)); for (let k = 1; k <= NC; k++) { const u = a0 + (Math.PI / 2 - a0) * k / NC, sn = Math.sin(u), v = Math.pow(sn, p2); rs.push([...sh(Math.pow(Math.max(0, Math.cos(u)), p2) * (hw + (ht - hw) * v), belt + (yt - belt) * v), v]); }
    for (let k = 0; k < rs.length; k++) { pos.push(rs[k][0], rs[k][1], z); vv.push(rs[k][2]); }
    for (let k = rs.length - 2; k >= 0; k--) { pos.push(-rs[k][0], rs[k][1], z); vv.push(rs[k][2]); }
  }
  for (let i = 0; i < NZ; i++) for (let a = 0; a < NA; a++) { const p = i * ring + a, q = p + ring; idx.push(p, p + 1, q, p + 1, q + 1, q); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  // seam fix: average normals of the duplicated a=0 / a=NA columns
  const nr = g.attributes.normal;
  for (let i = 0; i <= NZ; i++) { const p = i * ring, q = p + NA; for (let k = 0; k < 3; k++) { const v = (nr.array[p * 3 + k] + nr.array[q * 3 + k]) / 2; nr.array[p * 3 + k] = nr.array[q * 3 + k] = v; } }
  for (let v = 0; v < pos.length / 3; v++) {
    const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2], ny = nr.array[v * 3 + 1];
    let c = (S.color && S.color(x, y, z, ny, vv[v])) || C_BODY;
    const gshade = 0.9 + 0.12 * Math.min(1, Math.max(0, y / (S.H || 1.5))); // soft vertical gradient
    col.push(c[0] * gshade, c[1] * gshade, c[2] * gshade);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

// ---- wheels: rounded tyre (lathe) + recessed light hub ----
const wheelCache = {};
function wheelGeo(r, w) {
  const k = r + '_' + w; if (wheelCache[k]) return wheelCache[k];
  const pts = [], R = r, rr = Math.min(w * 0.45, r * 0.28);
  pts.push(new THREE.Vector2(r * 0.68, -w / 2));
  for (let i = 0; i <= 3; i++) { const a = -Math.PI / 2 + i / 3 * Math.PI / 2; pts.push(new THREE.Vector2(R - rr + Math.cos(a) * rr, -w / 2 + rr + Math.sin(a) * rr)); }
  for (let i = 0; i <= 3; i++) { const a = i / 3 * Math.PI / 2; pts.push(new THREE.Vector2(R - rr + Math.cos(a) * rr, w / 2 - rr + Math.sin(a) * rr)); }
  pts.push(new THREE.Vector2(r * 0.68, w / 2));
  const tyre = new THREE.LatheGeometry(pts, 16); tyre.rotateZ(Math.PI / 2);
  const hub = new THREE.CylinderGeometry(r * 0.7, r * 0.7, w * 0.84, 14); hub.rotateZ(Math.PI / 2);
  return (wheelCache[k] = [tyre, hub]);
}
const tyreMat = new THREE.MeshStandardMaterial({ color: 0x404246, roughness: 0.92 });
const hubMat = new THREE.MeshStandardMaterial({ color: 0x9da0a4, roughness: 0.8 });
function addWheels(g, zs, half, r, w) {
  const [t, hgeo] = wheelGeo(r, w);
  for (const z of zs) for (const sd of [-1, 1]) {
    const m = new THREE.Mesh(t, tyreMat); m.position.set(sd * (half - w / 2), r, z); m.castShadow = true; g.add(m);
    const hb = new THREE.Mesh(hgeo, hubMat); hb.position.set(sd * (half - w / 2 - 0.004), r, z); g.add(hb);
  }
}
// bottom profile with wheel arches carved out
const arches = (base, wz, r, extra = 1.12) => z => { let y = base(z); for (const w of wz) { const dz = Math.abs(z - w), R = r * extra + 0.04; if (dz < R) y = Math.max(y, r + 0.05 + (r * 0.98) * Math.sqrt(1 - (dz / R) ** 2)); } return y; };

// glass helper: greenhouse window band (z0..z1, between belt+0.03 and roof-edge), pillars at zp
const xEdge = v => 99;
function glassFn({ z0, z1, ws0, ws1, rs0, rs1, pillars = [], pw = 0.13, roofV = 0.84 }) {
  // ws0..ws1 windscreen (front), rs0..rs1 rear screen: glass up to the roof; side glass between belt rim and roof rim
  return (x, y, z, ny, v) => {
    if (v < 0 || z < z0 || z > z1) return null;
    if (v < 0.07) return C_RIM;
    const inW = z > ws0 && z < ws1, inR = z > rs0 && z < rs1;
    if (inW || inR) { // windscreen / rear screen live on the sloped top cap
      if (Math.abs(x) > Math.abs(xEdge(v))) return C_RIM;
      if ((inW && (z < ws0 + 0.06 || z > ws1 - 0.06)) || (inR && (z < rs0 + 0.06 || z > rs1 - 0.06))) return v > 0.84 ? C_RIM : C_GLASS;
      return C_GLASS; }
    if (v > 0.9) return null; if (v > 0.84) return C_RIM;
    for (const p of pillars) if (Math.abs(z - p) < pw / 2) return C_RIM;
    return C_GLASS;
  };
}
const lowFn = (yLow) => (x, y, z, ny, v) => (v < 0 && y < yLow + 0.1 ? C_LOW : null);
const pick = (...fs) => (...a) => { for (const f of fs) { const c = f(...a); if (c) return c; } return null; };

// ---- vehicle definitions (front = -z), dimensions match TYPES in game.js ----
function car({ L, W, H, wb, r, belt0, hood, deck, gs, gp0, gp1, ge, roofT = 0.62, clr = 0.2, tumble = 0.86, n1 = 5, n2 = 4, pillars, hatch = false }) {
  const h = L / 2, hw = W / 2, wz = [-wb / 2 - (L / 2 - wb / 2) * 0.0 + (L / 2 - (L - wb) / 2 - wb / 2) - 0, wb / 2];
  const fz = -h + (L - wb) * 0.5 * 1.02, rz = fz + wb; const W_Z = [fz, rz];
  const top = prof([[-h, hood - 0.1], [-h + 0.22, hood - 0.02], [-h + 0.6, hood], [gs, hood + 0.06], [gs + (gp0 - gs) * 0.55, hood + (H - hood) * 0.78], [gp0, H - 0.03], [(gp0 + gp1) / 2, H + 0.01], [gp1, H - 0.04], [gp1 + (ge - gp1) * 0.45, deck + (H - deck) * 0.66], [ge, deck + 0.04], [Math.max(ge + 0.06, h - 0.22), deck], [h, deck - 0.1]]);
  const beltP = prof([[-h, hood - 0.25], [-h + 0.7, hood - 0.08], [gs, belt0 - 0.02], [0, belt0], [ge, belt0 + 0.03], [h, deck - 0.24]]);
  const hwP = prof([[-h, hw * 0.88], [-h + 0.45, hw * 0.97], [-h + 1.2, hw], [h - 0.9, hw], [h - 0.3, hw * 0.97], [h, hw * 0.84]]);
  const htP = z => z > gs - 0.1 && z < ge + 0.1 ? hw * tumble * (0.9 + 0.1 * sstep(gs, gp0, z) * (1 - sstep(gp1, ge, z))) : hw * 0.96;
  const bot = arches(prof([[-h, clr + 0.14], [-h + 0.5, clr], [h - 0.5, clr], [h, clr + 0.16]]), W_Z, r);
  const S = { L, H, top, bot, belt: beltP, hw: hwP, ht: htP, n1, n2, endR: 0.26, endRF: 0.28, endYS: 0.22,
    zb: [gs + 0.02, gs + 0.08, gp0 - 0.11, gp0 - 0.05, gp1 + 0.1, gp1 + 0.16, ge - 0.08, ge - 0.02, ...(pillars || []).flatMap(p => [p - 0.065, p + 0.065])],
    color: pick(glassFn({ z0: gs + 0.02, z1: ge - 0.02, ws0: gs, ws1: gp0 - 0.05, rs0: gp1 + 0.1, rs1: ge, pillars: pillars || [] }), lowFn(clr + 0.22)) };
  const g = new THREE.Group(); g.add(new THREE.Mesh(loft(S), null)); addWheels(g, W_Z, hw - 0.02, r, 0.24); return g;
}

const DEF = {
  sedan: () => car({ L: 4.8, W: 1.86, H: 1.44, wb: 2.86, r: 0.36, belt0: 0.88, hood: 0.86, deck: 1.06, gs: -0.85, gp0: -0.25, gp1: 0.7, ge: 1.5, pillars: [0.38] }),
  suv: () => car({ L: 4.9, W: 1.96, H: 1.72, wb: 2.9, r: 0.4, belt0: 1.05, hood: 1.02, deck: 1.3, gs: -0.95, gp0: -0.2, gp1: 1.9, ge: 2.3, tumble: 0.86, n1: 7, n2: 5, pillars: [0.15, 1.25], clr: 0.24 }),
  cop: () => car({ L: 4.8, W: 1.86, H: 1.44, wb: 2.86, r: 0.36, belt0: 0.88, hood: 0.86, deck: 1.06, gs: -0.85, gp0: -0.25, gp1: 0.7, ge: 1.5, pillars: [0.38] }),
  pickup: () => { const L = 5.9, h = L / 2, hw = 1.0, r = 0.42, W_Z = [-1.9, 1.85], cabEnd = 0.55;
    const top = prof([[-h, 0.98], [-h + 0.3, 1.14], [-h + 1.25, 1.2], [-1.0, 1.28], [-0.45, 1.9], [0.35, 1.9], [cabEnd - 0.05, 1.86], [cabEnd + 0.12, 1.24], [h - 0.2, 1.24], [h, 1.2]]);
    const belt = prof([[-h, 0.95], [-h + 1.0, 1.14], [-0.9, 1.2], [cabEnd, 1.22], [h, 1.2]]);
    const bot = arches(prof([[-h, 0.5], [-h + 0.5, 0.36], [h - 0.4, 0.36], [h, 0.5]]), W_Z, r);
    const S = { L, H: 1.9, top, bot, belt, hw: prof([[-h, 0.86], [-h + 0.6, 0.98], [h - 0.3, 1.0], [h, 0.96]]), ht: z => z < cabEnd + 0.1 && z > -1.05 ? 0.84 : 0.99, n1: 6, n2: 4, endR: 0.32,
      zb: [-1.0, -0.5, -0.115, 0.015, cabEnd - 0.02], color: pick(glassFn({ z0: -1.0, z1: cabEnd - 0.02, ws0: -1.0, ws1: -0.5, rs0: cabEnd - 0.02, rs1: cabEnd + 0.2, pillars: [-0.05] }), lowFn(0.6)) };
    const g = new THREE.Group(); g.add(new THREE.Mesh(loft(S), null));
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.06, h - cabEnd - 0.35), new THREE.MeshStandardMaterial({ color: 0x6f7276, roughness: 1 }));
    bed.position.set(0, 1.235, (cabEnd + 0.18 + h - 0.15) / 2); g.add(bed); addWheels(g, W_Z, 0.98, r, 0.3); return g; },
  van: () => { const L = 5.4, h = L / 2, r = 0.37, W_Z = [-1.8, 1.75];
    const top = prof([[-h, 0.9], [-h + 0.35, 1.08], [-h + 0.75, 1.3], [-h + 1.55, 2.12], [-h + 2.0, 2.2], [h - 0.15, 2.18], [h, 2.08]]);
    const belt = prof([[-h, 0.88], [-h + 0.8, 1.2], [-h + 1.6, 1.3], [h, 1.3]]);
    const bot = arches(prof([[-h, 0.45], [-h + 0.4, 0.34], [h - 0.3, 0.34], [h, 0.45]]), W_Z, r);
    const S = { L, H: 2.2, top, bot, belt, hw: prof([[-h, 0.88], [-h + 0.6, 1.0], [h - 0.2, 1.01], [h, 0.98]]), ht: prof([[-h, 0.8], [-h + 1.6, 0.9], [h, 0.94]]), n1: 6, n2: 5, endR: 0.3, endRF: 0.5,
      zb: [-h + 0.75, -h + 1.6, -h + 2.3], color: pick(glassFn({ z0: -h + 0.75, z1: -h + 2.3, ws0: -h + 0.7, ws1: -h + 1.6, rs0: 99, rs1: 99, pillars: [] }), lowFn(0.56)) };
    const g = new THREE.Group(); g.add(new THREE.Mesh(loft(S), null)); addWheels(g, W_Z, 1.0, r, 0.26); return g; },
  box: () => { const L = 7.6, h = L / 2, r = 0.46, W_Z = [-2.9, 2.6], cab = 2.1, g = new THREE.Group();
    const c0 = -cab / 2; // local cab coords
    const top = prof([[c0, 1.3], [c0 + 0.12, 1.55], [c0 + 0.55, 1.68], [c0 + 0.75, 1.75], [c0 + 1.25, 2.62], [c0 + 1.55, 2.78], [c0 + 1.85, 3.2], [cab / 2, 3.3]]);
    const belt = prof([[c0, 1.2], [c0 + 0.6, 1.62], [c0 + 0.85, 1.7], [cab / 2, 1.74]]);
    const cS = { L: cab, H: 3.3, top, bot: arches(() => 0.55, [W_Z[0] + h - cab / 2], r), belt, hw: prof([[c0, 1.0], [c0 + 0.5, 1.1], [c0 + 1.0, 1.15], [cab / 2, 1.2]]), ht: prof([[c0, 0.9], [c0 + 1.2, 1.0], [c0 + 1.6, 1.08], [cab / 2, 1.18]]), n1: 7, n2: 5, endR: 0.25, endYS: 0.1,
      zb: [c0 + 1.62, c0 + 1.68],
      color: (x, y, z, ny, v) => { if (v >= 0 && y > 1.98 && y < 2.62 && z < c0 + 1.62 && ny < 0.75) return C_GLASS; if (v >= 0 && y > 1.9 && y < 2.7 && z < c0 + 1.68 && ny < 0.8) return C_RIM; return v < 0 && y < 0.75 ? C_LOW : null; } };
    const cm = new THREE.Mesh(loft(cS, 60), null); cm.position.z = -h + cab / 2; g.add(cm);
    const bL = L - cab - 0.05, bS = { L: bL, H: 3.45, top: () => 3.45, bot: () => 0.95, belt: () => 2.2, hw: () => 1.22, ht: () => 1.21, n1: 12, n2: 12, endR: 0.1, endYS: 0.05, color: (x, y, z, ny, v) => (v < 0 && y < 1.05 ? C_LOW : null) };
    const bm = new THREE.Mesh(loft(bS, 16), null); bm.position.z = h - bL / 2; g.add(bm);
    const ch = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.3, L - 0.6), new THREE.MeshStandardMaterial({ color: 0x45474b, roughness: 1 })); ch.position.set(0, 0.78, 0); g.add(ch);
    addWheels(g, W_Z, 1.15, r, 0.34); return g; },
  semi: () => { const L = 17.4, h = L / 2, r = 0.5, W_Z = [-7.6, -4.9, -4.0, 6.3, 7.5], cab = 3.3, g = new THREE.Group(), c0 = -cab / 2;
    const top = prof([[c0, 1.45], [c0 + 0.15, 1.75], [c0 + 0.9, 1.92], [c0 + 1.15, 2.0], [c0 + 1.6, 3.0], [c0 + 1.95, 3.15], [c0 + 2.5, 3.85], [cab / 2, 3.95]]);
    const belt = prof([[c0, 1.35], [c0 + 0.9, 1.85], [c0 + 1.2, 1.98], [cab / 2, 2.05]]);
    const cS = { L: cab, H: 3.95, top, bot: arches(() => 0.62, [W_Z[0] + h - cab / 2], r), belt, hw: prof([[c0, 0.98], [c0 + 0.9, 1.06], [c0 + 1.3, 1.24], [cab / 2, 1.28]]), ht: prof([[c0, 0.85], [c0 + 1.1, 0.95], [c0 + 1.8, 1.12], [cab / 2, 1.26]]), n1: 7, n2: 4.5, endR: 0.3, endYS: 0.1,
      zb: [c0 + 2.05, c0 + 2.11],
      color: (x, y, z, ny, v) => { if (v >= 0 && y > 2.2 && y < 3.0 && z < c0 + 2.05 && ny < 0.75) return C_GLASS; if (v >= 0 && y > 2.12 && y < 3.08 && z < c0 + 2.11 && ny < 0.8) return C_RIM; return v < 0 && y < 0.8 ? C_LOW : null; } };
    const cm = new THREE.Mesh(loft(cS, 60), null); cm.position.z = -h + cab / 2; g.add(cm);
    const tL = L - cab - 0.3, tS = { L: tL, H: 4.1, top: () => 4.1, bot: () => 1.12, belt: () => 2.6, hw: () => 1.29, ht: () => 1.28, n1: 12, n2: 12, endR: 0.1, endYS: 0.05, color: (x, y, z, ny, v) => (v < 0 && y < 1.22 ? C_LOW : null) };
    const tm = new THREE.Mesh(loft(tS, 16), null); tm.position.z = h - tL / 2; g.add(tm);
    const ch = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.35, 12), new THREE.MeshStandardMaterial({ color: 0x45474b, roughness: 1 })); ch.position.set(0, 0.85, 1.5); g.add(ch);
    addWheels(g, W_Z, 1.25, r, 0.46); return g; },
  bus: () => { const L = 12.2, h = L / 2, r = 0.5, W_Z = [-3.9, 3.6];
    const top = prof([[-h, 2.6], [-h + 0.25, 3.12], [-h + 0.8, 3.2], [h - 0.4, 3.2], [h, 3.0]]);
    const belt = prof([[-h, 1.25], [-h + 0.3, 1.5], [h, 1.55]]);
    const pil = []; for (let z = -h + 1.6; z < h - 0.6; z += 1.15) pil.push(z);
    const S = { L, H: 3.2, top, bot: arches(() => 0.42, W_Z, r), belt, hw: () => 1.275, ht: () => 1.2, n1: 9, n2: 6, endR: 0.22, zb: pil.flatMap(p => [p - 0.06, p + 0.06]),
      color: (x, y, z, ny) => { if (y > 1.6 && y < 2.75 && ny < 0.7) { if (z < -h + 0.25) return y > 1.45 ? C_GLASS : null; for (const p of pil) if (Math.abs(z - p) < 0.06) return null; return C_GLASS; } return y < 0.62 ? C_LOW : null; } };
    const g = new THREE.Group(); g.add(new THREE.Mesh(loft(S, 72, 44), null)); addWheels(g, W_Z, 1.25, r, 0.36); return g; },
  moto: () => { const g = new THREE.Group();
    const bS = { L: 1.75, H: 1.1, top: prof([[-0.875, 0.78], [-0.6, 0.98], [-0.25, 1.02], [0.0, 0.88], [0.45, 0.9], [0.875, 0.86]]), bot: prof([[-0.875, 0.62], [-0.45, 0.4], [0.35, 0.4], [0.875, 0.68]]), belt: prof([[-0.875, 0.7], [0, 0.66], [0.875, 0.76]]),
      hw: prof([[-0.875, 0.1], [-0.45, 0.2], [0.1, 0.17], [0.875, 0.09]]), ht: prof([[-0.875, 0.08], [-0.45, 0.16], [0.875, 0.07]]), n1: 3, n2: 2.4, endR: 0.3, color: (x, y, z, ny, v) => (y < 0.5 ? C_LOW : null) };
    g.add(new THREE.Mesh(loft(bS, 40), null));
    const part = (geo, x, y, z, rx = 0, rz = 0, rider = 1) => { const m = new THREE.Mesh(geo, null); m.position.set(x, y, z); m.rotation.set(rx, 0, rz); m.userData.rider = rider; g.add(m); return m; };
    const cap = (r, len) => new THREE.CapsuleGeometry(r, len, 3, 8);
    part(cap(0.035, 0.62), 0, 0.62, -0.62, 0.42, 0, 0);       // front fork
    part(cap(0.03, 0.62), 0, 1.1, -0.48, 0, Math.PI / 2, 0); // handlebar
    part(cap(0.2, 0.36), 0, 1.36, 0.05, -0.38);              // torso
    part(new THREE.SphereGeometry(0.165, 18, 14), 0, 1.8, -0.14);  // helmet
    for (const sd of [-1, 1]) {
      part(cap(0.055, 0.36), sd * 0.24, 1.36, -0.24, -1.15, sd * 0.12); // arms to bars
      part(cap(0.085, 0.3), sd * 0.17, 1.0, -0.12, -1.35);   // thighs
      part(cap(0.07, 0.34), sd * 0.19, 0.66, -0.3, -0.25);   // shins
    }
    for (const z of [-0.74, 0.72]) { const [t, hb] = wheelGeo(0.33, 0.13); const m = new THREE.Mesh(t, tyreMat); m.position.set(0, 0.33, z); g.add(m); const k = new THREE.Mesh(hb, hubMat); k.position.set(0, 0.33, z); g.add(k); }
    return g; },
};
// Build a vehicle group; body meshes (material null) get the caller's per-instance body material.
const templates = {};
export function buildVehicle(type, bodyMat) {
  const f = DEF[type]; if (!f) return null; const g = (templates[type] || (templates[type] = f())).clone(true); // geometry shared between instances
  g.traverse(m => { if (m.isMesh && m.userData.body) m.material = null; });
  g.traverse(m => { if (m.isMesh && !m.material) { m.material = bodyMat; m.userData.body = 1;
    if (!m.geometry.attributes.color) { const n = m.geometry.attributes.position.count, c = new Float32Array(n * 3).fill(m.userData.rider ? 0.92 : 1); m.geometry.setAttribute('color', new THREE.BufferAttribute(c, 3)); } m.castShadow = true; m.receiveShadow = true; } });
  return g;
}
export const VEHICLE_TYPES = Object.keys(DEF);
