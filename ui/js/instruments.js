// Définition des instruments (paramètres réglables), des effets du mixeur et des préréglages.
// Les noms de paramètres sont ceux lus par le moteur Rust (src/song.rs).

const KICK = [
  { sec: 'Hauteur (le « pitch drop »)' },
  { id: 'start', label: 'Départ', min: 100, max: 4000, def: 900, unit: 'Hz', log: true, help: 'Hauteur au tout début du kick. Haute (1500-3000 Hz) = attaque qui claque, le « tok » des kicks hardcore/uptempo ; basse = kick rond.' },
  { id: 'pdec', label: 'Descente', min: 2, max: 200, def: 25, unit: 'ms', log: true, help: 'Vitesse à laquelle la hauteur descend du Départ vers la Queue. Court = punch sec ; long = effet « piou » (zap).' },
  { id: 'end', label: 'Queue', min: 30, max: 150, def: 55, unit: 'Hz', log: true, help: 'Hauteur finale : la « note » du kick quand il joue C5 (le pas du séquenceur). Accorde-la sur la tonalité du morceau ; dans le piano roll, les autres notes montent ou descendent la queue (mélodie de kick).' },
  { sec: 'Volume dans le temps' },
  { id: 'hold', label: 'Maintien', min: 0, max: 300, def: 20, unit: 'ms', help: 'Temps pendant lequel le kick reste à plein volume avant de décroître.' },
  { id: 'decay', label: 'Durée', min: 30, max: 2000, def: 300, unit: 'ms', log: true, help: 'Longueur du kick. Techno/house : 200-300 ms ; hardcore : 300-500 ; uptempo : 500-900 (queue longue).' },
  { id: 'tail', label: 'Queue longue', min: 0, max: 1, def: 0, help: 'Ajoute une décroissance plus lente : la queue « traîne » et devient une note (typique de l\'uptempo et du hardstyle).' },
  { id: 'click', label: 'Clic', min: 0, max: 1, def: 0.3, help: 'Petit claquement de bruit au début : aide le kick à percer dans le mix.' },
  { sec: 'Distorsion' },
  { id: 'shape', label: 'Forme', min: 0, max: 1, def: 0, help: 'Sinus → carré : plus d\'harmoniques avant la distorsion, son plus « rugueux ».' },
  { id: 'drive', label: 'Distorsion', min: 0, max: 48, def: 12, unit: 'dB', help: 'Gain envoyé dans la saturation. 0-6 dB : kick propre (house) ; 15-25 : hardstyle ; 25-45 : hardcore / uptempo / gabber.' },
  { id: 'dtype', label: 'Type', def: 0, choices: ['Douce', 'Dure', 'Repli', 'Asym', 'Bitcrush'], help: 'Douce (tanh) = chaude ; Dure (écrêtage) = agressive ; Repli (foldback) = métallique, très hardcore/uptempo ; Asym = harmoniques paires ; Bitcrush = son numérique sale.' },
  { id: 'tone', label: 'Tonalité', min: 300, max: 20000, def: 8000, unit: 'Hz', log: true, help: 'Filtre passe-bas après la distorsion : bas = sourd, haut = brillant et agressif.' },
  { id: 'vol', label: 'Volume', min: -36, max: 6, def: -3, unit: 'dB' },
];

const DRUM = [
  { id: 'kind', label: 'Son', def: 0, choices: ['Clap', 'Caisse claire', 'Charley fermé', 'Charley ouvert', 'Crash', 'Tom', 'Percu'], help: 'Type de percussion synthétisée.' },
  { id: 'tone', label: 'Hauteur', min: 0.25, max: 4, def: 1, unit: '×', log: true, help: 'Plus aigu ou plus grave. Les notes du piano roll changent aussi la hauteur.' },
  { id: 'decay', label: 'Durée', min: 10, max: 2000, def: 200, unit: 'ms', log: true, help: 'Longueur du son.' },
  { id: 'noise', label: 'Bruit', min: 0, max: 1, def: 0.7, help: 'Part de bruit (le « souffle »). Clap/caisse claire : beaucoup ; charley : mélange bruit/métal.' },
  { id: 'snap', label: 'Attaque', min: 0, max: 1, def: 0.3, help: 'Claquement au début (caisse claire).' },
  { id: 'vol', label: 'Volume', min: -36, max: 6, def: -3, unit: 'dB' },
];

const WAVES = ['Scie', 'Carré', 'Sinus', 'Triangle', 'Bruit'];
const SYNTH = [
  { sec: 'Oscillateurs' },
  { id: 'w1', label: 'Forme 1', def: 0, choices: WAVES, help: 'Forme d\'onde de l\'oscillateur principal. Scie = brillant (leads, supersaw) ; Carré = creux (screech, basses) ; Sinus = pur (sub) ; Triangle = doux.' },
  { id: 'uni', label: 'Unisson', min: 1, max: 7, def: 1, int: true, help: 'Nombre de copies légèrement désaccordées de l\'oscillateur 1. 7 voix = « supersaw » (gros lead hardstyle/trance).' },
  { id: 'det', label: 'Désaccord', min: 0, max: 1, def: 0.2, help: 'Écart entre les voix d\'unisson : plus large = plus épais.' },
  { id: 'spread', label: 'Largeur', min: 0, max: 1, def: 0.5, help: 'Répartition des voix d\'unisson en stéréo.' },
  { id: 'pw', label: 'Largeur imp.', min: 0.05, max: 0.95, def: 0.5, help: 'Largeur d\'impulsion du carré : 0,5 = carré, plus petit = son plus nasillard.' },
  { id: 'oct', label: 'Octave', min: -3, max: 3, def: 0, int: true },
  { id: 'w2', label: 'Forme 2', def: 0, choices: WAVES, help: 'Deuxième oscillateur.' },
  { id: 'semi2', label: 'Osc 2 demi-tons', min: -24, max: 24, def: 0, int: true, help: '+12 / -12 = une octave au-dessus / en dessous ; +7 = une quinte.' },
  { id: 'fine2', label: 'Osc 2 fin', min: -100, max: 100, def: 7, unit: 'ct' },
  { id: 'mix2', label: 'Osc 2 niveau', min: 0, max: 1, def: 0 },
  { id: 'sub', label: 'Sub', min: 0, max: 1, def: 0, help: 'Sinus une octave en dessous : renforce le grave.' },
  { id: 'noise', label: 'Bruit', min: 0, max: 1, def: 0 },
  { sec: 'Filtre' },
  { id: 'ftype', label: 'Filtre', def: 0, choices: ['Passe-bas', 'Passe-haut', 'Passe-bande', 'Aucun'], help: 'Passe-bas : enlève les aigus (le plus courant). Passe-haut : enlève les graves. Passe-bande : ne garde qu\'une zone (screech).' },
  { id: 'cut', label: 'Coupure', min: 20, max: 20000, def: 5000, unit: 'Hz', log: true, help: 'Fréquence de coupure du filtre : le bouton qu\'on tourne pour « ouvrir » ou « fermer » le son.' },
  { id: 'res', label: 'Résonance', min: 0, max: 1, def: 0.1, help: 'Accentue la zone autour de la coupure : son qui « siffle » (acid, screech).' },
  { id: 'fenv', label: 'Env → filtre', min: -8, max: 8, def: 0, unit: 'oct', help: 'De combien d\'octaves l\'enveloppe du filtre ouvre la coupure à chaque note (pluck, acid).' },
  { id: 'fkey', label: 'Suivi clavier', min: 0, max: 1, def: 0, help: 'Le filtre s\'ouvre plus sur les notes aiguës.' },
  { id: 'fa', label: 'F attaque', min: 0.5, max: 5000, def: 5, unit: 'ms', log: true },
  { id: 'fd', label: 'F déclin', min: 1, max: 5000, def: 300, unit: 'ms', log: true },
  { id: 'fs', label: 'F maintien', min: 0, max: 1, def: 0 },
  { id: 'fr', label: 'F relâche', min: 1, max: 5000, def: 200, unit: 'ms', log: true },
  { sec: 'Volume (enveloppe ADSR)' },
  { id: 'a', label: 'Attaque', min: 0.5, max: 5000, def: 3, unit: 'ms', log: true, help: 'Temps pour monter au maximum. Court = son percutant ; long = son qui « gonfle » (pad).' },
  { id: 'd', label: 'Déclin', min: 1, max: 5000, def: 300, unit: 'ms', log: true, help: 'Temps pour descendre au niveau de maintien.' },
  { id: 's', label: 'Maintien', min: 0, max: 1, def: 0.8, help: 'Niveau tant que la note est tenue. 0 = son qui s\'éteint tout seul (pluck).' },
  { id: 'r', label: 'Relâche', min: 1, max: 5000, def: 150, unit: 'ms', log: true, help: 'Temps pour s\'éteindre après la fin de la note.' },
  { id: 'drive', label: 'Saturation', min: 0, max: 1, def: 0, help: 'Sature le son avant le filtre (plus agressif).' },
  { id: 'vol', label: 'Volume', min: -36, max: 6, def: -3, unit: 'dB' },
  { sec: 'Modulation' },
  { id: 'penv', label: 'Env → hauteur', min: -48, max: 48, def: 0, unit: 'dt', help: 'Chaque note démarre plus haut (ou plus bas) et glisse vers sa hauteur : effet « zap », screech, hoover.' },
  { id: 'pdec', label: 'Durée env.', min: 1, max: 2000, def: 50, unit: 'ms', log: true },
  { id: 'lfo_rate', label: 'LFO vitesse', min: 0.05, max: 30, def: 5, unit: 'Hz', log: true, help: 'Oscillateur lent qui fait bouger la hauteur ou le filtre.' },
  { id: 'lfo_pitch', label: 'LFO → hauteur', min: 0, max: 12, def: 0, unit: 'dt', help: 'Vibrato. Rapide et fort = screech.' },
  { id: 'lfo_cut', label: 'LFO → filtre', min: 0, max: 4, def: 0, unit: 'oct', help: 'Le filtre s\'ouvre et se ferme en rythme (wobble).' },
  { id: 'glide', label: 'Glissando', min: 0, max: 1000, def: 0, unit: 'ms', help: 'Les notes glissent l\'une vers l\'autre (hoover, acid, basses).' },
  { id: 'mono', label: 'Voix', def: 0, choices: ['Poly', 'Mono'], help: 'Mono : une seule note à la fois (leads, basses, glissando legato).' },
];

const SAMPLER = [
  { id: 'root', label: 'Note de base', min: 24, max: 96, def: 60, int: true, note: true, help: 'La note qui joue le sample à sa hauteur d\'origine (C5 par défaut, celle du séquenceur).' },
  { id: 'tune', label: 'Accord', min: -24, max: 24, def: 0, unit: 'dt' },
  { id: 'gain', label: 'Volume', min: -36, max: 12, def: 0, unit: 'dB' },
  { id: 'start', label: 'Début', min: 0, max: 0.99, def: 0, help: 'Démarre plus loin dans le sample.' },
  { id: 'att', label: 'Attaque', min: 0, max: 2000, def: 1, unit: 'ms' },
  { id: 'rel', label: 'Relâche', min: 1, max: 5000, def: 30, unit: 'ms', log: true },
  { id: 'rev', label: 'Sens', def: 0, choices: ['Normal', 'Inversé'], help: 'Inversé = joué à l\'envers (reverse : effet de montée).' },
  { id: 'oneshot', label: 'Durée', def: 1, choices: ['Suit la note', 'Entier'], help: 'Entier (one-shot) : le sample joue jusqu\'au bout quelle que soit la longueur de la note.' },
];

export const PARAMS = { kick: KICK, drum: DRUM, synth: SYNTH, sampler: SAMPLER };
export const TYPE_LABEL = { kick: 'Kick', drum: 'Percussion', synth: 'Synthé', sampler: 'Sampler' };

export function defaults(type) {
  const o = {};
  for (const p of PARAMS[type] || []) if (p.id) o[p.id] = p.def;
  return o;
}

// ------------------------------------------------------------ effets (p[idx] dans le moteur)
export const FX = {
  eq: { label: 'EQ 3 bandes', help: 'Égaliseur : monte ou baisse les graves (110 Hz), une zone de médiums réglable et les aigus (7 kHz). Sert à faire de la place à chaque son.',
    params: [
      { id: 'low', idx: 0, label: 'Graves', min: -18, max: 18, def: 0, unit: 'dB' },
      { id: 'mid', idx: 1, label: 'Médiums', min: -18, max: 18, def: 0, unit: 'dB' },
      { id: 'freq', idx: 2, label: 'Fréq. méd.', min: 200, max: 8000, def: 1000, unit: 'Hz', log: true },
      { id: 'high', idx: 3, label: 'Aigus', min: -18, max: 18, def: 0, unit: 'dB' },
    ] },
  filter: { label: 'Filtre', help: 'Filtre passe-bas / passe-haut / passe-bande. Automatisé à la main pour les montées (build-up) et les breaks.',
    params: [
      { id: 'type', idx: 0, label: 'Type', def: 0, choices: ['Passe-bas', 'Passe-haut', 'Passe-bande'] },
      { id: 'cut', idx: 1, label: 'Coupure', min: 20, max: 20000, def: 2000, unit: 'Hz', log: true },
      { id: 'res', idx: 2, label: 'Résonance', min: 0, max: 1, def: 0.2 },
      { id: 'mix', idx: 3, label: 'Mélange', min: 0, max: 1, def: 1 },
    ] },
  dist: { label: 'Distorsion', help: 'Sature le son. Indispensable en hardcore : on enchaîne souvent plusieurs distorsions sur le kick, avec un EQ entre elles.',
    params: [
      { id: 'drive', idx: 0, label: 'Gain', min: 0, max: 48, def: 12, unit: 'dB' },
      { id: 'type', idx: 1, label: 'Type', def: 0, choices: ['Douce', 'Dure', 'Repli', 'Asym', 'Bitcrush'] },
      { id: 'tone', idx: 2, label: 'Tonalité', min: 500, max: 20000, def: 12000, unit: 'Hz', log: true },
      { id: 'mix', idx: 3, label: 'Mélange', min: 0, max: 1, def: 1 },
      { id: 'out', idx: 4, label: 'Sortie', min: -24, max: 6, def: -6, unit: 'dB' },
    ] },
  comp: { label: 'Compresseur', help: 'Réduit l\'écart entre les passages forts et faibles : son plus régulier et plus « devant ». Seuil = à partir d\'où il agit ; ratio = force.',
    params: [
      { id: 'thr', idx: 0, label: 'Seuil', min: -40, max: 0, def: -12, unit: 'dB' },
      { id: 'ratio', idx: 1, label: 'Ratio', min: 1, max: 20, def: 4, unit: ':1' },
      { id: 'att', idx: 2, label: 'Attaque', min: 0.1, max: 100, def: 5, unit: 'ms', log: true },
      { id: 'rel', idx: 3, label: 'Relâche', min: 10, max: 1000, def: 120, unit: 'ms', log: true },
      { id: 'makeup', idx: 4, label: 'Gain', min: 0, max: 24, def: 3, unit: 'dB' },
    ] },
  delay: { label: 'Delay (écho)', help: 'Répète le son en rythme. Temps en pas : 2 = croche, 3 = croche pointée, 4 = noire.',
    params: [
      { id: 'time', idx: 0, label: 'Temps', min: 0.25, max: 16, def: 3, unit: 'pas' },
      { id: 'fb', idx: 1, label: 'Répétitions', min: 0, max: 0.95, def: 0.35 },
      { id: 'mix', idx: 2, label: 'Niveau', min: 0, max: 1, def: 0.3 },
      { id: 'pp', idx: 3, label: 'Stéréo', def: 1, choices: ['Normal', 'Ping-pong'] },
      { id: 'hicut', idx: 4, label: 'Coupe aigus', min: 500, max: 20000, def: 8000, unit: 'Hz', log: true },
    ] },
  reverb: { label: 'Réverbération', help: 'Ajoute de l\'espace (une pièce, une salle). À doser : trop de reverb rend le mix flou, surtout sur le kick (n\'en mets jamais sur le kick).',
    params: [
      { id: 'size', idx: 0, label: 'Taille', min: 0, max: 1, def: 0.6 },
      { id: 'damp', idx: 1, label: 'Amorti', min: 0, max: 1, def: 0.4 },
      { id: 'mix', idx: 2, label: 'Niveau', min: 0, max: 1, def: 0.25 },
      { id: 'width', idx: 3, label: 'Largeur', min: 0, max: 1, def: 1 },
    ] },
  limiter: { label: 'Limiteur', help: 'Empêche le son de dépasser un plafond. Sur le master, il permet de monter le volume global sans saturer.',
    params: [
      { id: 'ceil', idx: 0, label: 'Plafond', min: -12, max: 0, def: -0.3, unit: 'dB' },
      { id: 'rel', idx: 1, label: 'Relâche', min: 1, max: 500, def: 50, unit: 'ms', log: true },
      { id: 'gain', idx: 2, label: 'Gain', min: 0, max: 24, def: 0, unit: 'dB' },
    ] },
};
export function fxDefaults(type) {
  const p = [0, 0, 0, 0, 0, 0, 0, 0];
  for (const s of FX[type].params) p[s.idx] = s.def;
  return p;
}

// ------------------------------------------------------------ préréglages
const C = { kick: '#ff5a3c', drum: '#f2b134', synth: '#7c6cff', bass: '#3cc4ff', sampler: '#3ddc97' };
export const PRESETS = [
  // kicks
  { id: 'kick-hardcore', cat: 'Kicks', name: 'Kick hardcore', type: 'kick', color: C.kick, desc: 'Kick hardcore classique (160-200 BPM) : attaque haute, distorsion dure.',
    params: { start: 1800, pdec: 18, end: 52, hold: 25, decay: 380, tail: 0.15, click: 0.4, shape: 0.2, drive: 34, dtype: 1, tone: 7000, vol: -4 } },
  { id: 'kick-uptempo', cat: 'Kicks', name: 'Kick uptempo', type: 'kick', color: C.kick, desc: 'Kick uptempo (200-250 BPM) : « tok » très aigu, distorsion en repli, longue queue.',
    params: { start: 2600, pdec: 10, end: 55, hold: 30, decay: 650, tail: 0.55, click: 0.5, shape: 0.35, drive: 40, dtype: 2, tone: 9000, vol: -6 } },
  { id: 'kick-gabber', cat: 'Kicks', name: 'Kick gabber', type: 'kick', color: C.kick, desc: 'Early hardcore / gabber des années 90 : kick saturé, bourdonnant.',
    params: { start: 1200, pdec: 30, end: 60, hold: 40, decay: 420, tail: 0.3, click: 0.2, shape: 0.1, drive: 42, dtype: 0, tone: 5000, vol: -5 } },
  { id: 'kick-hardstyle', cat: 'Kicks', name: 'Kick hardstyle', type: 'kick', color: C.kick, desc: 'Hardstyle (150-160 BPM) : punch + queue accordée.',
    params: { start: 1500, pdec: 22, end: 50, hold: 30, decay: 450, tail: 0.4, click: 0.3, shape: 0.15, drive: 22, dtype: 3, tone: 6000, vol: -4 } },
  { id: 'kick-techno', cat: 'Kicks', name: 'Kick techno', type: 'kick', color: C.kick, desc: 'Techno (125-140 BPM) : rond, un peu saturé.',
    params: { start: 400, pdec: 35, end: 50, hold: 15, decay: 280, tail: 0.05, click: 0.25, shape: 0, drive: 8, dtype: 0, tone: 4000, vol: -3 } },
  { id: 'kick-house', cat: 'Kicks', name: 'Kick house', type: 'kick', color: C.kick, desc: 'House (120-128 BPM), façon boîte à rythmes 909.',
    params: { start: 300, pdec: 40, end: 52, hold: 10, decay: 260, tail: 0, click: 0.45, shape: 0, drive: 4, dtype: 0, tone: 12000, vol: -3 } },
  { id: 'kick-808', cat: 'Kicks', name: '808 (hip-hop / trap)', type: 'kick', color: C.kick, desc: 'Basse-kick 808 longue, à jouer en mélodie dans le piano roll.',
    params: { start: 180, pdec: 60, end: 45, hold: 30, decay: 1400, tail: 0.4, click: 0.1, shape: 0, drive: 6, dtype: 0, tone: 3000, vol: -3 } },
  { id: 'kick-dnb', cat: 'Kicks', name: 'Kick drum & bass', type: 'kick', color: C.kick, desc: 'Kick court et sec pour la DnB (170-175 BPM).',
    params: { start: 600, pdec: 20, end: 58, hold: 5, decay: 180, tail: 0, click: 0.5, shape: 0, drive: 10, dtype: 0, tone: 9000, vol: -3 } },
  // percussions
  { id: 'clap', cat: 'Percussions', name: 'Clap', type: 'drum', color: C.drum, params: { kind: 0, tone: 1, decay: 180, noise: 0.9, snap: 0.3, vol: -6 } },
  { id: 'clap-hardcore', cat: 'Percussions', name: 'Clap hardcore', type: 'drum', color: C.drum, desc: 'Clap plus grave et plus long, à saturer.', params: { kind: 0, tone: 0.8, decay: 280, noise: 1, snap: 0.3, vol: -6 } },
  { id: 'snare', cat: 'Percussions', name: 'Caisse claire', type: 'drum', color: C.drum, params: { kind: 1, tone: 1, decay: 220, noise: 0.6, snap: 0.4, vol: -6 } },
  { id: 'snare-dnb', cat: 'Percussions', name: 'Caisse claire DnB', type: 'drum', color: C.drum, params: { kind: 1, tone: 1.2, decay: 170, noise: 0.7, snap: 0.8, vol: -5 } },
  { id: 'hat', cat: 'Percussions', name: 'Charley fermé', type: 'drum', color: C.drum, params: { kind: 2, tone: 1, decay: 45, noise: 0.5, snap: 0, vol: -12 } },
  { id: 'ohat', cat: 'Percussions', name: 'Charley ouvert', type: 'drum', color: C.drum, params: { kind: 3, tone: 1, decay: 320, noise: 0.5, snap: 0, vol: -14 } },
  { id: 'crash', cat: 'Percussions', name: 'Crash', type: 'drum', color: C.drum, params: { kind: 4, tone: 1, decay: 1500, noise: 0.6, snap: 0, vol: -14 } },
  { id: 'ride', cat: 'Percussions', name: 'Ride', type: 'drum', color: C.drum, params: { kind: 4, tone: 1.5, decay: 900, noise: 0.2, snap: 0, vol: -16 } },
  { id: 'tom', cat: 'Percussions', name: 'Tom', type: 'drum', color: C.drum, params: { kind: 5, tone: 1, decay: 320, noise: 0.2, snap: 0, vol: -6 } },
  { id: 'perc', cat: 'Percussions', name: 'Percu', type: 'drum', color: C.drum, params: { kind: 6, tone: 1, decay: 90, noise: 0.3, snap: 0, vol: -10 } },
  { id: 'rim', cat: 'Percussions', name: 'Rimshot', type: 'drum', color: C.drum, params: { kind: 6, tone: 1.7, decay: 40, noise: 0.5, snap: 0, vol: -10 } },
  // leads
  { id: 'screech', cat: 'Leads', name: 'Screech hardcore', type: 'synth', color: C.synth, desc: 'Le cri aigu et distordu des tracks hardcore/uptempo.',
    params: { w1: 1, uni: 3, det: 0.3, pw: 0.3, ftype: 2, cut: 1500, res: 0.75, fenv: 3, fa: 1, fd: 180, fs: 0.3, lfo_rate: 9, lfo_pitch: 0.6, lfo_cut: 1.2, penv: 12, pdec: 60, drive: 0.7, mono: 1, glide: 40, vol: -12 } },
  { id: 'hoover', cat: 'Leads', name: 'Hoover', type: 'synth', color: C.synth, desc: 'Le « hoover » des raves et du gabber : épais, glissant.',
    params: { w1: 0, uni: 7, det: 0.8, spread: 0.8, w2: 1, semi2: -12, mix2: 0.4, cut: 4000, res: 0.2, penv: -5, pdec: 200, glide: 120, mono: 1, lfo_rate: 5, lfo_pitch: 0.3, drive: 0.2, a: 10, r: 200, vol: -12 } },
  { id: 'supersaw', cat: 'Leads', name: 'Supersaw', type: 'synth', color: C.synth, desc: 'Gros lead hardstyle / trance : 7 dents de scie désaccordées.',
    params: { w1: 0, uni: 7, det: 0.45, spread: 0.9, cut: 9000, res: 0.1, a: 5, d: 400, s: 0.8, r: 300, vol: -12 } },
  { id: 'raw-lead', cat: 'Leads', name: 'Lead rawstyle', type: 'synth', color: C.synth, desc: 'Lead saturé et agressif (rawstyle, hardcore).',
    params: { w1: 0, uni: 5, det: 0.3, spread: 0.7, drive: 0.9, cut: 2500, res: 0.5, fenv: 2, fd: 250, fs: 0.4, vol: -12 } },
  { id: 'pluck', cat: 'Leads', name: 'Pluck', type: 'synth', color: C.synth, desc: 'Son court et pincé (mélodies, arpèges).',
    params: { w1: 0, uni: 3, det: 0.2, cut: 600, res: 0.3, fenv: 4.5, fa: 1, fd: 180, fs: 0, a: 1, d: 250, s: 0, r: 200, vol: -9 } },
  { id: 'acid', cat: 'Leads', name: 'Acid 303', type: 'synth', color: C.synth, desc: 'Le son « acid » (techno, acidcore) : filtre résonant + glissando.',
    params: { w1: 0, cut: 400, res: 0.85, fenv: 4, fd: 200, fs: 0, mono: 1, glide: 60, drive: 0.4, vol: -9 } },
  { id: 'zap', cat: 'Leads', name: 'Zap / effet', type: 'synth', color: C.synth, desc: 'Effet laser pour les transitions.',
    params: { w1: 2, penv: 36, pdec: 80, ftype: 3, a: 1, d: 200, s: 0, r: 100, vol: -10 } },
  // nappes et accords
  { id: 'pad', cat: 'Nappes & accords', name: 'Nappe (pad)', type: 'synth', color: '#b36cff', desc: 'Son doux et long pour les breaks et les intros.',
    params: { w1: 0, uni: 7, det: 0.35, w2: 3, semi2: 12, mix2: 0.3, cut: 2500, res: 0.1, a: 600, d: 1000, s: 0.8, r: 1200, lfo_rate: 0.3, lfo_cut: 0.3, vol: -14 } },
  { id: 'keys', cat: 'Nappes & accords', name: 'Clavier', type: 'synth', color: '#b36cff', desc: 'Pour jouer des accords (hip-hop, house).',
    params: { w1: 3, w2: 2, semi2: 12, mix2: 0.4, cut: 3500, a: 2, d: 800, s: 0.3, r: 400, vol: -10 } },
  // basses
  { id: 'sub', cat: 'Basses', name: 'Sub basse', type: 'synth', color: C.bass, desc: 'Basse sinusoïdale très grave.',
    params: { w1: 2, oct: -1, cut: 400, a: 3, d: 200, s: 1, r: 80, mono: 1, vol: -6 } },
  { id: 'reese', cat: 'Basses', name: 'Reese (DnB)', type: 'synth', color: C.bass, desc: 'Basse épaisse qui « tourne » (drum & bass).',
    params: { w1: 0, uni: 5, det: 0.25, w2: 0, fine2: 12, mix2: 0.5, cut: 800, res: 0.2, lfo_rate: 0.2, lfo_cut: 0.5, oct: -1, mono: 1, vol: -8 } },
  { id: 'bass-house', cat: 'Basses', name: 'Basse house', type: 'synth', color: C.bass, params: { w1: 1, oct: -1, cut: 900, res: 0.3, fenv: 2, fd: 150, s: 0.7, r: 60, vol: -8 } },
  { id: 'bass-offbeat', cat: 'Basses', name: 'Basse offbeat (hardstyle)', type: 'synth', color: C.bass, desc: 'Basse courte jouée entre les kicks.',
    params: { w1: 0, uni: 3, det: 0.15, oct: -1, cut: 700, res: 0.3, fenv: 2.5, fd: 120, a: 1, d: 150, s: 0.2, r: 50, vol: -8 } },
  // sampler
  { id: 'sampler', cat: 'Sampler', name: 'Sampler (ton fichier audio)', type: 'sampler', color: C.sampler, desc: 'Joue un fichier audio (WAV, MP3…) : voix, sample de kick, FX…', params: {} },
];

export function presetById(id) { return PRESETS.find((p) => p.id === id); }

// ------------------------------------------------------------ notes
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FR = ['Do', 'Do#', 'Ré', 'Ré#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];
// convention FL Studio : 60 = C5
export const noteName = (k) => `${NAMES[k % 12]}${Math.floor(k / 12)}`;
export const noteFr = (k) => `${FR[k % 12]}${Math.floor(k / 12)}`;
export function parseNote(x) {
  if (typeof x === 'number') return Math.max(0, Math.min(127, Math.round(x)));
  const m = String(x).trim().match(/^([A-Ga-g])([#b]?)(-?\d+)$/);
  if (!m) { const n = Number(x); return isFinite(n) ? Math.round(n) : 60; }
  let k = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }[m[1].toLowerCase()];
  if (m[2] === '#') k++; else if (m[2] === 'b') k--;
  return Math.max(0, Math.min(127, k + Number(m[3]) * 12));
}
export const isBlack = (k) => [1, 3, 6, 8, 10].includes(k % 12);

export const SCALES = {
  none: { label: 'Aucune', iv: null },
  minor: { label: 'Mineure', iv: [0, 2, 3, 5, 7, 8, 10] },
  major: { label: 'Majeure', iv: [0, 2, 4, 5, 7, 9, 11] },
  harmonic: { label: 'Mineure harmonique', iv: [0, 2, 3, 5, 7, 8, 11] },
  phrygian: { label: 'Phrygienne', iv: [0, 1, 3, 5, 7, 8, 10] },
  pent: { label: 'Pentatonique mineure', iv: [0, 3, 5, 7, 10] },
};
export const ROOTS = FR;
