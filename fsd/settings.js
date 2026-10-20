import { Unlocks } from './unlocks.js?v=2.9.0';
// Tesla-Controls-style settings screen. Persisted in localStorage; game listens via onChange.
const KEY = 'fsdmm_settings';
export const DEF = { theme: 'auto', density: 'normal', difficulty: 'standard', camera: 'near', quality: 'high', fps: false, sound: true, volume: 0.8, rsTime: 12, rsCharges: 3, cheat: false, model: 'm3', paint: 'pearl', exK: 1.6, exP: 1.7, space: 0.8 };
export const SET = Object.assign({}, DEF, (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } })());
export const MODELS = [['m3', 'Model 3'], ['my', 'Model Y'], ['ms', 'Model S'], ['mx', 'Model X'], ['ct', 'Cybertruck']];
// approximations of Tesla's current paint names
export const PAINTS = {
  pearl: ['Pearl White', '#f1f1ee'], black: ['Solid Black', '#0d0e10'], diamond: ['Diamond Black', '#1b1d21'], stealth: ['Stealth Grey', '#4b4e53'],
  quick: ['Quicksilver', '#a2a6ab'], ultrared: ['Ultra Red', '#a4121c'], deepblue: ['Deep Blue Metallic', '#1e3b70'], marine: ['Marine Blue', '#233258'],
  cherry: ['Midnight Cherry Red', '#5c1521'],
};
export const CT_PAINTS = { stainless: ['Stainless Steel', '#b9bcbf'], satblack: ['Satin Black Wrap', '#232427'], satwhite: ['Satin White Wrap', '#dcdcd8'] };
if (new URLSearchParams(location.search).has('cheat')) { SET.cheat = true; try { localStorage.setItem(KEY, JSON.stringify(SET)); } catch (e) {} } // ?cheat turns cheat mode on (persisted)
export const paintList = m => m === 'ct' ? CT_PAINTS : PAINTS;
// migration: any unknown/legacy vehicle (e.g. a saved 'roadster') falls back to the Model 3 in Pearl White; Roadster is power-up only
if (!MODELS.some(m => m[0] === SET.model)) { SET.model = 'm3'; SET.paint = DEF.paint; }
if (!paintList(SET.model)[SET.paint]) SET.paint = Object.keys(paintList(SET.model))[0];
let cb = () => {};
export const onChange = f => { cb = f; };
const save = () => { localStorage.setItem(KEY, JSON.stringify(SET)); cb(SET); };
export const isLight = () => SET.theme === 'light' || (SET.theme === 'auto' && matchMedia('(prefers-color-scheme: light)').matches);
matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', () => cb(SET));

const I = { // small line icons (drawn here, not Tesla assets)
  controls: '<rect x="3" y="8" width="18" height="8" rx="4"/><circle cx="8" cy="12" r="2.2"/>',
  driving: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2"/><path d="M3.8 10.5h16.4M12 14v6.3"/>',
  vehicle: '<path d="M4 15v-3l2.4-4.4h11.2L20 12v3z"/><circle cx="7.5" cy="15.5" r="1.6"/><circle cx="16.5" cy="15.5" r="1.6"/>',
  display: '<rect x="3.5" y="5" width="17" height="12" rx="1.5"/><path d="M9 20h6"/>',
  sound: '<path d="M4 10h3l5-4v12l-5-4H4z"/><path d="M15.5 9a4 4 0 010 6M18 7a7 7 0 010 10"/>',
  tuning: '<path d="M5 6h14M5 12h14M5 18h14"/><circle cx="9" cy="6" r="1.8"/><circle cx="15" cy="12" r="1.8"/><circle cx="8" cy="18" r="1.8"/>',
  roadster: '<path d="M3 15l3-3.5 6-1.5 6 1.5 3 3.5z"/><circle cx="7" cy="15.5" r="1.5"/><circle cx="17" cy="15.5" r="1.5"/>',
  about: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.6v.4"/>',
  lock: '<rect x="5.5" y="10.5" width="13" height="9" rx="1.6"/><path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5"/>',
  sun: '<circle cx="12" cy="12" r="3.6"/><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M5.6 18.4l1.6-1.6M16.8 7.2l1.6-1.6"/>',
  moon: '<path d="M19 14.5A7.5 7.5 0 019.5 5a7.5 7.5 0 109.5 9.5z"/>',
  gauge: '<path d="M4.5 16a8 8 0 1115 0"/><path d="M12 14l3.5-4.5"/>',
  cam: '<rect x="3.5" y="7" width="12" height="10" rx="1.5"/><path d="M15.5 11l5-3v8l-5-3z"/>',
  bell: '<path d="M6.5 16V11a5.5 5.5 0 0111 0v5l1.5 1.5h-14z"/><path d="M10.5 20h3"/>',
  bt: '<path d="M8 7.5l8 8-4 4V4.5l4 4-8 8"/>', home: '<path d="M4.5 11L12 5l7.5 6v8h-15z"/>',
  user: '<circle cx="12" cy="8.5" r="3.4"/><path d="M5.5 19.5a6.5 6.5 0 0113 0"/>', search: '<circle cx="10.5" cy="10.5" r="5.5"/><path d="M15 15l4.5 4.5"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z"/>', pause: '<path d="M8.5 5.5v13M15.5 5.5v13"/>',
};
export const icon = (k, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24">${I[k]}</svg>`;
const TABS = [['controls', 'Controls'], ['driving', 'Driving'], ['vehicle', 'Vehicle'], ['display', 'Display'], ['sound', 'Sound'], ['tuning', 'Tuning'], ['about', 'About']];
const seg = (key, opts, ic) => `<div class="seg" data-k="${key}">${opts.map(([v, l, i]) => `<button data-v="${v}" class="${String(SET[key]) === String(v) ? 'on' : ''}">${i ? icon(i) : ''}${l}</button>`).join('')}</div>`;
const row = (label, html) => `<div class="row"><div class="rl">${label}</div>${html}</div>`;
const slider = (key, min, max, stp) => `<div class="sl"><input type="range" data-k="${key}" min="${min}" max="${max}" step="${stp}" value="${SET[key]}">${icon('sun')}</div>`;

let el, tab = 'controls', hooks = {};
export function initSettings(h) { hooks = h; }
function body() {
  const yes = [['true', 'On'], ['false', 'Off']];
  switch (tab) {
    case 'controls': return `${seg('theme', [['auto', 'Auto', 'gauge'], ['light', 'Light', 'sun'], ['dark', 'Dark', 'moon']])}
      <div class="tiles">${hooks.paused ? `<button class="tile" data-act="resume">${icon('play')}<span>Resume</span></button>` : ''}
        <button class="tile" data-act="restart">${icon('driving')}<span>New Drive</span></button>
        <button class="tile ${SET.sound ? '' : 'dim'}" data-act="sound">${icon('sound')}<span>Sound<small>${SET.sound ? 'On' : 'Off'}</small></span></button>
        <button class="tile ${SET.fps ? '' : 'dim'}" data-act="fps">${icon('gauge')}<span>Show FPS<small>${SET.fps ? 'On' : 'Off'}</small></span></button></div>
      ${seg('camera', [['near', 'Camera Near', 'cam'], ['far', 'Camera Far', 'cam']])}
      <div class="slrow">${slider('volume', 0, 1, 0.05)}<button class="blue" data-act="done">Done</button></div>`;
    case 'driving': return row('Traffic Density', seg('density', [['low', 'Low'], ['normal', 'Normal'], ['high', 'High']])) +
      row('Difficulty', seg('difficulty', [['chill', 'Chill'], ['standard', 'Standard'], ['madmax', 'Mad Max']])) +
      `<p class="note">Difficulty sets how often traffic changes lanes and cuts in (always signalled, never unavoidable).</p>` +
      row('Cheat Mode', seg('cheat', yes)) + `<p class="note">Cheat mode: drive on the shoulders past the outer lanes, where traffic never goes. Cops still chase you. Cheat runs are not submitted to the leaderboard.</p>` +
      (SET.cheat ? `<button class="tile wide" data-act="unlockAll">${icon('lock')}<span>Unlock Roadster &amp; Tunnels now</span></button>` : '');
    case 'vehicle': { const pl = paintList(SET.model); return `<div class="prev"><canvas id="carPrev"></canvas><div class="pname">${MODELS.find(m => m[0] === SET.model)[1]}<small>${(pl[SET.paint] || Object.values(pl)[0])[0]}</small></div></div>` +
      seg('model', MODELS) + `<div class="paints">${Object.entries(pl).map(([k, [n, c]]) => `<button class="sw ${SET.paint === k ? 'on' : ''}" data-paint="${k}" title="${n}" style="--c:${c}"></button>`).join('')}</div>`; }
    case 'display': return row('Appearance', seg('theme', [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']])) + row('Camera', seg('camera', [['near', 'Near'], ['far', 'Far']])) +
      row('Quality', seg('quality', [['low', 'Low'], ['med', 'Med'], ['high', 'High']])) + row('Show FPS', seg('fps', yes));
    case 'sound': return row('Sound', seg('sound', yes)) + row('Volume', `<div class="slrow">${slider('volume', 0, 1, 0.05)}</div>`);
    case 'tuning': return row(`Speed exaggeration strength · ${SET.exK.toFixed(2)}`, `<div class="slrow">${slider('exK', 0, 4, 0.05)}</div>`) +
      row(`Exaggeration curve (power) · ${SET.exP.toFixed(2)}`, `<div class="slrow">${slider('exP', 0.5, 3, 0.05)}</div>`) +
      row(`Traffic spacing at speed · ${SET.space.toFixed(2)}`, `<div class="slrow">${slider('space', 0, 2, 0.05)}</div>`) +
      `<p class="note">Closing speed × (1 + strength × t^power), t = 0 at the limit … 1 at 100 mph. Spacing widens gaps and thins traffic as t rises. Live: also on screen with ?tune.</p><button class="tile wide" data-act="tuneReset">${icon('gauge')}<span>Reset tuning</span></button>`;
    case 'about': return `<div class="about"><b>FSD Mad Max</b><span>Rev ${hooks.rev}</span><p>Fan-made game, not affiliated with Tesla. Font: Montserrat (SIL OFL). All vehicles and everything else are our own procedural geometry.</p>
      <button class="tile wide" data-act="resetUnlocks">${icon('lock')}<span>Reset unlocks &amp; progress</span></button>${SET.cheat ? `<button class="tile wide" data-act="unlockAll">${icon('lock')}<span>Unlock Roadster &amp; Tunnels now</span></button>` : ''}</div>`;
  }
}
function render() {
  const now = new Date(), t = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase();
  el.innerHTML = `<div class="sbar"><span>${t}</span><span class="tmp">${icon('sun')}72°F</span><span class="sp"></span></div>
  <div class="shead">${icon('search')}<span class="srch">Search Settings</span><span class="sp"></span>${icon('user')}<b>Mikey W</b>${icon('home')}${icon('bell')}${icon('bt')}</div>
  <div class="smain"><nav>${TABS.map(([k, l]) => `<button data-tab="${k}" class="${tab === k ? 'on' : ''}">${icon(k)}<span>${l}</span></button>`).join('')}</nav><div class="pane">${body()}</div></div>
  <div class="dock"><button data-act="done" class="dk">${icon('vehicle')}</button><span class="sp"></span><span class="arr">‹</span><b>${hooks.speed ? hooks.speed() : 70}</b><span class="arr">›</span><span class="sp"></span><button data-act="sound" class="dk">${icon('sound')}</button></div>`;
  if (tab === 'vehicle' && hooks.preview) hooks.preview(el.querySelector('#carPrev'));
  else if (hooks.preview) hooks.preview(null);
}
export function openSettings(paused, t) {
  hooks.paused = paused; if (t) tab = t;
  if (!el) {
    el = document.createElement('div'); el.id = 'settings'; document.body.appendChild(el);
    el.addEventListener('pointerdown', e => e.stopPropagation());
    el.addEventListener('click', async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.tab) { tab = b.dataset.tab; return render(); }
      if (b.dataset.paint) { SET.paint = b.dataset.paint; save(); return render(); }
      const sg = b.closest('.seg'); if (sg) { const k = sg.dataset.k; let v = b.dataset.v; v = v === 'true' ? true : v === 'false' ? false : isNaN(+v) ? v : +v; SET[k] = v;
        if (k === 'model') { const pl = paintList(v); if (!pl[SET.paint]) SET.paint = Object.keys(pl)[0]; } save(); return render(); }
      const a = b.dataset.act;
      if (a === 'sound') { SET.sound = !SET.sound; save(); render(); }
      else if (a === 'fps') { SET.fps = !SET.fps; save(); render(); }
      else if (a === 'unlockAll') { Unlocks.grantAll(); hooks.unlocked && hooks.unlocked(); render(); }
      else if (a === 'resetUnlocks') { Unlocks.reset(); hooks.unlocked && hooks.unlocked(); render(); }
      else if (a === 'tuneReset') { SET.exK = DEF.exK; SET.exP = DEF.exP; SET.space = DEF.space; save(); render(); }
      else if (a === 'done' || a === 'resume') closeSettings();
      else if (a === 'restart') { closeSettings(); hooks.restart && hooks.restart(); }
    });
    el.addEventListener('input', e => { if (e.target.dataset.k) { SET[e.target.dataset.k] = +e.target.value; save(); const r = e.target.closest('.row'); if (r && r.firstChild && /·/.test(r.firstChild.textContent)) r.firstChild.textContent = r.firstChild.textContent.replace(/·.*/, '· ' + (+e.target.value).toFixed(2)); } });
  }
  el.classList.remove('hidden'); render(); hooks.open && hooks.open();
}
export function closeSettings() { if (!el) return; el.classList.add('hidden'); hooks.preview && hooks.preview(null); hooks.close && hooks.close(); }

export const saveSettings = save;
