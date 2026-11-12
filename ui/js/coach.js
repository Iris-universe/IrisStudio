// Coach : surveille le projet et le son, et prévient des erreurs classiques de débutant.
export class Coach {
  constructor(app) {
    this.app = app; this.enabled = true;
    this.el = document.getElementById('coach'); this.txt = document.getElementById('coach-text');
    this.override = null; this.current = []; this.since = {};
    const btn = document.getElementById('btn-coach');
    try { this.enabled = localStorage.getItem('coach') !== 'off'; } catch {}
    btn.classList.toggle('on', this.enabled);
    btn.onclick = () => { this.enabled = !this.enabled; btn.classList.toggle('on', this.enabled); try { localStorage.setItem('coach', this.enabled ? 'on' : 'off'); } catch {} if (!this.enabled) this.show('Coach désactivé.', ''); };
    setInterval(() => this.tick(), 300);
  }

  say(text, level = '', ms = 5000) { this.override = { text, level, until: performance.now() + ms }; this.show(text, level); }
  show(text, level) { if (this.txt.textContent !== text) this.txt.textContent = text; this.el.className = level || ''; this.el.title = text; }
  lasting(key, cond, ms) { const now = performance.now(); if (!cond) { delete this.since[key]; return false; } this.since[key] ||= now; return now - this.since[key] >= ms; }

  rules() {
    const app = this.app, p = app.p, s = app.snap, out = [];
    const ins = s.ins || [];
    if (this.lasting('mclip', s.playing && (ins[0] ?? -120) > -0.1, 300))
      out.push(['bad', `Le master sature (${(ins[0]).toFixed(1)} dB avant le limiteur) : baisse le fader master ou les pistes les plus fortes. Vise des crêtes vers −6 / −3 dB.`]);
    for (let i = 1; i < ins.length; i++) {
      if (this.lasting('clip' + i, s.playing && ins[i] > 0.5, 500)) { out.push(['bad', `Piste ${i} (${p.mixer[i].name}) dans le rouge : baisse son fader ou le volume de l'instrument.`]); break; }
    }
    if (app.songMode && !p.playlist.clips.length && this.lasting('emptypl', s.playing, 600))
      out.push(['warn', 'Mode MORCEAU mais la playlist est vide : rien ne joue. Repasse en MOTIF, ou place des motifs dans la playlist (F5).']);
    const hasNotes = p.patterns.some((x) => Object.values(x.notes).some((l) => l.length));
    if (this.lasting('silent', s.playing && (ins[0] ?? -120) < -70 && hasNotes && !app.songMode, 2500))
      out.push(['warn', 'On n\'entend rien : vérifie que le motif sélectionné contient des notes, les mutes (voyants verts), et les volumes.']);
    // reverb sur le kick
    for (const c of p.channels) {
      if (c.type === 'kick' && c.ins > 0 && p.mixer[c.ins].fx.some((f) => f.type === 'reverb' && f.on && f.p[2] > 0.1)) { out.push(['warn', `Reverb sur la piste du kick « ${c.name} » : le grave devient flou. Garde le kick sec (mets la reverb sur les claps, leads, nappes).`]); break; }
    }
    // plusieurs instruments sur la même piste alors que le master les reçoit directement
    const direct = p.channels.filter((c) => c.ins === 0).length;
    if (direct >= 3 && this.lasting('direct', true, 4000)) out.push(['warn', `${direct} instruments vont directement au master : envoie chacun sur sa piste du mixeur (bouton à gauche du nom) pour pouvoir régler ses effets.`]);
    const kick = p.channels.find((c) => c.type === 'kick' && /hardcore|uptempo|gabber/.test(c.preset || ''));
    if (kick && p.bpm < 140 && this.lasting('bpmhc', true, 3000)) out.push(['warn', `Kick « ${kick.name} » à ${p.bpm} BPM : le hardcore se joue plutôt entre 160 et 200 BPM, l'uptempo au-delà de 200.`]);
    return out;
  }

  tick() {
    const now = performance.now();
    if (this.override && now < this.override.until) return;
    this.override = null;
    if (!this.enabled) return;
    const r = this.rules();
    this.current = r;
    if (r.length) { this.show(r[0][1], r[0][0]); return; }
    const app = this.app, p = app.p;
    const tip = !p.channels.length ? 'Ajoute un instrument (navigateur à gauche) ou ouvre « Apprendre » pour suivre les cours.'
      : !app.snap.playing ? 'Prêt. Espace = lecture. Clique sur les pas du séquenceur pour écrire un rythme.'
      : 'Tout est propre. ✓';
    this.show(tip, app.snap.playing ? 'good' : '');
  }

  messages() { return (this.current || []).map(([level, text]) => ({ niveau: level === 'bad' ? 'erreur' : 'attention', texte: text })); }
}
