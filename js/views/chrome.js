// Éléments de structure communs : barre du haut et menu du bas (mobile).
// Sur ordinateur, la sidebar remplace le menu du bas et le bouton retour (voir components.css).

import { ICONS, esc } from '../utils/ui.js';

const TABS = [
  { id: 'home',     label: 'Semaine',   path: '/',         icon: 'home' },
  { id: 'planning', label: 'Planning',  path: '/planning', icon: 'planning' },
  { id: 'settings', label: 'Réglages',  path: '/settings', icon: 'settings' },
];

// back : { label, path } | null ; actions : HTML des boutons à droite
export function topbar({ title, subtitle = '', back = null, actions = '' }) {
  return `
    <header class="topbar">
      <div class="topbar__left">
        ${back ? `<button class="topbar__back" data-nav="${esc(back.path)}">${ICONS.back}<span>${esc(back.label)}</span></button>` : ''}
      </div>
      <div class="topbar__center">
        <h1 class="topbar__title">${esc(title)}</h1>
        ${subtitle ? `<div class="topbar__subtitle">${esc(subtitle)}</div>` : ''}
      </div>
      <div class="topbar__right">${actions}</div>
    </header>`;
}

export function globalTabBar(activeId) {
  return `
    <nav class="tab-bar tab-bar--global">
      ${TABS.map(t => `
        <button class="tab-item ${t.id === activeId ? 'tab-item--active' : ''}" data-nav="${t.path}">
          ${ICONS[t.icon]}<span>${t.label}</span>
        </button>`).join('')}
    </nav>`;
}
