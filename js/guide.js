// Uygulama rehberi: ilk açılışta gösterilir, Ayarlar'dan ve ana sayfadan tekrar açılır.
import * as store from './store.js';
import { rose, petalIcon } from './rose.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function slides(program) {
  const s = store.get();
  const name = s.profile.name || 'Hafsa';
  const phases = program.phases;
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const firstTime = !s.diagnostic;
  return [
    {
      art: `<div class="g-art">${rose(2, { size: 132 })}</div>`,
      title: `Hoş geldin, ${esc(name)}`,
      body: `<p>Bu uygulama senin için hazırlandı. Amacı, 16 haftada İngilizceni adım adım ilerletmek ve WUST sınavında daha yüksek bir puan almanı sağlamak.</p>
        <p>Konuşma bölümü yok. Dil bilgisi, kelime, okuma, dinleme ve yazma var. Bütün açıklamalar Türkçe.</p>`,
    },
    {
      art: `<ol class="g-phases">${phases.map(p => `<li><span class="g-weeks">${p.from === p.to ? `${p.from}. hafta` : `${p.from}-${p.to}. hafta`}</span><strong>${esc(p.nameTr)}</strong></li>`).join('')}</ol>`,
      title: '16 haftalık plan',
      body: `<p>Her hafta bir öncekinin üstüne kurulur. İlk hafta kısa bir seviye testi ve tekrar var, sonra A2, B1 ve B2 konuları sırayla gelir.</p>
        <p>3, 5, 7, 9 ve 11. haftalarla son beş haftanın sonunda gerçek sınav gibi bir deneme sınavı var. Nerede olduğunu ve neyi tekrar etmen gerektiğini gösterir.</p>`,
    },
    {
      art: `<div class="g-day"><div class="g-sess">Sabah dersi<small>yaklaşık 1 saat</small></div><div class="g-sess evening">Akşam dersi<small>yaklaşık 1 saat</small></div></div>`,
      title: 'Bir günün nasıl geçer',
      body: `<ul class="g-list">
          <li><strong>Sabah:</strong> önceki kelimelerin tekrarı, günün dil bilgisi konusu, 15 yeni kelime ve kısa bir okuma.</li>
          <li><strong>Akşam:</strong> dinleme, kısa bir yazı ve sınav tipi sorular.</li>
        </ul>
        <p>Haftada 6 gün ders var. 7. gün ya hafif bir tekrar günü ya da deneme sınavı. Bir günü kaçırırsan bir şey olmaz; uygulama kaldığın yerden devam eder.</p>`,
    },
    {
      art: `<div class="g-roses"><figure>${rose(0, { size: 64 })}<figcaption>Başlamadın</figcaption></figure><figure>${rose(1, { size: 64 })}<figcaption>Sabah bitti</figcaption></figure><figure>${rose(2, { size: 64 })}<figcaption>Gün bitti</figcaption></figure></div>`,
      title: 'Gül bahçen',
      body: `<p>Her ders günü bir gül. Sabah dersiyle tomurcuklanır, akşam dersiyle açar.</p>
        <p><strong>Bahçem</strong> sekmesinde 16 haftanın bütün güllerini, kaç saat çalıştığını ve kaç kelime öğrendiğini görürsün.</p>`,
    },
    {
      art: `<div class="g-fab-demo"><span class="g-word">schedule</span><span class="tr-fab demo" aria-hidden="true">${petalIcon(16, '#fff')}<span>“schedule” çevir</span></span></div>`,
      title: 'Tekrar ve çevirmen',
      body: `<ul class="g-list">
          <li><strong>Tekrar:</strong> öğrendiğin kelimeler unutulmadan önce geri gelir. Yanlış yaptığın sorular da birkaç gün sonra tekrar sorulur.</li>
          <li><strong>Çevir düğmesi:</strong> bilmediğin bir kelimeye parmağını basılı tut. Kelime seçilince sağ alttaki <strong>Çevir</strong> düğmesine dokun. İstersen düğmeye dokunup kelimeyi kendin de yazabilirsin.</li>
        </ul>
        <p class="muted">Seviye testinde ve deneme sınavlarında çevirmen kapalıdır, çünkü orada gerçek seviyeni görmek istiyoruz.</p>`,
    },
    {
      art: `<div class="g-art">${rose(1, { size: 110 })}</div>`,
      title: 'Oğluna rapor',
      body: `<p><strong>Ayarlar</strong> sekmesinde <strong>Raporu aç</strong>, sonra <strong>Raporu paylaş</strong>: çalışma süren, başarın ve yazdıkların WhatsApp'tan oğluna gider.</p>
        <p>İlerlemen yalnız bu telefonda durur. Telefon değişirse kaybolmasın diye ara sıra raporu göndermen yeterli; rapor bir yedek kodu da taşır.</p>
        ${standalone ? '' : '<p class="g-tip">İpucu: Bu sayfayı telefonunun ana ekranına eklersen uygulama gibi açılır ve internetsiz de çalışır.</p>'}
        ${firstTime ? '<p>Hazırsan ilk gün kısa bir seviye testiyle başlıyoruz. Sınav değil; sadece nereden başlayacağımızı bulmak için.</p>' : ''}`,
      last: firstTime ? 'Başlayalım' : 'Rehberi kapat',
    },
  ];
}

export function renderGuide(root, program, onDone) {
  const list = slides(program);
  let i = 0;
  const finish = () => { store.get().profile.guideSeen = true; store.save(); root.onclick = null; onDone(); };

  function render(focus) {
    const s = list[i];
    const last = i === list.length - 1;
    root.innerHTML = `<div class="page guide">
      <header class="g-top">
        <span class="g-dots" aria-hidden="true">${list.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</span>
        ${last ? '' : '<button class="g-skip" data-g="skip">Rehberi geç</button>'}
      </header>
      <section class="g-slide" aria-roledescription="slayt" aria-label="${i + 1} / ${list.length}">
        ${s.art}
        <h1 tabindex="-1">${s.title}</h1>
        ${s.body}
      </section>
      <nav class="g-nav">
        ${i ? '<button class="btn ghost" data-g="prev">Geri</button>' : '<span></span>'}
        <button class="btn primary" data-g="next">${last ? s.last : 'İleri'}</button>
      </nav>
    </div>`;
    window.scrollTo(0, 0);
    if (focus) root.querySelector('h1').focus({ preventScroll: true });
  }

  root.onclick = e => {
    const b = e.target.closest('[data-g]');
    if (!b) return;
    const a = b.dataset.g;
    if (a === 'skip') return finish();
    if (a === 'prev' && i > 0) { i--; return render(true); }
    if (a === 'next') { if (i === list.length - 1) return finish(); i++; render(true); }
  };
  render(false);
}
