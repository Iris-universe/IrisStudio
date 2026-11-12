// Briques DSP : filtres (biquad RBJ, SVF), enveloppes, oscillateurs anti-repliement, bruit, saturations.
use std::f32::consts::PI;

pub const TAU: f32 = 2.0 * PI;

#[inline]
pub fn db(x: f32) -> f32 {
    10f32.powf(x / 20.0)
}
#[inline]
pub fn to_db(x: f32) -> f32 {
    if x <= 1e-6 {
        -120.0
    } else {
        20.0 * x.log10()
    }
}
#[inline]
pub fn mtof(m: f32) -> f32 {
    440.0 * 2f32.powf((m - 69.0) / 12.0)
}
/// panoramique à puissance constante : (gauche, droite) pour pan -1..1
#[inline]
pub fn pan_gains(p: f32) -> (f32, f32) {
    let a = (p.clamp(-1.0, 1.0) + 1.0) * 0.25 * PI;
    (a.cos() * std::f32::consts::SQRT_2, a.sin() * std::f32::consts::SQRT_2)
}

// ------------------------------------------------------------ bruit
#[derive(Clone)]
pub struct Rng(u32);
impl Rng {
    pub fn new(seed: u32) -> Self {
        Rng(seed.max(1))
    }
    #[inline]
    pub fn next(&mut self) -> f32 {
        // xorshift32
        let mut x = self.0;
        x ^= x << 13;
        x ^= x >> 17;
        x ^= x << 5;
        self.0 = x;
        (x as f32 / u32::MAX as f32) * 2.0 - 1.0
    }
}

// ------------------------------------------------------------ biquad (formules RBJ)
#[derive(Clone, Copy, Default)]
pub struct Biquad {
    b0: f32,
    b1: f32,
    b2: f32,
    a1: f32,
    a2: f32,
    z1: f32,
    z2: f32,
}
#[derive(Clone, Copy, PartialEq)]
pub enum BqKind {
    Lp,
    Hp,
    Bp,
    Peak,
    LowShelf,
    HighShelf,
}
impl Biquad {
    pub fn set(&mut self, kind: BqKind, f: f32, q: f32, gain_db: f32, sr: f32) {
        let f = f.clamp(10.0, sr * 0.49);
        let w = TAU * f / sr;
        let (s, c) = w.sin_cos();
        let q = q.max(0.05);
        let alpha = s / (2.0 * q);
        let a = 10f32.powf(gain_db / 40.0);
        let (b0, b1, b2, a0, a1, a2) = match kind {
            BqKind::Lp => ((1.0 - c) / 2.0, 1.0 - c, (1.0 - c) / 2.0, 1.0 + alpha, -2.0 * c, 1.0 - alpha),
            BqKind::Hp => ((1.0 + c) / 2.0, -(1.0 + c), (1.0 + c) / 2.0, 1.0 + alpha, -2.0 * c, 1.0 - alpha),
            BqKind::Bp => (alpha, 0.0, -alpha, 1.0 + alpha, -2.0 * c, 1.0 - alpha),
            BqKind::Peak => (1.0 + alpha * a, -2.0 * c, 1.0 - alpha * a, 1.0 + alpha / a, -2.0 * c, 1.0 - alpha / a),
            BqKind::LowShelf => {
                let sa = 2.0 * a.sqrt() * alpha;
                (
                    a * ((a + 1.0) - (a - 1.0) * c + sa),
                    2.0 * a * ((a - 1.0) - (a + 1.0) * c),
                    a * ((a + 1.0) - (a - 1.0) * c - sa),
                    (a + 1.0) + (a - 1.0) * c + sa,
                    -2.0 * ((a - 1.0) + (a + 1.0) * c),
                    (a + 1.0) + (a - 1.0) * c - sa,
                )
            }
            BqKind::HighShelf => {
                let sa = 2.0 * a.sqrt() * alpha;
                (
                    a * ((a + 1.0) + (a - 1.0) * c + sa),
                    -2.0 * a * ((a - 1.0) + (a + 1.0) * c),
                    a * ((a + 1.0) + (a - 1.0) * c - sa),
                    (a + 1.0) - (a - 1.0) * c + sa,
                    2.0 * ((a - 1.0) - (a + 1.0) * c),
                    (a + 1.0) - (a - 1.0) * c - sa,
                )
            }
        };
        self.b0 = b0 / a0;
        self.b1 = b1 / a0;
        self.b2 = b2 / a0;
        self.a1 = a1 / a0;
        self.a2 = a2 / a0;
    }
    #[inline]
    pub fn run(&mut self, x: f32) -> f32 {
        // forme directe transposée II
        let y = self.b0 * x + self.z1;
        self.z1 = self.b1 * x - self.a1 * y + self.z2;
        self.z2 = self.b2 * x - self.a2 * y;
        if !y.is_finite() {
            self.z1 = 0.0;
            self.z2 = 0.0;
            return 0.0;
        }
        y
    }
    pub fn reset(&mut self) {
        self.z1 = 0.0;
        self.z2 = 0.0;
    }
}

// ------------------------------------------------------------ filtre à variable d'état (TPT, Zavalishin)
#[derive(Clone, Copy, Default)]
pub struct Svf {
    ic1: f32,
    ic2: f32,
}
impl Svf {
    /// renvoie (passe-bas, passe-bande, passe-haut) ; res 0..1
    #[inline]
    pub fn run(&mut self, x: f32, fc: f32, res: f32, sr: f32) -> (f32, f32, f32) {
        let g = (PI * fc.clamp(15.0, sr * 0.45) / sr).tan();
        let k = 2.0 - 1.96 * res.clamp(0.0, 1.0);
        let a1 = 1.0 / (1.0 + g * (g + k));
        let a2 = g * a1;
        let a3 = g * a2;
        let v3 = x - self.ic2;
        let v1 = a1 * self.ic1 + a2 * v3;
        let v2 = self.ic2 + a2 * self.ic1 + a3 * v3;
        self.ic1 = 2.0 * v1 - self.ic1;
        self.ic2 = 2.0 * v2 - self.ic2;
        if !self.ic1.is_finite() || !self.ic2.is_finite() {
            self.ic1 = 0.0;
            self.ic2 = 0.0;
        }
        (v2, v1, x - k * v1 - v2)
    }
}

/// passe-bas à un pôle
#[derive(Clone, Copy, Default)]
pub struct OnePole {
    z: f32,
}
impl OnePole {
    #[inline]
    pub fn lp(&mut self, x: f32, fc: f32, sr: f32) -> f32 {
        let a = 1.0 - (-TAU * fc / sr).exp();
        self.z += a * (x - self.z);
        self.z
    }
    #[inline]
    pub fn hp(&mut self, x: f32, fc: f32, sr: f32) -> f32 {
        x - self.lp(x, fc, sr)
    }
}

// ------------------------------------------------------------ enveloppe ADSR (temps en secondes)
#[derive(Clone, Copy, PartialEq, Default)]
pub enum Stage {
    #[default]
    Idle,
    Attack,
    Decay,
    Sustain,
    Release,
}
#[derive(Clone, Copy, Default)]
pub struct Adsr {
    pub stage: Stage,
    pub v: f32,
}
impl Adsr {
    pub fn gate_on(&mut self) {
        self.stage = Stage::Attack;
    }
    pub fn gate_off(&mut self) {
        if self.stage != Stage::Idle {
            self.stage = Stage::Release;
        }
    }
    /// a, d, r en secondes, s 0..1
    #[inline]
    pub fn run(&mut self, a: f32, d: f32, s: f32, r: f32, sr: f32) -> f32 {
        match self.stage {
            Stage::Idle => self.v = 0.0,
            Stage::Attack => {
                self.v += 1.0 / (a.max(0.0005) * sr);
                if self.v >= 1.0 {
                    self.v = 1.0;
                    self.stage = Stage::Decay;
                }
            }
            Stage::Decay => {
                let k = 1.0 - (-6.9 / (d.max(0.001) * sr)).exp();
                self.v += (s - self.v) * k;
                if (self.v - s).abs() < 1e-4 {
                    self.v = s;
                    self.stage = Stage::Sustain;
                }
            }
            Stage::Sustain => {
                self.v = s;
                if s <= 1e-5 {
                    self.stage = Stage::Idle;
                }
            }
            Stage::Release => {
                let k = 1.0 - (-6.9 / (r.max(0.001) * sr)).exp();
                self.v -= self.v * k;
                if self.v < 1e-4 {
                    self.v = 0.0;
                    self.stage = Stage::Idle;
                }
            }
        }
        self.v
    }
    pub fn idle(&self) -> bool {
        self.stage == Stage::Idle
    }
}

// ------------------------------------------------------------ oscillateurs (polyBLEP)
#[inline]
pub fn poly_blep(t: f32, dt: f32) -> f32 {
    if t < dt {
        let t = t / dt;
        t + t - t * t - 1.0
    } else if t > 1.0 - dt {
        let t = (t - 1.0) / dt;
        t * t + t + t + 1.0
    } else {
        0.0
    }
}
/// formes : 0 dent de scie, 1 carré, 2 sinus, 3 triangle, 4 bruit
#[inline]
pub fn osc(wave: u8, ph: f32, dt: f32, pw: f32, rng: &mut Rng) -> f32 {
    match wave {
        0 => 2.0 * ph - 1.0 - poly_blep(ph, dt),
        1 => {
            let mut v = if ph < pw { 1.0 } else { -1.0 };
            v += poly_blep(ph, dt);
            let t2 = (ph - pw + 1.0) % 1.0;
            v -= poly_blep(t2, dt);
            v
        }
        2 => (ph * TAU).sin(),
        3 => 1.0 - 4.0 * (ph - 0.5).abs(),
        _ => rng.next(),
    }
}

// ------------------------------------------------------------ saturations
/// types : 0 douce (tanh), 1 dure (écrêtage), 2 repli (foldback), 3 asymétrique, 4 bitcrush
#[inline]
pub fn shape(kind: u8, x: f32) -> f32 {
    match kind {
        0 => x.tanh(),
        1 => x.clamp(-1.0, 1.0),
        2 => {
            // repli : renvoie le signal vers l'intérieur au-delà de ±1
            let mut y = x;
            for _ in 0..8 {
                if y > 1.0 {
                    y = 2.0 - y;
                } else if y < -1.0 {
                    y = -2.0 - y;
                } else {
                    break;
                }
            }
            y.clamp(-1.0, 1.0)
        }
        3 => {
            if x >= 0.0 {
                x.tanh()
            } else {
                (x * 0.6).tanh() / 0.6f32.tanh() * 0.8
            }
        }
        _ => {
            let steps = 12.0;
            ((x.clamp(-1.0, 1.0) * steps).round() / steps).clamp(-1.0, 1.0)
        }
    }
}

/// lissage d'un paramètre (évite les clics)
#[derive(Clone, Copy, Default)]
pub struct Smooth {
    pub v: f32,
    init: bool,
}
impl Smooth {
    #[inline]
    pub fn run(&mut self, target: f32, k: f32) -> f32 {
        if !self.init {
            self.v = target;
            self.init = true;
        }
        self.v += (target - self.v) * k;
        self.v
    }
}
