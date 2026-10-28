// Accueil : la semaine en cours de tous les objectifs actifs, avec saisie rapide d'une séance.

import { getGoals, isActive, summaryOf } from '../store.js';
import { today, mondayOf, addDays, formatRange } from '../utils/dates.js';
import { esc } from '../utils/ui.js';
import { topbar, globalTabBar } from './chrome.js';
import { weekCard } from './goal-ui.js';
import { openLogSheet } from './log-sheet.js';

// Ordre d'affichage : ce qui reste à faire cette semaine d'abord, le reste ensuite.
const ORDER = { overdue: 0, late: 1, ontrack: 2, ahead: 3, before: 5, done: 6 };
const rank = s => (ORDER[s.status] ?? 4) + (s.current?.complete || s.current?.off ? 3.5 : 0);

export function mount(container) {
  container.innerHTML = `<div class="view"></div>`;
  const root = container.firstElementChild;
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-log]');
    if (b) openLogSheet(b.dataset.log, { onDone: () => render(root) });
  });
  render(root);
}

export function weekTotals(summaries) {
  let sessionsLeft = 0, weeksDone = 0, withTarget = 0;
  for (const s of summaries) {
    const w = s.current;
    if (!w || w.off || !w.target) continue;
    withTarget++;
    if (w.complete) weeksDone++;
    sessionsLeft += w.planned.length;
  }
  return { sessionsLeft, weeksDone, withTarget };
}

function render(root) {
  const cur = mondayOf(today());
  const summaries = getGoals().filter(isActive).map(g => summaryOf(g.id))
    .filter(s => s.status !== 'done' || s.finishedAt?.slice(0, 10) >= cur)
    .sort((a, b) => rank(a) - rank(b));
  const t = weekTotals(summaries);
  const late = summaries.filter(s => s.status === 'late' || s.status === 'overdue').length;

  root.innerHTML = `
    ${topbar({ title: 'Cette semaine', subtitle: formatRange(cur, addDays(cur, 6), true),
      actions: `<button class="btn btn--ghost btn--sm" data-nav="/new-goal">+ Objectif</button>` })}
    <main class="page">
      ${summaries.length ? `
        <div class="week-summary">
          <div class="week-summary__item"><strong>${t.sessionsLeft}</strong><span>séance${t.sessionsLeft > 1 ? 's' : ''} à faire</span></div>
          <div class="week-summary__item"><strong>${t.weeksDone}/${t.withTarget}</strong><span>objectif${t.withTarget > 1 ? 's' : ''} bouclé${t.withTarget > 1 ? 's' : ''}</span></div>
          <div class="week-summary__item ${late ? 'week-summary__item--bad' : ''}"><strong>${late}</strong><span>en retard</span></div>
        </div>
        <div class="home-grid">${summaries.map(s => weekCard(s)).join('')}</div>` : emptyState()}
    </main>
    ${globalTabBar('home')}`;
}

function emptyState() {
  const hasGoals = getGoals().length > 0;
  return `
    <div class="empty-state">
      <div class="empty-state__icon">🎯</div>
      <div class="empty-state__title">${hasGoals ? 'Rien en cours' : 'Aucun objectif'}</div>
      <div class="empty-state__body">Un livre à finir, une série, un cours… Donne un total et une échéance : l'app te dit quoi faire chaque semaine.</div>
      <button class="btn btn--primary" data-nav="/new-goal">${esc('Créer un objectif')}</button>
    </div>`;
}
