// Fil temps réel : séquenceur (motif ou morceau), voix des instruments, pistes du mixeur, master.
// Les commandes arrivent par une file sans verrou ; l'ancien morceau repart par la file `garbage`
// pour être libéré hors du fil audio.
use super::dsp::*;
use super::fx::{Ctx, MasterLimiter};
use super::inst::{Inst, Voice};
use crate::song::{Song, MAX_INS, PPQ};
use std::sync::atomic::{AtomicBool, AtomicU32, AtomicU64, Ordering};

pub const MAX_VOICES: usize = 96;
pub const MAX_CH: usize = 64;

pub enum Cmd {
    Song(Box<Song>),
    /// lecture : `song` = mode morceau (playlist) sinon motif `pat` ; depuis `from` (ticks)
    Play { song: bool, pat: u32, from: f64 },
    Stop,
    Seek(f64),
    SetPat(u32),
    SetMode(bool),
    NoteOn { ch: u32, key: u8, vel: f32 },
    NoteOff { ch: u32, key: u8 },
    AllOff,
    Volume(f32),
}
pub struct Msg {
    pub seq: u64,
    pub cmd: Cmd,
}
pub type Garbage = Box<Song>;

pub struct Telemetry {
    pub pos: AtomicU64, // f64 (ticks)
    pub playing: AtomicBool,
    pub song_mode: AtomicBool,
    pub ins: Vec<AtomicU32>,  // crêtes (f32) depuis la dernière lecture
    pub ch: Vec<AtomicU32>,   // idem par canal
    pub master: [AtomicU32; 2],
    pub voices: AtomicU32,
    pub applied: AtomicU64,
}
impl Telemetry {
    pub fn new() -> Self {
        Telemetry {
            pos: AtomicU64::new(0),
            playing: AtomicBool::new(false),
            song_mode: AtomicBool::new(false),
            ins: (0..MAX_INS).map(|_| AtomicU32::new(0)).collect(),
            ch: (0..MAX_CH).map(|_| AtomicU32::new(0)).collect(),
            master: [AtomicU32::new(0), AtomicU32::new(0)],
            voices: AtomicU32::new(0),
            applied: AtomicU64::new(0),
        }
    }
    fn peak(a: &AtomicU32, v: f32) {
        let cur = f32::from_bits(a.load(Ordering::Relaxed));
        if v > cur {
            a.store(v.to_bits(), Ordering::Relaxed);
        }
    }
    pub fn take(a: &AtomicU32) -> f32 {
        f32::from_bits(a.swap(0, Ordering::Relaxed))
    }
}

pub struct Core {
    pub sr: f32,
    song: Box<Song>,
    voices: Vec<Voice>,
    playing: bool,
    song_mode: bool,
    pat: usize,
    pat_id: u32,
    pos: f64,
    idx: usize,
    last_key: Vec<Option<f32>>,
    bus: Vec<(f32, f32)>,
    ch_peak: Vec<f32>,
    ins_peak: Vec<f32>,
    limiter: MasterLimiter,
    /// crêtes maximales par piste depuis le début (pour les tests hors ligne)
    pub max_peaks: [f32; MAX_INS],
    master_vol: f32,
    metro_t: f32,
    metro_f: f32,
    rx: Option<rtrb::Consumer<Msg>>,
    garbage: Option<rtrb::Producer<Garbage>>,
    tele: std::sync::Arc<Telemetry>,
}

impl Core {
    pub fn new(sr: f64, rx: Option<rtrb::Consumer<Msg>>, garbage: Option<rtrb::Producer<Garbage>>, tele: std::sync::Arc<Telemetry>) -> Core {
        Core {
            sr: sr as f32,
            song: Box::new(Song::empty(sr as f32)),
            voices: (0..MAX_VOICES).map(|_| Voice::empty()).collect(),
            playing: false,
            song_mode: false,
            pat: 0,
            pat_id: 0,
            pos: 0.0,
            idx: 0,
            last_key: vec![None; MAX_CH],
            bus: vec![(0.0, 0.0); MAX_INS],
            ch_peak: vec![0.0; MAX_CH],
            ins_peak: vec![0.0; MAX_INS],
            limiter: MasterLimiter::new(),
            max_peaks: [0.0; MAX_INS],
            master_vol: 1.0,
            metro_t: 1.0,
            metro_f: 1000.0,
            rx,
            garbage,
            tele,
        }
    }

    fn events(&self) -> &[crate::song::Ev] {
        if self.song_mode {
            &self.song.song
        } else {
            self.song.pats.get(self.pat).map(|p| &p.evs[..]).unwrap_or(&[])
        }
    }
    fn loop_len(&self) -> f64 {
        if self.song_mode {
            self.song.song_len.max(PPQ * 4.0)
        } else {
            self.song.pats.get(self.pat).map(|p| p.len).unwrap_or(PPQ * 4.0)
        }
    }
    fn reindex(&mut self) {
        let pos = self.pos;
        self.idx = self.events().partition_point(|e| e.t < pos - 1e-9);
    }

    pub fn set_song(&mut self, mut new: Box<Song>) {
        // reprend l'état des effets déjà en place (tampons de delay/reverb, enveloppes…)
        for i in 0..new.fx.len() {
            for j in 0..new.fx[i].len() {
                let id = new.fx[i][j].id;
                let kind = new.fx[i][j].kind;
                'find: for oi in 0..self.song.fx.len() {
                    for oj in 0..self.song.fx[oi].len() {
                        let o = &mut self.song.fx[oi][oj];
                        if o.id == id && o.kind == kind && o.has_buffers() {
                            std::mem::swap(&mut new.fx[i][j].st, &mut o.st);
                            new.fx[i][j].mark_dirty();
                            break 'find;
                        }
                    }
                }
            }
        }
        // les voix suivent leur canal (par identifiant)
        let mut moved_keys = vec![None; MAX_CH];
        for v in self.voices.iter_mut().filter(|v| v.on) {
            let old_kind = self.song.chans.get(v.ch).map(|c| std::mem::discriminant(&c.inst));
            match new.chans.iter().position(|c| c.id == v.uid) {
                Some(ni) if Some(std::mem::discriminant(&new.chans[ni].inst)) == old_kind => {
                    if v.ch < MAX_CH && ni < MAX_CH {
                        moved_keys[ni] = self.last_key[v.ch];
                    }
                    v.ch = ni;
                }
                _ => v.on = false,
            }
        }
        self.last_key = moved_keys;
        if !self.song_mode {
            self.pat = new.pat_index(self.pat_id).unwrap_or(0);
        }
        let old = std::mem::replace(&mut self.song, new);
        if let Some(g) = self.garbage.as_mut() {
            let _ = g.push(old);
        }
        let ll = self.loop_len();
        if self.pos >= ll {
            self.pos %= ll;
        }
        self.reindex();
    }

    fn note_on(&mut self, ch: usize, key: u8, vel: f32, len_samples: i64) {
        let Some(c) = self.song.chans.get(ch) else { return };
        if c.mute {
            return;
        }
        let uid = c.id;
        match &c.inst {
            // kicks et percus : un nouveau coup étouffe le précédent (sauf charleys/crash entre eux)
            Inst::Kick(_) => {
                for v in self.voices.iter_mut().filter(|v| v.on && v.ch == ch) {
                    if v.choke >= 1.0 {
                        v.choke = 0.999;
                    }
                }
            }
            Inst::Drum(p) if p.kind == 2 || p.kind == 3 => {
                for v in self.voices.iter_mut().filter(|v| v.on && v.ch == ch) {
                    if v.choke >= 1.0 {
                        v.choke = 0.999;
                    }
                }
            }
            Inst::Synth(p) if p.mono => {
                if let Some(v) = self.voices.iter_mut().find(|v| v.on && v.ch == ch && !v.released && v.choke >= 1.0) {
                    v.legato(key, vel, len_samples, &c.inst);
                    return;
                }
            }
            _ => {}
        }
        let glide_from = match &c.inst {
            Inst::Synth(p) if p.glide > 0.0005 => self.last_key.get(ch).copied().flatten(),
            _ => None,
        };
        // voix libre, sinon la plus ancienne
        let slot = match self.voices.iter().position(|v| !v.on) {
            Some(i) => i,
            None => {
                let mut best = 0;
                for (i, v) in self.voices.iter().enumerate() {
                    if v.age > self.voices[best].age {
                        best = i;
                    }
                }
                best
            }
        };
        let sr = self.sr;
        let inst = &self.song.chans[ch].inst;
        self.voices[slot].start(inst, ch, uid, key, vel, len_samples, glide_from, sr);
        if let Inst::Synth(p) = inst {
            if ch < MAX_CH {
                self.last_key[ch] = Some(key as f32 + p.oct * 12.0);
            }
        }
    }

    fn handle(&mut self, cmd: Cmd) {
        match cmd {
            Cmd::Song(s) => self.set_song(s),
            Cmd::Play { song, pat, from } => {
                self.song_mode = song;
                self.pat_id = pat;
                self.pat = self.song.pat_index(pat).unwrap_or(0);
                self.pos = from.max(0.0);
                let ll = self.loop_len();
                if self.pos >= ll {
                    self.pos = 0.0;
                }
                self.playing = true;
                self.metro_t = 1.0;
                self.reindex();
            }
            Cmd::Stop => {
                self.playing = false;
                for v in self.voices.iter_mut().filter(|v| v.on) {
                    if v.left != i64::MAX {
                        v.release();
                    }
                }
            }
            Cmd::Seek(t) => {
                self.pos = t.max(0.0) % self.loop_len();
                self.reindex();
            }
            Cmd::SetPat(id) => {
                self.pat_id = id;
                if !self.song_mode {
                    self.pat = self.song.pat_index(id).unwrap_or(0);
                    let ll = self.loop_len();
                    self.pos %= ll;
                    self.reindex();
                }
            }
            Cmd::SetMode(song) => {
                if song != self.song_mode {
                    self.song_mode = song;
                    self.pat = self.song.pat_index(self.pat_id).unwrap_or(0);
                    self.pos = 0.0;
                    self.reindex();
                }
            }
            Cmd::NoteOn { ch, key, vel } => {
                if let Some(i) = self.song.chans.iter().position(|c| c.id == ch) {
                    self.note_on(i, key, vel, i64::MAX);
                }
            }
            Cmd::NoteOff { ch, key } => {
                for v in self.voices.iter_mut().filter(|v| v.on && v.uid == ch && v.key == key && v.left == i64::MAX) {
                    v.left = 1;
                }
            }
            Cmd::AllOff => {
                for v in self.voices.iter_mut() {
                    v.on = false;
                }
            }
            Cmd::Volume(v) => self.master_vol = v,
        }
    }

    pub fn poll(&mut self) {
        let Some(mut rx) = self.rx.take() else { return };
        while let Ok(m) = rx.pop() {
            self.tele.applied.store(m.seq, Ordering::Relaxed);
            self.handle(m.cmd);
        }
        self.rx = Some(rx);
    }

    /// pour le rendu hors ligne (export)
    pub fn apply(&mut self, cmd: Cmd) {
        self.handle(cmd);
    }
    pub fn position(&self) -> f64 {
        self.pos
    }
    pub fn active_voices(&self) -> usize {
        self.voices.iter().filter(|v| v.on).count()
    }

    pub fn render(&mut self, out: &mut [[f32; 2]]) {
        self.poll();
        let sr = self.sr;
        let tps = self.song.bpm * PPQ / 60.0 / sr as f64; // ticks par échantillon
        let cx = Ctx { sr, bpm: self.song.bpm as f32 };
        let n_ch = self.song.chans.len().min(MAX_CH);
        // gains des canaux pour ce bloc
        let mut gl = [0f32; MAX_CH];
        let mut gr = [0f32; MAX_CH];
        let mut route = [0usize; MAX_CH];
        for (i, c) in self.song.chans.iter().take(MAX_CH).enumerate() {
            let (a, b) = pan_gains(c.pan);
            let v = c.vol * c.vol; // courbe plus naturelle
            gl[i] = a * v;
            gr[i] = b * v;
            route[i] = c.ins;
        }
        let mut ins_gain = [(0f32, 0f32); MAX_INS];
        for (i, s) in self.song.ins.iter().enumerate().take(MAX_INS) {
            let audible = !s.mute && (i == 0 || !self.song.any_solo || s.solo);
            let (a, b) = pan_gains(s.pan);
            let v = if audible { s.vol * s.vol * 1.5625 } else { 0.0 }; // 0.8 = 0 dB
            ins_gain[i] = (a * v, b * v);
        }

        for frame in out.iter_mut() {
            // évènements du séquenceur
            if self.playing {
                loop {
                    let (t, ch, key, vel, len) = {
                        let evs = self.events();
                        match evs.get(self.idx) {
                            Some(e) if e.t <= self.pos => (e.t, e.ch, e.key, e.vel, e.len),
                            _ => break,
                        }
                    };
                    let _ = t;
                    self.idx += 1;
                    let ls = (len / tps).max(1.0) as i64;
                    self.note_on(ch, key, vel, ls);
                }
                // métronome
                if self.song.metronome {
                    let beat_before = (self.pos / PPQ).floor();
                    let beat_after = ((self.pos + tps) / PPQ).floor();
                    if beat_after > beat_before || self.pos == 0.0 && self.metro_t >= 1.0 {
                        self.metro_t = 0.0;
                        self.metro_f = if (beat_after as i64) % 4 == 0 { 1760.0 } else { 1100.0 };
                    }
                }
                self.pos += tps;
                let ll = self.loop_len();
                if self.pos >= ll {
                    self.pos -= ll;
                    self.idx = 0;
                }
            }
            for b in self.bus.iter_mut() {
                *b = (0.0, 0.0);
            }
            // voix
            for v in self.voices.iter_mut() {
                if !v.on {
                    continue;
                }
                let ch = v.ch;
                let Some(c) = self.song.chans.get(ch) else {
                    v.on = false;
                    continue;
                };
                let (l, r) = v.render(&c.inst, sr);
                if ch < n_ch {
                    let (l, r) = (l * gl[ch], r * gr[ch]);
                    let bi = route[ch];
                    self.bus[bi].0 += l;
                    self.bus[bi].1 += r;
                    let pk = l.abs().max(r.abs());
                    if pk > self.ch_peak[ch] {
                        self.ch_peak[ch] = pk;
                    }
                }
            }
            // pistes du mixeur -> master
            let (mut ml, mut mr) = self.bus[0];
            for i in 1..MAX_INS {
                let (mut l, mut r) = self.bus[i];
                for f in self.song.fx[i].iter_mut() {
                    (l, r) = f.process(l, r, &cx);
                }
                l *= ins_gain[i].0;
                r *= ins_gain[i].1;
                let pk = l.abs().max(r.abs());
                if pk > self.ins_peak[i] {
                    self.ins_peak[i] = pk;
                }
                ml += l;
                mr += r;
            }
            for f in self.song.fx[0].iter_mut() {
                (ml, mr) = f.process(ml, mr, &cx);
            }
            ml *= ins_gain[0].0 * self.master_vol;
            mr *= ins_gain[0].1 * self.master_vol;
            if self.metro_t < 0.03 {
                let c = (self.metro_t * self.metro_f * TAU).sin() * (1.0 - self.metro_t / 0.03) * 0.35;
                ml += c;
                mr += c;
                self.metro_t += 1.0 / sr;
            }
            let pk = ml.abs().max(mr.abs());
            if pk > self.ins_peak[0] {
                self.ins_peak[0] = pk;
            }
            let (l, r) = self.limiter.run(ml, mr, sr);
            *frame = [l, r];
        }

        // télémétrie
        let t = &self.tele;
        t.pos.store(self.pos.to_bits(), Ordering::Relaxed);
        t.playing.store(self.playing, Ordering::Relaxed);
        t.song_mode.store(self.song_mode, Ordering::Relaxed);
        for i in 0..MAX_INS {
            self.max_peaks[i] = self.max_peaks[i].max(self.ins_peak[i]);
            Telemetry::peak(&t.ins[i], self.ins_peak[i]);
            self.ins_peak[i] = 0.0;
        }
        for i in 0..MAX_CH {
            if self.ch_peak[i] > 0.0 {
                Telemetry::peak(&t.ch[i], self.ch_peak[i]);
                self.ch_peak[i] = 0.0;
            }
        }
        t.voices.store(self.voices.iter().filter(|v| v.on).count() as u32, Ordering::Relaxed);
    }
}
