import { SET, onChange, initSettings, openSettings, isLight, paintList, icon, saveSettings } from './settings.js?v=2.4.0';
import * as THREE from './vendor/three.module.min.js?v=r170';
// ---- speed exaggeration + traffic spacing (tunable: Settings > Tuning, or ?tune overlay) ----
const speedT = () => clamp((G.v / MPH - limitAt(S)) / (100 - limitAt(S)), 0, 1.6);
const exagF = () => 1 + SET.exK * Math.pow(speedT(), SET.exP); // multiplier on closing speed
const spaceF = () => 1 + SET.space * Math.min(1, speedT());
const RS_ON = true, DENS = { low: 0.7, normal: 1, high: 1.3 }, CUT = { chill: 0.08, standard: 0.2, madmax: 0.4 }, QPR = { low: 1, med: 1.5, high: 2 };

// ================= constants & helpers =================
export const REV = '1.4'; // bump on every deploy

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
const TDEP = 6.5; // tunnels: road ramps down into the bore and back up
const tunDip = s => { const k = Math.floor(s / SEG), u = s - k * SEG; if (segType(k) !== 3) return 0; return -TDEP * (sstep(T0 - 170, T0 - 10, u) - sstep(T1 + 10, T1 + 170, u)); };
const roadY = s => spl(cyp, YSTEP, s) + tunDip(s);
const slopeX = s => (roadX(s + 1) - roadX(s - 1)) * 0.5;
const slopeY = s => (roadY(s + 1) - roadY(s - 1)) * 0.5;
const bank = s => clamp((roadX(s + 6) - 2 * roadX(s) + roadX(s - 6)) / 36 * 40, -0.075, 0.075);

// ---- lane layout per 1.2 km segment: 0 plain 3-lane, 1 four-lane stretch, 2 exit ramp ----
const TUN_ON = true;
const segType = k => { if (k < 1) return 0; if (k === 2) return TUN_ON ? 3 : 1; const h = hash(k * 9.7 + 1); const t = h < 0.25 ? 0 : h < 0.5 ? 1 : h < 0.75 ? 2 : 3; return t === 3 && !TUN_ON ? 0 : t; };
// ---- tunnel: circular bore, floor chord = road; drive up the walls and onto the ceiling
const T0 = 250, T1 = 950, RT = 7.5, YC = 4.5, HALF = Math.sqrt(RT * RT - YC * YC), ALPHA = Math.asin(YC / RT);
const ARC = RT * (Math.PI + 2 * ALPHA), LOOP = 2 * HALF + ARC;
function tunnelAt(s) { const k = Math.floor(s / SEG), u = s - k * SEG; return segType(k) === 3 && u >= T0 && u <= T1; }
function tunnelBlend(s) { const k = Math.floor(s / SEG), u = s - k * SEG; if (segType(k) !== 3) return 0; return sstep(T0 - 70, T0 - 5, u) * (1 - sstep(T1 - 10, T1 + 45, u)); }
// q = offset from road centre along the bore surface -> {x lateral, y height, roll}
function boreMap(q, out) {
  q = ((q + LOOP / 2) % LOOP + LOOP) % LOOP - LOOP / 2;
  if (Math.abs(q) <= HALF) { out.x = DMID + q; out.y = 0; out.roll = 0; out.floor = true; return out; }
  const sg = Math.sign(q), a = Math.abs(q) - HALF, th = sg > 0 ? -ALPHA + a / RT : Math.PI + ALPHA - a / RT;
  out.x = DMID + RT * Math.cos(th); out.y = YC + RT * Math.sin(th); out.roll = (th + Math.PI / 2) * (sg > 0 ? 1 : 1); if (sg < 0) out.roll = th + Math.PI / 2 - 2 * Math.PI;
  out.roll *= sstep(0, 2.2, a); out.floor = false; return out;
}
function laneN(s) {
  const k = Math.floor(s / SEG), u = s - k * SEG, t = segType(k);
  if (t === 1) return 3 + sstep(80, 230, u) - sstep(880, 1080, u);
  if (t === 2) return u < EXIT_U ? 3 + sstep(250, 400, u) : 3;
  return 3;
}
function rampT(s) { const k = Math.floor(s / SEG), u = s - k * SEG; if (segType(k) !== 2 || u < 200) return -2; if (u < EXIT_U) return -1; if (u > EXIT_U + RAMP_LEN) return -2; return (u - EXIT_U) / RAMP_LEN; }
const rampL = t => 3 * W + 58 * Math.pow(t, 1.7);
const rampDrop = t => -9 * t * t;
const hasOverpass = k => k >= 1 && segType(k) !== 3 && hash(k * 3.3 + 7) > 0.3;
const GRAV = 15, JUMP_V = 12.4; // floaty steam-thruster hop: ~5.1 m peak, ~1.65 s airtime
const TIERS = [['Sloth', 2], ['Chill', 8], ['Standard', 15], ['Hurry', 23], ['Mad Max', 1e9]]; // offsets over the limit; Mad Max ~94+ at a 70 limit
const tierOf = (mph, lim) => { const o = mph - lim; for (const [n, t] of TIERS) if (o <= t + 0.5) return n; return 'Mad Max'; };
const MADMAX_MIN = 46, RS_MULT = 2;
const limitAt = s => { const k = Math.floor(s / SEG), u = s - k * SEG; return segType(k) === 2 && u > 300 ? 65 : 70; };
const NAMES = ['Lancaster Ave', 'Maple Ridge Rd', 'Harbor Blvd', 'Pinecrest Pkwy', 'Oakmont Dr', 'Cedar Hollow Rd', 'Riverside Ave', 'Summit Blvd', 'Willow Creek Rd', 'Granite St'];

// ================= renderer / scene =================
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const BG = 0x25272b;
const scene = new THREE.Scene();
scene.background = (() => { const c = document.createElement('canvas'); c.width = 4; c.height = 256; const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#121315'); g.addColorStop(0.55, '#24262a'); g.addColorStop(1, '#2c2e33'); x.fillStyle = g; x.fillRect(0, 0, 4, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
scene.fog = new THREE.Fog(BG, 190, 480);
const camera = new THREE.PerspectiveCamera(55, 1, 0.5, 700);
scene.add(new THREE.HemisphereLight(0xe8edf3, 0x2a2c30, 1.35));
// soft studio environment for subtle reflections on the ego car
{ const pm = new THREE.PMREMGenerator(renderer), es = new THREE.Scene();
  const sg = new THREE.SphereGeometry(50, 32, 16), cols = []; const pa = sg.attributes.position;
  for (let i = 0; i < pa.count; i++) { const y = pa.getY(i) / 50, v = y > 0 ? 0.18 + 0.5 * y : 0.06 + 0.06 * (1 + y); cols.push(v, v, v * 1.04); }
  sg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  es.add(new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  for (const [x, z, w] of [[0, 0, 40], [-25, 10, 14], [25, -8, 14]]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, 10), new THREE.MeshBasicMaterial({ color: 0xffffff })); p.position.set(x, 40, z); p.rotation.x = Math.PI / 2; es.add(p); }
  scene.environment = pm.fromScene(es, 0.02).texture; scene.environmentIntensity = 0.6; }
const camLight = new THREE.PointLight(0xffffff, 0, 60, 1.2); scene.add(camLight);
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
const matGround = new THREE.MeshStandardMaterial({ color: 0x33363b, roughness: 1 });
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
const matGlow = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
st.glow = new Strip(PROWS, matGlow, 0, true); st.glow.mesh.renderOrder = 1;
// ---- tunnel bore (grid over the same rows), portals and ceiling lights ----
const TC = 30, tPos = new Float32Array(ROWS * TC * 3), tGeo = new THREE.BufferGeometry();
{ const idx = []; for (let i = 0; i < ROWS - 1; i++) for (let k = 0; k < TC - 1; k++) { const a = i * TC + k, b = a + 1, c = a + TC, d = c + 1; idx.push(a, c, b, b, c, d); } tGeo.setIndex(idx); }
tGeo.setAttribute('position', new THREE.BufferAttribute(tPos, 3).setUsage(THREE.DynamicDrawUsage));
const tunnelMat = new THREE.MeshStandardMaterial({ color: 0x3a3c42, roughness: 0.9, side: THREE.DoubleSide });
const tunnelMesh = new THREE.Mesh(tGeo, tunnelMat); tunnelMesh.frustumCulled = false; tunnelMesh.receiveShadow = false; scene.add(tunnelMesh);
const tLights = new THREE.InstancedMesh(new THREE.TorusGeometry(RT - 0.08, 0.06, 4, 40, Math.PI + 2 * ALPHA), new THREE.MeshBasicMaterial({ color: 0xbfe0ff }), 40); tLights.frustumCulled = false; scene.add(tLights);
function mkPortal() { const sh = new THREE.Shape(); sh.moveTo(-26, -1); sh.lineTo(26, -1); sh.lineTo(26, 16); sh.lineTo(-26, 16); sh.closePath();
  const hole = new THREE.Path(); hole.moveTo(HALF, 0); hole.absarc(0, YC, RT, -ALPHA, Math.PI + ALPHA, false); hole.lineTo(HALF, 0); sh.holes.push(hole);
  const m = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 2, bevelEnabled: false }), matConcP); m.castShadow = true;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(RT + 0.25, 0.14, 6, 48, Math.PI + 2 * ALPHA), new THREE.MeshBasicMaterial({ color: 0x9fd0ff })); ring.rotation.z = -ALPHA; ring.position.set(0, YC, 2.05); m.add(ring);
  scene.add(m); return m; }
const matConcP = new THREE.MeshStandardMaterial({ color: 0x2c2e33, roughness: 1 });
const portals = [mkPortal(), mkPortal()];
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ'), _sc = new THREE.Vector3(1, 1, 1);
function updateTunnel() {
  let any = false, li = 0;
  for (let i = 0; i < ROWS; i++) {
    const s = R.s[i], inT = tunnelAt(s), bx = R.x[i], by = R.y[i], bz = R.z[i], nx = R.nx[i], nz = R.nz[i];
    for (let k = 0; k < TC; k++) { const j = (i * TC + k) * 3; let lx, ly;
      if (inT) { const th = -ALPHA + (k / (TC - 1)) * (Math.PI + 2 * ALPHA); lx = DMID + RT * Math.cos(th); ly = YC + RT * Math.sin(th); any = true; } else { lx = DMID + HALF; ly = 0; }
      tPos[j] = bx + lx * nx; tPos[j + 1] = by + ly; tPos[j + 2] = bz + lx * nz; }
    R.inT = R.inT || new Uint8Array(ROWS); R.inT[i] = inT ? 1 : 0;
    if (false) for (const th of [Math.PI / 2 - 0.42, Math.PI / 2 + 0.42]) { if (li >= 120) break;
      const lx = DMID + (RT - 0.05) * Math.cos(th), ly = YC + (RT - 0.05) * Math.sin(th); _v.set(bx + lx * nx, by + ly, bz + lx * nz);
      _e.set(0, -Math.atan(slopeX(s)), th - Math.PI / 2); _q.setFromEuler(_e); _m4.compose(_v, _q, _sc); tLights.setMatrixAt(li++, _m4); }
  }
  if (any) { let last = -1; for (let i = 0; i < ROWS; i++) if (R.inT[i]) { if (last < 0) for (let q = 0; q < i; q++) tPos.copyWithin(q * TC * 3, i * TC * 3, (i + 1) * TC * 3); last = i; } else if (last >= 0) tPos.copyWithin(i * TC * 3, last * TC * 3, (last + 1) * TC * 3); }
  tGeo.attributes.position.needsUpdate = true; if (any) tGeo.computeVertexNormals(); tunnelMesh.visible = any;
  { const s0 = Math.ceil((S - 15) / 14) * 14; for (let s = s0; s < S + 320 && li < 40; s += 14) { if (!tunnelAt(s) || !tunnelAt(s + 1)) continue;
      P(s, DMID, _v); _v.y = roadY(s) - OY + YC; _e.set(-Math.atan(slopeY(s)), -Math.atan(slopeX(s)), -ALPHA); _q.setFromEuler(_e); _m4.compose(_v, _q, _sc); tLights.setMatrixAt(li++, _m4); } }
  tLights.count = li; tLights.instanceMatrix.needsUpdate = true;
  const k0 = Math.floor((S - 60) / SEG); let j = 0;
  for (let k = k0; k <= k0 + 1; k++) if (segType(k) === 3) for (const u of [T0, T1]) { const s = k * SEG + u; if (s < S - 80 || s > S + 480 || j > 1) continue;
    const p = portals[j++]; P(s, DMID, p.position); p.position.y = roadY(s) - OY; p.rotation.set(0, -Math.atan(slopeX(s)), 0); p.translateZ(u === T0 ? 0 : -2); p.visible = true; }
  for (; j < 2; j++) portals[j].visible = false;
}
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
  st.path.mesh.visible = visible; st.glow.mesh.visible = visible; if (!visible) return;
  for (let i = 0; i < PROWS; i++) fillRow(RP, i, S + 2.4 + (i / (PROWS - 1)) * len);
  const col = st.path.col;
  for (let i = 0; i < PROWS; i++) {
    const u = i / (PROWS - 1), a = (1 - sstep(0.72, 1, u)) * 0.95;
    const c = PATH_C0.clone().lerp(PATH_C1, u * 0.6);
    for (let j = 0; j < 2; j++) { const k = i * 8 + j * 4; col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b; col[k + 3] = a; }
  }
  st.path.geo.attributes.color.needsUpdate = true;
  st.path.update(RP, (i, o) => { const u = (RP.s[i] - S) / 26; const d = lerp(egoD, tgtD, sstep(0, 1, u)); o[0] = d - 0.78; o[1] = d + 0.78; }, 0.045);
  const gc = st.glow.col; for (let i = 0; i < PROWS * 8; i += 4) { const a = col[i + 3] * 0.12; gc[i] = col[i] * a; gc[i + 1] = col[i + 1] * a; gc[i + 2] = col[i + 2] * a; gc[i + 3] = 1; }
  st.glow.geo.attributes.color.needsUpdate = true;
  st.glow.update(RP, (i, o) => { const u = (RP.s[i] - S) / 26; const d = lerp(egoD, tgtD, sstep(0, 1, u)); o[0] = d - 0.98; o[1] = d + 0.98; }, 0.04);
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

// ================= vehicles (lofted superellipse sections, smooth shaded) =================
// stations: [z, halfWidth, yBottom, yTop, exponent]; z: -front .. +rear
function loft(st, mat, N = 22) {
  const pos = [], idx = [], M = st.length;
  for (let i = 0; i < M; i++) {
    const [z, hw, y0, y1, n] = st[i], ym = (y0 + y1) / 2, hh = (y1 - y0) / 2, e = 2 / n;
    for (let k = 0; k < N; k++) { const t = k / N * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
      pos.push(hw * Math.sign(c) * Math.pow(Math.abs(c), e), ym + hh * Math.sign(s) * Math.pow(Math.abs(s), e), z); }
  }
  for (let i = 0; i < M - 1; i++) for (let k = 0; k < N; k++) { const a = i * N + k, b = i * N + (k + 1) % N, c = a + N, d = b + N; idx.push(a, b, c, b, d, c); }
  // caps
  const c0 = pos.length / 3; pos.push(0, (st[0][2] + st[0][3]) / 2, st[0][0]); const c1 = c0 + 1; const L = st[M - 1]; pos.push(0, (L[2] + L[3]) / 2, L[0]);
  for (let k = 0; k < N; k++) { idx.push(c0, (k + 1) % N, k); idx.push(c1, (M - 1) * N + k, (M - 1) * N + (k + 1) % N); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; return m;
}
const rbox = (z0, z1, hw, y0, y1, mat, n = 10) => loft([[z0, hw * 0.9, y0 + 0.04, y1 - 0.04, n], [z0 + 0.04, hw, y0, y1, n], [z1 - 0.04, hw, y0, y1, n], [z1, hw * 0.9, y0 + 0.04, y1 - 0.04, n]], mat, 24);
const tireMat = new THREE.MeshStandardMaterial({ color: 0x2b2c30, roughness: 0.85 });
const hubMat = new THREE.MeshStandardMaterial({ color: 0xe4e3e0, roughness: 0.8 });
const wheelGeos = {};
function wheels(g, zs, half, r, w = 0.26, hub = hubMat) {
  const key = r + '_' + w; const geo = wheelGeos[key] || (wheelGeos[key] = [new THREE.CylinderGeometry(r, r, w, 20), new THREE.CircleGeometry(r * 0.84, 24)]);
  for (const z of zs) for (const sd of [-1, 1]) {
    const m = new THREE.Mesh(geo[0], tireMat); m.rotation.z = Math.PI / 2; m.position.set(sd * (half - w / 2), r, z); g.add(m);
    const h = new THREE.Mesh(geo[1], hub); h.rotation.y = sd * Math.PI / 2; h.position.set(sd * (half + 0.003), r, z); g.add(h);
  }
}
const GREY = 0xdedddb, GLASS = 0x8f9196; // in-car FSD look (NATA refs): smooth off-white matte, glass a few shades darker
const lowerMat = new THREE.MeshStandardMaterial({ color: 0xa9aaad, roughness: 0.9 }), kTire = new THREE.MeshStandardMaterial({ color: 0x3a3b3f, roughness: 0.9 }), kHub = new THREE.MeshStandardMaterial({ color: 0xe6e5e2, roughness: 0.8 });
const blinkMat = new THREE.MeshBasicMaterial({ color: 0xffa51f });
const brakeMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
const smallBox = new THREE.BoxGeometry(1, 1, 1);
function lights(g, L, Wd, y, front = true) {
  g.userData.blink = [[], []]; g.userData.brake = [];
  for (const sd of [-1, 1]) {
    const arr = g.userData.blink[sd < 0 ? 0 : 1];
    const rear = new THREE.Mesh(smallBox, blinkMat); rear.scale.set(0.24, 0.14, 0.08); rear.position.set(sd * (Wd / 2 - 0.2), y, L / 2 + 0.02); g.add(rear); arr.push(rear);
    if (front) { const f = new THREE.Mesh(smallBox, blinkMat); f.scale.set(0.1, 0.12, 0.36); f.position.set(sd * (Wd / 2 + 0.01), y - 0.05, -L / 2 + 0.55); g.add(f); arr.push(f); }
    const b = new THREE.Mesh(smallBox, brakeMat); b.scale.set(0.4, 0.12, 0.06); b.position.set(sd * (Wd / 2 - 0.45), y + 0.03, L / 2 + 0.01); g.add(b); g.userData.brake.push(b);
  }
  for (const m of [...g.userData.blink[0], ...g.userData.blink[1], ...g.userData.brake]) m.visible = false;
}
// shared shape helpers
function carBody(L, hw, belt, hood, deck, roof, gStart, gPeak0, gPeak1, gEnd, b, gl, gw) {
  const h = L / 2, g = new THREE.Group();
  g.add(loft([[-h, hw * 0.62, 0.36, hood - 0.12, 2.6], [-h + 0.08, hw * 0.86, 0.3, hood - 0.04, 3.4], [-h + 0.45, hw * 0.97, 0.28, hood, 4.2], [-h + 1.3, hw, 0.28, belt * 0.98, 4.6], [0, hw, 0.28, belt, 4.6],
    [h - 1.0, hw, 0.28, belt * 1.01, 4.6], [h - 0.35, hw * 0.96, 0.3, deck, 4.2], [h - 0.06, hw * 0.84, 0.34, deck - 0.05, 3.4], [h, hw * 0.6, 0.4, deck - 0.14, 2.6]], b));
  const gb = belt - 0.06;
  g.add(loft([[gStart, gw * 0.9, gb, gb + 0.05, 2.4], [gStart + 0.18, gw * 0.95, gb, gb + 0.12, 2.8], [gPeak0, gw * 0.9, gb, roof, 3.2], [(gPeak0 + gPeak1) / 2, gw * 0.9, gb, roof + 0.02, 3.2], [gPeak1, gw * 0.88, gb, roof - 0.02, 3.2], [gEnd - 0.2, gw * 0.9, gb, gb + 0.16, 2.8], [gEnd, gw * 0.86, gb, gb + 0.05, 2.4]], gl));
  return g;
}
const TYPES = {
  sedan: { L: 4.8, Wd: 1.86, H: 1.44, v: [27, 35], build(b, gl) { const g = carBody(4.8, 0.93, 0.86, 0.74, 0.9, 1.42, -1.0, -0.15, 0.75, 1.85, b, gl, 0.78); wheels(g, [-1.45, 1.42], 0.93, 0.33); lights(g, 4.8, 1.86, 0.78); return g; } },
  suv: { L: 4.9, Wd: 1.96, H: 1.72, v: [26, 34], build(b, gl) { const g = carBody(4.9, 0.98, 1.04, 0.95, 1.06, 1.7, -1.05, -0.3, 1.55, 2.25, b, gl, 0.84); wheels(g, [-1.5, 1.5], 0.98, 0.38); lights(g, 4.9, 1.96, 1.0); return g; } },
  pickup: { L: 5.9, Wd: 2.0, H: 1.9, v: [26, 33], build(b, gl) { const h = 2.95, g = new THREE.Group();
    g.add(loft([[-h, 0.62, 0.42, 0.92, 2.8], [-h + 0.08, 0.88, 0.38, 1.02, 3.6], [-h + 0.5, 0.99, 0.36, 1.12, 5], [0, 1.0, 0.36, 1.18, 5], [h - 0.2, 1.0, 0.38, 1.2, 6], [h, 0.92, 0.42, 1.16, 4]], b));
    g.add(loft([[-0.95, 0.82, 1.08, 1.14, 2.6], [-0.7, 0.86, 1.08, 1.6, 3], [-0.35, 0.86, 1.08, 1.88, 3.4], [0.75, 0.86, 1.08, 1.88, 3.6], [0.92, 0.84, 1.08, 1.12, 3]], gl));
    const bed = rbox(1.1, 2.75, 0.82, 1.08, 1.215, new THREE.MeshStandardMaterial({ color: 0x8a8d92, roughness: 1 }), 8); bed.castShadow = false; g.add(bed);
    wheels(g, [-1.9, 1.85], 1.0, 0.42); lights(g, 5.9, 2.0, 1.02); return g; } },
  van: { L: 5.4, Wd: 2.02, H: 2.2, v: [25, 31], build(b, gl) { const h = 2.7, g = new THREE.Group();
    g.add(loft([[-h, 0.6, 0.42, 0.9, 2.6], [-h + 0.1, 0.88, 0.38, 1.0, 3.4], [-h + 0.55, 0.98, 0.36, 1.3, 4.5], [-h + 1.3, 1.01, 0.36, 2.1, 5.5], [0, 1.01, 0.36, 2.18, 6], [h - 0.2, 1.01, 0.38, 2.16, 6], [h, 0.94, 0.42, 2.08, 4.5]], b));
    g.add(loft([[-h + 0.62, 0.9, 1.25, 1.3, 3], [-h + 0.95, 0.99, 1.25, 1.85, 4], [-h + 1.6, 1.02, 1.25, 1.98, 5], [-h + 1.9, 1.0, 1.25, 1.5, 4]], gl));
    wheels(g, [-1.8, 1.75], 1.0, 0.37); lights(g, 5.4, 2.02, 1.05); return g; } },
  box: { L: 7.6, Wd: 2.45, H: 3.45, v: [23, 29], build(b, gl) { const h = 3.8, g = new THREE.Group();
    g.add(loft([[-h, 0.8, 0.5, 1.4, 3], [-h + 0.1, 1.1, 0.46, 1.9, 4], [-h + 0.4, 1.15, 0.44, 2.45, 5], [-h + 1.7, 1.15, 0.44, 2.55, 6], [-h + 1.85, 1.1, 0.46, 2.4, 5]], b));
    g.add(loft([[-h + 0.12, 1.0, 1.55, 1.6, 3], [-h + 0.3, 1.13, 1.55, 2.25, 4], [-h + 0.9, 1.16, 1.55, 2.4, 5], [-h + 1.1, 1.12, 1.55, 1.7, 4]], gl));
    g.add(rbox(-h + 1.95, h, 1.22, 0.72, 3.45, b, 12)); wheels(g, [-2.9, 2.6], 1.15, 0.46, 0.36); lights(g, 7.6, 2.45, 0.85, false); return g; } },
  semi: { L: 17.4, Wd: 2.58, H: 4.1, v: [23, 28], build(b, gl, tr) { const h = 8.7, g = new THREE.Group();
    g.add(loft([[-h, 0.9, 0.55, 1.6, 3], [-h + 0.12, 1.15, 0.5, 2.2, 4], [-h + 0.5, 1.22, 0.48, 2.95, 5], [-h + 1.3, 1.22, 0.48, 3.1, 6], [-h + 1.6, 1.2, 0.5, 3.55, 6], [-h + 3.0, 1.2, 0.5, 3.6, 7], [-h + 3.15, 1.15, 0.55, 3.4, 5]], b));
    g.add(loft([[-h + 0.22, 1.08, 1.85, 1.9, 3], [-h + 0.42, 1.2, 1.85, 2.7, 4], [-h + 1.05, 1.23, 1.85, 2.88, 5], [-h + 1.25, 1.2, 1.85, 2.0, 4]], gl));
    g.add(rbox(-h + 3.35, h, 1.29, 1.12, 4.1, tr, 14));
    const ch = new THREE.Mesh(smallBox, tireMat); ch.scale.set(1.6, 0.35, 12); ch.position.set(0, 0.85, 1.5); g.add(ch);
    for (let i = 1; i < 12; i++) { const rib = new THREE.Mesh(smallBox, gl); rib.scale.set(2.6, 2.6, 0.035); rib.position.set(0, 2.62, -h + 3.35 + i * 1.12); rib.material = tr; g.add(rib); }
    wheels(g, [-7.6, -4.9, -4.0, 6.3, 7.5], 1.25, 0.5, 0.46); lights(g, 17.4, 2.58, 1.25, false); return g; } },
  bus: { L: 12.2, Wd: 2.55, H: 3.2, v: [24, 29], build(b, gl) { const h = 6.1, g = new THREE.Group();
    g.add(loft([[-h, 1.05, 0.45, 2.9, 5], [-h + 0.12, 1.25, 0.4, 3.12, 7], [h - 0.12, 1.27, 0.4, 3.18, 8], [h, 1.08, 0.45, 2.95, 5]], b));
    g.add(loft([[-h + 0.02, 1.15, 1.55, 2.85, 6], [-h + 0.4, 1.29, 1.55, 2.85, 8], [h - 0.6, 1.29, 1.55, 2.85, 8], [h - 0.3, 1.2, 1.55, 2.8, 6]], gl));
    wheels(g, [-3.9, 3.6], 1.22, 0.5, 0.36); lights(g, 12.2, 2.55, 1.1, false); return g; } },
  moto: { L: 2.2, Wd: 0.8, H: 1.5, v: [28, 36], build(b, gl) { const g = new THREE.Group();
    g.add(loft([[-1.0, 0.1, 0.5, 0.7, 2.5], [-0.7, 0.2, 0.42, 0.95, 3], [0.2, 0.22, 0.45, 0.95, 3], [0.9, 0.12, 0.55, 0.85, 2.5]], b));
    g.add(loft([[-0.1, 0.12, 0.95, 1.05, 2.4], [0.0, 0.2, 0.95, 1.45, 2.6], [0.25, 0.19, 0.95, 1.5, 2.6], [0.4, 0.12, 0.95, 1.1, 2.4]], b));
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), gl); head.position.set(0, 1.62, 0.05); head.castShadow = true; g.add(head);
    for (const z of [-0.75, 0.75]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.14, 18), tireMat); w.rotation.z = Math.PI / 2; w.position.set(0, 0.32, z); g.add(w); }
    lights(g, 2.2, 0.5, 0.8, false); return g; } },
};
// ---- Kenney Car Kit (CC0) bases, baked to models/traffic.json (per-face class: 0 body, 1 glass, 2 tire/dark, 3 hub, 4 tail, 5 head, 6 lower) and restyled ----
const KM = await fetch('models/traffic.json?v=2.4.0').then(r => r.json()).catch(() => ({}));
const KMAP = { sedan: 'sedan', suv: 'suv', pickup: 'truck', van: 'van', box: 'delivery' }, kGeo = {};
function kenneyGeo(name, T) {
  if (kGeo[name + T.L]) return kGeo[name + T.L];
  const M = KM[name], n = M.c.length, sx = T.Wd / (M.max[0] - M.min[0]), sy = T.H / M.max[1], sz = T.L / (M.max[2] - M.min[2]), cz = (M.max[2] + M.min[2]) / 2;
  const groups = [[], [], [], [], [], [], []];
  for (let f = 0; f < n; f++) groups[M.c[f]].push(f);
  const out = groups.map(fs => { if (!fs.length) return null; const pos = new Float32Array(fs.length * 9), nor = new Float32Array(fs.length * 9);
    fs.forEach((f, j) => { for (let k = 0; k < 9; k++) { const q = f * 9 + k, ax = k % 3; pos[j * 9 + k] = M.p[q] / 1000 * (ax === 0 ? sx : ax === 1 ? sy : sz) - (ax === 2 ? cz * sz : 0); nor[j * 9 + k] = M.n[q] / 100 / (ax === 0 ? sx : ax === 1 ? sy : sz); } });
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.normalizeNormals(); if (KFLIP) geo.rotateY(Math.PI); return geo; });
  return (kGeo[name + T.L] = out);
}
const KFLIP = true; // Kenney models face +z; our vehicles face -z
function kenney(type, bm, gm) {
  const T = TYPES[type], g = new THREE.Group(), geos = kenneyGeo(KMAP[type], T), mats = [bm, gm, kTire, kHub, tailMat0, headMat0, lowerMat];
  geos.forEach((geo, i) => { if (!geo) return; const m = new THREE.Mesh(geo, mats[i]); m.castShadow = i !== 3; m.receiveShadow = true; g.add(m); });
  lights(g, T.L, T.Wd, T.H * 0.45, type !== 'box'); return g;
}
const tailMat0 = new THREE.MeshStandardMaterial({ color: 0x8a3a3a, roughness: 0.6 }), headMat0 = new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.5 });
const TYPE_W = [['sedan', 0.29], ['suv', 0.23], ['pickup', 0.13], ['van', 0.08], ['box', 0.09], ['semi', 0.11], ['bus', 0.03], ['moto', 0.04]];
const pools = {}; for (const k in TYPES) pools[k] = [];
function getVehicle(type) {
  const p = pools[type]; if (p.length) { const m = p.pop(); m.visible = true; return m; }
  const T = TYPES[type];
  const bm = new THREE.MeshStandardMaterial({ color: GREY, roughness: 0.78, envMapIntensity: 0.55 });
  const tm = new THREE.MeshStandardMaterial({ color: 0xc4c7cb, roughness: 0.85, envMapIntensity: 0.5 });
  const gm = new THREE.MeshStandardMaterial({ color: GLASS, roughness: 0.5, envMapIntensity: 0.6 });
  const g = KM[KMAP[type]] ? kenney(type, bm, gm) : T.build(bm, gm, tm);  g.userData.bodyMat = bm; g.userData.type = type; g.rotation.order = 'YXZ'; scene.add(g); return g;
}
function freeVehicle(m) { m.visible = false; pools[m.userData.type].push(m); }

// ---- ego: Model 3/Y-style (white, black glass roof) + Roadster ----
const egoGroup = new THREE.Group(); egoGroup.rotation.order = 'YXZ'; scene.add(egoGroup);
const egoPaint = new THREE.MeshPhysicalMaterial({ color: 0xf4f5f6, metalness: 0, roughness: 0.28, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 1.1 });
const blackGlass = new THREE.MeshPhysicalMaterial({ color: 0x050608, roughness: 0.06, metalness: 0.2, clearcoat: 1, envMapIntensity: 1.6 });
const tailMat = new THREE.MeshBasicMaterial({ color: 0xff1e1e });
const darkTrim = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.5 });
const EGO = { // carBody(L, hw, belt, hood, deck, roof, gStart, gPeak0, gPeak1, gEnd), wheel r
  m3: [[4.72, 0.93, 0.84, 0.7, 0.9, 1.42, -1.15, -0.2, 0.55, 2.05], 0.34], my: [[4.75, 0.96, 0.96, 0.84, 1.04, 1.62, -1.1, -0.3, 1.05, 2.18], 0.37],
  ms: [[4.98, 0.98, 0.82, 0.68, 0.9, 1.42, -1.25, -0.2, 0.8, 2.3], 0.35], mx: [[5.05, 1.0, 0.99, 0.86, 1.08, 1.68, -1.3, -0.45, 1.35, 2.38], 0.39] };
const steelMat = new THREE.MeshPhysicalMaterial({ color: 0xb9bcbf, roughness: 0.38, metalness: 0.85, envMapIntensity: 1.3, flatShading: true });
function buildEgo(kind, paint, glass) {
  const g = new THREE.Group();
  if (kind === 'ct') { // angular wedge pickup
    const ext = (pts, w, mat) => { const sh = new THREE.Shape(); sh.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) sh.lineTo(p[0], p[1]); sh.closePath();
      const geo = new THREE.ExtrudeGeometry(sh, { depth: w, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 1 }); const m = new THREE.Mesh(geo, mat); m.rotation.y = -Math.PI / 2; m.position.x = w / 2; return m; };
    g.add(ext([[-2.85, 0.42], [-2.85, 0.98], [-0.35, 1.92], [2.85, 1.22], [2.85, 0.42]], 2.0, paint));
    g.add(ext([[-1.95, 1.33], [-0.35, 1.93], [0.95, 1.67], [0.95, 1.33]], 2.04, glass));
    const bar = new THREE.Mesh(smallBox, tailMat); bar.scale.set(1.9, 0.05, 0.04); bar.position.set(0, 1.16, 2.9); g.add(bar);
    const fb = new THREE.Mesh(smallBox, new THREE.MeshBasicMaterial({ color: 0xffffff })); fb.scale.set(1.9, 0.04, 0.04); fb.position.set(0, 0.97, -2.9); g.add(fb);
    wheels(g, [-1.85, 1.85], 1.02, 0.42, 0.3, darkTrim);
  } else {
    const [p, r] = EGO[kind] || EGO.m3, L = p[0], h = L / 2, hw = p[1];
    g.add(carBody(...p, paint, glass, hw - 0.13)); wheels(g, [-h + 0.92, h - 0.93], hw - 0.01, r, 0.24, darkTrim);
    const ty = p[2] - 0.04;
    for (const sd of [-1, 1]) {
      const t = new THREE.Mesh(smallBox, tailMat); t.scale.set(0.5, 0.07, 0.05); t.position.set(sd * hw * 0.6, ty, h - 0.0); t.rotation.y = sd * 0.12; g.add(t);
      const t2 = new THREE.Mesh(smallBox, tailMat); t2.scale.set(0.05, 0.07, 0.32); t2.position.set(sd * (hw - 0.05), ty, h - 0.18); g.add(t2);
      const mr = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), paint); mr.scale.set(1.1, 0.7, 0.8); mr.position.set(sd * (hw + 0.07), p[2] + 0.08, p[6] + 0.2); g.add(mr);
    }
    const diff = new THREE.Mesh(smallBox, darkTrim); diff.scale.set(1.3, 0.14, 0.05); diff.position.set(0, 0.42, h - 0.01); g.add(diff);
  }
  g.traverse(m => { if (m.isMesh) m.castShadow = true; }); return g;
}
const model3 = new THREE.Group(); let tailBits = [];
function setEgoModel(kind, hex) {
  while (model3.children.length) model3.remove(model3.children[0]);
  const ct = kind === 'ct', mat = ct ? steelMat : egoPaint; mat.color.set(hex);
  if (ct) { const sat = hex.toLowerCase() !== '#b9bcbf'; steelMat.metalness = sat ? 0.1 : 0.85; steelMat.roughness = sat ? 0.6 : 0.38; }
  model3.add(buildEgo(kind, mat, blackGlass)); tailBits = []; model3.traverse(m => { if (m.material === tailMat) tailBits.push(m); });
}
setEgoModel('m3', '#f4f5f6');
const roadsterPaint = new THREE.MeshPhysicalMaterial({ color: 0xd0101c, roughness: 0.25, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 1.2 });
const roadster = new THREE.Group();
roadster.add(loft([[-2.2, 0.5, 0.32, 0.44, 2.4], [-2.1, 0.82, 0.26, 0.5, 3.2], [-1.6, 0.95, 0.24, 0.57, 4], [-0.6, 0.98, 0.24, 0.66, 4.4], [0.3, 0.99, 0.24, 0.74, 4.4], [1.2, 0.99, 0.26, 0.8, 4.4], [1.85, 0.94, 0.3, 0.78, 4], [2.12, 0.8, 0.36, 0.7, 3], [2.2, 0.55, 0.42, 0.62, 2.4]], roadsterPaint));
roadster.add(loft([[-0.35, 0.5, 0.66, 0.7, 2.4], [-0.15, 0.6, 0.66, 0.84, 2.8], [0.25, 0.62, 0.66, 1.0, 3], [0.75, 0.6, 0.68, 1.02, 3], [1.15, 0.52, 0.7, 0.84, 2.8], [1.35, 0.42, 0.72, 0.76, 2.4]], blackGlass));
wheels(roadster, [-1.4, 1.38], 0.98, 0.35, 0.28, darkTrim);
const rtail = new THREE.Mesh(smallBox, tailMat); rtail.scale.set(1.6, 0.05, 0.04); rtail.position.set(0, 0.68, 2.19); roadster.add(rtail);
const nozzleMat = new THREE.MeshBasicMaterial({ color: 0x8fd0ff });
for (const sd of [-1, 1]) { const n = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.16, 12), nozzleMat); n.rotation.x = Math.PI / 2; n.position.set(sd * 0.42, 0.46, 2.2); roadster.add(n); }
for (const g of [model3, roadster]) { g.traverse(m => { if (m.isMesh) m.castShadow = true; }); egoGroup.add(g); }
{ // FSD v14-style blue underglow beneath the ego car
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d');
  const gr = x.createRadialGradient(64, 64, 8, 64, 64, 64); gr.addColorStop(0, 'rgba(70,150,255,0.9)'); gr.addColorStop(0.55, 'rgba(40,120,255,0.35)'); gr.addColorStop(1, 'rgba(40,120,255,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
  const ug = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 6.2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  ug.rotation.x = -Math.PI / 2; ug.position.y = 0.03; ug.renderOrder = 2; egoGroup.add(ug);
}
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
  ctx: null, muted: !SET.sound,
  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC(); this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : SET.volume; this.master.connect(c.destination);
    const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; this.noise = buf;
    this.hg = c.createGain(); this.hg.gain.value = 0; this.hf = c.createBiquadFilter(); this.hf.type = 'lowpass'; this.hf.frequency.value = 600; this.hf.Q.value = 3;
    this.o1 = c.createOscillator(); this.o1.type = 'sawtooth'; this.o2 = c.createOscillator(); this.o2.type = 'sine'; this.o3 = c.createOscillator(); this.o3.type = 'triangle';
    const g3 = c.createGain(); g3.gain.value = 0.35;
    this.o1.connect(this.hf); this.o2.connect(this.hf); this.o3.connect(g3); g3.connect(this.hf); this.hf.connect(this.hg); this.hg.connect(this.master);
    for (const o of [this.o1, this.o2, this.o3]) o.start();
  },
  setMute(m) { this.muted = m; if (SET.sound === m) { SET.sound = !m; localStorage.setItem('fsdmm_settings', JSON.stringify(SET)); } if (this.master) this.master.gain.setTargetAtTime(m ? 0 : SET.volume, this.ctx.currentTime, 0.05); },
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
  crashT: 0, spin: 0, spinV: 0, shake: 0, nextPickup: 600, pickupOn: false, pkS: 0, pkD: 0, camD: laneC(1), auto: AUTO, tgtMph: 70, minRatio: 9, rearHits: 0, simT: 0, tf: 0, bore: { x: 0, y: 0, roll: 0, floor: true },
};
let cars = [];
let best = +localStorage.getItem('fsdmm_best') || 0;
$('best0').textContent = best.toLocaleString();
{ const r = document.createElement('div'); r.id = 'rev'; r.textContent = REV; document.body.appendChild(r); }
const egoDims = () => roadster.visible ? { L: 4.1, Wd: 2.02 } : { L: 4.7, Wd: 1.88 };

function reset() {
  for (const c of cars) freeVehicle(c.mesh); cars = [];
  Object.assign(G, { cutIns: 0, hardBrake: false, brakeVis: 0, roofLands: 0, vy: 0, onRoof: null, boost: 0, pitch: 0, passPts: 0, wall: 0, tgtMph: limitAt(S), minRatio: 9, rearHits: 0, t: 0, v: limitAt(S) * MPH, mph: 70, topMph: 70, dist: 0, passed: 0, near: 0, jumps: 0, score: 0, egoD: laneC(1), tgtD: laneC(1), egoVd: 0, yaw: 0, jumpT: -1, jumpH: 0, rsT: 0, charges: 0, cool: 0, crashT: 0, spin: 0, spinV: 0, shake: 0, pickupOn: false, camD: laneC(1) });
  G.nextPickup = S + 500; setRoadster(false);
  for (let i = 0; i < 9; i++) spawnCar(S + 60 + i * 42 + rnd(0, 20));
}
function setRoadster(on) { roadster.visible = on; model3.visible = !on; $('rs').classList.toggle('hidden', !on); }

function spawnCar(sPos, avoidEgo = false) {
  const n = Math.floor(laneN(sPos) + 0.02); const lane = Math.floor(Math.random() * n);
  const occ = new Set();
  for (const c of cars) { if (Math.abs(c.s - sPos) < 34 * spaceF() + c.L / 2) { occ.add(c.lane); if (c.lc) occ.add(c.lc.to); if (c.lane === lane) return false; } }
  if (!occ.has(lane) && occ.size >= n - 1) return false;
  if (avoidEgo && Math.abs(laneC(lane) - G.egoD) < 3.2) return false;
  let r = Math.random(), type = 'sedan'; for (const [k, w] of TYPE_W) { if ((r -= w) < 0) { type = k; break; } }
  const T = TYPES[type], m = getVehicle(type);
  m.userData.bodyMat.color.setHex(GREY);
  const k = Math.floor(sPos / SEG), u = sPos - k * SEG;
  const over = type === 'semi' || type === 'box' || type === 'bus' ? rnd(0, 4) : rnd(0, 8);
  const c = { type, mesh: m, s: sPos, lane, d: laneC(lane), L: T.L, Wd: T.Wd, H: T.H, over, v0: (limitAt(sPos) + over) * MPH, v: 0, lc: null, lcTimer: rnd(1, 6), passed: false, exiting: segType(k) === 2 && lane === 3 && u < EXIT_U, braking: false, yaw: 0, jumped: false };
  c.v = c.v0; cars.push(c); return true;
}
const laneFree = (lane, s, me, gap) => !cars.some(o => o !== me && (o.lane === lane || (o.lc && o.lc.to === lane)) && Math.abs(o.s - s) < gap + (o.L + me.L) / 2);


function updateTraffic(dt) {
  const EXF = G.state === 'play' ? exagF() : 1;
  if (G.state === 'attract') { for (const c of cars) freeVehicle(c.mesh); cars = []; return; }
  const target = Math.round(lerp(15, 22, clamp(G.dist / 12000, 0, 1)) * DENS[SET.density] / spaceF());
  if (cars.length < target) { if (G.v < 33.5 && Math.random() < 0.35) spawnCar(S - rnd(70, 110), true); else spawnCar(S + rnd(330, 420)); }
  const blinkOn = (performance.now() % 700) < 380;
  const egoOnFloor = G.bore.floor && G.jumpH < 0.6;
  for (const c of cars) {
    const lim = limitAt(c.s) * MPH; c.v0 = lim + c.over * MPH;
    // follow leader (other cars, and the player when directly ahead)
    let lead = null, gap = 1e9, leadV = 0, leadL = 0;
    for (const o of cars) { if (o === c) continue; const dl = o.s - c.s; if (dl > 0 && dl < gap && (o.lane === c.lane || (o.lc && o.lc.to === c.lane) || Math.abs(o.d - c.d) < 2.2)) { gap = dl; lead = o; leadV = o.v; leadL = o.L; } }
    const de = S - c.s; let egoLead = false;
    if (egoOnFloor && de > 0 && de < gap && Math.abs(G.egoD - c.d) < 2.6) { gap = de; leadV = G.v; leadL = egoDims().L; egoLead = true; }
    let vt = c.v0; const clear = gap - (c.L + leadL) / 2;
    if (gap < 1e8 && clear < (egoLead ? 30 : 22)) vt = Math.min(vt, leadV - (clear < 10 ? 3 : 0));
    if (!egoLead) vt = Math.max(vt, lim); // never below the limit unless the player is in front
    else if (clear < 6) vt = Math.min(vt, G.v - 2);
    c.braking = vt < c.v - 0.5; c.v += clamp(vt - c.v, (egoLead ? -14 : -7) * dt, 3 * dt); c.s += c.v * dt - Math.max(0, G.v - c.v) * (EXF - 1) * dt;
    if (egoLead && c.lcTimer > 1.2) c.lcTimer = 1.2; // try to get around the player
    // lane changes
    const nF = Math.floor(laneN(c.s + 90) + 0.02);
    const egoNear = to => egoOnFloor && Math.abs(G.egoD - laneC(to)) < 3.0 && c.s - S < 14 && c.s - S > -16;
    if (!c.lc && !c.exiting && !tunnelAt(c.s + 40)) {
      c.lcTimer -= dt;
      const forced = c.lane >= nF;
      if (forced || (c.lcTimer < 0 && (clear < 30 || Math.random() < 0.3))) {
        c.lcTimer = rnd(3, 9);
        const dirs = forced ? [-1] : (Math.random() < 0.5 ? [-1, 1] : [1, -1]);
        for (const dd of dirs) { const to = c.lane + dd; if (to < 0 || to >= Math.min(nF, Math.floor(laneN(c.s) + 0.02))) continue; if (!laneFree(to, c.s, c, 10)) continue;
          if (egoNear(to)) continue;
          c.lc = { from: c.lane, to, t: 0, blink: forced ? 1.0 : 1.2 }; break; }
      }
    }
    // occasional signalled cut-in in front of the player (18-40 m ahead, adjacent lane)
    if (G.state === 'play' && !c.lc && !c.exiting && egoOnFloor && !tunnelAt(c.s) && c.s - S > 22 && c.s - S < 60 && c.v < G.v && (c.s - S - c.L) / Math.max(0.1, (G.v - c.v) * exagF()) > 3.2) {
      const egoLane = clamp(Math.round(G.egoD / W - 0.5), 0, Math.floor(laneN(S) + 0.02) - 1);
      if (Math.abs(c.lane - egoLane) === 1 && Math.abs(G.egoD - laneC(egoLane)) < 1.2 && Math.random() < CUT[SET.difficulty] * dt && laneFree(egoLane, c.s, c, 10)) { c.lc = { from: c.lane, to: egoLane, t: 0, blink: 1.6, cut: true }; G.cutIns++; }
    }
    if (c.lc && c.lc.cut && c.lc.t < c.lc.blink && (c.s - S - c.L) / Math.max(0.1, (G.v - c.v) * exagF()) < 2.5) c.lc = null; // player closing in: abort
    if (c.lc && !c.lc.cut && c.lc.t < c.lc.blink && egoNear(c.lc.to)) { c.lc.hold = (c.lc.hold || 0) + dt; c.lc.t = Math.min(c.lc.t, c.lc.blink - 0.05); if (c.lc.hold > 3) { c.lc = null; } }
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
    let gap = 300; for (const c of cars) { const dd = c.s - S; if (dd > -9 && Math.abs(c.d - laneC(l)) < 2.6) gap = Math.min(gap, dd); }
    const sc = gap - Math.abs(l - cur) * 14 - (G.pickupOn && Math.abs(G.pkD - laneC(l)) < 1 ? -60 : 0);
    if (sc > bestScore) { bestScore = sc; bestL = l; }
  }
  if (Math.abs(bestL - cur) > 1) bestL = cur + Math.sign(bestL - cur);
  G.tgtD = laneC(bestL);
  G.tgtMph = limitAt(S) + 35 + 25 * Math.sin(G.t / 9);
  if (roadster.visible && G.charges > 0 && G.cool <= 0 && G.jumpT < 0) { for (const c of cars) { const dd = c.s - S; if (dd > 6 && dd < 16 && Math.abs(c.d - G.egoD) < 2) { fire(); break; } } }
}

function popup(txt, c) {
  P(S, G.bore.x, _v); _v.y += 1.6 + G.bore.y; _v.project(camera); const el = document.createElement('div'); el.className = 'pop'; el.textContent = txt;
  el.style.left = ((_v.x + 1) / 2 * innerWidth) + 'px'; el.style.top = ((1 - _v.y) / 2 * innerHeight) + 'px'; $('hud').appendChild(el); setTimeout(() => el.remove(), 900);
}
function toast(html, ms = 1100) { const el = $('toast'); el.innerHTML = html; el.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), ms); }
function fire() {
  if (G.state !== 'play' || tunnelAt(S) || !roadster.visible || G.jumpT >= 0 || G.cool > 0 || G.charges <= 0) return false;
  G.charges--; G.jumpT = 0; G.vy = JUMP_V; G.onRoof = null; G.lastRoof = null; G.cool = 0.6; G.shake = 0.5; sfx.thrust(); renderCharges();
  for (let i = 0; i < 70; i++) { const under = i % 2; emit(S + (under ? rnd(-1.6, 1.6) : -2.2 - rnd(0, 0.6)), G.egoD + rnd(-0.9, 0.9), under ? 0.4 : 0.6, G.v * rnd(0.55, 0.85), rnd(-3, 3), under ? rnd(-2, 2) : rnd(0, 2), rnd(1.0, 1.9), rnd(0.8, 1.6), rnd(4, 8), 0.7); }
  return true;
}
function renderCharges() { $('charges').innerHTML = [0, 1, 2].map(i => `<i class="${i < G.charges ? '' : 'off'}"></i>`).join(''); }
function crash(other) { G.crashCut = (G.crashCut || 0) + (other && other.lc && other.lc.cut ? 1 : 0); G.crashN = (G.crashN || 0) + 1;
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
  try { window.BurritoPlay && window.BurritoPlay('fsd'); } catch (e) {}
  sfx.init(); reset(); G.state = 'play'; $('start').classList.add('hidden'); $('over').classList.add('hidden'); $('banner').classList.add('hidden'); $('hud').classList.remove('hidden'); $('flash').style.opacity = 0;
  toast('Self-Driving engaged<small>Finger height sets speed · slide down to brake</small>', 1800); sfx.chime();
}
$('again').addEventListener('click', () => toPark());
const muteUI = () => { $('waves').style.display = sfx.muted ? 'none' : ''; $('xx').style.display = sfx.muted ? '' : 'none'; };
$('mute').addEventListener('pointerdown', e => { e.stopPropagation(); sfx.setMute(!sfx.muted); muteUI(); }); muteUI();

// ================= input =================
const ptr = { id: null, x0: 0, y0: 0, d0: 0, m0: 70, t0: 0, moved: 0, lastTap: 0, lx: 0, ly: 0 };
const MAX_MPH = 100, RS_MAX = 100, RS_FLOOR = 0, DEAD = 8; // Roadster limit+20..150 range deferred to rev 1.5
const spdLo = () => limitAt(S) + (roadster.visible ? RS_FLOOR : 0), spdHi = () => roadster.visible ? RS_MAX : MAX_MPH;
const mphPerPx = () => (spdHi() - spdLo()) / clamp(innerHeight * 0.3, 150, 340); // a drag of ~30% screen height spans bottom (limit) -> top (max)
const steerLo = () => tunnelAt(S) ? -1e9 : 1.05, steerHi = () => tunnelAt(S) ? 1e9 : maxD(S + 20);
const pxPerLane = () => clamp(innerWidth * 0.21, 70, 170);
const maxD = s => W * laneN(s) - 1.05;
canvas.addEventListener('pointerdown', e => {
  sfx.ctx && sfx.ctx.resume(); ptr.id = e.pointerId; ptr.x0 = e.clientX; ptr.y0 = e.clientY; ptr.d0 = G.tgtD; ptr.m0 = Math.max(G.tgtMph, G.v / MPH); ptr.t0 = performance.now(); ptr.moved = 0;
  try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
});
canvas.addEventListener('pointermove', e => {
  if (e.pointerId !== ptr.id) return; ptr.moved = Math.max(ptr.moved, Math.hypot(e.clientX - ptr.x0, e.clientY - ptr.y0));
  if (G.state !== 'play' || G.auto) return;
  G.tgtD = clamp(ptr.d0 + (e.clientX - ptr.x0) / pxPerLane() * W, steerLo(), steerHi());
  // vertical = throttle (virtual joystick from touch-down point, persistent after lift)
  const dy = ptr.y0 - e.clientY, eff = Math.sign(dy) * Math.max(0, Math.abs(dy) - DEAD);
  if (eff !== 0) G.tgtMph = clamp(ptr.m0 + eff * mphPerPx(), spdLo(), spdHi());
  ptr.thr = true; showGauge();
});
canvas.addEventListener('pointerup', e => {
  if (e.pointerId !== ptr.id) return; ptr.id = null; hideGauge(); const now = performance.now();
  if (ptr.moved < 14 && now - ptr.t0 < 260) {
    if (now - ptr.lastTap < 340 && Math.hypot(e.clientX - ptr.lx, e.clientY - ptr.ly) < 70) { fire(); ptr.lastTap = 0; }
    else { ptr.lastTap = now; ptr.lx = e.clientX; ptr.ly = e.clientY; }
  }
});
canvas.addEventListener('pointercancel', () => { ptr.id = null; hideGauge(); });
function showGauge() { const g = $('gauge'); g.classList.add('on'); clearTimeout(showGauge.t); }
function hideGauge() { showGauge.t = setTimeout(() => $('gauge').classList.remove('on'), 700); }
canvas.addEventListener('dblclick', e => e.preventDefault());
const keys = {};
addEventListener('keydown', e => { keys[e.key] = true; if (e.key.startsWith('Arrow')) e.preventDefault(); if (e.key === ' ') { e.preventDefault(); if (G.state === 'play') fire(); else if (G.state !== 'crash' && e.key === ' ') start(); } if (e.key === 'm') { sfx.setMute(!sfx.muted); muteUI(); } });
addEventListener('keyup', e => { keys[e.key] = false; });
document.addEventListener('visibilitychange', () => { if (document.hidden && sfx.ctx) sfx.ctx.suspend(); else if (sfx.ctx) sfx.ctx.resume(); });

// ================= layout =================
const L = { fov: 60, back: 12, up: 8, ahead: 26, lookUp: 0 };
function resize() {
  const w = innerWidth, h = innerHeight, a = w / h;
  document.documentElement.classList.toggle('land', a > 1.05);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, pr, QPR[SET.quality])); renderer.setSize(w, h, false);
  const t = clamp((a - 0.46) / (1.6 - 0.46), 0, 1);
  const far = SET.camera === 'far' ? 1.25 : 1; L.fov = lerp(46, 34, t); L.back = lerp(22, 20, t) * far; L.up = lerp(11, 9, t) * far; L.ahead = lerp(12.7, 11, t);
  camera.aspect = a; camera.fov = L.fov; camera.updateProjectionMatrix();
}
let pr = 2;
addEventListener('resize', resize); resize();

// ================= main loop =================
let parkA = -2.4, paused = false, fpsShow = 0, fpsCnt = 0;
let last = performance.now(), hudT = 0, fpsAcc = 0, fpsN = 0;
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(); let camInit = false;
function step(dt) {
  if (paused) return;
  const playing = G.state === 'play';
  if (G.auto && playing) autoSteer();
  // speed
  const lim = limitAt(S);
  let holding = true;
  if (playing) { G.t += dt; if (!G.auto) { const k = (keys.ArrowUp || keys.w ? 1 : 0) - (keys.ArrowDown || keys.s ? 1 : 0); holding = ptr.id !== null || k > 0; if (!holding) G.tgtMph = spdLo(); G.tgtMph += k * 70 * dt; if (k) { showGauge(); hideGauge(); } } }
  else if (G.state === 'attract') G.tgtMph = lim + 4;
  if (G.state === 'attract') G.tgtMph = lim + 4; else G.tgtMph = clamp(G.tgtMph, spdLo(), spdHi()); G.mph = G.tgtMph;
  if (G.state === 'crash' || G.state === 'over') G.v *= Math.exp(-dt * 2.2);
  else { const cur = G.v / MPH, d = G.mph - cur; G.hardBrake = holding && d < -3;
    G.v = clamp(cur + clamp(d, (G.hardBrake ? -20 : -6) * dt, (roadster.visible ? 40 : 30) * dt), playing && G.t < 3 ? 0 : lim, 999) * MPH; }
  if (G.state === 'attract') G.v = 0;
  G.brakeVis = lerp(G.brakeVis || 0, G.hardBrake && playing ? 1 : 0, 1 - Math.exp(-dt * 14));
  if (playing) G.minRatio = Math.min(G.minRatio, G.v / MPH / lim + 1e-6);
  G.topMph = Math.max(G.topMph, G.v / MPH);
  S += G.v * dt; if (playing) G.dist += G.v * dt;
  OX = roadX(S); OY = roadY(S);
  // steering
  if (playing && !G.auto) { const k = (keys.ArrowLeft || keys.a ? -1 : 0) + (keys.ArrowRight || keys.d ? 1 : 0); if (k) G.tgtD += k * 11 * dt; }
  const inTun = tunnelAt(S), md = inTun ? 1e9 : maxD(S);
  if (inTun) { // wrap around the bore, keep egoD/tgtD together
    const q = G.egoD - DMID; if (q > LOOP / 2) { G.egoD -= LOOP; G.tgtD -= LOOP; } else if (q < -LOOP / 2) { G.egoD += LOOP; G.tgtD += LOOP; }
    const k = Math.floor(S / SEG), u = S - k * SEG; if (u > T1 - 90) { const tq = G.tgtD - DMID; if (Math.abs(tq) > HALF - 1.2) G.tgtD = DMID + Math.sign(tq) * (HALF - 1.6); }
  } else G.tgtD = clamp(G.tgtD, 1.05, Math.max(1.05, maxD(S + 20)));
  if (!inTun && Math.abs(G.egoD - DMID) > HALF) G.egoD = DMID + clamp(G.egoD - DMID, -HALF, HALF);
  if (G.state === 'play' || G.state === 'attract') {
    const prev = G.egoD; G.egoD += (G.tgtD - G.egoD) * (1 - Math.exp(-dt * 9)); if (G.egoD > md) G.egoD = lerp(G.egoD, md, 1 - Math.exp(-dt * 10));
    G.egoVd = (G.egoD - prev) / Math.max(dt, 1e-4);
  } else G.egoVd *= 0.9;
  // jump
  if (G.jumpT >= 0) { // ballistic steam jump; vehicle roofs are landable surfaces
    G.jumpT += dt; const prevH = G.jumpH; G.vy -= GRAV * dt; G.jumpH += G.vy * dt;
    let support = 0, roofCar = null; const ed0 = egoDims();
    for (const c of cars) { if (c.exiting) continue; if (Math.abs(c.s - S) < (c.L + ed0.L) / 2 * 0.9 && Math.abs(c.d - G.egoD) < (c.Wd + ed0.Wd) / 2 * 0.8 && prevH >= c.H - 0.35 && c.H > support) { support = c.H; roofCar = c; } }
    if (G.jumpH <= support) {
      if (support > 0) { if (G.onRoof !== roofCar) { G.onRoof = roofCar; G.roofLands++; G.shake = 0.3; sfx.ping(); toast('ROOF LANDING +200', 800); for (let i = 0; i < 12; i++) emit(S + rnd(-1.5, 1.5), G.egoD + rnd(-1, 1), support + 0.3, G.v * 0.85, rnd(-3, 3), 0.5, 0.7, 0.7, 3, 0.5); }
        G.jumpH = support; G.vy = 0; }
      else { G.jumpT = -1; G.jumpH = 0; G.vy = 0; G.onRoof = null; G.shake = 0.35; for (let i = 0; i < 14; i++) emit(S + rnd(-1.5, 1.5), G.egoD + rnd(-1, 1), 0.4, G.v * 0.8, rnd(-4, 4), 0.5, 0.8, 0.8, 3.5, 0.5); }
    } else if (G.onRoof && support === 0) { G.lastRoof = G.onRoof; G.onRoof = null; } // rolled off the front: free fall
    if (G.onRoof) G.v = Math.max(G.v, G.onRoof.v + 4); // keep momentum: roll forward off the roof
    if (G.jumpT >= 0 && G.jumpT < 0.45 && !G.onRoof) for (let i = 0; i < 3; i++) emit(S - 2.2 - rnd(0, 0.4), G.egoD + rnd(-0.6, 0.6), G.jumpH + 0.5, G.v * rnd(0.5, 0.8), rnd(-1.5, 1.5), rnd(-3, -0.5), rnd(0.9, 1.6), 0.7, rnd(4, 7), 0.8);
    if (G.jumpT >= 0 && G.jumpT < 0.3) for (let i = 0; i < 2; i++) emit(S + rnd(-1.4, 1.4), G.egoD + rnd(-0.8, 0.8), G.jumpH, G.v * rnd(0.6, 0.9), rnd(-2, 2), rnd(-6, -3), rnd(1, 1.6), 0.8, rnd(4, 7), 0.75);
  }
  G.pitch = lerp(G.pitch || 0, G.jumpT >= 0 && !G.onRoof ? clamp(G.vy * 0.025, -0.35, 0.18) : 0, 1 - Math.exp(-dt * 8));
  G.cool -= dt;
  // roadster
  if (G.rsT > 0 && playing) { G.rsT -= dt; if (G.rsT <= 0 && G.jumpT < 0) { G.boost = 0; G.rsT = 0; setRoadster(false); for (let i = 0; i < 20; i++) emit(S + rnd(-2, 2), G.egoD + rnd(-1, 1), 0.8, G.v * 0.8, rnd(-2, 2), 1, 0.7, 1, 3, 0.6); } else if (G.rsT <= 0) G.rsT = 0.01; }
  // pickups
  if (playing && RS_ON && !G.pickupOn && S > G.nextPickup - 360) { const n = Math.floor(laneN(G.nextPickup) + 0.02); G.pkS = G.nextPickup; G.pkD = laneC(Math.floor(Math.random() * Math.min(n, 3))); G.pickupOn = true; }
  pickup.visible = G.pickupOn;
  if (G.pickupOn) {
    P(G.pkS, G.pkD, pickup.position); pickup.rotation.y = -Math.atan(slopeX(G.pkS)); pkGem.rotation.y += dt * 2.5; pkGem.position.y = 1.4 + Math.sin(performance.now() / 260) * 0.2; pkRing.scale.setScalar(1 + Math.sin(performance.now() / 200) * 0.08);
    if (playing && Math.abs(G.pkS - S) < 2.8 && Math.abs(G.pkD - G.egoD) < 1.9 && G.jumpH < 2) { G.pickupOn = false; G.nextPickup = S + rnd(750, 1050); G.rsT = 12; G.charges = 3; setRoadster(true); G.tgtMph = Math.max(G.tgtMph, spdLo()); renderCharges(); sfx.pickup(); toast('ROADSTER MODE<small>Double-tap to fire steam thrusters</small>', 1800);
      for (let i = 0; i < 26; i++) emit(S + rnd(-2, 2), G.egoD + rnd(-1.2, 1.2), rnd(0.3, 1.2), G.v * 0.85, rnd(-3, 3), 1, 0.7, 0.8, 3.5, 0.7, 0xff6670); }
    if (G.pkS < S - 20) { G.pickupOn = false; G.nextPickup = S + rnd(500, 800); }
  }
  updateTraffic(dt);
  // collisions / passing
  const ed = egoDims();
  for (const c of cars) {
    const ds = c.s - S, dd = Math.abs(c.d - G.egoD);
    const overlap = !c.exiting && G.bore.floor && !(c === G.lastRoof && (G.jumpT >= 0 || c.s < S)) && Math.abs(ds) < (c.L + ed.L) / 2 * 0.93 && dd < (c.Wd + ed.Wd) / 2 * 0.86;
    if (overlap && G.jumpH <= c.H - 0.25 && ds < -(c.L + ed.L) / 2 * 0.55 && c.v >= G.v - 0.5) { G.rearHits++; c.s = S - (c.L + ed.L) / 2 - 0.5; c.v = Math.min(c.v, G.v - 3); }
    else if (overlap && playing && !GOD) {
      if (G.jumpH > c.H - 0.25) { if (!c.jumped) { c.jumped = true; G.jumps++; } } else { crash(c); }
    }
    if (!c.passed && ds < -(c.L + ed.L) / 2) {
      c.passed = true; if (!playing || c.v > G.v + 0.1) continue; G.passed++;
      const pts = Math.round(10 * Math.pow(G.v / MPH / lim, 2) * (roadster.visible ? RS_MULT : 1)); G.passPts += pts; popup('+' + pts, c);
      const gapLat = dd - (c.Wd + ed.Wd) / 2;
      if (c.jumped) { toast('JUMPED +150', 700); sfx.ping(); }
      else if (!G.bore.floor) { G.wall++; toast('WALL RIDE +50', 700); sfx.ping(); }
      else if (gapLat < 0.75 && gapLat > -0.2) { G.near++; toast('NEAR MISS +100', 700); sfx.ping(); }
      if (dd < 6) sfx.whoosh(clamp((c.d - G.egoD) / 5, -1, 1), c.type === 'semi' || c.type === 'box' ? 0.35 : 0.22);
    }
  }
  G.score = Math.floor(G.dist / 10) + G.passPts + G.roofLands * 200 + G.near * 100 + G.jumps * 150 + G.wall * 50;
  if (G.state === 'crash') { G.crashT += dt; if (G.crashT > 1.5) gameOver(); }
  if (G.state === 'crash' || G.state === 'over') { G.spin += G.spinV * dt; G.spinV *= Math.exp(-dt * 1.6); }
  // ego transform
  const tb = tunnelAt(S); if (tb) boreMap(G.egoD - DMID, G.bore); else { G.bore.x = G.egoD; G.bore.y = 0; G.bore.roll = 0; G.bore.floor = true; }
  { let dr = G.bore.roll - (G.roll || 0); dr = Math.atan2(Math.sin(dr), Math.cos(dr)); G.roll = (G.roll || 0) + dr * (1 - Math.exp(-dt * 14)); }
  P(S, G.bore.x, egoGroup.position); egoGroup.position.y += G.jumpH + (tb ? G.bore.y : 0);
  const lat = clamp(G.egoVd / Math.max(G.v, 5), -0.35, 0.35);
  G.yaw = lerp(G.yaw, lat, 1 - Math.exp(-dt * 12));
    egoGroup.rotation.set(Math.atan(slopeY(S)) + G.pitch - 0.035 * G.brakeVis, -Math.atan(slopeX(S) + G.yaw) + G.spin, -bank(S) - G.yaw * 0.25 + G.roll);
  tailMat.color.setRGB(lerp(0.55, 1, G.brakeVis), lerp(0.04, 0.22, G.brakeVis), lerp(0.04, 0.18, G.brakeVis)); for (const t of tailBits) t.scale.y = lerp(0.07, 0.12, G.brakeVis);
  nozzleMat.color.setHex(G.jumpT >= 0 && G.jumpT < 0.5 ? 0xffffff : 0x6fb6e8);
  // particles / road
  updateParts(dt); updateRoad(); updateOverpasses(); updateTunnel();
  updatePath(G.egoD, tb ? clamp(G.tgtD, DMID - HALF + 1, DMID + HALF - 1) : G.tgtD, G.state === 'play' && G.jumpT < 0 && G.bore.floor && Math.abs(G.egoD - DMID) < HALF - 0.8, clamp(110 + G.v * 0.6, 110, 170));
  // camera
  G.camD = lerp(G.camD, G.egoD, 1 - Math.exp(-dt * 4));
  const cd = lerp(G.camD, DMID + (laneN(S) - 3) * W * 0.5, 0.18);
  P(S - L.back, cd); const tp = _v.clone(); tp.y += L.up + G.jumpH * 0.25;
  P(S + L.ahead, lerp(cd, G.egoD, 0.3)); const tl = _v.clone(); tl.y += G.jumpH * 0.1 - 1.2 * G.brakeVis;
  G.tf = tunnelBlend(S);
  if (G.tf > 0) { // tunnel cam: behind the car along its own up-vector, rolls with it
    const r = G.roll, ux = -Math.sin(r), uy = Math.cos(r), ep = egoGroup.position, fx = slopeX(S), fl = Math.hypot(fx, 1);
    const up = lerp(L.up, 3.3, G.tf), back = lerp(L.back, 9.5, G.tf);
    const ci = new THREE.Vector3(ep.x + ux * up - fx / fl * back, ep.y + uy * up - (G.bore.y + G.jumpH) * 0, ep.z + back / fl);
    const li = new THREE.Vector3(ep.x + fx / fl * 16 + ux * 0.6, ep.y + uy * 0.6, ep.z - 16 / fl);
    tp.lerp(ci, G.tf); tl.lerp(li, G.tf);
    camera.up.set(lerp(0, ux, G.tf), lerp(1, uy, G.tf), 0).normalize();
  } else camera.up.set(0, 1, 0);
  if (G.state === 'attract') { parkA += dt * 0.12; const ep = egoGroup.position, rr = innerWidth < innerHeight ? 15 : 9.5; tp.set(ep.x + Math.sin(parkA) * rr, ep.y + 3.4, ep.z + Math.cos(parkA) * rr); tl.set(ep.x, ep.y + (innerWidth < innerHeight ? 0.2 : 0.6), ep.z); camPos.copy(tp); camLook.copy(tl); camera.up.set(0, 1, 0); }
  if (!camInit) { camPos.copy(tp); camLook.copy(tl); camInit = true; }
  let cr = lerp(10, 16, G.tf); if (G.state === 'play' && G.t < 2) cr = lerp(1.6, cr, G.t / 2); camPos.lerp(tp, 1 - Math.exp(-dt * cr)); camLook.lerp(tl, 1 - Math.exp(-dt * cr));
  G.shake *= Math.exp(-dt * 4); const sh = G.shake * 0.35;
  camera.position.set(camPos.x + rnd(-sh, sh), camPos.y + rnd(-sh, sh), camPos.z); camera.lookAt(camLook);
  sun.position.set(egoGroup.position.x - 12, egoGroup.position.y + 40, egoGroup.position.z + 10); sun.target.position.set(egoGroup.position.x, egoGroup.position.y, egoGroup.position.z - 14);
  camLight.position.copy(camera.position); camLight.intensity = 140 * G.tf;
  sfx.hum(G.v / MPH, G.state === 'play');
}
function hud(dt) {
  hudT -= dt; if (hudT > 0) return; hudT = 0.08;
  const mph = Math.round(G.v / MPH);
  $('speed').textContent = mph; $('setv').textContent = Math.round(G.tgtMph); const tier = tierOf(mph, limitAt(S)); if ($('tier').textContent !== tier) { $('tier').textContent = tier; $('tier').dataset.t = tier; $('modeName').textContent = tier; }
  $('streak').textContent = (G.dist / 1609.34).toFixed(1) + ' mi'; $('score').textContent = G.score.toLocaleString(); $('passed').textContent = G.passed;
  const k0 = Math.floor(S / SEG); let ex = null; for (let k = k0; k < k0 + 15; k++) if (segType(k) === 2 && k * SEG + EXIT_U > S) { ex = k; break; }
  if (ex !== null) { const mi = (ex * SEG + EXIT_U - S) / 1609.34; $('navd').textContent = mi < 0.2 ? Math.round(mi * 5280 / 50) * 50 + ' ft' : mi.toFixed(1) + ' mi'; $('navn').textContent = NAMES[ex % NAMES.length]; $('navx').textContent = (ex * 7) % 89 + 2; }
  { const lim0 = spdLo(), tg = G.tgtMph, f = clamp((tg - lim0) / (spdHi() - lim0), 0, 1);
    $('gfill').style.height = (f * 100).toFixed(1) + '%'; $('gval').textContent = Math.round(tg); $('glab').textContent = tierOf(tg, limitAt(S));
    $('lines').style.opacity = clamp((mph - limitAt(S) - 12) / 50, 0, 0.75).toFixed(2); $('lines').style.animationDuration = (36 / Math.max(mph, 1)).toFixed(3) + 's'; }
  const u = S - k0 * SEG; $('limitv').textContent = segType(k0) === 2 && u > 300 ? 65 : 70;
  if (roadster.visible) { $('rst').textContent = Math.ceil(G.rsT); $('ring').style.strokeDashoffset = (169.6 * (1 - G.rsT / 12)).toFixed(1); }
}
function frame(now) {
  const rdt = (now - last) / 1000; last = now; const dt = Math.min(0.05, rdt);
  step(dt); hud(dt); renderer.render(scene, camera);
  fpsAcc += rdt; fpsN++; fpsShow += rdt; fpsCnt++; if (fpsShow > 0.5) { if (SET.fps) $('fps').textContent = Math.round(fpsCnt / fpsShow) + ' fps'; fpsShow = 0; fpsCnt = 0; }
  if (fpsAcc > 2.5) { const avg = fpsAcc / fpsN; if (avg > 0.022 && pr > 1) { pr = Math.max(1, pr - 0.25); resize(); } else if (avg > 0.03 && renderer.shadowMap.enabled && pr <= 1) { renderer.shadowMap.enabled = false; scene.traverse(m => { if (m.material) m.material.needsUpdate = true; }); } fpsAcc = 0; fpsN = 0; }
  requestAnimationFrame(frame);
}
reset(); G.state = 'attract'; G.v = 0;
requestAnimationFrame(frame);



// ================= settings, theme, park screen =================
const LIGHT = { bg: ['#b9bcc1', '#d4d6d9', '#e1e2e4'], fog: 0xd6d8db, ground: 0xc3c5c9, road: 0x8e9196, band: 0xa9acb0 };
const DARK = { bg: ['#121315', '#24262a', '#2c2e33'], fog: BG, ground: 0x33363b, road: 0x0e0f11, band: 0x55585e };
function applyTheme() {
  const P = isLight() ? LIGHT : DARK, c = scene.background.image, x = c.getContext('2d'), gr = x.createLinearGradient(0, 0, 0, 256);
  P.bg.forEach((col, k) => gr.addColorStop([0, 0.55, 1][k], col)); x.fillStyle = gr; x.fillRect(0, 0, 4, 256); scene.background.needsUpdate = true;
  scene.fog.color.setHex(P.fog); matGround.color.setHex(P.ground); matRoad.color.setHex(P.road); matBand.color.setHex(P.band);
  document.documentElement.classList.toggle('light', isLight());
}
function applySettings() {
  const pl = paintList(SET.model); setEgoModel(SET.model, (pl[SET.paint] || Object.values(pl)[0])[1]);
  applyTheme(); resize(); $('fps').classList.toggle('hidden', !SET.fps);
  sfx.muted = !SET.sound; if (sfx.master) sfx.master.gain.setTargetAtTime(sfx.muted ? 0 : SET.volume, sfx.ctx.currentTime, 0.05); muteUI();
  renderTiles();
}
// settings 3D car preview (separate small renderer, clone of the ego model)
let pv = null;
function preview(cv) {
  if (pv) { cancelAnimationFrame(pv.raf); pv.r.dispose(); pv = null; }
  if (!cv) return;
  const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true }); r.setPixelRatio(Math.min(devicePixelRatio, 2));
  const sc = new THREE.Scene(); sc.environment = scene.environment; sc.add(new THREE.HemisphereLight(0xffffff, 0x444448, 1.6)); const dl = new THREE.DirectionalLight(0xffffff, 2.2); dl.position.set(-4, 8, 5); sc.add(dl);
  const car = model3.clone(true); car.visible = true; sc.add(car);
  const sh = new THREE.Mesh(new THREE.CircleGeometry(3.2, 40), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 })); sh.rotation.x = -Math.PI / 2; sh.scale.set(0.7, 1.3, 1); sc.add(sh);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100); let a = -2.3;
  const loop = () => { const w = cv.clientWidth, h = cv.clientHeight; if (cv.width !== Math.round(w * r.getPixelRatio())) { r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
    a += 0.006; cam.position.set(Math.sin(a) * 11, 3.6, Math.cos(a) * 11); cam.lookAt(0, 0.7, 0); r.render(sc, cam); pv.raf = requestAnimationFrame(loop); };
  pv = { r, raf: 0 }; loop();
}
function setPaused(p) { paused = p; $('pause').innerHTML = icon(p ? 'play' : 'pause'); }
initSettings({ rev: REV, preview, speed: () => Math.round(G.v / MPH) || 'P', open: () => { if (G.state === 'play') setPaused(true); },
  close: () => { if (G.state === 'play') setPaused(false); last = performance.now(); }, restart: () => { setPaused(false); toPark(); } });
onChange(applySettings);
$('pause').addEventListener('pointerdown', e => { e.stopPropagation(); openSettings(true, 'controls'); });
$('gear').addEventListener('click', () => openSettings(false));
function renderTiles() { $('tiles').innerHTML = `<button class="ptile" id="tileSet">${icon('vehicle')}<b>Vehicle</b><small>Model &amp; paint</small></button><button class="ptile" id="tileDisp">${icon('display')}<b>Display</b><small>Light · Dark · Camera</small></button><button class="ptile" id="tileCtl">${icon('controls')}<b>Settings</b><small>Driving · Sound</small></button>`; }
$('tiles').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; openSettings(false, b.id === 'tileSet' ? 'vehicle' : b.id === 'tileDisp' ? 'display' : 'controls'); });
// gear shifter: slide up to D starts, down to R springs back
{ const th = $('thumb'), trk = $('shifter'); let dy0 = null, off = 0;
  const gearUI = gch => { for (const el of trk.querySelectorAll('.g')) el.classList.toggle('on', el.dataset.g === gch); };
  th.addEventListener('pointerdown', e => { e.stopPropagation(); dy0 = e.clientY; th.setPointerCapture(e.pointerId); th.style.transition = 'none'; });
  th.addEventListener('pointermove', e => { if (dy0 === null) return; const lim = trk.clientHeight * 0.5, lo = trk.clientHeight * 0.25; off = clamp(e.clientY - dy0, -lim, lo); th.style.transform = `translate(-50%, calc(-50% + ${off}px))`; gearUI(off < -lim * 0.7 ? 'D' : off < -lim * 0.3 ? 'N' : off > lo * 0.6 ? 'R' : 'P'); });
  const end = () => { if (dy0 === null) return; dy0 = null; const lim = trk.clientHeight * 0.5, lo = trk.clientHeight * 0.25; th.style.transition = 'transform .25s';
    if (off < -lim * 0.7) { th.style.transform = `translate(-50%, calc(-50% - ${lim}px))`; gearUI('D'); sfx.init(); setTimeout(() => { start(); }, 380); }
    else { if (off > lo * 0.6) { sfx.init(); sfx.ping && sfx.ping(); } th.style.transform = 'translate(-50%,-50%)'; gearUI('P'); } off = 0; };
  th.addEventListener('pointerup', end); th.addEventListener('pointercancel', end);
  window.__resetShifter = () => { th.style.transition = 'none'; th.style.transform = 'translate(-50%,-50%)'; gearUI('P'); };
}
function toPark() { reset(); G.state = 'attract'; G.v = 0; $('hud').classList.add('hidden'); $('over').classList.add('hidden'); $('banner').classList.add('hidden'); $('start').classList.remove('hidden'); window.__resetShifter(); }
setInterval(() => { const d = new Date(); $('ptime').textContent = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase(); }, 5000);
$('ptime').textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase();
applySettings();

if (qs.has('tune')) { // live tuning overlay
  const p = document.createElement('div'); p.id = 'tune';
  const mk = (k, lab, mn, mx) => `<label>${lab} <b id="tv_${k}">${SET[k].toFixed(2)}</b><input type="range" min="${mn}" max="${mx}" step="0.05" value="${SET[k]}" data-k="${k}"></label>`;
  p.innerHTML = mk('exK', 'Exag', 0, 4) + mk('exP', 'Curve', 0.5, 3) + mk('space', 'Spacing', 0, 2) + '<span id="tv_x"></span>';
  p.addEventListener('pointerdown', e => e.stopPropagation());
  p.addEventListener('input', e => { const k = e.target.dataset.k; SET[k] = +e.target.value; $('tv_' + k).textContent = SET[k].toFixed(2); saveSettings(); });
  document.body.appendChild(p); setInterval(() => { $('tv_x').textContent = `×${exagF().toFixed(2)} closing · gap ×${spaceF().toFixed(2)}`; }, 250);
}
// ---- test / debug hooks ----
if (qs.has('test')) window.FSD = { G, clear: () => { for (const c of cars) freeVehicle(c.mesh); cars = []; }, gallery: (types, gap = 9) => { for (const c of cars) freeVehicle(c.mesh); cars = []; types.forEach((t, i) => { const T = TYPES[t], m = getVehicle(t), lane = i % 2 ? 2 : 0; const c = { type: t, mesh: m, s: S + 10 + Math.floor(i / 2) * gap + (i % 2) * 3, lane, d: laneC(lane), L: T.L, Wd: T.Wd, H: T.H, over: 0, v0: G.v, v: G.v, lc: null, lcTimer: 99, passed: false, exiting: false, braking: false, yaw: 0, jumped: false }; c.over = G.v / MPH - limitAt(S); cars.push(c); }); }, hud: () => { hudT = 0; hud(0.001); }, semiAhead: () => { for (const c of cars) freeVehicle(c.mesh); cars = []; const m = getVehicle('semi'), T = TYPES.semi; const rel = G.v - 32; const c = { type: 'semi', mesh: m, s: S + T.L / 2 + 2.4 + rel * 0.7, lane: Math.round(G.egoD / W - 0.5), d: G.egoD, L: T.L, Wd: T.Wd, H: T.H, over: 0, v0: 32, v: 32, lc: null, lcTimer: 99, passed: false, exiting: false, braking: false, yaw: 0, jumped: false }; c.over = 32 / MPH - limitAt(S); cars.push(c); return c; }, sim: (sec) => { const n = Math.round(sec * 60); for (let i = 0; i < n; i++) step(1 / 60); }, tunnel: () => FSD.warp(FSD.findSeg(3) + T0 + 40), drag: (x0, y0, x1, y1) => { const ev = (t, x, y) => canvas.dispatchEvent(new PointerEvent(t, { pointerId: 7, clientX: x, clientY: y, bubbles: true })); ev('pointerdown', x0, y0); for (let i = 1; i <= 10; i++) ev('pointermove', lerp(x0, x1, i / 10), lerp(y0, y1, i / 10)); ev('pointerup', x1, y1); }, start, toPark, openSettings, exagF, spaceF, fire, crash: () => crash(cars[0]), roadster: () => { G.rsT = 12; G.charges = 3; setRoadster(true); G.tgtMph = Math.max(G.tgtMph, spdLo()); renderCharges(); }, setAuto: b => { G.auto = b; }, warp: s => { S = s; for (const c of cars) freeVehicle(c.mesh); cars = []; }, get S() { return S; }, cars: () => cars, findSeg: (t, ov) => { for (let k = 1; k < 200; k++) if (segType(k) === t && (!ov || hasOverpass(k))) return k * SEG; return 0; }, noAdapt: () => { pr = 1; resize(); fpsAcc = -1e9; } };
