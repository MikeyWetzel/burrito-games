// Unlockables. Single hook: Unlocks.request(id) -> Promise<boolean>.
const KEY = 'fsdmm_unlocks';
const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
export const UNLOCKABLES = { roadster: 'Roadster', tunnels: 'Tunnels' };
export const Unlocks = {
  has: id => !!read()[id],
  async request(id) {
    if (this.has(id)) return true;
    // TODO(rewarded-ad): plug the rewarded-ad flow in here, e.g.
    //   const ok = await Ads.showRewarded({ placement: 'unlock_' + id }); if (!ok) return false;
    // DEV MODE: resolves immediately.
    const u = read(); u[id] = true; localStorage.setItem(KEY, JSON.stringify(u)); return true;
  },
  reset() { localStorage.removeItem(KEY); },
};
