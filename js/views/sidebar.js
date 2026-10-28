// Sidebar ordinateur (≥ 900 px) : navigation, séances restantes de la semaine, liste des objectifs.

import { getGoals, isActive, summaryOf } from '../store.js';
import { ICONS, esc, progressBar } from '../utils/ui.js';
import { kindIcon, statusInfo } from './goal-ui.js';
import { weekTotals } from './home.js';

export function mountSidebar(container, path = '/') {
  if (!container) return;
  const goals = getGoals();
  const activeId = path.match(/^\/goal\/([\w-]+)/)?.[1] || null;
  const active = goals.filter(isActive).map(g => summaryOf(g.id));
  const others = goals.filter(g => !isActive(g)).map(g => summaryOf(g.id));
  const t = weekTotals(active);

  const navItem = (label, target, icon) => `
    <button class="sb-nav-item ${path === target ? 'sb-nav-item--active' : ''}" data-nav="${target}">
      ${ICONS[icon]}<span>${label}</span>
    </button>`;

  container.innerHTML = `
    <div class="sb-header">
      <img src="./icons/mark.png" class="sb-logo" alt="">
      <span class="sb-title">On Track</span>
    </div>

    <nav class="sb-nav">
      ${navItem('Cette semaine', '/', 'home')}
      ${navItem('Réglages', '/settings', 'settings')}
    </nav>

    ${t.withTarget ? `
      <div class="sb-week" data-nav="/">
        <div class="sb-week__label">Cette semaine</div>
        <div class="sb-week__value">${t.sessionsLeft} <span>séance${t.sessionsLeft > 1 ? 's' : ''} à faire</span></div>
        ${progressBar(t.weeksDone / t.withTarget * 100)}
        <div class="sb-week__sub">${t.weeksDone} / ${t.withTarget} objectif${t.withTarget > 1 ? 's' : ''} bouclé${t.withTarget > 1 ? 's' : ''}</div>
      </div>` : ''}

    <div class="sb-section-label">Objectifs</div>
    <div class="sb-projects">
      ${active.map(s => goalItem(s, activeId)).join('') || '<div class="sb-empty">Aucun objectif en cours</div>'}
      ${others.length ? `<div class="sb-section-label sb-section-label--sub">En pause / archivés</div>${others.map(s => goalItem(s, activeId)).join('')}` : ''}
    </div>

    <div class="sb-footer">
      <button class="sb-nav-item ${path === '/new-goal' ? 'sb-nav-item--active' : ''}" data-nav="/new-goal">
        ${ICONS.plus}<span>Nouvel objectif</span>
      </button>
    </div>`;
}

function goalItem(s, activeId) {
  const g = s.goal;
  const info = statusInfo(s);
  return `
    <button class="sb-project ${g.id === activeId ? 'sb-project--active' : ''}" data-nav="/goal/${g.id}">
      <div class="sb-project__name">${kindIcon(g, 'sm')}<span>${esc(g.name)}</span></div>
      <div class="sb-project__meta">${s.pct} % · <span class="sb-status sb-status--${info.cls}">${info.label}</span></div>
      ${progressBar(s.pct, 'bar--thin')}
    </button>`;
}
