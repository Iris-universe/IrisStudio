// Mixeur : master + 12 pistes, chacune avec volume, pan, mute/solo et une chaîne d'effets.
import { N_INS, addFx } from './project.js';
import { FX } from './instruments.js';
import { knob, fader, vu, esc } from './widgets.js';

export class Mixer {
  constructor(app, el) {
    this.app = app; this.el = el;
    this.selIns = 1;
    this.vus = [];
    el.innerHTML = `<div class="ed-head"><b>Mixeur</b><span class="hint">Chaque instrument est envoyé sur une piste (numéro dans le séquenceur). Clique une piste pour voir et ajouter ses effets. Double-clic sur le nom = renommer.</span></div>
      <div class="mx"><div class="mx-strips"></div><div class="mx-fx" data-zone="fx"></div></div>`;
    this.strips = el.querySelector('.mx-strips');
    this.fxEl = el.querySelector('.mx-fx');
  }

  render() {
    const app = this.app, p = app.p;
    // la piste du canal sélectionné par défaut
    if (this._follow !== app.sel) { this._follow = app.sel; const ch = app.selChannel(); if (ch) this.selIns = ch.ins; }
    this.strips.innerHTML = '';
    this.vus = [];
    for (let i = 0; i < N_INS; i++) this.strips.appendChild(this.strip(i));
    this.renderFx();
  }

  strip(i) {
    const app = this.app, m = app.p.mixer[i];
    const el = document.createElement('div');
    el.className = 'strip' + (i === 0 ? ' master' : '') + (i === this.selIns ? ' sel' : '');
    el.dataset.ctl = `ins:${i}`;
    const chans = app.p.channels.filter((c) => c.ins === i).map((c) => esc(c.name));
    el.innerHTML = `<div class="num">${i === 0 ? 'MASTER' : 'Piste ' + i}</div><div class="sn" title="Double-clic pour renommer">${esc(m.name)}</div>
      <div class="fx-n">${m.fx.length ? m.fx.length + ' effet' + (m.fx.length > 1 ? 's' : '') : ''}</div>
      <div class="row"></div><div class="db"></div><div class="pan"></div>
      <div class="ms">${i ? `<button class="m ${m.mute ? 'on' : ''}" title="Couper (mute)">M</button><button class="s ${m.solo ? 'on' : ''}" title="Solo : n'écouter que cette piste">S</button>` : ''}</div>
      <div class="chs" title="Instruments envoyés sur cette piste">${chans.join('<br>') || (i ? '<span style="opacity:.5">—</span>' : '')}</div>`;
    const v = vu({ w: 8, h: 150, ctl: i === 0 ? 'master-meter' : `vu:${i}` });
    this.vus[i] = v;
    const db = el.querySelector('.db');
    const f = fader(() => m.vol, (x) => { app.tweak('mxvol' + i, () => (m.vol = x)); db.textContent = f.dataset.db; app.mark('mixer.vol'); }, { h: 150, ctl: i === 0 ? 'master-fader' : `fader:${i}` });
    el.querySelector('.row').append(v, f);
    db.textContent = f.dataset.db;
    const pan = knob({ label: 'Pan', min: -1, max: 1, def: 0, help: 'Panoramique' }, () => m.pan, (x) => app.tweak('mxpan' + i, () => (m.pan = x)), { small: true, ctl: `pan:${i}` });
    el.querySelector('.pan').appendChild(pan);
    el.onclick = (e) => { if (e.target.closest('.fader, .knob, button')) return; this.selIns = i; this.strips.querySelectorAll('.strip').forEach((s, k) => s.classList.toggle('sel', k === i)); this.renderFx(); app.mark('mixer.select'); };
    el.querySelector('.sn').ondblclick = async () => { const n = await app.prompt('Nom de la piste', m.name); if (n) app.store.change(() => (m.name = n)); };
    const mb = el.querySelector('.m'), sb = el.querySelector('.s');
    if (mb) mb.onclick = () => app.store.change(() => (m.mute = !m.mute));
    if (sb) sb.onclick = () => app.store.change(() => (m.solo = !m.solo));
    return el;
  }

  renderFx() {
    const app = this.app, i = this.selIns, m = app.p.mixer[i];
    const el = this.fxEl;
    el.innerHTML = `<h3>${i === 0 ? 'Master' : 'Piste ' + i + ' · ' + esc(m.name)} — effets</h3>
      <p style="color:var(--dim);font-size:12px;margin:0 0 8px">Les effets s'appliquent dans l'ordre, de haut en bas. ${i === 0 ? 'Le master a toujours un limiteur de sécurité en sortie.' : ''}</p>
      <div class="fxlist"></div>
      <select class="addfx" data-ctl="add-fx"><option value="">＋ Ajouter un effet…</option>${Object.entries(FX).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}</select>`;
    const list = el.querySelector('.fxlist');
    m.fx.forEach((fx, j) => {
      const spec = FX[fx.type]; if (!spec) return;
      const box = document.createElement('div');
      box.className = 'fxbox' + (fx.on ? '' : ' off');
      box.dataset.ctl = `fx:${fx.type}`;
      box.innerHTML = `<div class="fh"><button class="on-b ${fx.on ? 'on' : ''}" title="Activer / contourner">${fx.on ? 'ON' : 'OFF'}</button><b>${spec.label}</b>
        <button class="up" title="Monter">▲</button><button class="dn" title="Descendre">▼</button><button class="rm" title="Retirer">✕</button></div>
        <div class="fx-help">${spec.help}</div><div class="kn"></div>`;
      const kn = box.querySelector('.kn');
      for (const s of spec.params) {
        const k = knob(s, () => fx.p[s.idx], (v) => { app.tweak(`fx${fx.id}.${s.id}`, () => (fx.p[s.idx] = v)); app.mark('fx.param'); }, { ctl: `fx:${fx.type}.${s.id}` });
        kn.appendChild(k);
      }
      box.querySelector('.on-b').onclick = () => app.store.change(() => (fx.on = !fx.on));
      box.querySelector('.rm').onclick = () => app.store.change(() => m.fx.splice(j, 1));
      box.querySelector('.up').onclick = () => j > 0 && app.store.change(() => m.fx.splice(j - 1, 0, m.fx.splice(j, 1)[0]));
      box.querySelector('.dn').onclick = () => j < m.fx.length - 1 && app.store.change(() => m.fx.splice(j + 1, 0, m.fx.splice(j, 1)[0]));
      list.appendChild(box);
    });
    el.querySelector('.addfx').onchange = (e) => {
      const t = e.target.value; if (!t) return;
      app.store.change((p) => addFx(p, i, t));
      app.mark('fx.add.' + t);
    };
  }

  tick(s) {
    for (let i = 0; i < this.vus.length; i++) this.vus[i]?.push(s.ins[i] ?? -120);
  }
}
