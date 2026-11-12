# IrisStudio

Studio de création musicale gratuit façon FL Studio (séquenceur pas à pas, piano roll, playlist, mixeur + effets), orienté hardcore/uptempo mais généraliste, avec cours interactifs. **Rust + Tauri 2** (modèle d'IrisDJ) : moteur audio en Rust, interface HTML/CSS/JS dans WebView2. Pilotable par Orbiz via iris-link (id `irisstudio`). Lancement : `IrisStudio.vbs` (lance `target\release\irisstudio.exe`), raccourci `IrisStudio.lnk`, entrée `irisstudio` dans `../Orbiz/actions.js` (icône `steps` dans `Orbiz/src/icons.js`).

## Compiler
`cargo build --release` (Rust dans `%USERPROFILE%\.cargo\bin`). **`ui/` est intégré au binaire** : recompiler après chaque modif d'interface. `cargo build` → `target\debug\irisstudio.exe` (console visible).
Test du moteur sans interface : `irisstudio.exe --render projet.json sortie.wav [song|pattern]` (affiche les crêtes par piste du mixeur ; piste 0 = master avant le limiteur).

## Rust (`src/`)
- `song.rs` : projet JSON → morceau compilé (canaux, motifs, liste d'évènements de la playlist, pistes du mixeur, effets). Ticks : 96 par temps, 1 pas = 24, 1 mesure = 384. Swing appliqué ici. `Samples` = cache des fichiers audio (décodés + rééchantillonnés).
- `audio/core.rs` : fil temps réel (séquenceur motif/morceau, 96 voix, 13 pistes de mixeur, métronome, limiteur master). Commandes par file sans verrou (`Cmd`), télémétrie par atomiques. Le morceau entier est remplacé à chaque modification ; l'état des effets (tampons delay/reverb) est repris par id d'effet (`known_fx` évite d'allouer à chaque fois), les voix suivent leur canal par id.
- `audio/inst.rs` : kick (pitch drop, distorsion 5 types, queue accordée sur la note), percus synthétisées (clap, caisse claire, charleys, crash, tom, percu), synthé soustractif (2 osc + unisson 7 voix, sub, filtre SVF, 2 ADSR, env de hauteur, LFO, glissando/mono), sampler.
- `audio/fx.rs` : EQ, filtre, distorsion, compresseur, delay (calé tempo), reverb (Freeverb), limiteur ; paramètres = tableau `p[8]` (sens dans `ui/js/instruments.js` → `FX`).
- `audio/dsp.rs`, `audio/mod.rs` (sortie cpal, copié d'IrisDJ sans casque), `export.rs` (WAV 24 bits hors ligne), `decode.rs` (copié d'IrisDJ), `irislink.rs` (outils + INSTRUCTIONS pour Orbiz), `store.rs`.
- Données : `%APPDATA%\IrisStudio\autosave.irisp` ; projets `Documents\IrisStudio\*.irisp` ; exports `Musique\IrisStudio`.

## Interface (`ui/js/`)
- `project.js` : modèle JSON + `Store` (annuler/rétablir par instantanés JSON, envoi `set_project` une requête à la fois, sauvegarde auto). Réglages continus : `app.tweak(clé, fn)` (silencieux, regroupé dans l'historique) ; sinon `store.change(fn)` reconstruit les vues.
- `instruments.js` : paramètres des instruments/effets (plages, aides en français) et préréglages. Convention FL : 60 = C5.
- `app.js` (transport, clavier, fichiers, fenêtres), `rack.js` (séquenceur), `pianoroll.js`, `playlist.js`, `mixer.js`, `inspector.js`, `browser.js`, `demos.js` (7 démos : hardcore, uptempo, hardstyle, techno, house, hip-hop, DnB), `coach.js`, `learn.js` + `lessons.js` (16 cours ; étapes avec `check(x)`, `hl` = data-ctl / data-zone / `@sélecteur`), `agent.js` (`window.irisAgent`), `bridge.js`.

## Tester
Lancer l'exe puis `require('../iris-link/pipe').request('irisstudio', { cmd: 'call', tool: 'get_state', args: {} })`. `execute_javascript` : `window.__app` = app. `screenshot` renvoie un PNG.

## Idées v2
Automatisation (courbes de filtre/volume dans la playlist), sidechain, export des pistes séparées, entrée MIDI, enregistrement au clavier dans le piano roll, sélection multiple de notes.

## Briques partagées
Dépend de `../iris-briques` (workspace Rust, publié sur github.com/Iris-universe/iris-briques) : `iris-decode` (`src/decode.rs` la ré-exporte), `iris-store` (`read_json`/`write_json`…), `iris-link` (pipe, manifeste, outils génériques, capture d'écran ; `src/irislink.rs` ne contient plus que ID/NOM/INSTRUCTIONS/outils). Tout outil déclaré (sauf `screenshot`) est exécuté dans la page. Modifier une brique = la modifier dans `iris-briques` (elle sert aux autres apps).

## Briques partagées : où elles sont prises
`Cargo.toml` les prend sur GitHub (`github.com/Iris-universe/iris-briques`) ; `.cargo/config.toml` (local, non versionné) les redirige vers `../iris-briques` pour développer. Modifier une brique = la modifier dans `iris-briques`, puis la pousser.
