// Composants partagés : statut d'un objectif, pastilles de séances, carte « semaine en cours ».

import { fmt, positionLabel } from '../utils/plan.js';
import { formatRange, formatDateShort, addDays } from '../utils/dates.js';
import { esc, progressBar, ICONS, KIND_ICONS } from '../utils/ui.js';

// Pastille ronde avec l'icône du type d'objectif ; size : 'sm' (listes) ou 'md' (cartes)
export const kindIcon = (goal, size = 'md') =>
  `<span class="kind-icon kind-icon--${size}" aria-hidden="true">${KIND_ICONS[goal.kind] || KIND_ICONS.custom}</span>`;

// { cls, label, detail } — cls : classe de pastille (ok / warn / bad / muted / accent)
export function statusInfo(s) {
  const g = s.goal;
  switch (s.status) {
    case 'done':    return { cls: 'ok', label: 'Terminé', detail: 'Objectif atteint' };
    case 'before':  return { cls: 'muted', label: 'À venir', detail: `Démarre le lundi ${formatDateShort(s.weeks[0]?.monday)}` };
    case 'ahead':   return { cls: 'accent', label: 'En avance', detail: `${fmt(s.gap, g)} d'avance sur le rythme prévu` };
    case 'late':    return { cls: s.gap > s.idealWeekly ? 'bad' : 'warn', label: 'En retard', detail: `${fmt(s.gap, g)} de retard, lissé sur les semaines restantes` };
    case 'overdue': return { cls: 'bad', label: 'Échéance dépassée', detail: `Reste ${fmt(s.remaining, g)}` };
    default:        return { cls: 'ok', label: 'Dans les temps', detail: 'Tu suis le rythme prévu' };
  }
}

export function statusPill(s) {
  const i = statusInfo(s);
  return `<span class="pill pill--${i.cls}">${i.label}</span>`;
}

// Pastilles d'une semaine : séances faites (vertes), prévues (vides), rattrapage (orange),
// séances prévues devenues inutiles car la cible est atteinte (grisées).
// Semaine en cours : toucher un rond prévu = séance faite comme prévu ; toucher un rond vert
// = corriger la séance (voir quick-log.js).
export function slotsHtml(s, w, { small = false } = {}) {
  if (!w) return '';
  const g = s.goal;
  const S = g.sessionsPerWeek || 0;
  const tappable = w.status === 'current' && s.status !== 'done';
  const done = w.sessions.map(x => `
    <button type="button" class="slot slot--done ${x.note ? 'slot--noted' : ''}" data-edit-session="${x.id}" data-goal="${g.id}"
            title="${esc(`${fmt(x.amount, g)}${x.note ? ` · ${x.note}` : ''} — toucher pour corriger`)}">${x.amount}</button>`);
  const planned = w.planned.map(n => tappable ? `
    <button type="button" class="slot slot--tap ${w.catchUp ? 'slot--catchup' : 'slot--todo'}" data-quick="${g.id}" data-amount="${n}"
            title="${esc(`${w.catchUp ? 'Rattrapage' : 'Séance'} de ${fmt(n, g)} — toucher quand c'est fait`)}">${n}</button>`
    : `<span class="slot ${w.catchUp ? 'slot--catchup' : 'slot--todo'}">${n}</span>`);
  const spare = (w.complete || (w.status !== 'future' && !w.planned.length)) && S > w.sessions.length && w.status === 'current'
    ? Array.from({ length: S - w.sessions.length }, () => '<span class="slot slot--spare" title="Facultative : cible atteinte">–</span>')
    : [];
  const html = [...done, ...planned, ...spare].join('');
  return html ? `<div class="slots ${small ? 'slots--sm' : ''} ${tappable ? 'slots--current' : ''}">${html}</div>` : '';
}

// Phrase principale de la semaine en cours
export function weekHeadline(s) {
  const g = s.goal, w = s.current;
  if (s.status === 'done') return `Objectif atteint : ${positionLabel(g, s.position)}`;
  if (s.phase === 'before') return `Démarre le lundi ${formatDateShort(s.weeks[0].monday)} · ${fmt(s.weeks[0].target, g)} la 1re semaine`;
  if (s.phase === 'after' || !w) return `Échéance dépassée · reste ${fmt(s.remaining, g)}`;
  if (w.off) return 'Semaine off';
  if (w.complete) return `Semaine bouclée ✓ ${w.done} / ${fmt(w.target, g)}`;
  const S = g.sessionsPerWeek;
  if (w.catchUp) return `Séances prévues faites · rattrapage : ${fmt(w.remaining, g)}`;
  if (S) {
    const left = w.planned.length;
    return `Reste ${fmt(w.remaining, g)} en ${left} séance${left > 1 ? 's' : ''}`;
  }
  return `Reste ${fmt(w.remaining, g)} cette semaine`;
}

export function nextLine(s) {
  const w = s.current;
  if (!w || w.off || !w.planned.length || s.status === 'done') return '';
  const n = w.planned[0];
  const target = s.position + n;
  const pos = s.goal.kind === 'book' || (s.goal.kind === 'series' && s.goal.seasons?.length)
    ? ` → jusqu'à ${positionLabel(s.goal, target).replace(' vu', '')}` : '';
  return `${w.catchUp ? 'Séance de rattrapage' : 'Prochaine séance'} : <strong>${esc(fmt(n, s.goal))}</strong>${esc(pos)}`;
}

// Carte « cette semaine » d'un objectif (accueil et page de l'objectif)
export function weekCard(s, { withTitle = true } = {}) {
  const g = s.goal, w = s.current;
  const canLog = s.status !== 'done';
  const range = w ? formatRange(w.monday, addDays(w.monday, 6)) : '';
  return `
    <section class="card week-card week-card--${s.status}">
      ${withTitle ? `
        <header class="week-card__head">
          <button class="week-card__title link-like" data-nav="/goal/${g.id}" title="Voir le plan de cet objectif">
            ${kindIcon(g)}<span>${esc(g.name)}</span><span class="week-card__chevron">${ICONS.chevronR}</span>
          </button>
          ${statusPill(s)}
        </header>` : `
        <header class="week-card__head">
          <div class="card__heading">Cette semaine${range ? ` <span class="muted small">· ${range}</span>` : ''}</div>
          ${w && !w.off ? `<span class="muted small">Semaine ${s.weeks.filter(x => !x.off && x.monday <= w.monday).length} / ${s.activeWeeks}</span>` : ''}
        </header>`}
      <div class="week-card__headline">${esc(weekHeadline(s))}</div>
      ${w && !w.off && w.target ? `
        <div class="week-card__progress">
          ${progressBar(w.done / w.target * 100, w.complete ? '' : 'bar--blue')}
          <span class="small muted">${w.done} / ${w.target}</span>
        </div>` : ''}
      ${slotsHtml(s, w)}
      ${w?.planned.length && !w.sessions.length && s.status !== 'done' ? '<div class="week-card__help">Touche un rond quand la séance est faite.</div>' : ''}
      ${w ? weekNotes(w) : ''}
      ${nextLine(s) ? `<div class="week-card__next">${nextLine(s)}</div>` : ''}
      <footer class="week-card__foot">
        <span class="small muted">${esc(positionLabel(g, s.position))} · ${s.pct} %</span>
        ${canLog ? `<button class="btn btn--ghost btn--sm" data-log="${g.id}" title="Séance pas finie ou dépassée : saisir ce que tu as vraiment fait">${w?.planned.length ? 'Autre quantité' : `${ICONS.add}Séance`}</button>` : ''}
      </footer>
    </section>`;
}

// Notes des séances d'une semaine, affichées sous ses pastilles
export function weekNotes(w) {
  const notes = w.sessions.filter(x => x.note);
  return notes.length ? `<ul class="week-notes">${notes.map(x => `<li>${esc(x.note)}</li>`).join('')}</ul>` : '';
}
