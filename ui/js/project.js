// Modèle du projet (JSON) + historique (annuler/rétablir) + envoi au moteur Rust + sauvegarde automatique.
import { defaults, presetById, fxDefaults, FX } from './instruments.js';

export const PPQ = 96, STEP = 24, BAR = 384;
export const N_INS = 13;
export const N_TRACKS = 16;
const invoke = (...a) => window.__TAURI__.core.invoke(...a);

export function emptyProject(name = 'Nouveau morceau') {
  return {
    version: 1, name, bpm: 150, swing: 0, metronome: false, nextId: 1,
    channels: [], patterns: [{ id: 0, name: 'Motif 1', len: 16, notes: {} }],
    playlist: { clips: [], tracks: Array.from({ length: N_TRACKS }, (_, i) => ({ name: `Piste ${i + 1}`, mute: false })) },
    mixer: Array.from({ length: N_INS }, (_, i) => ({ name: i ? `Piste ${i}` : 'Master', vol: 0.8, pan: 0, mute: false, solo: false, fx: [] })),
  };
}

export const uid = (p) => {
  const used = new Set([...p.channels.map((c) => c.id), ...p.patterns.map((x) => x.id), ...p.mixer.flatMap((m) => m.fx.map((f) => f.id))]);
  let id = Math.max(p.nextId || 1, 1);
  while (used.has(id)) id++;
  p.nextId = id + 1;
  return id;
};

/** crée un canal depuis un préréglage (sans l'ajouter) */
export function makeChannel(p, presetId, opts = {}) {
  const pr = presetById(presetId) || presetById('kick-hardcore');
  const ch = {
    id: uid(p), name: opts.name || pr.name, type: pr.type, preset: pr.id, color: pr.color,
    params: { ...defaults(pr.type), ...pr.params }, vol: 0.78, pan: 0, mute: false, ins: 0,
  };
  if (pr.type === 'sampler') ch.sample = opts.sample || '';
  // piste du mixeur libre
  if (opts.ins != null) ch.ins = opts.ins;
  else {
    const used = new Set(p.channels.map((c) => c.ins));
    for (let i = 1; i < N_INS; i++) if (!used.has(i)) { ch.ins = i; break; }
  }
  return ch;
}

export function addChannel(p, presetId, opts = {}) {
  const ch = makeChannel(p, presetId, opts);
  p.channels.push(ch);
  if (ch.ins > 0 && /^Piste \d+$/.test(p.mixer[ch.ins].name)) p.mixer[ch.ins].name = ch.name;
  return ch;
}

export function addFx(p, ins, type, params = {}) {
  const fx = { id: uid(p), type, on: true, p: fxDefaults(type) };
  for (const [k, v] of Object.entries(params)) { const s = FX[type].params.find((x) => x.id === k); if (s) fx.p[s.idx] = v; }
  p.mixer[ins].fx.push(fx);
  return fx;
}

export function addPattern(p, name, len = 16) {
  const pat = { id: uid(p), name: name || `Motif ${p.patterns.length + 1}`, len, notes: {} };
  p.patterns.push(pat);
  return pat;
}

export const notesOf = (pat, chId) => (pat.notes[chId] ||= []);

/** pas allumés (0..len-1) d'un canal : notes calées sur la grille */
export function stepsOf(pat, chId) {
  return (pat.notes[chId] || []).filter((n) => n.t % STEP === 0).map((n) => n.t / STEP);
}
export function setSteps(pat, chId, steps, key = 60, vel = 0.8) {
  pat.notes[chId] = steps.filter((s) => s >= 0 && s < pat.len).map((s) => ({ t: s * STEP, len: STEP, key, vel }));
}

// ------------------------------------------------------------ magasin : état + historique + synchronisation
export class Store {
  constructor() {
    this.p = emptyProject();
    this.path = null;
    this.dirty = false;
    this.undoStack = []; this.redoStack = [];
    this.listeners = [];
    this.syncing = false; this.syncAgain = false;
    this.lastSnap = JSON.stringify(this.p);
    this.saveTimer = null;
    this.errors = [];
  }
  on(fn) { this.listeners.push(fn); }
  emit(what) { for (const f of this.listeners) try { f(what); } catch (e) { console.error(e); } }

  /** remplace tout le projet (ouverture, démo…) */
  load(p, path = null) {
    this.p = normalize(p);
    this.path = path;
    this.dirty = false;
    this.undoStack = []; this.redoStack = [];
    this.lastSnap = JSON.stringify(this.p);
    this.sync();
    this.emit('load');
  }

  /** modification avec historique. `merge` : regroupe les réglages continus (potards) en une seule étape */
  change(fn, { merge = null, quiet = false } = {}) {
    const now = performance.now();
    const mergeable = merge && this.lastMerge === merge && now - this.lastMergeT < 1200;
    if (!mergeable) { this.undoStack.push(this.lastSnap); if (this.undoStack.length > 150) this.undoStack.shift(); this.redoStack = []; }
    this.lastMerge = merge; this.lastMergeT = now;
    fn(this.p);
    this.lastSnap = JSON.stringify(this.p);
    this.dirty = true;
    this.sync();
    this.scheduleAutosave();
    if (!quiet) this.emit('change');
  }

  undo() {
    if (!this.undoStack.length) return false;
    this.redoStack.push(this.lastSnap);
    this.lastSnap = this.undoStack.pop();
    this.p = JSON.parse(this.lastSnap);
    this.lastMerge = null; this.dirty = true;
    this.sync(); this.scheduleAutosave(); this.emit('change');
    return true;
  }
  redo() {
    if (!this.redoStack.length) return false;
    this.undoStack.push(this.lastSnap);
    this.lastSnap = this.redoStack.pop();
    this.p = JSON.parse(this.lastSnap);
    this.lastMerge = null; this.dirty = true;
    this.sync(); this.scheduleAutosave(); this.emit('change');
    return true;
  }

  /** envoie le projet au moteur (une seule requête à la fois, la dernière version gagne) */
  async sync() {
    if (this.syncing) { this.syncAgain = true; return; }
    this.syncing = true;
    try {
      do {
        this.syncAgain = false;
        const r = await invoke('set_project', { project: this.p });
        const errs = r?.errors || [];
        if (errs.join() !== this.errors.join()) { this.errors = errs; if (errs.length) this.emit('errors'); }
      } while (this.syncAgain);
    } catch (e) { console.error('set_project', e); }
    this.syncing = false;
  }

  scheduleAutosave() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => invoke('autosave', { project: this.p, path: this.path }), 1500);
  }

  async save(as = false) {
    const r = await invoke('project_save', { project: this.p, path: as ? null : this.path, name: this.p.name });
    if (!r) return null;
    this.path = r; this.dirty = false;
    const base = r.split(/[\\/]/).pop().replace(/\.irisp$/i, '');
    if (base && this.p.name !== base) { this.p.name = base; this.lastSnap = JSON.stringify(this.p); }
    invoke('autosave', { project: this.p, path: this.path });
    this.emit('saved');
    return r;
  }
}

/** complète un projet ancien ou incomplet */
export function normalize(p) {
  const d = emptyProject(p?.name || 'Sans titre');
  const o = { ...d, ...p };
  o.playlist = { ...d.playlist, ...(p.playlist || {}) };
  o.playlist.tracks = Array.from({ length: N_TRACKS }, (_, i) => ({ ...d.playlist.tracks[i], ...(o.playlist.tracks?.[i] || {}) }));
  o.playlist.clips ||= [];
  o.mixer = Array.from({ length: N_INS }, (_, i) => ({ ...d.mixer[i], ...(p.mixer?.[i] || {}), fx: p.mixer?.[i]?.fx || [] }));
  o.channels = (p.channels || []).map((c) => ({ ...c, params: { ...defaults(c.type), ...c.params } }));
  o.patterns = p.patterns?.length ? p.patterns.map((x) => ({ len: 16, notes: {}, ...x })) : d.patterns;
  let mx = 0;
  for (const c of o.channels) mx = Math.max(mx, c.id);
  for (const x of o.patterns) mx = Math.max(mx, x.id);
  for (const m of o.mixer) for (const f of m.fx) mx = Math.max(mx, f.id);
  o.nextId = Math.max(o.nextId || 1, mx + 1);
  return o;
}
