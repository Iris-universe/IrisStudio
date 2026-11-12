// Export WAV : rendu hors ligne du morceau (ou du motif) avec le même moteur que la lecture.
use crate::audio::core::{Cmd, Core, Telemetry};
use crate::song::{self, Samples, PPQ};
use serde_json::Value;
use std::collections::HashSet;
use std::path::Path;
use std::sync::Arc;

/// `progress` reçoit 0..1. Renvoie la durée en secondes.
pub fn render(project: &Value, samples: &Samples, sr: f64, song_mode: bool, pat: u32, loops: u32, out: &Path, progress: impl Fn(f64)) -> Result<f64, String> {
    render_stats(project, samples, sr, song_mode, pat, loops, out, progress).map(|r| r.0)
}

/// idem + crêtes maximales de chaque piste (avant le limiteur de sortie)
pub fn render_stats(project: &Value, samples: &Samples, sr: f64, song_mode: bool, pat: u32, loops: u32, out: &Path, progress: impl Fn(f64)) -> Result<(f64, Vec<f32>), String> {
    let (s, _errs) = song::compile(project, samples, sr, &mut HashSet::new());
    let bpm = s.bpm;
    let len_ticks = if song_mode {
        if s.song.is_empty() {
            return Err("La playlist est vide : place des motifs dans la playlist, ou exporte le motif seul.".into());
        }
        s.song_len
    } else {
        let i = s.pat_index(pat).ok_or("motif introuvable")?;
        s.pats[i].len * loops.max(1) as f64
    };
    let total = (len_ticks / (bpm * PPQ / 60.0) * sr) as usize;
    let tail_max = (sr * 6.0) as usize;
    let mut core = Core::new(sr, None, None, Arc::new(Telemetry::new()));
    core.set_song(Box::new(s));
    core.apply(Cmd::Play { song: song_mode, pat, from: 0.0 });

    if let Some(d) = out.parent() {
        std::fs::create_dir_all(d).map_err(|e| e.to_string())?;
    }
    let spec = hound::WavSpec { channels: 2, sample_rate: sr as u32, bits_per_sample: 24, sample_format: hound::SampleFormat::Int };
    let mut w = hound::WavWriter::create(out, spec).map_err(|e| e.to_string())?;
    let mut buf = vec![[0f32; 2]; 512];
    let mut done = 0usize;
    let mut stopped = false;
    let mut silent = 0usize;
    let mut last_report = 0usize;
    loop {
        let n = if !stopped { (total - done).min(512) } else { 512 };
        if n == 0 {
            core.apply(Cmd::Stop);
            stopped = true;
            continue;
        }
        let b = &mut buf[..n];
        core.render(b);
        for f in b.iter() {
            for c in f {
                let v = (c.clamp(-1.0, 1.0) * 8_388_607.0) as i32;
                w.write_sample(v).map_err(|e| e.to_string())?;
            }
        }
        done += n;
        if stopped {
            // queue des sons (reverb, delay…) jusqu'au silence
            let pk = b.iter().fold(0f32, |a, f| a.max(f[0].abs()).max(f[1].abs()));
            silent = if pk < 0.0005 && core.active_voices() == 0 { silent + n } else { 0 };
            if silent > (sr * 0.3) as usize || done > total + tail_max {
                break;
            }
        }
        if done - last_report > (sr as usize) * 2 {
            last_report = done;
            progress((done as f64 / total.max(1) as f64).min(1.0));
        }
    }
    w.finalize().map_err(|e| e.to_string())?;
    progress(1.0);
    Ok((done as f64 / sr, core.max_peaks.to_vec()))
}
