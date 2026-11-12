// Projets de démonstration : un par style, construits ici (rythme, sons, mixage, structure).
import { emptyProject, addChannel, addPattern, addFx, BAR, STEP } from './project.js';
import { parseNote } from './instruments.js';

/** rythme en texte : x = coup, X = accent, o = doux, . = rien (les espaces sont ignorés) */
function steps(pat, ch, str, key = 60) {
  pat.notes[ch.id] = [...str.replace(/\s/g, '')].flatMap((c, i) => (c === '.' ? [] : [{ t: i * STEP, len: STEP, key, vel: c === 'X' ? 1 : c === 'o' ? 0.5 : 0.8 }]));
}
/** notes : [pas, longueur en pas, note, vélocité?] */
function mel(pat, ch, list) {
  pat.notes[ch.id] = (pat.notes[ch.id] || []).concat(list.map(([s, l, k, v]) => ({ t: s * STEP, len: l * STEP, key: parseNote(k), vel: v ?? 0.8 })));
}
function chords(pat, ch, list, bars = 1) {
  // list : accords (tableaux de notes), un par mesure (× bars)
  list.forEach((c, i) => mel(pat, ch, c.map((k) => [i * 16 * bars, 16 * bars, k, 0.7])));
}
function clip(p, pat, track, bar, bars) {
  p.playlist.clips.push({ pat: pat.id, track, start: (bar - 1) * BAR, len: bars * BAR });
}
function base(name, bpm) { const p = emptyProject(name); p.bpm = bpm; p.patterns = []; return p; }
function names(p, list) { list.forEach((n, i) => (p.playlist.tracks[i].name = n)); }

export const DEMOS = [
  {
    id: 'hardcore', name: 'Hardcore 175', bpm: 175, desc: 'Kick hardcore distordu, clap, screech en La mineur, break avec nappe et montée en roulement de kick.',
    build() {
      const p = base('Démo Hardcore', 175);
      const kick = addChannel(p, 'kick-hardcore'), clap = addChannel(p, 'clap-hardcore'), hat = addChannel(p, 'hat'), ohat = addChannel(p, 'ohat');
      const scr = addChannel(p, 'screech'), pad = addChannel(p, 'pad'), crash = addChannel(p, 'crash');
      addFx(p, kick.ins, 'eq', { low: 2, mid: -3, freq: 400, high: 1 }); addFx(p, kick.ins, 'limiter', { ceil: -1, gain: 2 });
      addFx(p, clap.ins, 'reverb', { size: 0.4, mix: 0.15 });
      addFx(p, scr.ins, 'dist', { drive: 14, type: 1, tone: 9000, out: -8 }); addFx(p, scr.ins, 'delay', { time: 3, fb: 0.3, mix: 0.2 }); addFx(p, scr.ins, 'reverb', { size: 0.7, mix: 0.2 });
      addFx(p, pad.ins, 'reverb', { size: 0.85, mix: 0.4 });
      addFx(p, 0, 'limiter', { ceil: -0.3, gain: 2 });
      const beat = addPattern(p, 'Beat', 16), lead = addPattern(p, 'Screech', 32), brk = addPattern(p, 'Break (nappe)', 64), roll = addPattern(p, 'Roulement de kick', 16), cr = addPattern(p, 'Crash', 16);
      steps(beat, kick, 'X...x...x...x...'); steps(beat, clap, '....x.......x...'); steps(beat, hat, '..x...x...x...x.'); steps(beat, ohat, '..............o.');
      mel(lead, scr, [[0, 3, 'A5'], [3, 3, 'A5'], [6, 2, 'C6'], [8, 4, 'A5'], [12, 2, 'G5'], [14, 2, 'E5'], [16, 3, 'F5'], [19, 3, 'F5'], [22, 2, 'A5'], [24, 4, 'G5'], [28, 4, 'E5']]);
      chords(brk, pad, [['A4', 'C5', 'E5'], ['F4', 'A4', 'C5'], ['G4', 'C5', 'E5'], ['G4', 'B4', 'D5']]);
      steps(roll, kick, 'x...x...x.x.xxxx');
      steps(cr, crash, 'x...............');
      clip(p, beat, 0, 1, 8); clip(p, cr, 3, 9, 1); clip(p, beat, 0, 9, 8); clip(p, lead, 1, 9, 8);
      clip(p, brk, 2, 17, 8); clip(p, lead, 1, 21, 4); clip(p, roll, 0, 24, 1);
      clip(p, cr, 3, 25, 1); clip(p, beat, 0, 25, 8); clip(p, lead, 1, 25, 8);
      names(p, ['Kick + percus', 'Screech', 'Nappe', 'Crash']);
      return p;
    },
  },
  {
    id: 'uptempo', name: 'Uptempo 220', bpm: 220, desc: 'Kick uptempo avec une mélodie jouée par la queue du kick (piano roll), percus serrées, lead brut.',
    build() {
      const p = base('Démo Uptempo', 220);
      const kick = addChannel(p, 'kick-uptempo'), clap = addChannel(p, 'clap-hardcore'), hat = addChannel(p, 'hat'), lead = addChannel(p, 'raw-lead'), crash = addChannel(p, 'crash'), zap = addChannel(p, 'zap');
      addFx(p, kick.ins, 'dist', { drive: 8, type: 2, tone: 10000, out: -6, mix: 0.6 }); addFx(p, kick.ins, 'eq', { low: 1, mid: -4, freq: 600, high: 2 }); addFx(p, kick.ins, 'limiter', { ceil: -1 });
      addFx(p, clap.ins, 'dist', { drive: 10, type: 1, out: -8 });
      addFx(p, lead.ins, 'reverb', { size: 0.6, mix: 0.18 }); addFx(p, lead.ins, 'delay', { time: 2, fb: 0.25, mix: 0.15 });
      addFx(p, 0, 'limiter', { ceil: -0.3, gain: 3 });
      const k = addPattern(p, 'Kick mélodie', 32), perc = addPattern(p, 'Percus', 16), ld = addPattern(p, 'Lead', 32), roll = addPattern(p, 'Roulement', 16), fx = addPattern(p, 'Zap + crash', 16);
      // la queue du kick suit une mélodie : chaque kick joue une note différente
      const km = ['C5', 'C5', 'C5', 'D#5', 'C5', 'C5', 'F5', 'D#5'];
      mel(k, kick, km.map((n, i) => [i * 4, 4, n, i % 4 === 0 ? 1 : 0.85]));
      steps(perc, clap, '....x.......x...'); steps(perc, hat, '..x...x...x...x.');
      mel(ld, lead, [[2, 2, 'C6'], [6, 2, 'C6'], [10, 2, 'D#6'], [14, 2, 'D6'], [18, 2, 'C6'], [22, 2, 'G5'], [26, 2, 'A#5'], [30, 2, 'G5']]);
      mel(roll, kick, [0, 4, 8, 10, 12, 13, 14, 15].map((s, i) => [s, s < 12 ? 2 : 1, 'C5', 0.7 + i * 0.04]));
      steps(fx, crash, 'x...............'); mel(fx, zap, [[0, 4, 'C6']]);
      clip(p, k, 0, 1, 8); clip(p, perc, 1, 5, 4); clip(p, fx, 3, 9, 1); clip(p, k, 0, 9, 15); clip(p, perc, 1, 9, 15); clip(p, ld, 2, 9, 16);
      clip(p, roll, 0, 24, 1); clip(p, fx, 3, 25, 1); clip(p, k, 0, 25, 8); clip(p, perc, 1, 25, 8); clip(p, ld, 2, 25, 8);
      names(p, ['Kick', 'Percus', 'Lead', 'FX']);
      return p;
    },
  },
  {
    id: 'hardstyle', name: 'Hardstyle 150', bpm: 150, desc: 'Kick hardstyle, basse « offbeat » entre les kicks, supersaw en mélodie (euphoric).',
    build() {
      const p = base('Démo Hardstyle', 150);
      const kick = addChannel(p, 'kick-hardstyle'), clap = addChannel(p, 'clap'), hat = addChannel(p, 'hat'), bass = addChannel(p, 'bass-offbeat'), saw = addChannel(p, 'supersaw'), crash = addChannel(p, 'crash');
      addFx(p, kick.ins, 'eq', { low: 2, mid: -2, freq: 350 }); addFx(p, kick.ins, 'limiter', { ceil: -1 });
      addFx(p, saw.ins, 'reverb', { size: 0.8, mix: 0.3 }); addFx(p, saw.ins, 'delay', { time: 3, fb: 0.3, mix: 0.18 });
      addFx(p, 0, 'limiter', { ceil: -0.3, gain: 2 });
      const beat = addPattern(p, 'Beat', 16), b = addPattern(p, 'Basse offbeat', 16), lead = addPattern(p, 'Mélodie', 64), cr = addPattern(p, 'Crash', 16);
      steps(beat, kick, 'X...x...x...x...'); steps(beat, clap, '....x.......x...'); steps(beat, hat, '..x...x...x...x.');
      mel(b, bass, [2, 6, 10, 14].map((s) => [s, 2, 'D4']));
      const prog = [['D5', 'F5', 'A5'], ['A#4', 'D5', 'F5'], ['C5', 'E5', 'G5'], ['A4', 'C#5', 'E5']];
      prog.forEach((c, i) => mel(lead, saw, [[i * 16, 6, c[2]], [i * 16 + 6, 4, c[1]], [i * 16 + 10, 6, c[0]]]));
      steps(cr, crash, 'x...............');
      clip(p, beat, 0, 1, 16); clip(p, b, 1, 5, 12); clip(p, lead, 2, 9, 8); clip(p, cr, 3, 9, 1);
      names(p, ['Kick + percus', 'Basse', 'Supersaw', 'Crash']);
      return p;
    },
  },
  {
    id: 'techno', name: 'Techno 132', bpm: 132, desc: 'Kick techno rond, ligne acid avec glissando, charleys ouverts sur les contretemps.',
    build() {
      const p = base('Démo Techno', 132);
      const kick = addChannel(p, 'kick-techno'), clap = addChannel(p, 'clap'), hat = addChannel(p, 'hat'), ohat = addChannel(p, 'ohat'), acid = addChannel(p, 'acid'), perc = addChannel(p, 'perc');
      addFx(p, clap.ins, 'reverb', { size: 0.5, mix: 0.25 }); addFx(p, acid.ins, 'delay', { time: 3, fb: 0.4, mix: 0.25 }); addFx(p, acid.ins, 'dist', { drive: 6, type: 0, out: -4, mix: 0.5 });
      addFx(p, 0, 'comp', { thr: -10, ratio: 2, makeup: 2 });
      const beat = addPattern(p, 'Beat', 16), ac = addPattern(p, 'Acid', 16);
      steps(beat, kick, 'X...x...x...x...'); steps(beat, clap, '....x.......x...'); steps(beat, hat, 'xxx.xxx.xxx.xxx.'); steps(beat, ohat, '..x...x...x...x.'); steps(beat, perc, '...x.....x....x.', 64);
      mel(ac, acid, [[0, 1, 'A3', 1], [2, 1, 'A3'], [3, 1, 'A4', 1], [5, 2, 'G3'], [7, 1, 'A3'], [8, 1, 'C4', 1], [10, 1, 'A3'], [11, 2, 'E4'], [13, 1, 'A3'], [14, 2, 'G4', 1]]);
      clip(p, beat, 0, 1, 16); clip(p, ac, 1, 5, 12);
      names(p, ['Beat', 'Acid']);
      return p;
    },
  },
  {
    id: 'house', name: 'House 124', bpm: 124, desc: 'Le classique 4/4 : kick, clap sur 2 et 4, charley ouvert entre les kicks, basse et accords, un peu de swing.',
    build() {
      const p = base('Démo House', 124);
      p.swing = 0.12;
      const kick = addChannel(p, 'kick-house'), clap = addChannel(p, 'clap'), hat = addChannel(p, 'hat'), ohat = addChannel(p, 'ohat'), bass = addChannel(p, 'bass-house'), keys = addChannel(p, 'keys');
      addFx(p, clap.ins, 'reverb', { size: 0.5, mix: 0.2 }); addFx(p, keys.ins, 'reverb', { size: 0.7, mix: 0.3 }); addFx(p, keys.ins, 'filter', { type: 0, cut: 3500, res: 0.2 });
      addFx(p, 0, 'comp', { thr: -12, ratio: 2, makeup: 2 }); addFx(p, 0, 'limiter', { ceil: -0.3, gain: 1 });
      const beat = addPattern(p, 'Beat', 16), groove = addPattern(p, 'Basse + accords', 64);
      steps(beat, kick, 'X...x...x...x...'); steps(beat, clap, '....x.......x...'); steps(beat, hat, 'x.x.x.x.x.x.x.xo'); steps(beat, ohat, '..x...x...x...x.');
      const roots = ['A3', 'F3', 'C4', 'G3'];
      roots.forEach((r, i) => mel(groove, bass, [[i * 16 + 2, 2, r], [i * 16 + 6, 2, r], [i * 16 + 10, 2, r], [i * 16 + 14, 1, r]]));
      const ch = [['A4', 'C5', 'E5', 'G5'], ['F4', 'A4', 'C5', 'E5'], ['C5', 'E5', 'G5', 'B5'], ['G4', 'B4', 'D5', 'F5']];
      ch.forEach((c, i) => mel(groove, keys, [3, 6, 11].flatMap((s) => c.map((k) => [i * 16 + s, 2, k, 0.6]))));
      clip(p, beat, 0, 1, 16); clip(p, groove, 1, 5, 12);
      names(p, ['Beat', 'Groove']);
      return p;
    },
  },
  {
    id: 'hiphop', name: 'Hip-hop 90', bpm: 90, desc: 'Boom bap / trap : 808 en mélodie, caisse claire sur 2 et 4, charleys avec swing, accords.',
    build() {
      const p = base('Démo Hip-hop', 90);
      p.swing = 0.35;
      const k = addChannel(p, 'kick-808'), sn = addChannel(p, 'snare'), hat = addChannel(p, 'hat'), keys = addChannel(p, 'keys'), rim = addChannel(p, 'rim');
      addFx(p, sn.ins, 'reverb', { size: 0.4, mix: 0.2 }); addFx(p, keys.ins, 'filter', { type: 0, cut: 2200, res: 0.1 }); addFx(p, keys.ins, 'reverb', { size: 0.6, mix: 0.25 });
      addFx(p, 0, 'limiter', { ceil: -0.3, gain: 2 });
      const beat = addPattern(p, 'Beat', 32);
      mel(beat, k, [[0, 6, 'C5', 1], [7, 3, 'C5'], [10, 4, 'D#5'], [16, 6, 'G4', 1], [23, 3, 'A#4'], [26, 4, 'C5']]);
      steps(beat, sn, '....x.......x.......x.......x...'); steps(beat, hat, 'x.x.x.x.x.x.x.xxx.x.x.x.x.x.xoxo'); steps(beat, rim, '...........x..............x.....');
      mel(beat, keys, [['C5', 'D#5', 'G5', 'A#5'], ['G#4', 'C5', 'D#5', 'G5']].flatMap((c, i) => c.map((n) => [i * 16, 14, n, 0.55])));
      clip(p, beat, 0, 1, 16);
      names(p, ['Beat']);
      return p;
    },
  },
  {
    id: 'dnb', name: 'Drum & bass 174', bpm: 174, desc: 'Rythme « two-step » (kick sur 1, caisse claire sur 2 et 4), basse reese qui tourne.',
    build() {
      const p = base('Démo Drum & bass', 174);
      const kick = addChannel(p, 'kick-dnb'), sn = addChannel(p, 'snare-dnb'), hat = addChannel(p, 'hat'), reese = addChannel(p, 'reese'), pad = addChannel(p, 'pad');
      addFx(p, sn.ins, 'reverb', { size: 0.45, mix: 0.15 }); addFx(p, reese.ins, 'dist', { drive: 8, type: 0, out: -6, mix: 0.5 }); addFx(p, pad.ins, 'reverb', { size: 0.9, mix: 0.4 });
      addFx(p, 0, 'limiter', { ceil: -0.3, gain: 2 });
      const beat = addPattern(p, 'Beat', 32), bass = addPattern(p, 'Reese', 64);
      steps(beat, kick, 'x.........x.........x.....x.....'); steps(beat, sn, '....x.......x.......x.......x...'); steps(beat, hat, '..x...x...x...x...x...x...x.x.x.');
      mel(bass, reese, [[0, 14, 'E4'], [16, 12, 'G4'], [28, 4, 'F#4'], [32, 14, 'E4'], [48, 8, 'C4'], [56, 8, 'D4']]);
      chords(bass, pad, [['E5', 'G5', 'B5'], ['C5', 'E5', 'G5']], 2);
      clip(p, beat, 0, 1, 16); clip(p, bass, 1, 5, 12);
      names(p, ['Beat', 'Basse + nappe']);
      return p;
    },
  },
];
