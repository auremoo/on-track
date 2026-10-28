// Page d'un objectif : avancement, semaine en cours, courbe, plan semaine par semaine, historique.

import { getGoal, getSessions, summaryOf, updateGoal } from '../store.js';
import { fmt, positionLabel, KINDS, unitOf } from '../utils/plan.js';
import { formatRange, formatDate, formatDateShort, addDays, daysBetween } from '../utils/dates.js';
import { esc, progressBar, ICONS } from '../utils/ui.js';
import { showToast } from '../toast.js';
import { refreshSidebar } from '../app.js';
import { topbar } from './chrome.js';
import { weekCard, statusInfo, slotsHtml, weekNotes } from './goal-ui.js';
import { openLogSheet } from './log-sheet.js';
import { burnupChart } from './chart.js';

export function mount(container, id) {
  if (!getGoal(id)) { location.hash = '/goals'; return; }
  container.innerHTML = `<div class="view"></div>`;
  const root = container.firstElementChild;
  const rerender = () => render(root, id);

  root.addEventListener('click', async e => {
    const log = e.target.closest('[data-log]');
    if (log) { openLogSheet(id, { onDone: rerender }); return; }

    const edit = e.target.closest('[data-session]');
    if (edit) {
      const session = getSessions(id).find(x => x.id === edit.dataset.session);
      if (session) openLogSheet(id, { session, onDone: rerender });
      return;
    }

    const off = e.target.closest('[data-off]');
    if (off) {
      const goal = getGoal(id);
      const m = off.dataset.off;
      const set = new Set(goal.offWeeks || []);
      set.has(m) ? set.delete(m) : set.add(m);
      off.disabled = true;
      try {
        await updateGoal(id, { offWeeks: [...set].sort() });
        showToast(set.has(m) ? 'Semaine off : le plan est recalculé' : 'Semaine remise dans le plan', 'success');
      } catch (err) { showToast('Erreur : ' + err.message, 'error'); }
      refreshSidebar();
      rerender();
      return;
    }

  });
  rerender();
}

function render(root, id) {
  const s = summaryOf(id);
  const g = s.goal;
  const kind = KINDS[g.kind] || KINDS.custom;
  const info = statusInfo(s);
  const S = g.sessionsPerWeek;

  root.innerHTML = `
    ${topbar({
      title: g.name,
      subtitle: `${kind.label} · échéance ${formatDateShort(g.deadline)}${S ? ` · ${S} séance${S > 1 ? 's' : ''}/sem.` : ''}`,
      back: { label: 'Objectifs', path: '/goals' },
      actions: `<button class="icon-btn" data-nav="/goal/${id}/duplicate" aria-label="Dupliquer" title="Dupliquer (saison suivante, tome 2…)">${ICONS.copy}</button>
        <button class="icon-btn" data-nav="/goal/${id}/edit" aria-label="Modifier" title="Modifier">${ICONS.edit}</button>`,
    })}
    <main class="page">
      <section class="card goal-hero">
        <div class="goal-hero__top">
          <div>
            <div class="goal-hero__pos">${esc(positionLabel(g, s.position))} <span>/ ${esc(g.kind === 'book' ? `${g.total}` : fmt(g.total, g))}</span></div>
            <div class="muted small">${esc(info.detail)}</div>
          </div>
          <span class="pill pill--${info.cls}">${info.label}</span>
        </div>
        ${progressBar(s.pct)}
        ${s.status === 'overdue' ? `<button class="btn btn--ghost btn--sm goal-hero__extend" data-nav="/goal/${g.id}/edit">Repousser l'échéance</button>` : ''}
      </section>

      <div class="kpis">
        ${kpi('Fait', `${s.pct} %`, fmt(s.done, g))}
        ${kpi('Reste', s.remaining.toLocaleString('fr-FR'), unitOf(g).many)}
        ${kpi('Cible / semaine', currentWeekly(s), `au départ : ${s.idealWeekly}`)}
        ${s.status === 'done' ? kpi('Terminé le', s.finishedAt ? formatDateShort(s.finishedAt.slice(0, 10)) : '—', doneVsDeadline(s), 'ok')
          : kpi('Fin estimée', s.projection ? formatDateShort(s.projection.end) : '—',
              s.projection ? `au rythme de ${Math.round(s.projection.pace)}/sem.` : 'après 1 semaine complète',
              s.projection ? (s.projection.late ? 'warn' : 'ok') : '')}
      </div>

      ${s.status === 'done' ? bilan(s) : ''}

      <div class="goal-columns">
        <div class="goal-col">
          ${s.status !== 'done' ? weekCard(s, { withTitle: false }) : ''}
          <section class="card">
            <div class="card__heading-row">
              <h2 class="card__heading">Plan semaine par semaine</h2>
              <span class="muted small">${s.activeWeeks} semaine${s.activeWeeks > 1 ? 's' : ''}</span>
            </div>
            <div class="week-list">${s.weeks.map(w => weekRow(s, w)).join('')}</div>
            <p class="form-hint">Le retard et l'avance sont lissés sur toutes les semaines restantes. « Off » retire une semaine du plan (vacances…).</p>
          </section>
        </div>
        <div class="goal-col">
          <section class="card">
            <h2 class="card__heading">Courbe</h2>
            ${burnupChart(s)}
          </section>
          <section class="card">
            <div class="card__heading-row">
              <h2 class="card__heading">Séances</h2>
              <span class="muted small">${s.sessionCount}</span>
            </div>
            ${history(s)}
          </section>
        </div>
      </div>
    </main>`;
}

function kpi(label, value, sub, cls = '') {
  return `<div class="kpi ${cls ? 'kpi--' + cls : ''}"><div class="kpi__label">${label}</div><div class="kpi__value">${esc(value)}</div><div class="kpi__sub">${esc(sub)}</div></div>`;
}

function currentWeekly(s) {
  const w = s.current && !s.current.off ? s.current : s.weeks.find(x => x.status === 'future');
  return w ? String(w.target) : '—';
}

function doneVsDeadline(s) {
  if (!s.finishedAt) return '';
  const d = daysBetween(s.finishedAt.slice(0, 10), s.goal.deadline);
  return d > 0 ? `${d} j avant l'échéance` : d === 0 ? 'le jour de l\'échéance' : `${-d} j après l'échéance`;
}

function weekRow(s, w) {
  const g = s.goal;
  const range = formatRange(w.monday, addDays(w.monday, 6));
  const label = {
    ok: '✓', short: `−${w.target - w.done}`, current: 'En cours', future: '', off: 'Off',
  }[w.status];
  const canOff = (w.status === 'future' || w.status === 'current' || w.status === 'off') && !w.done && s.status !== 'done';
  return `
    <div class="week-row week-row--${w.status}">
      <div class="week-row__num">S${w.num}</div>
      <div class="week-row__body">
        <div class="week-row__top">
          <span class="week-row__dates">${range}</span>
          <span class="week-row__amount">${w.off ? '—' : w.status === 'future' ? (w.target ? fmt(w.target, g) : 'Rien de prévu') : `${w.done} / ${fmt(w.target, g)}`}</span>
        </div>
        ${!w.off && w.status !== 'future' && w.target ? progressBar(w.done / w.target * 100, 'bar--thin' + (w.status === 'short' ? ' bar--orange' : w.status === 'current' && !w.complete ? ' bar--blue' : '')) : ''}
        ${g.sessionsPerWeek || w.sessions.length ? slotsHtml(s, w, { small: true }) : ''}
        ${weekNotes(w)}
      </div>
      <div class="week-row__side">
        ${label ? `<span class="week-row__status">${label}</span>` : ''}
        ${canOff ? `<button class="chip chip--sm ${w.off ? 'chip--on' : ''}" data-off="${w.monday}">${w.off ? 'Reprendre' : 'Off'}</button>` : ''}
      </div>
    </div>`;
}

function history(s) {
  const g = s.goal;
  const list = getSessions(g.id).slice().sort((a, b) => (b.at || '').localeCompare(a.at || ''));
  if (!list.length) return '<p class="muted small">Aucune séance pour l\'instant.</p>';
  let pos = s.position;
  return `<div class="history">${list.map(x => {
    const row = `
      <button class="history__row" data-session="${x.id}">
        <div class="history__main">
          <span class="history__amount">+${fmt(x.amount, g)}</span>
          <span class="muted small">${esc(positionLabel(g, pos))}</span>
        </div>
        <div class="history__meta muted small">${x.at ? formatDate(x.at.slice(0, 10)) : ''}${x.note ? ` · ${esc(x.note)}` : ''}</div>
      </button>`;
    pos -= x.amount;
    return row;
  }).join('')}</div>`;
}

function bilan(s) {
  const g = s.goal;
  const used = s.weeks.filter(w => w.done > 0);
  const weeksUsed = used.length || 1;
  return `
    <section class="card bilan">
      <h2 class="card__heading">Bilan</h2>
      <dl class="facts">
        <dt>Durée</dt><dd>${weeksUsed} semaine${weeksUsed > 1 ? 's' : ''} actives sur ${s.activeWeeks} prévues</dd>
        <dt>Séances</dt><dd>${s.sessionCount} · en moyenne ${fmt(Math.round(s.done / Math.max(1, s.sessionCount)), g)} par séance</dd>
        <dt>Rythme</dt><dd>${fmt(Math.round(s.done / weeksUsed), g)} par semaine (prévu : ${fmt(s.idealWeekly, g)})</dd>
        <dt>Échéance</dt><dd>${doneVsDeadline(s) || '—'}</dd>
      </dl>
    </section>`;
}
