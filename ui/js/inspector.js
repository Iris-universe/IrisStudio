// Panneau de droite : réglages de l'instrument sélectionné.
import { PARAMS, PRESETS, TYPE_LABEL, defaults, presetById, isBlack, noteName } from './instruments.js';
import { knob, esc } from './widgets.js';

const invoke = (...a) => window.__TAURI__.core.invoke(...a);

export class Inspector {
  constructor(app, el) { this.app = app; this.el = el; }

  render() {
    const app = this.app, ch = app.selChannel(), el = this.el;
    if (!ch) { el.innerHTML = '<div class="insp-empty">Sélectionne un instrument dans le séquenceur (clic sur son nom) pour régler son son ici.</div>'; return; }
    const presets = PRESETS.filter((p) => p.type === ch.type);
    el.innerHTML = `<div class="insp-head">
        <div class="t"><span class="sw" style="background:${ch.color}"></span><input class="nm" value="${esc(ch.name)}" title="Nom du canal"></div>
        <div class="ty">${TYPE_LABEL[ch.type]} · piste du mixeur ${ch.ins || 'master'}</div>
        <div class="t"><label style="color:var(--dim);font-size:11.5px">Préréglage</label><select class="pr" data-ctl="preset" style="flex:1"><option value="">—</option>${presets.map((p) => `<option value="${p.id}" ${p.id === ch.preset ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>
        ${presetById(ch.preset)?.desc ? `<div style="color:var(--dim);font-size:12px">${esc(presetById(ch.preset).desc)}</div>` : ''}
      </div>
      <div class="kbd-mini" data-ctl="mini-keyboard" title="Clique pour écouter (ou utilise le clavier de l'ordinateur)"></div>
      <div class="sampler-box"></div>
      <div class="secs"></div>
      <div class="insp-btns"><button class="b-piano">Piano roll</button><button class="b-mix">Voir dans le mixeur</button><button class="b-reset" title="Remet tous les réglages du préréglage">Réinitialiser</button></div>`;
    const $ = (s) => el.querySelector(s);
    $('.nm').onchange = () => { const n = $('.nm').value.trim(); if (n) app.store.change(() => (ch.name = n)); };
    $('.pr').onchange = () => {
      const pr = presetById($('.pr').value); if (!pr) return;
      app.store.change(() => { ch.params = { ...defaults(ch.type), ...pr.params }; ch.preset = pr.id; ch.color = pr.color; if (presetById(ch.preset) && PRESETS.some((x) => x.name === ch.name)) ch.name = pr.name; });
      app.preview(ch.id, 60, 400);
      app.mark('preset');
    };
    $('.b-piano').onclick = () => app.show('piano');
    $('.b-mix').onclick = () => { app.mixer.selIns = ch.ins; app.mixer._follow = ch.id; app.show('mixer'); };
    $('.b-reset').onclick = () => { const pr = presetById(ch.preset); app.store.change(() => (ch.params = { ...defaults(ch.type), ...(pr?.params || {}) })); };
    this.keyboard($('.kbd-mini'), ch);
    if (ch.type === 'sampler') this.sampler($('.sampler-box'), ch);

    let sec = null;
    for (const s of PARAMS[ch.type]) {
      if (s.sec || !sec) {
        sec = document.createElement('div'); sec.className = 'insp-sec';
        sec.innerHTML = `<div class="st">${s.sec || 'Réglages'}</div><div class="kn"></div>`;
        $('.secs').appendChild(sec);
        if (s.sec) continue;
      }
      const k = knob(s, () => ch.params[s.id] ?? s.def, (v) => {
        if (s.choices) app.store.change(() => (ch.params[s.id] = v));
        else app.tweak(`p${ch.id}.${s.id}`, () => (ch.params[s.id] = v));
        app.mark('param.' + s.id);
      }, { ctl: `p.${s.id}` });
      sec.querySelector('.kn').appendChild(k);
    }
  }

  keyboard(el, ch) {
    const app = this.app;
    const lo = 48, hi = 72; // C4 .. C6 (60 = C5)
    const whites = [];
    for (let k = lo; k <= hi; k++) if (!isBlack(k)) whites.push(k);
    const ww = 100 / whites.length;
    const press = (div, k) => {
      div.onpointerdown = (e) => { e.preventDefault(); div.setPointerCapture(e.pointerId); div.classList.add('dn'); app.noteOn(ch.id, k); };
      const up = () => { div.classList.remove('dn'); app.noteOff(ch.id, k); };
      div.onpointerup = up; div.onpointercancel = up;
    };
    whites.forEach((k) => {
      const d = document.createElement('div'); d.className = 'w';
      if (k % 12 === 0) d.innerHTML = `<span class="lbl">${noteName(k)}</span>`;
      press(d, k); el.appendChild(d);
    });
    for (let k = lo; k <= hi; k++) {
      if (!isBlack(k)) continue;
      const wi = whites.findIndex((w) => w > k);
      const d = document.createElement('div'); d.className = 'b';
      d.style.left = `calc(${wi * ww}% - 2.1%)`;
      press(d, k); el.appendChild(d);
    }
  }

  async sampler(box, ch) {
    const app = this.app;
    const name = ch.sample ? ch.sample.split(/[\\/]/).pop() : 'Aucun fichier';
    box.innerHTML = `<div class="insp-sec"><div class="st">Fichier audio</div>
      <div style="padding:2px 4px 6px;word-break:break-all">${esc(name)}</div>
      <div class="insp-btns" style="padding:0 4px"><button class="pick primary" data-ctl="sample-pick">Choisir un fichier…</button></div>
      <canvas class="wavebox" width="290" height="50"></canvas></div>`;
    box.querySelector('.pick').onclick = async () => {
      const files = await invoke('sample_pick');
      if (!files?.length) return;
      app.store.change(() => { ch.sample = files[0]; if (ch.name.startsWith('Sampler')) ch.name = files[0].split(/[\\/]/).pop().replace(/\.[^.]+$/, ''); });
      app.mark('sample');
    };
    if (!ch.sample) return;
    try {
      const info = await invoke('sample_info', { path: ch.sample });
      const c = box.querySelector('canvas'); if (!c) return;
      const g = c.getContext('2d');
      g.fillStyle = ch.color || '#3ddc97';
      const n = info.peaks.length;
      for (let i = 0; i < n; i++) { const h = Math.max(1, info.peaks[i] * 46); g.fillRect((i / n) * c.width, 25 - h / 2, Math.max(1, c.width / n - 0.5), h); }
      g.fillStyle = '#8a94a3'; g.font = '10px Segoe UI'; g.fillText(`${info.dur.toFixed(2)} s`, 4, 11);
    } catch (e) { box.querySelector('.wavebox').replaceWith(Object.assign(document.createElement('div'), { textContent: 'Fichier illisible : ' + e, style: 'color:var(--bad);padding:4px' })); }
  }
}
