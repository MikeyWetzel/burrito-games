// Rev 1.6: GTA-style WASTED/BUSTED overlay, CA-plate name entry, global leaderboard.
import { WORDS } from './words.js';
const $ = id => document.getElementById(id);
const API = '../stats/leaderboard.php';
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const cleanName = s => String(s || '').toUpperCase().replace(/[^A-Z0-9 ]/g, '').slice(0, 8);
export function lastName() { return cleanName(localStorage.getItem('fsdmm_plate') || ''); }

export function showWasted(word) {
  const w = WORDS[word], el = $('wasted');
  el.innerHTML = `<svg viewBox="-80 -1860 ${w.w + 160} 1960" preserveAspectRatio="xMidYMid meet" aria-label="${word}"><path d="${w.d}"/></svg>`;
  el.className = 'show ' + word.toLowerCase();
}
export function hideWasted() { $('wasted').className = ''; $('wasted').innerHTML = ''; }

// our own California-style plate drawing (no state artwork copied)
export function plateHTML(name, mini = false) {
  return `<div class="plate${mini ? ' mini' : ''}"><span class="pst">California</span><span class="ptx">${esc(name || '')}</span><span class="pft">fsd mad max</span></div>`;
}

export async function fetchTop() {
  const r = await fetch(API + '?g=fsd', { cache: 'no-store' }); if (!r.ok) throw new Error('lb ' + r.status);
  return (await r.json()).top || [];
}
export async function submit(name, run) {
  const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ n: name, s: run.s, t: Math.round(run.t * 10) / 10, d: Math.round(run.d) }) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status)); return j;
}
export function renderList(el, top, hiName, hiScore) {
  if (!top.length) { el.innerHTML = '<p class="lbempty">No plates yet. Be the first!</p>'; return; }
  el.innerHTML = top.map((r, i) => `<div class="lbrow${r.n === hiName && (hiScore < 0 || r.s === hiScore) ? ' me' : ''}"><b class="rk">${i + 1}</b>${plateHTML(r.n, true)}<span class="sc">${Number(r.s).toLocaleString()}<small>${r.d} mi</small></span></div>`).join('');
}
