// Unlockables. Earned by cumulative cars passed (persisted). Unlocks are permanent.
// Single hook for a future rewarded-ad shortcut: Unlocks.request(id) -> Promise<boolean>.
const KEY = 'fsdmm_unlocks', PKEY = 'fsdmm_passes';
const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
const grant = id => { const u = read(); u[id] = true; localStorage.setItem(KEY, JSON.stringify(u)); };
export const UNLOCKABLES = { roadster: 'Roadster', tunnels: 'Tunnels' };
export const GOALS = { roadster: 20, tunnels: 40 }; // cumulative passes (tunnels = 20 more after Roadster)
export const Unlocks = {
  has: id => !!read()[id],
  passes: () => Math.max(0, parseInt(localStorage.getItem(PKEY) || '0', 10) || 0),
  // progress toward id: { n, goal, need } where n/need are relative to the previous goal
  progress(id) { const p = this.passes(), base = id === 'tunnels' ? GOALS.roadster : 0, need = GOALS[id] - base; return { n: Math.max(0, Math.min(need, p - base)), need, goal: GOALS[id] }; },
  // next locked unlockable (for in-game goal text)
  next() { return ['roadster', 'tunnels'].find(id => !this.has(id)) || null; },
  // call once per car passed; returns list of ids newly unlocked
  addPass() { const p = this.passes() + 1; localStorage.setItem(PKEY, String(p)); const got = [];
    for (const id of ['roadster', 'tunnels']) if (!this.has(id) && p >= GOALS[id]) { grant(id); got.push(id); } return got; },
  async request(id) {
    if (this.has(id)) return true;
    // TODO(rewarded-ad): plug the rewarded-ad flow in here, e.g.
    //   const ok = await Ads.showRewarded({ placement: 'unlock_' + id }); if (!ok) return false;
    // Currently only reachable as a dev shortcut behind ?test.
    grant(id); return true;
  },
  reset() { localStorage.removeItem(KEY); localStorage.removeItem(PKEY); },
};
