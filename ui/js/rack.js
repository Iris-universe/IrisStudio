// Séquenceur pas à pas (équivalent du « Channel Rack » de FL Studio).
import { STEP, notesOf } from './project.js';
import { knob, esc } from './widgets.js';
import { PRESETS } from './instruments.js';

export const isGridChannel = (pat, ch) => (pat.notes[ch.id] || []).every((n) => n.t % STEP === 0 && n.key === (ch.stepKey ?? 60));

export class Rack {
  constructor(app, el) {
    this.app = app; this.el = el;
    this.cols = [];
    this.curStep = -1;
    el.innerHTML = `<div class="rack-head"><span class="title" id="rack-title"></span>
      <button id="rack-add" data-ctl="add-channel">＋ Instrument</button>
      <button id="rack-clear" title="Efface toutes les notes de ce motif">Vider le motif</button>
      <span class="hint">Clic = allumer un pas · clic droit = l'éteindre · glisser = plusieurs pas · molette sur un pas = force (vélocité)</span></div>
      <div class="rack-body"></div>`;
    this.body = el.querySelector('.rack-body');
    el.querySelector('#rack-add').onclick = (e) => this.addMenu(e.clientX, e.clientY + 10);
    el.querySelector('#rack-clear').onclick = async () => {
      if (await app.confirm('Effacer toutes les notes du motif « ' + esc(app.curPat().name) + ' » ?', 'Effacer')) app.store.change(() => (app.curPat().notes = {}));
    };
    window.addEventListener('pointerup', () => (this.paint = null));
  }

  addMenu(x, y) {
    const items = [];
    let cat = '';
    for (const p of PRESETS) {
      if (p.cat !== cat) { cat = p.cat; items.push({ head: cat }); }
      items.push({ label: p.name, fn: () => this.app.browser.addPreset(p.id) });
    }
    this.app.menu(x, y, items);
  }

  render() {
    const app = this.app, p = app.p, pat = app.curPat();
    this.el.querySelector('#rack-title').textContent = `Séquenceur — ${pat.name}`;
    this.body.innerHTML = '';
    this.cols = Array.from({ length: pat.len }, () => []);
    this.acts = [];
    if (!p.channels.length) {
      this.body.innerHTML = '<div class="rack-empty">Aucun instrument. Clique sur « ＋ Instrument » ou choisis un son dans le navigateur à gauche.</div>';
    }
    p.channels.forEach((ch, ci) => this.body.appendChild(this.row(ch, ci, pat)));
    const add = document.createElement('button');
    add.className = 'rack-add'; add.textContent = '＋ Ajouter un instrument';
    add.onclick = (e) => this.addMenu(e.clientX, e.clientY);
    this.body.appendChild(add);
    this.curStep = -1;
    this.markSel();
  }

  row(ch, ci, pat) {
    const app = this.app;
    const r = document.createElement('div');
    r.className = 'rrow' + (ch.mute ? ' muted' : '');
    r.dataset.ch = ch.id;
    r.style.setProperty('--c', ch.color || '#888');
    const led = document.createElement('div');
    led.className = 'led'; led.title = 'Couper / remettre le son de ce canal'; led.dataset.ctl = 'mute';
    led.onclick = () => app.store.change(() => (ch.mute = !ch.mute));
    r.appendChild(led);
    const vol = knob({ label: 'Volume', min: 0, max: 1, def: 0.78, help: 'Volume du canal' }, () => ch.vol, (v) => { app.tweak('chvol' + ch.id, () => (ch.vol = v)); app.refreshKnobs(vol); }, { small: true, ctl: 'ch-vol' });
    const pan = knob({ label: 'Pan', min: -1, max: 1, def: 0, help: 'Panoramique : gauche / droite' }, () => ch.pan, (v) => { app.tweak('chpan' + ch.id, () => (ch.pan = v)); app.refreshKnobs(pan); }, { small: true, ctl: 'ch-pan' });
    vol.classList.add('rk'); pan.classList.add('rk');
    r.append(vol, pan);
    const ins = document.createElement('button');
    ins.className = 'ins'; ins.dataset.ctl = 'ch-ins';
    ins.textContent = ch.ins ? String(ch.ins) : 'M';
    ins.title = `Piste du mixeur : ${ch.ins ? ch.ins + ' (' + app.p.mixer[ch.ins].name + ')' : 'directement au master'}. Clic pour changer.`;
    ins.onclick = (e) => this.insMenu(ch, e.clientX, e.clientY);
    r.appendChild(ins);
    const name = document.createElement('button');
    name.className = 'name'; name.dataset.ctl = 'ch-name';
    name.innerHTML = `${esc(ch.name)}<span class="act"></span>`;
    name.title = 'Clic : sélectionner (réglages à droite) · double-clic : piano roll · clic droit : menu';
    name.onclick = () => { app.select(ch.id); app.preview(ch.id, ch.stepKey ?? 60, 200); };
    name.ondblclick = () => { app.select(ch.id); app.show('piano'); };
    name.oncontextmenu = (e) => { e.preventDefault(); this.chMenu(ch, ci, e.clientX, e.clientY); };
    r.appendChild(name);
    this.acts[ci] = name.querySelector('.act');

    if (isGridChannel(pat, ch)) r.appendChild(this.steps(ch, pat));
    else r.appendChild(this.miniRoll(ch, pat));
    return r;
  }

  steps(ch, pat) {
    const app = this.app;
    const wrap = document.createElement('div');
    wrap.className = 'steps';
    const notes = pat.notes[ch.id] || [];
    const byStep = new Map(notes.map((n) => [n.t / STEP, n]));
    for (let g = 0; g < pat.len / 4; g++) {
      const grp = document.createElement('div');
      grp.className = 'grp' + (g % 2 ? ' alt' : '');
      for (let k = 0; k < 4; k++) {
        const s = g * 4 + k;
        const b = document.createElement('button');
        b.className = 'step';
        b.dataset.s = s;
        b.dataset.ctl = `step:${s + 1}`;
        const n = byStep.get(s);
        if (n) { b.classList.add('on'); b.style.opacity = String(0.45 + 0.55 * (n.vel ?? 0.8)); }
        b.title = `Pas ${s + 1} (temps ${Math.floor(s / 4) + 1}, ${['1', 'e', '&', 'a'][s % 4]})`;
        b.onpointerdown = (e) => {
          e.preventDefault();
          const on = e.button === 2 ? false : !byStep.has(s);
          this.paint = { ch, on, done: new Set() };
          this.setStep(ch, pat, s, on, true);
        };
        b.onpointerenter = () => { if (this.paint && this.paint.ch === ch) this.setStep(ch, pat, s, this.paint.on, false); };
        b.onwheel = (e) => {
          const nn = (pat.notes[ch.id] || []).find((x) => x.t === s * STEP);
          if (!nn) return;
          e.preventDefault();
          app.tweak('vel' + ch.id + ':' + s, () => (nn.vel = Math.max(0.05, Math.min(1, (nn.vel ?? 0.8) + (e.deltaY < 0 ? 0.05 : -0.05)))));
          b.style.opacity = String(0.45 + 0.55 * nn.vel);
          app.toast(`Vélocité : ${Math.round(nn.vel * 100)} %`, 900);
        };
        b.oncontextmenu = (e) => e.preventDefault();
        this.cols[s]?.push(b);
        grp.appendChild(b);
      }
      wrap.appendChild(grp);
    }
    return wrap;
  }

  setStep(ch, pat, s, on, first) {
    const app = this.app;
    const list = notesOf(pat, ch.id);
    const has = list.some((n) => n.t === s * STEP);
    if (has === on) return;
    app.store.change((p) => {
      const l = notesOf(app.curPat(), ch.id);
      if (on) l.push({ t: s * STEP, len: STEP, key: ch.stepKey ?? 60, vel: 0.8 });
      else app.curPat().notes[ch.id] = l.filter((n) => n.t !== s * STEP);
    }, { merge: first ? null : 'paint', quiet: true });
    this.app.store.lastMerge = 'paint';
    // mise à jour locale (sans tout reconstruire pendant qu'on glisse)
    const row = this.body.querySelector(`.rrow[data-ch="${ch.id}"] .step[data-s="${s}"]`);
    if (row) { row.classList.toggle('on', on); row.style.opacity = on ? '1' : ''; }
    if (on && !app.snap.playing) app.preview(ch.id, ch.stepKey ?? 60, 150);
    app.mark('step');
    app.renderBar();
    app.updateTitle();
    if (app.view === 'piano') app.piano.draw();
  }

  miniRoll(ch, pat) {
    const c = document.createElement('canvas');
    c.className = 'mini-roll';
    const w = pat.len * 24 + Math.floor(pat.len / 4) * 5;
    c.width = w; c.height = 28; c.style.width = w + 'px';
    c.title = 'Ce canal joue des notes du piano roll (mélodie). Clic pour l\'ouvrir.';
    c.dataset.ctl = 'mini-roll';
    const g = c.getContext('2d');
    const notes = pat.notes[ch.id] || [];
    const keys = notes.map((n) => n.key);
    const lo = Math.min(...keys, 60) - 1, hi = Math.max(...keys, 60) + 1;
    const len = pat.len * STEP;
    g.fillStyle = ch.color || '#888';
    for (const n of notes) {
      const x = (n.t / len) * w, y = 26 - ((n.key - lo) / Math.max(1, hi - lo)) * 24;
      g.fillRect(x, y - 2, Math.max(2, (n.len / len) * w - 1), 3);
    }
    c.onclick = () => { this.app.select(ch.id); this.app.show('piano'); };
    return c;
  }

  insMenu(ch, x, y) {
    const app = this.app;
    const items = app.p.mixer.map((m, i) => ({ label: `${i === 0 ? 'Master (direct)' : i + ' · ' + m.name}${ch.ins === i ? '  ✓' : ''}`, fn: () => { app.store.change(() => (ch.ins = i)); app.mark('route'); } }));
    app.menu(x, y, [{ head: 'Envoyer vers la piste du mixeur' }, ...items]);
  }

  chMenu(ch, ci, x, y) {
    const app = this.app;
    app.menu(x, y, [
      { label: 'Ouvrir le piano roll', fn: () => { app.select(ch.id); app.show('piano'); } },
      { label: 'Renommer…', fn: async () => { const n = await app.prompt('Nom du canal', ch.name); if (n) app.store.change(() => (ch.name = n)); } },
      { label: 'Dupliquer', fn: () => app.store.change((p) => {
        const c = JSON.parse(JSON.stringify(ch));
        c.id = Math.max(p.nextId, ...p.channels.map((x) => x.id + 1)); p.nextId = c.id + 1; c.name += ' 2';
        p.channels.splice(ci + 1, 0, c);
      }) },
      '-',
      { label: 'Monter', fn: () => ci > 0 && app.store.change((p) => p.channels.splice(ci - 1, 0, p.channels.splice(ci, 1)[0])) },
      { label: 'Descendre', fn: () => app.store.change((p) => { if (ci < p.channels.length - 1) p.channels.splice(ci + 1, 0, p.channels.splice(ci, 1)[0]); }) },
      { label: 'Effacer ses notes (ce motif)', fn: () => app.store.change(() => delete app.curPat().notes[ch.id]) },
      '-',
      { label: 'Supprimer le canal', fn: async () => {
        if (!(await app.confirm(`Supprimer « ${esc(ch.name)} » et toutes ses notes ?`, 'Supprimer'))) return;
        app.store.change((p) => { p.channels = p.channels.filter((c) => c.id !== ch.id); for (const x of p.patterns) delete x.notes[ch.id]; });
      } },
    ]);
  }

  markSel() {
    this.body.querySelectorAll('.rrow').forEach((r) => r.classList.toggle('sel', Number(r.dataset.ch) === this.app.sel));
  }

  tick(s) {
    const pat = this.app.curPat();
    const step = s.playing && !s.song ? Math.floor(s.pos / STEP) % pat.len : -1;
    if (step !== this.curStep) {
      this.cols[this.curStep]?.forEach((b) => b.classList.remove('cur'));
      this.cols[step]?.forEach((b) => b.classList.add('cur'));
      this.curStep = step;
    }
    // voyant d'activité de chaque canal
    this.acts?.forEach((a, i) => {
      const db = s.ch[i] ?? -120;
      const v = Math.max(0, Math.min(1, (db + 40) / 40));
      a.style.background = v > 0.02 ? `rgba(43,214,123,${v})` : 'transparent';
    });
  }
}
