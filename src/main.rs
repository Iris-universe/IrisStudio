// IrisStudio — studio de création musicale (séquenceur, piano roll, playlist, mixeur, synthés) avec cours.
// Moteur audio en Rust, interface HTML (WebView2).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod audio;
mod decode;
mod export;
mod irislink;
mod song;
mod store;

use audio::core::{Cmd, Telemetry, MAX_CH};
use audio::dsp::to_db;
use serde::Serialize;
use serde_json::{json, Value};
use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::atomic::Ordering;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::ipc::Channel;
use tauri::{AppHandle, Emitter, Manager, State};

pub struct St {
    pub audio: Arc<audio::Audio>,
    pub samples: Arc<song::Samples>,
    pub known_fx: Mutex<HashSet<u32>>,
    pub project: Mutex<Value>,
    pub chan: Arc<Mutex<Option<Channel<Snapshot>>>>,
}

#[derive(Serialize, Clone)]
pub struct Snapshot {
    playing: bool,
    song: bool,
    pos: f64,
    ins: Vec<f32>,
    ch: Vec<f32>,
    voices: u32,
}

fn toast(app: &AppHandle, msg: &str) {
    let _ = app.emit_to("main", "toast", msg);
}

// ------------------------------------------------------------ moteur
#[tauri::command]
fn subscribe(st: State<St>, channel: Channel<Snapshot>) {
    *st.chan.lock().unwrap() = Some(channel);
}

/// le projet complet (JSON) est compilé puis envoyé au fil audio
#[tauri::command]
async fn set_project(app: AppHandle, project: Value) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let st = app.state::<St>();
        let sr = st.audio.sr;
        let mut known = st.known_fx.lock().unwrap();
        let (song, errors) = song::compile(&project, &st.samples, sr, &mut known);
        st.audio.tx.send(Cmd::Song(Box::new(song)));
        drop(known);
        *st.project.lock().unwrap() = project;
        json!({ "ok": true, "errors": errors })
    })
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn transport(st: State<St>, action: String, song: Option<bool>, pat: Option<u32>, from: Option<f64>) -> Result<(), String> {
    let tx = &st.audio.tx;
    match action.as_str() {
        "play" => {
            tx.send(Cmd::Play { song: song.unwrap_or(false), pat: pat.unwrap_or(0), from: from.unwrap_or(0.0) });
        }
        "stop" => {
            tx.send(Cmd::Stop);
        }
        "seek" => {
            tx.send(Cmd::Seek(from.unwrap_or(0.0)));
        }
        "pattern" => {
            tx.send(Cmd::SetPat(pat.unwrap_or(0)));
        }
        "mode" => {
            tx.send(Cmd::SetMode(song.unwrap_or(false)));
        }
        "panic" => {
            tx.send(Cmd::AllOff);
        }
        a => return Err(format!("action inconnue : {a}")),
    }
    Ok(())
}

#[tauri::command]
fn note(st: State<St>, ch: u32, key: u8, vel: Option<f32>, on: bool) {
    if on {
        st.audio.tx.send(Cmd::NoteOn { ch, key, vel: vel.unwrap_or(0.8) });
    } else {
        st.audio.tx.send(Cmd::NoteOff { ch, key });
    }
}

#[tauri::command]
fn master_volume(st: State<St>, v: f32) {
    st.audio.tx.send(Cmd::Volume(v.clamp(0.0, 1.5)));
}

// ------------------------------------------------------------ échantillons
#[tauri::command]
async fn sample_pick() -> Option<Vec<String>> {
    let files = rfd::AsyncFileDialog::new()
        .set_title("Choisir un sample")
        .add_filter("Audio", &["wav", "mp3", "flac", "ogg", "aif", "aiff", "m4a"])
        .pick_files()
        .await?;
    Some(files.iter().map(|f| f.path().to_string_lossy().to_string()).collect())
}

/// charge un sample et renvoie sa durée + un aperçu de la forme d'onde (200 points)
#[tauri::command]
async fn sample_info(app: AppHandle, path: String) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let st = app.state::<St>();
        let s = st.samples.get(&path, st.audio.sr)?;
        let n = s.l.len();
        let k = (n / 200).max(1);
        let peaks: Vec<f32> = (0..200.min(n)).map(|i| s.l[i * k..((i + 1) * k).min(n)].iter().fold(0f32, |a, x| a.max(x.abs()))).collect();
        Ok(json!({ "dur": n as f64 / st.audio.sr, "peaks": peaks }))
    })
    .await
    .map_err(|e| e.to_string())?
}

// ------------------------------------------------------------ projets
#[tauri::command]
async fn project_save(project: Value, path: Option<String>, name: Option<String>) -> Result<Option<String>, String> {
    let p = match path.filter(|p| !p.is_empty()) {
        Some(p) => PathBuf::from(p),
        None => {
            let dir = store::projects_dir();
            let _ = std::fs::create_dir_all(&dir);
            let fname = format!("{}.irisp", name.unwrap_or("Mon morceau".into()).replace(['\\', '/', ':', '*', '?', '"', '<', '>', '|'], "_"));
            match rfd::AsyncFileDialog::new().set_title("Enregistrer le projet").set_directory(&dir).set_file_name(fname).add_filter("Projet IrisStudio", &["irisp"]).save_file().await {
                Some(f) => f.path().to_path_buf(),
                None => return Ok(None),
            }
        }
    };
    store::write_json(&p, &project).map_err(|e| e.to_string())?;
    Ok(Some(p.to_string_lossy().to_string()))
}

#[tauri::command]
async fn project_open() -> Result<Option<Value>, String> {
    let dir = store::projects_dir();
    let _ = std::fs::create_dir_all(&dir);
    let Some(f) = rfd::AsyncFileDialog::new().set_title("Ouvrir un projet").set_directory(&dir).add_filter("Projet IrisStudio", &["irisp", "json"]).pick_file().await else {
        return Ok(None);
    };
    let p = f.path().to_path_buf();
    let v = store::read_json(&p).ok_or("Fichier de projet illisible.")?;
    Ok(Some(json!({ "path": p.to_string_lossy(), "project": v })))
}

#[tauri::command]
fn project_read(path: String) -> Result<Value, String> {
    store::read_json(&PathBuf::from(&path)).ok_or("Fichier de projet illisible.".into())
}

#[tauri::command]
fn autosave(project: Value, path: Option<String>) {
    let v = json!({ "path": path, "project": project, "saved": chrono::Local::now().to_rfc3339() });
    let _ = store::write_json(&store::autosave_file(), &v);
}
#[tauri::command]
fn autosave_load() -> Option<Value> {
    store::read_json(&store::autosave_file())
}

#[tauri::command]
async fn export_wav(app: AppHandle, project: Value, song: bool, pat: u32, loops: Option<u32>, name: String, ask: Option<bool>) -> Result<Option<Value>, String> {
    let dir = store::exports_dir();
    let _ = std::fs::create_dir_all(&dir);
    let safe = name.replace(['\\', '/', ':', '*', '?', '"', '<', '>', '|'], "_");
    let out = if ask.unwrap_or(true) {
        match rfd::AsyncFileDialog::new().set_title("Exporter en WAV").set_directory(&dir).set_file_name(format!("{safe}.wav")).add_filter("WAV", &["wav"]).save_file().await {
            Some(f) => f.path().to_path_buf(),
            None => return Ok(None),
        }
    } else {
        let mut p = dir.join(format!("{safe}.wav"));
        let mut k = 2;
        while p.exists() {
            p = dir.join(format!("{safe} ({k}).wav"));
            k += 1;
        }
        p
    };
    let a = app.clone();
    let out2 = out.clone();
    let dur = tauri::async_runtime::spawn_blocking(move || {
        let st = a.state::<St>();
        let sr = st.audio.sr;
        let samples = st.samples.clone();
        export::render(&project, &samples, sr, song, pat, loops.unwrap_or(1), &out2, |p| {
            let _ = a.emit_to("main", "export-progress", p);
        })
    })
    .await
    .map_err(|e| e.to_string())??;
    store::show_in_folder(&out);
    Ok(Some(json!({ "path": out.to_string_lossy(), "dur": dur })))
}

// ------------------------------------------------------------ divers
#[tauri::command]
fn audio_outputs() -> Vec<String> {
    audio::list_outputs()
}
#[tauri::command]
async fn audio_set(st: State<'_, St>, master: String) -> Result<Value, String> {
    let audio = st.audio.clone();
    match tauri::async_runtime::spawn_blocking(move || audio.set_master(&master)).await.map_err(|e| e.to_string())? {
        Ok(()) => Ok(json!({ "ok": true })),
        Err(e) => Ok(json!({ "ok": false, "error": e })),
    }
}
#[tauri::command]
fn open_folder(kind: String) {
    let d = match kind.as_str() {
        "exports" => store::exports_dir(),
        _ => store::projects_dir(),
    };
    let _ = std::fs::create_dir_all(&d);
    store::open_path(&d);
}
#[tauri::command]
fn open_external(url: String) {
    store::open_url(&url);
}
#[tauri::command]
fn win_action(app: AppHandle, action: String) {
    let Some(w) = app.get_webview_window("main") else { return };
    match action.as_str() {
        "fullscreen" => {
            let f = w.is_fullscreen().unwrap_or(false);
            let _ = w.set_fullscreen(!f);
        }
        "devtools" => {
            if w.is_devtools_open() {
                w.close_devtools()
            } else {
                w.open_devtools()
            }
        }
        "title" => {}
        _ => {}
    }
}
#[tauri::command]
fn set_title(app: AppHandle, title: String) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.set_title(&title);
    }
}

fn set_app_id() {
    use windows_sys::Win32::UI::Shell::SetCurrentProcessExplicitAppUserModelID;
    let w: Vec<u16> = "iris.irisstudio".encode_utf16().chain(Some(0)).collect();
    unsafe {
        SetCurrentProcessExplicitAppUserModelID(w.as_ptr());
    }
}

/// test sans interface : `irisstudio --render projet.json sortie.wav [song|pattern]`
fn cli_render(args: &[String]) -> bool {
    if args.get(1).map(|s| s.as_str()) != Some("--render") {
        return false;
    }
    let (Some(inp), Some(out)) = (args.get(2), args.get(3)) else {
        eprintln!("usage : --render projet.json sortie.wav [song|pattern]");
        return true;
    };
    let Some(p) = store::read_json(std::path::Path::new(inp)) else {
        eprintln!("projet illisible");
        return true;
    };
    let song = args.get(4).map(|s| s == "song").unwrap_or(true);
    let pat = p.pointer("/patterns/0/id").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
    let samples = song::Samples::default();
    let t = std::time::Instant::now();
    match export::render_stats(&p, &samples, 48000.0, song, pat, 2, std::path::Path::new(out), |_| {}) {
        Ok((d, pk)) => {
            let pk: Vec<String> = pk.iter().map(|x| format!("{:.1}", to_db(*x))).collect();
            println!("ok {d:.2}s rendu en {:.2}s ; crêtes par piste (0 = master avant limiteur) : {}", t.elapsed().as_secs_f64(), pk.join(" "))
        }
        Err(e) => eprintln!("erreur : {e}"),
    }
    true
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if cli_render(&args) {
        return;
    }
    set_app_id();
    let audio = match audio::Audio::start() {
        Ok(a) => Arc::new(a),
        Err(e) => {
            rfd::MessageDialog::new().set_title("IrisStudio").set_description(format!("Impossible d'ouvrir la sortie audio : {e}")).show();
            return;
        }
    };
    let chan: Arc<Mutex<Option<Channel<Snapshot>>>> = Arc::new(Mutex::new(None));

    // fil d'état : ~40 instantanés par seconde vers l'interface (position, niveaux)
    {
        let (audio, chan) = (audio.clone(), chan.clone());
        std::thread::Builder::new()
            .name("etat".into())
            .spawn(move || loop {
                std::thread::sleep(Duration::from_millis(25));
                audio.collect_garbage();
                let t = &audio.tele;
                let snap = Snapshot {
                    playing: t.playing.load(Ordering::Relaxed),
                    song: t.song_mode.load(Ordering::Relaxed),
                    pos: f64::from_bits(t.pos.load(Ordering::Relaxed)),
                    ins: t.ins.iter().map(|a| to_db(Telemetry::take(a))).collect(),
                    ch: (0..MAX_CH).map(|i| to_db(Telemetry::take(&t.ch[i]))).collect(),
                    voices: t.voices.load(Ordering::Relaxed),
                };
                if let Some(c) = chan.lock().unwrap().as_ref() {
                    let _ = c.send(snap);
                }
            })
            .unwrap();
    }

    let st = St {
        audio,
        samples: Arc::new(song::Samples::default()),
        known_fx: Mutex::new(HashSet::new()),
        project: Mutex::new(Value::Null),
        chan,

    };
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.show();
                let _ = w.set_focus();
            }
        }))
        .manage(st)
        .invoke_handler(tauri::generate_handler![
            subscribe, set_project, transport, note, master_volume, sample_pick, sample_info, project_save, project_open, project_read, autosave,
            autosave_load, export_wav, audio_outputs, audio_set, open_folder, open_external, iris_link::commands::assistant_ask, iris_link::commands::agent_reply, win_action, set_title
        ])
        .setup(|app| {
            let w = tauri::WebviewWindowBuilder::new(app, "main", tauri::WebviewUrl::App("index.html".into()))
                .title("IrisStudio")
                .inner_size(1500.0, 940.0)
                .min_inner_size(1180.0, 720.0)
                .background_color(tauri::window::Color(17, 19, 24, 255))
                .visible(false)
                .build()?;
            let _ = w.maximize();
            let _ = w.show();
            let _ = w.set_focus();
            irislink::start(app.handle());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("démarrage d'IrisStudio");
}
