// Projet (JSON envoyé par l'interface) -> morceau compilé pour le fil audio.
// Unités : ticks, 96 par temps (PPQ) ; un pas du séquenceur (double-croche) = 24 ticks ; une mesure = 384.
use crate::audio::fx::{self, Fx};
use crate::audio::inst::*;
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex};

pub const PPQ: f64 = 96.0;
pub const MAX_INS: usize = 13; // master + 12 pistes

#[derive(Clone, Copy)]
pub struct Ev {
    pub t: f64,
    pub ch: usize,
    pub key: u8,
    pub vel: f32,
    pub len: f64,
}
pub struct Chan {
    pub id: u32,
    pub inst: Inst,
    pub vol: f32,
    pub pan: f32,
    pub mute: bool,
    pub ins: usize,
}
pub struct Pat {
    pub id: u32,
    pub len: f64,
    pub evs: Vec<Ev>,
}
#[derive(Clone, Copy)]
pub struct Ins {
    pub vol: f32,
    pub pan: f32,
    pub mute: bool,
    pub solo: bool,
}
pub struct Song {
    pub bpm: f64,
    pub metronome: bool,
    pub chans: Vec<Chan>,
    pub pats: Vec<Pat>,
    pub song: Vec<Ev>,
    pub song_len: f64,
    pub ins: Vec<Ins>,
    pub fx: Vec<Vec<Fx>>,
    pub any_solo: bool,
}

impl Song {
    pub fn empty(sr: f32) -> Song {
        let _ = sr;
        Song {
            bpm: 140.0,
            metronome: false,
            chans: vec![],
            pats: vec![],
            song: vec![],
            song_len: 0.0,
            ins: vec![Ins { vol: 0.8, pan: 0.0, mute: false, solo: false }; MAX_INS],
            fx: (0..MAX_INS).map(|_| vec![]).collect(),
            any_solo: false,
        }
    }
    pub fn pat_index(&self, id: u32) -> Option<usize> {
        self.pats.iter().position(|p| p.id == id)
    }
}

// ------------------------------------------------------------ échantillons chargés
#[derive(Default)]
pub struct Samples {
    map: Mutex<HashMap<String, Arc<Sample>>>,
}
impl Samples {
    pub fn get(&self, path: &str, sr: f64) -> Result<Arc<Sample>, String> {
        if let Some(s) = self.map.lock().unwrap().get(path) {
            return Ok(s.clone());
        }
        let pcm = crate::decode::decode_file(std::path::Path::new(path)).map_err(|e| if e == "UNSUPPORTED" { "format audio non pris en charge".to_string() } else { e })?;
        let pcm = crate::decode::resample(pcm, sr);
        let s = Arc::new(Sample { l: pcm.l, r: pcm.r });
        self.map.lock().unwrap().insert(path.to_string(), s.clone());
        Ok(s)
    }
}

// ------------------------------------------------------------ lecture du JSON
fn num(v: &Value, k: &str, d: f64) -> f64 {
    match v.get(k) {
        Some(Value::Number(n)) => n.as_f64().unwrap_or(d),
        Some(Value::Bool(b)) => {
            if *b {
                1.0
            } else {
                0.0
            }
        }
        _ => d,
    }
}
fn f(v: &Value, k: &str, d: f64) -> f32 {
    num(v, k, d) as f32
}
fn ms(v: &Value, k: &str, d: f64) -> f32 {
    (num(v, k, d) / 1000.0) as f32
}
fn id_of(v: &Value) -> u32 {
    match v.get("id") {
        Some(Value::Number(n)) => n.as_u64().unwrap_or(0) as u32,
        Some(Value::String(s)) => s.parse().unwrap_or(0),
        _ => 0,
    }
}
fn db(x: f32) -> f32 {
    10f32.powf(x / 20.0)
}

fn compile_inst(c: &Value, samples: &Samples, sr: f64, errors: &mut Vec<String>) -> Inst {
    let empty = Value::Object(Default::default());
    let p = c.get("params").unwrap_or(&empty);
    match c.get("type").and_then(|t| t.as_str()).unwrap_or("synth") {
        "kick" => Inst::Kick(KickP {
            start: f(p, "start", 900.0),
            end: f(p, "end", 55.0),
            pdec: ms(p, "pdec", 25.0),
            hold: ms(p, "hold", 20.0),
            decay: ms(p, "decay", 300.0),
            tail: f(p, "tail", 0.0),
            click: f(p, "click", 0.3),
            shape: f(p, "shape", 0.0),
            drive: db(f(p, "drive", 12.0)),
            dtype: num(p, "dtype", 0.0) as u8,
            tone: f(p, "tone", 8000.0),
            vol: db(f(p, "vol", -3.0)),
        }),
        "drum" => Inst::Drum(DrumP {
            kind: num(p, "kind", 0.0) as u8,
            tone: f(p, "tone", 1.0),
            decay: ms(p, "decay", 200.0),
            noise: f(p, "noise", 0.7),
            snap: f(p, "snap", 0.3),
            vol: db(f(p, "vol", -3.0)),
        }),
        "sampler" => {
            let path = c.get("sample").and_then(|s| s.as_str()).unwrap_or("");
            let sample = if path.is_empty() {
                None
            } else {
                match samples.get(path, sr) {
                    Ok(s) => Some(s),
                    Err(e) => {
                        errors.push(format!("{path} : {e}"));
                        None
                    }
                }
            };
            Inst::Samp(SampP {
                sample,
                root: f(p, "root", 60.0),
                tune: f(p, "tune", 0.0),
                gain: db(f(p, "gain", 0.0)),
                start: f(p, "start", 0.0).clamp(0.0, 0.99),
                rev: num(p, "rev", 0.0) > 0.5,
                att: ms(p, "att", 1.0),
                rel: ms(p, "rel", 30.0),
                oneshot: num(p, "oneshot", 1.0) > 0.5,
            })
        }
        _ => Inst::Synth(SynthP {
            w1: num(p, "w1", 0.0) as u8,
            w2: num(p, "w2", 0.0) as u8,
            semi2: f(p, "semi2", 0.0),
            fine2: f(p, "fine2", 7.0),
            mix2: f(p, "mix2", 0.0),
            sub: f(p, "sub", 0.0),
            noise: f(p, "noise", 0.0),
            uni: num(p, "uni", 1.0).round().clamp(1.0, 7.0) as usize,
            det: f(p, "det", 0.2),
            spread: f(p, "spread", 0.5),
            pw: f(p, "pw", 0.5).clamp(0.05, 0.95),
            ftype: num(p, "ftype", 0.0) as u8,
            cut: f(p, "cut", 5000.0),
            res: f(p, "res", 0.1),
            fenv: f(p, "fenv", 0.0),
            fkey: f(p, "fkey", 0.0),
            fa: ms(p, "fa", 5.0),
            fd: ms(p, "fd", 300.0),
            fs: f(p, "fs", 0.0),
            fr: ms(p, "fr", 200.0),
            a: ms(p, "a", 3.0),
            d: ms(p, "d", 300.0),
            s: f(p, "s", 0.8),
            r: ms(p, "r", 150.0),
            penv: f(p, "penv", 0.0),
            pdec: ms(p, "pdec", 50.0),
            lfo_rate: f(p, "lfo_rate", 5.0),
            lfo_pitch: f(p, "lfo_pitch", 0.0),
            lfo_cut: f(p, "lfo_cut", 0.0),
            glide: ms(p, "glide", 0.0),
            mono: num(p, "mono", 0.0) > 0.5,
            oct: f(p, "oct", 0.0),
            drive: f(p, "drive", 0.0),
            vol: db(f(p, "vol", -3.0)),
        }),
    }
}

/// Compile le projet. `known_fx` : effets déjà présents dans le fil audio (pas besoin d'allouer leurs tampons).
pub fn compile(pj: &Value, samples: &Samples, sr: f64, known_fx: &mut HashSet<u32>) -> (Song, Vec<String>) {
    let mut errors = vec![];
    let mut s = Song::empty(sr as f32);
    s.bpm = num(pj, "bpm", 140.0).clamp(20.0, 999.0);
    s.metronome = num(pj, "metronome", 0.0) > 0.5;
    let swing = num(pj, "swing", 0.0).clamp(0.0, 1.0);

    let empty = vec![];
    let chans = pj.get("channels").and_then(|c| c.as_array()).unwrap_or(&empty);
    let mut ch_index: HashMap<String, usize> = HashMap::new();
    for c in chans {
        let id = id_of(c);
        ch_index.insert(id.to_string(), s.chans.len());
        s.chans.push(Chan {
            id,
            inst: compile_inst(c, samples, sr, &mut errors),
            vol: f(c, "vol", 0.8),
            pan: f(c, "pan", 0.0),
            mute: num(c, "mute", 0.0) > 0.5,
            ins: (num(c, "ins", 0.0) as usize).min(MAX_INS - 1),
        });
    }

    let pats = pj.get("patterns").and_then(|c| c.as_array()).unwrap_or(&empty);
    for p in pats {
        let len = (num(p, "len", 16.0).max(1.0)) * PPQ / 4.0;
        let mut evs = vec![];
        if let Some(Value::Object(notes)) = p.get("notes") {
            for (cid, list) in notes {
                let Some(&ch) = ch_index.get(cid) else { continue };
                for n in list.as_array().unwrap_or(&empty) {
                    let mut t = num(n, "t", 0.0);
                    if t >= len || t < 0.0 {
                        continue;
                    }
                    // swing : les doubles-croches paires sont retardées
                    if swing > 0.0 && ((t / 24.0).round() as i64) % 2 == 1 && (t % 24.0).abs() < 0.01 {
                        t += swing * 12.0;
                    }
                    evs.push(Ev {
                        t,
                        ch,
                        key: num(n, "key", 60.0).clamp(0.0, 127.0) as u8,
                        vel: f(n, "vel", 0.8).clamp(0.0, 1.0),
                        len: num(n, "len", 24.0).max(1.0),
                    });
                }
            }
        }
        evs.sort_by(|a, b| a.t.partial_cmp(&b.t).unwrap());
        s.pats.push(Pat { id: id_of(p), len, evs });
    }

    // playlist -> liste d'évènements à plat
    let tracks_muted: Vec<bool> = pj
        .pointer("/playlist/tracks")
        .and_then(|t| t.as_array())
        .map(|a| a.iter().map(|t| num(t, "mute", 0.0) > 0.5).collect())
        .unwrap_or_default();
    if let Some(clips) = pj.pointer("/playlist/clips").and_then(|c| c.as_array()) {
        for c in clips {
            let tr = num(c, "track", 0.0) as usize;
            if tracks_muted.get(tr).copied().unwrap_or(false) {
                continue;
            }
            let pid = match c.get("pat") {
                Some(Value::Number(n)) => n.as_u64().unwrap_or(0) as u32,
                Some(Value::String(x)) => x.parse().unwrap_or(0),
                _ => 0,
            };
            let Some(pi) = s.pat_index(pid) else { continue };
            let start = num(c, "start", 0.0).max(0.0);
            let pat = &s.pats[pi];
            let clen = num(c, "len", pat.len).max(1.0);
            let off = num(c, "off", 0.0).max(0.0);
            s.song_len = s.song_len.max(start + clen);
            let mut k = 0.0;
            while k * pat.len < clen + off {
                for e in &pat.evs {
                    let t = k * pat.len + e.t - off;
                    if t >= 0.0 && t < clen {
                        s.song.push(Ev { t: start + t, ..*e });
                    }
                }
                k += 1.0;
                if k > 4096.0 {
                    break;
                }
            }
        }
    }
    s.song.sort_by(|a, b| a.t.partial_cmp(&b.t).unwrap());
    // fin du morceau arrondie à la mesure
    let bar = PPQ * 4.0;
    s.song_len = (s.song_len / bar).ceil() * bar;

    // mixeur
    let mut seen = HashSet::new();
    if let Some(mx) = pj.get("mixer").and_then(|m| m.as_array()) {
        for (i, m) in mx.iter().enumerate().take(MAX_INS) {
            s.ins[i] = Ins {
                vol: f(m, "vol", 0.8),
                pan: f(m, "pan", 0.0),
                mute: num(m, "mute", 0.0) > 0.5,
                solo: i > 0 && num(m, "solo", 0.0) > 0.5,
            };
            for e in m.get("fx").and_then(|x| x.as_array()).unwrap_or(&empty) {
                let Some(kind) = e.get("type").and_then(|t| t.as_str()).and_then(fx::kind_of) else { continue };
                let id = id_of(e);
                let mut p = [0f32; 8];
                if let Some(arr) = e.get("p").and_then(|a| a.as_array()) {
                    for (k, v) in arr.iter().enumerate().take(8) {
                        p[k] = v.as_f64().unwrap_or(0.0) as f32;
                    }
                }
                let alloc = !known_fx.contains(&id);
                seen.insert(id);
                s.fx[i].push(Fx::new(id, kind, num(e, "on", 1.0) > 0.5, p, sr as f32, alloc));
            }
        }
    }
    *known_fx = seen;
    s.any_solo = s.ins.iter().any(|i| i.solo);
    (s, errors)
}
