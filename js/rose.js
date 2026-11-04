// Isparta gülü (Rosa damascena) çizimi. stage: 0 = fidan, 1 = tomurcuk (sabah bitti), 2 = açmış gül (gün bitti)
const PETAL = 'M0 0 C -13 -5 -15 -24 0 -29 C 15 -24 13 -5 0 0 Z';

function ring(n, r, scale, rot, fill, cx, cy) {
  let out = '';
  for (let i = 0; i < n; i++) {
    const a = rot + (360 / n) * i;
    out += `<path d="${PETAL}" fill="${fill}" stroke="rgba(90,10,40,.18)" stroke-width=".8"
      transform="translate(${cx} ${cy}) rotate(${a}) translate(0 ${-r}) scale(${scale})"/>`;
  }
  return out;
}

export function rose(stage = 2, { size = 64, bloom = false, label = '' } = {}) {
  const cx = 50, cy = 42;
  const stem = `
    <path d="M50 ${stage === 0 ? 70 : 52} C 48 80 53 98 50 118" stroke="#3F6B4F" stroke-width="3.2" fill="none" stroke-linecap="round"/>
    <path d="M50 92 C 38 84 28 88 24 96 C 34 100 44 98 50 92 Z" fill="#4F7F5E"/>
    <path d="M51 104 C 62 96 72 99 76 106 C 66 111 57 110 51 104 Z" fill="#3F6B4F"/>`;

  let head = '';
  if (stage === 0) {
    head = `
      <ellipse cx="50" cy="66" rx="5" ry="7" fill="#6E9B72"/>
      <path d="M45 70 C 46 62 50 58 50 58 C 50 58 54 62 55 70 Z" fill="#4F7F5E"/>`;
  } else if (stage === 1) {
    head = `
      <path d="M50 22 C 36 32 36 50 50 56 C 64 50 64 32 50 22 Z" fill="#C94A71"/>
      <path d="M50 26 C 42 34 43 48 50 52 C 46 44 46 34 50 26 Z" fill="#E37C9A"/>
      <path d="M38 52 C 42 46 46 50 50 56 C 54 50 58 46 62 52 C 58 60 42 60 38 52 Z" fill="#4F7F5E"/>`;
  } else {
    head = `
      <g class="${bloom ? 'rose-bloom' : ''}" style="transform-origin:${cx}px ${cy}px">
        ${ring(6, 6, 1.05, 0, '#EFA3B8', cx, cy)}
        ${ring(6, 4, 0.82, 30, '#E37C9A', cx, cy)}
        ${ring(5, 2, 0.6, 12, '#C94A71', cx, cy)}
        ${ring(4, 1, 0.38, 45, '#A8204A', cx, cy)}
        <path d="M${cx - 3} ${cy} q 3 -5 6 0 q -3 4 -6 0" fill="none" stroke="#7A1235" stroke-width="1.4" stroke-linecap="round"/>
      </g>`;
  }

  return `<svg class="rose" viewBox="0 0 100 120" width="${size}" height="${size * 1.2}" role="img" aria-label="${label}">${stem}${head}</svg>`;
}

// Tek gül yaprağı (dekor ve ikonlar için)
export const petalIcon = (size = 18, fill = '#C94A71') =>
  `<svg viewBox="-16 -31 32 33" width="${size}" height="${size}" aria-hidden="true"><path d="${PETAL}" fill="${fill}"/></svg>`;
