// Cours interactifs. Chaque cours : setup() (projet d'exercice, optionnel), intro, étapes, outro.
// Étape : html (consigne), hl (zones/contrôles à surligner, ou fonction(x)), check(x) -> true quand c'est réussi,
// live(x) -> petit texte de suivi. Sans check : bouton « Suivant ».
// x = { app, p (projet), pat (motif affiché), sel (canal sélectionné), snap (lecture), find(preset|type), stepsOf(canal),
//       notes(canal), same(set, liste), has(set, liste), ev(nom), hold(clé, cond, ms), mem, fx(piste, type) }
import { emptyProject, addChannel, addPattern, addFx, STEP, BAR } from './project.js';
import { SCALES, noteName } from './instruments.js';

const st = (set) => (set.size ? [...set].sort((a, b) => a - b).map((s) => s + 1).join(', ') : 'aucun');
const stepHl = (x, c, list) => (c ? list.map((s) => `@.rrow[data-ch="${c.id}"] .step[data-s="${s}"]`) : []);
const nameHl = (c) => (c ? `@.rrow[data-ch="${c.id}"] .name` : null);
function fill(pat, ch, list, key = 60) { pat.notes[ch.id] = list.map((s) => ({ t: s * STEP, len: STEP, key, vel: 0.8 })); }
function proj(name, bpm, presets) {
  const p = emptyProject(name); p.bpm = bpm;
  const chs = presets.map((id) => addChannel(p, id));
  return { p, chs, pat: p.patterns[0] };
}
const TABLE_BPM = `<table class="tbl"><tr><th>Style</th><th>Tempo</th></tr>
  <tr><td>Hip-hop, boom bap</td><td>80 – 95</td></tr><tr><td>House</td><td>120 – 128</td></tr><tr><td>Techno</td><td>125 – 140</td></tr>
  <tr><td>Hardstyle</td><td>150 – 160</td></tr><tr><td>Hardcore</td><td>160 – 200</td></tr><tr><td>Drum & bass</td><td>170 – 175</td></tr>
  <tr><td>Uptempo / terror</td><td>200 – 250+</td></tr></table>`;

export const LESSONS = [
  // =====================================================================================================
  {
    id: 'decouverte', chap: '1 · Les bases', title: 'Découvrir le studio', desc: 'Les grandes zones de l\'écran et à quoi elles servent.',
    setup() { const { p, chs, pat } = proj('Cours · Découverte', 170, ['kick-hardcore', 'clap-hardcore', 'hat']); fill(pat, chs[0], [0, 4, 8, 12]); fill(pat, chs[1], [4, 12]); fill(pat, chs[2], [2, 6, 10, 14]); return p; },
    view: 'rack',
    intro: `<p>Un logiciel de musique (on dit une <b>DAW</b>, comme FL Studio ou Ableton) est toujours organisé pareil :</p>
      <ul><li>des <b>instruments</b> qui produisent des sons ;</li><li>des <b>notes</b> qui disent quand et à quelle hauteur ils jouent ;</li>
      <li>un <b>arrangement</b> qui place les morceaux de musique dans le temps ;</li><li>un <b>mixeur</b> qui règle le volume et les effets de chaque son.</li></ul>
      <p>IrisStudio reprend la disposition de FL Studio : ce que tu apprends ici te servira là-bas aussi.</p>`,
    steps: [
      { html: '<b>Le navigateur</b> (à gauche) : la liste des instruments. Kicks, percussions, leads, basses… Un clic ajoute l\'instrument au projet. L\'onglet <b>Démos</b> contient un projet complet par style.', hl: ['browser'] },
      { html: '<b>Le séquenceur</b> (au centre) : une ligne par instrument. Les cases sont les <b>pas</b> : 16 pas = 1 mesure = 4 temps. Une case allumée = l\'instrument joue à ce moment-là. Dans FL Studio, ça s\'appelle le <i>Channel Rack</i>.', hl: ['rack'] },
      { html: '<b>Les réglages de l\'instrument</b> (à droite) : quand tu cliques sur le nom d\'un instrument, ses boutons apparaissent ici. Clique sur <b>Kick hardcore</b>.', hl: (x) => ['inspector', nameHl(x.find('kick'))], check: (x) => x.sel?.type === 'kick' },
      { html: 'Les <b>potards</b> se tournent en <b>glissant la souris vers le haut ou le bas</b>. Tourne <b>Distorsion</b> du kick et écoute (le petit clavier au-dessus joue le son).', hl: ['p.drive', 'mini-keyboard'], check: (x) => x.ev('param.drive') },
      { html: 'Appuie sur <b>Espace</b> (ou ▶ en haut) pour lancer la lecture.', hl: ['play'], check: (x) => x.snap.playing },
      { html: '<b>Les onglets</b> en haut à droite : Séquenceur, <b>Piano roll</b> (les mélodies), <b>Playlist</b> (l\'arrangement du morceau) et <b>Mixeur</b>. Ouvre le <b>Mixeur</b> (ou touche <span class="k">F9</span>).', hl: ['tab-mixer'], check: (x) => x.app.view === 'mixer' },
      { html: 'Chaque instrument arrive sur une <b>piste du mixeur</b>, avec son fader (volume) et son VU-mètre qui bouge pendant la lecture. Reviens au <b>Séquenceur</b> (<span class="k">F6</span>).', hl: ['tab-rack'], check: (x) => x.app.view === 'rack' },
      { html: 'Arrête la lecture (<b>Espace</b>).', hl: ['play'], check: (x) => { if (x.snap.playing) x.mem.p = 1; return !x.snap.playing; } },
    ],
    outro: '<p>Tu connais la carte du studio. Les raccourcis de FL Studio marchent aussi ici : <span class="k">F5</span> playlist, <span class="k">F6</span> séquenceur, <span class="k">F7</span> piano roll, <span class="k">F9</span> mixeur, <span class="k">Espace</span> lecture.</p>',
  },
  // =====================================================================================================
  {
    id: 'premier-beat', chap: '1 · Les bases', title: 'Ton premier beat', desc: 'Kick, clap et charley dans le séquenceur pas à pas.',
    setup() { return proj('Cours · Premier beat', 170, ['kick-hardcore', 'clap-hardcore', 'hat']).p; },
    view: 'rack',
    intro: `<p>Presque toute la musique électronique repose sur une <b>mesure à 4 temps</b>. Dans le séquenceur, une mesure = <b>16 pas</b> : les pas <b>1, 5, 9 et 13</b> tombent sur les 4 temps (les cases plus claires/foncées regroupent les pas par temps).</p>
      <p>Clic = allumer un pas, clic droit = l'éteindre. Tu peux glisser pour en allumer plusieurs.</p>`,
    steps: [
      { html: 'Le <b>kick</b> (la grosse caisse) sur chaque temps : allume les pas <b>1, 5, 9 et 13</b> de la ligne <b>Kick hardcore</b>. C\'est le « four on the floor », la base du hardcore, de la techno, de la house…',
        hl: (x) => stepHl(x, x.find('kick'), [0, 4, 8, 12]),
        check: (x) => x.same(x.stepsOf(x.find('kick')), [0, 4, 8, 12]), live: (x) => `kick : pas ${st(x.stepsOf(x.find('kick')))}` },
      { html: 'Lance la lecture (<b>Espace</b>) et laisse tourner pendant la suite.', hl: ['play'], check: (x) => x.snap.playing },
      { html: 'Le <b>clap</b> sur les temps 2 et 4 : pas <b>5 et 13</b>. Le clap (ou la caisse claire) donne le « contretemps » qui fait bouger la tête.',
        hl: (x) => stepHl(x, x.find('drum'), [4, 12]),
        check: (x) => x.same(x.stepsOf(x.find('clap-hardcore')), [4, 12]), live: (x) => `clap : pas ${st(x.stepsOf(x.find('clap-hardcore')))}` },
      { html: 'Le <b>charley</b> (hi-hat) <b>entre</b> les kicks : pas <b>3, 7, 11 et 15</b>. On appelle ça l\'« offbeat » : c\'est ce qui donne l\'élan.',
        hl: (x) => stepHl(x, x.find('hat'), [2, 6, 10, 14]),
        check: (x) => x.same(x.stepsOf(x.find('hat')), [2, 6, 10, 14]), live: (x) => `charley : pas ${st(x.stepsOf(x.find('hat')))}` },
      { html: 'Le charley est un peu fort. Baisse son <b>volume</b> : le premier petit potard à gauche de son nom (glisse vers le bas).',
        hl: (x) => [`@.rrow[data-ch="${x.find('hat')?.id}"] [data-ctl="ch-vol"]`], check: (x) => (x.find('hat')?.vol ?? 1) < 0.65,
        live: (x) => `volume du charley : ${Math.round((x.find('hat')?.vol ?? 0) * 100)} %` },
      { html: 'Molette sur un pas allumé = sa <b>force</b> (vélocité). Rends le kick du pas 1 plus fort ou plus doux pour essayer, puis passe à la suite.', hl: (x) => stepHl(x, x.find('kick'), [0]) },
    ],
    outro: '<p>Kick sur les temps, clap sur 2 et 4, charley entre les deux : c\'est le squelette de 90 % des morceaux de dance music. Le hardcore, l\'uptempo et la techno partent tous de là. Ce qui change : le <b>tempo</b> (cours suivant) et le <b>son</b> du kick.</p>',
  },
  // =====================================================================================================
  {
    id: 'tempo', chap: '1 · Les bases', title: 'Le tempo et les styles', desc: 'BPM : de la house à l\'uptempo avec le même rythme.',
    setup() { const { p, chs, pat } = proj('Cours · Tempo', 120, ['kick-techno', 'clap', 'hat']); fill(pat, chs[0], [0, 4, 8, 12]); fill(pat, chs[1], [4, 12]); fill(pat, chs[2], [2, 6, 10, 14]); return p; },
    view: 'rack',
    intro: `<p>Le <b>tempo</b> se compte en <b>BPM</b> (battements par minute) : le nombre de temps (de kicks, en 4/4) par minute. C'est lui qui définit le style :</p>${TABLE_BPM}
      <p>Pour changer le tempo : <b>glisse</b> sur la case Tempo (haut/bas), utilise la <b>molette</b>, ou clique dessus et tape une valeur.</p>`,
    steps: [
      { html: 'Lance la lecture.', hl: ['play'], check: (x) => x.snap.playing },
      { html: 'Mets le tempo à <b>125 BPM</b> environ : tempo house / techno.', hl: ['bpm'], check: (x) => x.hold('a', x.p.bpm >= 122 && x.p.bpm <= 128, 1500), live: (x) => `tempo : ${x.p.bpm} BPM` },
      { html: 'Monte à <b>150 BPM</b> : hardstyle.', hl: ['bpm'], check: (x) => x.hold('b', x.p.bpm >= 148 && x.p.bpm <= 158, 1500), live: (x) => `tempo : ${x.p.bpm} BPM` },
      { html: 'Monte à <b>180 BPM</b> : hardcore. Le même rythme devient beaucoup plus agressif.', hl: ['bpm'], check: (x) => x.hold('c', x.p.bpm >= 170 && x.p.bpm <= 195, 1500), live: (x) => `tempo : ${x.p.bpm} BPM` },
      { html: 'Et <b>220 BPM</b> : uptempo. À ce tempo, les kicks s\'enchaînent tellement vite qu\'ils deviennent presque une note continue : c\'est pour ça que les kicks uptempo ont une queue courte et très « tok ».', hl: ['bpm'], check: (x) => x.hold('d', x.p.bpm >= 200, 1500), live: (x) => `tempo : ${x.p.bpm} BPM` },
      { html: '<b>Le swing</b> retarde un pas sur deux : le rythme « balance » (hip-hop, house). Redescends vers <b>90 BPM</b> et mets le swing vers <b>30 %</b>. Écoute le charley.', hl: ['bpm', 'swing'],
        check: (x) => x.hold('e', x.p.bpm <= 100 && x.p.swing >= 0.2, 1500), live: (x) => `tempo : ${x.p.bpm} BPM · swing : ${Math.round(x.p.swing * 100)} %` },
      { html: 'Le <b>métronome</b> fait « tic » sur chaque temps : pratique pour jouer au clavier en rythme. Allume-le, écoute, puis éteins-le.', hl: ['metronome'],
        check: (x) => { if (x.p.metronome) x.mem.m = 1; return x.mem.m && !x.p.metronome; } },
    ],
    outro: '<p>En hardcore et uptempo, on ne met <b>pas de swing</b> : tout est droit et carré. Le swing sert surtout en hip-hop, house, UK garage.</p>',
  },
  // =====================================================================================================
  {
    id: 'motifs', chap: '1 · Les bases', title: 'Les motifs (patterns)', desc: 'Plusieurs motifs pour varier : couplet, roulement de kick…',
    setup() { const { p, chs, pat } = proj('Cours · Motifs', 175, ['kick-hardcore', 'clap-hardcore', 'hat']); pat.name = 'Beat'; fill(pat, chs[0], [0, 4, 8, 12]); fill(pat, chs[1], [4, 12]); fill(pat, chs[2], [2, 6, 10, 14]); return p; },
    view: 'rack',
    intro: `<p>Un <b>motif</b> (pattern dans FL Studio) est un petit morceau de musique : 1, 2 ou 4 mesures de notes. Un morceau entier, c'est plusieurs motifs mis bout à bout dans la <b>playlist</b>.</p>
      <p>Le motif affiché est choisi en haut, à côté des onglets.</p>`,
    steps: [
      { html: 'Crée un <b>nouveau motif</b> avec le bouton <b>＋</b> à côté du nom du motif.', hl: ['pattern-add'], check: (x) => x.p.patterns.length >= 2 && x.pat.id !== x.p.patterns[0].id },
      { html: 'Ce motif est vide. Écris un <b>roulement de kick</b> (la montée avant un drop) : kick sur les pas <b>1, 5, 9, 11, 13, 14, 15, 16</b>.',
        hl: (x) => stepHl(x, x.find('kick'), [0, 4, 8, 10, 12, 13, 14, 15]),
        check: (x) => x.has(x.stepsOf(x.find('kick')), [0, 4, 8, 10, 12, 13, 14, 15]), live: (x) => `kick : pas ${st(x.stepsOf(x.find('kick')))}` },
      { html: 'Écoute-le (Espace).', hl: ['play'], check: (x) => x.snap.playing },
      { html: 'Repasse sur le motif <b>Beat</b> (menu des motifs ou flèche ◀) : la lecture passe immédiatement au motif choisi.', hl: ['pattern'], check: (x) => x.pat.id === x.p.patterns[0].id },
      { html: 'Un motif peut durer plus longtemps : choisis <b>2 mesures</b> dans la liste de longueur. Le séquenceur affiche alors 32 pas.', hl: ['pattern-len'], check: (x) => x.pat.len >= 32 },
      { html: 'Renomme un motif avec ✎ (par ex. « Roulement »). Des noms clairs aident beaucoup quand le morceau grandit.', hl: ['@#pat-rename'] },
    ],
    outro: '<p>On assemblera ces motifs dans la <b>playlist</b> au chapitre 5 : intro, break, montée, drop…</p>',
  },
  // =====================================================================================================
  {
    id: 'piano-roll', chap: '2 · Mélodie', title: 'Le piano roll', desc: 'Écrire des notes : hauteur, longueur, vélocité.',
    setup() { const { p, chs } = proj('Cours · Piano roll', 150, ['kick-hardstyle', 'pluck']); fill(p.patterns[0], chs[0], [0, 4, 8, 12]); return p; },
    view: 'rack',
    intro: `<p>Le séquenceur dit <b>quand</b> un son joue. Pour les mélodies, il faut aussi dire <b>quelle note</b> et <b>combien de temps</b> : c'est le rôle du <b>piano roll</b>.</p>
      <p>Verticalement : les notes (un clavier de piano à gauche). Horizontalement : le temps (les traits épais = mesures, moyens = temps, fins = pas).</p>`,
    steps: [
      { html: 'Sélectionne <b>Pluck</b> (clic sur son nom) puis ouvre le <b>Piano roll</b> (onglet ou <span class="k">F7</span>). Astuce : double-clic sur le nom = ouvrir directement.', hl: (x) => [nameHl(x.find('pluck')), 'tab-piano'], check: (x) => x.app.view === 'piano' && x.sel?.preset === 'pluck' },
      { html: 'Clique sur les touches du clavier à gauche pour écouter les notes. Le C (Do) de chaque octave est noté : <b>C5</b> = le Do du milieu.', hl: ['piano'], check: (x) => x.ev('preview') },
      { html: 'Clique dans la grille pour poser <b>4 notes</b> (une par temps, par exemple).', hl: ['piano'], check: (x) => x.notes(x.find('pluck')).length >= 4, live: (x) => `${x.notes(x.find('pluck')).length} notes` },
      { html: 'Allonge une note : attrape son <b>bord droit</b> et tire vers la droite (au moins 2 pas).', hl: ['piano'], check: (x) => x.notes(x.find('pluck')).some((n) => n.len >= 2 * STEP) },
      { html: 'Déplace une note en la faisant glisser (vers le haut = plus aigu).', hl: ['piano'], check: (x) => x.ev('note.move') },
      { html: 'Efface une note avec un <b>clic droit</b>.', hl: ['piano'], check: (x) => x.ev('note.del') },
      { html: 'En bas, le couloir <b>Vélocité</b> règle la force de chaque note : glisse sur une barre pour la baisser.', hl: ['piano'], check: (x) => x.ev('note.vel') },
      { html: 'Écoute ta mélodie (Espace). Tu peux aussi jouer avec le clavier de l\'ordinateur : la rangée <span class="k">Q S D F G H J K</span> (AZERTY) = les touches blanches.', hl: ['play'], check: (x) => x.snap.playing },
    ],
    outro: '<p>La grille (« Grille » en haut) aimante les notes : <b>Pas</b> (1/16) pour les rythmes rapides, <b>Temps</b> pour poser des accords. <span class="k">Ctrl</span>+molette pour zoomer.</p>',
  },
  // =====================================================================================================
  {
    id: 'gammes', chap: '2 · Mélodie', title: 'Gammes et accords', desc: 'Les notes qui sonnent juste ensemble ; écrire un accord.',
    setup() { const { p, chs } = proj('Cours · Gammes', 160, ['kick-hardcore', 'supersaw']); fill(p.patterns[0], chs[0], [0, 4, 8, 12]); p.patterns[0].len = 32; fill(p.patterns[0], chs[0], [0, 4, 8, 12, 16, 20, 24, 28]); return p; },
    view: 'rack',
    intro: `<p>Une <b>gamme</b>, c'est 7 notes choisies parmi les 12 qui « vont bien » ensemble. Si tu n'utilises que ces notes, ta mélodie sonnera juste.</p>
      <p>Le hardcore, l'uptempo et le hardstyle utilisent surtout des gammes <b>mineures</b> (sombres, tristes ou épiques) : la plus simple est <b>La mineur</b> (que des touches blanches : A B C D E F G).</p>`,
    steps: [
      { html: 'Sélectionne <b>Supersaw</b> et ouvre le piano roll.', hl: (x) => [nameHl(x.find('supersaw')), 'tab-piano'], check: (x) => x.app.view === 'piano' && x.sel?.preset === 'supersaw' },
      { html: 'En haut, choisis la gamme : <b>La</b> + <b>Mineure</b>. Les lignes des notes de la gamme s\'éclairent (et un trait violet apparaît sur le clavier).', hl: ['pr-root', 'pr-scale'],
        check: (x) => x.app.piano.root === 9 && x.app.piano.scale === 'minor' },
      { html: 'Écris une mélodie d\'au moins <b>6 notes</b>, <b>uniquement sur les lignes éclairées</b>.', hl: ['piano'],
        check: (x) => { const n = x.notes(x.find('supersaw')); return n.length >= 6 && n.every((k) => SCALES.minor.iv.includes(((k.key - 9) % 12 + 12) % 12)); },
        live: (x) => { const n = x.notes(x.find('supersaw')); const bad = n.filter((k) => !SCALES.minor.iv.includes(((k.key - 9) % 12 + 12) % 12)); return `${n.length} notes${bad.length ? ` · hors gamme : ${bad.map((k) => noteName(k.key)).join(', ')}` : ''}`; } },
      { html: 'Un <b>accord</b> = plusieurs notes en même temps. L\'accord de <b>La mineur</b> : <b>A, C, E</b> (une note sur deux de la gamme, en partant de A). Pose 3 notes <b>empilées au même moment</b> (même position horizontale). Mets la grille sur <b>Temps</b> pour que ce soit plus facile.', hl: ['piano', 'pr-snap'],
        check: (x) => { const m = {}; for (const n of x.notes(x.find('supersaw'))) m[n.t] = (m[n.t] || 0) + 1; return Object.values(m).some((c) => c >= 3); } },
      { html: 'Écoute. Puis essaie d\'autres accords de la gamme : <b>F A C</b> (Fa majeur), <b>G B D</b> (Sol majeur), <b>D F A</b> (Ré mineur). L\'enchaînement <b>Am – F – C – G</b> est partout dans la musique « euphoric ».', hl: ['play'] },
    ],
    outro: '<p>La gamme <b>mineure harmonique</b> (dans la liste) remplace G par G# : son « oriental », très utilisé en hardcore et hardstyle pour les mélodies épiques. La <b>phrygienne</b> (B → Bb) donne un côté sombre, typique du terror et de l\'industrial.</p>',
  },
  // =====================================================================================================
  {
    id: 'synthe', chap: '3 · Le son', title: 'Le synthé de A à Z', desc: 'Oscillateurs, filtre, enveloppes, unisson : fabriquer ses propres sons.',
    setup() {
      const { p, chs, pat } = proj('Cours · Synthé', 140, ['supersaw']);
      const c = chs[0]; c.name = 'Mon synthé'; c.preset = ''; c.params = { ...c.params, uni: 1, det: 0.2, spread: 0.5, cut: 20000, res: 0, fenv: 0, a: 3, d: 300, s: 0.8, r: 150, vol: -10 };
      pat.notes[c.id] = [[0, 'A4'], [4, 'C5'], [8, 'E5'], [12, 'C5']].map(([s, k]) => ({ t: s * STEP, len: 3 * STEP, key: { A4: 57, C5: 60, E5: 64 }[k], vel: 0.8 }));
      return p;
    },
    view: 'rack',
    intro: `<p>Un <b>synthé soustractif</b> fonctionne en 3 étapes, comme un sculpteur :</p>
      <ol><li><b>Oscillateur</b> : produit un son riche (dent de scie, carré…) ;</li><li><b>Filtre</b> : enlève une partie des fréquences (on « sculpte ») ;</li><li><b>Enveloppes</b> : font évoluer le volume et le filtre dans le temps (attaque, déclin…).</li></ol>
      <p>Les réglages sont dans le panneau de droite. Lance la lecture et écoute chaque changement.</p>`,
    steps: [
      { html: 'Sélectionne <b>Mon synthé</b> et lance la lecture.', hl: (x) => [nameHl(x.find('synth')), 'play'], check: (x) => x.sel?.type === 'synth' && x.snap.playing },
      { html: '<b>Forme d\'onde</b> : passe <b>Forme 1</b> sur <b>Carré</b>. Son plus creux, « jeu vidéo ». Essaie aussi Sinus (très doux) puis garde <b>Scie</b> (le plus brillant).', hl: ['p.w1'], check: (x) => { if (x.sel?.params.w1 === 1) x.mem.sq = 1; return x.mem.sq && x.sel?.params.w1 === 0; } },
      { html: '<b>Filtre</b> : baisse la <b>Coupure</b> sous <b>800 Hz</b>. Les aigus disparaissent : le son devient sourd, comme derrière un mur.', hl: ['p.cut'], check: (x) => (x.sel?.params.cut ?? 1e5) < 800, live: (x) => `coupure : ${Math.round(x.sel?.params.cut ?? 0)} Hz` },
      { html: 'Monte la <b>Résonance</b> au-dessus de 60 % : la zone de la coupure se met à « siffler ». Tourne la coupure en même temps : c\'est le son « acid ».', hl: ['p.res', 'p.cut'], check: (x) => (x.sel?.params.res ?? 0) > 0.6 },
      { html: '<b>Enveloppe du filtre</b> : mets <b>Env → filtre</b> vers <b>+4 oct</b>, <b>F maintien</b> à 0 et <b>F déclin</b> vers 200 ms. Chaque note s\'ouvre puis se referme : un son « pluck ».', hl: ['p.fenv', 'p.fs', 'p.fd'], check: (x) => (x.sel?.params.fenv ?? 0) >= 2.5 && (x.sel?.params.fs ?? 1) < 0.2 },
      { html: '<b>Enveloppe de volume (ADSR)</b> : monte l\'<b>Attaque</b> au-dessus de 300 ms. Les notes « gonflent » au lieu de frapper : c\'est le principe d\'une nappe (pad).', hl: ['p.a'], check: (x) => (x.sel?.params.a ?? 0) > 300, live: (x) => `attaque : ${Math.round(x.sel?.params.a ?? 0)} ms` },
      { html: 'Remets l\'<b>Attaque</b> courte (moins de 10 ms).', hl: ['p.a'], check: (x) => (x.sel?.params.a ?? 99) < 10 },
      { html: '<b>Unisson</b> : mets <b>7</b> voix et monte le <b>Désaccord</b> au-dessus de 40 %. 7 dents de scie légèrement fausses = la fameuse <b>supersaw</b> du hardstyle et de la trance.', hl: ['p.uni', 'p.det'], check: (x) => (x.sel?.params.uni ?? 1) >= 6 && (x.sel?.params.det ?? 0) > 0.4 },
    ],
    outro: '<p>Tous les sons de synthé partent de là. Les préréglages (liste en haut du panneau) sont de bons points de départ : ouvre-les et regarde comment ils sont réglés.</p>',
  },
  // =====================================================================================================
  {
    id: 'kick-hardcore', chap: '3 · Le son', title: 'Fabriquer un kick hardcore', desc: 'Pitch drop, distorsion, queue accordée : le cœur du hardcore.',
    setup() {
      const { p, chs, pat } = proj('Cours · Kick hardcore', 175, ['kick-house']);
      const k = chs[0]; k.name = 'Mon kick'; k.preset = ''; k.params = { ...k.params, start: 300, pdec: 40, end: 55, hold: 10, decay: 250, tail: 0, click: 0.3, shape: 0, drive: 0, dtype: 0, tone: 12000, vol: -3 };
      fill(pat, k, [0, 4, 8, 12]);
      return p;
    },
    view: 'rack',
    intro: `<p>En hardcore, <b>le kick est l'instrument principal</b> : c'est lui qui porte le morceau. Un kick, c'est une onde sinusoïdale dont la hauteur <b>tombe très vite</b> (le « pitch drop »), puis qu'on <b>distord</b> beaucoup.</p>
      <p>On part d'un kick tout propre (façon house) et on le transforme, étape par étape. Lance la lecture et écoute après chaque réglage.</p>`,
    steps: [
      { html: 'Sélectionne <b>Mon kick</b> et lance la lecture.', hl: (x) => [nameHl(x.find('kick')), 'play'], check: (x) => x.sel?.type === 'kick' && x.snap.playing },
      { html: '<b>Départ</b> : monte la hauteur de départ au-dessus de <b>1500 Hz</b>. Le début du kick claque beaucoup plus : c\'est le « tok » / le punch.', hl: ['p.start'], check: (x) => (x.sel?.params.start ?? 0) >= 1500, live: (x) => `départ : ${Math.round(x.sel?.params.start ?? 0)} Hz` },
      { html: '<b>Descente</b> : rends-la plus rapide, sous <b>20 ms</b>. La hauteur tombe d\'un coup : punch sec au lieu d\'un « piou ».', hl: ['p.pdec'], check: (x) => (x.sel?.params.pdec ?? 99) <= 20, live: (x) => `descente : ${(x.sel?.params.pdec ?? 0).toFixed(0)} ms` },
      { html: '<b>Distorsion</b> : monte-la au-dessus de <b>25 dB</b>. Le kick devient un « bourdonnement » saturé, typique du hardcore. Attention au volume !', hl: ['p.drive'], check: (x) => (x.sel?.params.drive ?? 0) >= 25, live: (x) => `distorsion : ${(x.sel?.params.drive ?? 0).toFixed(0)} dB` },
      { html: '<b>Type</b> de distorsion : essaie <b>Dure</b> (agressive) puis <b>Repli</b> (métallique, très hardcore/uptempo). Garde celui que tu préfères.', hl: ['p.dtype'], check: (x) => [1, 2].includes(x.sel?.params.dtype) },
      { html: '<b>Durée</b> : règle-la entre <b>300 et 550 ms</b>. Trop court = ça sonne techno ; trop long à 175 BPM = les kicks se marchent dessus (un nouveau kick coupe le précédent).', hl: ['p.decay'], check: (x) => { const d = x.sel?.params.decay ?? 0; return d >= 300 && d <= 550; }, live: (x) => `durée : ${Math.round(x.sel?.params.decay ?? 0)} ms` },
      { html: '<b>Tonalité</b> : la distorsion crée beaucoup d\'aigus qui fatiguent l\'oreille. Baisse-la entre <b>4 000 et 9 000 Hz</b> pour un kick plus « gras ».', hl: ['p.tone'], check: (x) => { const t = x.sel?.params.tone ?? 0; return t >= 4000 && t <= 9000; } },
      { html: '<b>Queue</b> : c\'est la note que joue le kick après le punch. Les producteurs l\'accordent sur la tonalité du morceau. Règle-la vers <b>55 Hz</b> (= La, pour un morceau en La mineur).', hl: ['p.end'], check: (x) => Math.abs((x.sel?.params.end ?? 0) - 55) < 3, live: (x) => `queue : ${(x.sel?.params.end ?? 0).toFixed(1)} Hz (objectif ≈ 55)` },
    ],
    outro: `<p>Tu viens de faire un kick hardcore ! Pour aller plus loin, comme les pros :</p>
      <ul><li>sur la piste du kick dans le <b>mixeur</b>, ajoute un <b>EQ</b> (baisse un peu les médiums vers 400 Hz, ils rendent le kick « carton ») puis une 2ᵉ <b>Distorsion</b>, puis un <b>Limiteur</b> ;</li>
      <li>dans le <b>piano roll</b>, tu peux faire jouer au kick d'autres notes que C5 : la queue change de hauteur → une <b>mélodie de kick</b> (cours uptempo).</li></ul>`,
  },
  // =====================================================================================================
  {
    id: 'mixeur', chap: '4 · Mixage', title: 'Le mixeur', desc: 'Pistes, faders, niveaux : un mix propre qui ne sature pas.',
    setup() {
      const { p, chs, pat } = proj('Cours · Mixeur', 175, ['kick-hardcore', 'clap-hardcore', 'hat', 'screech']);
      fill(pat, chs[0], [0, 4, 8, 12]); fill(pat, chs[1], [4, 12]); fill(pat, chs[2], [2, 6, 10, 14]);
      pat.notes[chs[3].id] = [[0, 69], [3, 69], [6, 72], [8, 69], [12, 67]].map(([s, k]) => ({ t: s * STEP, len: 3 * STEP, key: k, vel: 0.8 }));
      for (const c of chs) c.ins = 0;
      chs[1].vol = 1; chs[3].vol = 1; p.mixer[0].vol = 1;
      return p;
    },
    view: 'rack',
    intro: `<p>Le <b>mixeur</b> reçoit tous les instruments. Chaque instrument doit avoir <b>sa propre piste</b> : on peut alors régler son volume, son placement (pan) et lui ajouter des <b>effets</b> (EQ, compresseur, reverb…), sans toucher aux autres.</p>
      <p>Ici, tout est envoyé directement au master et c'est trop fort : on va ranger tout ça.</p>`,
    steps: [
      { html: 'Lance la lecture : le master sature (le coach le signale). Dans le séquenceur, le petit bouton <b>M</b> à gauche de chaque nom = la piste du mixeur. Clique celui du <b>kick</b> et choisis la <b>piste 1</b>.', hl: (x) => [`@.rrow[data-ch="${x.find('kick')?.id}"] [data-ctl="ch-ins"]`], check: (x) => x.find('kick')?.ins > 0 },
      { html: 'Envoie le <b>clap</b>, le <b>charley</b> et le <b>screech</b> chacun sur sa piste (2, 3, 4 — une piste différente par instrument).', hl: ['ch-ins'],
        check: (x) => { const ins = x.p.channels.map((c) => c.ins); return ins.every((i) => i > 0) && new Set(ins).size === ins.length; } },
      { html: 'Ouvre le <b>Mixeur</b> (<span class="k">F9</span>). Chaque piste a un <b>VU-mètre</b> (le niveau) et un <b>fader</b> (le volume).', hl: ['tab-mixer'], check: (x) => x.app.view === 'mixer' },
      { html: 'Règle les volumes : le <b>kick</b> doit rester le plus fort (en hardcore, tout se construit autour de lui). Baisse le fader du <b>screech</b> et du <b>clap</b> sous 0 dB (sous le trait).', hl: (x) => [`fader:${x.find('screech')?.ins}`, `fader:${x.find('clap-hardcore')?.ins}`],
        check: (x) => x.p.mixer[x.find('screech')?.ins]?.vol < 0.75 && x.p.mixer[x.find('clap-hardcore')?.ins]?.vol < 0.75 },
      { html: '<b>Solo</b> (S) : écoute une piste seule. Mets le <b>kick</b> en solo, écoute, puis enlève le solo.', hl: (x) => [`ins:${x.find('kick')?.ins}`],
        check: (x) => { const m = x.p.mixer[x.find('kick')?.ins]; if (m?.solo) x.mem.s = 1; return x.mem.s && !m?.solo; } },
      { html: 'Le <b>master</b> (tout à gauche) est la sortie finale. Baisse son fader pour que les crêtes ne touchent plus le rouge pendant <b>4 secondes</b> de lecture.', hl: ['master-fader', 'master-meter'],
        check: (x) => x.hold('nc', x.snap.playing && (x.snap.ins[0] ?? 0) < -0.3, 4000), live: (x) => `master : ${(x.snap.ins[0] ?? -120).toFixed(1)} dB (objectif : sous −0,3)` },
    ],
    outro: '<p>Règle d\'or : <b>mixe d\'abord avec les faders</b>, à volume modéré, avant d\'ajouter des effets. Un bon mix laisse de la marge sur le master (crêtes vers −6 dB), puis un limiteur remonte le volume à la fin.</p>',
  },
  // =====================================================================================================
  {
    id: 'effets', chap: '4 · Mixage', title: 'Les effets', desc: 'EQ, reverb, delay, distorsion, limiteur : à quoi ils servent.',
    setup() {
      const { p, chs, pat } = proj('Cours · Effets', 170, ['kick-hardcore', 'clap-hardcore', 'screech']);
      fill(pat, chs[0], [0, 4, 8, 12]); fill(pat, chs[1], [4, 12]);
      pat.notes[chs[2].id] = [[0, 69], [3, 69], [6, 72], [8, 69], [12, 67]].map(([s, k]) => ({ t: s * STEP, len: 3 * STEP, key: k, vel: 0.8 }));
      return p;
    },
    view: 'mixer',
    intro: `<p>Les effets se mettent sur les <b>pistes du mixeur</b>. Clique une piste pour voir sa chaîne d'effets à droite, puis « Ajouter un effet ». Ils s'appliquent dans l'ordre, de haut en bas.</p>`,
    steps: [
      { html: 'Lance la lecture, puis clique sur la piste du <b>clap</b> dans le mixeur.', hl: (x) => [`ins:${x.find('clap-hardcore')?.ins}`], check: (x) => x.app.mixer.selIns === x.find('clap-hardcore')?.ins && x.snap.playing },
      { html: 'Ajoute une <b>Réverbération</b> : le clap sonne comme dans une grande salle. Garde le <b>Niveau</b> sous 35 % : trop de reverb rend le mix flou.', hl: ['add-fx', 'fx:reverb.mix'],
        check: (x) => { const f = x.fx(x.find('clap-hardcore')?.ins, 'reverb'); return f && f.p[2] <= 0.35 && f.p[2] > 0.05; } },
      { html: 'Sur la piste du <b>screech</b>, ajoute un <b>Delay</b> (écho). Temps <b>3 pas</b> = croche pointée, l\'écho classique qui « rebondit ».', hl: (x) => [`ins:${x.find('screech')?.ins}`, 'add-fx'], check: (x) => !!x.fx(x.find('screech')?.ins, 'delay') },
      { html: 'Sur la piste du <b>kick</b>, ajoute un <b>EQ 3 bandes</b> et baisse les <b>Médiums</b> (−3 dB ou plus) : le kick paraît plus « gros » et laisse de la place au lead.', hl: (x) => [`ins:${x.find('kick')?.ins}`, 'add-fx', 'fx:eq.mid'],
        check: (x) => (x.fx(x.find('kick')?.ins, 'eq')?.p[1] ?? 0) <= -3 },
      { html: 'Toujours sur le kick, ajoute une <b>Distorsion</b> après l\'EQ. En hardcore, on empile souvent : kick distordu → EQ → distorsion → EQ… Écoute la différence avec le bouton ON/OFF.', hl: ['add-fx'], check: (x) => !!x.fx(x.find('kick')?.ins, 'dist') },
      { html: 'Enfin, sur le <b>Master</b>, ajoute un <b>Limiteur</b> : il empêche toute saturation et permet de monter le volume global avec son <b>Gain</b>.', hl: ['ins:0', 'add-fx'], check: (x) => !!x.fx(0, 'limiter') },
    ],
    outro: '<ul><li><b>EQ</b> : faire de la place (chaque son a sa zone de fréquences) ;</li><li><b>Compresseur</b> : rendre le niveau régulier, donner du punch ;</li><li><b>Reverb / delay</b> : espace et profondeur (jamais sur le kick) ;</li><li><b>Distorsion</b> : agressivité, chaleur ;</li><li><b>Limiteur</b> : en dernier sur le master.</li></ul>',
  },
  // =====================================================================================================
  {
    id: 'playlist', chap: '5 · Arrangement', title: 'La playlist', desc: 'Assembler les motifs dans le temps pour faire un morceau.',
    setup() {
      const p = emptyProject('Cours · Playlist'); p.bpm = 175;
      const kick = addChannel(p, 'kick-hardcore'), clap = addChannel(p, 'clap-hardcore'), hat = addChannel(p, 'hat'), scr = addChannel(p, 'screech'), pad = addChannel(p, 'pad');
      const beat = p.patterns[0]; beat.name = 'Beat'; fill(beat, kick, [0, 4, 8, 12]); fill(beat, clap, [4, 12]); fill(beat, hat, [2, 6, 10, 14]);
      const mel = addPattern(p, 'Mélodie', 32); mel.notes[scr.id] = [[0, 69], [3, 69], [6, 72], [8, 69], [12, 67], [14, 64], [16, 65], [19, 65], [22, 69], [24, 67], [28, 64]].map(([s, k]) => ({ t: s * STEP, len: 3 * STEP, key: k, vel: 0.8 }));
      const brk = addPattern(p, 'Nappe', 64); [[57, 60, 64], [53, 57, 60], [55, 60, 64], [55, 59, 62]].forEach((c, i) => c.forEach((k) => (brk.notes[pad.id] ||= []).push({ t: i * 16 * STEP, len: 16 * STEP, key: k, vel: 0.7 })));
      addFx(p, pad.ins, 'reverb', { size: 0.8, mix: 0.35 });
      return p;
    },
    view: 'playlist',
    intro: `<p>La <b>playlist</b> est la ligne du temps du morceau : on y place des <b>motifs</b>. Chaque ligne est une piste (juste pour ranger : n'importe quel motif va sur n'importe quelle piste). Les numéros en haut sont les <b>mesures</b>.</p>
      <p>Pour jouer la playlist, il faut passer la lecture en mode <b>MORCEAU</b> (en haut à gauche).</p>`,
    steps: [
      { html: 'À gauche de la playlist, clique le motif <b>Beat</b> pour le choisir, puis clique dans la grille sur la <b>piste 1, mesure 1</b>.', hl: ['pl-patterns', 'playlist'],
        check: (x) => x.p.playlist.clips.some((c) => c.pat === x.p.patterns[0].id) },
      { html: 'Un clip se <b>déplace</b> en le glissant et se <b>rallonge</b> par son bord droit (le motif se répète). Rallonge le Beat sur <b>8 mesures</b> (ou pose-le plusieurs fois).', hl: ['playlist'],
        check: (x) => x.p.playlist.clips.filter((c) => c.pat === x.p.patterns[0].id).reduce((a, c) => a + c.len, 0) >= 8 * BAR },
      { html: 'Place la <b>Mélodie</b> sur la piste 2, à partir de la <b>mesure 5</b> : le lead arrive après 4 mesures de beat seul.', hl: ['pl-patterns', 'playlist'],
        check: (x) => x.p.playlist.clips.some((c) => c.pat === x.p.patterns[1].id && c.start >= 4 * BAR) },
      { html: 'Place la <b>Nappe</b> sur la piste 3, après la fin du beat (mesure 9 ou plus) : ce sera le <b>break</b>.', hl: ['pl-patterns', 'playlist'],
        check: (x) => x.p.playlist.clips.some((c) => c.pat === x.p.patterns[2].id && c.start >= 8 * BAR) },
      { html: 'Passe en mode <b>MORCEAU</b> et lance la lecture (ou « ▶ Écouter le morceau »). Clic dans la règle des mesures = écouter depuis là.', hl: ['mode', 'pl-play'], check: (x) => x.app.songMode && x.snap.playing },
    ],
    outro: '<p>Clic droit = retirer un clip ; double-clic = éditer le motif. Le morceau s\'arrête au trait rouge (fin du dernier clip) puis reboucle.</p>',
  },
  // =====================================================================================================
  {
    id: 'structure', chap: '5 · Arrangement', title: 'Structure d\'un morceau hardcore', desc: 'Intro, break, montée, drop : construire la tension.',
    setup() {
      const p = emptyProject('Cours · Structure'); p.bpm = 175;
      const kick = addChannel(p, 'kick-hardcore'), clap = addChannel(p, 'clap-hardcore'), hat = addChannel(p, 'hat'), scr = addChannel(p, 'screech'), pad = addChannel(p, 'pad');
      const beat = p.patterns[0]; beat.name = 'Beat'; fill(beat, kick, [0, 4, 8, 12]); fill(beat, clap, [4, 12]); fill(beat, hat, [2, 6, 10, 14]);
      const mel = addPattern(p, 'Screech', 32); mel.notes[scr.id] = [[0, 69], [3, 69], [6, 72], [8, 69], [12, 67], [14, 64], [16, 65], [19, 65], [22, 69], [24, 67], [28, 64]].map(([s, k]) => ({ t: s * STEP, len: 3 * STEP, key: k, vel: 0.8 }));
      const brk = addPattern(p, 'Break', 64); [[57, 60, 64], [53, 57, 60], [55, 60, 64], [55, 59, 62]].forEach((c, i) => c.forEach((k) => (brk.notes[pad.id] ||= []).push({ t: i * 16 * STEP, len: 16 * STEP, key: k, vel: 0.7 })));
      const roll = addPattern(p, 'Roulement', 16); fill(roll, kick, [0, 4, 8, 10, 12, 13, 14, 15]);
      addFx(p, pad.ins, 'reverb', { size: 0.8, mix: 0.35 }); addFx(p, scr.ins, 'reverb', { size: 0.6, mix: 0.2 });
      return p;
    },
    view: 'playlist',
    intro: `<p>Un morceau hardcore (et de dance en général) se découpe en <b>phrases de 8 ou 16 mesures</b> :</p>
      <table class="tbl"><tr><td><b>Intro</b></td><td>kick + percus, pour que le DJ puisse mixer</td></tr><tr><td><b>Break</b></td><td>plus de kick : nappe, mélodie, voix → émotion, tension</td></tr>
      <tr><td><b>Montée</b></td><td>roulement de kick qui accélère, filtre qui s'ouvre</td></tr><tr><td><b>Drop</b></td><td>tout revient en même temps : kick + lead à fond</td></tr><tr><td><b>Outro</b></td><td>kick + percus, pour le DJ</td></tr></table>
      <p>Le contraste est la clé : <b>le drop frappe fort parce que le break l'a privé de kick</b>.</p>`,
    steps: [
      { html: '<b>Intro</b> : place <b>Beat</b> de la mesure 1 à 8 (8 mesures).', hl: ['playlist', 'pl-patterns'],
        check: (x) => x.p.playlist.clips.some((c) => c.pat === x.p.patterns[0].id && c.start === 0 && c.len >= 8 * BAR) },
      { html: '<b>Break</b> : place <b>Break</b> de la mesure 9 à 16, <b>sans</b> Beat pendant ce temps.', hl: ['playlist', 'pl-patterns'],
        check: (x) => { const P = x.p.patterns, cl = x.p.playlist.clips; return cl.some((c) => c.pat === P[2].id && c.start >= 8 * BAR && c.start < 9 * BAR) && !cl.some((c) => c.pat === P[0].id && c.start < 16 * BAR && c.start + c.len > 9 * BAR); } },
      { html: '<b>Montée</b> : place <b>Roulement</b> sur la mesure <b>16</b> (la dernière du break).', hl: ['playlist', 'pl-patterns'],
        check: (x) => x.p.playlist.clips.some((c) => c.pat === x.p.patterns[3].id && c.start === 15 * BAR) },
      { html: '<b>Drop</b> : à partir de la mesure <b>17</b>, place <b>Beat</b> et <b>Screech</b> ensemble pendant 8 mesures.', hl: ['playlist', 'pl-patterns'],
        check: (x) => { const P = x.p.patterns, cl = x.p.playlist.clips; const ok = (id) => cl.some((c) => c.pat === id && c.start === 16 * BAR && c.len >= 8 * BAR) || cl.filter((c) => c.pat === id && c.start >= 16 * BAR).reduce((a, c) => a + c.len, 0) >= 8 * BAR; return ok(P[0].id) && ok(P[1].id); } },
      { html: 'Écoute le tout en mode <b>MORCEAU</b>. Sens comme le drop frappe après le break !', hl: ['mode', 'pl-play'], check: (x) => x.app.songMode && x.snap.playing },
    ],
    outro: '<p>Les vrais morceaux font souvent 2 breaks et 2 drops (le 2ᵉ drop avec une variation). Écoute la démo <b>Hardcore 175</b> (navigateur → Démos) pour un exemple complet.</p>',
  },
  // =====================================================================================================
  {
    id: 'beat-hardcore', chap: '6 · Hardcore & uptempo', title: 'Un beat hardcore complet', desc: 'Tempo, kick, clap superposé, offbeat, roulement.',
    setup() { return proj('Cours · Beat hardcore', 140, ['kick-hardcore', 'clap-hardcore', 'hat', 'ohat', 'crash']).p; },
    view: 'rack',
    intro: '<p>On assemble tout ce qu\'on a vu pour faire un vrai beat hardcore, de zéro.</p>',
    steps: [
      { html: 'Mets le tempo entre <b>170 et 190 BPM</b>.', hl: ['bpm'], check: (x) => x.p.bpm >= 170 && x.p.bpm <= 190, live: (x) => `tempo : ${x.p.bpm} BPM` },
      { html: 'Kick sur les 4 temps (pas 1, 5, 9, 13).', hl: (x) => stepHl(x, x.find('kick'), [0, 4, 8, 12]), check: (x) => x.has(x.stepsOf(x.find('kick')), [0, 4, 8, 12]) },
      { html: 'Clap sur 2 et 4 (pas 5 et 13) : en hardcore il tombe <b>en même temps</b> que le kick, ça renforce l\'impact.', hl: (x) => stepHl(x, x.find('clap-hardcore'), [4, 12]), check: (x) => x.has(x.stepsOf(x.find('clap-hardcore')), [4, 12]) },
      { html: 'Charley fermé en offbeat (3, 7, 11, 15) et <b>charley ouvert</b> sur le pas 15 seulement : il « respire » avant la mesure suivante.', hl: (x) => [...stepHl(x, x.find('hat'), [2, 6, 10, 14]), ...stepHl(x, x.find('ohat'), [14])],
        check: (x) => x.has(x.stepsOf(x.find('hat')), [2, 6, 10, 14]) && x.stepsOf(x.find('ohat')).has(14) },
      { html: 'Écoute (Espace).', hl: ['play'], check: (x) => x.snap.playing },
      { html: 'Crée un 2ᵉ motif (＋) et écris un <b>roulement</b> : kicks de plus en plus serrés, par ex. pas 1, 5, 9, 11, 13, 14, 15, 16. Ajoute la <b>crash</b> sur le pas 1 du motif Beat : elle marque le début des phrases.', hl: ['pattern-add'],
        check: (x) => x.p.patterns.length >= 2 && x.p.patterns.some((pt) => { const s = x.stepsOf(x.find('kick'), pt); return s.size >= 7 && x.has(s, [12, 13, 14, 15]); }) },
    ],
    outro: '<p>Prochaine étape : un <b>screech</b> ou un <b>lead</b> par-dessus (cours suivant), puis l\'arrangement dans la playlist.</p>',
  },
  // =====================================================================================================
  {
    id: 'screech', chap: '6 · Hardcore & uptempo', title: 'Le screech', desc: 'Le son qui crie : passe-bande résonant, vibrato rapide, distorsion.',
    setup() {
      const { p, chs, pat } = proj('Cours · Screech', 175, ['kick-hardcore', 'pluck']);
      fill(pat, chs[0], [0, 4, 8, 12]);
      const s = chs[1]; s.name = 'Mon screech'; s.preset = ''; s.params = { ...s.params, w1: 0, uni: 1, cut: 3000, res: 0.1, fenv: 0, fs: 1, a: 2, d: 300, s: 0.8, r: 120, vol: -12 };
      pat.notes[s.id] = [[0, 69], [3, 69], [6, 72], [8, 69], [12, 67]].map(([st, k]) => ({ t: st * STEP, len: 3 * STEP, key: k, vel: 0.8 }));
      return p;
    },
    view: 'rack',
    intro: '<p>Le <b>screech</b> est le son aigu qui « crie » dans les drops hardcore. Recette : une onde riche, un filtre <b>passe-bande</b> très <b>résonant</b>, un <b>vibrato rapide</b>, une petite chute de hauteur au début de chaque note, et de la <b>distorsion</b>.</p>',
    steps: [
      { html: 'Sélectionne <b>Mon screech</b> et lance la lecture.', hl: (x) => [nameHl(x.find('synth')), 'play'], check: (x) => x.sel?.type === 'synth' && x.snap.playing },
      { html: 'Forme 1 sur <b>Carré</b>.', hl: ['p.w1'], check: (x) => x.sel?.params.w1 === 1 },
      { html: 'Filtre en <b>Passe-bande</b>, <b>Résonance</b> au-dessus de 65 %, coupure entre 1 000 et 3 000 Hz.', hl: ['p.ftype', 'p.res', 'p.cut'],
        check: (x) => x.sel?.params.ftype === 2 && x.sel.params.res > 0.65 && x.sel.params.cut >= 1000 && x.sel.params.cut <= 3000 },
      { html: '<b>Vibrato</b> : LFO vitesse au-dessus de <b>7 Hz</b> et LFO → hauteur au-dessus de <b>0,4 demi-ton</b>. Le son se met à trembler.', hl: ['p.lfo_rate', 'p.lfo_pitch'],
        check: (x) => x.sel?.params.lfo_rate > 7 && x.sel.params.lfo_pitch > 0.4 },
      { html: '<b>Env → hauteur</b> au-dessus de <b>+8 demi-tons</b> avec une durée courte (moins de 100 ms) : chaque note « tombe » en arrivant.', hl: ['p.penv', 'p.pdec'],
        check: (x) => x.sel?.params.penv >= 8 && x.sel.params.pdec < 100 },
      { html: 'Sur sa piste du mixeur, ajoute une <b>Distorsion</b> (type Dure) puis une <b>Réverbération</b>. (Mixeur → clique sa piste → Ajouter un effet.)', hl: ['tab-mixer', 'add-fx'],
        check: (x) => { const i = x.find('synth')?.ins; return !!x.fx(i, 'dist') && !!x.fx(i, 'reverb'); } },
    ],
    outro: '<p>Le préréglage <b>Screech hardcore</b> part de cette recette. Essaie aussi : Mono + Glissando (les notes glissent), ou 3 voix d\'unisson pour l\'épaissir.</p>',
  },
  // =====================================================================================================
  {
    id: 'uptempo', chap: '6 · Hardcore & uptempo', title: 'L\'uptempo et la mélodie de kick', desc: '200+ BPM, queue de kick longue, kick qui joue une mélodie.',
    setup() { const { p, chs, pat } = proj('Cours · Uptempo', 180, ['kick-uptempo', 'clap-hardcore', 'hat']); fill(pat, chs[1], [4, 12]); fill(pat, chs[2], [2, 6, 10, 14]); return p; },
    view: 'rack',
    intro: `<p>L'<b>uptempo</b> pousse le hardcore au-delà de <b>200 BPM</b>. Le kick y est très « tok » (attaque aiguë, distorsion en repli) avec une <b>queue</b> qui chante : on lui fait jouer <b>une mélodie</b> en changeant la note de chaque kick dans le piano roll.</p>`,
    steps: [
      { html: 'Tempo à <b>200 BPM</b> ou plus.', hl: ['bpm'], check: (x) => x.p.bpm >= 200, live: (x) => `tempo : ${x.p.bpm} BPM` },
      { html: 'Sélectionne le <b>Kick uptempo</b> et monte sa <b>Queue longue</b> au-dessus de 40 % : la fin du kick traîne et devient une note.', hl: (x) => [nameHl(x.find('kick')), 'p.tail'], check: (x) => x.find('kick')?.params.tail >= 0.4 },
      { html: 'Ouvre le <b>piano roll</b> du kick (<span class="k">F7</span>). Mets la grille sur <b>Temps</b> et pose un kick sur chaque temps de la mesure (4 notes), sur <b>C5</b>.', hl: ['tab-piano', 'pr-snap', 'piano'],
        check: (x) => x.app.view === 'piano' && x.notes(x.find('kick')).length >= 4 },
      { html: 'Maintenant <b>déplace verticalement</b> un ou deux kicks (par ex. sur D#5 ou F5) : la queue change de hauteur. C\'est une <b>mélodie de kick</b> !', hl: ['piano'],
        check: (x) => new Set(x.notes(x.find('kick')).map((n) => n.key)).size >= 2 },
      { html: 'Écoute en boucle. Dans le séquenceur, la ligne du kick affiche maintenant un mini piano roll au lieu des pas.', hl: ['play'], check: (x) => x.snap.playing },
    ],
    outro: '<p>Ouvre la démo <b>Uptempo 220</b> pour une mélodie de kick sur 2 mesures avec un roulement. Astuce : garde les notes du kick dans la gamme du morceau (cours « Gammes »).</p>',
  },
  // =====================================================================================================
  {
    id: 'export', chap: '7 · Finir un morceau', title: 'Enregistrer et exporter', desc: 'Sauvegarder le projet et créer un fichier WAV.',
    steps: [
      { html: '<b>Enregistre</b> ton projet (<span class="k">Ctrl+S</span> ou « Enregistrer »). Le fichier <b>.irisp</b> va dans Documents\\IrisStudio. Le projet est aussi sauvegardé automatiquement, mais seulement le dernier état.', hl: ['@#btn-save'], check: (x) => x.ev('save') },
      { html: '<b>Exporte</b> en WAV (« Exporter WAV ») : le morceau entier (playlist) ou juste le motif. Le fichier va dans Musique\\IrisStudio : tu peux l\'écouter partout, l\'envoyer, ou le mixer dans <b>IrisDJ</b> !', hl: ['export'], check: (x) => x.ev('export') },
    ],
    outro: '<p>Bravo, tu as fait le tour ! Pour progresser : refais un morceau inspiré d\'un titre que tu aimes (même tempo, même structure), et demande des conseils à Orbiz en lui montrant ton projet.</p>',
  },
];
