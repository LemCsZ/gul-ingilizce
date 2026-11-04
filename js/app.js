import * as store from './store.js';
import * as srs from './srs.js';
import { rose, petalIcon } from './rose.js';
import { buildSession, buildPractice, play } from './player.js';
import { renderReport, reportText, exportCode, importCode } from './report.js';
import { initTranslator } from './translate.js';
import { renderGuide } from './guide.js';

const app = document.getElementById('app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cache = {};
const json = async p => (cache[p] ||= fetch(`content/${p}`).then(r => { if (!r.ok) throw new Error(p); return r.json(); }));

let program;

function applyPrefs() {
  document.documentElement.classList.toggle('big-text', !!store.get().profile.bigText);
}

const skippedWeek = w => (store.get().skipped || []).includes(w);

function stageOf(l) {
  if (!l) return 0;
  if (skippedWeek(l.week)) return 2;
  if (l.kind === 'light') return store.sessionDone(l.id, 'light') ? 2 : 0;
  if (l.kind === 'mock') return store.sessionDone(l.id, 'exam') ? 2 : 0;
  const m = store.sessionDone(l.id, 'morning'), e = store.sessionDone(l.id, 'evening');
  return m && e ? 2 : m || e ? 1 : 0;
}

function currentLesson() {
  return program.lessons.find(l => stageOf(l) < 2) || null;
}

function greeting() {
  const h = new Date().getHours();
  return h < 11 ? 'Günaydın' : h < 18 ? 'İyi günler' : 'İyi akşamlar';
}

function nav(active) {
  const items = [['', 'Bugün'], ['tekrar', 'Tekrar'], ['bahce', 'Bahçem'], ['ayarlar', 'Ayarlar']];
  return `<nav class="tabbar">${items.map(([h, t]) => `<a href="#/${h}" class="${active === h ? 'on' : ''}" ${active === h ? 'aria-current="page"' : ''}>${petalIcon(16, active === h ? '#A8204A' : '#D9A3B3')}<span>${t}</span></a>`).join('')}</nav>`;
}

function weekRow(week, cur) {
  const lessons = program.lessons.filter(l => l.week === week);
  return `<ol class="week-row" aria-label="${week}. hafta">${[1, 2, 3, 4, 5, 6, 7].map(d => {
    const l = lessons.find(x => x.day === d);
    const st = stageOf(l);
    const isCur = cur && l && l.id === cur.id;
    return `<li class="${isCur ? 'cur' : ''} ${l && skippedWeek(l.week) ? 'skipped' : ''}">${rose(st, { size: 34, label: `${d}. gün` })}<span>${d}</span></li>`;
  }).join('')}</ol>`;
}

// Seviye testi B1 ve üstü çıkarsa 2. ve 3. haftayı atlama önerisi
function fastPath() {
  const s = store.get();
  const d = s.diagnostic;
  if (!d || !['B1', 'B2'].includes(d.level) || s.fastPathAnswered) return '';
  return `<section class="card fast"><h2>Hızlı yol</h2>
    <p>Seviye testine göre temel konuları biliyorsun. 2. ve 3. haftayı atlayıp 4. haftadan devam edebilirsin; böylece programı iki hafta erken bitirirsin.</p>
    <button class="btn primary" id="fastYes">2. ve 3. haftayı atla</button>
    <button class="btn ghost" id="fastNo">Hepsini yapmak istiyorum</button></section>`;
}

function bindFastPath() {
  const yes = app.querySelector('#fastYes'), no = app.querySelector('#fastNo');
  if (!yes) return;
  yes.onclick = () => { const s = store.get(); s.skipped = [2, 3]; s.fastPathAnswered = true; store.save(); home(); };
  no.onclick = () => { store.get().fastPathAnswered = true; store.save(); home(); };
}

// ---------- Görünümler ----------

function home() {
  const s = store.get();
  const cur = currentLesson();
  const mins = s.minutes[store.today()] || 0;
  const due = srs.dueCards().length;
  let todayHtml;
  if (!cur) {
    todayHtml = `<section class="today"><div class="today-rose">${rose(2, { size: 120 })}</div>
      <h2>Bu haftanın bütün gülleri açtı</h2><p>Yeni dersler hazırlanıyor. Bu arada tekrar kartlarını çalışabilirsin.</p>
      <a class="btn primary" href="#/tekrar">Tekrara git</a></section>`;
  } else {
    const st = stageOf(cur);
    const mDone = store.sessionDone(cur.id, 'morning'), eDone = store.sessionDone(cur.id, 'evening');
    const parts = cur.kind === 'light'
      ? `<a class="session-btn" href="#/ders/${cur.id}/light"><strong>Hafif gün</strong><span>20-30 dakika: tekrar ve kelime oyunu</span></a>`
      : cur.kind === 'mock'
      ? `<a class="session-btn" href="#/ders/${cur.id}/exam"><strong>Deneme sınavı</strong><span>50 soru ve kısa yazı, gerçek sınav gibi · ~60 dk</span></a>`
      : `<a class="session-btn ${mDone ? 'done' : ''}" href="#/ders/${cur.id}/morning"><strong>${mDone ? '✓ ' : ''}Sabah dersi</strong><span>${cur.kind === 'diagnostic' ? 'Dil bilgisi ve kelime, ~30 dk' : 'Tekrar, dil bilgisi, yeni kelimeler, okuma · 60 dk'}</span></a>
         <a class="session-btn evening ${eDone ? 'done' : ''}" href="#/ders/${cur.id}/evening"><strong>${eDone ? '✓ ' : ''}Akşam dersi</strong><span>${cur.kind === 'diagnostic' ? 'Okuma, dinleme ve yazma, ~30 dk' : 'Dinleme, yazma, sınav pratiği · 60 dk'}</span></a>`;
    todayHtml = `<section class="today">
      <div class="today-rose">${rose(st, { size: 120, label: 'Bugünün gülü' })}</div>
      <p class="when">${cur.week}. hafta, ${cur.day}. gün</p>
      <h2>${esc(cur.titleTr)}</h2>
      <div class="sessions">${parts}</div></section>`;
  }
  app.innerHTML = `<div class="page home">
    <header class="hello"><h1>${greeting()}, ${esc(s.profile.name)}</h1>
      <p>${mins ? `Bugün ${Math.round(mins)} dakika çalıştın.` : 'Bugünkü dersin seni bekliyor.'}${due ? ` ${due} tekrar kartın var.` : ''}</p></header>
    ${todayHtml}
    ${fastPath()}
    <section class="this-week"><h3>Bu hafta</h3>${weekRow(cur ? cur.week : 1, cur)}</section>
    <p class="guide-link"><a href="#/rehber">Uygulama nasıl çalışır?</a></p>
  </div>${nav('')}`;
  bindFastPath();
}

function practice() {
  const due = srs.dueCards().length;
  const mistakes = store.get().mistakes.length;
  const total = Object.keys(store.get().cards).length;
  app.innerHTML = `<div class="page">
    <header class="hello"><h1>Tekrar</h1><p>Kelimeler unutulmadan önce geri gelir. Bildiğin kart daha seyrek, zorlandığın kart daha sık gelir.</p></header>
    <section class="card">
      <h2>${due ? `${due} kart bugün tekrar bekliyor` : 'Bugün bekleyen kart yok'}</h2>
      <p class="muted">Toplam ${total} kelime kartın, ${mistakes} tekrar edilecek sorun var.</p>
      ${due || mistakes ? `<a class="btn primary" href="#/calis/review">Tekrara başla</a>` : ''}
    </section>
    <section class="card">
      <h2>Eş ve zıt anlam oyunu</h2>
      <p class="muted">Beş kelimeyi eşiyle ya da tersiyle eşleştir.</p>
      <a class="btn lake" href="#/calis/match">Oyunu aç</a>
    </section></div>${nav('tekrar')}`;
}

function garden() {
  const s = store.get();
  const cur = currentLesson();
  const totalMin = Object.values(s.minutes).reduce((a, b) => a + b, 0);
  const words = Object.keys(s.cards).length;
  const learned = Object.values(s.cards).filter(c => c.box >= 3).length;
  const weeks = Array.from({ length: program.weeks }, (_, k) => k + 1);
  const phase = w => program.phases.find(p => w >= p.from && w <= p.to)?.nameTr || '';
  const d = s.diagnostic;
  app.innerHTML = `<div class="page">
    <header class="hello"><h1>Gül bahçem</h1><p>Her ders günü bir gül. Sabah dersiyle tomurcuklanır, akşam dersiyle açar.</p></header>
    <section class="stats">
      <div><strong>${Math.round(totalMin / 60 * 10) / 10}</strong><span>saat çalıştın</span></div>
      <div><strong>${words}</strong><span>kelime kartı</span></div>
      <div><strong>${learned}</strong><span>kelime oturdu</span></div>
    </section>
    ${d ? `<section class="card"><h2>Seviye testi sonucu</h2><p class="big-num">${d.level}</p><p class="muted">${d.correct}/${d.total} doğru, ${d.date}. Bu bir tahmin; dersler ilerledikçe güncellenir.</p></section>` : ''}
    <section class="garden">${weeks.map(w => `<div class="garden-week"><h3>${w}. hafta <small>${phase(w)}</small></h3>${weekRow(w, cur)}</div>`).join('')}</section>
  </div>${nav('bahce')}`;
}

function settings() {
  const p = store.get().profile;
  app.innerHTML = `<div class="page">
    <header class="hello"><h1>Ayarlar</h1></header>
    <section class="card form">
      <label>Adın<input id="name" value="${esc(p.name)}"></label>
      <label>Konuşma hızı
        <select id="rate"><option value="0.7" ${p.ttsRate == 0.7 ? 'selected' : ''}>Yavaş</option><option value="0.85" ${p.ttsRate == 0.85 ? 'selected' : ''}>Biraz yavaş</option><option value="1" ${p.ttsRate == 1 ? 'selected' : ''}>Normal</option></select></label>
      <label class="row"><input type="checkbox" id="big" ${p.bigText ? 'checked' : ''}> Daha büyük yazı</label>
      <button class="btn primary" id="saveSet">Kaydet</button>
    </section>
    <section class="card">
      <h2>Oğlum için rapor</h2>
      <p class="muted">Çalışma süresini, başarıyı ve yazdıklarını gösterir. Paylaş düğmesiyle WhatsApp'tan gönderebilirsin.</p>
      <a class="btn lake" href="#/rapor">Raporu aç</a>
    </section>
    <section class="card">
      <h2>Rehber</h2>
      <p class="muted">Çalışma planını ve uygulamanın nasıl kullanıldığını kısaca anlatır.</p>
      <a class="btn ghost" href="#/rehber">Rehberi aç</a>
    </section>
    <section class="card">
      <h2>Yedek</h2>
      <p class="muted">Telefon değiştirirsen ilerlemen kaybolmasın diye yedek kodunu sakla.</p>
      <button class="btn ghost" id="exp">Yedek kodunu kopyala</button>
      <details><summary>Yedekten geri yükle</summary><textarea id="imp" rows="3" placeholder="Yedek kodunu buraya yapıştır"></textarea><button class="btn ghost" id="impBtn">Geri yükle</button></details>
      <p id="msg" class="small" aria-live="polite"></p>
    </section>
    ${(store.get().skipped || []).length ? `<section class="card"><h2>Atlanan haftalar</h2><p class="muted">${store.get().skipped.join('. ve ')}. haftayı atladın.</p><button class="btn ghost" id="unskip">Atlanan haftaları geri aç</button></section>` : ''}
    </div>${nav('ayarlar')}`;
  const un = app.querySelector('#unskip');
  if (un) un.onclick = () => { store.get().skipped = []; store.save(); settings(); };
  const msg = t => (app.querySelector('#msg').textContent = t);
  app.querySelector('#saveSet').onclick = () => {
    p.name = app.querySelector('#name').value.trim() || 'Hafsa';
    p.ttsRate = +app.querySelector('#rate').value;
    p.bigText = app.querySelector('#big').checked;
    store.save(); applyPrefs(); settings();
  };
  app.querySelector('#exp').onclick = async () => {
    try { await navigator.clipboard.writeText(exportCode()); msg('Yedek kodu kopyalandı.'); }
    catch { msg('Kopyalanamadı. Raporu aç sayfasındaki kodu elle seçip kopyalayabilirsin.'); }
  };
  app.querySelector('#impBtn').onclick = () => {
    const code = app.querySelector('#imp').value.trim();
    if (!code) return msg('Önce yedek kodunu yapıştır.');
    if (!confirm('Bu cihazdaki ilerleme yedekteki ile değişecek. Devam edilsin mi?')) return;
    try { store.replace(importCode(code)); msg('Yedek geri yüklendi.'); }
    catch { msg('Bu kod okunamadı. Kodun tamamını kopyaladığından emin ol.'); }
  };
}

function report() {
  app.innerHTML = `<div class="page">${renderReport(store.get())}
    <section class="card"><button class="btn primary" id="share">Raporu paylaş</button><p id="msg" class="small" aria-live="polite"></p>
    <details><summary>Başka bir cihazdan gelen raporu aç</summary><textarea id="code" rows="3" placeholder="Yedek kodunu yapıştır"></textarea><button class="btn ghost" id="view">Raporu göster</button></details></section>
  </div>${nav('ayarlar')}`;
  app.querySelector('#share').onclick = async () => {
    const text = reportText(store.get());
    const full = `${text}\n\nYedek kodu (uygulamada "Başka bir cihazdan gelen raporu aç" kısmına yapıştır):\n${exportCode()}`;
    try {
      if (navigator.share) await navigator.share({ title: 'İngilizce çalışma raporu', text: full });
      else { await navigator.clipboard.writeText(full); app.querySelector('#msg').textContent = 'Rapor kopyalandı; mesaja yapıştırabilirsin.'; }
    } catch { /* paylaşım iptal edildi */ }
  };
  app.querySelector('#view').onclick = () => {
    try {
      const other = importCode(app.querySelector('#code').value.trim());
      app.querySelector('.page').innerHTML = renderReport(other) + `<p><a class="btn ghost" href="#/rapor">Kendi raporuma dön</a></p>`;
    } catch { app.querySelector('#msg').textContent = 'Bu kod okunamadı.'; }
  };
}

async function lessonView(id, part) {
  const lesson = program.lessons.find(l => l.id === id);
  if (!lesson) return (location.hash = '#/');
  app.innerHTML = `<div class="page loading">${rose(1, { size: 80 })}<p>Ders hazırlanıyor…</p></div>`;
  try {
    let data = null, extra = {};
    if (lesson.kind === 'diagnostic') data = await json('diagnostic.json');
    else if (lesson.kind === 'lesson' || lesson.kind === 'mock') data = await json(lesson.file);
    if (lesson.kind === 'light') extra.synant = await json('synant.json');
    const steps = buildSession(lesson, part, data, extra);
    document.body.classList.toggle('exam', lesson.kind === 'mock' || lesson.kind === 'diagnostic'); // sınavda çevirmen kapalı
    play(app, { steps, lesson, part, onExit: () => (location.hash = '#/') });
  } catch (e) {
    app.innerHTML = `<div class="page"><section class="card"><h2>Bu ders açılamadı</h2><p>İnternet bağlantını kontrol edip tekrar dene.</p><a class="btn primary" href="#/">Ana sayfa</a></section></div>`;
  }
}

async function practiceView(kind) {
  const extra = kind === 'match' ? { synant: await json('synant.json') } : {};
  play(app, { steps: buildPractice(kind, extra), onExit: () => (location.hash = '#/tekrar') });
}

// ---------- Yönlendirme ----------

async function route() {
  const [, a, b, c] = (location.hash || '#/').split('/');
  window.scrollTo(0, 0);
  app.onclick = null;
  document.body.classList.remove('exam', 'guide-on');
  if (a === 'rehber') { document.body.classList.add('guide-on'); return renderGuide(app, program, () => (location.hash = '#/')); }
  if (a === 'ders') return lessonView(b, c);
  if (a === 'calis') return practiceView(b);
  if (a === 'tekrar') return practice();
  if (a === 'bahce') return garden();
  if (a === 'ayarlar') return settings();
  if (a === 'rapor') return report();
  return home();
}

async function start() {
  applyPrefs();
  program = await json('program.json');
  window.addEventListener('hashchange', route);
  initTranslator();
  if (!store.get().profile.guideSeen && !location.hash.startsWith('#/rehber')) location.hash = '#/rehber';
  else route();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

start();
