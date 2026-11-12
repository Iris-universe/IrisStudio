// Effets des pistes du mixeur : EQ, filtre, distorsion, compresseur, delay, reverb, limiteur.
// Les paramètres sont un tableau de 8 nombres (sens selon l'effet, voir ui/js/instruments.js -> FX).
use super::dsp::*;

pub const EQ: u8 = 0;
pub const FILTER: u8 = 1;
pub const DIST: u8 = 2;
pub const COMP: u8 = 3;
pub const DELAY: u8 = 4;
pub const REVERB: u8 = 5;
pub const LIMIT: u8 = 6;

pub fn kind_of(s: &str) -> Option<u8> {
    Some(match s {
        "eq" => EQ,
        "filter" => FILTER,
        "dist" => DIST,
        "comp" => COMP,
        "delay" => DELAY,
        "reverb" => REVERB,
        "limiter" => LIMIT,
        _ => return None,
    })
}

pub struct Ctx {
    pub sr: f32,
    pub bpm: f32,
}

#[derive(Default)]
pub struct Freeverb {
    combs: Vec<(Vec<f32>, usize, f32)>, // tampon, index, mémoire du filtre
    aps: Vec<(Vec<f32>, usize)>,
}
impl Freeverb {
    fn new(sr: f32, spread: usize) -> Self {
        let k = sr / 44100.0;
        let c = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
        let a = [556, 441, 341, 225];
        Freeverb {
            combs: c.iter().map(|&n| (vec![0.0; ((n + spread) as f32 * k) as usize + 1], 0, 0.0)).collect(),
            aps: a.iter().map(|&n| (vec![0.0; ((n + spread) as f32 * k) as usize + 1], 0)).collect(),
        }
    }
    #[inline]
    fn run(&mut self, x: f32, fb: f32, damp: f32) -> f32 {
        let mut out = 0.0;
        for (buf, i, st) in self.combs.iter_mut() {
            let y = buf[*i];
            *st = y * (1.0 - damp) + *st * damp;
            buf[*i] = x + *st * fb;
            *i += 1;
            if *i >= buf.len() {
                *i = 0;
            }
            out += y;
        }
        for (buf, i) in self.aps.iter_mut() {
            let b = buf[*i];
            buf[*i] = out + b * 0.5;
            out = b - out;
            *i += 1;
            if *i >= buf.len() {
                *i = 0;
            }
        }
        out
    }
}

#[derive(Default)]
pub struct State {
    bq: [Biquad; 6],
    svf: [Svf; 2],
    tone: [OnePole; 2],
    env: f32,
    gain: f32,
    buf_l: Vec<f32>,
    buf_r: Vec<f32>,
    w: usize,
    fb_lp: [OnePole; 2],
    fb_hp: [OnePole; 2],
    rv: Vec<Freeverb>,
    dsmooth: Smooth,
}

pub struct Fx {
    pub id: u32,
    pub kind: u8,
    pub on: bool,
    pub p: [f32; 8],
    last: [f32; 8],
    last_sr: f32,
    pub st: State,
}

impl Fx {
    /// `alloc` = false : pas de tampons (l'état sera repris de l'effet déjà en place dans le fil audio)
    pub fn new(id: u32, kind: u8, on: bool, p: [f32; 8], sr: f32, alloc: bool) -> Fx {
        let mut st = State { gain: 1.0, ..Default::default() };
        if alloc {
            match kind {
                DELAY => {
                    let n = (sr * 4.0) as usize;
                    st.buf_l = vec![0.0; n];
                    st.buf_r = vec![0.0; n];
                }
                REVERB => st.rv = vec![Freeverb::new(sr, 0), Freeverb::new(sr, 23)],
                _ => {}
            }
        }
        Fx { id, kind, on, p, last: [f32::NAN; 8], last_sr: 0.0, st }
    }

    pub fn has_buffers(&self) -> bool {
        match self.kind {
            DELAY => !self.st.buf_l.is_empty(),
            REVERB => !self.st.rv.is_empty(),
            _ => true,
        }
    }
    pub fn mark_dirty(&mut self) {
        self.last = [f32::NAN; 8];
    }

    fn update(&mut self, sr: f32) {
        if self.last == self.p && self.last_sr == sr {
            return;
        }
        self.last = self.p;
        self.last_sr = sr;
        let p = self.p;
        match self.kind {
            EQ => {
                for c in 0..2 {
                    self.st.bq[c * 3].set(BqKind::LowShelf, 110.0, 0.7, p[0], sr);
                    self.st.bq[c * 3 + 1].set(BqKind::Peak, p[2].max(100.0), 0.9, p[1], sr);
                    self.st.bq[c * 3 + 2].set(BqKind::HighShelf, 7000.0, 0.7, p[3], sr);
                }
            }
            _ => {}
        }
    }

    #[inline]
    pub fn process(&mut self, l: f32, r: f32, cx: &Ctx) -> (f32, f32) {
        if !self.on || !self.has_buffers() {
            return (l, r);
        }
        self.update(cx.sr);
        let p = self.p;
        let sr = cx.sr;
        let st = &mut self.st;
        match self.kind {
            EQ => {
                let mut a = st.bq[0].run(l);
                a = st.bq[1].run(a);
                a = st.bq[2].run(a);
                let mut b = st.bq[3].run(r);
                b = st.bq[4].run(b);
                b = st.bq[5].run(b);
                (a, b)
            }
            FILTER => {
                let fc = st.dsmooth.run(p[1], 0.002);
                let (a1, b1, c1) = st.svf[0].run(l, fc, p[2], sr);
                let (a2, b2, c2) = st.svf[1].run(r, fc, p[2], sr);
                let (yl, yr) = match p[0] as u8 {
                    1 => (c1, c2),
                    2 => (b1, b2),
                    _ => (a1, a2),
                };
                let m = p[3];
                (l + (yl - l) * m, r + (yr - r) * m)
            }
            DIST => {
                let g = db(p[0]);
                let k = p[1] as u8;
                let out = db(p[4]);
                let yl = st.tone[0].lp(shape(k, l * g), p[2], sr);
                let yr = st.tone[1].lp(shape(k, r * g), p[2], sr);
                let m = p[3];
                ((l + (yl - l) * m) * out, (r + (yr - r) * m) * out)
            }
            COMP => {
                let x = l.abs().max(r.abs());
                let xd = to_db(x);
                let over = (xd - p[0]).max(0.0);
                let red = over - over / p[1].max(1.0);
                let tc = if red > st.env { p[2] } else { p[3] };
                let k = 1.0 - (-1.0 / (tc.max(0.1) * 0.001 * sr)).exp();
                st.env += (red - st.env) * k;
                let g = db(-st.env + p[4]);
                (l * g, r * g)
            }
            DELAY => {
                // temps en doubles-croches (1/16), calé sur le tempo
                let step = 60.0 / cx.bpm.max(20.0) / 4.0;
                let target = (p[0].max(0.25) * step * sr).min(st.buf_l.len() as f32 - 2.0);
                let d = st.dsmooth.run(target, 0.0005);
                let n = st.buf_l.len();
                let rp = (st.w as f32 + n as f32 - d) % n as f32;
                let i = rp as usize;
                let f = rp - i as f32;
                let j = (i + 1) % n;
                let dl = st.buf_l[i] + (st.buf_l[j] - st.buf_l[i]) * f;
                let dr = st.buf_r[i] + (st.buf_r[j] - st.buf_r[i]) * f;
                let fb = p[1].clamp(0.0, 0.95);
                let ml = st.fb_hp[0].hp(st.fb_lp[0].lp(dl, p[4].max(500.0), sr), 120.0, sr);
                let mr = st.fb_hp[1].hp(st.fb_lp[1].lp(dr, p[4].max(500.0), sr), 120.0, sr);
                if p[3] > 0.5 {
                    // ping-pong : l'écho passe d'un côté à l'autre
                    st.buf_l[st.w] = (l + r) * 0.5 + mr * fb;
                    st.buf_r[st.w] = ml * fb;
                } else {
                    st.buf_l[st.w] = l + ml * fb;
                    st.buf_r[st.w] = r + mr * fb;
                }
                st.w = (st.w + 1) % n;
                let m = p[2];
                (l + dl * m, r + dr * m)
            }
            REVERB => {
                let fb = 0.7 + p[0].clamp(0.0, 1.0) * 0.28;
                let damp = p[1].clamp(0.0, 1.0) * 0.4;
                let x = (l + r) * 0.015;
                let a = st.rv[0].run(x, fb, damp);
                let b = st.rv[1].run(x, fb, damp);
                let w = p[3].clamp(0.0, 1.0);
                let wl = a * (0.5 + w * 0.5) + b * (0.5 - w * 0.5);
                let wr = b * (0.5 + w * 0.5) + a * (0.5 - w * 0.5);
                let m = p[2];
                (l * (1.0 - m * 0.5) + wl * m * 3.0, r * (1.0 - m * 0.5) + wr * m * 3.0)
            }
            LIMIT => {
                let g_in = db(p[2]);
                let ceil = db(p[0].min(0.0));
                let (l, r) = (l * g_in, r * g_in);
                let x = l.abs().max(r.abs());
                let target = if x > ceil { ceil / x } else { 1.0 };
                if target < st.gain {
                    st.gain = target;
                } else {
                    let k = 1.0 - (-1.0 / (p[1].max(1.0) * 0.001 * sr)).exp();
                    st.gain += (target - st.gain) * k;
                }
                ((l * st.gain).clamp(-ceil, ceil), (r * st.gain).clamp(-ceil, ceil))
            }
            _ => (l, r),
        }
    }
}

/// limiteur de sortie (toujours actif sur le master) : -0,3 dB, relâchement 60 ms
pub struct MasterLimiter {
    gain: f32,
}
impl MasterLimiter {
    pub fn new() -> Self {
        MasterLimiter { gain: 1.0 }
    }
    #[inline]
    pub fn run(&mut self, l: f32, r: f32, sr: f32) -> (f32, f32) {
        let ceil = 0.966;
        let x = l.abs().max(r.abs());
        let target = if x > ceil { ceil / x } else { 1.0 };
        if target < self.gain {
            self.gain = target;
        } else {
            self.gain += (target - self.gain) * (1.0 - (-1.0 / (0.06 * sr)).exp());
        }
        let l = (l * self.gain).clamp(-1.0, 1.0);
        let r = (r * self.gain).clamp(-1.0, 1.0);
        if l.is_finite() && r.is_finite() {
            (l, r)
        } else {
            self.gain = 1.0;
            (0.0, 0.0)
        }
    }
}
