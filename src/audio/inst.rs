// Instruments : kick (hardcore/uptempo/techno…), percussions synthétisées, synthé soustractif, sampler.
// Chaque voix rend un échantillon stéréo à la fois.
use super::dsp::*;
use std::sync::Arc;

pub struct Sample {
    pub l: Vec<f32>,
    pub r: Vec<f32>,
}

// ------------------------------------------------------------ paramètres (compilés depuis le projet JSON)
#[derive(Clone)]
pub struct KickP {
    pub start: f32,  // Hz au début du « pitch drop »
    pub end: f32,    // Hz de la queue (accordée sur la note 60 = C4)
    pub pdec: f32,   // s : vitesse de descente de la hauteur
    pub hold: f32,   // s
    pub decay: f32,  // s
    pub tail: f32,   // 0..1 : queue longue (uptempo)
    pub click: f32,  // 0..1
    pub shape: f32,  // 0..1 sinus -> carré
    pub drive: f32,  // gain linéaire avant saturation
    pub dtype: u8,
    pub tone: f32, // Hz (passe-bas après saturation)
    pub vol: f32,
}
#[derive(Clone)]
pub struct DrumP {
    pub kind: u8, // 0 clap, 1 caisse claire, 2 charley fermé, 3 charley ouvert, 4 crash, 5 tom, 6 percu/rim
    pub tone: f32,
    pub decay: f32,
    pub noise: f32,
    pub snap: f32,
    pub vol: f32,
}
#[derive(Clone)]
pub struct SynthP {
    pub w1: u8,
    pub w2: u8,
    pub semi2: f32,
    pub fine2: f32,
    pub mix2: f32,
    pub sub: f32,
    pub noise: f32,
    pub uni: usize,
    pub det: f32,
    pub spread: f32,
    pub pw: f32,
    pub ftype: u8,
    pub cut: f32,
    pub res: f32,
    pub fenv: f32,
    pub fkey: f32,
    pub fa: f32,
    pub fd: f32,
    pub fs: f32,
    pub fr: f32,
    pub a: f32,
    pub d: f32,
    pub s: f32,
    pub r: f32,
    pub penv: f32,
    pub pdec: f32,
    pub lfo_rate: f32,
    pub lfo_pitch: f32,
    pub lfo_cut: f32,
    pub glide: f32,
    pub mono: bool,
    pub oct: f32,
    pub drive: f32,
    pub vol: f32,
}
#[derive(Clone)]
pub struct SampP {
    pub sample: Option<Arc<Sample>>,
    pub root: f32,
    pub tune: f32,
    pub gain: f32,
    pub start: f32,
    pub rev: bool,
    pub att: f32,
    pub rel: f32,
    pub oneshot: bool,
}
#[derive(Clone)]
pub enum Inst {
    Kick(KickP),
    Drum(DrumP),
    Synth(SynthP),
    Samp(SampP),
}

// ------------------------------------------------------------ voix
pub struct KickV {
    t: f32,
    ph: f32,
    lp1: OnePole,
    lp2: OnePole,
    hp: OnePole,
    chp: OnePole,
}
pub struct DrumV {
    t: f32,
    ph: f32,
    mph: [f32; 6],
    bq1: Biquad,
    bq2: Biquad,
    tone: f32,
}
pub struct SynthV {
    t: f32,
    ph1: [f32; 7],
    ph2: f32,
    phs: f32,
    ratio: [f32; 7],
    pans: [(f32, f32); 7],
    det: f32,
    uni: usize,
    cur: f32, // note courante (glissando)
    target: f32,
    lfo: f32,
    amp: Adsr,
    fenv: Adsr,
    fl: Svf,
    fr: Svf,
}
pub struct SampV {
    pos: f64,
    amp: Adsr,
}
pub enum VState {
    None,
    Kick(KickV),
    Drum(DrumV),
    Synth(Box<SynthV>),
    Samp(SampV),
}

pub struct Voice {
    pub on: bool,
    pub ch: usize,
    pub uid: u32,
    pub key: u8,
    pub vel: f32,
    pub age: u64,
    /// échantillons avant le relâchement (i64::MAX = tenue jusqu'au NoteOff)
    pub left: i64,
    pub released: bool,
    /// étouffement rapide (voix volée ou kick suivant) : 1 -> 0
    pub choke: f32,
    pub rng: Rng,
    pub st: VState,
}

impl Voice {
    pub fn empty() -> Voice {
        Voice { on: false, ch: 0, uid: 0, key: 60, vel: 1.0, age: 0, left: 0, released: false, choke: 1.0, rng: Rng::new(1), st: VState::None }
    }

    pub fn start(&mut self, inst: &Inst, ch: usize, uid: u32, key: u8, vel: f32, len: i64, glide_from: Option<f32>, sr: f32) {
        self.on = true;
        self.ch = ch;
        self.uid = uid;
        self.key = key;
        self.vel = vel;
        self.left = len;
        self.released = false;
        self.choke = 1.0;
        self.rng = Rng::new(0x9E37_79B9 ^ (key as u32 * 7919) ^ (self.age as u32));
        self.age = 0;
        self.st = match inst {
            Inst::Kick(_) => VState::Kick(KickV { t: 0.0, ph: 0.0, lp1: OnePole::default(), lp2: OnePole::default(), hp: OnePole::default(), chp: OnePole::default() }),
            Inst::Drum(p) => {
                let tone = p.tone * 2f32.powf((key as f32 - 60.0) / 12.0);
                let mut bq1 = Biquad::default();
                let mut bq2 = Biquad::default();
                match p.kind {
                    0 => {
                        bq1.set(BqKind::Bp, 1100.0 * tone, 1.6, 0.0, sr);
                        bq2.set(BqKind::Hp, 500.0, 0.7, 0.0, sr);
                    }
                    1 => {
                        bq1.set(BqKind::Hp, 1400.0 * tone, 0.7, 0.0, sr);
                        bq2.set(BqKind::Bp, 4000.0 * tone, 0.8, 0.0, sr);
                    }
                    2 | 3 => {
                        bq1.set(BqKind::Hp, (6500.0 * tone).min(sr * 0.45), 0.7, 0.0, sr);
                        bq2.set(BqKind::Bp, (10000.0 * tone).min(sr * 0.45), 0.6, 0.0, sr);
                    }
                    4 => {
                        bq1.set(BqKind::Hp, (4000.0 * tone).min(sr * 0.45), 0.7, 0.0, sr);
                        bq2.set(BqKind::Bp, (7000.0 * tone).min(sr * 0.45), 0.5, 0.0, sr);
                    }
                    _ => {
                        bq1.set(BqKind::Bp, 2500.0 * tone, 1.0, 0.0, sr);
                        bq2.set(BqKind::Hp, 300.0, 0.7, 0.0, sr);
                    }
                }
                VState::Drum(DrumV { t: 0.0, ph: 0.0, mph: [0.0; 6], bq1, bq2, tone })
            }
            Inst::Synth(p) => {
                let k = key as f32 + p.oct * 12.0;
                let mut v = Box::new(SynthV {
                    t: 0.0,
                    ph1: [0.0; 7],
                    ph2: 0.0,
                    phs: 0.0,
                    ratio: [1.0; 7],
                    pans: [(1.0, 1.0); 7],
                    det: -1.0,
                    uni: 0,
                    cur: glide_from.unwrap_or(k),
                    target: k,
                    lfo: 0.0,
                    amp: Adsr::default(),
                    fenv: Adsr::default(),
                    fl: Svf::default(),
                    fr: Svf::default(),
                });
                // phases de départ différentes pour les voix d'unisson (son plus large)
                for (i, ph) in v.ph1.iter_mut().enumerate() {
                    *ph = if i == 0 { 0.0 } else { (self.rng.next() + 1.0) * 0.5 };
                }
                v.amp.gate_on();
                v.fenv.gate_on();
                VState::Synth(v)
            }
            Inst::Samp(p) => {
                let n = p.sample.as_ref().map(|s| s.l.len()).unwrap_or(0) as f64;
                let pos = if p.rev { n * (1.0 - p.start as f64) - 1.0 } else { n * p.start as f64 };
                let mut amp = Adsr::default();
                amp.gate_on();
                VState::Samp(SampV { pos: pos.max(0.0), amp })
            }
        };
    }

    /// nouvelle note sur une voix mono déjà active (legato)
    pub fn legato(&mut self, key: u8, vel: f32, len: i64, inst: &Inst) {
        if let (VState::Synth(v), Inst::Synth(p)) = (&mut self.st, inst) {
            v.target = key as f32 + p.oct * 12.0;
            if p.glide <= 0.0005 {
                v.cur = v.target;
            }
        }
        self.key = key;
        self.vel = vel;
        self.left = len;
    }

    pub fn release(&mut self) {
        if self.released {
            return;
        }
        self.released = true;
        match &mut self.st {
            VState::Synth(v) => {
                v.amp.gate_off();
                v.fenv.gate_off();
            }
            VState::Samp(v) => v.amp.gate_off(),
            _ => {}
        }
    }

    pub fn current_key(&self) -> Option<f32> {
        match &self.st {
            VState::Synth(v) => Some(v.cur),
            _ => None,
        }
    }

    /// rend un échantillon ; met `on` à false quand la voix est terminée
    #[inline]
    pub fn render(&mut self, inst: &Inst, sr: f32) -> (f32, f32) {
        if !self.on {
            return (0.0, 0.0);
        }
        self.age += 1;
        if self.left != i64::MAX {
            self.left -= 1;
            if self.left <= 0 && !self.released {
                self.release();
            }
        }
        let dt = 1.0 / sr;
        let vel = self.vel;
        let (l, r, done) = match (&mut self.st, inst) {
            (VState::Kick(v), Inst::Kick(p)) => {
                let t = v.t;
                v.t += dt;
                let ratio = 2f32.powf((self.key as f32 - 60.0) / 12.0);
                let f = (p.end + (p.start - p.end) * (-t / p.pdec.max(0.001)).exp()) * ratio;
                v.ph += f * dt;
                if v.ph >= 1.0 {
                    v.ph -= 1.0;
                }
                let mut x = (v.ph * TAU).sin();
                if p.shape > 0.01 {
                    let g = 1.0 + p.shape * 10.0;
                    x = (x * g).tanh() / g.tanh();
                }
                let amp = if t < p.hold {
                    1.0
                } else {
                    let k = (t - p.hold) * 6.9;
                    (1.0 - p.tail) * (-k / p.decay.max(0.005)).exp() + p.tail * (-k / (p.decay.max(0.005) * 3.5)).exp()
                };
                // attaque d'1 ms pour éviter le clic du départ
                let att = (t / 0.001).min(1.0);
                let mut y = x * amp * att;
                if p.click > 0.001 {
                    let n = self.rng.next() * (-t / 0.0025).exp() * p.click;
                    y += v.chp.hp(n, 1800.0, sr);
                }
                y *= vel;
                y = shape(p.dtype, y * p.drive);
                y = v.lp1.lp(y, p.tone, sr);
                y = v.lp2.lp(y, p.tone, sr);
                y = v.hp.hp(y, 22.0, sr);
                let done = t > p.hold + 0.01 && amp * p.drive.max(1.0) < 0.0003;
                let o = y * p.vol;
                (o, o, done)
            }
            (VState::Drum(v), Inst::Drum(p)) => {
                let t = v.t;
                v.t += dt;
                let dec = p.decay.max(0.005);
                let n = self.rng.next();
                let (y, alive) = match p.kind {
                    0 => {
                        // clap : 3 petites claques rapprochées puis la queue
                        let mut e = 0.0;
                        for k in 0..3 {
                            let tk = t - k as f32 * 0.011;
                            if tk >= 0.0 && tk < 0.011 {
                                e += (-tk / 0.004).exp();
                            }
                        }
                        let tl = t - 0.022;
                        if tl >= 0.0 {
                            e += (-tl * 6.9 / dec).exp();
                        }
                        let s = v.bq2.run(v.bq1.run(n * (0.4 + 0.6 * p.noise))) * e * 2.2;
                        (s, tl < dec * 1.2)
                    }
                    1 => {
                        // caisse claire : corps sinusoïdal + timbre (bruit)
                        let f = 190.0 * v.tone * (1.0 + 0.6 * (-t / 0.012).exp());
                        v.ph = (v.ph + f * dt) % 1.0;
                        let body = (v.ph * TAU).sin() * (-t * 6.9 / (dec * 0.45)).exp();
                        let ns = v.bq2.run(v.bq1.run(n)) * (-t * 6.9 / dec).exp() * 1.6;
                        let snap = n * (-t / 0.003).exp() * p.snap;
                        (body * (1.0 - p.noise * 0.6) + ns * p.noise + snap, t < dec * 1.2)
                    }
                    2 | 3 | 4 => {
                        // charley / crash : 6 carrés « métalliques » + bruit
                        const R: [f32; 6] = [1.0, 1.4471, 1.617, 1.9265, 2.5028, 2.6637];
                        let base = 205.0 * v.tone * if p.kind == 4 { 0.8 } else { 1.0 };
                        let mut m = 0.0;
                        for (i, ph) in v.mph.iter_mut().enumerate() {
                            *ph = (*ph + base * R[i] * dt) % 1.0;
                            m += if *ph < 0.5 { 1.0 } else { -1.0 };
                        }
                        let src = m / 6.0 * (1.0 - p.noise) + n * p.noise;
                        let d = if p.kind == 2 { dec } else { dec * 1.0 };
                        let e = (-t * 6.9 / d).exp() * (t / 0.0005).min(1.0);
                        (v.bq2.run(v.bq1.run(src)) * e * 2.5, t < d * 1.1)
                    }
                    5 => {
                        // tom
                        let f = 110.0 * v.tone * (1.0 + 0.8 * (-t / 0.02).exp());
                        v.ph = (v.ph + f * dt) % 1.0;
                        let s = (v.ph * TAU).sin() * (-t * 6.9 / dec).exp() + n * p.noise * 0.3 * (-t / 0.01).exp();
                        (s, t < dec * 1.1)
                    }
                    _ => {
                        // percu / rim
                        let f = 820.0 * v.tone;
                        v.ph = (v.ph + f * dt) % 1.0;
                        let s = (v.ph * TAU).sin() * (-t * 6.9 / (dec * 0.6)).exp() + v.bq1.run(n) * p.noise * (-t / 0.006).exp() * 2.0;
                        (v.bq2.run(s), t < dec)
                    }
                };
                let o = y * vel * p.vol;
                (o, o, !alive)
            }
            (VState::Synth(v), Inst::Synth(p)) => {
                let t = v.t;
                v.t += dt;
                let uni = p.uni.clamp(1, 7);
                if v.det != p.det || v.uni != uni || (v.pans[0].0 - pan_gains(-p.spread).0).abs() > 1e-3 {
                    v.det = p.det;
                    v.uni = uni;
                    for u in 0..uni {
                        let pos = if uni == 1 { 0.0 } else { u as f32 / (uni - 1) as f32 * 2.0 - 1.0 };
                        v.ratio[u] = 2f32.powf(pos * p.det * 0.6 / 12.0);
                        v.pans[u] = pan_gains(pos * p.spread);
                    }
                }
                // glissando
                if p.glide > 0.0005 {
                    let k = 1.0 - (-dt * 4.0 / p.glide).exp();
                    v.cur += (v.target - v.cur) * k;
                } else {
                    v.cur = v.target;
                }
                v.lfo = (v.lfo + p.lfo_rate * dt) % 1.0;
                let lfo = (v.lfo * TAU).sin();
                let pe = if p.penv.abs() > 0.01 { p.penv * (-t / p.pdec.max(0.001)).exp() } else { 0.0 };
                let note = v.cur + pe + lfo * p.lfo_pitch;
                let fb = mtof(note);
                let mut sl = 0.0;
                let mut sr_ = 0.0;
                let norm = 1.0 / (uni as f32).sqrt();
                for u in 0..uni {
                    let f = fb * v.ratio[u];
                    let d = (f * dt).min(0.5);
                    let o = osc(p.w1, v.ph1[u], d, p.pw, &mut self.rng);
                    v.ph1[u] += d;
                    if v.ph1[u] >= 1.0 {
                        v.ph1[u] -= 1.0;
                    }
                    sl += o * v.pans[u].0;
                    sr_ += o * v.pans[u].1;
                }
                sl *= norm * (1.0 - p.mix2);
                sr_ *= norm * (1.0 - p.mix2);
                if p.mix2 > 0.001 {
                    let f2 = fb * 2f32.powf((p.semi2 + p.fine2 / 100.0) / 12.0);
                    let d = (f2 * dt).min(0.5);
                    let o = osc(p.w2, v.ph2, d, p.pw, &mut self.rng) * p.mix2;
                    v.ph2 += d;
                    if v.ph2 >= 1.0 {
                        v.ph2 -= 1.0;
                    }
                    sl += o;
                    sr_ += o;
                }
                if p.sub > 0.001 {
                    v.phs = (v.phs + fb * 0.5 * dt) % 1.0;
                    let o = (v.phs * TAU).sin() * p.sub;
                    sl += o;
                    sr_ += o;
                }
                if p.noise > 0.001 {
                    let o = self.rng.next() * p.noise * 0.5;
                    sl += o;
                    sr_ += o;
                }
                if p.drive > 0.01 {
                    let g = 1.0 + p.drive * 12.0;
                    sl = (sl * g).tanh();
                    sr_ = (sr_ * g).tanh();
                }
                let fe = v.fenv.run(p.fa, p.fd, p.fs, p.fr, sr);
                let oct = p.fenv * fe + lfo * p.lfo_cut + p.fkey * (v.cur - 60.0) / 12.0;
                let fc = (p.cut * 2f32.powf(oct)).clamp(20.0, 20000.0);
                let (a, b, c) = v.fl.run(sl, fc, p.res, sr);
                let (a2, b2, c2) = v.fr.run(sr_, fc, p.res, sr);
                let (yl, yr) = match p.ftype {
                    1 => (c, c2),
                    2 => (b, b2),
                    3 => (sl, sr_), // filtre coupé
                    _ => (a, a2),
                };
                let amp = v.amp.run(p.a, p.d, p.s, p.r, sr);
                let g = amp * vel * p.vol * 0.45;
                (yl * g, yr * g, v.amp.idle() && self.released)
            }
            (VState::Samp(v), Inst::Samp(p)) => match &p.sample {
                None => (0.0, 0.0, true),
                Some(s) => {
                    let n = s.l.len();
                    let step = 2f64.powf(((self.key as f32 - p.root + p.tune) / 12.0) as f64);
                    let i = v.pos as usize;
                    if (v.pos < 0.0) || i + 1 >= n {
                        (0.0, 0.0, true)
                    } else {
                        let f = (v.pos - i as f64) as f32;
                        let l = s.l[i] + (s.l[i + 1] - s.l[i]) * f;
                        let r = s.r[i] + (s.r[i + 1] - s.r[i]) * f;
                        if p.rev {
                            v.pos -= step;
                        } else {
                            v.pos += step;
                        }
                        if p.oneshot && self.released && !v.amp.idle() && v.amp.stage == Stage::Release {
                            // en mode « one shot », la longueur de la note n'arrête pas le son
                            v.amp.stage = Stage::Sustain;
                        }
                        let a = v.amp.run(p.att, 0.001, 1.0, p.rel, sr);
                        let g = a * vel * p.gain;
                        (l * g, r * g, v.amp.idle() && self.released && !p.oneshot)
                    }
                }
            },
            _ => (0.0, 0.0, true),
        };
        let mut l = l;
        let mut r = r;
        if self.choke < 1.0 {
            self.choke -= 1.0 / (0.004 * sr);
            if self.choke <= 0.0 {
                self.on = false;
                return (0.0, 0.0);
            }
            l *= self.choke;
            r *= self.choke;
        }
        if done {
            self.on = false;
        }
        (l, r)
    }
}
