// Traffic speed rules. Speeds are m/s except `over` and limitMph, which are mph.
// A pack stays unblockable when every lane is filled and every car is held at the
// same speed. Followers used to copy the leader whenever the gap was under ~22 m
// and were not allowed under the limit, so the copy never came undone.
const MPH = 0.44704;

export const BLOCK_SPAN = 18;
export const SHEAR_HOLD_MS = 2200;
export const SHEAR_MIN_MPH = 6;
// Per-lane cruise offsets (mph vs the posted limit). Spread is wide on purpose.
export const LANE_OVER = [-4, 3, 10, 15];

export function cruiseOver(type, rnd = Math.random) {
  if (type === 'moto') return 10 + rnd() * 8;
  if (type === 'semi' || type === 'box' || type === 'bus' || type === 'school') return -2 + rnd() * 6;
  const r = rnd();
  if (r < 0.34) return -4 + rnd() * 4;
  if (r < 0.67) return 3 + rnd() * 5;
  return 9 + rnd() * 6;
}

// Reroll so a new car does not spawn beside another one at nearly the same cruise.
export function diversifyOver(type, sPos, lane, cars, rnd = Math.random) {
  let over = cruiseOver(type, rnd);
  for (let i = 0; i < 5; i++) {
    const clash = cars.some(c => !c.downed && !c.exiting && Math.abs(c.s - sPos) < 22 && c.lane !== lane && Math.abs(c.over - over) < 5);
    if (!clash) break;
    over = cruiseOver(type, rnd);
  }
  return over;
}

// `clear` is the bumper gap in metres. `opening` is hysteresis so a car that
// braked to make room accelerates only after the gap is actually open.
export function followSpeed({ cruise, lim, clear, leadV, egoLead, opening, beside, moto }) {
  if (egoLead) {
    let vt = cruise;
    if (clear < 30) vt = Math.min(vt, leadV - (clear < 10 ? 3 : 0));
    if (clear < 6) vt = Math.min(vt, leadV - 2);
    return { vt, opening: clear < 14 };
  }
  if (clear == null || !Number.isFinite(clear)) return { vt: cruise, opening: false };
  const band = (beside ? 3.2 : (opening ? 16 : 9)) * (moto ? 0.7 : 1);
  if (clear < band) {
    let vt = Math.min(cruise, leadV - (beside ? 3.5 : 2.2));
    vt = Math.max(vt, lim - 8 * MPH);
    return { vt, opening: true };
  }
  return { vt: cruise, opening: false };
}

// Groups of cars close enough longitudinally that a driver cannot thread them.
// A group blocks the road when every lane at that point is occupied.
export function blockingPacks(cars, laneNAt) {
  const list = cars.filter(c => !c.downed && !c.exiting).sort((a, b) => a.s - b.s);
  const packs = [];
  for (const c of list) {
    const last = packs[packs.length - 1];
    if (last && c.s - last[0].s < BLOCK_SPAN) last.push(c);
    else packs.push([c]);
  }
  return packs.filter(p => {
    if (p.length < 2) return false;
    const mid = (p[0].s + p[p.length - 1].s) / 2;
    const n = Math.max(1, Math.floor(laneNAt(mid) + 0.02));
    const lanes = new Set();
    for (const c of p) {
      lanes.add(c.lane);
      if (c.lc && c.lc.to != null) lanes.add(c.lc.to);
    }
    return lanes.size >= n;
  });
}

// Give each lane in a blocking pack its own cruise and snap speed to it.
// Cars directly in front of a faster player are sped up instead of brake-checked.
export function shearPack(pack, ctx) {
  if (!pack || pack.length < 2) return false;
  let lo = Infinity, hi = -Infinity;
  for (const c of pack) { if (c.v < lo) lo = c.v; if (c.v > hi) hi = c.v; }
  if ((hi - lo) / MPH >= SHEAR_MIN_MPH) return false;
  const now = ctx.now || 0;
  if (pack.some(c => c.shearT && now - c.shearT < SHEAR_HOLD_MS)) return false;
  const lanes = [...new Set(pack.map(c => c.lane))].sort((a, b) => a - b);
  const { playerS, playerD, playerV, limitMph } = ctx;
  const nearAhead = ctx.nearAhead ?? 28;
  const near = c => c.s > playerS - 6 && c.s < playerS + nearAhead && Math.abs(c.d - playerD) < 2.6;
  lanes.forEach((ln, i) => {
    const off = LANE_OVER[i % LANE_OVER.length];
    for (const c of pack) {
      if (c.lane !== ln || c.downed) continue;
      let use = c.type === 'moto' ? 12 + (i % 3) * 3 : off;
      if (near(c) && (limitMph + use) * MPH < playerV - 1) use = Math.max(use, 8);
      c.over = use;
      c.v = (limitMph + c.over) * MPH;
      c.v0 = c.v;
      c.shearT = now;
    }
  });
  return true;
}
