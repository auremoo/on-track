// Section « À venir » de l'accueil : tous les objectifs actifs mélangés, semaine par semaine.
// Deux affichages : liste des prochaines semaines, ou frise (charge par semaine + grille objectifs × semaines).

import { fmt, unitOf } from '../utils/plan.js';
import { addDays, formatRange, formatDateShort } from '../utils/dates.js';
import { esc, progressBar } from '../utils/ui.js';
import { kindIcon, slotsHtml, weekNotes } from './goal-ui.js';
import { loadChart } from './chart.js';

const MODE_KEY = 'ontrack_planning_mode';
const SHOWN_WEEKS = 4;   // semaines affichées dans la liste avant « Voir toutes les semaines »

export function getPlanningMode() {
  try { return localStorage.getItem(MODE_KEY) === 'grid' ? 'grid' : 'weeks'; } catch { return 'weeks'; }
}
export function setPlanningMode(m) {
  try { localStorage.setItem(MODE_KEY, m); } catch { /* navigation privée */ }
}

// summaries : objectifs actifs ; showAll : liste complète des semaines à venir
export function upcomingSection(summaries, cur, { showAll = false } = {}) {
  const planned = summaries.filter(s => s.weeks.length);
  if (!planned.length) return '';
  const mode = getPlanningMode();
  const all = [...new Set(planned.flatMap(s => s.weeks.map(w => w.monday)))].sort();
  const next = all.filter(m => m > cur);
  if (!next.length && mode === 'weeks') return '';
  const shown = showAll ? next : next.slice(0, SHOWN_WEEKS);

  return `
    <section class="upcoming">
      <div class="upcoming__head">
        <h2 class="section-header upcoming__title">À venir</h2>
        <div class="seg seg--inline">
          <button class="seg__btn ${mode === 'weeks' ? 'seg__btn--on' : ''}" data-mode="weeks">Liste</button>
          <button class="seg__btn ${mode === 'grid' ? 'seg__btn--on' : ''}" data-mode="grid">Frise</button>
        </div>
      </div>
      ${mode === 'grid' ? `
        <section class="card">
          <div class="card__heading-row">
            <h2 class="card__heading">Charge par semaine</h2>
            <span class="muted small">en séances, tous objectifs</span>
          </div>
          ${loadChart(planned, all, cur)}
        </section>
        ${grid(planned, all, cur)}` : `
        ${weekList(planned, shown, cur)}
        ${next.length > SHOWN_WEEKS ? `<button class="link-btn upcoming__more" data-more>${showAll ? 'Voir moins' : `Voir toutes les semaines (${next.length})`}</button>` : ''}`}
    </section>`;
}

// ── Liste : une carte par semaine, chaque objectif avec sa cible et ses séances ──

function weekList(summaries, mondays, cur) {
  return `<div class="planning-weeks">${mondays.map(m => {
    const rows = summaries.map(s => ({ s, w: s.weeks.find(w => w.monday === m) })).filter(x => x.w);
    const sessions = rows.reduce((a, { w }) => a + (w.off ? 0 : w.planned.length), 0);
    const label = m === addDays(cur, 7) ? 'Semaine prochaine' : '';
    return `
      <section class="card pweek">
        <header class="pweek__head">
          <div>
            <div class="pweek__title">${label || formatRange(m, addDays(m, 6))}</div>
            ${label ? `<div class="muted small">${formatRange(m, addDays(m, 6))}</div>` : ''}
          </div>
          <span class="muted small">${sessions} séance${sessions > 1 ? 's' : ''}</span>
        </header>
        <div class="pweek__rows">${rows.map(({ s, w }) => pweekRow(s, w)).join('')}</div>
      </section>`;
  }).join('')}</div>`;
}

function pweekRow(s, w) {
  const g = s.goal;
  const amount = w.off ? '<span class="muted">Off</span>'
    : w.target ? esc(fmt(w.target, g)) : '<span class="muted">Rien de prévu</span>';
  return `
    <div class="prow prow--${w.status}">
      <button class="prow__name link-like" data-nav="/goal/${g.id}">${kindIcon(g, 'sm')}<span>${esc(g.name)}</span></button>
      <div class="prow__amount">${amount}</div>
      ${!w.off ? `<div class="prow__slots">${slotsHtml(s, w, { small: true })}${weekNotes(w)}</div>` : ''}
    </div>`;
}

// ── Frise : objectifs en lignes, semaines en colonnes (passées comprises) ──

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
