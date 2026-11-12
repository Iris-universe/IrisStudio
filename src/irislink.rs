// iris-link côté app, en Rust : rend IrisStudio pilotable par l'assistant d'Orbiz.
// Le protocole (pipe, manifeste, outils génériques, capture) est dans la brique iris-link.

use serde_json::{json, Value};

pub const ID: &str = "irisstudio";
const NAME: &str = "IrisStudio";
const DESCRIPTION: &str = "Studio de création musicale gratuit façon FL Studio (séquenceur pas à pas, piano roll, playlist, mixeur avec effets, kicks hardcore/uptempo, percus, synthé, sampler) avec cours interactifs.";
const INSTRUCTIONS: &str = "Tu es le PROF DE PRODUCTION MUSICALE de l'utilisateur dans IrisStudio, un studio façon FL Studio. Adapte-toi au niveau et aux styles de l'utilisateur (voir son profil s'il y en a un).
- Commence par get_state : projet ouvert (tempo, canaux, motifs, playlist, mixeur), canal et motif sélectionnés, cours en cours, conseils du coach.
- Explique simplement, en français, avec le vocabulaire de la prod (pas, motif/pattern, piano roll, playlist, piste du mixeur, EQ, compresseur, drop, break, kick tail, screech…) en le définissant la première fois, et fais le lien avec FL Studio quand c'est utile (Channel Rack = séquenceur, Mixer, Playlist, Piano roll).
- Kicks hardcore/uptempo : hauteur de départ élevée + descente rapide (pdec), distorsion forte (drive, dtype), queue accordée (end + note jouée dans le piano roll), filtre tone ; une piste du mixeur avec EQ/distorsion/limiteur en plus.
- Tu peux construire des choses quand il le demande (add_channel, set_steps, add_notes, playlist, mixer…). Sinon guide-le pour qu'il le fasse lui-même : c'est comme ça qu'il apprend. Après une modification, dis-lui où regarder dans l'interface.
- Les positions sont en pas (1 pas = 1 double-croche ; 4 pas = 1 temps ; 16 pas = 1 mesure), les notes en nom (convention FL Studio : C5 = Do 5 = 60) ou en numéro MIDI.
- Réponses courtes (5 à 12 lignes), une idée à la fois.";

fn tools() -> Value {
    let obj = iris_link::obj;
    let s = json!({ "type": "string" });
    let n = json!({ "type": "number" });
    let b = json!({ "type": "boolean" });
    let any = json!({ "description": "id ou nom" });
    json!([
      { "name": "get_state", "description": "Résumé du projet ouvert : tempo, swing, canaux (id, nom, type, réglages principaux, piste du mixeur), motifs (id, nom, longueur, notes par canal), playlist, mixeur (pistes, effets), lecture en cours, motif et canal sélectionnés, onglet affiché, cours en cours, conseils du coach.", "parameters": obj(json!({}), json!([])) },
      { "name": "get_project", "description": "Projet complet en JSON (toutes les notes et tous les paramètres).", "parameters": obj(json!({}), json!([])) },
      { "name": "list_instruments", "description": "Préréglages d'instruments (pour add_channel) et paramètres réglables de chaque type d'instrument et d'effet (id, nom, plage, rôle).", "parameters": obj(json!({}), json!([])) },
      { "name": "add_channel", "description": "Ajoute un canal (instrument) au séquenceur depuis un préréglage (voir list_instruments). Renvoie son id.",
        "parameters": obj(json!({ "preset": s, "name": s, "ins": { "type": "number", "description": "piste du mixeur (1-12) ; par défaut une piste libre" } }), json!(["preset"])) },
      { "name": "set_channel", "description": "Modifie un canal : name, vol (0..1), pan (-1..1), ins (piste du mixeur 0-12), mute, params (objet de paramètres de l'instrument, voir list_instruments), preset (recharge un préréglage).",
        "parameters": obj(json!({ "channel": any, "name": s, "vol": n, "pan": n, "ins": n, "mute": b, "params": { "type": "object" }, "preset": s }), json!(["channel"])) },
      { "name": "remove_channel", "description": "Supprime un canal (et ses notes).", "parameters": obj(json!({ "channel": any }), json!(["channel"])) },
      { "name": "set_steps", "description": "Écrit un rythme dans le séquenceur pas à pas pour un canal : steps = liste des pas allumés (1 = premier pas) ou texte comme x...x...x...x... (x = coup, . = rien). Remplace les notes du canal dans le motif.",
        "parameters": obj(json!({ "channel": any, "steps": { "description": "liste de numéros de pas ou texte x/." }, "pattern": any, "key": { "description": "note jouée (défaut C5 = 60)" }, "vel": n }), json!(["channel", "steps"])) },
      { "name": "add_notes", "description": "Ajoute des notes au piano roll d'un canal. notes = [{ step (position en pas, 0 = début), len (en pas), key (A4, C#5 ou numéro MIDI), vel (0..1) }]. replace=true efface d'abord les notes du canal dans ce motif.",
        "parameters": obj(json!({ "channel": any, "notes": { "type": "array", "items": { "type": "object" } }, "pattern": any, "replace": b }), json!(["channel", "notes"])) },
      { "name": "clear_notes", "description": "Efface les notes d'un motif (d'un canal ou de tous).", "parameters": obj(json!({ "pattern": any, "channel": any }), json!([])) },
      { "name": "pattern", "description": "Motifs : action = new (nouveau motif vide), select, rename (name), clone, length (len en pas : 16, 32, 64…), delete.",
        "parameters": obj(json!({ "action": s, "pattern": any, "name": s, "len": n }), json!(["action"])) },
      { "name": "playlist", "description": "Playlist (arrangement) : action = add (pattern, track 1-16, bar = mesure de départ 1.., bars = longueur en mesures), remove (track, bar), clear. Les motifs placés sont joués en mode Morceau.",
        "parameters": obj(json!({ "action": s, "pattern": any, "track": n, "bar": n, "bars": n }), json!(["action"])) },
      { "name": "mixer", "description": "Piste du mixeur (0 = master, 1-12) : name, vol (0..1, 0.8 = 0 dB), pan, mute, solo ; add_fx (eq, filter, dist, comp, delay, reverb, limiter) ; set_fx { index, params: {nom: valeur} } ; remove_fx (index).",
        "parameters": obj(json!({ "insert": n, "name": s, "vol": n, "pan": n, "mute": b, "solo": b, "add_fx": s, "set_fx": { "type": "object" }, "remove_fx": n }), json!(["insert"])) },
      { "name": "transport", "description": "Lecture : action = play, stop ; mode = pattern (motif sélectionné en boucle) ou song (playlist) ; bpm ; swing (0..1) ; metronome (booléen).",
        "parameters": obj(json!({ "action": s, "mode": s, "bpm": n, "swing": n, "metronome": b }), json!([])) },
      { "name": "select", "description": "Affiche une partie de l'interface : view = rack (séquenceur), piano (piano roll du canal), playlist, mixer ; channel = canal à sélectionner.",
        "parameters": obj(json!({ "view": s, "channel": any }), json!([])) },
      { "name": "new_project", "description": "Nouveau projet (le projet actuel reste dans la sauvegarde automatique). template = id d'une démo (list_demos) ou vide.", "parameters": obj(json!({ "template": s }), json!([])) },
      { "name": "list_demos", "description": "Projets de démonstration (hardcore, uptempo, house, hip-hop, DnB…).", "parameters": obj(json!({}), json!([])) },
      { "name": "export_wav", "description": "Exporte le morceau (mode song) ou le motif (mode pattern) en WAV dans Musique\\IrisStudio.", "parameters": obj(json!({ "mode": s }), json!([])) },
      { "name": "undo", "description": "Annule la dernière modification.", "parameters": obj(json!({}), json!([])) },
      { "name": "list_lessons", "description": "Liste les cours (id, chapitre, titre, terminé ou non).", "parameters": obj(json!({}), json!([])) },
      { "name": "start_lesson", "description": "Ouvre un cours interactif dans le panneau « Apprendre ».", "parameters": obj(json!({ "id": s }), json!(["id"])) },
      { "name": "show_tip", "description": "Affiche un message dans la barre du coach (et surligne éventuellement des zones : rack, piano, playlist, mixer, browser, transport, bpm, inspector, ou le data-ctl d'un contrôle).",
        "parameters": obj(json!({ "text": s, "highlight": { "type": "array", "items": { "type": "string" } } }), json!(["text"])) },
      { "name": "screenshot", "description": "Capture d'écran de l'app (PNG) ; renvoie le chemin du fichier.", "parameters": obj(json!({}), json!([])) },
    ])
}
pub fn start(app: &tauri::AppHandle) {
    iris_link::start(app, iris_link::AppInfo { id: ID, name: NAME, description: DESCRIPTION, instructions: INSTRUCTIONS, tools: tools() });
}
