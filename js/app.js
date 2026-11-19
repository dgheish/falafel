import { settings, progress, clips } from './store.js?v=10';
import * as audio from './audio.js?v=10';

const app = document.getElementById('app');
let DATA = null;

// ---------- helpers ----------
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// A phrase in whichever scripts the learner has switched on (CSS hides the rest).
function phrase(p, { big = false } = {}) {
  return `<div class="phrase ${big ? 'big' : ''}">
    <div class="t-arabizi">${esc(p.arabizi)}</div>
    <div class="t-arabic" dir="rtl" lang="ar">${esc(p.arabic)}</div>
    ${p.english ? `<div class="t-english">${esc(p.english)}</div>` : ''}
  </div>`;
}

const playBtn = (id, label = 'Play', slow = false) =>
  `<button class="btn play ${slow ? 'ghost' : ''}" data-clip="${esc(id)}" ${slow ? 'data-slow' : ''} aria-label="${label}">${slow ? '🐢 Slow' : '🔊 ' + label}</button>`;

// Every recordable clip in a lesson: each item, its female form, each dialogue line.
function clipsFor(lesson) {
  const out = [];
  for (const it of lesson.items) {
    out.push({ id: it.id, arabizi: it.arabizi, arabic: it.arabic, label: it.english + (it.f ? ' (to a man)' : '') });
    if (it.f) out.push({ id: it.id + '-f', arabizi: it.f.arabizi, arabic: it.f.arabic, label: it.english + ' (to a woman)' });
  }
  for (const d of lesson.dialogue) out.push({ id: d.id, arabizi: d.arabizi, arabic: d.arabic, label: `Dialogue: ${d.speaker}` });
  return out;
}

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

// Grey out play buttons that have no recording yet.
async function markMissing(root = app) {
  for (const b of root.querySelectorAll('[data-clip]')) {
    const found = await audio.audioUrl(b.dataset.clip);
    b.classList.toggle('missing', !found);
  }
}

// One delegated handler for every play button on the page.
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-clip]');
  if (!b) return;
  b.classList.add('playing');
  const ok = await audio.play(b.dataset.clip, { slow: b.hasAttribute('data-slow') });
  b.classList.remove('playing');
  if (!ok) toast('No recording yet. Add one in the Recording studio.');
});

// ---------- script toggles ----------
function applyToggles() {
  for (const [k, on] of Object.entries(settings.show)) {
    document.body.classList.toggle('hide-' + k, !on);
    const chip = document.querySelector(`[data-toggle="${k}"]`);
    if (chip) chip.setAttribute('aria-pressed', on);
  }
}
document.querySelectorAll('[data-toggle]').forEach(c =>
  c.addEventListener('click', () => { settings.toggle(c.dataset.toggle); applyToggles(); }));

// ---------- levels ----------
// Every level is open to everyone. Lessons marked "soon" are planned but not written yet.
const ready = l => !l.soon;
const allLessons = () => DATA.levels.flatMap(lv => lv.lessons.filter(ready));
const levelOf = lessonId => DATA.levels.find(lv => lv.lessons.some(l => l.id === lessonId));

// ---------- views ----------
function viewHome() {
  const cards = DATA.levels.map(lv => {
    const live = lv.lessons.filter(ready);
    const done = live.filter(l => progress.get(l.id)).length;
    const pct = live.length ? Math.round((done / live.length) * 100) : 0;
    const badge = live.length
      ? `<span class="badge ${done && done === live.length ? 'done' : ''}">${done}/${live.length}</span>`
      : `<span class="badge">Coming soon</span>`;
    return `<a class="lesson-card level" href="#/level/${lv.n}">
      <span class="lesson-icon lvl">${lv.n}</span>
      <span class="lesson-text"><small>Level ${lv.n} · ${lv.lessons.length} subjects</small><strong>${esc(lv.title)}</strong><span>${esc(lv.goal)}</span>
        ${live.length ? `<span class="meter"><i style="width:${pct}%"></i></span>` : ''}</span>
      ${badge}
    </a>`;
  }).join('');
  app.innerHTML = `
    <section class="hero">
      <h1>Speak Lebanese,<br>the way people really talk.</h1>
      <p>Ten levels, from your first "marhaba" to a real conversation with a native speaker. Start anywhere.</p>
    </section>
    <section class="lessons">${cards}</section>`;
}

function viewLevel(n) {
  const lv = DATA.levels.find(x => x.n === +n);
  if (!lv) return viewHome();
  const cards = lv.lessons.map((l, i) => {
    if (l.soon) return `<div class="lesson-card soon"><span class="lesson-icon">${l.icon}</span>
      <span class="lesson-text"><small>Lesson ${i + 1}</small><strong>${esc(l.title)}</strong></span><span class="badge">Soon</span></div>`;
    const p = progress.get(l.id);
    const badge = p ? `<span class="badge done">✓ ${p.best}/${p.total}</span>` : `<span class="badge">${l.items.length} phrases</span>`;
    return `<a class="lesson-card" href="#/lesson/${l.id}"><span class="lesson-icon">${l.icon}</span>
      <span class="lesson-text"><small>Lesson ${i + 1}</small><strong>${esc(l.title)}</strong><span>${esc(l.subtitle)}</span></span>${badge}</a>`;
  }).join('');
  app.innerHTML = `
    <a class="back" href="#/">← All levels</a>
    <h1>Level ${lv.n}: ${esc(lv.title)}</h1>
    <p class="lead">${esc(lv.goal)}</p>
    <section class="lessons">${cards}</section>`;
}

// ----- lesson: learn → dialogue → practice → quiz → done -----
const STEPS = ['learn', 'dialogue', 'practice', 'quiz'];
const STEP_NAMES = { learn: 'Learn', dialogue: 'Listen', practice: 'Repeat', quiz: 'Quiz' };

function viewLesson(id) {
  const lesson = allLessons().find(l => l.id === id);
  if (!lesson) return viewHome();
  const level = levelOf(id);
  const s = { step: 'learn', i: 0, female: false, quiz: null, mine: null };

  const shell = body => {
    const stepIx = STEPS.indexOf(s.step);
    const tabs = STEPS.map((st, k) => `<span class="${k < stepIx ? 'past' : k === stepIx ? 'now' : ''}">${STEP_NAMES[st]}</span>`).join('');
    app.innerHTML = `
      <a class="back" href="#/level/${level.n}">← Level ${level.n}</a>
      <h1 class="lesson-title">${lesson.icon} ${esc(lesson.title)}</h1>
      ${s.step === 'done' ? '' : `<nav class="steps">${tabs}</nav>`}
      <section class="stage">${body}</section>`;
    markMissing();
  };

  const go = step => { s.step = step; s.i = 0; s.female = false; s.mine = null; render(); };

  function renderLearn() {
    const it = lesson.items[s.i];
    const form = s.female && it.f ? { ...it, ...it.f } : it;
    const clip = s.female && it.f ? it.id + '-f' : it.id;
    const genderSwitch = it.f ? `
      <div class="seg" role="group" aria-label="Talking to">
        <span>Talking to:</span>
        <button class="${!s.female ? 'on' : ''}" data-g="m">a man</button>
        <button class="${s.female ? 'on' : ''}" data-g="f">a woman</button>
      </div>` : '';
    shell(`
      <div class="card">
        <div class="pic">${it.pic || '💬'}</div>
        ${phrase(form, { big: true })}
        ${genderSwitch}
        <div class="row">${playBtn(clip)}${playBtn(clip, 'Slow', true)}</div>
        ${it.note ? `<p class="note">💡 ${esc(it.note)}</p>` : ''}
      </div>
      <div class="nav">
        <button class="btn ghost" data-act="prev" ${s.i === 0 ? 'disabled' : ''}>Back</button>
        <span class="count">${s.i + 1} / ${lesson.items.length}</span>
        <button class="btn primary" data-act="next">${s.i === lesson.items.length - 1 ? 'Hear it in a conversation →' : 'Next'}</button>
      </div>`);
    app.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { s.female = b.dataset.g === 'f'; render(); });
    app.querySelector('[data-act=prev]').onclick = () => { s.i--; s.female = false; render(); };
    app.querySelector('[data-act=next]').onclick = () => {
      if (s.i < lesson.items.length - 1) { s.i++; s.female = false; render(); } else go('dialogue');
    };
    audio.play(clip); // auto-play once when the card appears (silently skipped if missing)
  }

  function renderDialogue() {
    const lines = lesson.dialogue.map(d => {
      const side = DATA.speakers[d.speaker] === 'f' ? 'right' : 'left';
      return `<div class="bubble ${side}">
        <div class="who">${esc(d.speaker)}</div>
        ${phrase(d)}
        <button class="mini" data-clip="${esc(d.id)}" aria-label="Play line">🔊</button>
      </div>`;
    }).join('');
    shell(`
      <p class="lead">Listen to the whole conversation, then tap any line to hear it again.</p>
      <div class="row"><button class="btn primary" data-act="all">▶ Play conversation</button></div>
      <div class="chat">${lines}</div>
      <div class="nav"><span></span><button class="btn primary" data-act="next">Your turn to speak →</button></div>`);
    app.querySelector('[data-act=all]').onclick = async e => {
      const btn = e.currentTarget;
      btn.disabled = true;
      for (const d of lesson.dialogue) {
        const el = app.querySelector(`[data-clip="${d.id}"]`)?.closest('.bubble');
        el?.classList.add('lit');
        el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        const ok = await audio.play(d.id);
        el?.classList.remove('lit');
        if (!ok) { toast('Some lines have no recording yet.'); break; }
        await new Promise(r => setTimeout(r, 350));
      }
      btn.disabled = false;
    };
    app.querySelector('[data-act=next]').onclick = () => go('practice');
  }

  function renderPractice() {
    const it = lesson.items[s.i];
    const mic = audio.canRecord();
    shell(`
      <p class="lead">Listen, then record yourself and compare.</p>
      <div class="card">
        <div class="pic small">${it.pic || '💬'}</div>
        ${phrase(it, { big: true })}
        <div class="row">
          ${playBtn(it.id, 'Native speaker')}
          ${mic ? `<button class="btn rec" data-act="rec">🎙️ Record me</button>` : '<span class="muted">Recording isn\'t supported in this browser.</span>'}
          ${s.mine ? `<button class="btn ghost" data-act="mine">▶ My try</button>` : ''}
        </div>
      </div>
      <div class="nav">
        <button class="btn ghost" data-act="prev" ${s.i === 0 ? 'disabled' : ''}>Back</button>
        <span class="count">${s.i + 1} / ${lesson.items.length}</span>
        <button class="btn primary" data-act="next">${s.i === lesson.items.length - 1 ? 'Take the quiz →' : 'Next'}</button>
      </div>`);
    const rec = app.querySelector('[data-act=rec]');
    if (rec) rec.onclick = async () => {
      if (rec.dataset.on) return;
      try {
        const r = await audio.startRecording();
        rec.dataset.on = '1';
        rec.textContent = '⏹ Stop';
        rec.classList.add('live');
        rec.onclick = async () => {
          const blob = await r.stop();
          if (s.mine) URL.revokeObjectURL(s.mine);
          s.mine = URL.createObjectURL(blob);
          render();
          audio.playUrl(s.mine);
        };
      } catch { toast('Microphone permission was blocked.'); }
    };
    const mine = app.querySelector('[data-act=mine]');
    if (mine) mine.onclick = () => audio.playUrl(s.mine);
    app.querySelector('[data-act=prev]').onclick = () => { s.i--; s.mine = null; render(); };
    app.querySelector('[data-act=next]').onclick = () => {
      s.mine = null;
      if (s.i < lesson.items.length - 1) { s.i++; render(); } else go('quiz');
    };
  }

  const words = t => t.split(/\s+/).filter(Boolean);

  async function buildQuiz() {
    const items = lesson.items;
    const qs = [];
    for (const it of shuffle(items)) {
      const others = shuffle(items.filter(x => x !== it)).slice(0, 3);
      const hasAudio = !!(await audio.audioUrl(it.id));
      let types = ['meaning', 'say', 'picture'].concat(hasAudio ? ['listen', 'listen'] : []);
      // From Level 3, phrases of 3+ words become "put the words in order".
      if (level.n >= 3 && words(it.arabizi).length >= 3) types = ['build', 'build', ...types];
      const type = types[Math.floor(Math.random() * types.length)];
      qs.push({ type, answer: it, options: shuffle([it, ...others]) });
    }
    // Listening questions about the conversation go last.
    for (const c of lesson.questions || []) {
      const opts = c.options.map((text, k) => ({ text, right: k === c.answer }));
      qs.push({ type: 'comp', q: c.q, options: shuffle(opts) });
    }
    return { qs, i: 0, score: 0, picked: null, built: [] };
  }

  function renderBuild(z, q) {
    const target = words(q.answer.arabizi);
    if (!z.pool) z.pool = shuffle(target.map((w, k) => ({ w, k })));
    const used = new Set(z.built.map(t => t.k));
    const checked = z.picked !== null;
    const right = checked && z.built.map(t => t.w).join(' ') === target.join(' ');
    const line = z.built.map(t => `<button class="tile" data-k="${t.k}" ${checked ? 'disabled' : ''}>${esc(t.w)}</button>`).join('')
      || '<span class="muted">Tap the words below in order</span>';
    const pool = z.pool.map(t => `<button class="tile ${used.has(t.k) ? 'gone' : ''}" data-p="${t.k}" ${used.has(t.k) || checked ? 'disabled' : ''}>${esc(t.w)}</button>`).join('');
    shell(`
      <div class="quizbar"><div style="width:${(z.i / z.qs.length) * 100}%"></div></div>
      <div class="card">
        <p class="ask">Build the sentence</p>
        <div class="phrase big"><div class="t-english always">${esc(q.answer.english)}</div></div>
      </div>
      <div class="build ${checked ? (right ? 'right' : 'wrong') : ''}">${line}</div>
      ${checked && !right ? `<p class="fix">✓ ${esc(q.answer.arabizi)} <span dir="rtl" lang="ar" class="ar">${esc(q.answer.arabic)}</span></p>` : ''}
      <div class="tiles">${pool}</div>
      <div class="nav">
        <span class="count">${z.i + 1} / ${z.qs.length}</span>
        ${checked
          ? `<button class="btn primary" data-act="next">${z.i === z.qs.length - 1 ? 'See results' : 'Next'}</button>`
          : `<button class="btn primary" data-act="check" ${z.built.length === target.length ? '' : 'disabled'}>Check</button>`}
      </div>`);
    app.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { z.built.push(z.pool.find(t => t.k === +b.dataset.p)); render(); });
    app.querySelectorAll('.build [data-k]').forEach(b => b.onclick = () => { z.built = z.built.filter(t => t.k !== +b.dataset.k); render(); });
    const check = app.querySelector('[data-act=check]');
    if (check) check.onclick = () => {
      z.picked = 0;
      if (z.built.map(t => t.w).join(' ') === target.join(' ')) z.score++;
      render();
      audio.play(q.answer.id);
    };
  }

  function nextQuestion(z) {
    if (z.i < z.qs.length - 1) { z.i++; z.picked = null; z.built = []; z.pool = null; render(); }
    else { progress.complete(lesson.id, z.score, z.qs.length); s.step = 'done'; render(); }
  }

  function renderQuiz() {
    const z = s.quiz;
    const q = z.qs[z.i];
    if (q.type === 'build') {
      renderBuild(z, q);
      const next = app.querySelector('[data-act=next]');
      if (next) next.onclick = () => nextQuestion(z);
      return;
    }
    if (q.type === 'comp') {
      const opts = q.options.map((o, k) => {
        let cls = '';
        if (z.picked !== null) cls = o.right ? 'right' : (k === z.picked ? 'wrong' : 'dim');
        return `<button class="opt ${cls}" data-k="${k}" ${z.picked !== null ? 'disabled' : ''}><span class="t-english always">${esc(o.text)}</span></button>`;
      }).join('');
      shell(`
        <div class="quizbar"><div style="width:${(z.i / z.qs.length) * 100}%"></div></div>
        <div class="card">
          <p class="ask">👂 About the conversation</p>
          <div class="phrase big"><div class="t-english always">${esc(q.q)}</div></div>
          <div class="row"><button class="btn" data-act="replay">🔊 Hear it again</button></div>
        </div>
        <div class="opts">${opts}</div>
        ${z.picked !== null ? `<div class="nav"><span class="count">${z.i + 1} / ${z.qs.length}</span><button class="btn primary" data-act="next">${z.i === z.qs.length - 1 ? 'See results' : 'Next'}</button></div>` : ''}`);
      app.querySelector('[data-act=replay]').onclick = async e => {
        e.currentTarget.disabled = true;
        for (const d of lesson.dialogue) { if (!(await audio.play(d.id))) { toast('Some lines have no recording yet.'); break; } }
        const b = app.querySelector('[data-act=replay]'); if (b) b.disabled = false;
      };
      app.querySelectorAll('.opt').forEach(b => b.onclick = () => {
        z.picked = +b.dataset.k;
        if (q.options[z.picked].right) z.score++;
        render();
      });
      const next = app.querySelector('[data-act=next]');
      if (next) next.onclick = () => nextQuestion(z);
      return;
    }
    const optEnglish = ['meaning', 'listen'].includes(q.type);
    const prompt = {
      listen: `<p class="ask">What did you hear?</p><div class="row">${playBtn(q.answer.id, 'Play again')}</div>`,
      meaning: `<p class="ask">What does this mean?</p>${phrase({ arabizi: q.answer.arabizi, arabic: q.answer.arabic }, { big: true })}`,
      say: `<p class="ask">How do you say…</p><div class="phrase big"><div class="t-english always">${esc(q.answer.english)}</div></div>`,
      picture: `<p class="ask">Which phrase fits the picture?</p><div class="pic">${q.answer.pic}</div>`,
    }[q.type];
    const opts = q.options.map((o, k) => {
      let cls = '';
      if (z.picked !== null) cls = o === q.answer ? 'right' : (k === z.picked ? 'wrong' : 'dim');
      const label = optEnglish
        ? `<span class="t-english always">${esc(o.english)}</span>`
        : `<span class="t-arabizi">${esc(o.arabizi)}</span><span class="t-arabic" dir="rtl" lang="ar">${esc(o.arabic)}</span>`;
      return `<button class="opt ${cls}" data-k="${k}" ${z.picked !== null ? 'disabled' : ''}>${label}</button>`;
    }).join('');
    shell(`
      <div class="quizbar"><div style="width:${(z.i / z.qs.length) * 100}%"></div></div>
      <div class="card">${prompt}</div>
      <div class="opts">${opts}</div>
      ${z.picked !== null ? `<div class="nav"><span class="count">${z.i + 1} / ${z.qs.length}</span><button class="btn primary" data-act="next">${z.i === z.qs.length - 1 ? 'See results' : 'Next'}</button></div>` : ''}`);
    if (q.type === 'listen' && z.picked === null) audio.play(q.answer.id);
    app.querySelectorAll('.opt').forEach(b => b.onclick = () => {
      z.picked = +b.dataset.k;
      const right = q.options[z.picked] === q.answer;
      if (right) z.score++;
      render();
      audio.play(q.answer.id); // always hear the correct answer
    });
    const next = app.querySelector('[data-act=next]');
    if (next) next.onclick = () => nextQuestion(z);
  }

  function renderDone() {
    const z = s.quiz;
    const list = allLessons();
    const next = list[list.indexOf(lesson) + 1];
    const nextLevel = next && levelOf(next.id);
    const pct = z.score / z.qs.length;
    const msg = pct === 1 ? 'Ya3teek l 3afye! Perfect.' : pct >= 0.7 ? 'Brava! Nicely done.' : 'Shway shway. Give it another go.';
    shell(`
      <div class="card done">
        <div class="pic">${pct >= 0.7 ? '🎉' : '💪'}</div>
        <h2>${z.score} / ${z.qs.length}</h2>
        <p>${msg}</p>
        <div class="row">
          <button class="btn ghost" data-act="again">Try the quiz again</button>
          ${next && nextLevel === level
            ? `<a class="btn primary" href="#/lesson/${next.id}">Next: ${esc(next.title)} →</a>`
            : `<a class="btn primary" href="#/level/${level.n}">Back to Level ${level.n}</a>`}
        </div>
      </div>`);
    app.querySelector('[data-act=again]').onclick = async () => { s.quiz = await buildQuiz(); s.step = 'quiz'; render(); };
  }

  async function render() {
    audio.stop();
    if (s.step === 'quiz' && !s.quiz) s.quiz = await buildQuiz();
    ({ learn: renderLearn, dialogue: renderDialogue, practice: renderPractice, quiz: renderQuiz, done: renderDone })[s.step]();
  }
  render();
}

// ----- recording studio (for the teacher) -----
async function viewStudio() {
  const sections = allLessons().map(l => `
    <h2>Level ${levelOf(l.id).n} · ${l.icon} ${esc(l.title)}</h2>
    <ul class="clips">${clipsFor(l).map(c => `
      <li data-id="${esc(c.id)}">
        <div class="clip-text">
          <strong>${esc(c.arabizi)}</strong> <span dir="rtl" lang="ar" class="ar">${esc(c.arabic)}</span>
          <small>${esc(c.label)} · <code>${esc(c.id)}</code></small>
        </div>
        <span class="status"></span>
        <div class="clip-btns">
          <button class="btn rec" data-act="rec">🎙️</button>
          <button class="btn ghost" data-act="play" disabled>▶</button>
          <button class="btn ghost" data-act="del" disabled title="Delete browser recording">🗑</button>
        </div>
      </li>`).join('')}</ul>`).join('');

  app.innerHTML = `
    <a class="back" href="#/">← Lessons</a>
    <h1>Recording studio</h1>
    <div class="card left">
      <p>Record each phrase in your own voice. Recordings are saved in <b>this browser</b> and the lessons use them right away, so you can test as you go.</p>
      <p>When you're happy, press <b>Download all</b> and unzip the files into the site's <code>audio/</code> folder. That's what makes them work for everyone.</p>
      <p class="muted">Tips: a quiet room, phone about 20 cm from your mouth, normal speed. Leave half a second of silence before and after.</p>
      <div class="row"><span id="tally" class="badge"></span><button class="btn primary" id="zip">⬇ Download all</button></div>
    </div>
    ${sections}`;

  const refresh = async li => {
    const id = li.dataset.id;
    audio.forget(id);
    const found = await audio.audioUrl(id);
    const st = li.querySelector('.status');
    st.textContent = !found ? 'missing' : found.source === 'file' ? 'published' : 'recorded';
    st.className = 'status ' + (found ? found.source : 'none');
    li.querySelector('[data-act=play]').disabled = !found;
    li.querySelector('[data-act=del]').disabled = !found || found.source !== 'browser';
  };
  const tally = async () => {
    const all = app.querySelectorAll('.clips li').length;
    const have = app.querySelectorAll('.status.file, .status.browser').length;
    app.querySelector('#tally').textContent = `${have} / ${all} recorded`;
  };

  const lis = [...app.querySelectorAll('.clips li')];
  await Promise.all(lis.map(refresh));
  tally();

  let active = null;
  for (const li of lis) {
    const id = li.dataset.id;
    const rec = li.querySelector('[data-act=rec]');
    rec.onclick = async () => {
      if (active && active.li !== li) return toast('Finish the current recording first.');
      if (active) {
        const blob = await active.r.stop();
        active = null;
        rec.textContent = '🎙️';
        rec.classList.remove('live');
        await clips.put(id, blob);
        await refresh(li);
        tally();
        audio.play(id);
        return;
      }
      try {
        active = { li, r: await audio.startRecording() };
        rec.textContent = '⏹';
        rec.classList.add('live');
      } catch { toast('Microphone permission was blocked.'); }
    };
    li.querySelector('[data-act=play]').onclick = () => audio.play(id);
    li.querySelector('[data-act=del]').onclick = async () => {
      if (!confirm('Delete this recording?')) return;
      await clips.remove(id);
      await refresh(li);
      tally();
    };
  }

  app.querySelector('#zip').onclick = async () => {
    const keys = await clips.keys();
    if (!keys.length) return toast('Nothing recorded in this browser yet.');
    if (!window.JSZip) {
      await new Promise((res, rej) => {
        const sc = document.createElement('script');
        sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
        sc.onload = res; sc.onerror = rej;
        document.head.appendChild(sc);
      }).catch(() => toast('Could not load the zip tool. Check your connection.'));
      if (!window.JSZip) return;
    }
    const zip = new window.JSZip();
    for (const k of keys) {
      const blob = await clips.get(k);
      zip.file(`${k}.${audio.extFor(blob)}`, blob);
    }
    const out = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(out);
    a.download = 'falafel-audio.zip';
    a.click();
  };
}

// ---------- router ----------
function showError(err) {
  console.error(err);
  app.innerHTML = `<div class="card"><div class="pic">😕</div>
    <p>Something went wrong loading this page.</p>
    <div class="row"><button class="btn primary" onclick="location.reload()">Reload</button></div></div>`;
}

function route() {
  const [, page, arg] = location.hash.split('/');
  window.scrollTo(0, 0);
  audio.stop();
  try {
    if (page === 'lesson') viewLesson(arg);
    else if (page === 'level') viewLevel(arg);
    else if (page === 'studio') viewStudio().catch(showError);
    else if (page === 'about') viewAbout();
    else viewHome();
  } catch (err) { showError(err); }
}

// Bumped by tools/bump.sh together with version.json and every ?v= tag.
const VERSION = 10;

// Phones can keep an old copy of the page for a while. If the server has a newer
// version, reload once with ?v=<new> in the address, which forces a fresh copy.
async function checkForUpdate() {
  try {
    const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
    const { v } = await r.json();
    const url = new URL(location.href);
    if (v > VERSION && url.searchParams.get('v') !== String(v)) {
      url.searchParams.set('v', v);
      location.replace(url.toString());
      return true;
    }
  } catch { /* offline: carry on with what we have */ }
  return false;
}

async function boot() {
  if (await checkForUpdate()) return;
  applyToggles();
  try {
    DATA = await (await fetch('content/lessons.json?v=10', { cache: 'no-cache' })).json();
  } catch {
    app.innerHTML = '<p class="card">Could not load lessons. Open the site through a web server, not as a file.</p>';
    return;
  }
  window.addEventListener('hashchange', route);
  route();
}
boot();
