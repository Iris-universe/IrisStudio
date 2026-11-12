// API de pilotage par l'assistant d'Orbiz (via iris-link). Chaque fonction reçoit un objet d'arguments
// et renvoie un objet sérialisable. Les outils sont déclarés dans src/irislink.rs.
import { addChannel, addPattern, addFx, setSteps, notesOf, STEP, BAR, N_INS, N_TRACKS } from './project.js';
import { PRESETS, PARAMS, FX, defaults, presetById, parseNote, noteName, TYPE_LABEL } from './instruments.js';
import { DEMOS } from './demos.js';

export function installAgent(app) {
  const r2 = (v) => Math.round(v * 100) / 100;
  const findCh = (v) => {
    if (v == null) return app.selChannel();
    const s = String(v).toLowerCase();
    return app.p.channels.find((c) => String(c.id) === s) || app.p.channels.find((c) => c.name.toLowerCase() === s) || app.p.channels.find((c) => c.name.toLowerCase().includes(s));
  };
  const findPat = (v) => {
    if (v == null) return app.curPat();
    const s = String(v).toLowerCase();
    return app.p.patterns.find((x) => String(x.id) === s) || app.p.patterns.find((x) => x.name.toLowerCase() === s) || app.p.patterns.find((x) => x.name.toLowerCase().includes(s));
  };
  const chSummary = (c) => {
    const spec = PARAMS[c.type] || [];
    const main = {};
    for (const s of spec) if (s.id && c.params[s.id] !== s.def) main[s.id] = s.choices ? s.choices[c.params[s.id]] : r2(c.params[s.id]);
    return { id: c.id, nom: c.name, type: TYPE_LABEL[c.type], prereglage: c.preset || null, volume: r2(c.vol), pan: r2(c.pan), muet: !!c.mute, piste_mixeur: c.ins, sample: c.sample || undefined, reglages_modifies: main };
  };
  const fxOut = (f) => { const spec = FX[f.type]; const o = { type: f.type, nom: spec?.label, actif: f.on }; for (const s of spec?.params || []) o[s.id] = s.choices ? s.choices[f.p[s.idx]] : r2(f.p[s.idx]); return o; };

  const api = {
    get_state() {
      const p = app.p;
      return {
        projet: p.name, fichier: app.store.path, modifie: app.store.dirty, tempo_bpm: p.bpm, swing: p.swing, metronome: p.metronome,
        lecture: { en_cours: app.snap.playing, mode: app.songMode ? 'morceau (playlist)' : 'motif', position: `mesure ${Math.floor(app.snap.pos / BAR) + 1}` },
        vue: app.view, motif_selectionne: app.curPat().name, canal_selectionne: app.selChannel()?.name || null,
        canaux: p.channels.map(chSummary),
        motifs: p.patterns.map((x) => ({ id: x.id, nom: x.name, longueur_pas: x.len, notes: Object.fromEntries(Object.entries(x.notes).filter(([, l]) => l.length).map(([cid, l]) => {
          const c = p.channels.find((k) => String(k.id) === cid);
          const grid = l.every((n) => n.t % STEP === 0 && n.key === 60);
          return [c?.name || cid, grid ? 'pas ' + l.map((n) => n.t / STEP + 1).sort((a, b) => a - b).join(',') : l.slice(0, 64).map((n) => `${noteName(n.key)}@${r2(n.t / STEP)}+${r2(n.len / STEP)}`).join(' ')];
        })) })),
        playlist: p.playlist.clips.map((c) => ({ motif: p.patterns.find((x) => x.id === c.pat)?.name, piste: c.track + 1, mesure: c.start / BAR + 1, mesures: r2(c.len / BAR) })),
        mixeur: p.mixer.map((m, i) => ({ piste: i, nom: m.name, volume: r2(m.vol), pan: r2(m.pan), muet: m.mute || undefined, solo: m.solo || undefined, effets: m.fx.map(fxOut), niveau_db: r2(app.snap.ins?.[i] ?? -120) })).filter((m, i) => i === 0 || m.effets.length || app.p.channels.some((c) => c.ins === i)),
        coach: app.coach.messages(),
        cours: app.learn.state(),
        aide: 'Positions en pas (1 pas = double-croche, 16 pas = 1 mesure). Notes : C5 = 60 (convention FL Studio).',
      };
    },
    get_project() { return app.p; },
    list_instruments() {
      return {
        prereglages: PRESETS.map((p) => ({ id: p.id, categorie: p.cat, nom: p.name, type: p.type, description: p.desc })),
        parametres: Object.fromEntries(Object.entries(PARAMS).map(([t, list]) => [t, list.filter((s) => s.id).map((s) => ({ id: s.id, nom: s.label, plage: s.choices ? s.choices.map((c, i) => `${i}=${c}`) : [s.min, s.max], unite: s.unit, defaut: s.def, role: s.help }))])),
        effets: Object.fromEntries(Object.entries(FX).map(([k, v]) => [k, { nom: v.label, role: v.help, parametres: v.params.map((s) => ({ id: s.id, nom: s.label, plage: s.choices ? s.choices.map((c, i) => `${i}=${c}`) : [s.min, s.max], unite: s.unit, defaut: s.def })) }])),
      };
    },
    add_channel({ preset, name, ins }) {
      if (!presetById(preset)) return { error: `Préréglage inconnu : ${preset}. Voir list_instruments.` };
      let ch;
      app.store.change((p) => { ch = addChannel(p, preset, { name, ins }); });
      app.select(ch.id);
      return { ok: true, canal: chSummary(ch) };
    },
    set_channel({ channel, name, vol, pan, ins, mute, params, preset }) {
      const ch = findCh(channel); if (!ch) return { error: 'Canal introuvable.' };
      const errs = [];
      app.store.change(() => {
        if (preset) { const pr = presetById(preset); if (pr && pr.type === ch.type) { ch.params = { ...defaults(ch.type), ...pr.params }; ch.preset = pr.id; ch.color = pr.color; } else errs.push('préréglage inconnu ou d\'un autre type'); }
        if (name) ch.name = name;
        if (vol != null) ch.vol = Math.max(0, Math.min(1, Number(vol)));
        if (pan != null) ch.pan = Math.max(-1, Math.min(1, Number(pan)));
        if (ins != null) ch.ins = Math.max(0, Math.min(N_INS - 1, Math.round(Number(ins))));
        if (mute != null) ch.mute = !!mute;
        for (const [k, v] of Object.entries(params || {})) {
          const s = PARAMS[ch.type].find((x) => x.id === k);
          if (!s) { errs.push(`paramètre inconnu : ${k}`); continue; }
          let n = v;
          if (s.choices && typeof v === 'string') n = s.choices.findIndex((c) => c.toLowerCase() === v.toLowerCase());
          n = Number(n);
          if (!isFinite(n) || n < 0 && s.choices) { errs.push(`valeur invalide pour ${k}`); continue; }
          ch.params[k] = s.choices ? Math.round(n) : Math.max(s.min, Math.min(s.max, n));
        }
      });
      app.select(ch.id);
      return { ok: !errs.length, erreurs: errs.length ? errs : undefined, canal: chSummary(ch) };
    },
    remove_channel({ channel }) {
      const ch = findCh(channel); if (!ch) return { error: 'Canal introuvable.' };
      app.store.change((p) => { p.channels = p.channels.filter((c) => c !== ch); for (const x of p.patterns) delete x.notes[ch.id]; });
      return { ok: true };
    },
    set_steps({ channel, steps, pattern, key, vel }) {
      const ch = findCh(channel); if (!ch) return { error: 'Canal introuvable.' };
      const pat = findPat(pattern); if (!pat) return { error: 'Motif introuvable.' };
      let list;
      if (typeof steps === 'string') list = [...steps.replace(/[\s|]/g, '')].map((c, i) => (/[xX1o]/.test(c) ? i : -1)).filter((i) => i >= 0);
      else list = (steps || []).map((s) => Number(s) - 1);
      app.store.change(() => setSteps(pat, ch.id, list, key != null ? parseNote(key) : (ch.stepKey ?? 60), vel ?? 0.8));
      if (pat.id !== app.pat) app.setPattern(pat.id);
      return { ok: true, motif: pat.name, pas: list.filter((s) => s < pat.len).map((s) => s + 1) };
    },
    add_notes({ channel, notes, pattern, replace }) {
      const ch = findCh(channel); if (!ch) return { error: 'Canal introuvable.' };
      const pat = findPat(pattern); if (!pat) return { error: 'Motif introuvable.' };
      const list = (notes || []).map((n) => ({ t: Math.max(0, Math.round(Number(n.step ?? n.t ?? 0) * STEP)), len: Math.max(1, Math.round(Number(n.len ?? 1) * STEP)), key: parseNote(n.key ?? n.note ?? 60), vel: Math.max(0.05, Math.min(1, Number(n.vel ?? 0.8))) }));
      const maxEnd = Math.max(0, ...list.map((n) => n.t + 1));
      app.store.change(() => {
        if (replace) pat.notes[ch.id] = [];
        notesOf(pat, ch.id).push(...list);
        while (pat.len * STEP < maxEnd && pat.len < 256) pat.len *= 2;
      });
      if (pat.id !== app.pat) app.setPattern(pat.id);
      app.select(ch.id);
      return { ok: true, motif: pat.name, longueur_pas: pat.len, notes_du_canal: (pat.notes[ch.id] || []).length };
    },
    clear_notes({ pattern, channel }) {
      const pat = findPat(pattern); if (!pat) return { error: 'Motif introuvable.' };
      const ch = channel != null ? findCh(channel) : null;
      app.store.change(() => { if (ch) delete pat.notes[ch.id]; else pat.notes = {}; });
      return { ok: true };
    },
    pattern({ action, pattern, name, len }) {
      const pat = findPat(pattern);
      switch (action) {
        case 'new': { let id; app.store.change((p) => { id = addPattern(p, name, len || 16).id; }); app.setPattern(id); return { ok: true, id, nom: app.curPat().name }; }
        case 'select': if (!pat) return { error: 'Motif introuvable.' }; app.setPattern(pat.id); return { ok: true };
        case 'rename': if (!pat || !name) return { error: 'motif et name requis' }; app.store.change(() => (pat.name = name)); return { ok: true };
        case 'clone': if (!pat) return { error: 'Motif introuvable.' }; { let id; app.store.change((p) => { const n = addPattern(p, name || pat.name + ' (copie)', pat.len); n.notes = JSON.parse(JSON.stringify(pat.notes)); id = n.id; }); app.setPattern(id); return { ok: true, id }; }
        case 'length': if (!pat || !len) return { error: 'motif et len requis' }; app.store.change(() => (pat.len = Math.max(4, Math.min(256, Math.round(len))))); return { ok: true };
        case 'delete':
          if (!pat) return { error: 'Motif introuvable.' };
          if (app.p.patterns.length < 2) return { error: 'Il faut garder au moins un motif.' };
          app.store.change((p) => { p.patterns = p.patterns.filter((x) => x !== pat); p.playlist.clips = p.playlist.clips.filter((c) => c.pat !== pat.id); });
          return { ok: true };
        default: return { error: 'action : new, select, rename, clone, length, delete' };
      }
    },
    playlist({ action, pattern, track, bar, bars }) {
      const tr = Math.max(0, Math.min(N_TRACKS - 1, Math.round(Number(track ?? 1)) - 1));
      if (action === 'clear') { app.store.change((p) => (p.playlist.clips = [])); return { ok: true }; }
      if (action === 'remove') {
        const t = (Math.max(1, Number(bar ?? 1)) - 1) * BAR;
        let n = 0;
        app.store.change((p) => { const before = p.playlist.clips.length; p.playlist.clips = p.playlist.clips.filter((c) => !(c.track === tr && t >= c.start && t < c.start + c.len)); n = before - p.playlist.clips.length; });
        return { ok: true, retires: n };
      }
      if (action === 'add') {
        const pat = findPat(pattern); if (!pat) return { error: 'Motif introuvable.' };
        const clip = { pat: pat.id, track: tr, start: (Math.max(1, Math.round(Number(bar ?? 1))) - 1) * BAR, len: bars ? Math.max(0.25, Number(bars)) * BAR : pat.len * STEP };
        app.store.change((p) => p.playlist.clips.push(clip));
        return { ok: true, clip: { motif: pat.name, piste: tr + 1, mesure: clip.start / BAR + 1, mesures: clip.len / BAR } };
      }
      return { error: 'action : add, remove, clear' };
    },
    mixer({ insert, name, vol, pan, mute, solo, add_fx, set_fx, remove_fx }) {
      const i = Math.round(Number(insert));
      const m = app.p.mixer[i]; if (!m) return { error: 'Piste 0 (master) à 12.' };
      const errs = [];
      app.store.change((p) => {
        if (name) m.name = name;
        if (vol != null) m.vol = Math.max(0, Math.min(1, Number(vol)));
        if (pan != null) m.pan = Math.max(-1, Math.min(1, Number(pan)));
        if (mute != null) m.mute = !!mute;
        if (solo != null && i > 0) m.solo = !!solo;
        if (add_fx) { if (FX[add_fx]) addFx(p, i, add_fx); else errs.push(`effet inconnu : ${add_fx}`); }
        if (set_fx) {
          const f = m.fx[Number(set_fx.index ?? 0)];
          if (!f) errs.push('effet introuvable (index à partir de 0)');
          else {
            if (set_fx.on != null) f.on = !!set_fx.on;
            for (const [k, v] of Object.entries(set_fx.params || {})) {
              const s = FX[f.type].params.find((x) => x.id === k);
              if (!s) { errs.push(`paramètre inconnu pour ${f.type} : ${k}`); continue; }
              let n = v; if (s.choices && typeof v === 'string') n = s.choices.findIndex((c) => c.toLowerCase() === v.toLowerCase());
              f.p[s.idx] = s.choices ? Math.round(Number(n)) : Math.max(s.min, Math.min(s.max, Number(n)));
            }
          }
        }
        if (remove_fx != null) { if (m.fx[remove_fx]) m.fx.splice(remove_fx, 1); else errs.push('effet à retirer introuvable'); }
      });
      app.mixer.selIns = i;
      return { ok: !errs.length, erreurs: errs.length ? errs : undefined, piste: { nom: m.name, volume: r2(m.vol), effets: m.fx.map(fxOut) } };
    },
    transport({ action, mode, bpm, swing, metronome }) {
      if (bpm != null || swing != null || metronome != null) app.store.change((p) => {
        if (bpm != null) p.bpm = Math.max(40, Math.min(300, Number(bpm)));
        if (swing != null) p.swing = Math.max(0, Math.min(1, Number(swing)));
        if (metronome != null) p.metronome = !!metronome;
      });
      if (mode) app.setSongMode(mode === 'song');
      if (action === 'play') app.play(0);
      else if (action === 'stop') app.stop();
      return { ok: true, tempo: app.p.bpm, mode: app.songMode ? 'song' : 'pattern' };
    },
    select({ view, channel }) {
      if (channel != null) { const ch = findCh(channel); if (!ch) return { error: 'Canal introuvable.' }; app.select(ch.id); }
      if (view) { const v = { rack: 'rack', piano: 'piano', playlist: 'playlist', mixer: 'mixer' }[view]; if (!v) return { error: 'view : rack, piano, playlist, mixer' }; app.show(v); }
      return { ok: true };
    },
    async new_project({ template }) {
      if (template && !DEMOS.some((d) => d.id === template)) return { error: 'Démo inconnue (list_demos).' };
      app.store.dirty = false; // l'assistant a été demandé explicitement ; le projet reste dans la sauvegarde automatique
      await app.newProject(template);
      return { ok: true, projet: app.p.name };
    },
    list_demos() { return DEMOS.map((d) => ({ id: d.id, nom: d.name, bpm: d.bpm, description: d.desc })); },
    async export_wav({ mode }) {
      const m = mode === 'pattern' ? 'pattern' : app.p.playlist.clips.length ? 'song' : 'pattern';
      const r = await app.exportWav(m, false);
      return r?.path ? { ok: true, fichier: r.path, duree_s: Math.round(r.dur) } : r || { error: 'Export annulé.' };
    },
    undo() { return { ok: app.store.undo() }; },
    list_lessons() { return app.learn.list(); },
    async start_lesson({ id }) { const ok = await app.learn.start(id); return ok ? { ok: true, cours: app.learn.state() } : { error: 'cours inconnu (list_lessons)' }; },
    show_tip({ text, highlight }) { app.coach.say(text, 'warn', 12000); if (highlight?.length) { app.learn.highlight(highlight); setTimeout(() => app.learn.highlight(), 12000); } return { ok: true }; },
  };

  window.irisAgent = api;
}
