// Playlist : l'arrangement du morceau (motifs placés dans le temps, sur des pistes).
import { BAR, PPQ, STEP, N_TRACKS } from './project.js';
import { esc } from './widgets.js';

const HW = 120, RH = 24;

export class Playlist {
  constructor(app, el) {
    this.app = app; this.el = el;
    this.bw = 44; // pixels par mesure
    this.th = 38; // hauteur d'une piste
    this.sx = 0; this.sy = 0;
    el.innerHTML = `<div class="ed-head"><b>Playlist</b>
      <span style="color:var(--dim)">Joue en mode <b style="color:var(--acc)">MORCEAU</b>.</span>
      <button id="pl-play" data-ctl="pl-play">▶ Écouter le morceau</button>
      <button id="pl-clear">Tout effacer</button>
      <span class="hint">Choisis un motif à gauche puis clique dans la grille pour le placer · glisser = déplacer · bord droit = longueur · clic droit = effacer · double-clic = éditer le motif</span></div>
      <div class="pl-body"><div class="pl-pats" data-zone="pl-patterns"></div><div class="ed-wrap"><canvas></canvas></div></div>`;
    this.wrap = el.querySelector('.ed-wrap');
    this.pats = el.querySelector('.pl-pats');
    this.c = el.querySelector('canvas'); this.g = this.c.getContext('2d');
    el.querySelector('#pl-play').onclick = () => { app.setSongMode(true); app.play(0); };
    el.querySelector('#pl-clear').onclick = async () => { if (await app.confirm('Retirer tous les motifs de la playlist ?', 'Effacer')) app.store.change((p) => (p.playlist.clips = [])); };
    new ResizeObserver(() => this.resize()).observe(this.wrap);
    this.setupMouse();
  }

  resize() {
    const r = this.wrap.getBoundingClientRect();
    if (!r.width) return;
    const dpr = devicePixelRatio || 1;
    this.W = r.width; this.H = r.height;
    this.c.width = r.width * dpr; this.c.height = r.height * dpr;
    this.c.style.width = r.width + 'px'; this.c.style.height = r.height + 'px';
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.draw();
  }

  render() {
    const app = this.app;
    this.pats.innerHTML = '<div class="cap">Motifs</div>' + app.p.patterns.map((x) => `<div class="pp ${x.id === app.pat ? 'on' : ''}" data-id="${x.id}" title="Clic : choisir ce motif pour le placer · double-clic : l'éditer">${esc(x.name)}</div>`).join('')
      + '<div class="pp" data-new style="color:var(--dim)">＋ Nouveau motif</div>';
    this.pats.querySelectorAll('.pp[data-id]').forEach((d) => {
      d.onclick = () => { app.setPattern(Number(d.dataset.id)); };
      d.ondblclick = () => { app.setPattern(Number(d.dataset.id)); app.show('rack'); };
    });
    this.pats.querySelector('[data-new]').onclick = () => { app.newPattern(); this.render(); };
    this.draw();
  }

  color(pid) {
    const i = this.app.p.patterns.findIndex((x) => x.id === pid);
    const hues = [22, 260, 190, 140, 330, 50, 210, 0, 100, 290];
    return `hsl(${hues[(i < 0 ? 0 : i) % hues.length]} 65% 55%)`;
  }

  tx(t) { return HW + (t / BAR) * this.bw - this.sx; }
  xt(x) { return ((x - HW + this.sx) / this.bw) * BAR; }
  ty(tr) { return RH + tr * this.th - this.sy; }
  yt(y) { return Math.floor((y - RH + this.sy) / this.th); }

  clipAt(x, y) {
    const tr = this.yt(y);
    const clips = this.app.p.playlist.clips;
    for (let i = clips.length - 1; i >= 0; i--) {
      const c = clips[i];
      if (c.track !== tr) continue;
      const x0 = this.tx(c.start), x1 = this.tx(c.start + c.len);
      if (x >= x0 && x <= x1) return { c, edge: x > x1 - 7 };
    }
    return null;
  }

  draw() {
    if (!this.W || this.el.hidden) return;
    const g = this.g, W = this.W, H = this.H, p = this.app.p;
    g.fillStyle = '#15181d'; g.fillRect(0, 0, W, H);
    const b0 = Math.floor(this.sx / this.bw), b1 = b0 + Math.ceil((W - HW) / this.bw) + 1;
    g.save(); g.beginPath(); g.rect(HW, RH, W - HW, H - RH); g.clip();
    for (let t = 0; t < N_TRACKS; t++) {
      const y = this.ty(t);
      g.fillStyle = t % 2 ? '#1a1e24' : '#1d2129'; g.fillRect(HW, y, W, this.th);
      g.fillStyle = '#0c0e12'; g.fillRect(HW, y + this.th - 1, W, 1);
    }
    for (let b = b0; b <= b1; b++) {
      const x = Math.round(this.tx(b * BAR)) + 0.5;
      g.fillStyle = b % 4 === 0 ? '#3a4250' : '#262c35'; g.fillRect(x, RH, 1, H);
      if (this.bw > 60) for (let k = 1; k < 4; k++) { g.fillStyle = '#1f242c'; g.fillRect(x + (k * this.bw) / 4, RH, 1, H); }
    }
    // clips
    for (const c of p.playlist.clips) {
      const pat = p.patterns.find((x) => x.id === c.pat); if (!pat) continue;
      const x = this.tx(c.start), y = this.ty(c.track) + 2, w = (c.len / BAR) * this.bw - 1, h = this.th - 5;
      if (x > W || x + w < HW) continue;
      const col = this.color(c.pat);
      const muted = p.playlist.tracks[c.track]?.mute;
      g.globalAlpha = muted ? 0.35 : 1;
      g.fillStyle = col; g.fillRect(x, y, w, 14);
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x, y + 14, w, h - 14);
      g.strokeStyle = col; g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      g.fillStyle = '#111'; g.font = '11px Segoe UI';
      g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
      g.fillText(pat.name, x + 4, y + 11);
      // aperçu des notes
      const plen = pat.len * STEP;
      const all = Object.values(pat.notes).flat();
      if (all.length) {
        const keys = all.map((n) => n.key); const lo = Math.min(...keys), hi = Math.max(...keys) + 1;
        g.fillStyle = col;
        for (let rep = 0; rep * plen < c.len; rep++) for (const n of all) {
          const t = rep * plen + n.t; if (t >= c.len) continue;
          const nx = x + (t / BAR) * this.bw, ny = y + h - 3 - ((n.key - lo) / Math.max(1, hi - lo)) * (h - 18);
          g.fillRect(nx, ny, Math.max(1, (n.len / BAR) * this.bw - 0.5), 2);
        }
      }
      g.restore();
      g.globalAlpha = 1;
    }
    // tête de lecture
    if (this.app.snap.playing && this.app.snap.song) { const x = this.tx(this.app.snap.pos); g.fillStyle = '#ffb37a'; g.fillRect(x, RH, 2, H); }
    g.restore();
    // en-têtes de pistes
    g.save(); g.beginPath(); g.rect(0, RH, HW, H - RH); g.clip();
    for (let t = 0; t < N_TRACKS; t++) {
      const y = this.ty(t), tr = p.playlist.tracks[t];
      g.fillStyle = '#20252d'; g.fillRect(0, y, HW - 1, this.th - 1);
      g.fillStyle = tr.mute ? '#555' : '#2bd67b'; g.beginPath(); g.arc(12, y + this.th / 2, 4, 0, 7); g.fill();
      g.fillStyle = tr.mute ? '#666' : '#cfd5de'; g.font = '12px Segoe UI'; g.fillText(tr.name, 22, y + this.th / 2 + 4);
    }
    g.restore();
    // règle
    g.fillStyle = '#1c2027'; g.fillRect(0, 0, W, RH);
    g.fillStyle = '#8a94a3'; g.font = '11px Segoe UI'; g.fillText('Mesure', 8, 16);
    for (let b = b0; b <= b1; b++) {
      const x = this.tx(b * BAR); if (x < HW) continue;
      const every = this.bw < 24 ? 4 : 1;
      if (b % every === 0) { g.fillStyle = b % 4 === 0 ? '#e3e7ee' : '#8a94a3'; g.fillText(String(b + 1), x + 3, 16); }
      g.fillStyle = '#3a4250'; g.fillRect(x, b % 4 === 0 ? 4 : 14, 1, RH);
    }
    // fin du morceau
    const end = p.playlist.clips.reduce((a, c) => Math.max(a, c.start + c.len), 0);
    if (end > 0) { const x = this.tx(Math.ceil(end / BAR) * BAR); if (x > HW) { g.fillStyle = '#ff4d4d'; g.fillRect(x, 0, 2, RH); } }
  }

  tick(s) { if (s.playing || this._was) this.draw(); this._was = s.playing; }

  setupMouse() {
    const c = this.c, app = this.app;
    let drag = null;
    const pos = (e) => { const r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const snap = (t, alt) => { const q = alt ? PPQ : BAR; return Math.max(0, Math.round(t / q) * q); };
    const floorSnap = (t, alt) => { const q = alt ? PPQ : BAR; return Math.max(0, Math.floor(t / q) * q); };
    const quiet = (fn) => app.store.change(fn, { merge: 'pl-drag', quiet: true });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('pointerdown', (e) => {
      const [x, y] = pos(e);
      c.setPointerCapture(e.pointerId);
      app.store.lastMerge = null;
      if (y < RH) { // règle : écouter depuis ici
        if (x > HW) { app.setSongMode(true); app.play(floorSnap(this.xt(x), false)); }
        return;
      }
      const tr = this.yt(y);
      if (tr < 0 || tr >= N_TRACKS) return;
      if (x < HW) {
        if (x < 22) app.store.change((p) => (p.playlist.tracks[tr].mute = !p.playlist.tracks[tr].mute));
        return;
      }
      const hit = this.clipAt(x, y);
      if (e.button === 2) { drag = { mode: 'erase' }; if (hit) this.erase(hit.c); return; }
      if (hit) {
        if (e.detail >= 2) { app.setPattern(hit.c.pat); app.show('rack'); return; }
        drag = hit.edge ? { mode: 'resize', c: hit.c } : { mode: 'move', c: hit.c, dx: this.xt(x) - hit.c.start };
        return;
      }
      const pat = app.curPat();
      const clip = { pat: pat.id, track: tr, start: floorSnap(this.xt(x), e.altKey), len: pat.len * STEP };
      quiet((p) => p.playlist.clips.push(clip));
      app.mark('clip.add');
      drag = { mode: 'move', c: clip, dx: this.xt(x) - clip.start };
      this.draw();
    });
    c.addEventListener('pointermove', (e) => {
      const [x, y] = pos(e);
      if (!drag) {
        if (x < HW || y < RH) { c.style.cursor = y < RH ? 'pointer' : 'default'; return; }
        const hit = this.clipAt(x, y);
        c.style.cursor = hit ? (hit.edge ? 'ew-resize' : 'move') : 'copy';
        return;
      }
      if (drag.mode === 'move') {
        const start = snap(this.xt(x) - drag.dx, e.altKey);
        const tr = Math.max(0, Math.min(N_TRACKS - 1, this.yt(y)));
        if (start !== drag.c.start || tr !== drag.c.track) { quiet(() => { drag.c.start = start; drag.c.track = tr; }); app.mark('clip.move'); this.draw(); }
      } else if (drag.mode === 'resize') {
        const end = snap(this.xt(x), e.altKey);
        const len = Math.max(e.altKey ? PPQ : BAR / 4, end - drag.c.start);
        if (len !== drag.c.len) { quiet(() => (drag.c.len = len)); app.mark('clip.len'); this.draw(); }
      } else if (drag.mode === 'erase') {
        const hit = this.clipAt(x, y); if (hit) this.erase(hit.c);
      }
    });
    const up = () => { if (drag) { drag = null; app.renderBar(); app.updateTitle(); } };
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    c.addEventListener('dblclick', (e) => {
      const [x, y] = pos(e);
      if (x < HW && x >= 22 && y > RH) {
        const tr = this.yt(y);
        app.prompt('Nom de la piste', app.p.playlist.tracks[tr].name).then((n) => n && app.store.change((p) => (p.playlist.tracks[tr].name = n)));
      }
    });
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (e.ctrlKey) {
        const [x] = pos(e); const t = this.xt(x);
        this.bw = Math.max(10, Math.min(200, this.bw * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
        this.sx = Math.max(0, (t / BAR) * this.bw - (x - HW));
      } else if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) this.sx = Math.max(0, this.sx + (e.deltaX || e.deltaY));
      else this.sy = Math.max(0, Math.min(Math.max(0, N_TRACKS * this.th - (this.H - RH)), this.sy + e.deltaY));
      this.draw();
    }, { passive: false });
  }

  erase(clip) {
    this.app.store.change((p) => (p.playlist.clips = p.playlist.clips.filter((c) => c !== clip)), { merge: 'pl-drag', quiet: true });
    this.app.mark('clip.del');
    this.draw();
  }
}
