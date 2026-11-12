// Petits contrôles : potard, sélecteur, fader vertical, VU-mètre.
import { noteName } from './instruments.js';

export function fmt(s, v) {
  if (s.choices) return s.choices[Math.round(v)] ?? '?';
  if (s.note) return noteName(Math.round(v));
  if (s.int) return `${v > 0 && s.min < 0 ? '+' : ''}${Math.round(v)}${s.unit ? ' ' + s.unit : ''}`;
  const u = s.unit || '';
  if (u === 'Hz') return v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 1 : 2)} kHz` : `${Math.round(v)} Hz`;
  if (u === 'ms') return v >= 1000 ? `${(v / 1000).toFixed(2)} s` : `${v < 10 ? v.toFixed(1) : Math.round(v)} ms`;
  if (u === 'dB') return `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`;
  if (u === '×') return `×${v.toFixed(2)}`;
  if (u) return `${Math.abs(v) < 10 && !Number.isInteger(v) ? v.toFixed(2) : Math.round(v * 10) / 10} ${u}`;
  if (s.min === 0 && s.max === 1) return `${Math.round(v * 100)} %`;
  return v.toFixed(2);
}

const toN = (s, v) => (s.log ? Math.log(v / s.min) / Math.log(s.max / s.min) : (v - s.min) / (s.max - s.min));
const fromN = (s, n) => {
  n = Math.max(0, Math.min(1, n));
  let v = s.log ? s.min * Math.pow(s.max / s.min, n) : s.min + n * (s.max - s.min);
  if (s.int) v = Math.round(v);
  return v;
};

/** potard rotatif : glisser vers le haut/bas (Maj = fin), molette, double-clic = valeur par défaut */
export function knob(s, get, set, { ctl, small = false, label = true } = {}) {
  if (s.choices) return choice(s, get, set, { ctl });
  const el = document.createElement('div');
  el.className = 'knob' + (small ? ' small' : '');
  if (ctl) el.dataset.ctl = ctl;
  el.title = (s.help ? s.help + '\n' : '') + 'Glisser haut/bas (Maj = précis) · molette · double-clic = par défaut';
  const R = small ? 11 : 15;
  const S = R * 2 + 6;
  el.innerHTML = `<svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}"><circle cx="${S / 2}" cy="${S / 2}" r="${R}" class="kb"/><path class="ka"/><line class="kp" x1="${S / 2}" y1="${S / 2}"/></svg>${label ? `<div class="kl">${s.label}</div>` : ''}<div class="kv"></div>`;
  const arc = el.querySelector('.ka'), ptr = el.querySelector('.kp'), val = el.querySelector('.kv');
  const c = S / 2;
  const pt = (a, r) => [c + r * Math.cos(a), c + r * Math.sin(a)];
  const bipolar = s.min < 0 && s.max > 0 && !s.log;
  el.refresh = () => {
    const v = get();
    const n = Math.max(0, Math.min(1, toN(s, v)));
    const a0 = Math.PI * 0.75, a1 = a0 + n * Math.PI * 1.5;
    const from = bipolar ? a0 + toN(s, 0) * Math.PI * 1.5 : a0;
    const [x0, y0] = pt(Math.min(from, a1), R), [x1, y1] = pt(Math.max(from, a1), R);
    const large = Math.abs(a1 - from) > Math.PI ? 1 : 0;
    arc.setAttribute('d', Math.abs(a1 - from) < 0.001 ? '' : `M${x0},${y0} A${R},${R} 0 ${large} 1 ${x1},${y1}`);
    const [px, py] = pt(a1, R - 3);
    ptr.setAttribute('x2', px); ptr.setAttribute('y2', py);
    val.textContent = fmt(s, v);
  };
  let drag = null;
  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    drag = { y: e.clientY, n: toN(s, get()) };
    el.classList.add('drag');
  });
  el.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const k = e.shiftKey ? 0.0012 : 0.006;
    const n = drag.n + (drag.y - e.clientY) * k;
    set(fromN(s, n));
    el.refresh();
  });
  const end = () => { drag = null; el.classList.remove('drag'); };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  el.addEventListener('dblclick', () => { set(s.def); el.refresh(); });
  el.addEventListener('wheel', (e) => {
    e.preventDefault();
    const n = toN(s, get()) + (e.deltaY < 0 ? 1 : -1) * (s.int ? 1 / Math.max(1, s.max - s.min) : e.shiftKey ? 0.005 : 0.02);
    set(fromN(s, n)); el.refresh();
  }, { passive: false });
  el.refresh();
  return el;
}

export function choice(s, get, set, { ctl } = {}) {
  const el = document.createElement('div');
  el.className = 'choice';
  if (ctl) el.dataset.ctl = ctl;
  if (s.help) el.title = s.help;
  el.innerHTML = `<div class="kl">${s.label}</div><select>${s.choices.map((c, i) => `<option value="${i}">${c}</option>`).join('')}</select>`;
  const sel = el.querySelector('select');
  sel.onchange = () => set(Number(sel.value));
  el.refresh = () => { sel.value = String(Math.round(get())); };
  el.refresh();
  return el;
}

/** fader vertical 0..1 (0,8 = 0 dB) */
export const volDb = (v) => (v <= 0.0001 ? -Infinity : 40 * Math.log10(v / 0.8));
export function fader(get, set, { ctl, h = 130, title = 'Volume' } = {}) {
  const el = document.createElement('div');
  el.className = 'fader';
  el.style.height = h + 'px';
  if (ctl) el.dataset.ctl = ctl;
  el.title = `${title} : glisser · double-clic = 0 dB`;
  el.innerHTML = '<div class="ftrack"></div><div class="f0"></div><div class="fcap"></div>';
  const cap = el.querySelector('.fcap'), zero = el.querySelector('.f0');
  const max = 1.0;
  const pos = (v) => (1 - v / max) * (h - 14);
  zero.style.top = pos(0.8) + 6 + 'px';
  el.refresh = () => { cap.style.top = pos(get()) + 'px'; const d = volDb(get()); el.dataset.db = isFinite(d) ? `${d > 0 ? '+' : ''}${d.toFixed(1)} dB` : '−∞'; };
  let drag = null;
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault(); el.setPointerCapture(e.pointerId);
    const r = el.getBoundingClientRect();
    const onCap = e.target === cap;
    drag = { y: e.clientY, v: get() };
    if (!onCap) { const v = Math.max(0, Math.min(max, (1 - (e.clientY - r.top - 7) / (h - 14)) * max)); set(v); drag.v = v; el.refresh(); }
  });
  el.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const k = e.shiftKey ? 0.2 : 1;
    const v = Math.max(0, Math.min(max, drag.v + (drag.y - e.clientY) / (h - 14) * max * k));
    set(v); el.refresh();
  });
  el.addEventListener('pointerup', () => (drag = null));
  el.addEventListener('dblclick', () => { set(0.8); el.refresh(); });
  el.addEventListener('wheel', (e) => { e.preventDefault(); set(Math.max(0, Math.min(max, get() + (e.deltaY < 0 ? 0.02 : -0.02)))); el.refresh(); }, { passive: false });
  el.refresh();
  return el;
}

/** VU-mètre : `push(db)` à chaque instantané ; garde la crête un moment */
export function vu({ w = 8, h = 130, ctl } = {}) {
  const c = document.createElement('canvas');
  c.className = 'vu';
  c.width = w; c.height = h;
  if (ctl) c.dataset.ctl = ctl;
  const g = c.getContext('2d');
  let lvl = -60, hold = -60, holdT = 0, clipT = 0;
  const y = (db) => h - Math.max(0, Math.min(1, (db + 48) / 54)) * h; // -48..+6 dB
  c.push = (db) => {
    const now = performance.now();
    lvl = Math.max(db, lvl - 1.6);
    if (db > hold || now - holdT > 1200) { hold = db; holdT = now; }
    if (db > -0.1) clipT = now;
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#0c0e12'; g.fillRect(0, 0, w, h);
    const top = y(lvl);
    const grad = g.createLinearGradient(0, h, 0, 0);
    grad.addColorStop(0, '#2bd67b'); grad.addColorStop(0.72, '#2bd67b'); grad.addColorStop(0.82, '#ffd23d'); grad.addColorStop(0.9, '#ff3d3d');
    g.fillStyle = grad; g.fillRect(0, top, w, h - top);
    g.fillStyle = hold > -0.1 ? '#ff3d3d' : '#e8e8e8'; g.fillRect(0, y(hold), w, 2);
    if (now - clipT < 1500) { g.fillStyle = '#ff3d3d'; g.fillRect(0, 0, w, 4); }
    g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(0, y(0), w, 1);
  };
  c.level = () => lvl;
  c.push(-120);
  return c;
}

export function esc(s) { return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
