// Planning : tous les objectifs actifs mélangés, semaine par semaine (liste) ou en frise (grille).

import { getGoals, isActive, summaryOf } from '../store.js';
import { fmt, unitOf } from '../utils/plan.js';
import { today, mondayOf, addDays, formatRange, formatDateShort } from '../utils/dates.js';
import { esc, progressBar, ICONS } from '../utils/ui.js';
import { topbar, globalTabBar } from './chrome.js';
import { kindIcon, slotsHtml, weekNotes } from './goal-ui.js';
import { openLogSheet } from './log-sheet.js';
import { loadChart } from './chart.js';

const MODE_KEY = 'ontrack_planning_mode';
let showPast = false;

function getMode() {
  try { return localStorage.getItem(MODE_KEY) || 'weeks'; } catch { return 'weeks'; }
}
function setMode(m) {
  try { localStorage.setItem(MODE_KEY, m); } catch { /* navigation privée */ }
}

export function mount(container) {
  container.innerHTML = `<div class="view"></div>`;
  const root = container.firstElementChild;
  root.addEventListener('click', e => {
    const mode = e.target.closest('[data-mode]');
    if (mode) { setMode(mode.dataset.mode); render(root); return; }
    if (e.target.closest('[data-past]')) { showPast = !showPast; render(root); return; }
    const log = e.target.closest('[data-log]');
    if (log) openLogSheet(log.dataset.log, { onDone: () => render(root) });
  });
  render(root);
}

function render(root) {
  const cur = mondayOf(today());
  const summaries = getGoals().filter(isActive).map(g => summaryOf(g.id)).filter(s => s.weeks.length);
  const mode = getMode();

  // Toutes les semaines couvertes par au moins un plan
  const all = [...new Set(summaries.flatMap(s => s.weeks.map(w => w.monday)))].sort();
  const mondays = mode === 'weeks' && !showPast ? all.filter(m => m >= cur) : all;

  root.innerHTML = `
    ${topbar({ title: 'Planning', subtitle: 'Tous les objectifs, semaine par semaine' })}
    <main class="page">
      ${summaries.length ? `
        <div class="planning-toolbar">
          <div class="seg seg--inline">
            <button class="seg__btn ${mode === 'weeks' ? 'seg__btn--on' : ''}" data-mode="weeks">Semaines</button>
            <button class="seg__btn ${mode === 'grid' ? 'seg__btn--on' : ''}" data-mode="grid">Frise</button>
          </div>
          ${mode === 'weeks' && all.some(m => m < cur) ? `<button class="link-btn" data-past>${showPast ? 'Masquer' : 'Afficher'} les semaines passées</button>` : ''}
        </div>
        <section class="card">
          <div class="card__heading-row">
            <h2 class="card__heading">Charge par semaine</h2>
            <span class="muted small">en séances, tous objectifs</span>
          </div>
          ${loadChart(summaries, all, cur)}
        </section>
        ${mode === 'grid' ? grid(summaries, all, cur) : weekList(summaries, mondays, cur)}` : `
        <div class="empty-state">
          <div class="empty-state__icon empty-state__icon--svg">${ICONS.calendar}</div>
          <div class="empty-state__title">Rien de planifié</div>
          <div class="empty-state__body">Le planning réunit les plans de tous tes objectifs actifs.</div>
          <button class="btn btn--primary" data-nav="/new-goal">Créer un objectif</button>
        </div>`}
    </main>
    ${globalTabBar('planning')}`;

  // Frise : amener la semaine en cours en vue
  root.querySelector('.pgrid__col--current')?.scrollIntoView({ block: 'nearest', inline: 'center' });
}

// ── Liste : une carte par semaine, chaque objectif avec sa cible et ses séances ──

function weekList(summaries, mondays, cur) {
  return `<div class="planning-weeks">${mondays.map(m => {
    const rows = summaries.map(s => ({ s, w: s.weeks.find(w => w.monday === m) })).filter(x => x.w);
    const sessions = rows.reduce((a, { s, w }) => a + (w.off ? 0 : w.status === 'future' || w.status === 'current' ? w.planned.length : 0), 0);
    const doneSessions = rows.reduce((a, { w }) => a + w.sessions.length, 0);
    const label = m === cur ? 'Cette semaine' : m === addDays(cur, 7) ? 'Semaine prochaine' : '';
    return `
      <section class="card pweek ${m === cur ? 'pweek--current' : ''} ${m < cur ? 'pweek--past' : ''}">
        <header class="pweek__head">
          <div>
            <div class="pweek__title">${label || formatRange(m, addDays(m, 6))}</div>
            ${label ? `<div class="muted small">${formatRange(m, addDays(m, 6))}</div>` : ''}
          </div>
          <span class="muted small">${m < cur ? `${doneSessions} séance${doneSessions > 1 ? 's' : ''} faite${doneSessions > 1 ? 's' : ''}`
            : `${sessions} séance${sessions > 1 ? 's' : ''}${m === cur && doneSessions ? ` à faire · ${doneSessions} faite${doneSessions > 1 ? 's' : ''}` : ''}`}</span>
        </header>
        <div class="pweek__rows">${rows.map(({ s, w }) => pweekRow(s, w)).join('')}</div>
      </section>`;
  }).join('')}</div>`;
}

function pweekRow(s, w) {
  const g = s.goal;
  let amount;
  if (w.off) amount = '<span class="muted">Off</span>';
  else if (w.status === 'future') amount = w.target ? esc(fmt(w.target, g)) : '<span class="muted">Rien de prévu</span>';
  else amount = `${w.done} / ${esc(fmt(w.target, g))}${w.complete ? ' ✓' : ''}`;
  return `
    <div class="prow prow--${w.status}">
      <button class="prow__name link-like" data-nav="/goal/${g.id}">${kindIcon(g, 'sm')}<span>${esc(g.name)}</span></button>
      <div class="prow__amount">${amount}</div>
      ${!w.off ? `<div class="prow__slots">${slotsHtml(s, w, { small: true })}${weekNotes(w)}</div>` : ''}
      ${w.status === 'current' && !w.complete && s.status !== 'done' ? `<button class="chip chip--sm prow__log" data-log="${g.id}">+ Séance</button>` : ''}
    </div>`;
}

// ── Frise : objectifs en lignes, semaines en colonnes ──

function grid(summaries, mondays, cur) {
  const totals = mondays.map(m => summaries.reduce((a, s) => {
    const w = s.weeks.find(x => x.monday === m);
    if (!w || w.off) return a;
    return a + (m < cur ? w.sessions.length : Math.max(w.planned.length + (m === cur ? w.sessions.length : 0), 0));
  }, 0));
  return `
    <div class="pgrid-wrap card">
      <table class="pgrid">
        <thead>
          <tr>
            <th class="pgrid__goal"></th>
            ${mondays.map(m => `<th class="pgrid__col ${m === cur ? 'pgrid__col--current' : ''}">${formatDateShort(m)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${summaries.map(s => `
            <tr>
              <th class="pgrid__goal"><button class="link-like pgrid__name" data-nav="/goal/${s.goal.id}">${kindIcon(s.goal, 'sm')}<span>${esc(s.goal.name)}</span></button>
                <div class="pgrid__unit">${esc(unitOf(s.goal).many)}</div></th>
              ${mondays.map(m => cell(s, s.weeks.find(w => w.monday === m), m === cur)).join('')}
            </tr>`).join('')}
        </tbody>
        <tfoot>
          <tr>
            <th class="pgrid__goal">Séances</th>
            ${totals.map((t, i) => `<td class="pgrid__total ${mondays[i] === cur ? 'pgrid__col--current' : ''}">${t || ''}</td>`).join('')}
          </tr>
        </tfoot>
      </table>
    </div>
    <div class="legend legend--wrap">
      <span><i class="dot dot--done"></i>Cible atteinte</span>
      <span><i class="dot dot--skipped"></i>Pas atteinte (lissée ensuite)</span>
      <span><i class="dot" style="background:var(--ios-blue)"></i>Cette semaine</span>
      <span><i class="dot dot--todo"></i>À venir</span>
    </div>`;
}

function cell(s, w, isCur) {
  if (!w) return `<td class="pgrid__cell pgrid__cell--none ${isCur ? 'pgrid__col--current' : ''}"></td>`;
  if (w.off) return `<td class="pgrid__cell pgrid__cell--off ${isCur ? 'pgrid__col--current' : ''}" title="Semaine off">off</td>`;
  const pct = w.target ? Math.min(100, w.done / w.target * 100) : 0;
  const value = w.status === 'future' ? (w.target || '–') : `${w.done}<span>/${w.target}</span>`;
  return `
    <td class="pgrid__cell pgrid__cell--${w.status} ${w.complete ? 'pgrid__cell--complete' : ''} ${isCur ? 'pgrid__col--current' : ''}"
        title="${esc(`${s.goal.name} · ${formatRange(w.monday, addDays(w.monday, 6))} : ${w.done} / ${fmt(w.target, s.goal)}`)}">
      <div class="pgrid__value">${value}</div>
      ${w.status !== 'future' && w.target ? progressBar(pct, 'bar--thin') : ''}
    </td>`;
}
