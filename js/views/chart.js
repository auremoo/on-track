// Courbe cumulée d'un objectif (SVG) : rythme prévu au départ, réel, et suite du plan recalculé.

import { formatDateShort } from '../utils/dates.js';

const W = 600, H = 220, PAD = { l: 8, r: 8, t: 12, b: 22 };

export function burnupChart(s) {
  const n = s.weeks.length;
  if (!n || !s.amount) return '<p class="muted small">Pas de données.</p>';
  const x = i => PAD.l + (W - PAD.l - PAD.r) * i / n;
  const y = v => H - PAD.b - (H - PAD.t - PAD.b) * Math.min(v, s.amount) / s.amount;
  const pts = arr => arr.map(([i, v]) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');

  // Prévu au départ : cumul des cibles régulières
  let acc = 0;
  const ideal = [[0, 0], ...s.weeks.map((w, i) => [i + 1, (acc += w.ideal)])];

  // Réel : cumul fin de chaque semaine passée, puis position actuelle au milieu de la semaine en cours
  acc = 0;
  const real = [[0, 0]];
  let lastI = 0, lastV = 0;
  const past = i => s.phase === 'after' || (s.currentIndex >= 0 && i <= s.currentIndex);
  s.weeks.forEach((w, i) => {
    if (!past(i)) return;
    acc += w.done;
    lastI = w.status === 'current' ? i + 0.5 : i + 1;
    lastV = acc;
    real.push([lastI, acc]);
  });
  if (s.phase === 'after' && s.done > acc) { real.push([n, s.done]); lastI = n; lastV = s.done; }

  // Suite du plan recalculé
  const plan = [];
  if (s.phase !== 'after' && s.status !== 'done') {
    let v = s.phase === 'before' ? 0 : lastV;
    plan.push([s.phase === 'before' ? 0 : lastI, v]);
    s.weeks.forEach((w, i) => {
      if (w.status === 'current') { v += w.remaining; plan.push([i + 1, v]); }
      else if (!past(i)) { v += w.target; plan.push([i + 1, v]); }
    });
  }

  const offRects = s.weeks.map((w, i) => w.off
    ? `<rect x="${x(i)}" y="${PAD.t}" width="${x(i + 1) - x(i)}" height="${H - PAD.t - PAD.b}" class="chart__off"/>` : '').join('');
  const cur = s.currentIndex >= 0
    ? `<line x1="${x(s.currentIndex + 0.5)}" x2="${x(s.currentIndex + 0.5)}" y1="${PAD.t}" y2="${H - PAD.b}" class="chart__today"/>` : '';
  const step = Math.max(1, Math.ceil(n / 8));
  const labels = s.weeks.map((w, i) => i % step === 0
    ? `<text x="${x(i + 0.5)}" y="${H - 6}" class="chart__label">${formatDateShort(w.monday)}</text>` : '').join('');

  return `
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Avancement cumulé">
      ${offRects}
      <line x1="${PAD.l}" x2="${W - PAD.r}" y1="${y(s.amount)}" y2="${y(s.amount)}" class="chart__goal"/>
      <line x1="${PAD.l}" x2="${W - PAD.r}" y1="${y(0)}" y2="${y(0)}" class="chart__axis"/>
      ${cur}
      <polyline points="${pts(ideal)}" class="chart__ideal"/>
      ${plan.length > 1 ? `<polyline points="${pts(plan)}" class="chart__plan"/>` : ''}
      <polyline points="${pts(real)}" class="chart__real"/>
      ${real.length > 1 ? `<circle cx="${x(lastI)}" cy="${y(lastV)}" r="4.5" class="chart__dot"/>` : ''}
      ${labels}
    </svg>
    <div class="legend">
      <span><i class="legend__line legend__line--real"></i>Réel</span>
      <span><i class="legend__line legend__line--plan"></i>Plan recalculé</span>
      <span><i class="legend__line legend__line--ideal"></i>Prévu au départ</span>
    </div>`;
}
