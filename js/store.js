// Tüm ilerleme cihazda (localStorage) tutulur.
const KEY = 'gul-ingilizce-v1';

const fresh = () => ({
  version: 1,
  profile: { name: 'Hafsa', startedAt: new Date().toISOString(), ttsRate: 0.85, bigText: false, pin: '' },
  diagnostic: null,          // { date, bySection, byLevel, total, correct, level, writing }
  sessions: {},              // "w01d2:morning" -> { doneAt, correct, total, minutes }
  writings: {},              // "w01d2" -> { text, at, note }
  cards: {},                 // SRS kartları: id -> { en, tr, example, exampleTr, box, due, right, wrong }
  mistakes: [],              // yanlış yapılan sorular: { item, at, due }
  tags: {},                  // hata etiketleri: tag -> { wrong, right }
  minutes: {},               // "YYYY-MM-DD" -> dakika
  exams: [],                 // { date, kind, correct, total }
});

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    return { ...fresh(), ...JSON.parse(raw) };
  } catch {
    return fresh();
  }
}

export function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function get() { return state; }

export function replace(next) {
  state = { ...fresh(), ...next };
  save();
}

export function reset() {
  state = fresh();
  save();
  clearResume();
}

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function addMinutes(min) {
  const k = today();
  state.minutes[k] = Math.round(((state.minutes[k] || 0) + min) * 10) / 10;
  save();
}

export function recordAnswer(item, ok) {
  const tag = item.tag || 'other';
  const t = (state.tags[tag] ||= { wrong: 0, right: 0 });
  ok ? t.right++ : t.wrong++;
  if (!ok && item.type && !item.cardId) {
    const key = JSON.stringify([item.q || item.answer, item.tag]);
    if (!state.mistakes.some(m => m.key === key)) {
      state.mistakes.push({ key, item, at: Date.now(), due: Date.now() });
      if (state.mistakes.length > 300) state.mistakes.splice(0, state.mistakes.length - 300); // en eskiler düşer
    }
  }
  save();
}

export function sessionDone(id, part) {
  return !!state.sessions[`${id}:${part}`]?.doneAt;
}

export function finishSession(id, part, result) {
  state.sessions[`${id}:${part}`] = { doneAt: new Date().toISOString(), ...result };
  save();
}

// Yarım kalan oturumlar (ayrı anahtarda; yedek koduna girmez). key "w05d2:morning" -> { i, steps, score, elapsed, at }
const RKEY = 'gul-ingilizce-resume';
const readResume = () => { try { return JSON.parse(localStorage.getItem(RKEY)) || {}; } catch { return {}; } };
export function getResume(key) {
  const r = readResume()[key];
  return r && Date.now() - r.at < 7 * 864e5 ? r : null;
}
export function setResume(key, rec) {
  const all = readResume();
  all[key] = { ...rec, at: Date.now() };
  const keep = Object.entries(all).sort((a, b) => b[1].at - a[1].at).slice(0, 3); // en yeni 3 oturum
  try { localStorage.setItem(RKEY, JSON.stringify(Object.fromEntries(keep))); } catch { /* yer yoksa sessizce geç */ }
}
export function clearResume(key) {
  const all = readResume();
  if (key) delete all[key]; else for (const k in all) delete all[k];
  localStorage.setItem(RKEY, JSON.stringify(all));
}
