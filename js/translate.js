// Çevirmen: seçilen ya da yazılan kelimeyi çevirir.
// Önce ders sözlüğüne bakar (internetsiz çalışır); bulamazsa ücretsiz MyMemory servisine sorar.
// Seviye testinde ve deneme sınavlarında gizlidir (body.exam).
import { speak, stop, canSpeak } from './speech.js';
import { petalIcon } from './rose.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TR_CHARS = /[çğıöşüÇĞİÖŞÜ]/;
const MAX = 400;

// ---------- sözlük ----------
let dict = null, reverse = null;
const clean = s => String(s || '').replace(/[“”"«»()[\]{}]/g, ' ').replace(/[’‘`]/g, "'").replace(/\s+/g, ' ').trim();
const normEn = s => clean(s).toLowerCase().replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, '');
const normTr = s => clean(s).replace(/\([^)]*\)/g, ' ').toLocaleLowerCase('tr').replace(/[.,!?;:]/g, ' ').replace(/\s+/g, ' ').trim();

async function loadDict() {
  if (dict) return;
  try { dict = await (await fetch('content/dict.json')).json(); } catch { dict = {}; return; }
  reverse = {};
  for (const [en, [tr]] of Object.entries(dict)) {
    for (const part of tr.split(/[,;/]| ya da | veya /)) {
      const k = normTr(part);
      if (k) (reverse[k] ||= []).includes(en) || reverse[k].push(en);
    }
  }
}

const IRR = {
  went: 'go', gone: 'go', was: 'be', were: 'be', been: 'be', is: 'be', are: 'be', am: 'be', did: 'do', done: 'do', does: 'do',
  had: 'have', has: 'have', saw: 'see', seen: 'see', made: 'make', took: 'take', taken: 'take', came: 'come', got: 'get',
  gotten: 'get', gave: 'give', given: 'give', found: 'find', told: 'tell', said: 'say', thought: 'think', bought: 'buy',
  brought: 'bring', taught: 'teach', wrote: 'write', written: 'write', spoke: 'speak', spoken: 'speak', began: 'begin',
  begun: 'begin', left: 'leave', felt: 'feel', kept: 'keep', met: 'meet', paid: 'pay', sent: 'send', spent: 'spend',
  understood: 'understand', knew: 'know', known: 'know', ate: 'eat', eaten: 'eat', drank: 'drink', drove: 'drive',
  driven: 'drive', ran: 'run', sat: 'sit', stood: 'stand', slept: 'sleep', woke: 'wake', wore: 'wear', worn: 'wear',
  chose: 'choose', chosen: 'choose', forgot: 'forget', forgotten: 'forget', lost: 'lose', heard: 'hear', held: 'hold',
  led: 'lead', built: 'build', caught: 'catch', fell: 'fall', fallen: 'fall', grew: 'grow', grown: 'grow', became: 'become',
  broke: 'break', broken: 'break', children: 'child', people: 'person', men: 'man', women: 'woman', feet: 'foot',
  teeth: 'tooth', better: 'good', best: 'good', worse: 'bad', worst: 'bad', lives: 'life', wives: 'wife', knives: 'knife',
};
const RULES = [[/'s$/, ''], [/ies$/, 'y'], [/ied$/, 'y'], [/ier$/, 'y'], [/iest$/, 'y'], [/ily$/, 'y'], [/es$/, ''], [/s$/, ''],
  [/ed$/, ''], [/ed$/, 'e'], [/ing$/, ''], [/ing$/, 'e'], [/er$/, ''], [/er$/, 'e'], [/est$/, ''], [/est$/, 'e'], [/ly$/, '']];

function lemmas(w) {
  const out = new Set([w]);
  if (IRR[w]) out.add(IRR[w]);
  for (const [re, rep] of RULES) {
    if (!re.test(w)) continue;
    const b = w.replace(re, rep);
    if (b.length > 1) out.add(b);
    if (/([bdgklmnprt])\1$/.test(b)) out.add(b.slice(0, -1)); // stopped -> stop, running -> run
  }
  return [...out];
}

function lookupEn(text) {
  let k = normEn(text).replace(/^(to|a|an|the) /, '');
  if (!k || k.split(' ').length > 5) return null;
  if (dict[k]) return { key: k, entry: dict[k] };
  if (!k.includes(' ')) for (const l of lemmas(k)) if (dict[l]) return { key: l, entry: dict[l], from: k };
  return null;
}

// ---------- internetten çeviri ----------
async function online(text, from, to) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`, { signal: ctl.signal });
    const j = await r.json();
    const out = j?.responseData?.translatedText;
    if (j.responseStatus != 200 || !out || /MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(out)) return null;
    return out;
  } catch { return null; } finally { clearTimeout(t); }
}

async function translate(raw) {
  const text = clean(raw).slice(0, MAX);
  await loadDict();
  const looksTr = TR_CHARS.test(text);
  if (!looksTr) {
    const hit = lookupEn(text);
    if (hit) return { kind: 'dict-en', text, ...hit };
  }
  const rk = normTr(text);
  if (reverse[rk]) return { kind: 'dict-tr', text, list: reverse[rk].slice(0, 3) };
  let [from, to] = looksTr || !/[a-z]/i.test(text) ? ['tr', 'en'] : ['en', 'tr'];
  let out = await online(text, from, to);
  // Türkçe harfi olmayan Türkçe kelime ("kitap") İngilizce sanılırsa çeviri aynı döner: tersini dene
  if (out && from === 'en' && normTr(out) === normTr(text)) {
    const back = await online(text, 'tr', 'en');
    if (back && normTr(back) !== normTr(text)) [out, from, to] = [back, 'tr', 'en'];
  }
  return out ? { kind: 'online', text, out, from, to } : { kind: 'none', text, from, to };
}

// ---------- arayüz ----------
let fab, sheet, lastSel = { text: '', at: 0 }, resetTimer;
const say = t => canSpeak() ? `<button type="button" class="say" data-trsay="${esc(t)}" aria-label="Dinle">▶</button>` : '';
const short = t => (t.length > 18 ? t.slice(0, 17) + '…' : t);

function selText() {
  const s = window.getSelection?.();
  if (!s || s.isCollapsed) return '';
  const n = s.anchorNode?.nodeType === 1 ? s.anchorNode : s.anchorNode?.parentElement;
  if (!n || (sheet && sheet.contains(n)) || n.closest?.('input, textarea')) return '';
  return s.toString().trim();
}

function setLabel(text) {
  fab.querySelector('.tr-lbl').textContent = text ? `“${short(text)}” çevir` : 'Çevir';
  fab.classList.toggle('has-sel', !!text);
  fab.setAttribute('aria-label', text ? `${text} kelimesini çevir` : 'Çevirmeni aç');
}

function onSelection() {
  const t = selText();
  clearTimeout(resetTimer);
  if (t && t.length <= MAX) { lastSel = { text: t, at: Date.now() }; setLabel(t); }
  else resetTimer = setTimeout(() => setLabel(''), 4000);
}

const pending = () => selText() || (Date.now() - lastSel.at < 5000 ? lastSel.text : '');

function result(r) {
  const gt = `https://translate.google.com/?sl=${r.from || (r.kind === 'dict-tr' ? 'tr' : 'en')}&tl=${r.to || (r.kind === 'dict-tr' ? 'en' : 'tr')}&text=${encodeURIComponent(r.text)}&op=translate`;
  const more = `<a class="tr-more" href="${gt}" target="_blank" rel="noopener">Google Çeviri'de aç</a>`;
  if (r.kind === 'dict-en') {
    const [tr, ex, exTr] = r.entry;
    return `<div class="tr-hit"><p class="tr-word">${say(r.key)}<span lang="en">${esc(r.key)}</span></p>
      ${r.from && r.from !== r.key ? `<p class="small">“${esc(r.from)}” kelimesinin yalın hali</p>` : ''}
      <p class="tr-mean">${esc(tr)}</p>
      ${ex ? `<p class="ex">${say(ex)}<span><span lang="en">${esc(ex)}</span><small>${esc(exTr)}</small></span></p>` : ''}
      <p class="tr-note">Ders sözlüğünden</p></div>${more}`;
  }
  if (r.kind === 'dict-tr') {
    return `<div class="tr-hit"><p class="small">“${esc(r.text)}” İngilizcede:</p>
      ${r.list.map(en => `<p class="tr-word">${say(en)}<span lang="en">${esc(en)}</span></p><p class="small tr-gloss">${esc(dict[en][0])}</p>`).join('')}
      <p class="tr-note">Ders sözlüğünden</p></div>${more}`;
  }
  if (r.kind === 'online') {
    const en = r.from === 'en' ? r.text : r.out;
    return `<div class="tr-hit"><p class="tr-word small" ${r.from === 'en' ? 'lang="en"' : ''}>${r.from === 'en' ? say(en) : ''}${esc(r.text)}</p>
      <p class="tr-mean" ${r.to === 'en' ? 'lang="en"' : ''}>${r.to === 'en' ? say(en) : ''}${esc(r.out)}</p>
      <p class="tr-note">İnternetten otomatik çeviri; küçük hatalar olabilir.</p></div>${more}`;
  }
  return `<div class="tr-hit"><p>Bu kelime ders sözlüğünde yok, internetten de çeviri alınamadı. İnternet bağlantını kontrol edip tekrar dene.</p></div>${more}`;
}

async function run(text) {
  const out = sheet.querySelector('.tr-out');
  if (!clean(text)) { out.innerHTML = ''; return; }
  sheet.querySelector('#trIn').value = clean(text).slice(0, MAX);
  out.innerHTML = '<p class="muted">Çevriliyor…</p>';
  const r = await translate(text);
  out.innerHTML = result(r);
}

function build() {
  sheet = document.createElement('div');
  sheet.className = 'tr-sheet';
  sheet.hidden = true;
  sheet.innerHTML = `<div class="tr-backdrop" data-trclose></div>
    <section class="tr-panel" role="dialog" aria-modal="true" aria-labelledby="trTitle">
      <header class="tr-head"><h2 id="trTitle" tabindex="-1">Çevirmen</h2><button type="button" class="icon-btn" data-trclose aria-label="Çevirmeni kapat">✕</button></header>
      <form class="tr-form" autocomplete="off">
        <label for="trIn">İngilizce ya da Türkçe bir kelime yaz</label>
        <div class="tr-row"><input id="trIn" maxlength="${MAX}" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go" placeholder="örneğin: schedule">
        <button class="btn primary" type="submit">Çevir</button></div>
      </form>
      <div class="tr-out" aria-live="polite"></div>
      <p class="tr-tip small">Ders metninde bir kelimeye parmağını basılı tut. Kelime seçilince alttaki düğmeye dokun, anlamı burada çıkar.</p>
    </section>`;
  document.body.append(sheet);
  sheet.addEventListener('click', e => {
    if (e.target.closest('[data-trclose]')) return close();
    const b = e.target.closest('[data-trsay]');
    if (b) speak(b.dataset.trsay);
  });
  sheet.querySelector('form').addEventListener('submit', e => { e.preventDefault(); const v = sheet.querySelector('#trIn').value; sheet.querySelector('#trIn').blur(); run(v); });
  sheet.addEventListener('keydown', e => {
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') { // odak panelin içinde kalsın
      const f = [...sheet.querySelectorAll('button, input, a[href]')].filter(x => x.offsetParent);
      const [first, last] = [f[0], f[f.length - 1]];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
}

export function openTranslator(text = '') {
  if (!sheet) build();
  sheet.hidden = false;
  document.body.classList.add('tr-open');
  window.getSelection?.()?.removeAllRanges();
  setLabel('');
  if (text) { run(text); sheet.querySelector('#trTitle').focus(); }
  else { sheet.querySelector('#trIn').value = ''; sheet.querySelector('.tr-out').innerHTML = ''; sheet.querySelector('#trIn').focus(); }
}

function close() {
  if (!sheet || sheet.hidden) return;
  stop();
  sheet.hidden = true;
  document.body.classList.remove('tr-open');
  fab.focus({ preventScroll: true });
}

export function initTranslator() {
  fab = document.createElement('button');
  fab.type = 'button';
  fab.className = 'tr-fab';
  fab.innerHTML = `${petalIcon(16, '#fff')}<span class="tr-lbl">Çevir</span>`;
  fab.setAttribute('aria-label', 'Çevirmeni aç');
  let grabbed = '';
  fab.addEventListener('pointerdown', () => { grabbed = pending(); }); // dokunma seçimi silmeden önce yakala
  fab.addEventListener('click', () => { const t = grabbed || pending(); grabbed = ''; lastSel = { text: '', at: 0 }; openTranslator(t); });
  document.body.append(fab);
  document.addEventListener('selectionchange', onSelection);
  window.addEventListener('hashchange', close);
  loadDict();
}
