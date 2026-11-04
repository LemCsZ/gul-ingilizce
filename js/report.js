// Oğul için ilerleme raporu ve yedek kodu.
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const TAG_TR = {
  'to-be': 'to be (am/is/are)', 'there-is': 'there is / are', articles: 'a / an / the', plural: 'çoğul', countable: 'sayılabilir / sayılamaz',
  possessive: 'iyelik (my, ’s)', pronouns: 'zamirler', 'prepositions-time': 'zaman edatları', 'prepositions-place': 'yer edatları',
  'word-order': 'kelime sırası', 'question-form': 'soru kurma', 'negative-form': 'olumsuz cümle', 'present-simple': 'Present Simple',
  'present-continuous': 'Present Continuous', 'past-simple': 'Past Simple', future: 'Future', 'present-perfect': 'Present Perfect',
  modals: 'can / must / should', imperatives: 'emir cümleleri', comparatives: 'karşılaştırma', linkers: 'bağlaçlar', vocab: 'kelime',
  synonym: 'eş anlamlılar', antonym: 'zıt anlamlılar', reading: 'okuma', listening: 'dinleme', spelling: 'yazım',
  'relative-clauses': 'sıfat cümlecikleri (who/which)', 'gerund-infinitive': '-ing / to fiil kalıpları', 'passive': 'edilgen yapı', 'conditionals': 'koşul cümleleri', 'reported-speech': 'dolaylı anlatım', 'phrasal-verbs': 'phrasal verb’ler', 'word-formation': 'kelime türetme', 'collocations': 'kelime kalıpları', 'past-continuous': 'Past Continuous', 'past-perfect': 'Past Perfect',
};
const SKILL = t => (t === 'reading' ? 'Okuma' : t === 'listening' ? 'Dinleme' : ['vocab', 'synonym', 'antonym', 'spelling', 'phrasal-verbs', 'word-formation', 'collocations'].includes(t) ? 'Kelime' : 'Dil bilgisi');

function last7(minutes) {
  const out = [];
  for (let k = 6; k >= 0; k--) {
    const d = new Date(); d.setDate(d.getDate() - k);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    out.push({ key, day: d.toLocaleDateString('tr-TR', { weekday: 'short' }), min: minutes[key] || 0 });
  }
  return out;
}

function summary(s) {
  const week = last7(s.minutes);
  const weekMin = week.reduce((a, d) => a + d.min, 0);
  const activeDays = week.filter(d => d.min >= 5).length;
  const skills = {};
  for (const [t, v] of Object.entries(s.tags)) {
    const k = SKILL(t);
    skills[k] ||= { right: 0, wrong: 0 };
    skills[k].right += v.right; skills[k].wrong += v.wrong;
  }
  const weak = Object.entries(s.tags)
    .filter(([, v]) => v.wrong >= 2)
    .sort((a, b) => b[1].wrong / (b[1].wrong + b[1].right) - a[1].wrong / (a[1].wrong + a[1].right))
    .slice(0, 5);
  const sessions = Object.keys(s.sessions).length;
  const words = Object.keys(s.cards).length;
  return { week, weekMin, activeDays, skills, weak, sessions, words };
}

export function renderReport(s) {
  const r = summary(s);
  const max = Math.max(60, ...r.week.map(d => d.min));
  const pct = v => (v.right + v.wrong ? Math.round((v.right / (v.right + v.wrong)) * 100) : null);
  const writings = Object.entries(s.writings).sort((a, b) => (b[1].at || '').localeCompare(a[1].at || '')).slice(0, 5);
  return `<header class="hello"><h1>${esc(s.profile.name)} için rapor</h1><p>Son 7 gün: ${Math.round(r.weekMin)} dakika, ${r.activeDays} gün çalıştı.</p></header>
  <section class="card"><h2>Son 7 gün</h2>
    <div class="bars">${r.week.map(d => `<div class="bar"><span style="height:${Math.round((d.min / max) * 100)}%"></span><small>${esc(d.day)}</small><b>${Math.round(d.min)}</b></div>`).join('')}</div>
  </section>
  <section class="stats"><div><strong>${r.sessions}</strong><span>ders bitti</span></div><div><strong>${r.words}</strong><span>kelime kartı</span></div><div><strong>${s.mistakes.length}</strong><span>bekleyen hata</span></div></section>
  <section class="card"><h2>Beceri bazında doğruluk</h2>
    ${Object.keys(r.skills).length ? `<ul class="meters">${Object.entries(r.skills).map(([k, v]) => `<li><span>${k}</span><meter min="0" max="100" value="${pct(v)}"></meter><b>%${pct(v)}</b></li>`).join('')}</ul>` : '<p class="muted">Henüz soru çözülmedi.</p>'}
  </section>
  <section class="card"><h2>En çok zorlandığı konular</h2>
    ${r.weak.length ? `<ol>${r.weak.map(([t, v]) => `<li>${esc(TAG_TR[t] || t)}: ${v.wrong} yanlış, ${v.right} doğru</li>`).join('')}</ol>` : '<p class="muted">Belirgin bir zorluk henüz yok.</p>'}
  </section>
  <section class="card"><h2>Sınav ve testler</h2>
    ${s.diagnostic ? `<p>Seviye testi: <strong>${s.diagnostic.level}</strong> (${s.diagnostic.correct}/${s.diagnostic.total}), ${esc(s.diagnostic.date)}</p>` : '<p class="muted">Seviye testi henüz yapılmadı.</p>'}
    ${s.exams.length ? `<ul>${s.exams.slice(-8).reverse().map(e => `<li>${esc(e.date)} ${esc(e.kind)}: ${e.correct}/${e.total}</li>`).join('')}</ul>` : ''}
  </section>
  <section class="card"><h2>Son yazdıkları</h2>
    ${writings.length ? writings.map(([id, w]) => `<article class="writing-entry"><p class="muted">${esc(w.prompt || id)}</p><p lang="en">${esc(w.text) || '<em>boş</em>'}</p></article>`).join('') : '<p class="muted">Henüz yazı yok.</p>'}
  </section>`;
}

export function reportText(s) {
  const r = summary(s);
  const lines = [`${s.profile.name} İngilizce raporu (${new Date().toLocaleDateString('tr-TR')})`,
    `Son 7 gün: ${Math.round(r.weekMin)} dk, ${r.activeDays} gün`, `Biten ders: ${r.sessions}, kelime kartı: ${r.words}`];
  for (const [k, v] of Object.entries(r.skills)) lines.push(`${k}: %${Math.round((v.right / Math.max(1, v.right + v.wrong)) * 100)} doğru`);
  if (s.diagnostic) lines.push(`Seviye testi: ${s.diagnostic.level} (${s.diagnostic.correct}/${s.diagnostic.total})`);
  if (r.weak.length) lines.push('Zorlandığı konular: ' + r.weak.map(([t]) => TAG_TR[t] || t).join(', '));
  return lines.join('\n');
}

export function exportCode() {
  const raw = localStorage.getItem('gul-ingilizce-v1') || '{}';
  return 'GUL1:' + btoa(unescape(encodeURIComponent(raw)));
}

export function importCode(code) {
  const body = code.replace(/^GUL1:/, '').replace(/\s+/g, '');
  const data = JSON.parse(decodeURIComponent(escape(atob(body))));
  if (!data || typeof data !== 'object' || !data.profile) throw new Error('bad');
  return data;
}
