// Liste des objectifs : en cours, en pause, terminés / archivés.

import { getGoals, summaryOf } from '../store.js';
import { KINDS, fmt, positionLabel } from '../utils/plan.js';
import { formatDateShort } from '../utils/dates.js';
import { esc, progressBar, ICONS } from '../utils/ui.js';
import { topbar, globalTabBar } from './chrome.js';
import { statusPill, kindIcon } from './goal-ui.js';

export function mount(container) {
  const summaries = getGoals().map(g => summaryOf(g.id));
  const groups = [
    ['En cours', summaries.filter(s => (s.goal.status || 'active') === 'active' && s.status !== 'done')],
    ['En pause', summaries.filter(s => s.goal.status === 'paused')],
    ['Terminés', summaries.filter(s => s.goal.status === 'archived' || ((s.goal.status || 'active') === 'active' && s.status === 'done'))],
  ].filter(([, list]) => list.length);

  container.innerHTML = `
    <div class="view">
      ${topbar({ title: 'Objectifs', actions: `<button class="btn btn--ghost btn--sm" data-nav="/new-goal">+ Nouveau</button>` })}
      <main class="page">
        ${groups.map(([label, list]) => `
          <h2 class="section-header">${label}</h2>
          <div class="goal-grid">${list.map(card).join('')}</div>`).join('') || `
          <div class="empty-state">
            <div class="empty-state__icon empty-state__icon--svg">${ICONS.goals}</div>
            <div class="empty-state__title">Aucun objectif</div>
            <div class="empty-state__body">Livre, série, cours, révisions, écriture… tout ce qui se compte et a une échéance.</div>
            <button class="btn btn--primary" data-nav="/new-goal">Créer un objectif</button>
          </div>`}
      </main>
      ${globalTabBar('goals')}
    </div>`;
}

function card(s) {
  const g = s.goal;
  const S = g.sessionsPerWeek;
  return `
    <article class="card card--link goal-card goal-card--${g.status || 'active'}" data-nav="/goal/${g.id}">
      <div class="goal-card__head">
        <div class="goal-card__name">${kindIcon(g)}<span>${esc(g.name)}</span></div>
        ${g.status === 'paused' ? '<span class="pill pill--muted">En pause</span>' : g.status === 'archived' ? '<span class="pill pill--muted">Archivé</span>' : statusPill(s)}
      </div>
      <div class="goal-card__progress">${progressBar(s.pct)}<span class="small muted">${s.pct} %</span></div>
      <div class="goal-card__meta">
        <span>${esc(KINDS[g.kind]?.label || 'Autre')}</span>
        <span>${esc(positionLabel(g, s.position))} / ${esc(fmt(g.total, g))}</span>
        <span>Échéance ${formatDateShort(g.deadline)}</span>
        ${S ? `<span>${S} séance${S > 1 ? 's' : ''}/sem.</span>` : ''}
      </div>
    </article>`;
}
