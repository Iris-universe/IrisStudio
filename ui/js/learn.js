// Panneau « Apprendre » : liste des cours, déroulé des étapes, vérification automatique, surlignage.
import { LESSONS } from './lessons.js';
import { STEP } from './project.js';

const DONE_KEY = 'lessons:done';
const getDone = () => { try { return JSON.parse(localStorage.getItem(DONE_KEY) || '{}'); } catch { return {}; } };
const setDone = (id) => { const d = getDone(); d[id] = Date.now(); try { localStorage.setItem(DONE_KEY, JSON.stringify(d)); } catch {} };

export class Learn {
  constructor(app) {
    this.app = app;
    this.panel = document.getElementById('learn');
    this.body = document.getElementById('learn-body');
    this.titleEl = document.getElementById('learn-title');
    this.back = document.getElementById('learn-back');
    this.lesson = null; this.step = 0; this.mem = {}; this.stepStart = 0; this.finished = false;
    document.getElementById('learn-close').onclick = () => this.close();
    this.back.onclick = () => this.showList();
    document.getElementById('btn-learn').onclick = () => (this.panel.hidden ? this.open() : this.close());
    setInterval(() => this.tick(), 150);
  }

  open() { this.panel.hidden = false; if (!this.lesson) this.showList(); else this.highlight(); }
  close() { this.panel.hidden = true; this.clearHl(); }

  showList() {
    this.lesson = null; this.back.hidden = true; this.titleEl.textContent = 'Apprendre la production';
    this.clearHl();
    const done = getDone();
    let html = '<p style="margin-top:0">Des cours courts et pratiques : tu fais chaque étape dans le studio et elle se valide toute seule. Commence par le début si tu n\'as jamais utilisé de logiciel de musique (FL Studio, Ableton…).</p><div class="lesson-list">', chap = '';
    LESSONS.forEach((l, i) => {
      if (l.chap !== chap) { chap = l.chap; html += `<div class="chap">${chap}</div>`; }
      html += `<div class="lesson-item ${done[l.id] ? 'done' : ''}" data-id="${l.id}"><div class="n">${done[l.id] ? '✓' : i + 1}</div><div><div class="t">${l.title}</div><div class="d">${l.desc}</div></div></div>`;
    });
    html += '</div><p style="color:var(--dim);font-size:12.5px;margin-top:14px">Bloqué ? Le bouton « Demander à Orbiz » envoie ta question au chat d\'Orbiz avec l\'étape où tu en es : l\'assistant voit ton projet et peut t\'aider.</p>';
    this.body.innerHTML = html;
    this.body.querySelectorAll('.lesson-item').forEach((el) => (el.onclick = () => this.start(el.dataset.id)));
  }

  async start(id, { ask = true } = {}) {
    const l = LESSONS.find((x) => x.id === id);
    if (!l) return false;
    const app = this.app;
    if (l.setup) {
      // le cours ouvre son propre projet d'exercice
      if (ask && app.store.dirty && app.p.channels.length) {
        const r = await app.modal(`<h2>${l.title}</h2><p>Ce cours ouvre un projet d'exercice. Ton projet actuel « ${app.p.name} » n'est pas enregistré.</p>`, [['cancel', 'Annuler'], ['nosave', 'Continuer sans enregistrer'], ['save', 'Enregistrer puis continuer']]);
        if (r === 'cancel' || !r) return false;
        if (r === 'save' && !(await app.store.save())) return false;
      }
      app.stop();
      app.store.load(l.setup());
    }
    this.panel.hidden = false;
    this.lesson = l; this.step = 0; this.mem = {}; this.finished = false; this.stepStart = performance.now();
    this.back.hidden = false; this.titleEl.textContent = l.title;
    if (l.view) app.show(l.view);
    this.render();
    return true;
  }

  render() {
    const l = this.lesson; if (!l) return;
    const steps = l.steps.map((s, i) => {
      const cls = this.finished || i < this.step ? 'done' : i === this.step ? 'cur' : 'todo';
      const cur = i === this.step && !this.finished;
      return `<div class="lstep ${cls}"><div class="stn">${cls === 'done' ? '✓' : i + 1}</div><div class="stb">${s.html}
        ${cur ? `<div class="live"></div><div class="acts">${s.action ? `<button class="primary" data-act>${s.action.label}</button>` : ''}${!s.check ? '<button class="primary" data-next>Suivant</button>' : '<button data-skip>Passer cette étape</button>'}</div>` : ''}</div></div>`;
    }).join('');
    this.body.innerHTML = `${l.intro || ''}<div class="steps-l">${steps}</div>
      ${this.finished || !l.steps.length ? `<div class="success"><b>Cours terminé ✓</b></div>${l.outro || ''}` : ''}
      <div class="learn-foot"><button data-ask>Demander à Orbiz</button>
      ${l.setup ? '<button data-restart title="Recharge le projet d\'exercice">↺ Recommencer</button>' : ''}
      ${this.finished || !l.steps.length ? '<button class="primary" data-nextlesson>Cours suivant →</button>' : ''}</div>`;
    const $ = (s) => this.body.querySelector(s);
    $('[data-next]') && ($('[data-next]').onclick = () => this.advance());
    $('[data-skip]') && ($('[data-skip]').onclick = () => this.advance(true));
    $('[data-act]') && ($('[data-act]').onclick = () => l.steps[this.step].action.run(this.app, this.ctx()));
    $('[data-ask]').onclick = () => this.ask();
    $('[data-restart]') && ($('[data-restart]').onclick = () => this.start(l.id, { ask: false }));
    $('[data-nextlesson]') && ($('[data-nextlesson]').onclick = () => { const i = LESSONS.indexOf(l); if (LESSONS[i + 1]) this.start(LESSONS[i + 1].id); else this.showList(); });
    if (!l.steps.length) setDone(l.id);
    this.highlight();
    this.body.querySelector('.lstep.cur')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  advance(skipped = false) {
    const l = this.lesson; if (!l) return;
    this.step++; this.mem = {}; this.stepStart = performance.now();
    if (this.step >= l.steps.length) { this.finished = true; this.step = l.steps.length; setDone(l.id); this.app.coach.say('Cours terminé, bravo ! 🎉', 'good', 6000); }
    else if (!skipped) this.app.coach.say('Étape réussie ✓', 'good', 2500);
    this.render();
  }

  clearHl() { document.querySelectorAll('.hl').forEach((e) => e.classList.remove('hl')); }
  highlight(ids) {
    this.clearHl();
    if (this.panel.hidden && !ids) return;
    let list = ids || (this.lesson && !this.finished ? this.lesson.steps[this.step]?.hl : null) || [];
    if (typeof list === 'function') { try { list = list(this.ctx()); } catch { list = []; } }
    for (const id of list) {
      if (!id) continue;
      if (id.startsWith('@')) { document.querySelectorAll(id.slice(1)).forEach((e) => e.classList.add('hl')); continue; }
      document.querySelectorAll(`[data-ctl="${id}"], [data-zone="${id}"]`).forEach((e) => e.classList.add('hl'));
    }
  }

  ctx() {
    const app = this.app, now = performance.now(), mem = this.mem, start = this.stepStart, p = app.p, pat = app.curPat();
    const find = (q) => p.channels.find((c) => c.preset === q || c.type === q || c.name === q || (q instanceof RegExp && q.test(c.preset || '')));
    const stepsOf = (c, pt = pat) => new Set(c ? (pt.notes[c.id] || []).filter((n) => n.t % STEP === 0).map((n) => n.t / STEP) : []);
    return {
      app, p, pat, now, t: now - start, mem, snap: app.snap, sel: app.selChannel(), find, stepsOf,
      notes: (c, pt = pat) => (c ? pt.notes[c.id] || [] : []),
      same: (set, arr) => set.size === arr.length && arr.every((v) => set.has(v)),
      has: (set, arr) => arr.every((v) => set.has(v)),
      ev: (n) => (app.events[n] || 0) > start,
      hold: (k, cond, ms) => { if (!cond) { mem['h_' + k] = 0; return false; } mem['h_' + k] ||= now; return now - mem['h_' + k] >= ms; },
      fx: (ins, type) => p.mixer[ins]?.fx.find((f) => f.type === type),
    };
  }

  tick() {
    const l = this.lesson; if (!l || this.finished) return;
    const s = l.steps[this.step]; if (!s) return;
    const x = this.ctx();
    try {
      const liveEl = this.body.querySelector('.lstep.cur .live');
      if (liveEl && s.live) { const t = s.live(x); if (liveEl.textContent !== t) liveEl.textContent = t || ''; }
      if (typeof s.hl === 'function' && !this.panel.hidden) { const k = JSON.stringify(s.hl(x)); if (k !== this._hlKey) { this._hlKey = k; this.highlight(); } }
      else if (!this.panel.hidden && !document.querySelector('.hl') && s.hl?.length) this.highlight(); // la vue a été reconstruite
      if (s.check && s.check(x)) this.advance();
    } catch (err) { console.warn('étape', err); }
  }

  state() {
    const l = this.lesson;
    if (!l) return { ouvert: !this.panel.hidden, cours: null };
    const s = l.steps[this.step];
    const txt = (h) => { const d = document.createElement('div'); d.innerHTML = h || ''; return d.textContent.replace(/\s+/g, ' ').trim(); };
    return { ouvert: !this.panel.hidden, cours: { id: l.id, titre: l.title, etape: this.finished ? 'terminé' : `${this.step + 1}/${l.steps.length}`, consigne: s ? txt(s.html) : null, suivi: s?.live ? s.live(this.ctx()) : undefined } };
  }

  list() { const d = getDone(); return LESSONS.map((l) => ({ id: l.id, chapitre: l.chap, titre: l.title, description: l.desc, termine: !!d[l.id] })); }

  ask() {
    const c = this.state().cours;
    const q = c ? `Je suis dans le cours « ${c.titre} » d'IrisStudio, étape ${c.etape} : « ${c.consigne || ''} ». Je n'y arrive pas / je ne comprends pas. Peux-tu m'aider ?` : 'J\'apprends la production musicale dans IrisStudio. Par quoi je commence ?';
    window.studio.ask(q, false);
  }
}
