// Création / modification d'un objectif, avec aperçu du plan calculé en direct.

import { getGoal, getSessions, createGoal, updateGoal, deleteGoal } from '../store.js';
import { KINDS, computeGoal, distribute, fmt, unitOf, planWeeks } from '../utils/plan.js';
import { today, mondayOf, addDays, formatDateShort } from '../utils/dates.js';
import { esc, KIND_ICONS } from '../utils/ui.js';
import { showToast } from '../toast.js';
import { refreshSidebar } from '../app.js';
import { topbar } from './chrome.js';

// Libellés propres à chaque modèle : [nom, total, déjà fait]
const LABELS = {
  book:     ['Titre du livre', 'Nombre de pages', 'Déjà lu (dernière page lue)'],
  series:   ['Nom de la série', 'Nombre d\'épisodes', 'Épisodes déjà vus'],
  course:   ['Nom du cours', 'Nombre de modules', 'Modules déjà faits'],
  revision: ['Matière / examen', 'Nombre de chapitres', 'Chapitres déjà révisés'],
  audio:    ['Titre', 'Durée totale (minutes)', 'Minutes déjà écoutées'],
  writing:  ['Projet d\'écriture', 'Objectif (mots)', 'Mots déjà écrits'],
  custom:   ['Nom de l\'objectif', 'Total à atteindre', 'Déjà fait'],
};

// duplicateOf : identifiant d'un objectif dont on reprend le réglage (sans les séances)
export function mount(container, id, { duplicateOf = null } = {}) {
  const editing = id ? getGoal(id) : null;
  if (id && !editing) { location.hash = '/'; return; }
  const source = duplicateOf ? getGoal(duplicateOf) : null;
  const t = today();
  const cur = mondayOf(t);
  const next = addDays(cur, 7);
  const g = editing || (source ? {
    kind: source.kind, name: `${source.name} (copie)`, unit: source.unit, seasons: source.seasons,
    total: source.total, from: 0, sessionsPerWeek: source.sessionsPerWeek,
    // Même durée que l'objectif d'origine, à partir de cette semaine
    deadline: addDays(cur, 7 * planWeeks(source).length - 1), startWeek: cur,
  } : {
    kind: 'book', name: '', total: '', from: 0, sessionsPerWeek: 3,
    deadline: addDays(cur, 7 * 6 - 1), startWeek: cur,
  });
  let kind = g.kind;

  container.innerHTML = `
    <div class="view">
      ${topbar({
        title: editing ? 'Modifier l\'objectif' : source ? 'Dupliquer l\'objectif' : 'Nouvel objectif',
        back: editing ? { label: 'Retour', path: `/goal/${id}` } : source ? { label: 'Retour', path: `/goal/${source.id}` } : { label: 'Semaine', path: '/' },
      })}
      <main class="page page--narrow">
        <form id="goal-form" class="form" novalidate>
          ${source ? `<p class="hint">Réglages repris de « ${esc(source.name)} » : ajuste le nom, le total et l'échéance. Les séances ne sont pas copiées.</p>` : ''}
          <section class="card">
            <h2 class="card__heading">Type</h2>
            <div class="kind-chips">
              ${Object.entries(KINDS).map(([k, v]) => `
                <button type="button" class="kind-chip ${k === kind ? 'kind-chip--on' : ''}" data-kind="${k}">
                  <span class="kind-chip__icon">${KIND_ICONS[k]}</span><span>${esc(v.label)}</span>
                </button>`).join('')}
            </div>
          </section>

          <section class="card">
            <div class="form-group">
              <label class="form-label" for="f-name" data-l="0"></label>
              <input class="input-field" id="f-name" type="text" required value="${esc(g.name)}">
            </div>
            <div class="form-row form-row--2" id="unit-row">
              <div class="form-group">
                <label class="form-label" for="f-unit-one">Unité (singulier)</label>
                <input class="input-field" id="f-unit-one" type="text" placeholder="séance, km, leçon…" value="${esc(g.unit?.one || '')}">
              </div>
              <div class="form-group">
                <label class="form-label" for="f-unit-many">Unité (pluriel)</label>
                <input class="input-field" id="f-unit-many" type="text" placeholder="séances, km, leçons…" value="${esc(g.unit?.many || '')}">
              </div>
            </div>
            <div class="form-group" id="seasons-group">
              <label class="form-label" for="f-seasons">Épisodes par saison (facultatif)</label>
              <input class="input-field" id="f-seasons" type="text" inputmode="numeric" placeholder="ex. 10, 8, 9" value="${esc((g.seasons || []).join(', '))}">
              <div class="form-hint">Calcule le total et affiche S2E3 au lieu de « 13 épisodes ».</div>
            </div>
            <div class="form-row form-row--2">
              <div class="form-group">
                <label class="form-label" for="f-total" data-l="1"></label>
                <input class="input-field" id="f-total" type="number" inputmode="numeric" min="1" step="1" required value="${esc(g.total)}">
              </div>
              <div class="form-group">
                <label class="form-label" for="f-from" data-l="2"></label>
                <input class="input-field" id="f-from" type="number" inputmode="numeric" min="0" step="1" value="${esc(g.from || 0)}">
              </div>
            </div>
          </section>

          <section class="card">
            <h2 class="card__heading">Rythme</h2>
            <div class="form-row form-row--2">
              <div class="form-group">
                <label class="form-label" for="f-deadline">Échéance</label>
                <input class="input-field" id="f-deadline" type="date" required value="${esc(g.deadline)}">
              </div>
              <div class="form-group">
                <label class="form-label" for="f-sessions">Séances par semaine</label>
                <input class="input-field" id="f-sessions" type="number" inputmode="numeric" min="0" max="14" step="1" placeholder="facultatif" value="${esc(g.sessionsPerWeek || '')}">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Début</label>
              ${editing ? `
                <input class="input-field" id="f-start" type="date" value="${esc(g.startWeek)}">
                <div class="form-hint">Le plan commence le lundi de cette semaine.</div>` : `
                <div class="radio-list">
                  ${cur === t ? radio('now', cur, true, 'Aujourd\'hui', 'Lundi : la semaine commence maintenant.') : `
                    ${radio('now', cur, true, 'Cette semaine', `Comme si j'avais commencé lundi ${formatDateShort(cur)} : la semaine compte en entier.`)}
                    ${radio('next', next, false, 'Lundi prochain', `Le plan démarre le lundi ${formatDateShort(next)}`)}`}
                  ${radio('other', '', false, 'Une autre semaine', '')}
                </div>
                <input class="input-field" id="f-start-other" type="date" hidden value="${esc(addDays(next, 7))}">`}
            </div>
          </section>

          ${editing ? `
            <section class="card">
              <h2 class="card__heading">Statut</h2>
              <select class="input-field" id="f-status">
                ${[['active', 'En cours'], ['paused', 'En pause (masqué de la semaine et du planning)'], ['archived', 'Archivé']]
                  .map(([v, l]) => `<option value="${v}" ${(g.status || 'active') === v ? 'selected' : ''}>${l}</option>`).join('')}
              </select>
            </section>` : ''}

          <section class="card preview-card">
            <h2 class="card__heading">Aperçu du plan</h2>
            <div id="preview" class="preview"></div>
          </section>

          <div class="form-actions">
            ${editing ? '<button type="button" class="btn btn--danger" id="delete-btn">Supprimer</button>' : ''}
            <button type="submit" class="btn btn--primary" id="save-btn">${editing ? 'Enregistrer' : 'Créer l\'objectif'}</button>
          </div>
        </form>
      </main>
    </div>`;

  const form = container.querySelector('#goal-form');
  const $ = sel => form.querySelector(sel);

  function applyKind() {
    form.querySelectorAll('.kind-chip').forEach(b => b.classList.toggle('kind-chip--on', b.dataset.kind === kind));
    form.querySelectorAll('[data-l]').forEach(l => { l.textContent = LABELS[kind][l.dataset.l]; });
    $('#unit-row').hidden = kind !== 'custom';
    $('#seasons-group').hidden = kind !== 'series';
    syncSeasons();
  }

  function seasons() {
    return $('#f-seasons').value.split(/[^\d]+/).map(Number).filter(n => n > 0);
  }
  function syncSeasons() {
    const s = seasons();
    if (kind === 'series' && s.length) $('#f-total').value = s.reduce((a, b) => a + b, 0);
  }

  function startWeek() {
    if (editing) return mondayOf($('#f-start').value || g.startWeek);
    const choice = form.querySelector('input[name="start"]:checked')?.value;
    if (choice === 'other') return mondayOf($('#f-start-other').value || next);
    return form.querySelector('input[name="start"]:checked')?.dataset.week || cur;
  }

  function read() {
    const data = {
      kind,
      name: $('#f-name').value.trim(),
      total: Math.round(Number($('#f-total').value)),
      from: Math.max(0, Math.round(Number($('#f-from').value) || 0)),
      deadline: $('#f-deadline').value,
      sessionsPerWeek: Math.round(Number($('#f-sessions').value)) || null,
      startWeek: startWeek(),
    };
    if (kind === 'custom') data.unit = { one: $('#f-unit-one').value.trim() || 'unité', many: $('#f-unit-many').value.trim() || $('#f-unit-one').value.trim() || 'unités' };
    else data.unit = null;
    data.seasons = kind === 'series' && seasons().length ? seasons() : null;
    if (editing) {
      data.status = $('#f-status').value;
      data.offWeeks = (g.offWeeks || []).filter(m => m >= data.startWeek && m <= mondayOf(data.deadline || m));
    }
    return data;
  }

  function validate(d) {
    if (!d.name) return 'Donne un nom à l\'objectif.';
    if (!(d.total > 0)) return 'Indique le total.';
    if (d.from >= d.total) return 'Le point de départ doit être inférieur au total.';
    if (!d.deadline) return 'Choisis une échéance.';
    if (mondayOf(d.deadline) < d.startWeek) return 'L\'échéance doit tomber après le début.';
    return null;
  }

  function renderPreview() {
    const d = read();
    const err = validate(d);
    const box = $('#preview');
    if (err) { box.innerHTML = `<p class="muted">${esc(err)}</p>`; return; }
    const s = computeGoal(d, editing ? getSessions(id) : [], today());
    const weeks = s.weeks.filter(w => !w.off);
    const first = s.current && !s.current.off ? s.current : weeks.find(w => w.status === 'future') || weeks[0];
    const S = d.sessionsPerWeek;
    const per = S && first ? distribute(first.target, S) : null;
    box.innerHTML = `
      <div class="preview__big">${esc(fmt(first?.target || 0, d))} <span>par semaine</span></div>
      <ul class="preview__list">
        <li>${weeks.length} semaine${weeks.length > 1 ? 's' : ''}, du lundi ${formatDateShort(d.startWeek)} au dimanche ${formatDateShort(addDays(mondayOf(d.deadline), 6))}</li>
        <li>${esc(fmt(s.remaining, d))} à faire${d.from ? ` (départ : ${d.from})` : ''}</li>
        ${per ? `<li>${S} séance${S > 1 ? 's' : ''} par semaine : ${per.join(' / ')} ${esc(unitOf(d).many)}</li>` : '<li>Sans nombre de séances : seulement une cible hebdomadaire</li>'}
        ${mondayOf(d.deadline) !== d.deadline && addDays(mondayOf(d.deadline), 6) !== d.deadline ? `<li class="muted">La semaine de l'échéance compte en entier.</li>` : ''}
      </ul>`;
  }

  form.addEventListener('click', e => {
    const k = e.target.closest('[data-kind]');
    if (k) { kind = k.dataset.kind; applyKind(); renderPreview(); }
  });
  form.addEventListener('input', e => {
    if (e.target.id === 'f-seasons') syncSeasons();
    renderPreview();
  });
  form.addEventListener('change', e => {
    if (e.target.name === 'start') $('#f-start-other').hidden = e.target.value !== 'other';
    renderPreview();
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const d = read();
    const err = validate(d);
    if (err) { showToast(err, 'error'); return; }
    const btn = $('#save-btn');
    btn.disabled = true;
    btn.textContent = 'Enregistrement…';
    try {
      if (editing) {
        await updateGoal(id, d);
        showToast('Objectif enregistré', 'success');
        refreshSidebar();
        location.hash = `/goal/${id}`;
      } else {
        const newId = await createGoal(d);
        showToast('Objectif créé', 'success');
        refreshSidebar();
        location.hash = `/goal/${newId}`;
      }
    } catch (err2) {
      showToast('Erreur : ' + err2.message, 'error');
      btn.disabled = false;
      btn.textContent = editing ? 'Enregistrer' : 'Créer l\'objectif';
    }
  });

  container.querySelector('#delete-btn')?.addEventListener('click', async () => {
    if (!confirm(`Supprimer « ${g.name} » et toutes ses séances ? Pour le garder dans l'historique, choisis plutôt le statut « Archivé ».`)) return;
    try {
      await deleteGoal(id);
      showToast('Objectif supprimé');
      refreshSidebar();
      location.hash = '/';
    } catch (err) { showToast('Erreur : ' + err.message, 'error'); }
  });

  applyKind();
  renderPreview();
}

function radio(value, week, checked, label, hint) {
  return `
    <label class="radio">
      <input type="radio" name="start" value="${value}" data-week="${week}" ${checked ? 'checked' : ''}>
      <span><strong>${esc(label)}</strong>${hint ? `<span class="muted small">${esc(hint)}</span>` : ''}</span>
    </label>`;
}
