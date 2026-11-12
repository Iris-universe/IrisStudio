// Navigateur (à gauche) : instruments à ajouter et projets de démonstration.
import { PRESETS } from './instruments.js';
import { addChannel } from './project.js';
import { DEMOS } from './demos.js';
import { esc } from './widgets.js';

const invoke = (...a) => window.__TAURI__.core.invoke(...a);

export class Browser {
  constructor(app, el) {
    this.app = app; this.el = el; this.tab = 'inst';
    el.innerHTML = `<div class="br-tabs"><button data-t="inst" class="on">Instruments</button><button data-t="demo">Démos</button><button data-t="files">Fichiers</button></div><div class="br-list"></div>`;
    this.list = el.querySelector('.br-list');
    el.querySelectorAll('.br-tabs button').forEach((b) => (b.onclick = () => { this.tab = b.dataset.t; el.querySelectorAll('.br-tabs button').forEach((x) => x.classList.toggle('on', x === b)); this.render(); }));
    this.render();
  }

  render() {
    if (this.tab === 'inst') {
      let html = '', cat = '';
      for (const p of PRESETS) {
        if (p.cat !== cat) { cat = p.cat; html += `<div class="br-cat">${cat}</div>`; }
        html += `<div class="br-item" data-id="${p.id}" data-ctl="preset:${p.id}" title="${esc(p.desc || '')}\nClic : ajouter au séquenceur"><span class="dot" style="background:${p.color}"></span><span>${esc(p.name)}</span></div>`;
      }
      html += '<div class="br-hint">Clic = ajouter l\'instrument au séquenceur. Tu peux aussi glisser des fichiers audio depuis Windows sur la fenêtre.</div>';
      this.list.innerHTML = html;
      this.list.querySelectorAll('.br-item').forEach((d) => (d.onclick = () => this.addPreset(d.dataset.id)));
    } else if (this.tab === 'demo') {
      this.list.innerHTML = DEMOS.map((d) => `<div class="br-demo" data-id="${d.id}"><b>${esc(d.name)}</b> <span style="color:var(--dim)">${d.bpm} BPM</span><div class="d">${esc(d.desc)}</div></div>`).join('')
        + '<div class="br-hint">Ouvre une démo pour voir comment un style est construit (rythme, sons, mixage, structure). Ton projet actuel reste dans la sauvegarde automatique.</div>';
      this.list.querySelectorAll('.br-demo').forEach((d) => (d.onclick = () => this.app.loadDemo(d.dataset.id)));
    } else {
      this.list.innerHTML = `<div style="padding:12px;display:flex;flex-direction:column;gap:8px">
        <button id="bf-sample">＋ Sampler depuis un fichier…</button>
        <button id="bf-open">Ouvrir un projet…</button>
        <button id="bf-projects">Dossier des projets</button>
        <button id="bf-exports">Dossier des exports (WAV)</button>
        <div class="br-hint" style="padding:4px 0">Projets : Documents\\IrisStudio<br>Exports : Musique\\IrisStudio</div></div>`;
      this.list.querySelector('#bf-sample').onclick = async () => { const f = await invoke('sample_pick'); if (f?.length) this.app.addSamples(f); };
      this.list.querySelector('#bf-open').onclick = () => this.app.openProject();
      this.list.querySelector('#bf-projects').onclick = () => invoke('open_folder', { kind: 'projects' });
      this.list.querySelector('#bf-exports').onclick = () => invoke('open_folder', { kind: 'exports' });
    }
  }

  async addPreset(id) {
    const app = this.app;
    if (id === 'sampler') {
      const f = await invoke('sample_pick');
      if (f?.length) app.addSamples(f);
      return;
    }
    let ch;
    app.store.change((p) => { ch = addChannel(p, id); });
    app.select(ch.id);
    app.preview(ch.id, 60, 350);
    app.mark('channel.add');
    app.mark('channel.add.' + id);
    if (app.view !== 'rack' && app.view !== 'piano') app.show('rack');
  }
}
