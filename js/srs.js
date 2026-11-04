// Aralıklı tekrar: kutu sistemi. Kutu n -> sonraki tekrar INTERVALS[n] gün sonra.
import { get, save } from './store.js';

const DAY = 24 * 60 * 60 * 1000;
export const INTERVALS = [0, 1, 3, 7, 14, 30, 60];
export const DAILY_CAP = 120;

export function addCards(vocab) {
  const s = get();
  for (const v of vocab) {
    if (s.cards[v.id]) continue;
    s.cards[v.id] = {
      id: v.id, en: v.en, tr: v.tr, example: v.example, exampleTr: v.exampleTr,
      box: 1, due: Date.now() + DAY, right: 0, wrong: 0, added: Date.now(),
    };
  }
  save();
}

export function dueCards(limit = DAILY_CAP) {
  const now = endOfToday();
  return Object.values(get().cards)
    .filter(c => c.due <= now)
    .sort((a, b) => a.due - b.due)
    .slice(0, limit);
}

export function grade(id, ok) {
  const c = get().cards[id];
  if (!c) return;
  if (ok) {
    c.right++;
    c.box = Math.min(c.box + 1, INTERVALS.length - 1);
  } else {
    c.wrong++;
    c.box = 1;
  }
  c.due = startOfToday() + INTERVALS[c.box] * DAY;
  save();
}

export function dueMistakes(limit = 10) {
  const now = endOfToday();
  return get().mistakes.filter(m => m.due <= now).slice(0, limit);
}

export function gradeMistake(key, ok) {
  const s = get();
  const i = s.mistakes.findIndex(m => m.key === key);
  if (i < 0) return;
  if (ok) {
    const m = s.mistakes[i];
    m.streak = (m.streak || 0) + 1;
    if (m.streak >= 2) s.mistakes.splice(i, 1);
    else m.due = startOfToday() + 3 * DAY;
  } else {
    s.mistakes[i].streak = 0;
    s.mistakes[i].due = startOfToday() + DAY;
  }
  save();
}

// Bir karttan "anlamını seç" sorusu üretir.
export function cardToItem(card, pool) {
  const others = shuffle(pool.filter(c => c.id !== card.id && c.tr !== card.tr)).slice(0, 3);
  const enToTr = Math.random() < 0.5;
  const options = shuffle([card, ...others]);
  return {
    type: 'mcq',
    q: enToTr ? card.en : card.tr,
    sub: enToTr ? card.example : null,
    options: options.map(o => (enToTr ? o.tr : o.en)),
    answer: options.indexOf(card),
    whyTr: `${card.en} = ${card.tr}. ${card.example || ''}`,
    tag: 'vocab',
    cardId: card.id,
    speak: card.en,
  };
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }
function endOfToday() { return startOfToday() + DAY - 1; }
