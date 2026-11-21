import { settings, progress, clips, srs } from './store.js?v=48';
import * as audio from './audio.js?v=48';

const app = document.getElementById('app');
let DATA = null;
let VERBS = null; // content/verbs.json: conjugation tables
let GUIDE = null; // content/grammar.json: the Grammar and Culture pages

// ---------- helpers ----------
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// A phrase in whichever scripts the learner has switched on (CSS hides the rest).
function phrase(p, { big = false } = {}) {
  const long = (p.arabizi || '').length > 60 ? 'long' : '';
  return `<div class="phrase ${big ? 'big' : ''} ${long}">
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
  for (const d of lesson.dialogue || []) out.push({ id: d.id, arabizi: d.arabizi, arabic: d.arabic, label: `Dialogue: ${d.speaker}` });
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
  const due = dueCount();
  const talks = DATA.levels.reduce((n, lv) => n + lv.lessons.filter(l => ready(l) && l.dialogue?.length).length, 0);
  app.innerHTML = `
    <section class="hero">
      <h1>Speak Lebanese Like a Local:<br><span>The Arabic People Really Talk</span></h1>
      <p>Ten free levels with a native speaker's voice, <br>from your first word to a whole paragraph.</p>
      ${GUIDE ? '<p class="newhere"><a href="#/topic/how-to-study">New here? How to learn Lebanese with Kifak →</a></p>' : ''}
    </section>
    <section class="choices">
      <a class="choice" href="#/lessons">
        <span class="choice-icon">📚</span>
        <strong>Lessons</strong>
        <span>Learn step by step: single words first, then phrases, sentences and paragraphs.</span>
      </a>
      <a class="choice" href="#/talks">
        <span class="choice-icon">💬</span>
        <strong>Conversations</strong>
        <span>${talks} real Lebanese conversations to listen to, with questions to check you understood.</span>
      </a>
      ${VERBS ? `<a class="choice" href="#/verbs">
        <span class="choice-icon">🔁</span>
        <strong>Verbs</strong>
        <span>${VERBS.verbs.length} everyday verbs in every form: past, every day, right now, future and commands.</span>
      </a>` : ''}
      ${GUIDE ? `<a class="choice" href="#/grammar">
        <span class="choice-icon">🧩</span>
        <strong>Grammar</strong>
        <span>${topicsIn('grammar').length} short guides: pronouns, "to have", negation, numbers, questions and more.</span>
      </a>
      <a class="choice" href="#/culture">
        <span class="choice-icon">☕</span>
        <strong>Culture</strong>
        <span>What to say back to "sa7tein", words you'll hear all day, manners, French and English mixing.</span>
      </a>` : ''}
      <a class="choice" href="#/review">
        <span class="choice-icon">🧠</span>
        <strong>Review</strong>
        <span>${due ? `${due} flashcards waiting for you.` : 'Flashcards of the words you learned, spaced out so they stick.'}</span>
      </a>
      <a class="choice" href="#/dictionary">
        <span class="choice-icon">🔎</span>
        <strong>Dictionary</strong>
        <span>Search every word on the site in English, Latin letters or Arabic.</span>
      </a>
    </section>`;
}

function viewLessons() {
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
    <a class="back" href="#/">← Home</a>
    <h1>Lessons</h1>
    <p class="lead">Ten levels, from single words to whole paragraphs. All of them are open, so start wherever suits you.</p>
    <section class="lessons">${cards}</section>`;
}

// ----- conversations: every lesson's dialogue, in a section of its own -----
// First a list of the ten levels, then one level's conversations on its own page.
const talksOf = lv => lv.lessons.filter(l => ready(l) && l.dialogue?.length);

function viewTalks(n) {
  if (n) return viewTalkLevel(n);
  const cards = DATA.levels.map(lv => {
    const live = talksOf(lv);
    if (!live.length) return '';
    const heard = live.filter(l => progress.get('talk-' + l.id)).length;
    const pct = Math.round((heard / live.length) * 100);
    return `<a class="lesson-card level" href="#/talks/${lv.n}">
      <span class="lesson-icon lvl">${lv.n}</span>
      <span class="lesson-text"><small>Level ${lv.n} · ${live.length} conversations</small><strong>${esc(lv.title)}</strong>
        <span class="meter"><i style="width:${pct}%"></i></span></span>
      <span class="badge ${heard === live.length ? 'done' : ''}">${heard}/${live.length}</span>
    </a>`;
  }).join('');
  app.innerHTML = `
    <a class="back" href="#/">← Home</a>
    <h1>Conversations</h1>
    <p class="lead">Listen to Lebanese people talking, then answer a few questions. The higher the level, the faster and longer they get. Pick a level.</p>
    <section class="lessons">${cards}</section>`;
}

function viewTalkLevel(n) {
  const lv = DATA.levels.find(x => x.n === +n);
  if (!lv) { location.hash = '#/talks'; return; }
  const cards = talksOf(lv).map(l => {
    const heard = progress.get('talk-' + l.id);
    return `<a class="lesson-card" href="#/talk/${l.id}"><span class="lesson-icon">${l.icon}</span>
      <span class="lesson-text"><strong>${esc(l.title)}</strong><span>${l.dialogue.length} lines${l.questions?.length ? ` · ${l.questions.length} questions` : ''}</span></span>
      ${heard ? `<span class="badge done">✓ ${heard.best}/${heard.total}</span>` : ''}</a>`;
  }).join('');
  app.innerHTML = `
    <a class="back" href="#/talks">← All levels</a>
    <h1>Level ${lv.n}: ${esc(lv.title)}</h1>
    <p class="lead">Conversations for this level.</p>
    <section class="lessons">${cards}</section>`;
}

function viewTalk(id) {
  const lesson = allLessons().find(l => l.id === id && l.dialogue?.length);
  if (!lesson) return viewTalks();
  const level = levelOf(id);
  const qs = (lesson.questions || []).map(c => ({ ...c, order: shuffle(c.options.map((t, k) => k)) }));
  const picked = {};
  let score = 0;

  const playAll = async btn => {
    btn.disabled = true;
    for (const d of lesson.dialogue) {
      const el = app.querySelector(`.chat [data-clip="${d.id}"]`)?.closest('.bubble');
      el?.classList.add('lit');
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      const ok = await audio.play(d.id);
      el?.classList.remove('lit');
      if (!ok) { toast('Some lines have no recording yet.'); break; }
      await new Promise(r => setTimeout(r, 350));
    }
    btn.disabled = false;
  };

  const render = () => {
    const lines = lesson.dialogue.map(d => {
      const side = DATA.speakers[d.speaker] === 'f' ? 'right' : 'left';
      return `<div class="bubble ${side}">
        <div class="who">${esc(d.speaker)}</div>
        ${phrase(d)}
        <button class="mini" data-clip="${esc(d.id)}" aria-label="Play line">🔊</button>
      </div>`;
    }).join('');
    const questions = qs.map((q, n) => {
      const opts = q.order.map(k => {
        let cls = '';
        if (picked[n] !== undefined) cls = k === q.answer ? 'right' : (k === picked[n] ? 'wrong' : 'dim');
        return `<button class="opt ${cls}" data-q="${n}" data-k="${k}" ${picked[n] !== undefined ? 'disabled' : ''}><span class="t-english always">${esc(q.options[k])}</span></button>`;
      }).join('');
      return `<div class="card left qcard"><p class="ask">${n + 1}. ${esc(q.q)}</p><div class="opts">${opts}</div></div>`;
    }).join('');
    const finished = qs.length && Object.keys(picked).length === qs.length;
    const all = allLessons().filter(l => l.dialogue?.length);
    const next = all[all.indexOf(lesson) + 1];
    app.innerHTML = `
      <a class="back" href="#/talks/${level.n}">← Level ${level.n} conversations</a>
      <h1 class="lesson-title">${lesson.icon} ${esc(lesson.title)}</h1>
      <p class="lead">Level ${level.n}. Listen to the whole conversation, then tap any line to hear it again.</p>
      <div class="row"><button class="btn primary" data-act="all">▶ Play conversation</button></div>
      <div class="chat">${lines}</div>
      ${qs.length ? `<h2>👂 Did you understand?</h2>${questions}` : ''}
      ${finished ? `<div class="card done"><h2>${score} / ${qs.length}</h2><p>${score === qs.length ? 'Ya3teek l 3afye! Perfect.' : 'Listen again and try once more.'}</p></div>` : ''}
      <div class="nav"><span></span>${next ? `<a class="btn primary" href="#/talk/${next.id}">Next conversation →</a>` : ''}</div>`;
    markMissing();
    app.querySelector('[data-act=all]').onclick = e => playAll(e.currentTarget);
    app.querySelectorAll('.opt').forEach(b => b.onclick = () => {
      const n = +b.dataset.q;
      picked[n] = +b.dataset.k;
      if (picked[n] === qs[n].answer) score++;
      if (Object.keys(picked).length === qs.length) progress.complete('talk-' + lesson.id, score, qs.length);
      const y = window.scrollY;
      render();
      window.scrollTo(0, y);
    });
  };
  render();
}

// The reading guide. Each row has two clips the teacher records in the studio:
// the sound on its own (abc-<key>) and the example word (abc-<key>-ex).
const ABC = [
  { key: '2', ar: 'ء', how: 'A catch in the throat, like the middle of "uh-oh".', ex: 'su2al', exAr: 'سؤال', en: 'question' },
  { key: '3', ar: 'ع', how: 'A squeezed sound from deep in the throat. No English match.', ex: '3afwan', exAr: 'عفواً', en: "you're welcome" },
  { key: '7', ar: 'ح', how: 'A breathy, raspy "h", like fogging up a mirror.', ex: 'mni7', exAr: 'منيح', en: 'good' },
  { key: 'kh', ar: 'خ', how: 'Like the "ch" in Scottish "loch".', ex: 'kheir', exAr: 'خير', en: 'good (morning)' },
  { key: 'gh', ar: 'غ', how: 'Like a French "r", gargled lightly.', ex: 'ghali', exAr: 'غالي', en: 'expensive',
    note: 'Some people type 8 instead of gh, so you may also see "8ali".' },
  { key: 'sh', ar: 'ش', how: 'Like English "sh".', ex: 'shukran', exAr: 'شكراً', en: 'thank you' },
];
// The guide as a pseudo-lesson, so the Recording studio can list its clips.
const ABC_LESSON = {
  id: 'abc', icon: '🔤', title: 'Reading Latin-script Arabic', dialogue: [],
  items: ABC.flatMap(r => [
    { id: `abc-${r.key}`, arabizi: r.key, arabic: r.ar, english: `The sound of ${r.key}` },
    { id: `abc-${r.key}-ex`, arabizi: r.ex, arabic: r.exAr, english: r.en },
  ]),
};

function viewAbout() {
  const rows = ABC.map(r => `<tr>
    <td class="num">${esc(r.key)}</td>
    <td dir="rtl" lang="ar" class="ar">${r.ar}</td>
    <td>${esc(r.how)}<br><em>${esc(r.ex)}</em> = ${esc(r.en)}
      ${r.note ? `<p class="note">💡 ${esc(r.note)}</p>` : ''}
      <div class="abc-play">
        <button class="btn play" data-clip="abc-${esc(r.key)}">🔊 Sound</button>
        <button class="btn play ghost" data-clip="abc-${esc(r.key)}-ex">🔊 ${esc(r.ex)}</button>
      </div></td></tr>`).join('');
  app.innerHTML = `
    <a class="back" href="#/">← Home</a>
    <h1>Reading Latin-script Arabic</h1>
    <p>Lebanese people mostly text in <strong>Latin-script Arabic</strong>: Arabic words written with English letters, plus numbers for the sounds English doesn't have. The numbers look like the Arabic letter they replace.</p>
    <p class="muted">Tap 🔊 to hear each sound, then a word that uses it.</p>
    <table class="abc">${rows}</table>
    <p>In lessons and conversations, use the <b>Abc</b>, <b>عربي</b> and <b>EN</b> buttons at the top to show or hide each writing.</p>`;
  markMissing();
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
    <a class="back" href="#/lessons">← All levels</a>
    <h1>Level ${lv.n}: ${esc(lv.title)}</h1>
    <p class="lead">${esc(lv.goal)}</p>
    <section class="lessons">${cards}</section>`;
}

// ----- verbs: conjugation tables and a short practice quiz -----
const verbById = id => VERBS?.verbs.find(v => v.id === id);
const personOf = key => VERBS.persons.find(p => p.key === key);
const verbTitle = v => `${v.forms.past[3].latin} · ${v.english}`; // the he-form is the dictionary form

function viewVerbs() {
  const cards = VERBS.verbs.map(v => {
    const p = progress.get('verb-' + v.id);
    return `<a class="lesson-card" href="#/verb/${v.id}"><span class="lesson-icon">${v.icon}</span>
      <span class="lesson-text"><strong>${esc(v.forms.past[3].latin)} <span class="ar" dir="rtl" lang="ar">${esc(v.forms.past[3].arabic)}</span></strong><span>${esc(v.english)}</span></span>
      ${p ? `<span class="badge done">✓ ${p.best}/${p.total}</span>` : ''}</a>`;
  }).join('');
  app.innerHTML = `
    <a class="back" href="#/">← Home</a>
    <h1>Verbs</h1>
    <p class="lead">Each verb in five forms: what happened, what you do every day, what's happening right now, what will happen, and how to tell someone to do it.</p>
    <section class="lessons">${cards}</section>`;
}

function viewVerb(id, tense) {
  const v = verbById(id);
  if (!v) return viewVerbs();
  const t = VERBS.tenses.find(x => x.key === tense) || VERBS.tenses[0];
  const tabs = VERBS.tenses.map(x => `<a class="${x === t ? 'on' : ''}" href="#/verb/${v.id}/${x.key}">${esc(x.label)}</a>`).join('');
  const rows = v.forms[t.key].map(f => {
    const who = t.key === 'command'
      ? `<span class="t-english always">${esc(VERBS.commandTo.find(c => c.key === f.person).english)}</span>`
      : `<span class="t-arabizi">${esc(personOf(f.person).latin)}</span><span class="t-arabic ar" dir="rtl" lang="ar">${esc(personOf(f.person).arabic)}</span><span class="t-english">${esc(personOf(f.person).english)}</span>`;
    return `<li><div class="who-col">${who}</div>
      <div class="form-col">${phrase({ arabizi: f.latin, arabic: f.arabic, english: f.english })}</div>
      <button class="mini" data-clip="${esc(f.id)}" aria-label="Play">🔊</button></li>`;
  }).join('');
  const list = VERBS.verbs;
  const next = list[list.indexOf(v) + 1];
  app.innerHTML = `
    <a class="back" href="#/verbs">← Verbs</a>
    <h1 class="lesson-title">${v.icon} ${esc(verbTitle(v))}</h1>
    <nav class="tense-tabs">${tabs}</nav>
    <p class="lead">${esc(t.hint)}</p>
    <ul class="conj">${rows}</ul>
    <div class="nav">
      <a class="btn ghost" href="#/verbquiz/${v.id}">✏️ Practise this verb</a>
      ${next ? `<a class="btn primary" href="#/verb/${next.id}/${t.key}">Next verb →</a>` : '<span></span>'}
    </div>`;
  markMissing();
}

function viewVerbQuiz(id) {
  const v = verbById(id);
  if (!v) return viewVerbs();
  // "you" has three Lebanese forms, so the question says which one is meant.
  const youTo = { enta: 'to a man', ente: 'to a woman', ento: 'to a group' };
  const all = Object.entries(v.forms).flatMap(([tense, rows]) => rows.map(r => ({
    ...r, tense, ask: tense !== 'command' && youTo[r.person] ? `${r.english} (${youTo[r.person]})` : r.english,
  })));
  // Different forms can look the same (katabt = I wrote = you wrote), so never offer two identical answers.
  const qs = shuffle(all).slice(0, 10).map(ans => {
    const others = shuffle(all.filter(x => x.latin !== ans.latin && x.ask !== ans.ask));
    const opts = [];
    for (const o of others) { if (!opts.some(x => x.latin === o.latin)) opts.push(o); if (opts.length === 3) break; }
    return { ans, opts: shuffle([ans, ...opts]) };
  });
  const z = { i: 0, score: 0, picked: null };
  const render = () => {
    if (z.i >= qs.length) {
      progress.complete('verb-' + v.id, z.score, qs.length);
      app.innerHTML = `
        <a class="back" href="#/verb/${v.id}">← ${esc(verbTitle(v))}</a>
        <div class="card done"><div class="pic">${z.score >= 7 ? '🎉' : '💪'}</div><h2>${z.score} / ${qs.length}</h2>
          <p>${z.score === qs.length ? 'Ya3teek l 3afye! Perfect.' : z.score >= 7 ? 'Brava! Nicely done.' : 'Shway shway. Look at the table and try again.'}</p>
          <div class="row"><a class="btn ghost" href="#/verb/${v.id}">See the table</a><button class="btn primary" data-act="again">Try again</button></div></div>`;
      app.querySelector('[data-act=again]').onclick = () => viewVerbQuiz(id);
      return;
    }
    const q = qs[z.i];
    const tenseName = VERBS.tenses.find(x => x.key === q.ans.tense).label;
    const opts = q.opts.map((o, k) => {
      let cls = '';
      if (z.picked !== null) cls = o === q.ans ? 'right' : (k === z.picked ? 'wrong' : 'dim');
      return `<button class="opt ${cls}" data-k="${k}" ${z.picked !== null ? 'disabled' : ''}><span class="t-arabizi">${esc(o.latin)}</span><span class="t-arabic" dir="rtl" lang="ar">${esc(o.arabic)}</span></button>`;
    }).join('');
    app.innerHTML = `
      <a class="back" href="#/verb/${v.id}">← ${esc(verbTitle(v))}</a>
      <div class="quizbar"><div style="width:${(z.i / qs.length) * 100}%"></div></div>
      <div class="card"><p class="ask">How do you say… <span class="muted">(${esc(tenseName)})</span></p>
        <div class="phrase big"><div class="t-english always">${esc(q.ans.ask)}</div></div></div>
      <div class="opts">${opts}</div>
      ${z.picked !== null ? `<div class="nav"><span class="count">${z.i + 1} / ${qs.length}</span><button class="btn primary" data-act="next">${z.i === qs.length - 1 ? 'See results' : 'Next'}</button></div>` : ''}`;
    app.querySelectorAll('.opt').forEach(b => b.onclick = () => {
      z.picked = +b.dataset.k;
      if (q.opts[z.picked] === q.ans) z.score++;
      render();
      audio.play(q.ans.id);
    });
    const nx = app.querySelector('[data-act=next]');
    if (nx) nx.onclick = () => { z.i++; z.picked = null; render(); };
  };
  render();
}

// Each verb as a pseudo-lesson, so the Recording studio can list its clips.
const verbLessons = () => (VERBS?.verbs || []).map(v => ({
  id: 'verb-' + v.id, icon: v.icon, title: verbTitle(v), dialogue: [], verb: true,
  items: Object.values(v.forms).flat().map(f => ({ id: f.id, arabizi: f.latin, arabic: f.arabic, english: f.english })),
}));

// ----- lesson: learn → practice → quiz → done (conversations live in their own section) -----
const STEPS = ['learn', 'practice', 'quiz'];
const STEP_NAMES = { learn: 'Learn', practice: 'Repeat', quiz: 'Quiz' };
const QUIZ_SIZE = 15; // lessons have about 30 examples; the quiz picks 15 of them each time

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
        <button class="btn primary" data-act="next">${s.i === lesson.items.length - 1 ? 'Your turn to speak →' : 'Next'}</button>
      </div>`);
    app.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { s.female = b.dataset.g === 'f'; render(); });
    app.querySelector('[data-act=prev]').onclick = () => { s.i--; s.female = false; render(); };
    app.querySelector('[data-act=next]').onclick = () => {
      if (s.i < lesson.items.length - 1) { s.i++; s.female = false; render(); } else go('practice');
    };
    audio.play(clip); // auto-play once when the card appears (silently skipped if missing)
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
      </div>
      ${s.i < lesson.items.length - 1 ? `<p class="skip"><button class="linkbtn" data-act="skip">Skip to the quiz →</button></p>` : ''}`);
    app.querySelector('[data-act=skip]')?.addEventListener('click', () => go('quiz'));
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
  // Split a paragraph into sentences after . ! ? (keeping the mark on the sentence).
  const sentences = t => t.split(/(?<=[.!?])\s+/).filter(Boolean);
  const tokens = q => (q.type === 'order' ? sentences : words)(q.answer.arabizi);

  async function buildQuiz() {
    const items = lesson.items;
    const qs = [];
    for (const it of shuffle(items).slice(0, QUIZ_SIZE)) {
      const others = shuffle(items.filter(x => x !== it)).slice(0, 3);
      const hasAudio = !!(await audio.audioUrl(it.id));
      const n = words(it.arabizi).length;
      let types;
      const multi = sentences(it.arabizi).length >= 2;
      if (n > 12 || multi) {
        // Linked sentences and paragraphs: understand it, say it, and put its sentences in order.
        types = ['meaning', 'meaning', 'say'].concat(hasAudio ? ['listen', 'listen'] : []);
        if (multi) types = ['order', 'order', ...types];
      } else {
        types = ['meaning', 'say', 'picture'].concat(hasAudio ? ['listen', 'listen'] : []);
        // From Level 3, phrases of 3 to 8 words become "put the words in order".
        if (level.n >= 3 && n >= 3 && n <= 8) types = ['build', 'build', ...types];
      }
      const type = types[Math.floor(Math.random() * types.length)];
      qs.push({ type, answer: it, options: shuffle([it, ...others]) });
    }
    return { qs, i: 0, score: 0, picked: null, built: [] };
  }

  function renderBuild(z, q) {
    const target = tokens(q);
    const sent = q.type === 'order' ? 'sent' : '';
    if (!z.pool) z.pool = shuffle(target.map((w, k) => ({ w, k })));
    const used = new Set(z.built.map(t => t.k));
    const checked = z.picked !== null;
    const right = checked && z.built.map(t => t.w).join(' ') === target.join(' ');
    const line = z.built.map(t => `<button class="tile ${sent}" data-k="${t.k}" ${checked ? 'disabled' : ''}>${esc(t.w)}</button>`).join('')
      || `<span class="muted">Tap the ${sent ? 'sentences' : 'words'} below in order</span>`;
    const pool = z.pool.map(t => `<button class="tile ${sent} ${used.has(t.k) ? 'gone' : ''}" data-p="${t.k}" ${used.has(t.k) || checked ? 'disabled' : ''}>${esc(t.w)}</button>`).join('');
    shell(`
      <div class="quizbar"><div style="width:${(z.i / z.qs.length) * 100}%"></div></div>
      <div class="card">
        <p class="ask">${sent ? 'Put the sentences in order' : 'Build the sentence'}</p>
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
    if (q.type === 'build' || q.type === 'order') {
      renderBuild(z, q);
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
      <div class="opts ${words(q.answer.arabizi).length > 8 ? 'long' : ''}">${opts}</div>
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
          ${lesson.dialogue?.length ? `<a class="btn ghost" href="#/talk/${lesson.id}">💬 Hear it in a conversation</a>` : ''}
          <a class="btn ghost" href="#/review">🧠 Review flashcards</a>
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
    ({ learn: renderLearn, practice: renderPractice, quiz: renderQuiz, done: renderDone })[s.step]();
  }
  render();
}

// ----- recording studio (for the teacher) -----
async function viewStudio(lessonId) {
  // One lesson at a time: the whole course has thousands of clips.
  const list = [ABC_LESSON, ...guideLessons(), ...allLessons(), ...verbLessons()];
  const lesson = list.find(l => l.id === lessonId) || allLessons()[0];
  const ix = list.indexOf(lesson);
  const prev = list[ix - 1], next = list[ix + 1];
  const verbOptions = verbLessons().length ? `<optgroup label="Verbs">${verbLessons().map(l => `<option value="${l.id}" ${l.id === lesson.id ? 'selected' : ''}>${l.icon} ${esc(l.title)}</option>`).join('')}</optgroup>` : '';
  const guideOptions = guideLessons().length ? `<optgroup label="Grammar and culture">${guideLessons().map(l => `<option value="${l.id}" ${l.id === lesson.id ? 'selected' : ''}>${l.icon} ${esc(l.title)}</option>`).join('')}</optgroup>` : '';
  const options = `<option value="abc" ${lesson === ABC_LESSON ? 'selected' : ''}>🔤 Reading Latin-script Arabic</option>` + guideOptions + DATA.levels.map(lv => `<optgroup label="Level ${lv.n}: ${esc(lv.title)}">${
    lv.lessons.filter(ready).map(l => `<option value="${l.id}" ${l === lesson ? 'selected' : ''}>${l.icon} ${esc(l.title)}</option>`).join('')
  }</optgroup>`).join('') + verbOptions;
  const sections = `
    <h2>${lesson === ABC_LESSON ? '' : lesson.verb ? 'Verb · ' : lesson.topic ? 'Grammar and culture · ' : `Level ${levelOf(lesson.id).n} · `}${lesson.icon} ${esc(lesson.title)}</h2>
    <ul class="clips">${clipsFor(lesson).map(c => `
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
      </li>`).join('')}</ul>
    <div class="nav">
      ${prev ? `<a class="btn ghost" href="#/studio/${prev.id}">← Previous lesson</a>` : '<span></span>'}
      ${next ? `<a class="btn primary" href="#/studio/${next.id}">Next lesson →</a>` : '<span></span>'}
    </div>`;

  app.innerHTML = `
    <a class="back" href="#/">← Home</a>
    <h1>Recording studio</h1>
    <div class="card left">
      <p>Record each phrase in your own voice. Recordings are saved in <b>this browser</b> and the lessons use them right away, so you can test as you go.</p>
      <p>When you're happy, press <b>Download all</b> and unzip the files into the site's <code>audio/</code> folder. That's what makes them work for everyone.</p>
      <p class="muted">Tips: a quiet room, phone about 20 cm from your mouth, normal speed. Leave half a second of silence before and after.</p>
      <div class="row"><span id="tally" class="badge"></span><span id="total" class="badge"></span><button class="btn primary" id="zip">⬇ Download all</button></div>
    </div>
    <label class="picker">Lesson to record
      <select id="pick">${options}</select>
    </label>
    ${sections}`;
  app.querySelector('#pick').onchange = e => { location.hash = '#/studio/' + e.target.value; };
  const total = list.reduce((n, l) => n + clipsFor(l).length, 0);
  clips.keys().then(k => { const t = app.querySelector('#total'); if (t) t.textContent = `${k.length} / ${total} saved in this browser`; });

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
    app.querySelector('#tally').textContent = `This lesson: ${have} / ${all}`;
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
    a.download = 'kifak-audio.zip';
    a.click();
  };
}

// ---------- grammar and culture ----------
// content/grammar.json is built from tools/grammar_src.txt. Each topic has sections made of
// paragraphs, tips, tables and examples (examples have clip ids gr-<topic>-<nn>), then
// common mistakes and a few practice questions.
const md = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
const topicById = id => GUIDE?.topics.find(t => t.id === id);
const sectionOf = t => GUIDE.groups.find(g => g.key === t.group).section;
const topicsIn = section => GUIDE.topics.filter(t => sectionOf(t) === section);
const exItem = b => `<li class="ex">${phrase(b)}${b.note ? `<small class="exnote">${esc(b.note)}</small>` : ''}
  <button class="mini" data-clip="${esc(b.id)}" aria-label="Play">🔊</button></li>`;

function viewGuide(section) {
  const body = GUIDE.groups.filter(g => g.section === section).map(g => `
    <h2>${esc(g.title)}</h2>
    <section class="lessons">${GUIDE.topics.filter(t => t.group === g.key).map(t => {
      const p = progress.get('topic-' + t.id);
      return `<a class="lesson-card" href="#/topic/${t.id}"><span class="lesson-icon">${t.icon}</span>
        <span class="lesson-text"><strong>${esc(t.title)}</strong><span>${esc(t.summary)}</span></span>
        ${p ? `<span class="badge done">✓ ${p.best}/${p.total}</span>` : ''}</a>`;
    }).join('')}</section>`).join('');
  app.innerHTML = `
    <a class="back" href="#/">← Home</a>
    <h1>${section === 'culture' ? 'Culture' : 'Grammar'}</h1>
    <p class="lead">${section === 'culture'
      ? 'What to say back, the words you\'ll hear all day, and how things are done. The part most textbooks leave out.'
      : 'How Lebanese works, explained in plain English, with tables and examples you can play.'}</p>
    ${body}`;
}

function viewTopic(id) {
  const t = topicById(id);
  if (!t) return viewGuide('grammar');
  const qs = t.quiz.map(c => ({ ...c, order: shuffle(c.options.map((x, k) => k)) }));
  const picked = {};
  let score = 0;
  const cls = h => h === 'Latin' ? 't-arabizi' : h === 'Arabic' ? 't-arabic' : '';
  const table = b => {
    const c = b.head.map(cls);
    const td = (x, i) => `<td class="${c[i]}" ${c[i] === 't-arabic' ? 'dir="rtl" lang="ar"' : ''}>${md(x)}</td>`;
    return `<div class="tbl"><table>
      <thead><tr>${b.head.map((h, i) => `<th class="${c[i]}">${esc(h)}</th>`).join('')}</tr></thead>
      <tbody>${b.rows.map(r => `<tr>${r.map(td).join('')}</tr>`).join('')}</tbody></table></div>`;
  };
  const sectionHtml = s => {
    let out = '', exs = [];
    const flush = () => { if (exs.length) out += `<ul class="exs">${exs.map(exItem).join('')}</ul>`; exs = []; };
    for (const b of s.blocks) {
      if (b.type === 'ex') { exs.push(b); continue; }
      flush();
      if (b.type === 'p') out += `<p>${md(b.text)}</p>`;
      else if (b.type === 'tip') out += `<p class="tip">💡 ${md(b.text)}</p>`;
      else if (b.type === 'table') out += table(b);
    }
    flush();
    return `<section class="gsec">${s.h ? `<h2>${esc(s.h)}</h2>` : ''}${out}</section>`;
  };
  const list = topicsIn(sectionOf(t));
  const prev = list[list.indexOf(t) - 1], next = list[list.indexOf(t) + 1];
  const section = sectionOf(t);

  const render = () => {
    const questions = qs.map((q, n) => {
      const opts = q.order.map(k => {
        let c = '';
        if (picked[n] !== undefined) c = k === q.answer ? 'right' : (k === picked[n] ? 'wrong' : 'dim');
        return `<button class="opt ${c}" data-q="${n}" data-k="${k}" ${picked[n] !== undefined ? 'disabled' : ''}><span class="t-english always">${esc(q.options[k])}</span></button>`;
      }).join('');
      return `<div class="card left qcard"><p class="ask">${n + 1}. ${esc(q.q)}</p><div class="opts">${opts}</div></div>`;
    }).join('');
    const finished = qs.length && Object.keys(picked).length === qs.length;
    app.innerHTML = `
      <a class="back" href="#/${section}">← ${section === 'culture' ? 'Culture' : 'Grammar'}</a>
      <h1 class="lesson-title">${t.icon} ${esc(t.title)}</h1>
      <p class="lead">${esc(t.summary)}</p>
      <article class="guide">${t.sections.map(sectionHtml).join('')}</article>
      ${t.mistakes.length ? `<div class="card left mistakes"><h2>⚠️ Common mistakes</h2><ul>${t.mistakes.map(m => `<li>${md(m)}</li>`).join('')}</ul></div>` : ''}
      ${qs.length ? `<h2>✏️ Check yourself</h2>${questions}` : ''}
      ${finished ? `<div class="card done"><h2>${score} / ${qs.length}</h2><p>${score === qs.length ? 'Ya3teek l 3afye! Perfect.' : 'Read the page again and try once more.'}</p>
        <div class="row"><button class="btn ghost" data-act="again">Try again</button></div></div>` : ''}
      <div class="nav">
        ${prev ? `<a class="btn ghost" href="#/topic/${prev.id}">← ${esc(prev.title)}</a>` : '<span></span>'}
        ${next ? `<a class="btn primary" href="#/topic/${next.id}">${esc(next.title)} →</a>` : '<span></span>'}
      </div>`;
    markMissing();
    app.querySelectorAll('.opt').forEach(b => b.onclick = () => {
      const n = +b.dataset.q;
      picked[n] = +b.dataset.k;
      if (picked[n] === qs[n].answer) score++;
      if (Object.keys(picked).length === qs.length) progress.complete('topic-' + t.id, score, qs.length);
      const y = window.scrollY;
      render();
      window.scrollTo(0, y);
    });
    const again = app.querySelector('[data-act=again]');
    if (again) again.onclick = () => {
      for (const k of Object.keys(picked)) delete picked[k];
      score = 0;
      const y = window.scrollY;
      render();
      window.scrollTo(0, y);
    };
  };
  render();
}

const guideLessons = () => (GUIDE?.topics || []).map(t => ({
  id: 'topic-' + t.id, topic: true, icon: t.icon, title: t.title,
  items: t.sections.flatMap(s => s.blocks.filter(b => b.type === 'ex')),
}));

// ---------- dictionary: one search over every lesson, verb and grammar example ----------
let DICT = null;
const norm = s => String(s || '').toLowerCase().normalize('NFD')
  .replace(/[̀-ًͯ-ٰٟـ]/g, '') // accents, Arabic short vowels, shadda, tatweel
  .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
  .replace(/[^\p{L}\p{N} ]/gu, ' ').replace(/\s+/g, ' ').trim();

function buildDict() {
  const out = [], seen = new Set();
  const add = (e, where, href) => {
    const k = (e.arabizi || '').toLowerCase();
    if (!k || seen.has(k)) return;
    seen.add(k);
    out.push({ ...e, where, href, key: norm([e.arabizi, e.arabic, e.english, e.f?.arabizi, e.f?.arabic].join(' ')) });
  };
  for (const lv of DATA.levels) for (const l of lv.lessons.filter(ready))
    for (const it of l.items) add(it, `Level ${lv.n} · ${l.title}`, '#/lesson/' + l.id);
  for (const v of VERBS?.verbs || []) {
    const he = v.forms.past[3], ana = v.forms.present[0];
    add({ id: he.id, arabizi: he.latin, arabic: he.arabic, english: v.english }, 'Verbs', `#/verb/${v.id}/past`);
    add({ id: ana.id, arabizi: ana.latin, arabic: ana.arabic, english: `I ${v.english.slice(3)} (every day)` }, 'Verbs', `#/verb/${v.id}/present`);
  }
  for (const t of GUIDE?.topics || [])
    for (const s of t.sections) for (const b of s.blocks) if (b.type === 'ex') add(b, (sectionOf(t) === 'culture' ? 'Culture · ' : 'Grammar · ') + t.title, '#/topic/' + t.id);
  return out;
}

function searchDict(q) {
  const words = norm(q).split(' ').filter(Boolean);
  if (!words.length) return [];
  const full = norm(q);
  const rank = e => {
    const a = norm(e.arabizi), en = norm(e.english), ar = norm(e.arabic);
    if (a === full || en === full || ar === full || en === 'to ' + full) return 0;
    if (` ${e.key} `.includes(` ${full} `)) return 1; // a whole word: "go" finds "to go" before "good"
    if (a.startsWith(full) || en.startsWith(full) || ar.startsWith(full)) return 2;
    return 3;
  };
  return DICT.filter(e => words.every(w => e.key.includes(w)))
    .map(e => [rank(e), e.arabizi.length, e]).sort((x, y) => x[0] - y[0] || x[1] - y[1]).map(x => x[2]);
}

function viewDictionary(q0 = '') {
  DICT = DICT || buildDict();
  const tries = ['coffee', '7elo', 'قهوة', 'tomorrow', 'go', 'expensive', 'kifak', 'mabrouk'];
  app.innerHTML = `
    <a class="back" href="#/">← Home</a>
    <h1>Dictionary</h1>
    <p class="lead">Search ${DICT.length.toLocaleString('en')} words and phrases from the whole site, in English, Latin letters or Arabic.</p>
    <input id="q" class="search" type="search" placeholder="Search: coffee, 7elo, قهوة…" autocomplete="off" autocapitalize="off" spellcheck="false">
    <div class="tries">${tries.map(w => `<button class="chip" data-try="${esc(w)}">${esc(w)}</button>`).join('')}</div>
    <p class="muted" id="count"></p>
    <ul class="exs" id="res"></ul>`;
  const input = app.querySelector('#q'), res = app.querySelector('#res'), count = app.querySelector('#count');
  let timer;
  const run = () => {
    const q = input.value.trim();
    history.replaceState(null, '', '#/dictionary' + (q ? '/' + encodeURIComponent(q) : ''));
    app.querySelector('.tries').hidden = !!q;
    if (!q) { res.innerHTML = ''; count.textContent = ''; return; }
    const hits = searchDict(q);
    count.textContent = hits.length ? `${hits.length} found${hits.length > 60 ? ', showing the first 60' : ''}` : 'Nothing found. Try another spelling, or the English word.';
    res.innerHTML = hits.slice(0, 60).map(e => `<li class="ex">${phrase(e)}
      <small class="exnote"><a href="${e.href}">${esc(e.where)}</a></small>
      <button class="mini" data-clip="${esc(e.id)}" aria-label="Play">🔊</button></li>`).join('');
    markMissing(res);
  };
  input.oninput = () => { clearTimeout(timer); timer = setTimeout(run, 200); };
  app.querySelectorAll('[data-try]').forEach(b => b.onclick = () => { input.value = b.dataset.try; run(); });
  input.value = q0;
  run();
  if (!q0) input.focus({ preventScroll: true });
}

// ---------- review: flashcards with spaced repetition ----------
// Cards are the examples of every lesson the learner has finished. Each session shows the
// cards that are due plus up to 10 new ones. "Knew it" pushes a card days or weeks away.
const REVIEW_NEW = 10, REVIEW_MAX = 25;
const reviewPool = () => allLessons().filter(l => progress.get(l.id)).flatMap(l => l.items.map(it => ({ ...it, lesson: l })));
const dueCount = () => {
  const pool = reviewPool(), now = Date.now();
  const due = pool.filter(c => { const s = srs.card(c.id); return s && s.due <= now; }).length;
  return Math.min(due + Math.min(pool.filter(c => !srs.card(c.id)).length, REVIEW_NEW), REVIEW_MAX);
};
let reviewMode = (() => { try { return localStorage.getItem('ahla:reviewMode') || 'en'; } catch { return 'en'; } })();

function viewReview() {
  const pool = reviewPool();
  if (!pool.length) {
    app.innerHTML = `<a class="back" href="#/">← Home</a><h1>Review</h1>
      <div class="card"><div class="pic">🧠</div>
        <p>Your flashcards come from the lessons you finish. Do a lesson to the end of its quiz, and its words will wait for you here.</p>
        <div class="row"><a class="btn primary" href="#/lessons">Go to the lessons</a></div></div>`;
    return;
  }
  const now = Date.now();
  const due = shuffle(pool.filter(c => { const s = srs.card(c.id); return s && s.due <= now; }));
  const fresh = pool.filter(c => !srs.card(c.id)).slice(0, REVIEW_NEW);
  const queue = due.concat(fresh).slice(0, REVIEW_MAX);
  const boxes = pool.map(c => srs.card(c.id)?.box || 0);
  const known = boxes.filter(b => b >= 4).length, learning = boxes.filter(b => b > 0 && b < 4).length;
  const stats = `<div class="stats"><span><b>${pool.length}</b> cards</span><span><b>${known}</b> known well</span><span><b>${learning}</b> learning</span><span><b>${boxes.filter(b => !b).length}</b> new</span></div>`;
  let shown = false, doneCount = 0;
  const total = queue.length;

  const render = () => {
    const c = queue[0];
    if (!c) {
      const next = pool.map(x => srs.card(x.id)?.due).filter(Boolean).sort((a, b) => a - b)[0];
      const days = next ? Math.max(1, Math.round((next - Date.now()) / 864e5)) : 0;
      app.innerHTML = `<a class="back" href="#/">← Home</a><h1>Review</h1>${stats}
        <div class="card done"><div class="pic">🎉</div><h2>All done for today</h2>
          <p>${doneCount ? `You reviewed ${doneCount} cards. ` : ''}${next ? `The next cards are due in ${days} day${days > 1 ? 's' : ''}.` : ''} Finish more lessons to add new words.</p>
          <div class="row"><a class="btn primary" href="#/lessons">Lessons</a></div></div>`;
      return;
    }
    const front = reviewMode === 'en'
      ? `<div class="pic">${c.pic || '🗨️'}</div><p class="ask big-ask">${esc(c.english)}</p><p class="muted">How do you say it in Lebanese?</p>`
      : `<div class="pic">${c.pic || '🗨️'}</div><div class="no-en">${phrase({ arabizi: c.arabizi, arabic: c.arabic }, { big: true })}</div><p class="muted">What does it mean?</p>`;
    app.innerHTML = `
      <a class="back" href="#/">← Home</a>
      <h1>Review</h1>
      ${stats}
      <div class="seg"><span>Show me:</span>
        <button class="chip" data-mode="en" aria-pressed="${reviewMode === 'en'}">English first</button>
        <button class="chip" data-mode="lb" aria-pressed="${reviewMode === 'lb'}">Lebanese first</button></div>
      <p class="count">${doneCount + 1} of ${total}${queue.length > total - doneCount ? ' (and a few to repeat)' : ''}</p>
      <div class="card flash">
        ${front}
        ${shown ? `<div class="answer">${phrase(c, { big: true })}${c.note ? `<p class="muted">${esc(c.note)}</p>` : ''}
          <div class="row">${playBtn(c.id)}</div>
          <p class="muted small">From <a href="#/lesson/${c.lesson.id}">${esc(c.lesson.title)}</a></p></div>` : ''}
      </div>
      <div class="row">${shown
        ? `<button class="btn ghost bad" data-act="again">✗ Again</button><button class="btn primary" data-act="knew">✓ I knew it</button>`
        : `<button class="btn primary big" data-act="show">Show the answer</button>`}</div>`;
    markMissing();
    if (shown) audio.play(c.id);
    app.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => {
      reviewMode = b.dataset.mode;
      try { localStorage.setItem('ahla:reviewMode', reviewMode); } catch { /* fine */ }
      render();
    });
    const act = (name, fn) => { const b = app.querySelector(`[data-act=${name}]`); if (b) b.onclick = fn; };
    act('show', () => { shown = true; render(); });
    act('knew', () => { srs.grade(c.id, true); queue.shift(); doneCount++; shown = false; render(); });
    act('again', () => { srs.grade(c.id, false); queue.push(queue.shift()); shown = false; render(); });
  };
  render();
}

// ---------- router ----------
function showError(err) {
  console.error(err);
  app.innerHTML = `<div class="card"><div class="pic">😕</div>
    <p>Something went wrong loading this page.</p>
    <div class="row"><button class="btn primary" onclick="location.reload()">Reload</button></div></div>`;
}

function route() {
  const [, page, arg, arg2] = location.hash.split('/');
  window.scrollTo(0, 0);
  audio.stop();
  const section = { lessons: 'lessons', level: 'lessons', lesson: 'lessons', talks: 'talks', talk: 'talks', verbs: 'verbs', verb: 'verbs', verbquiz: 'verbs', grammar: 'grammar', culture: 'culture', topic: GUIDE && topicById(arg) ? sectionOf(topicById(arg)) : 'grammar', dictionary: 'dictionary', review: 'review', studio: 'studio', about: 'about' }[page] || '';
  document.querySelectorAll('.mainnav a').forEach(a => {
    a.classList.toggle('on', (a.getAttribute('href').split('/')[1] || '') === section);
  });
  document.body.classList.toggle('no-toggles', !['lesson', 'talk', 'verb', 'verbquiz', 'topic', 'dictionary', 'review'].includes(page));
  try {
    if (page === 'lesson') viewLesson(arg);
    else if (page === 'level') viewLevel(arg);
    else if (page === 'lessons') viewLessons();
    else if (page === 'talks') viewTalks(arg);
    else if (page === 'talk') viewTalk(arg);
    else if (page === 'studio') viewStudio(arg).catch(showError);
    else if (page === 'about') viewAbout();
    else if (page === 'verbs' && VERBS) viewVerbs();
    else if (page === 'verb' && VERBS) viewVerb(arg, arg2);
    else if (page === 'verbquiz' && VERBS) viewVerbQuiz(arg);
    else if ((page === 'grammar' || page === 'culture') && GUIDE) viewGuide(page);
    else if (page === 'topic' && GUIDE) viewTopic(arg);
    else if (page === 'dictionary') viewDictionary(arg ? decodeURIComponent(arg) : '');
    else if (page === 'review') viewReview();
    else viewHome();
  } catch (err) { showError(err); }
}

// Bumped by tools/bump.sh together with version.json and every ?v= tag.
const VERSION = 48;

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
    DATA = await (await fetch('content/lessons.json?v=48', { cache: 'no-cache' })).json();
    // Verbs are optional: if the file fails to load, the rest of the site still works.
    VERBS = await fetch('content/verbs.json?v=48', { cache: 'no-cache' }).then(r => r.json()).catch(() => null);
    GUIDE = await fetch('content/grammar.json?v=48', { cache: 'no-cache' }).then(r => r.json()).catch(() => null);
  } catch {
    app.innerHTML = '<p class="card">Could not load lessons. Open the site through a web server, not as a file.</p>';
    return;
  }
  window.addEventListener('hashchange', route);
  route();
}
boot();
