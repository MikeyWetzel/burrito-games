import * as THREE from './vendor/three.module.min.js?v=r170';

// ================= constants & helpers =================
const W = 3.7;                 // lane width (m)
const DMID = 1.5 * W;          // banking pivot
const MPH = 0.44704;
const SEG = 1200, EXIT_U = 760, RAMP_LEN = 420, OV_U = 520;
const qs = new URLSearchParams(location.search);
const AUTO = qs.has('auto'), GOD = qs.has('god');
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const hash = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const rnd = (a, b) => a + Math.random() * (b - a);
const laneC = i => W * (i + 0.5);

// ---- road centreline: Catmull-Rom splines over seeded control points ----
const XSTEP = 170, YSTEP = 240;
const cxp = i => i < 2 ? 0 : (hash(i * 1.37 + 0.5) - 0.5) * 32;
const cyp = i => i < 2 ? 0 : (hash(i * 2.11 + 5.3) - 0.5) * 14;
function cr(p0, p1, p2, p3, t) { const t2 = t * t, t3 = t2 * t; return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3); }
function spl(fn, step, s) { const f = s / step, i = Math.floor(f), t = f - i; return cr(fn(i - 1), fn(i), fn(i + 1), fn(i + 2), t); }
const roadX = s => spl(cxp, XSTEP, s);
const roadY = s => spl(cyp, YSTEP, s);
const slopeX = s => (roadX(s + 1) - roadX(s - 1)) * 0.5;
const slopeY = s => (roadY(s + 1) - roadY(s - 1)) * 0.5;
const bank = s => clamp((roadX(s + 6) - 2 * roadX(s) + roadX(s - 6)) / 36 * 40, -0.075, 0.075);

// ---- lane layout per 1.2 km segment: 0 plain 3-lane, 1 four-lane stretch, 2 exit ramp ----
const segType = k => { if (k < 1) return 0; const h = hash(k * 9.7 + 1); return h < 0.3 ? 0 : h < 0.62 ? 1 : 2; };
function laneN(s) {
  const k = Math.floor(s / SEG), u = s - k * SEG, t = segType(k);
  if (t === 1) return 3 + sstep(80, 230, u) - sstep(880, 1080, u);
  if (t === 2) return u < EXIT_U ? 3 + sstep(250, 400, u) : 3;
  return 3;
}
function rampT(s) { const k = Math.floor(s / SEG), u = s - k * SEG; if (segType(k) !== 2 || u < 200) return -2; if (u < EXIT_U) return -1; if (u > EXIT_U + RAMP_LEN) return -2; return (u - EXIT_U) / RAMP_LEN; }
const rampL = t => 3 * W + 58 * Math.pow(t, 1.7);
const rampDrop = t => -9 * t * t;
const hasOverpass = k => k >= 1 && hash(k * 3.3 + 7) > 0.3;
const NAMES = ['Lancaster Ave', 'Maple Ridge Rd', 'Harbor Blvd', 'Pinecrest Pkwy', 'Oakmont Dr', 'Cedar Hollow Rd', 'Riverside Ave', 'Summit Blvd', 'Willow Creek Rd', 'Granite St'];

// ================= renderer / scene =================
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const BG = 0x1d1e21;
const scene = new THREE.Scene();
scene.background = new THREE.Color(BG);
scene.fog = new THREE.Fog(BG, 150, 440);
const camera = new THREE.PerspectiveCamera(55, 1, 0.5, 700);
scene.add(new THREE.HemisphereLight(0xe8edf3, 0x2a2c30, 1.75));
const sun = new THREE.DirectionalLight(0xffffff, 2.3);
sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 34, bottom: -34, near: 1, far: 90 });
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04; sun.shadow.radius = 3;
scene.add(sun, sun.target);

// ================= road strips =================
const ROWS = 200, STEP = 2.5, BEHIND = 40;
const PROWS = 40;
function mkRows(n) { const o = {}; for (const k of ['s', 'x', 'y', 'z', 'nx', 'nz', 'bk', 'n', 'rt']) o[k] = new Float32Array(n); o.len = n; return o; }
const R = mkRows(ROWS), RP = mkRows(PROWS);
let S = 0, OX = 0, OY = 0; // ego arc position and render origin
function fillRow(Rr, i, s) {
  const x = roadX(s), dx = slopeX(s), inv = 1 / Math.sqrt(1 + dx * dx);
  Rr.s[i] = s; Rr.x[i] = x - OX; Rr.y[i] = roadY(s) - OY; Rr.z[i] = -(s - S);
  Rr.nx[i] = inv; Rr.nz[i] = dx * inv; Rr.bk[i] = bank(s); Rr.n[i] = laneN(s); Rr.rt[i] = rampT(s);
}
const _v = new THREE.Vector3();
function P(s, d, out = _v) {
  const x = roadX(s), dx = slopeX(s), inv = 1 / Math.sqrt(1 + dx * dx);
  out.x = x - OX + d * inv; out.z = -(s - S) + d * dx * inv; out.y = roadY(s) - OY - (d - DMID) * bank(s);
  return out;
}
class Strip {
  constructor(rows, mat, uvScale = 0, colors = false) {
    this.rows = rows; this.uvScale = uvScale;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(rows * 6); this.uv = new Float32Array(rows * 4);
    const nrm = new Float32Array(rows * 6); for (let i = 0; i < rows * 2; i++) nrm[i * 3 + 1] = 1;
    const idx = []; for (let i = 0; i < rows - 1; i++) { const a = i * 2, b = a + 1, c = a + 2, d = a + 3; idx.push(a, b, c, b, d, c); }
    g.setIndex(idx);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(this.uv, 2).setUsage(THREE.DynamicDrawUsage));
    if (colors) { this.col = new Float32Array(rows * 8); g.setAttribute('color', new THREE.BufferAttribute(this.col, 4)); }
    this.geo = g; this.mesh = new THREE.Mesh(g, mat); this.mesh.frustumCulled = false; scene.add(this.mesh);
  }
  update(Rr, fn, lift) {
    const p = this.pos, uv = this.uv, LR = Strip.LR;
    for (let i = 0; i < this.rows; i++) {
      LR[2] = 0; fn(i, LR);
      const dl = LR[0], dr = LR[1], k = i * 6, bx = Rr.x[i], by = Rr.y[i] + lift + LR[2], bz = Rr.z[i], nx = Rr.nx[i], nz = Rr.nz[i], bk = Rr.bk[i];
      p[k] = bx + dl * nx; p[k + 1] = by - (dl - DMID) * bk; p[k + 2] = bz + dl * nz;
      p[k + 3] = bx + dr * nx; p[k + 4] = by - (dr - DMID) * bk; p[k + 5] = bz + dr * nz;
      if (this.uvScale) { const v = Rr.s[i] / this.uvScale; uv[i * 4 + 1] = v; uv[i * 4 + 2] = 1; uv[i * 4 + 3] = v; }
    }
    this.geo.attributes.position.needsUpdate = true;
    if (this.uvScale) this.geo.attributes.uv.needsUpdate = true;
  }
}
Strip.LR = [0, 0, 0];

const dashTex = (() => { const c = document.createElement('canvas'); c.width = 4; c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 4, 26); const t = new THREE.CanvasTexture(c); t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; })();
const matGround = new THREE.MeshStandardMaterial({ color: 0x2c2e32, roughness: 1 });
const matRoad = new THREE.MeshStandardMaterial({ color: 0x0e0f11, roughness: 0.95 });
const matBand = new THREE.MeshStandardMaterial({ color: 0x55585e, roughness: 1 });
const matWhite = new THREE.MeshBasicMaterial({ color: 0xe6e8ea });
const matYellow = new THREE.MeshBasicMaterial({ color: 0xf0ac10 });
const matDash = new THREE.MeshBasicMaterial({ color: 0xe6e8ea, map: dashTex, alphaTest: 0.5 });
const matPath = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });

const st = {
  gL: new Strip(ROWS, matGround), gR: new Strip(ROWS, matGround),
  road: new Strip(ROWS, matRoad), ramp: new Strip(ROWS, matRoad),
  bandL: new Strip(ROWS, matBand), bandR: new Strip(ROWS, matBand), bandRamp: new Strip(ROWS, matBand),
  yellow: new Strip(ROWS, matYellow), white: new Strip(ROWS, matWhite), rampW: new Strip(ROWS, matWhite), rampWL: new Strip(ROWS, matWhite),
  dash: [1, 2, 3].map(() => new Strip(ROWS, matDash, 12)),
  path: new Strip(PROWS, matPath, 0, true),
};
for (const k of ['gL', 'gR', 'road', 'ramp', 'bandL', 'bandR', 'bandRamp']) st[k].mesh.receiveShadow = true;
st.path.mesh.renderOrder = 2;
const LWID = 0.19;
const inExit = i => R.rt[i] > -2; // rows within exit-lane zone (u>=200)
function rampRight(i) { const t = R.rt[i]; return t < 0 ? W * R.n[i] : rampL(t) + W; }
function updateRoad() {
  const s0 = Math.floor((S - BEHIND) / STEP) * STEP;
  for (let i = 0; i < ROWS; i++) fillRow(R, i, s0 + i * STEP);
  st.gL.update(R, (i, o) => { o[0] = -420; o[1] = -1.9; }, -0.05);
  st.gR.update(R, (i, o) => { o[0] = W * R.n[i] + 1.9; o[1] = W * R.n[i] + 420; }, -0.05);
  st.road.update(R, (i, o) => { o[0] = -1.9; o[1] = W * R.n[i] + 1.9; }, 0);
  st.ramp.update(R, (i, o) => { const t = R.rt[i]; if (t < 0) { o[0] = o[1] = W * 2; } else { o[0] = rampL(t) - 1.9; o[1] = rampL(t) + W + 1.9; o[2] = rampDrop(t) + 0.012; } }, 0.003);
  st.bandL.update(R, (i, o) => { o[0] = -1.9; o[1] = -1.25; }, 0.02);
  st.bandR.update(R, (i, o) => { const r = W * R.n[i]; if (inExit(i)) { o[0] = o[1] = r + 1.25; } else { o[0] = r + 1.25; o[1] = r + 1.9; } }, 0.02);
  st.bandRamp.update(R, (i, o) => { const t = R.rt[i]; if (t < -1) { o[0] = o[1] = W * 3 + 1.25; return; } const r = rampRight(i); o[0] = r + 1.25; o[1] = r + 1.9; if (t >= 0) o[2] = rampDrop(t) + 0.012; }, 0.02);
  st.yellow.update(R, (i, o) => { o[0] = 0.05; o[1] = 0.05 + LWID; }, 0.025);
  st.white.update(R, (i, o) => { const r = W * R.n[i]; const t = R.rt[i]; if (t === -1) { o[0] = o[1] = r; } else { o[0] = r - LWID; o[1] = r; } }, 0.025);
  st.rampW.update(R, (i, o) => { const t = R.rt[i]; if (t < -1) { o[0] = o[1] = W * 3; return; } const r = rampRight(i); o[0] = r - LWID; o[1] = r; if (t >= 0) o[2] = rampDrop(t) + 0.012; }, 0.03);
  st.rampWL.update(R, (i, o) => { const t = R.rt[i]; if (t < 0) { o[0] = o[1] = W * 3; return; } const l = rampL(t); o[0] = l; o[1] = l + LWID; o[2] = rampDrop(t) + 0.012; }, 0.03);
  st.dash.forEach((sp, j) => { const kb = j + 1; sp.update(R, (i, o) => { const c = W * kb; if (R.n[i] > kb + 0.04) { o[0] = c - 0.08; o[1] = c + 0.08; } else { o[0] = o[1] = c; } }, 0.025); });
}
// FSD planned path ribbon
const PATH_C0 = new THREE.Color(0x2a86ff), PATH_C1 = new THREE.Color(0x56a6ff);
function updatePath(egoD, tgtD, visible, len) {
  st.path.mesh.visible = visible; if (!visible) return;
  for (let i = 0; i < PROWS; i++) fillRow(RP, i, S + 2.4 + (i / (PROWS - 1)) * len);
  const col = st.path.col;
  for (let i = 0; i < PROWS; i++) {
    const u = i / (PROWS - 1), a = (1 - sstep(0.72, 1, u)) * 0.95;
    const c = PATH_C0.clone().lerp(PATH_C1, u * 0.6);
    for (let j = 0; j < 2; j++) { const k = i * 8 + j * 4; col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b; col[k + 3] = a; }
  }
  st.path.geo.attributes.color.needsUpdate = true;
  st.path.update(RP, (i, o) => { const u = (RP.s[i] - S) / 26; const d = lerp(egoD, tgtD, sstep(0, 1, u)); o[0] = d - 0.95; o[1] = d + 0.95; }, 0.045);
}

// ================= overpasses =================
const matConc = new THREE.MeshStandardMaterial({ color: 0x8d9095, roughness: 0.95 });
function mkOverpass() {
  const g = new THREE.Group();
  const span = 90, deck = new THREE.Mesh(new THREE.BoxGeometry(span, 1.4, 11), matConc); deck.position.set(DMID, 8.2, 0);
  const rail1 = new THREE.Mesh(new THREE.BoxGeometry(span, 1.0, 0.35), matConc); rail1.position.set(DMID, 9.4, -5.3);
  const rail2 = rail1.clone(); rail2.position.z = 5.3;
  g.add(deck, rail1, rail2);
  for (const x of [-6.5, W * 4 + 7]) for (const z of [-3, 3]) { const p = new THREE.Mesh(new THREE.BoxGeometry(1.1, 8.2, 1.1), matConc); p.position.set(x, 3.6, z); g.add(p); }
  const cap1 = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.8, 8.5), matConc); cap1.position.set(-6.5, 7.3, 0);
  const cap2 = cap1.clone(); cap2.position.x = W * 4 + 7; g.add(cap1, cap2);
  g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  scene.add(g); return g;
}
const overpasses = [mkOverpass(), mkOverpass()];
function updateOverpasses() {
  const k0 = Math.floor((S - 60) / SEG); let j = 0;
  for (let k = k0; k <= k0 + 2 && j < 2; k++) {
    if (!hasOverpass(k)) continue; const s = k * SEG + OV_U; if (s < S - 60 || s > S + 480) continue;
    const o = overpasses[j++]; o.visible = true; P(s, 0, o.position); o.position.y = roadY(s) - OY; o.rotation.set(0, -Math.atan(slopeX(s)), 0);
  }
  for (; j < 2; j++) overpasses[j].visible = false;
}

// ================= vehicles =================
function prof(pts, width, bevel, mat, segs = 3) {
  const sh = new THREE.Shape(); sh.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) sh.lineTo(pts[i][0], pts[i][1]); sh.closePath();
  const dep = Math.max(0.01, width - 2 * bevel);
  const g = new THREE.ExtrudeGeometry(sh, { depth: dep, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: segs, curveSegments: 1 });
  g.translate(0, 0, -dep / 2); g.rotateY(Math.PI / 2);
  const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; return m;
}
function pinch(g, L, kEnd = 0.16, kTop = 0.12) {
  g.traverse(m => { if (!m.isMesh || m.geometry.type !== 'ExtrudeGeometry' || m.geometry.userData.pinched) return; const a = m.geometry.attributes.position;
    for (let i = 0; i < a.count; i++) { const e = Math.abs(a.getZ(i)) / (L / 2), y = a.getY(i); a.setX(i, a.getX(i) * (1 - kEnd * sstep(0.55, 1.05, e)) * (1 - kTop * sstep(0.55, 1.45, y))); }
    m.geometry.computeVertexNormals(); m.geometry.userData.pinched = true; });
  return g;
}
const rect = (x0, x1, y0, y1) => [[x0, y0], [x0, y1], [x1, y1], [x1, y0]];
const tireMat = new THREE.MeshStandardMaterial({ color: 0x26272a, roughness: 0.9 });
const wheelGeos = {};
function wheels(g, xs, half, r, w = 0.28) {
  const key = r + '_' + w; const geo = wheelGeos[key] || (wheelGeos[key] = new THREE.CylinderGeometry(r, r, w, 16));
  for (const x of xs) for (const sd of [-1, 1]) { const m = new THREE.Mesh(geo, tireMat); m.rotation.z = Math.PI / 2; m.position.set(sd * (half - w / 2 + 0.03), r, -x); g.add(m); }
}
const GREY = 0xc6c9cd, GLASS = 0x8e9298;
const blinkMat = new THREE.MeshBasicMaterial({ color: 0xffa51f });
const brakeMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
const smallBox = new THREE.BoxGeometry(1, 1, 1);
function lights(g, L, Wd, y, front = true) {
  g.userData.blink = [[], []]; g.userData.brake = [];
  for (const sd of [-1, 1]) {
    const arr = g.userData.blink[sd < 0 ? 0 : 1];
    const rear = new THREE.Mesh(smallBox, blinkMat); rear.scale.set(0.28, 0.16, 0.1); rear.position.set(sd * (Wd / 2 - 0.12), y, L / 2 + 0.12); g.add(rear); arr.push(rear);
    if (front) { const f = new THREE.Mesh(smallBox, blinkMat); f.scale.set(0.12, 0.14, 0.4); f.position.set(sd * (Wd / 2 + 0.06), y - 0.05, -L / 2 + 0.5); g.add(f); arr.push(f); }
    const b = new THREE.Mesh(smallBox, brakeMat); b.scale.set(0.42, 0.13, 0.08); b.position.set(sd * (Wd / 2 - 0.42), y + 0.02, L / 2 + 0.11); g.add(b); g.userData.brake.push(b);
  }
  for (const m of [...g.userData.blink[0], ...g.userData.blink[1], ...g.userData.brake]) m.visible = false;
}
const TYPES = {
  sedan: { L: 4.75, Wd: 1.86, H: 1.45, w: 0.32, v: [27, 35], build(b, gl) { const g = new THREE.Group();
    g.add(prof([[2.25, 0.34], [2.25, 0.6], [1.9, 0.74], [0.9, 0.84], [-1.8, 0.9], [-2.25, 0.88], [-2.27, 0.34]], 1.86, 0.13, b));
    g.add(prof([[0.95, 0.82], [0.3, 1.32], [-0.9, 1.36], [-1.85, 0.88]], 1.52, 0.08, gl)); wheels(g, [1.45, -1.45], 0.93, 0.33); lights(g, 4.75, 1.86, 0.78); return pinch(g, 4.75, 0.18, 0.14); } },
  suv: { L: 4.9, Wd: 1.96, H: 1.75, w: 0.24, v: [26, 34], build(b, gl) { const g = new THREE.Group();
    g.add(prof([[2.33, 0.4], [2.33, 0.78], [2.0, 0.95], [1.1, 1.04], [-2.3, 1.1], [-2.35, 0.4]], 1.96, 0.14, b));
    g.add(prof([[1.1, 1.0], [0.45, 1.6], [-2.0, 1.64], [-2.3, 1.05]], 1.68, 0.08, gl)); wheels(g, [1.5, -1.5], 0.98, 0.38); lights(g, 4.9, 1.96, 0.98); return pinch(g, 4.9, 0.14, 0.12); } },
  pickup: { L: 5.9, Wd: 2.02, H: 1.9, w: 0.14, v: [26, 33], build(b, gl) { const g = new THREE.Group();
    g.add(prof([[2.82, 0.45], [2.82, 0.95], [2.3, 1.14], [1.0, 1.2], [-2.82, 1.2], [-2.84, 0.45]], 2.02, 0.12, b));
    g.add(prof([[0.95, 1.15], [0.5, 1.84], [-0.85, 1.87], [-0.95, 1.15]], 1.76, 0.08, gl));
    const bed = prof(rect(-1.15, -2.7, 1.0, 1.27), 1.62, 0.02, new THREE.MeshStandardMaterial({ color: 0x6f7277, roughness: 1 }), 1); bed.castShadow = false; g.add(bed);
    wheels(g, [1.9, -1.85], 1.01, 0.42); lights(g, 5.9, 2.02, 1.02); return pinch(g, 5.9, 0.08, 0.08); } },
  van: { L: 5.3, Wd: 2.0, H: 2.15, w: 0.1, v: [25, 31], build(b, gl) { const g = new THREE.Group();
    g.add(prof([[2.58, 0.4], [2.58, 0.95], [1.9, 1.3], [1.35, 2.0], [-2.55, 2.05], [-2.6, 0.4]], 2.0, 0.12, b));
    g.add(prof([[1.86, 1.27], [1.36, 1.92], [0.55, 1.95], [0.55, 1.27]], 2.04, 0.04, gl, 1)); wheels(g, [1.75, -1.75], 1.0, 0.37); lights(g, 5.3, 2.0, 1.05); return pinch(g, 5.3, 0.08, 0.08); } },
  box: { L: 7.6, Wd: 2.45, H: 3.4, w: 0.1, v: [23, 29], build(b, gl) { const g = new THREE.Group();
    g.add(prof([[3.72, 0.5], [3.72, 1.4], [3.5, 2.4], [2.0, 2.5], [2.0, 0.5]], 2.3, 0.1, b));
    g.add(prof([[3.66, 1.5], [3.46, 2.28], [2.6, 2.33], [2.6, 1.5]], 2.36, 0.03, gl, 1));
    g.add(prof(rect(1.85, -3.75, 0.72, 3.38), 2.45, 0.06, b, 1)); wheels(g, [2.9, -2.6], 1.15, 0.46, 0.4); lights(g, 7.6, 2.45, 0.85, false); return g; } },
  semi: { L: 17.2, Wd: 2.58, H: 4.05, w: 0.1, v: [23, 28], build(b, gl, tr) { const g = new THREE.Group();
    g.add(prof([[8.55, 0.5], [8.55, 1.7], [8.32, 2.9], [7.25, 3.05], [7.0, 3.45], [5.55, 3.5], [5.55, 0.5]], 2.45, 0.12, b));
    g.add(prof([[8.48, 1.85], [8.28, 2.78], [7.5, 2.86], [7.5, 1.85]], 2.5, 0.03, gl, 1));
    g.add(prof(rect(5.3, -8.55, 1.12, 4.05), 2.58, 0.05, tr, 1));
    const seam = new THREE.Mesh(smallBox, tireMat); seam.scale.set(0.06, 2.8, 0.04); seam.position.set(0, 2.6, 8.57); g.add(seam);
    const ch = new THREE.Mesh(smallBox, tireMat); ch.scale.set(1.6, 0.35, 12); ch.position.set(0, 0.85, 1.5); g.add(ch);
    wheels(g, [7.6, 4.9, 4.0, -6.3, -7.5], 1.25, 0.5, 0.5); lights(g, 17.2, 2.58, 1.2, false); return g; } },
};
const TYPE_W = [['sedan', 0.31], ['suv', 0.24], ['pickup', 0.14], ['van', 0.09], ['box', 0.1], ['semi', 0.12]];
const pools = {}; for (const k in TYPES) pools[k] = [];
function getVehicle(type) {
  const p = pools[type]; if (p.length) { const m = p.pop(); m.visible = true; return m; }
  const T = TYPES[type];
  const bm = new THREE.MeshStandardMaterial({ color: GREY, roughness: 0.88 });
  const tm = new THREE.MeshStandardMaterial({ color: 0xb4b7bb, roughness: 0.9 });
  const gm = new THREE.MeshStandardMaterial({ color: GLASS, roughness: 0.55 });
  const g = T.build(bm, gm, tm); g.userData.bodyMat = bm; g.userData.type = type; g.rotation.order = 'YXZ'; scene.add(g); return g;
}
function freeVehicle(m) { m.visible = false; pools[m.userData.type].push(m); }

// ---- ego: Model 3/Y style + Roadster ----
const egoGroup = new THREE.Group(); egoGroup.rotation.order = 'YXZ'; scene.add(egoGroup);
const egoPaint = new THREE.MeshStandardMaterial({ color: 0xf3f4f5, roughness: 0.32, metalness: 0.05 });
const blackGlass = new THREE.MeshStandardMaterial({ color: 0x07080a, roughness: 0.12, metalness: 0.5 });
const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2020 });
const model3 = new THREE.Group();
model3.add(prof([[2.2, 0.32], [2.2, 0.56], [1.9, 0.68], [0.9, 0.8], [-1.7, 0.88], [-2.12, 0.8], [-2.2, 0.62], [-2.18, 0.34]], 1.84, 0.2, egoPaint, 5));
model3.add(prof([[0.8, 0.78], [0.15, 1.3], [-0.75, 1.34], [-1.75, 0.9]], 1.36, 0.14, blackGlass, 5));
wheels(model3, [1.45, -1.45], 0.88, 0.34, 0.24);
for (const sd of [-1, 1]) { const t = new THREE.Mesh(smallBox, tailMat); t.scale.set(0.48, 0.07, 0.06); t.position.set(sd * 0.55, 0.74, 2.42); model3.add(t); }
for (const sd of [-1, 1]) { const mr = new THREE.Mesh(smallBox, egoPaint); mr.scale.set(0.22, 0.12, 0.14); mr.position.set(sd * 1.0, 0.92, -0.75); model3.add(mr); }
const diff = new THREE.Mesh(smallBox, blackGlass); diff.scale.set(1.5, 0.18, 0.06); diff.position.set(0, 0.42, 2.42); model3.add(diff);
const roadsterPaint = new THREE.MeshStandardMaterial({ color: 0xd3121e, roughness: 0.28, metalness: 0.25 });
const roadster = new THREE.Group();
roadster.add(prof([[2.2, 0.26], [2.2, 0.44], [1.5, 0.56], [0.35, 0.7], [-1.45, 0.78], [-2.0, 0.7], [-2.04, 0.3]], 2.02, 0.17, roadsterPaint, 4));
roadster.add(prof([[0.15, 0.68], [-0.3, 0.98], [-0.85, 1.0], [-1.3, 0.76]], 1.12, 0.1, blackGlass, 4));
wheels(roadster, [1.35, -1.3], 0.97, 0.35, 0.3);
const rtail = new THREE.Mesh(smallBox, tailMat); rtail.scale.set(1.7, 0.05, 0.05); rtail.position.set(0, 0.68, 2.2); roadster.add(rtail);
const nozzleMat = new THREE.MeshBasicMaterial({ color: 0x8fd0ff });
const nozzles = [];
for (const sd of [-1, 1]) { const n = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.2, 12), nozzleMat); n.rotation.x = Math.PI / 2; n.position.set(sd * 0.4, 0.5, 2.22); roadster.add(n); nozzles.push(n); }
pinch(model3, 4.4, 0.26, 0.18); pinch(roadster, 4.1, 0.2, 0.2);
for (const g of [model3, roadster]) { g.traverse(m => { if (m.isMesh) m.castShadow = true; }); egoGroup.add(g); }
roadster.visible = false;

// ---- pickup token ----
const pickup = new THREE.Group();
const pkGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.75, 0), new THREE.MeshStandardMaterial({ color: 0xff2b3a, emissive: 0xc0101c, emissiveIntensity: 0.9, roughness: 0.3, flatShading: true }));
pkGem.position.y = 1.4; pkGem.castShadow = true;
const pkRing = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.55, 40), new THREE.MeshBasicMaterial({ color: 0xff3344, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false }));
pkRing.rotation.x = -Math.PI / 2; pkRing.position.y = 0.06;
const pkBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 6, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xff3344, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
pkBeam.position.y = 3;
pickup.add(pkGem, pkRing, pkBeam); pickup.rotation.order = 'YXZ'; scene.add(pickup);

// ---- steam particles ----
const puffTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,.75)'); g.addColorStop(0.7, 'rgba(255,255,255,.22)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const NP = 220, parts = [];
for (let i = 0; i < NP; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false, opacity: 0 })); sp.visible = false; sp.renderOrder = 3; scene.add(sp); parts.push({ sp, age: 0, max: 0, s: 0, d: 0, h: 0, vs: 0, vd: 0, vh: 0, s0: 1, s1: 3, a: 1 }); }
let pIdx = 0;
function emit(s, d, h, vs, vd, vh, life, s0, s1, a = 0.9, color = 0xffffff) {
  const p = parts[pIdx = (pIdx + 1) % NP]; Object.assign(p, { s, d, h, vs, vd, vh, age: 0, max: life, s0, s1, a });
  p.sp.material.color.setHex(color); p.sp.visible = true;
}
function updateParts(dt) {
  for (const p of parts) {
    if (!p.sp.visible) continue; p.age += dt; if (p.age >= p.max) { p.sp.visible = false; continue; }
    p.s += p.vs * dt; p.d += p.vd * dt; p.h += p.vh * dt; p.vh += 1.6 * dt; const dmp = Math.exp(-dt * 1.8); p.vs = lerp(p.vs, G.v * 0.78, 1 - Math.exp(-dt * 1.5)); p.vd *= dmp; p.vh *= Math.exp(-dt * 1.2);
    if (p.h < 0.35) { p.h = 0.35; if (p.vh < 0) { p.vd += p.vh * (Math.random() < 0.5 ? -0.8 : 0.8); p.vh = 0.4; } }
    const k = p.age / p.max; P(p.s, p.d); p.sp.position.set(_v.x, _v.y + p.h, _v.z);
    const sc = lerp(p.s0, p.s1, 1 - (1 - k) * (1 - k)); p.sp.scale.set(sc, sc, 1); p.sp.material.opacity = Math.pow(1 - k, 1.4) * p.a;
  }
}

// ================= audio =================
const sfx = {
  ctx: null, muted: localStorage.getItem('fsdmm_mute') === '1',
  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC(); this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : 0.8; this.master.connect(c.destination);
    const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; this.noise = buf;
    this.hg = c.createGain(); this.hg.gain.value = 0; this.hf = c.createBiquadFilter(); this.hf.type = 'lowpass'; this.hf.frequency.value = 600; this.hf.Q.value = 3;
    this.o1 = c.createOscillator(); this.o1.type = 'sawtooth'; this.o2 = c.createOscillator(); this.o2.type = 'sine'; this.o3 = c.createOscillator(); this.o3.type = 'triangle';
    const g3 = c.createGain(); g3.gain.value = 0.35;
    this.o1.connect(this.hf); this.o2.connect(this.hf); this.o3.connect(g3); g3.connect(this.hf); this.hf.connect(this.hg); this.hg.connect(this.master);
    for (const o of [this.o1, this.o2, this.o3]) o.start();
  },
  setMute(m) { this.muted = m; localStorage.setItem('fsdmm_mute', m ? '1' : '0'); if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05); },
  hum(mph, on) { if (!this.ctx) return; const t = this.ctx.currentTime; this.o1.frequency.setTargetAtTime(38 + mph * 0.9, t, 0.1); this.o2.frequency.setTargetAtTime(120 + mph * 3.2, t, 0.1); this.o3.frequency.setTargetAtTime(240 + mph * 6.4, t, 0.1);
    this.hf.frequency.setTargetAtTime(260 + mph * 9, t, 0.1); this.hg.gain.setTargetAtTime(on ? 0.05 + mph * 0.0004 : 0, t, 0.15); },
  nz(dur, type, f0, f1, vol, pan = 0, q = 1) {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime, src = c.createBufferSource(); src.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.08, dur * 0.3)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = g; if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; g.connect(p); node = p; }
    src.connect(f); f.connect(g); node.connect(this.master); src.start(t, Math.random()); src.stop(t + dur + 0.05);
  },
  tone(type, f0, f1, dur, vol, delay = 0) {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  },
  whoosh(pan, v = 0.25) { this.nz(0.45, 'bandpass', 500, 1800, v, pan, 1.2); },
  thrust() { this.nz(1.3, 'lowpass', 4000, 500, 0.9, 0, 0.7); this.nz(0.9, 'highpass', 3000, 6000, 0.25); this.tone('sine', 90, 40, 0.5, 0.5); },
  crash() { this.nz(1.2, 'lowpass', 2500, 120, 1, 0, 0.8); this.tone('sine', 70, 30, 0.6, 0.7); for (let i = 0; i < 3; i++) { this.tone('square', 880, 880, 0.14, 0.08, 0.35 + i * 0.32); this.tone('square', 660, 660, 0.14, 0.08, 0.5 + i * 0.32); } },
  pickup() { [660, 880, 1320].forEach((f, i) => this.tone('sine', f, f * 1.01, 0.18, 0.18, i * 0.07)); },
  ping() { this.tone('sine', 1500, 1700, 0.12, 0.1); },
  chime() { this.tone('sine', 740, 740, 0.15, 0.12); this.tone('sine', 1110, 1110, 0.2, 0.12, 0.12); },
};

// ================= game state =================
const G = {
  state: 'attract', t: 0, v: 31, mph: 70, topMph: 70, dist: 0, passed: 0, near: 0, jumps: 0, score: 0,
  egoD: laneC(1), tgtD: laneC(1), egoVd: 0, yaw: 0, jumpT: -1, jumpH: 0, rsT: 0, charges: 0, cool: 0,
  crashT: 0, spin: 0, spinV: 0, shake: 0, nextPickup: 600, pickupOn: false, pkS: 0, pkD: 0, camD: laneC(1), auto: AUTO,
};
let cars = [];
let best = +localStorage.getItem('fsdmm_best') || 0;
$('best0').textContent = best.toLocaleString();
const egoDims = () => roadster.visible ? { L: 4.1, Wd: 2.02 } : { L: 4.7, Wd: 1.88 };

function reset() {
  for (const c of cars) freeVehicle(c.mesh); cars = [];
  Object.assign(G, { t: 0, v: 70 * MPH, mph: 70, topMph: 70, dist: 0, passed: 0, near: 0, jumps: 0, score: 0, egoD: laneC(1), tgtD: laneC(1), egoVd: 0, yaw: 0, jumpT: -1, jumpH: 0, rsT: 0, charges: 0, cool: 0, crashT: 0, spin: 0, spinV: 0, shake: 0, pickupOn: false, camD: laneC(1) });
  G.nextPickup = S + 500; setRoadster(false);
  for (let i = 0; i < 9; i++) spawnCar(S + 60 + i * 42 + rnd(0, 20));
}
function setRoadster(on) { roadster.visible = on; model3.visible = !on; $('rs').classList.toggle('hidden', !on); }

function spawnCar(sPos) {
  const n = Math.floor(laneN(sPos) + 0.02); const lane = Math.floor(Math.random() * n);
  const occ = new Set();
  for (const c of cars) { if (Math.abs(c.s - sPos) < 34 + c.L / 2) { occ.add(c.lane); if (c.lc) occ.add(c.lc.to); if (c.lane === lane) return false; } }
  if (!occ.has(lane) && occ.size >= n - 1) return false;
  let r = Math.random(), type = 'sedan'; for (const [k, w] of TYPE_W) { if ((r -= w) < 0) { type = k; break; } }
  const T = TYPES[type], m = getVehicle(type);
  m.userData.bodyMat.color.setHex(GREY);
  const k = Math.floor(sPos / SEG), u = sPos - k * SEG;
  const c = { type, mesh: m, s: sPos, lane, d: laneC(lane), L: T.L, Wd: T.Wd, H: T.H, v0: rnd(T.v[0], T.v[1]), v: 0, lc: null, lcTimer: rnd(1, 6), passed: false, exiting: segType(k) === 2 && lane === 3 && u < EXIT_U, braking: false, yaw: 0, jumped: false };
  c.v = c.v0; cars.push(c); return true;
}
const laneFree = (lane, s, me, gap) => !cars.some(o => o !== me && (o.lane === lane || (o.lc && o.lc.to === lane)) && Math.abs(o.s - s) < gap + (o.L + me.L) / 2);

function updateTraffic(dt) {
  const target = Math.round(lerp(10, 17, clamp(G.t / 120, 0, 1)));
  if (cars.length < target) spawnCar(S + rnd(330, 420));
  const blinkOn = (performance.now() % 700) < 380;
  for (const c of cars) {
    // follow leader
    let lead = null, gap = 1e9;
    for (const o of cars) { if (o === c) continue; const dl = o.s - c.s; if (dl > 0 && dl < gap && (o.lane === c.lane || (o.lc && o.lc.to === c.lane))) { gap = dl; lead = o; } }
    let vt = c.v0; const clear = gap - (c.L + (lead ? lead.L : 0)) / 2;
    if (lead && clear < 22) vt = Math.min(vt, lead.v - (clear < 8 ? 3 : 0));
    c.braking = vt < c.v - 0.5; c.v += clamp(vt - c.v, -6 * dt, 3 * dt); c.s += c.v * dt;
    // lane changes
    const nF = Math.floor(laneN(c.s + 90) + 0.02);
    if (!c.lc && !c.exiting) {
      c.lcTimer -= dt;
      const forced = c.lane >= nF;
      if (forced || (c.lcTimer < 0 && (clear < 30 || Math.random() < 0.3))) {
        c.lcTimer = rnd(3, 9);
        const dirs = forced ? [-1] : (Math.random() < 0.5 ? [-1, 1] : [1, -1]);
        for (const dd of dirs) { const to = c.lane + dd; if (to < 0 || to >= Math.min(nF, Math.floor(laneN(c.s) + 0.02))) continue; if (!laneFree(to, c.s, c, 10)) continue;
          if (G.state === 'play' && Math.abs(G.egoD - laneC(to)) < 2.6 && c.s - S < 9 && c.s - S > -6) continue;
          c.lc = { from: c.lane, to, t: 0, blink: forced ? 0.5 : 1.1 }; break; }
      }
    }
    if (c.lc) { c.lc.t += dt; const mt = clamp((c.lc.t - c.lc.blink) / 2.0, 0, 1); const e = sstep(0, 1, mt), nd = lerp(laneC(c.lc.from), laneC(c.lc.to), e);
      c.yaw = (nd - c.d) / Math.max(1, c.v * dt) ; c.d = nd; if (mt >= 1) { c.lane = c.lc.to; c.lc = null; c.yaw = 0; } }
    else if (c.exiting) { const t = rampT(c.s); c.d = t >= 0 ? rampL(t) + W / 2 : laneC(c.lane); c.yaw = 0; }
    // render
    const m = c.mesh, rt = c.exiting ? rampT(c.s) : -1;
    P(c.s, c.d, m.position); if (rt >= 0) m.position.y += rampDrop(rt) + 0.012;
    const yawRamp = rt >= 0 ? (58 * 1.7 * Math.pow(Math.max(rt, 1e-3), 0.7) / RAMP_LEN) : 0;
    m.rotation.set(Math.atan(slopeY(c.s)), -Math.atan(slopeX(c.s) + clamp(c.yaw, -0.3, 0.3) + yawRamp), -bank(c.s));
    const bl = m.userData.blink; const side = c.lc ? (c.lc.to > c.lc.from ? 1 : 0) : -1;
    for (let s2 = 0; s2 < 2; s2++) for (const x of bl[s2]) x.visible = side === s2 && blinkOn;
    for (const b of m.userData.brake) b.visible = c.braking;
  }
  // in-path vehicle tint (FSD shows the lead car in your path in blue)
  let lead = null, lg = 70;
  for (const c of cars) { const ds = c.s - S; if (ds > 2 && ds < lg && Math.abs(c.d - G.egoD) < 1.7) { lg = ds; lead = c; } }
  for (const c of cars) { const col = c.mesh.userData.bodyMat.color; if (c === lead) col.lerp(_blue, 0.15); else col.lerp(_grey, 0.15); }
  // despawn
  for (let i = cars.length - 1; i >= 0; i--) { const c = cars[i]; if (c.s < S - 45 || c.s > S + 520 || (c.exiting && rampT(c.s) > 0.95)) { freeVehicle(c.mesh); cars.splice(i, 1); } }
}
const _blue = new THREE.Color(0x8fb6f5), _grey = new THREE.Color(GREY);

function autoSteer() {
  const n = Math.floor(laneN(S + 40) + 0.02); let bestL = 0, bestScore = -1e9;
  const cur = clamp(Math.round(G.egoD / W - 0.5), 0, n - 1);
  for (let l = 0; l < n; l++) {
    let gap = 300; for (const c of cars) { const dd = c.s - S; if (dd > -7 && Math.abs(c.d - laneC(l)) < 2.6) gap = Math.min(gap, dd); }
    const sc = gap - Math.abs(l - cur) * 14 - (G.pickupOn && Math.abs(G.pkD - laneC(l)) < 1 ? -60 : 0);
    if (sc > bestScore) { bestScore = sc; bestL = l; }
  }
  if (Math.abs(bestL - cur) > 1) bestL = cur + Math.sign(bestL - cur);
  G.tgtD = laneC(bestL);
  if (roadster.visible && G.charges > 0 && G.cool <= 0 && G.jumpT < 0) { for (const c of cars) { const dd = c.s - S; if (dd > 6 && dd < 16 && Math.abs(c.d - G.egoD) < 2) { fire(); break; } } }
}

function toast(html, ms = 1100) { const el = $('toast'); el.innerHTML = html; el.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), ms); }
function fire() {
  if (G.state !== 'play' || !roadster.visible || G.jumpT >= 0 || G.cool > 0 || G.charges <= 0) return false;
  G.charges--; G.jumpT = 0; G.cool = 0.6; G.shake = 0.5; sfx.thrust(); renderCharges();
  for (let i = 0; i < 70; i++) { const under = i % 2; emit(S + (under ? rnd(-1.6, 1.6) : -2.2 - rnd(0, 0.6)), G.egoD + rnd(-0.9, 0.9), under ? 0.4 : 0.6, G.v * rnd(0.55, 0.85), rnd(-3, 3), under ? rnd(-2, 2) : rnd(0, 2), rnd(1.0, 1.9), rnd(0.8, 1.6), rnd(4, 8), 0.7); }
  return true;
}
function renderCharges() { $('charges').innerHTML = [0, 1, 2].map(i => `<i class="${i < G.charges ? '' : 'off'}"></i>`).join(''); }
function crash(other) {
  if (G.state !== 'play') return;
  G.state = 'crash'; G.crashT = 0; G.spinV = (Math.random() < 0.5 ? -1 : 1) * rnd(3, 5); G.shake = 1.2; sfx.crash();
  if (other) other.v += 6;
  for (let i = 0; i < 40; i++) emit(S + rnd(-1, 2), G.egoD + rnd(-1, 1), 0.6, G.v * rnd(0.3, 0.7), rnd(-4, 4), rnd(0, 3), rnd(0.8, 1.6), 0.6, rnd(3, 6), 0.6, 0xa9acb0);
  const f = $('flash'); f.style.transition = 'none'; f.style.opacity = 1; requestAnimationFrame(() => { f.style.transition = 'opacity 1.4s'; f.style.opacity = 0.35; });
  $('banner').classList.remove('hidden');
  if (navigator.vibrate) navigator.vibrate([80, 40, 120]);
}
function gameOver() {
  G.state = 'over'; $('banner').classList.add('hidden'); const sc = G.score; if (sc > best) { best = sc; localStorage.setItem('fsdmm_best', String(best)); }
  $('oscore').textContent = sc.toLocaleString(); $('odist').textContent = (G.dist / 1609.34).toFixed(1) + ' mi'; $('opass').textContent = G.passed; $('onear').textContent = G.near; $('otop').textContent = Math.round(G.topMph);
  $('obest').innerHTML = sc >= best && sc > 0 ? '<b style="color:#3e8ef7">New best!</b>' : `Best <b>${best.toLocaleString()}</b>`; $('best0').textContent = best.toLocaleString();
  $('over').classList.remove('hidden');
}
function start() {
  sfx.init(); reset(); G.state = 'play'; $('start').classList.add('hidden'); $('over').classList.add('hidden'); $('banner').classList.add('hidden'); $('hud').classList.remove('hidden'); $('flash').style.opacity = 0;
  toast('Self-Driving engaged<small>Mad Max · speed keeps climbing</small>', 1600); sfx.chime();
}
$('go').addEventListener('click', start); $('again').addEventListener('click', start);
const muteUI = () => { $('waves').style.display = sfx.muted ? 'none' : ''; $('xx').style.display = sfx.muted ? '' : 'none'; };
$('mute').addEventListener('pointerdown', e => { e.stopPropagation(); sfx.setMute(!sfx.muted); muteUI(); }); muteUI();

// ================= input =================
const ptr = { id: null, x0: 0, y0: 0, d0: 0, t0: 0, moved: 0, lastTap: 0, lx: 0, ly: 0 };
const pxPerLane = () => clamp(innerWidth * 0.21, 70, 170);
const maxD = s => W * laneN(s) - 1.05;
canvas.addEventListener('pointerdown', e => {
  sfx.ctx && sfx.ctx.resume(); ptr.id = e.pointerId; ptr.x0 = e.clientX; ptr.y0 = e.clientY; ptr.d0 = G.tgtD; ptr.t0 = performance.now(); ptr.moved = 0;
  try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
});
canvas.addEventListener('pointermove', e => {
  if (e.pointerId !== ptr.id) return; ptr.moved = Math.max(ptr.moved, Math.hypot(e.clientX - ptr.x0, e.clientY - ptr.y0));
  if (G.state === 'play' && !G.auto) G.tgtD = clamp(ptr.d0 + (e.clientX - ptr.x0) / pxPerLane() * W, 1.05, maxD(S + 20));
});
canvas.addEventListener('pointerup', e => {
  if (e.pointerId !== ptr.id) return; ptr.id = null; const now = performance.now();
  if (ptr.moved < 14 && now - ptr.t0 < 260) {
    if (now - ptr.lastTap < 340 && Math.hypot(e.clientX - ptr.lx, e.clientY - ptr.ly) < 70) { fire(); ptr.lastTap = 0; }
    else { ptr.lastTap = now; ptr.lx = e.clientX; ptr.ly = e.clientY; }
  }
});
canvas.addEventListener('pointercancel', () => { ptr.id = null; });
canvas.addEventListener('dblclick', e => e.preventDefault());
const keys = {};
addEventListener('keydown', e => { keys[e.key] = true; if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') { e.preventDefault(); if (G.state === 'play') fire(); else if (G.state !== 'crash' && e.key === ' ') start(); } if (e.key === 'm') { sfx.setMute(!sfx.muted); muteUI(); } });
addEventListener('keyup', e => { keys[e.key] = false; });
document.addEventListener('visibilitychange', () => { if (document.hidden && sfx.ctx) sfx.ctx.suspend(); else if (sfx.ctx) sfx.ctx.resume(); });

// ================= layout =================
const L = { fov: 60, back: 12, up: 8, ahead: 26, lookUp: 0 };
function resize() {
  const w = innerWidth, h = innerHeight, a = w / h;
  document.documentElement.classList.toggle('land', a > 1.05);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, pr)); renderer.setSize(w, h, false);
  const t = clamp((a - 0.46) / (1.6 - 0.46), 0, 1);
  L.fov = lerp(58, 40, t); L.back = lerp(15.5, 16, t); L.up = lerp(13, 9.5, t); L.ahead = lerp(13, 12, t);
  camera.aspect = a; camera.fov = L.fov; camera.updateProjectionMatrix();
}
let pr = 2;
addEventListener('resize', resize); resize();

// ================= main loop =================
let last = performance.now(), hudT = 0, fpsAcc = 0, fpsN = 0;
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(); let camInit = false;
function step(dt) {
  const playing = G.state === 'play';
  if (G.state === 'attract' || G.auto) autoSteer();
  // speed
  if (playing) { G.t += dt; const base = 70 + 92 * (1 - Math.exp(-G.t / 85)); G.mph = base + (roadster.visible ? 18 : 0); }
  else if (G.state === 'attract') G.mph = 72;
  if (G.state === 'crash' || G.state === 'over') G.v *= Math.exp(-dt * 2.2); else G.v = lerp(G.v, G.mph * MPH, 1 - Math.exp(-dt * 2));
  G.topMph = Math.max(G.topMph, G.v / MPH);
  S += G.v * dt; if (playing) G.dist += G.v * dt;
  OX = roadX(S); OY = roadY(S);
  // steering
  if (playing && !G.auto) { const k = (keys.ArrowLeft || keys.a ? -1 : 0) + (keys.ArrowRight || keys.d ? 1 : 0); if (k) G.tgtD += k * 11 * dt; }
  const md = maxD(S); G.tgtD = clamp(G.tgtD, 1.05, Math.max(1.05, maxD(S + 20)));
  if (G.state === 'play' || G.state === 'attract') {
    const prev = G.egoD; G.egoD += (G.tgtD - G.egoD) * (1 - Math.exp(-dt * 9)); if (G.egoD > md) G.egoD = lerp(G.egoD, md, 1 - Math.exp(-dt * 10));
    G.egoVd = (G.egoD - prev) / Math.max(dt, 1e-4);
  } else G.egoVd *= 0.9;
  // jump
  if (G.jumpT >= 0) { G.jumpT += dt; const JD = 1.15, u = G.jumpT / JD; if (u >= 1) { G.jumpT = -1; G.jumpH = 0; G.shake = 0.35; for (let i = 0; i < 14; i++) emit(S + rnd(-1.5, 1.5), G.egoD + rnd(-1, 1), 0.4, G.v * 0.8, rnd(-4, 4), 0.5, 0.8, 0.8, 3.5, 0.5); } else { G.jumpH = 4 * 4.8 * u * (1 - u);
      if (G.jumpT < 0.45) for (let i = 0; i < 3; i++) emit(S - 2.2 - rnd(0, 0.4), G.egoD + rnd(-0.6, 0.6), G.jumpH + 0.5, G.v * rnd(0.5, 0.8), rnd(-1.5, 1.5), rnd(-3, -0.5), rnd(0.9, 1.6), 0.7, rnd(4, 7), 0.8);
      if (G.jumpT < 0.3) for (let i = 0; i < 2; i++) emit(S + rnd(-1.4, 1.4), G.egoD + rnd(-0.8, 0.8), G.jumpH, G.v * rnd(0.6, 0.9), rnd(-2, 2), rnd(-6, -3), rnd(1, 1.6), 0.8, rnd(4, 7), 0.75); } }
  G.cool -= dt;
  // roadster
  if (G.rsT > 0 && playing) { G.rsT -= dt; if (G.rsT <= 0 && G.jumpT < 0) { G.rsT = 0; setRoadster(false); for (let i = 0; i < 20; i++) emit(S + rnd(-2, 2), G.egoD + rnd(-1, 1), 0.8, G.v * 0.8, rnd(-2, 2), 1, 0.7, 1, 3, 0.6); } else if (G.rsT <= 0) G.rsT = 0.01; }
  // pickups
  if (playing && !G.pickupOn && S > G.nextPickup - 360) { const n = Math.floor(laneN(G.nextPickup) + 0.02); G.pkS = G.nextPickup; G.pkD = laneC(Math.floor(Math.random() * Math.min(n, 3))); G.pickupOn = true; }
  pickup.visible = G.pickupOn;
  if (G.pickupOn) {
    P(G.pkS, G.pkD, pickup.position); pickup.rotation.y = -Math.atan(slopeX(G.pkS)); pkGem.rotation.y += dt * 2.5; pkGem.position.y = 1.4 + Math.sin(performance.now() / 260) * 0.2; pkRing.scale.setScalar(1 + Math.sin(performance.now() / 200) * 0.08);
    if (playing && Math.abs(G.pkS - S) < 2.8 && Math.abs(G.pkD - G.egoD) < 1.9 && G.jumpH < 2) { G.pickupOn = false; G.nextPickup = S + rnd(750, 1050); G.rsT = 12; G.charges = 3; setRoadster(true); renderCharges(); sfx.pickup(); toast('ROADSTER MODE<small>Double-tap to fire steam thrusters</small>', 1800);
      for (let i = 0; i < 26; i++) emit(S + rnd(-2, 2), G.egoD + rnd(-1.2, 1.2), rnd(0.3, 1.2), G.v * 0.85, rnd(-3, 3), 1, 0.7, 0.8, 3.5, 0.7, 0xff6670); }
    if (G.pkS < S - 20) { G.pickupOn = false; G.nextPickup = S + rnd(500, 800); }
  }
  updateTraffic(dt);
  // collisions / passing
  const ed = egoDims();
  for (const c of cars) {
    const ds = c.s - S, dd = Math.abs(c.d - G.egoD);
    if (playing && !GOD && !c.exiting && Math.abs(ds) < (c.L + ed.L) / 2 * 0.93 && dd < (c.Wd + ed.Wd) / 2 * 0.86) {
      if (G.jumpH > c.H - 0.25) { if (!c.jumped) { c.jumped = true; G.jumps++; } } else { crash(c); }
    }
    if (!c.passed && ds < -(c.L + ed.L) / 2) {
      c.passed = true; if (!playing) continue; G.passed++;
      const gapLat = dd - (c.Wd + ed.Wd) / 2;
      if (c.jumped) { toast('JUMPED +150', 700); sfx.ping(); }
      else if (gapLat < 0.75 && gapLat > -0.2) { G.near++; toast('NEAR MISS +100', 700); sfx.ping(); }
      if (dd < 6) sfx.whoosh(clamp((c.d - G.egoD) / 5, -1, 1), c.type === 'semi' || c.type === 'box' ? 0.35 : 0.22);
    }
  }
  G.score = Math.floor(G.dist / 10) + G.passed * 10 + G.near * 100 + G.jumps * 150;
  if (G.state === 'crash') { G.crashT += dt; if (G.crashT > 1.5) gameOver(); }
  if (G.state === 'crash' || G.state === 'over') { G.spin += G.spinV * dt; G.spinV *= Math.exp(-dt * 1.6); }
  // ego transform
  P(S, G.egoD, egoGroup.position); egoGroup.position.y += G.jumpH;
  const lat = clamp(G.egoVd / Math.max(G.v, 5), -0.35, 0.35);
  G.yaw = lerp(G.yaw, lat, 1 - Math.exp(-dt * 12));
  const ju = G.jumpT >= 0 ? G.jumpT / 1.15 : 0;
  egoGroup.rotation.set(Math.atan(slopeY(S)) + (G.jumpT >= 0 ? Math.sin(ju * Math.PI * 2) * 0.12 : 0), -Math.atan(slopeX(S) + G.yaw) + G.spin, -bank(S) - G.yaw * 0.25);
  nozzleMat.color.setHex(G.jumpT >= 0 && G.jumpT < 0.5 ? 0xffffff : 0x6fb6e8);
  // particles / road
  updateParts(dt); updateRoad(); updateOverpasses();
  updatePath(G.egoD, G.tgtD, (G.state === 'play' || G.state === 'attract') && G.jumpT < 0, clamp(55 + G.v * 0.5, 55, 95));
  // camera
  G.camD = lerp(G.camD, G.egoD, 1 - Math.exp(-dt * 4));
  const cd = lerp(G.camD, DMID + (laneN(S) - 3) * W * 0.5, 0.18);
  P(S - L.back, cd); const tp = _v.clone(); tp.y += L.up + G.jumpH * 0.25;
  P(S + L.ahead, lerp(cd, G.egoD, 0.3)); const tl = _v.clone(); tl.y += G.jumpH * 0.1;
  if (!camInit) { camPos.copy(tp); camLook.copy(tl); camInit = true; }
  camPos.lerp(tp, 1 - Math.exp(-dt * 10)); camLook.lerp(tl, 1 - Math.exp(-dt * 10));
  G.shake *= Math.exp(-dt * 4); const sh = G.shake * 0.35;
  camera.position.set(camPos.x + rnd(-sh, sh), camPos.y + rnd(-sh, sh), camPos.z); camera.lookAt(camLook);
  sun.position.set(egoGroup.position.x - 12, egoGroup.position.y + 40, egoGroup.position.z + 10); sun.target.position.set(egoGroup.position.x, egoGroup.position.y, egoGroup.position.z - 14);
  sfx.hum(G.v / MPH, G.state === 'play');
}
function hud(dt) {
  hudT -= dt; if (hudT > 0) return; hudT = 0.08;
  const mph = Math.round(G.v / MPH);
  $('speed').textContent = mph; $('setv').textContent = Math.round(G.mph / 5) * 5;
  $('streak').textContent = (G.dist / 1609.34).toFixed(1) + ' mi'; $('score').textContent = G.score.toLocaleString(); $('passed').textContent = G.passed;
  const k0 = Math.floor(S / SEG); let ex = null; for (let k = k0; k < k0 + 15; k++) if (segType(k) === 2 && k * SEG + EXIT_U > S) { ex = k; break; }
  if (ex !== null) { const mi = (ex * SEG + EXIT_U - S) / 1609.34; $('navd').textContent = mi < 0.2 ? Math.round(mi * 5280 / 50) * 50 + ' ft' : mi.toFixed(1) + ' mi'; $('navn').textContent = NAMES[ex % NAMES.length]; $('navx').textContent = (ex * 7) % 89 + 2; }
  const u = S - k0 * SEG; $('limitv').textContent = segType(k0) === 2 && u > 300 ? 65 : 70;
  if (roadster.visible) { $('rst').textContent = Math.ceil(G.rsT); $('ring').style.strokeDashoffset = (169.6 * (1 - G.rsT / 12)).toFixed(1); }
}
function frame(now) {
  const rdt = (now - last) / 1000; last = now; const dt = Math.min(0.05, rdt);
  step(dt); hud(dt); renderer.render(scene, camera);
  fpsAcc += rdt; fpsN++;
  if (fpsAcc > 2.5) { const avg = fpsAcc / fpsN; if (avg > 0.022 && pr > 1) { pr = Math.max(1, pr - 0.25); resize(); } else if (avg > 0.03 && renderer.shadowMap.enabled && pr <= 1) { renderer.shadowMap.enabled = false; scene.traverse(m => { if (m.material) m.material.needsUpdate = true; }); } fpsAcc = 0; fpsN = 0; }
  requestAnimationFrame(frame);
}
reset(); G.state = 'attract'; G.v = 72 * MPH;
requestAnimationFrame(frame);

// ---- test / debug hooks ----
window.FSD = { G, start, fire, crash: () => crash(cars[0]), roadster: () => { G.rsT = 12; G.charges = 3; setRoadster(true); renderCharges(); }, setAuto: b => { G.auto = b; }, warp: s => { S = s; for (const c of cars) freeVehicle(c.mesh); cars = []; }, get S() { return S; }, cars: () => cars, findSeg: (t, ov) => { for (let k = 1; k < 200; k++) if (segType(k) === t && (!ov || hasOverpass(k))) return k * SEG; return 0; }, noAdapt: () => { pr = 1; resize(); fpsAcc = -1e9; } };
