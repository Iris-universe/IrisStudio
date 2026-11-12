// Piano roll : notes du canal sélectionné dans le motif sélectionné.
import { STEP, PPQ, BAR, notesOf } from './project.js';
import { noteName, isBlack, SCALES, ROOTS } from './instruments.js';
import { esc } from './widgets.js';

const KW = 58, RH = 22, VH = 70, HIGH = 119, LOW = 12;

export class PianoRoll {
  constructor(app, el) {
    this.app = app; this.el = el;
    this.px = 26;      // pixels par pas
    this.kh = 14;      // hauteur d'une touche
    this.sx = 0; this.sy = null;
    this.snap = STEP; this.lastLen = STEP;
    this.root = 9; this.scale = 'none';
    try { const s = JSON.parse(localStorage.getItem('pr') || '{}'); Object.assign(this, { root: s.root ?? 9, scale: s.scale ?? 'none', snap: s.snap ?? STEP }); } catch {}
    el.innerHTML = `<div class="ed-head">
      <label>Canal</label><select id="pr-ch" data-ctl="pr-channel"></select>
      <label>Grille</label><select id="pr-snap" data-ctl="pr-snap" title="Les notes se calent sur cette grille"><option value="96">Temps (1/4)</option><option value="48">Croche (1/8)</option><option value="24">Pas (1/16)</option><option value="12">1/32</option><option value="8">Triolet</option><option value="1">Libre</option></select>
      <label>Gamme</label><select id="pr-root" data-ctl="pr-root">${ROOTS.map((r, i) => `<option value="${i}">${r}</option>`).join('')}</select><select id="pr-scale" data-ctl="pr-scale" title="Surligne les notes de la gamme (elles « sonnent juste » ensemble)">${Object.entries(SCALES).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}</select>
      <button id="pr-down12" title="Tout descendre d'une octave">−8ve</button><button id="pr-down" title="Tout descendre d'un demi-ton">−1</button><button id="pr-up" title="Tout monter d'un demi-ton">+1</button><button id="pr-up12" title="Tout monter d'une octave">+8ve</button>
      <button id="pr-clear" title="Effacer les notes de ce canal dans ce motif">Effacer</button>
      <span class="hint">Clic = note · glisser = déplacer · bord droit = longueur · clic droit = effacer · Ctrl+molette = zoom</span></div>
      <div class="ed-wrap"><canvas></canvas></div>`;
    this.wrap = el.querySelector('.ed-wrap');
    this.c = el.querySelector('canvas');
    this.g = this.c.getContext('2d');
    const $ = (s) => el.querySelector(s);
    $('#pr-ch').onchange = () => this.app.select(Number($('#pr-ch').value));
    $('#pr-snap').value = String(this.snap);
    $('#pr-snap').onchange = () => { this.snap = Number($('#pr-snap').value); this.savePrefs(); };
    $('#pr-root').value = String(this.root); $('#pr-scale').value = this.scale;
    $('#pr-root').onchange = () => { this.root = Number($('#pr-root').value); this.savePrefs(); this.draw(); app.mark('scale'); };
    $('#pr-scale').onchange = () => { this.scale = $('#pr-scale').value; this.savePrefs(); this.draw(); app.mark('scale'); };
    const tr = (d) => { const ch = app.selChannel(); if (!ch) return; app.store.change(() => { for (const n of notesOf(app.curPat(), ch.id)) n.key = Math.max(0, Math.min(127, n.key + d)); }); };
    $('#pr-down12').onclick = () => tr(-12); $('#pr-down').onclick = () => tr(-1); $('#pr-up').onclick = () => tr(1); $('#pr-up12').onclick = () => tr(12);
    $('#pr-clear').onclick = () => { const ch = app.selChannel(); if (ch) app.store.change(() => delete app.curPat().notes[ch.id]); };
    new ResizeObserver(() => this.resize()).observe(this.wrap);
    this.setupMouse();
  }

  savePrefs() { try { localStorage.setItem('pr', JSON.stringify({ root: this.root, scale: this.scale, snap: this.snap })); } catch {} }

  resize() {
    const r = this.wrap.getBoundingClientRect();
    if (!r.width) return;
    const dpr = devicePixelRatio || 1;
    this.W = r.width; this.H = r.height;
    this.c.width = r.width * dpr; this.c.height = r.height * dpr;
    this.c.style.width = r.width + 'px'; this.c.style.height = r.height + 'px';
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.sy == null) this.centerOn(this.app.selChannel());
    this.draw();
  }

  centerOn(ch) {
    const notes = ch ? this.app.curPat().notes[ch.id] || [] : [];
    const mid = notes.length ? notes.reduce((a, n) => a + n.key, 0) / notes.length : 66;
    this.sy = Math.max(0, (HIGH - mid) * this.kh - ((this.H || 500) - RH - VH) / 2);
  }

  render() {
    const app = this.app, ch = app.selChannel();
    const sel = this.el.querySelector('#pr-ch');
    sel.innerHTML = app.p.channels.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('') || '<option>(aucun canal)</option>';
    if (ch) sel.value = String(ch.id);
    if (this._lastCh !== ch?.id) { this._lastCh = ch?.id; this.centerOn(ch); }
    this.draw();
  }

  // ------------------------------------------------------------ géométrie
  get gridH() { return this.H - RH - VH; }
  tx(t) { return KW + (t / STEP) * this.px - this.sx; }
  xt(x) { return ((x - KW + this.sx) / this.px) * STEP; }
  ky(k) { return RH + (HIGH - k) * this.kh - this.sy; }
  yk(y) { return HIGH - Math.floor((y - RH + this.sy) / this.kh); }
  inScale(k) { const sc = SCALES[this.scale].iv; return !sc || sc.includes(((k - this.root) % 12 + 12) % 12); }

  noteAt(x, y) {
    const ch = this.app.selChannel(); if (!ch) return null;
    const list = this.app.curPat().notes[ch.id] || [];
    const k = this.yk(y);
    for (let i = list.length - 1; i >= 0; i--) {
      const n = list[i];
      if (n.key !== k) continue;
      const x0 = this.tx(n.t), x1 = this.tx(n.t + n.len);
      if (x >= x0 && x <= x1) return { n, edge: x > x1 - 7 && x1 - x0 > 10 };
    }
    return null;
  }

  // ------------------------------------------------------------ dessin
  draw() {
    if (!this.W || this.el.hidden) return;
    const g = this.g, W = this.W, H = this.H, app = this.app, pat = app.curPat(), ch = app.selChannel();
    const len = pat.len * STEP;
    g.fillStyle = '#15181d'; g.fillRect(0, 0, W, H);
    // lignes de touches
    g.save(); g.beginPath(); g.rect(KW, RH, W - KW, this.gridH); g.clip();
    for (let k = LOW; k <= HIGH; k++) {
      const y = this.ky(k);
      if (y > H || y + this.kh < RH) continue;
      const scaleOn = SCALES[this.scale].iv;
      let col = isBlack(k) ? '#1a1e24' : '#20252d';
      if (scaleOn) col = this.inScale(k) ? (((k - this.root) % 12 + 12) % 12 === 0 ? '#2d2a3d' : '#232a33') : '#16191e';
      g.fillStyle = col; g.fillRect(KW, y, W - KW, this.kh);
      g.fillStyle = k % 12 === 0 ? '#3a4250' : '#1b1f25'; g.fillRect(KW, y + this.kh - 1, W - KW, 1);
    }
    // lignes de temps
    const s0 = Math.floor(this.sx / this.px), s1 = s0 + Math.ceil((W - KW) / this.px) + 1;
    for (let s = s0; s <= s1; s++) {
      const x = Math.round(this.tx(s * STEP)) + 0.5;
      g.fillStyle = s % 16 === 0 ? '#566070' : s % 4 === 0 ? '#323945' : '#22272f';
      g.fillRect(x, RH, 1, this.gridH);
    }
    // au-delà de la fin du motif
    const xe = this.tx(len);
    if (xe < W) { g.fillStyle = '#0008'; g.fillRect(Math.max(KW, xe), RH, W, this.gridH); }
    // notes des autres canaux (fantômes)
    for (const other of app.p.channels) {
      if (other.id === ch?.id) continue;
      g.fillStyle = 'rgba(255,255,255,.07)';
      for (const n of pat.notes[other.id] || []) g.fillRect(this.tx(n.t), this.ky(n.key) + 1, Math.max(2, (n.len / STEP) * this.px - 1), this.kh - 2);
    }
    // notes du canal
    if (ch) {
      const color = ch.color || '#ff8a3d';
      for (const n of pat.notes[ch.id] || []) {
        const x = this.tx(n.t), y = this.ky(n.key), w = Math.max(3, (n.len / STEP) * this.px - 1);
        g.fillStyle = color; g.globalAlpha = 0.55 + 0.45 * (n.vel ?? 0.8);
        g.fillRect(x, y + 1, w, this.kh - 2);
        g.globalAlpha = 1;
        g.fillStyle = '#0006'; g.fillRect(x + w - 3, y + 1, 3, this.kh - 2);
        if (w > 26 && this.kh >= 12) { g.fillStyle = '#111'; g.font = '10px Segoe UI'; g.fillText(noteName(n.key), x + 3, y + this.kh - 3); }
      }
    }
    // tête de lecture
    if (app.snap.playing && !app.snap.song) {
      const x = this.tx(app.snap.pos % len);
      g.fillStyle = '#ffb37a'; g.fillRect(x, RH, 2, this.gridH);
    }
    g.restore();

    // clavier
    g.save(); g.beginPath(); g.rect(0, RH, KW, this.gridH); g.clip();
    for (let k = LOW; k <= HIGH; k++) {
      const y = this.ky(k);
      if (y > H || y + this.kh < RH) continue;
      const blk = isBlack(k);
      g.fillStyle = this.pressed === k ? '#ffb07a' : blk ? '#1b1e24' : '#dfe3ea';
      g.fillRect(0, y, blk ? KW * 0.62 : KW, this.kh - 1);
      if (blk) { g.fillStyle = '#dfe3ea'; g.fillRect(KW * 0.62, y, KW * 0.38, this.kh - 1); }
      if (k % 12 === 0 || this.kh >= 16) { g.fillStyle = blk ? '#aaa' : '#333'; g.font = '10px Segoe UI'; g.fillText(noteName(k), KW - 30, y + this.kh - 3); }
      if (SCALES[this.scale].iv && this.inScale(k)) { g.fillStyle = '#8b7bff'; g.fillRect(KW - 4, y + 2, 3, this.kh - 5); }
    }
    g.restore();

    // règle (mesures)
    g.fillStyle = '#1c2027'; g.fillRect(0, 0, W, RH);
    g.fillStyle = '#8a94a3'; g.font = '11px Segoe UI';
    for (let s = s0 - (s0 % 4); s <= s1; s += 4) {
      const x = this.tx(s * STEP);
      if (x < KW) continue;
      if (s % 16 === 0) { g.fillStyle = '#e3e7ee'; g.fillText(String(s / 16 + 1), x + 3, 15); g.fillRect(x, 4, 1, RH - 4); }
      else { g.fillStyle = '#5f6876'; g.fillRect(x, 13, 1, RH - 13); }
    }
    // couloir de vélocité
    const vy = H - VH;
    g.fillStyle = '#101318'; g.fillRect(0, vy, W, VH);
    g.fillStyle = '#333b47'; g.fillRect(0, vy, W, 1);
    g.fillStyle = '#8a94a3'; g.font = '10px Segoe UI'; g.fillText('Vélocité', 6, vy + 16);
    if (ch) {
      g.save(); g.beginPath(); g.rect(KW, vy, W - KW, VH); g.clip();
      g.fillStyle = ch.color || '#ff8a3d';
      for (const n of pat.notes[ch.id] || []) {
        const x = this.tx(n.t), h = (VH - 10) * (n.vel ?? 0.8);
        g.fillRect(x, H - 4 - h, 3, h);
        g.fillRect(x - 2, H - 4 - h, 7, 3);
      }
      g.restore();
    }
    if (!ch) { g.fillStyle = '#8a94a3'; g.font = '14px Segoe UI'; g.fillText('Ajoute un instrument dans le séquenceur, puis sélectionne-le.', KW + 20, RH + 40); }
  }

  tick(s) { if (s.playing || this._wasPlaying) this.draw(); this._wasPlaying = s.playing; }

  // ------------------------------------------------------------ souris
  setupMouse() {
    const c = this.c, app = this.app;
    let drag = null;
    const pos = (e) => { const r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const snapT = (t) => (this.snap <= 1 ? Math.max(0, Math.round(t)) : Math.max(0, Math.floor(t / this.snap) * this.snap));
    const commitQuiet = (fn) => { app.store.change(fn, { merge: 'pr-drag', quiet: true }); };

    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('pointerdown', (e) => {
      const [x, y] = pos(e);
      const ch = app.selChannel();
      c.setPointerCapture(e.pointerId);
      app.store.lastMerge = null;
      if (y < RH) { // règle : déplacer la lecture
        if (app.snap.playing && !app.songMode) window.__TAURI__.core.invoke('transport', { action: 'seek', from: snapT(this.xt(x)) });
        return;
      }
      if (x < KW && y < this.H - VH) { // clavier
        const k = this.yk(y); this.pressed = k; this.draw();
        if (ch) app.noteOn(ch.id, k);
        drag = { mode: 'key', k };
        return;
      }
      if (!ch) return;
      if (y > this.H - VH) { drag = { mode: 'vel' }; this.setVel(x, y); return; }
      const hit = this.noteAt(x, y);
      if (e.button === 2) { drag = { mode: 'erase' }; if (hit) this.erase(hit.n); return; }
      if (hit) {
        if (hit.edge) drag = { mode: 'resize', n: hit.n, t0: hit.n.t };
        else { drag = { mode: 'move', n: hit.n, dx: this.xt(x) - hit.n.t, k0: hit.n.key }; app.preview(ch.id, hit.n.key, 160, hit.n.vel); }
        this.lastLen = hit.n.len;
        return;
      }
      // nouvelle note
      const t = snapT(this.xt(x)), k = this.yk(y);
      if (t >= app.curPat().len * STEP) return;
      const n = { t, len: this.lastLen, key: k, vel: 0.8 };
      commitQuiet(() => notesOf(app.curPat(), ch.id).push(n));
      app.preview(ch.id, k, 160);
      app.mark('note.add');
      drag = { mode: 'move', n, dx: this.xt(x) - t, k0: k, created: true };
      this.draw();
    });
    c.addEventListener('pointermove', (e) => {
      const [x, y] = pos(e);
      if (!drag) {
        if (x < KW || y < RH || y > this.H - VH) { c.style.cursor = x < KW ? 'pointer' : 'default'; return; }
        const hit = this.noteAt(x, y);
        c.style.cursor = hit ? (hit.edge ? 'ew-resize' : 'move') : 'crosshair';
        return;
      }
      const ch = app.selChannel();
      if (drag.mode === 'key') {
        const k = this.yk(y);
        if (k !== drag.k && ch) { app.noteOff(ch.id, drag.k); app.noteOn(ch.id, k); drag.k = k; this.pressed = k; this.draw(); }
      } else if (drag.mode === 'move') {
        const t = Math.min(snapT(this.xt(x) - drag.dx + (this.snap > 1 ? this.snap / 2 : 0)), app.curPat().len * STEP - STEP / 4);
        const k = Math.max(0, Math.min(127, this.yk(y)));
        if (t !== drag.n.t || k !== drag.n.key) {
          commitQuiet(() => { drag.n.t = t; drag.n.key = k; });
          if (k !== drag.lastK && ch) { drag.lastK = k; if (k !== drag.k0) app.preview(ch.id, k, 120); }
          app.mark('note.move');
          this.draw();
        }
      } else if (drag.mode === 'resize') {
        const end = this.snap <= 1 ? this.xt(x) : Math.round(this.xt(x) / this.snap) * this.snap;
        const len = Math.max(this.snap <= 1 ? 3 : this.snap, end - drag.n.t);
        if (len !== drag.n.len) { commitQuiet(() => (drag.n.len = len)); this.lastLen = len; app.mark('note.len'); this.draw(); }
      } else if (drag.mode === 'erase') {
        const hit = this.noteAt(x, y); if (hit) this.erase(hit.n);
      } else if (drag.mode === 'vel') this.setVel(x, y);
    });
    const up = () => {
      if (!drag) return;
      const ch = app.selChannel();
      if (drag.mode === 'key') { if (ch) app.noteOff(ch.id, drag.k); this.pressed = null; this.draw(); }
      else { app.rack.render(); app.renderBar(); app.updateTitle(); }
      drag = null;
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (e.ctrlKey) {
        const [x] = pos(e); const t = this.xt(x);
        this.px = Math.max(6, Math.min(90, this.px * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
        this.sx = Math.max(0, (t / STEP) * this.px - (x - KW));
      } else if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        this.sx = Math.max(0, this.sx + (e.deltaX || e.deltaY));
      } else if (e.altKey) {
        this.kh = Math.max(8, Math.min(26, this.kh + (e.deltaY < 0 ? 1 : -1)));
      } else {
        this.sy = Math.max(0, Math.min((HIGH - LOW + 1) * this.kh - this.gridH, this.sy + e.deltaY));
      }
      this.draw();
    }, { passive: false });
  }

  erase(n) {
    const app = this.app, ch = app.selChannel();
    app.store.change(() => { const p = app.curPat(); p.notes[ch.id] = (p.notes[ch.id] || []).filter((x) => x !== n); }, { merge: 'pr-drag', quiet: true });
    app.mark('note.del');
    this.draw();
  }

  setVel(x, y) {
    const app = this.app, ch = app.selChannel();
    const list = app.curPat().notes[ch.id] || [];
    const t = this.xt(x);
    let best = null, bd = 1e9;
    for (const n of list) { const d = Math.abs(n.t - t); if (d < bd) { bd = d; best = n; } }
    if (!best || bd > (8 / this.px) * STEP + STEP / 2) return;
    const v = Math.max(0.05, Math.min(1, (this.H - 4 - y) / (VH - 10)));
    // toutes les notes au même endroit (accords)
    app.store.change(() => { for (const n of list) if (n.t === best.t) n.vel = v; }, { merge: 'pr-drag', quiet: true });
    app.mark('note.vel');
    this.draw();
  }
}
