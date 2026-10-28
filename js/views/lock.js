// On Track — Auteur : Aurélien Moote - Moo - 2026 — Licence MIT
import { configure } from '../github-api.js';
import { decryptToken } from '../utils/crypto.js';
import { renderMarkdown } from '../utils/markdown.js';

export const PASSWORD = '171225';
// Clés distinctes de Pacing App et Personal Roadmap : les apps partagent l'origine auremoo.github.io.
const SESSION_KEY = 'ontrack_auth';
export const PAT_KEY = 'ontrack_pat';

export function isAuthenticated() {
  return sessionStorage.getItem(SESSION_KEY) === '1';
}

export function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(PAT_KEY);
  location.hash = '';
  location.reload();
}

export function mount(container, onUnlock) {
  container.innerHTML = `
    <div class="lock-screen">
      <img src="./logo.png" class="lock-screen__logo" alt="On Track">
      <div>
        <div class="lock-screen__title">On Track</div>
        <div class="lock-screen__subtitle">Mes objectifs, semaine par semaine</div>
      </div>
      <form class="lock-screen__form" id="lock-form" autocomplete="off">
        <input
          type="password"
          inputmode="numeric"
          pattern="[0-9]*"
          class="input-field"
          id="lock-input"
          placeholder="Mot de passe"
          autofocus
          autocomplete="current-password"
        />
        <div class="lock-screen__error" id="lock-error"></div>
        <button type="submit" class="btn btn--primary btn--full" id="lock-btn">Entrer</button>
      </form>
      <div class="lock-screen__footer">
        Cette application est personnelle et n'est pas ouverte au public.<br>
        Une version multi-utilisateurs est en cours de développement.
        <a href="#" class="lock-screen__readme-link" id="lock-readme-link">En savoir plus →</a>
      </div>
    </div>
    <div class="readme-modal" id="readme-modal" hidden>
      <div class="readme-modal__overlay" id="readme-overlay"></div>
      <div class="readme-modal__panel">
        <div class="readme-modal__header">
          <span class="readme-modal__title">Documentation</span>
          <button class="readme-modal__close" id="readme-close" aria-label="Fermer">✕</button>
        </div>
        <div class="readme-modal__body markdown-body" id="readme-body">Chargement…</div>
      </div>
    </div>
  `;

  const form         = container.querySelector('#lock-form');
  const input        = container.querySelector('#lock-input');
  const error        = container.querySelector('#lock-error');
  const btn          = container.querySelector('#lock-btn');
  const readmeLink   = container.querySelector('#lock-readme-link');
  const readmeModal  = container.querySelector('#readme-modal');
  const readmeBody   = container.querySelector('#readme-body');
  const readmeClose  = container.querySelector('#readme-close');
  const readmeOverlay = container.querySelector('#readme-overlay');

  let readmeLoaded = false;

  async function openReadme(e) {
    e.preventDefault();
    readmeModal.hidden = false;
    if (!readmeLoaded) {
      try {
        const res = await fetch(`./README.md?_t=${Date.now()}`);
        if (!res.ok) throw new Error('README introuvable');
        const md = await res.text();
        readmeBody.innerHTML = renderMarkdown(md);
        readmeLoaded = true;
      } catch {
        readmeBody.textContent = 'Impossible de charger la documentation.';
      }
    }
  }

  function closeReadme() {
    readmeModal.hidden = true;
  }

  readmeLink.addEventListener('click', openReadme);
  readmeClose.addEventListener('click', closeReadme);
  readmeOverlay.addEventListener('click', closeReadme);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !readmeModal.hidden) closeReadme(); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pwd = input.value;

    if (pwd !== PASSWORD) {
      error.textContent = 'Mot de passe incorrect.';
      input.value = '';
      input.focus();
      setTimeout(() => { error.textContent = ''; }, 2500);
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Connexion…';
    error.textContent = '';

    try {
      const res = await fetch(`./config.json?_t=${Date.now()}`);
      if (!res.ok) throw new Error('config.json introuvable — ouvre setup.html.');
      const cfg = await res.json();
      if (!cfg.encryptedToken) throw new Error('Token non configuré — ouvre setup.html d\'abord.');
      const token = await decryptToken(cfg.encryptedToken, pwd);
      configure({ token, owner: cfg.owner, repo: cfg.repo, branch: cfg.branch || 'main' });
      sessionStorage.setItem(PAT_KEY, token);
      sessionStorage.setItem(SESSION_KEY, '1');
      onUnlock();
    } catch (err) {
      error.textContent = err.message;
      btn.disabled = false;
      btn.textContent = 'Entrer';
      input.value = '';
      input.focus();
    }
  });
}
