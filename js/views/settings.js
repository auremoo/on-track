// Réglages : export des données, documentation, déconnexion.

import { getGoals, getAllSessions } from '../store.js';
import { logout } from './lock.js';
import { topbar, globalTabBar } from './chrome.js';
import { today } from '../utils/dates.js';

export function mount(container) {
  container.innerHTML = `
    <div class="view">
      ${topbar({ title: 'Réglages' })}
      <main class="page page--narrow">
        <section class="card">
          <h2 class="card__heading">Fonctionnement</h2>
          <p class="muted small">Les semaines vont du lundi au dimanche. Chaque lundi, la cible de la semaine est recalculée : ce qui reste ÷ semaines restantes (hors semaines off). Le retard comme l'avance sont donc lissés jusqu'à l'échéance.</p>
        </section>

        <section class="card">
          <h2 class="card__heading">Données</h2>
          <p class="muted small">Stockées dans le dépôt GitHub : <code>goals.json</code> (objectifs) et <code>state.json</code> (séances). Le token GitHub n'est gardé que pour cet onglet.</p>
          <div class="form-actions">
            <button class="btn btn--secondary" id="export-btn">Exporter (JSON)</button>
            <a class="btn btn--secondary" href="./README.md" target="_blank" rel="noopener">Documentation</a>
          </div>
        </section>

        <section class="card">
          <h2 class="card__heading">Session</h2>
          <div class="form-actions">
            <button class="btn btn--danger" id="logout-btn">Se déconnecter</button>
          </div>
        </section>
      </main>
      ${globalTabBar('settings')}
    </div>`;

  container.querySelector('#logout-btn').addEventListener('click', logout);
  container.querySelector('#export-btn').addEventListener('click', () => {
    const data = { exportedAt: new Date().toISOString(), goals: getGoals(), sessions: getAllSessions() };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `on-track-${today()}.json` });
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });
}
