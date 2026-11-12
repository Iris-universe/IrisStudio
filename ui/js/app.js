// IrisStudio : point d'entrée de l'interface. Relie le projet (Store), le moteur Rust et les vues.
import { Store, emptyProject, addChannel, addPattern, normalize, PPQ, BAR, STEP } from './project.js';
import { Rack } from './rack.js';
import { PianoRoll } from './pianoroll.js';
import { Playlist } from './playlist.js';
import { Mixer } from './mixer.js';
import { Inspector } from './inspector.js';
import { Browser } from './browser.js';
import { Coach } from './coach.js';
import { Learn } from './learn.js';
import { installAgent } from './agent.js';
import { DEMOS } from './demos.js';
import { vu, esc } from './widgets.js';

const T = window.__TAURI__;
const invoke = T.core.invoke;
const $ = (s) => document.querySelector(s);

class App {
  constructor() {
    this.store = new Store();
    this.view = 'rack';
    this.sel = null;          // canal sélectionné (id)
    this.pat = 0;             // motif sélectionné (id)
    this.songMode = false;
    this.snap = { playing: false, pos: 0, ins: [], ch: [] };
    this.lastLevels = null;
    this.octave = 5;
    this.events = {};         // journal d'actions (pour les cours)
  }

  get p() { return this.store.p; }
  curPat() { return this.p.patterns.find((x) => x.id === this.pat) || this.p.patterns[0]; }
  selChannel() { return this.p.channels.find((c) => c.id === this.sel) || null; }
  mark(ev) { this.events[ev] = performance.now(); }

  async init() {
    this.rack = new Rack(this, $('#v-rack'));
    this.piano = new PianoRoll(this, $('#v-piano'));
    this.playlist = new Playlist(this, $('#v-playlist'));
    this.mixer = new Mixer(this, $('#v-mixer'));
    this.inspector = new Inspector(this, $('#inspector'));
    this.browser = new Browser(this, $('#browser'));
    this.coach = new Coach(this);
    this.learn = new Learn(this);
    this.setupBar();
    this.setupKeys();
    this.setupDrop();

    this.store.on((what) => this.onStore(what));
    window.studio.onToast((m) => this.toast(m));
    T.event.listen('export-progress', (e) => { const b = document.querySelector('#modal .progress div'); if (b) b.style.width = Math.round(e.payload * 100) + '%'; });

    // projet : sauvegarde automatique, sinon démo de bienvenue
    let restored = false;
    try {
      const a = await invoke('autosave_load');
      if (a?.project?.channels) { this.store.load(a.project, a.path || null); this.store.dirty = !!a.path ? false : true; restored = true; }
    } catch (e) { console.warn(e); }
    if (!restored) this.store.load(DEMOS[0].build());

    const ch = new T.core.Channel();
    ch.onmessage = (s) => this.onSnap(s);
    await invoke('subscribe', { channel: ch });

    installAgent(this);
    this.show('rack');
    window.__app = this;
  }

  // ------------------------------------------------------------ projet -> vues
  onStore(what) {
    if (what === 'errors') { if (this.store.errors.length) this.toast('Sample introuvable ou illisible : ' + this.store.errors[0], 6000); return; }
    if (what === 'load') {
      this.pat = this.p.patterns[0].id;
      this.sel = this.p.channels[0]?.id ?? null;
      this.songMode = this.p.playlist.clips.length > 0 && false;
    }
    if (!this.p.patterns.some((x) => x.id === this.pat)) this.pat = this.p.patterns[0].id;
    if (this.sel != null && !this.p.channels.some((c) => c.id === this.sel)) this.sel = this.p.channels[0]?.id ?? null;
    this.refresh();
    this.updateTitle();
  }

  refresh() {
    this.renderBar();
    this.rack.render();
    if (this.view === 'piano') this.piano.render();
    if (this.view === 'playlist') this.playlist.render();
    if (this.view === 'mixer') this.mixer.render();
    this.inspector.render();
  }
  /** après un réglage continu (potard) : met à jour les autres contrôles affichés sans tout reconstruire */
  refreshKnobs(except) {
    document.querySelectorAll('.knob, .choice, .fader').forEach((k) => { if (k !== except && k.refresh) k.refresh(); });
  }
  /** modification « silencieuse » d'un réglage continu, regroupée dans l'historique */
  tweak(key, fn) {
    this.store.change(fn, { merge: key, quiet: true });
    this.updateTitle();
  }

  updateTitle() {
    const t = `${this.p.name}${this.store.dirty ? ' •' : ''} — IrisStudio`;
    if (t !== this._title) { this._title = t; document.title = t; invoke('set_title', { title: t }); }
  }

  show(view) {
    this.view = view;
    for (const v of ['rack', 'piano', 'playlist', 'mixer']) $('#v-' + v).hidden = v !== view;
    document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.view === view));
    if (view === 'piano') this.piano.render();
    if (view === 'playlist') this.playlist.render();
    if (view === 'mixer') this.mixer.render();
    if (view === 'rack') this.rack.render();
    this.mark('view.' + view);
  }

  select(chId) {
    this.sel = chId;
    this.rack.markSel();
    this.inspector.render();
    if (this.view === 'piano') this.piano.render();
    if (this.view === 'mixer') this.mixer.render();
  }

  setPattern(id) {
    if (!this.p.patterns.some((x) => x.id === id)) return;
    this.pat = id;
    invoke('transport', { action: 'pattern', pat: id });
    this.renderBar();
    this.rack.render();
    if (this.view === 'piano') this.piano.render();
    if (this.view === 'playlist') this.playlist.render();
    this.mark('pattern.select');
  }

  // ------------------------------------------------------------ lecture
  play(from = 0) {
    invoke('transport', { action: 'play', song: this.songMode, pat: this.pat, from });
    this.snap.playing = true;
    this.mark('play');
  }
  stop() { invoke('transport', { action: 'stop' }); this.snap.playing = false; this.mark('stop'); }
  toggle() { if (this.snap.playing) this.stop(); else this.play(); }
  setSongMode(on) {
    this.songMode = on;
    document.querySelectorAll('.mode button').forEach((b) => b.classList.toggle('on', (b.dataset.mode === 'song') === on));
    if (this.snap.playing) this.play(0);
    this.mark(on ? 'mode.song' : 'mode.pat');
  }
  noteOn(ch, key, vel = 0.8) { invoke('note', { ch, key, vel, on: true }); this.mark('preview'); }
  noteOff(ch, key) { invoke('note', { ch, key, on: false }); }
  preview(ch, key, ms = 220, vel = 0.8) { this.noteOn(ch, key, vel); setTimeout(() => this.noteOff(ch, key), ms); }

  onSnap(s) {
    this.snap = s;
    const m = s.ins[0] ?? -120;
    this.lastLevels = { master: m, ins: s.ins, ch: s.ch };
    this.masterVu.forEach((v) => v.push(m));
    $('#t-play').classList.toggle('playing', s.playing);
    $('#t-play').textContent = s.playing ? '❚❚' : '▶';
    const pos = s.pos;
    const bar = Math.floor(pos / BAR) + 1, beat = Math.floor((pos % BAR) / PPQ) + 1, st = Math.floor((pos % PPQ) / STEP) + 1;
    const t = s.playing ? `${bar}.${beat}.${st}` : this._lcd || '1.1.1';
    if (s.playing) this._lcd = t;
    const lcd = $('#t-time'); if (lcd.textContent !== t) lcd.textContent = t;
    this.rack.tick(s);
    if (this.view === 'piano') this.piano.tick(s);
    if (this.view === 'playlist') this.playlist.tick(s);
    if (this.view === 'mixer') this.mixer.tick(s);
    this.inspector.tick?.(s);
  }

  // ------------------------------------------------------------ barre du haut
  setupBar() {
    $('#t-play').onclick = () => this.toggle();
    $('#t-stop').onclick = () => { this.stop(); this._lcd = '1.1.1'; $('#t-time').textContent = '1.1.1'; invoke('transport', { action: 'seek', from: 0 }); };
    document.querySelectorAll('.mode button').forEach((b) => (b.onclick = () => this.setSongMode(b.dataset.mode === 'song')));
    const bpm = $('#bpm');
    bpm.onchange = () => { const v = Math.max(40, Math.min(300, Number(bpm.value) || 140)); this.store.change((p) => (p.bpm = v)); this.mark('bpm'); };
    // glisser sur le tempo
    let drag = null;
    bpm.addEventListener('pointerdown', (e) => { if (document.activeElement === bpm) return; drag = { y: e.clientY, v: this.p.bpm, moved: false }; bpm.setPointerCapture(e.pointerId); });
    bpm.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const d = Math.round((drag.y - e.clientY) / 3);
      if (Math.abs(d) >= 1) drag.moved = true;
      if (drag.moved) { e.preventDefault(); const v = Math.max(40, Math.min(300, drag.v + d)); bpm.value = v; this.tweak('bpm', (p) => (p.bpm = v)); this.mark('bpm'); }
    });
    bpm.addEventListener('pointerup', (e) => { if (drag && !drag.moved) { bpm.focus(); bpm.select(); } else e.preventDefault(); drag = null; });
    bpm.addEventListener('wheel', (e) => { e.preventDefault(); const v = Math.max(40, Math.min(300, this.p.bpm + (e.deltaY < 0 ? 1 : -1))); bpm.value = v; this.tweak('bpm', (p) => (p.bpm = v)); this.mark('bpm'); }, { passive: false });
    const sw = $('#swing');
    sw.oninput = () => { this.tweak('swing', (p) => (p.swing = sw.value / 100)); $('#swing-v').textContent = sw.value + ' %'; this.mark('swing'); };
    $('#t-metro').onclick = () => { this.store.change((p) => (p.metronome = !p.metronome)); };

    $('#pat').onchange = () => this.setPattern(Number($('#pat').value));
    $('#pat-prev').onclick = () => { const i = this.p.patterns.findIndex((x) => x.id === this.pat); if (i > 0) this.setPattern(this.p.patterns[i - 1].id); };
    $('#pat-next').onclick = () => {
      const i = this.p.patterns.findIndex((x) => x.id === this.pat);
      if (i < this.p.patterns.length - 1) this.setPattern(this.p.patterns[i + 1].id);
      else this.newPattern();
    };
    $('#pat-add').onclick = () => this.newPattern();
    $('#pat-clone').onclick = () => this.clonePattern();
    $('#pat-rename').onclick = () => this.renamePattern();
    $('#pat-len').onchange = () => { const len = Number($('#pat-len').value); this.store.change(() => (this.curPat().len = len)); this.mark('pattern.len'); };

    document.querySelectorAll('#tabs button').forEach((b) => (b.onclick = () => this.show(b.dataset.view)));
    this.masterVu = [vu({ w: 6, h: 32 }), vu({ w: 6, h: 32 })];
    $('#master-vu').append(...this.masterVu);

    $('#btn-new').onclick = () => this.newProject();
    $('#btn-open').onclick = () => this.openProject();
    $('#btn-save').onclick = (e) => this.save(e.shiftKey);
    $('#btn-export').onclick = () => this.exportWav();
    $('#btn-undo').onclick = () => this.store.undo();
    $('#btn-redo').onclick = () => this.store.redo();
    $('#btn-keys').onclick = () => this.showKeys();
    $('#btn-audio').onclick = () => this.audioSettings();
  }

  renderBar() {
    const p = this.p;
    const bpm = $('#bpm'); if (document.activeElement !== bpm) bpm.value = Math.round(p.bpm * 100) / 100;
    $('#swing').value = Math.round(p.swing * 100); $('#swing-v').textContent = Math.round(p.swing * 100) + ' %';
    $('#t-metro').classList.toggle('on', !!p.metronome);
    $('#pat').innerHTML = p.patterns.map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join('');
    $('#pat').value = String(this.pat);
    const len = this.curPat().len;
    const sl = $('#pat-len');
    if (![...sl.options].some((o) => Number(o.value) === len)) sl.insertAdjacentHTML('beforeend', `<option value="${len}">${len / 16} mesures</option>`);
    sl.value = String(len);
    document.querySelectorAll('.mode button').forEach((b) => b.classList.toggle('on', (b.dataset.mode === 'song') === this.songMode));
    $('#btn-undo').disabled = !this.store.undoStack.length;
    $('#btn-redo').disabled = !this.store.redoStack.length;
  }

  newPattern() {
    let id;
    this.store.change((p) => { id = addPattern(p, null, this.curPat()?.len || 16).id; });
    this.setPattern(id);
    this.mark('pattern.new');
  }
  clonePattern() {
    const src = this.curPat(); let id;
    this.store.change((p) => { const n = addPattern(p, src.name + ' (copie)', src.len); n.notes = JSON.parse(JSON.stringify(src.notes)); id = n.id; });
    this.setPattern(id);
  }
  async renamePattern() {
    const pat = this.curPat();
    const n = await this.prompt('Renommer le motif', pat.name);
    if (n) this.store.change(() => (pat.name = n));
  }

  // ------------------------------------------------------------ fichiers
  async confirmLoseChanges() {
    if (!this.store.dirty) return true;
    return this.confirm('Le projet actuel a des modifications non enregistrées. Continuer quand même ? (Il reste récupérable dans la sauvegarde automatique jusqu\'à la prochaine modification.)', 'Continuer');
  }
  async newProject(template) {
    if (!(await this.confirmLoseChanges())) return false;
    this.stop();
    const d = template && DEMOS.find((x) => x.id === template);
    const p = d ? d.build() : emptyProject();
    if (!d) { const ch = addChannel(p, 'kick-hardcore'); addChannel(p, 'clap'); addChannel(p, 'hat'); p.bpm = 160; void ch; }
    this.store.load(p);
    invoke('autosave', { project: this.p, path: null });
    this.mark('project.new');
    return true;
  }
  async loadDemo(id) { return this.newProject(id); }
  async openProject() {
    if (!(await this.confirmLoseChanges())) return;
    const r = await invoke('project_open').catch((e) => { this.toast(String(e)); return null; });
    if (!r) return;
    this.stop();
    this.store.load(normalize(r.project), r.path);
    invoke('autosave', { project: this.p, path: r.path });
    this.toast('Projet ouvert : ' + this.p.name);
  }
  async save(as = false) {
    const r = await this.store.save(as).catch((e) => { this.toast('Enregistrement impossible : ' + e); return null; });
    if (r) { this.toast('Enregistré : ' + r); this.updateTitle(); this.mark('save'); }
  }

  async exportWav(modeArg, ask = true) {
    const hasClips = this.p.playlist.clips.length > 0;
    let mode = modeArg;
    if (!mode) {
      mode = await this.choose('Exporter en WAV',
        `<p>Le fichier WAV (24 bits) est enregistré dans <b>Musique\\IrisStudio</b>. Tu peux l'écouter partout, l'envoyer, ou l'importer dans IrisDJ pour le mixer.</p>`,
        [...(hasClips ? [['song', 'Le morceau (playlist)']] : []), ['pattern', 'Le motif « ' + esc(this.curPat().name) + ' » (4 fois)']]);
      if (!mode) return null;
    }
    const song = mode === 'song';
    if (song && !hasClips) { this.toast('La playlist est vide : place d\'abord des motifs dans la playlist.'); return null; }
    this.modalHtml(`<h2>Export en cours…</h2><p>Rendu du ${song ? 'morceau' : 'motif'} en WAV.</p><div class="progress"><div></div></div>`);
    try {
      const r = await invoke('export_wav', { project: this.p, song, pat: this.pat, loops: song ? 1 : 4, name: this.p.name, ask });
      this.closeModal();
      if (r) { this.toast(`Exporté (${Math.round(r.dur)} s) : ${r.path}`, 6000); this.mark('export'); }
      return r;
    } catch (e) { this.closeModal(); this.toast('Export impossible : ' + e, 6000); return { error: String(e) }; }
  }

  async audioSettings() {
    const outs = await invoke('audio_outputs');
    const html = `<h2>Sortie audio</h2><p>Carte son utilisée pour la lecture :</p><select id="ao" style="width:100%"><option value="">Sortie par défaut de Windows</option>${outs.map((o) => `<option>${esc(o)}</option>`).join('')}</select>`;
    const ok = await this.modal(html, [['cancel', 'Annuler'], ['ok', 'Appliquer']]);
    if (ok !== 'ok') return;
    const r = await invoke('audio_set', { master: this._aoValue || '' });
    this.toast(r.ok ? 'Sortie audio changée.' : 'Erreur : ' + r.error);
  }

  showKeys() {
    this.modal(`<h2>Raccourcis clavier</h2>
      <table class="tbl"><tr><td><span class="k">Espace</span></td><td>Lecture / stop</td></tr>
      <tr><td><span class="k">F5</span> <span class="k">F6</span> <span class="k">F7</span> <span class="k">F9</span></td><td>Playlist · Séquenceur · Piano roll · Mixeur (comme FL Studio)</td></tr>
      <tr><td><span class="k">Ctrl+Z</span> / <span class="k">Ctrl+Y</span></td><td>Annuler / rétablir</td></tr>
      <tr><td><span class="k">Ctrl+S</span> · <span class="k">Ctrl+O</span> · <span class="k">Ctrl+N</span></td><td>Enregistrer · ouvrir · nouveau</td></tr>
      <tr><td>Rangée du milieu du clavier (Q S D F G H J K L sur AZERTY)</td><td>Jouer le canal sélectionné comme un piano (Z E T Y U = touches noires)</td></tr>
      <tr><td><span class="k">W</span> / <span class="k">X</span> (AZERTY)</td><td>Octave − / +</td></tr>
      <tr><td><span class="k">↑</span> <span class="k">↓</span></td><td>Canal précédent / suivant</td></tr>
      <tr><td>Clic droit</td><td>Effacer (pas, note, clip)</td></tr>
      <tr><td>Double-clic sur un potard</td><td>Valeur par défaut</td></tr></table>`, [['ok', 'OK']]);
  }

  // ------------------------------------------------------------ clavier
  setupKeys() {
    // positions physiques (marche en AZERTY comme en QWERTY)
    const PIANO = { KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5, KeyT: 6, KeyG: 7, KeyY: 8, KeyH: 9, KeyU: 10, KeyJ: 11, KeyK: 12, KeyO: 13, KeyL: 14, KeyP: 15, Semicolon: 16 };
    const held = new Map();
    window.addEventListener('keydown', (e) => {
      const tag = e.target.tagName;
      const typing = (tag === 'INPUT' && e.target.type !== 'range') || tag === 'TEXTAREA' || tag === 'SELECT';
      if (e.ctrlKey && !e.altKey) {
        const k = e.key.toLowerCase();
        if (k === 'z' && !e.shiftKey) { e.preventDefault(); this.store.undo(); }
        else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); this.store.redo(); }
        else if (k === 's') { e.preventDefault(); this.save(e.shiftKey); }
        else if (k === 'o') { e.preventDefault(); this.openProject(); }
        else if (k === 'n') { e.preventDefault(); this.newProject(); }
        return;
      }
      if (e.key === 'F5' || e.key === 'F6' || e.key === 'F7' || e.key === 'F9') {
        e.preventDefault();
        this.show({ F5: 'playlist', F6: 'rack', F7: 'piano', F9: 'mixer' }[e.key]);
        return;
      }
      if (typing || e.altKey || e.metaKey) return;
      if (e.code === 'Space') { e.preventDefault(); this.toggle(); return; }
      if (e.key === 'Escape') { this.closeMenu(); return; }
      if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
        if (this.view === 'piano') return;
        e.preventDefault();
        const list = this.p.channels; const i = list.findIndex((c) => c.id === this.sel);
        const n = list[Math.max(0, Math.min(list.length - 1, i + (e.code === 'ArrowUp' ? -1 : 1)))];
        if (n) this.select(n.id);
        return;
      }
      if (e.code === 'KeyZ') { this.octave = Math.max(1, this.octave - 1); this.toast(`Octave du clavier : ${this.octave}`); return; }
      if (e.code === 'KeyX') { this.octave = Math.min(8, this.octave + 1); this.toast(`Octave du clavier : ${this.octave}`); return; }
      if (e.code in PIANO && !e.repeat && this.sel != null) {
        const key = this.octave * 12 + PIANO[e.code];
        held.set(e.code, { ch: this.sel, key });
        this.noteOn(this.sel, key);
        this.mark('keyboard');
      }
    });
    window.addEventListener('keyup', (e) => {
      const h = held.get(e.code);
      if (h) { this.noteOff(h.ch, h.key); held.delete(e.code); }
    });
    window.addEventListener('blur', () => { for (const h of held.values()) this.noteOff(h.ch, h.key); held.clear(); });
    document.addEventListener('pointerdown', (e) => { if (!e.target.closest('.ctx')) this.closeMenu(); });
    // un bouton cliqué ne garde pas le focus (sinon Espace le re-cliquerait)
    document.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) b.blur(); });
  }

  setupDrop() {
    const hint = $('#drop-hint');
    T.webviewWindow.getCurrentWebviewWindow().onDragDropEvent(async (ev) => {
      const t = ev.payload.type;
      if (t === 'enter' || t === 'over') hint.hidden = false;
      else if (t === 'leave') hint.hidden = true;
      else if (t === 'drop') {
        hint.hidden = true;
        const files = (ev.payload.paths || []).filter((f) => /\.(wav|mp3|flac|ogg|aiff?|m4a)$/i.test(f));
        if (!files.length) { this.toast('Glisse des fichiers audio (WAV, MP3, FLAC, OGG…).'); return; }
        this.addSamples(files);
      }
    });
  }

  addSamples(files) {
    let last;
    this.store.change((p) => {
      for (const f of files) {
        const name = f.split(/[\\/]/).pop().replace(/\.[^.]+$/, '');
        last = addChannel(p, 'sampler', { name, sample: f }).id;
      }
    });
    if (last != null) this.select(last);
    this.toast(files.length > 1 ? `${files.length} samplers ajoutés.` : 'Sampler ajouté.');
  }

  // ------------------------------------------------------------ petites fenêtres
  toast(msg, ms = 3500) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(this._tt); this._tt = setTimeout(() => t.classList.remove('show'), ms);
  }
  modalHtml(html) { $('#modal-body').innerHTML = html; $('#modal').hidden = false; }
  closeModal() { $('#modal').hidden = true; if (this._modalResolve) { const r = this._modalResolve; this._modalResolve = null; r(null); } }
  modal(html, buttons = [['ok', 'OK']]) {
    return new Promise((resolve) => {
      this._modalResolve = resolve;
      this.modalHtml(html + `<div class="acts">${buttons.map(([v, l], i) => `<button data-v="${v}" class="${i === buttons.length - 1 ? 'primary' : ''}">${l}</button>`).join('')}</div>`);
      const ao = $('#ao'); if (ao) ao.onchange = () => (this._aoValue = ao.value);
      $('#modal-body').querySelectorAll('[data-v]').forEach((b) => (b.onclick = () => {
        const inp = $('#modal-body input[data-prompt]');
        const v = b.dataset.v === 'ok' && inp ? { value: inp.value } : b.dataset.v;
        this._modalResolve = null; $('#modal').hidden = true; resolve(v);
      }));
      const inp = $('#modal-body input[data-prompt]');
      if (inp) { inp.focus(); inp.select(); inp.onkeydown = (e) => { if (e.key === 'Enter') $('#modal-body [data-v="ok"]').click(); if (e.key === 'Escape') this.closeModal(); }; }
    });
  }
  async prompt(title, value = '') {
    const r = await this.modal(`<h2>${esc(title)}</h2><input data-prompt style="width:100%" value="${esc(value)}">`, [['cancel', 'Annuler'], ['ok', 'OK']]);
    return r && typeof r === 'object' ? r.value.trim() : null;
  }
  async confirm(text, ok = 'OK') { return (await this.modal(`<p>${text}</p>`, [['cancel', 'Annuler'], ['ok', ok]])) === 'ok'; }
  async choose(title, html, options) {
    const r = await this.modal(`<h2>${title}</h2>${html}`, [['cancel', 'Annuler'], ...options]);
    return r && r !== 'cancel' ? r : null;
  }

  menu(x, y, items) {
    this.closeMenu();
    const m = document.createElement('div');
    m.className = 'ctx';
    m.style.maxHeight = (innerHeight - 20) + 'px'; m.style.overflowY = 'auto';
    for (const it of items) {
      if (it === '-') { m.appendChild(document.createElement('hr')); continue; }
      if (it.head) { const h = document.createElement('span'); h.className = 'h'; h.textContent = it.head; m.appendChild(h); continue; }
      const d = document.createElement('div');
      d.textContent = it.label;
      d.onclick = () => { this.closeMenu(); it.fn(); };
      m.appendChild(d);
    }
    document.body.appendChild(m);
    const r = m.getBoundingClientRect();
    m.style.left = Math.min(x, innerWidth - r.width - 6) + 'px';
    m.style.top = Math.min(y, innerHeight - r.height - 6) + 'px';
    this._menu = m;
  }
  closeMenu() { this._menu?.remove(); this._menu = null; }
}

const app = new App();
app.init().catch((e) => { console.error(e); document.body.insertAdjacentHTML('beforeend', `<pre style="position:fixed;bottom:0;left:0;color:#f66;background:#000;padding:10px;z-index:999">${esc(e.stack || e)}</pre>`); });
