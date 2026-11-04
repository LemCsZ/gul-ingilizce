// Ders oynatıcı: bir oturumu adımlara böler ve tek tek gösterir.
import * as store from './store.js';
import * as srs from './srs.js';
import { speak, stop, canSpeak } from './speech.js';
import { rose } from './rose.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s).toLowerCase().replace(/[.,!?;:'’"]/g, '').replace(/\s+/g, ' ').trim();
const LETTERS = ['A', 'B', 'C', 'D'];

// ---------- Oturum kurucular ----------

function reviewSteps(limit, extraVocab = []) {
  const cards = srs.dueCards(limit);
  const pool = Object.values(store.get().cards);
  const steps = cards.map(c => ({ t: 'item', item: srs.cardToItem(c, pool), review: 'card' }));
  for (const v of extraVocab) {
    const c = store.get().cards[v.id];
    if (c && !cards.includes(c)) steps.push({ t: 'item', item: srs.cardToItem(c, pool), review: 'today' });
  }
  for (const m of srs.dueMistakes(8)) steps.push({ t: 'item', item: m.item, review: 'mistake', key: m.key });
  return steps;
}

export function buildSession(lesson, part, data, extra = {}) {
  const steps = [];
  if (lesson.kind === 'diagnostic') {
    const [g, v, r, l] = data.sections;
    if (part === 'morning') {
      steps.push({ t: 'intro', title: data.titleTr, text: data.introTr, note: '1. bölüm: dil bilgisi ve kelime, 32 soru. Test sırasında doğru ya da yanlış gösterilmez.' });
      [...g.items, ...v.items].forEach((item, i) => steps.push({ t: 'item', item, test: true, section: i < g.items.length ? 'grammar' : 'vocab' }));
    } else {
      steps.push({ t: 'intro', title: '2. bölüm: okuma, dinleme ve yazma', text: '18 soru ve kısa bir yazı. Acele etme.' });
      for (const p of r.passages) {
        steps.push({ t: 'reading', r: p });
        p.questions.forEach(item => steps.push({ t: 'item', item, test: true, section: 'reading', level: p.level, context: { kind: 'reading', r: p } }));
      }
      for (const p of l.passages) {
        steps.push({ t: 'listening', l: p });
        p.questions.forEach(item => steps.push({ t: 'item', item, test: true, section: 'listening', level: p.level, context: { kind: 'listening', l: p } }));
      }
      steps.push({ t: 'writing', w: data.writing, id: lesson.id });
    }
  } else if (lesson.kind === 'mock') {
    const [g, v, r, l] = data.sections;
    steps.push({ t: 'intro', title: data.titleTr || `${lesson.week}. hafta deneme sınavı`, text: data.introTr || '50 soru ve kısa bir yazı, gerçek sınav gibi. Doğru ve yanlışlar sonda gösterilir.', note: 'Yaklaşık 60 dakika. Telefonu sessize al, rahat bir yere otur.' });
    [...g.items, ...v.items].forEach((item, i) => steps.push({ t: 'item', item, test: true, section: i < g.items.length ? 'grammar' : 'vocab' }));
    for (const p of r.passages) {
      steps.push({ t: 'reading', r: p });
      p.questions.forEach(item => steps.push({ t: 'item', item, test: true, section: 'reading', level: p.level, context: { kind: 'reading', r: p } }));
    }
    for (const p of l.passages) {
      steps.push({ t: 'listening', l: p });
      p.questions.forEach(item => steps.push({ t: 'item', item, test: true, section: 'listening', level: p.level, context: { kind: 'listening', l: p } }));
    }
    if (data.writing) steps.push({ t: 'writing', w: data.writing, id: lesson.id });
  } else if (lesson.kind === 'light') {
    steps.push({ t: 'intro', title: 'Hafif gün', text: 'Bugün yeni konu yok. Kartlarını tekrar edip eş ve zıt anlam oyunu oynayacağız.' });
    steps.push(...reviewSteps(srs.DAILY_CAP));
    if (extra.synant) steps.push(...matchSteps(extra.synant, 3));
  } else if (part === 'morning') {
    const m = data.morning;
    const rev = reviewSteps(25);
    if (rev.length) steps.push({ t: 'section', title: 'Tekrar', text: `${rev.length} kart seni bekliyor.` }, ...rev);
    steps.push({ t: 'grammar', g: m.grammar });
    m.grammar.exercises.forEach(item => steps.push({ t: 'item', item }));
    steps.push({ t: 'section', title: 'Yeni kelimeler', text: `${m.vocab.length} kelime. Her birini dinle, sonra anlamını hatırla.` });
    m.vocab.forEach(v => steps.push({ t: 'word', v }));
    steps.push({ t: 'addcards', vocab: m.vocab });
    srs.shuffle(m.vocab).forEach(v => steps.push({ t: 'item', item: vocabCheck(v, m.vocab) }));
    steps.push({ t: 'reading', r: m.reading });
    m.reading.questions.forEach(item => steps.push({ t: 'item', item, context: { kind: 'reading', r: m.reading } }));
  } else {
    const e = data.evening;
    const rev = reviewSteps(40, data.morning.vocab);
    if (rev.length) steps.push({ t: 'section', title: 'Tekrar', text: 'Sabahın kelimeleri ve bugünkü yanlışlar.' }, ...rev);
    steps.push({ t: 'listening', l: e.listening });
    e.listening.questions.forEach(item => steps.push({ t: 'item', item, context: { kind: 'listening', l: e.listening } }));
    steps.push({ t: 'writing', w: e.writing, id: lesson.id });
    steps.push({ t: 'section', title: 'Sınav pratiği', text: `${e.examSet.length} soru, sınavdaki gibi karışık.` });
    e.examSet.forEach(item => steps.push({ t: 'item', item, exam: true }));
  }
  steps.push({ t: 'done' });
  return steps;
}

function vocabCheck(v, all) {
  const others = srs.shuffle(all.filter(o => o.id !== v.id)).slice(0, 3);
  const opts = srs.shuffle([v, ...others]);
  return { type: 'mcq', q: v.en, sub: v.example, options: opts.map(o => o.tr), answer: opts.indexOf(v), whyTr: `${v.en} = ${v.tr}`, tag: 'vocab', speak: v.en };
}

function matchSteps(synant, rounds) {
  const steps = [];
  for (let i = 0; i < rounds; i++) {
    const kind = i % 2 === 0 ? 'synonyms' : 'antonyms';
    steps.push({ t: 'match', kind, pairs: srs.shuffle(synant[kind]).slice(0, 5) });
  }
  return steps;
}

export function buildPractice(kind, extra) {
  if (kind === 'review') return [...reviewSteps(srs.DAILY_CAP), { t: 'done' }];
  if (kind === 'match') return [...matchSteps(extra.synant, 4), { t: 'done' }];
  return [{ t: 'done' }];
}

// ---------- Oynatıcı ----------

export function play(root, { steps, lesson, part, onExit }) {
  let i = 0;
  const started = Date.now();
  const score = { correct: 0, total: 0, bySection: {}, byLevel: {} };

  const header = () => {
    const pct = Math.round((i / (steps.length - 1)) * 100);
    return `<header class="play-head">
      <button class="icon-btn" data-act="exit" aria-label="Dersten çık">✕</button>
      <div class="stem-bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div>
      <span class="step-count">${Math.min(i + 1, steps.length - 1)}/${steps.length - 1}</span>
    </header>`;
  };

  function next() { stop(); i++; render(); window.scrollTo(0, 0); }

  function render() {
    const s = steps[i];
    root.innerHTML = header() + `<main class="play-body">${renderStep(s)}</main>`;
    bind(s);
  }

  function renderStep(s) {
    switch (s.t) {
      case 'intro':
      case 'section':
        return `<section class="card intro">
          <h2>${esc(s.title)}</h2><p>${esc(s.text)}</p>${s.note ? `<p class="muted">${esc(s.note)}</p>` : ''}
          <button class="btn primary" data-act="next">Başla</button></section>`;
      case 'grammar': return grammarView(s.g);
      case 'word': return wordView(s.v);
      case 'addcards': srs.addCards(s.vocab); queueMicrotask(next); return '';
      case 'reading': return readingView(s.r);
      case 'listening': return listeningView(s.l);
      case 'writing': return writingView(s.w, s.id);
      case 'item': return itemView(s);
      case 'match': return matchView(s);
      case 'done': return doneView();
    }
    return '';
  }

  // --- görünümler ---
  function grammarView(g) {
    const table = g.table?.length ? `<table class="forms">${g.table.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table>` : '';
    return `<section class="card lesson">
      <p class="kicker">Bugünün konusu</p>
      <h2 lang="en">${esc(g.topic)}</h2>
      ${g.explainTr.map(p => `<p>${esc(p)}</p>`).join('')}
      ${table}
      ${g.compareTr ? `<aside class="compare"><strong>Türkçede ve İngilizcede</strong><p>${esc(g.compareTr)}</p></aside>` : ''}
      <ul class="examples">${g.examples.map(x => `<li><button class="say" data-say="${esc(x.en)}" aria-label="Dinle">▶</button><span><span lang="en">${esc(x.en)}</span><small>${esc(x.tr)}</small></span></li>`).join('')}</ul>
      <button class="btn primary" data-act="next">Alıştırmalara geç</button></section>`;
  }

  function wordView(v) {
    const extra = [v.syn?.length ? `Eş anlamlısı: <span lang="en">${esc(v.syn.join(', '))}</span>` : '', v.ant?.length ? `Zıt anlamlısı: <span lang="en">${esc(v.ant.join(', '))}</span>` : ''].filter(Boolean).join('<br>');
    const known = store.get().cards[v.id];
    return `<section class="card word">
      ${known ? '<p class="kicker">Daha önce gördüğün kelime: hatırlıyor musun?</p>' : '<p class="kicker">Yeni kelime</p>'}
      <button class="say big" data-say="${esc(v.en)}" aria-label="Dinle">▶</button>
      <h2 lang="en">${esc(v.en)}</h2>
      <p class="tr">${esc(v.tr)}</p>
      <p class="ex"><button class="say" data-say="${esc(v.example)}" aria-label="Cümleyi dinle">▶</button><span><span lang="en">${esc(v.example)}</span><small>${esc(v.exampleTr)}</small></span></p>
      ${extra ? `<p class="muted">${extra}</p>` : ''}
      <button class="btn primary" data-act="next">Devam</button></section>`;
  }

  const textHtml = r => r.text.split(/\n\n+/).map(p => `<p lang="en">${esc(p)}</p>`).join('');

  function readingView(r) {
    return `<section class="card reading">
      <p class="kicker">Okuma</p><h2 lang="en">${esc(r.title)}</h2>
      <div class="passage">${textHtml(r)}</div>
      ${r.glossary?.length ? `<details class="gloss"><summary>Kelime yardımı</summary><ul>${r.glossary.map(x => `<li><span lang="en">${esc(x.en)}</span>: ${esc(x.tr)}</li>`).join('')}</ul></details>` : ''}
      <button class="btn primary" data-act="next">Sorulara geç</button></section>`;
  }

  function listeningView(l) {
    return `<section class="card listening">
      <p class="kicker">Dinleme</p><h2 lang="en">${esc(l.title)}</h2>
      <p>Önce metni görmeden dinle. İstersen iki kez dinleyebilirsin.</p>
      ${canSpeak() ? `<button class="btn lake" data-act="play">▶ Dinle</button>` : `<p class="warn">Bu cihazda ses çalışmıyor; metni okuyarak devam edebilirsin.</p>`}
      <details class="script" ${canSpeak() ? '' : 'open'}><summary>Metni göster</summary>${scriptHtml(l)}</details>
      <button class="btn primary" data-act="next">Sorulara geç</button></section>`;
  }

  const scriptHtml = l => `<dl lang="en">${l.script.map(x => `<dt>${esc(x.speaker)}</dt><dd>${esc(x.text)}</dd>`).join('')}</dl>`;

  function writingView(w, id) {
    const prev = store.get().writings[id]?.text || '';
    return `<section class="card writing">
      <p class="kicker">Yazma</p>
      <h2>${esc(w.promptTr)}</h2>
      ${w.promptEn ? `<p class="muted" lang="en">${esc(w.promptEn)}</p>` : ''}
      ${w.frames?.length ? `<p class="small">Başlangıç için dokun:</p><div class="chips">${w.frames.map(f => `<button class="chip" data-frame="${esc(f)}" lang="en">${esc(f)}</button>`).join('')}</div>` : ''}
      <textarea id="wtext" rows="7" lang="en" placeholder="Buraya İngilizce yaz…" autocapitalize="sentences">${esc(prev)}</textarea>
      <p class="small" id="wcount"></p>
      <div id="wmodel" hidden>
        ${w.model ? `<aside class="compare"><strong>Örnek cevap</strong><p lang="en">${esc(w.model)}</p></aside>` : ''}
        ${w.checklistTr?.length ? `<p><strong>Kendini kontrol et</strong></p><ul class="check">${w.checklistTr.map(c => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}
      </div>
      <button class="btn primary" data-act="wsave">Kaydet ve örneği gör</button></section>`;
  }

  function contextBlock(s) {
    if (!s.context) return '';
    if (s.context.kind === 'reading') return `<details class="ctx"><summary>Metni göster</summary><div class="passage">${textHtml(s.context.r)}</div></details>`;
    return `<div class="ctx-listen">${canSpeak() ? `<button class="btn ghost" data-act="play">▶ Tekrar dinle</button>` : ''}<details class="ctx"><summary>Metni göster</summary>${scriptHtml(s.context.l)}</details></div>`;
  }

  function itemView(s) {
    const it = s.item;
    const badge = s.review === 'mistake' ? '<p class="kicker">Daha önce yanlış yaptığın soru</p>' : s.review ? '<p class="kicker">Tekrar</p>' : s.exam ? '<p class="kicker">Sınav pratiği</p>' : '';
    const say = it.speak ? `<button class="say" data-say="${esc(it.speak)}" aria-label="Dinle">▶</button>` : '';
    let body = '';
    if (it.type === 'order') {
      body = `<p>${esc(it.promptTr || 'Cümleyi sırala:')}</p>
        <div class="order-line" id="oline" aria-live="polite"></div>
        <div class="chips" id="opool">${srs.shuffle(it.words).map(w => `<button class="chip" data-word="${esc(w)}" lang="en">${esc(w)}</button>`).join('')}</div>
        <button class="btn primary" data-act="ocheck" disabled>Kontrol et</button>`;
    } else if (it.type === 'fill') {
      body = `<p class="q" lang="en">${esc(it.q)}</p>${it.hintTr ? `<p class="muted">İpucu: ${esc(it.hintTr)}</p>` : ''}
        <input id="fin" type="text" lang="en" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Cevabın">
        <button class="btn primary" data-act="fcheck">Kontrol et</button>`;
    } else {
      s.perm ||= srs.shuffle(it.options.map((_, k) => k));
      body = `<p class="q" lang="en">${say}${esc(it.q)}</p>${it.sub ? `<p class="muted" lang="en">${esc(it.sub)}</p>` : ''}
        <div class="options">${s.perm.map((k, pos) => `<button class="opt" data-opt="${k}"><span class="letter">${LETTERS[pos]}</span><span>${esc(it.options[k])}</span></button>`).join('')}</div>`;
    }
    return `<section class="card item">${badge}${contextBlock(s)}${body}<div id="fb" aria-live="polite"></div></section>`;
  }

  function matchView(s) {
    const left = s.pairs.map((p, k) => ({ k, w: p.a }));
    const right = srs.shuffle(s.pairs.map((p, k) => ({ k, w: p.b })));
    return `<section class="card match">
      <p class="kicker">${s.kind === 'synonyms' ? 'Eş anlamlısını bul' : 'Zıt anlamlısını bul'}</p>
      <h2>${s.kind === 'synonyms' ? 'Aynı anlama gelen kelimeleri eşleştir' : 'Birbirinin tersi olan kelimeleri eşleştir'}</h2>
      <div class="match-grid"><div>${left.map(x => `<button class="chip m" data-side="l" data-k="${x.k}" lang="en">${esc(x.w)}</button>`).join('')}</div>
      <div>${right.map(x => `<button class="chip m" data-side="r" data-k="${x.k}" lang="en">${esc(x.w)}</button>`).join('')}</div></div>
      <div id="fb" aria-live="polite"></div></section>`;
  }

  function doneView() {
    const minutes = Math.min(Math.round((Date.now() - started) / 60000), 120);
    const isLesson = lesson && part;
    if (isLesson && !steps.saved) {
      steps.saved = true;
      store.addMinutes(minutes);
      const result = { correct: score.correct, total: score.total, minutes };
      if (lesson.kind === 'diagnostic') result.diag = { bySection: score.bySection, byLevel: score.byLevel };
      store.finishSession(lesson.id, part, result);
      if (lesson.kind === 'diagnostic' && part === 'evening') saveDiagnostic();
      if (lesson.kind === 'mock') {
        store.get().exams.push({ date: store.today(), kind: `deneme (${lesson.week}. hafta)`, week: lesson.week, correct: score.correct, total: score.total, bySection: score.bySection });
        store.save();
      }
      if (part === 'evening' && lesson.kind === 'lesson') {
        const ex = steps.filter(x => x.exam);
        store.get().exams.push({ date: store.today(), kind: 'günlük set', correct: ex.filter(x => x.ok).length, total: ex.length });
        store.save();
      }
    } else if (!isLesson && !steps.saved) {
      steps.saved = true;
      store.addMinutes(minutes);
    }
    const full = lesson && (part === 'evening' || lesson.kind === 'light' || lesson.kind === 'mock');
    const stage = full ? 2 : 1;
    if (lesson?.kind === 'mock') {
      const wrong = steps.filter(x => x.t === 'item' && x.test && !x.ok);
      const sec = { grammar: 'Dil bilgisi', vocab: 'Kelime', reading: 'Okuma', listening: 'Dinleme' };
      return `<section class="card done">
        <div class="done-rose">${rose(2, { size: 150, bloom: true, label: 'Gül' })}</div>
        <h2>Deneme sınavı bitti</h2>
        <p class="big-num">${score.correct}<small> / ${score.total} doğru</small></p>
        <p class="muted">${minutes} dakika. ${score.correct >= 46 ? 'B2 hedefinin içindesin.' : score.correct >= 39 ? 'ESL 400 bandındasın; 46 hedefine az kaldı.' : 'Her deneme bir sonraki için yol gösterir.'}</p>
        <ul class="meters">${Object.entries(score.bySection).map(([k, v]) => `<li><span>${sec[k] || k}</span><meter min="0" max="${v.t}" value="${v.c}"></meter><b>${v.c}/${v.t}</b></li>`).join('')}</ul>
      </section>
      ${wrong.length ? `<section class="card"><h2>Yanlış yaptığın sorular</h2><ol class="review-list">${wrong.map(x => `<li><p lang="en">${esc(x.item.q)}</p><p><strong>Doğru cevap:</strong> <span lang="en">${esc(x.item.options[x.item.answer])}</span></p>${x.item.whyTr ? `<p class="muted">${esc(x.item.whyTr)}</p>` : ''}</li>`).join('')}</ol></section>` : ''}
      <button class="btn primary" data-act="exit">Ana sayfaya dön</button>`;
    }
    const msg = !lesson ? 'Tekrar bitti. Kartların yeni tarihlerine yerleşti.'
      : lesson.kind === 'diagnostic' && part === 'evening' ? 'Test bitti. Sonucun Bahçem sayfasında.'
      : lesson.kind === 'diagnostic' ? 'Testin ilk bölümü bitti. İkinci bölüm akşam dersinde.'
      : full ? 'Bugünün gülü açtı.' : 'Sabah dersi bitti, gülün tomurcuklandı. Akşam dersinde açacak.';
    return `<section class="card done">
      <div class="done-rose">${rose(lesson ? stage : 2, { size: 150, bloom: true, label: 'Gül' })}</div>
      <h2>${msg}</h2>
      ${score.total && lesson?.kind !== 'diagnostic' ? `<p class="big-num">${score.correct}<small> / ${score.total} doğru</small></p>` : ''}
      <p class="muted">${minutes} dakika çalıştın.</p>
      <button class="btn primary" data-act="exit">Ana sayfaya dön</button></section>`;
  }

  function saveDiagnostic() {
    const s = store.get();
    const m = s.sessions['w01d1:morning']?.diag || { bySection: {}, byLevel: {} };
    const e = s.sessions['w01d1:evening']?.diag || { bySection: {}, byLevel: {} };
    const merge = (a, b) => { const o = JSON.parse(JSON.stringify(a)); for (const [k, v] of Object.entries(b)) { o[k] ||= { c: 0, t: 0 }; o[k].c += v.c; o[k].t += v.t; } return o; };
    const bySection = merge(m.bySection, e.bySection);
    const byLevel = merge(m.byLevel, e.byLevel);
    const r = k => (byLevel[k] ? byLevel[k].c / byLevel[k].t : 0);
    const level = r('B2') >= 0.6 && r('B1') >= 0.7 ? 'B2' : r('B1') >= 0.6 && r('A2') >= 0.7 ? 'B1' : r('A2') >= 0.6 ? 'A2' : 'A1';
    const correct = Object.values(bySection).reduce((a, v) => a + v.c, 0);
    const total = Object.values(bySection).reduce((a, v) => a + v.t, 0);
    s.diagnostic = { date: store.today(), bySection, byLevel, correct, total, level, writing: s.writings['w01d1']?.text || '' };
    s.exams.push({ date: store.today(), kind: 'seviye testi', correct, total });
    store.save();
  }

  // --- etkileşim ---
  function answered(s, ok, correctText) {
    const it = s.item;
    s.ok = ok;
    if (s.test) {
      const lvl = s.level || it.level || 'A2';
      score.byLevel[lvl] ||= { c: 0, t: 0 }; score.byLevel[lvl].t++; if (ok) score.byLevel[lvl].c++;
      score.bySection[s.section] ||= { c: 0, t: 0 }; score.bySection[s.section].t++; if (ok) score.bySection[s.section].c++;
    }
    score.total++; if (ok) score.correct++;
    if (s.review === 'card' || s.review === 'today') { if (s.review === 'card' || !ok) srs.grade(it.cardId, ok); }
    else if (s.review === 'mistake') srs.gradeMistake(s.key, ok);
    else if (!s.test) store.recordAnswer(it, ok);
    else if (lesson?.kind === 'mock') store.recordAnswer(it, ok); // denemede yanlışlar tekrar kuyruğuna girer
    else store.recordAnswer({ tag: it.tag }, ok); // seviye testinde yalnız etiket istatistiği
    if (!ok && (s.review === 'card' || s.review === 'today')) store.recordAnswer({ ...it, tag: 'vocab' }, false);

    const fb = root.querySelector('#fb');
    if (s.test) { setTimeout(next, 250); return; }
    fb.innerHTML = `<div class="feedback ${ok ? 'ok' : 'no'}">
      <strong>${ok ? 'Doğru' : 'Doğru cevap: ' + esc(correctText)}</strong>
      ${it.whyTr ? `<p>${esc(it.whyTr)}</p>` : ''}
      <button class="btn primary" data-act="next">Devam</button></div>`;
    fb.querySelector('[data-act=next]').focus();
  }

  function bind(s) {
    root.onclick = ev => {
      const b = ev.target.closest('button');
      if (!b) return;
      const act = b.dataset.act;
      if (b.dataset.say) return speak(b.dataset.say);
      if (act === 'exit') { stop(); return onExit(); }
      if (act === 'next') return next();
      if (act === 'play') {
        const l = s.l || s.context?.l;
        b.disabled = true;
        return speak(l.script, { onEnd: () => (b.disabled = false) });
      }
      if (b.dataset.opt !== undefined && s.t === 'item') {
        if (root.querySelector('.opt[aria-pressed]')) return;
        const k = +b.dataset.opt;
        b.setAttribute('aria-pressed', 'true');
        const ok = k === s.item.answer;
        root.querySelectorAll('.opt').forEach(o => {
          o.disabled = true;
          if (!s.test && +o.dataset.opt === s.item.answer) o.classList.add('right');
        });
        if (!ok && !s.test) b.classList.add('wrong');
        if (s.test) b.classList.add('picked');
        return answered(s, ok, s.item.options[s.item.answer]);
      }
      if (b.dataset.word !== undefined) {
        const line = root.querySelector('#oline');
        if (b.parentElement.id === 'opool') line.appendChild(b); else root.querySelector('#opool').appendChild(b);
        root.querySelector('[data-act=ocheck]').disabled = root.querySelector('#opool').children.length > 0;
        return;
      }
      if (act === 'ocheck') {
        const got = [...root.querySelectorAll('#oline .chip')].map(c => c.dataset.word).join(' ');
        b.disabled = true;
        root.querySelectorAll('.chip').forEach(c => (c.disabled = true));
        return answered(s, norm(got) === norm(s.item.answer), s.item.answer);
      }
      if (act === 'fcheck') {
        const v = root.querySelector('#fin').value;
        b.disabled = true;
        return answered(s, s.item.accept.some(a => norm(a) === norm(v)), s.item.accept[0]);
      }
      if (b.dataset.frame) {
        const ta = root.querySelector('#wtext');
        ta.value = (ta.value.trim() ? ta.value.trimEnd() + ' ' : '') + b.dataset.frame.replace(/\.\.\.|…/g, '').trimEnd() + ' ';
        ta.focus(); ta.dispatchEvent(new Event('input'));
        return;
      }
      if (act === 'wsave') {
        const text = root.querySelector('#wtext').value.trim();
        const st = store.get();
        st.writings[s.id] = { text, at: new Date().toISOString(), prompt: s.w.promptTr };
        store.save();
        root.querySelector('#wmodel').hidden = false;
        b.textContent = 'Devam';
        b.dataset.act = 'next';
        return;
      }
      if (b.dataset.side) return matchClick(s, b);
    };
    if (s.t === 'writing') {
      const ta = root.querySelector('#wtext');
      const upd = () => { const n = ta.value.trim().split(/\s+/).filter(Boolean).length; root.querySelector('#wcount').textContent = `${n} kelime${s.w.minWords ? ` (hedef ${s.w.minWords}+)` : ''}`; };
      ta.addEventListener('input', upd); upd();
    }
    if (s.t === 'item' && s.item.type === 'fill') {
      root.querySelector('#fin').addEventListener('keydown', e => { if (e.key === 'Enter') root.querySelector('[data-act=fcheck]').click(); });
    }
  }

  function matchClick(s, b) {
    if (b.classList.contains('done')) return;
    const sel = root.querySelector(`.chip.m.sel[data-side="${b.dataset.side}"]`);
    if (sel) sel.classList.remove('sel');
    b.classList.add('sel');
    const l = root.querySelector('.chip.m.sel[data-side="l"]');
    const r = root.querySelector('.chip.m.sel[data-side="r"]');
    if (!l || !r) return;
    const ok = l.dataset.k === r.dataset.k;
    score.total++;
    if (ok) {
      score.correct++;
      [l, r].forEach(x => { x.classList.remove('sel'); x.classList.add('done'); x.disabled = true; });
      if (root.querySelectorAll('.chip.m:not(.done)').length === 0) {
        root.querySelector('#fb').innerHTML = `<div class="feedback ok"><strong>Hepsini eşleştirdin</strong><button class="btn primary" data-act="next">Devam</button></div>`;
      }
    } else {
      [l, r].forEach(x => { x.classList.remove('sel'); x.classList.add('shake'); setTimeout(() => x.classList.remove('shake'), 400); });
      store.recordAnswer({ q: l.textContent, tag: s.kind === 'synonyms' ? 'synonym' : 'antonym' }, false);
    }
  }

  render();
}
