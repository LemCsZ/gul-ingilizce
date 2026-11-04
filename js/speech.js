// Tarayıcının metin okuma özelliğiyle İngilizce seslendirme.
import { get } from './store.js';

let voices = [];
function loadVoices() {
  voices = speechSynthesis.getVoices().filter(v => v.lang && v.lang.toLowerCase().startsWith('en'));
}
if ('speechSynthesis' in window) {
  loadVoices();
  speechSynthesis.onvoiceschanged = loadVoices;
}

export const canSpeak = () => 'speechSynthesis' in window;

function pickVoices() {
  const us = voices.filter(v => v.lang.toLowerCase().includes('us'));
  const list = us.length ? us : voices;
  return [list[0], list[1] || list[0]];
}

export function stop() {
  if (canSpeak()) speechSynthesis.cancel();
}

// lines: [{speaker, text}] ya da tek metin. İki konuşmacıya farklı ses verilir.
export function speak(lines, { onEnd, rate } = {}) {
  if (!canSpeak()) { onEnd?.(); return; }
  stop();
  const arr = typeof lines === 'string' ? [{ speaker: 'A', text: lines }] : lines;
  const speakers = [...new Set(arr.map(l => l.speaker))];
  const [v1, v2] = pickVoices();
  const r = rate || get().profile.ttsRate || 0.85;
  arr.forEach((l, i) => {
    const u = new SpeechSynthesisUtterance(l.text);
    u.lang = 'en-US';
    u.rate = r;
    const second = speakers.indexOf(l.speaker) % 2 === 1;
    const v = second ? v2 : v1;
    if (v) u.voice = v;
    if (second) u.pitch = v1 === v2 ? 0.8 : 1;
    if (i === arr.length - 1) u.onend = () => onEnd?.();
    speechSynthesis.speak(u);
  });
}
