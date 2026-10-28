// Saisie libre d'une séance (« Autre quantité » : séance pas finie ou dépassée) et
// modification / suppression d'une séance existante. Une seule question à la fois :
// la quantité faite, ou la position atteinte (page, épisode…) ; l'autre se calcule.

import { getGoal, addSession, updateSession, deleteSession, summaryOf } from '../store.js';
import { fmt, positionLabel, unitOf, KINDS } from '../utils/plan.js';
import { mondayOf, addDays, today, formatRange } from '../utils/dates.js';
import { esc, openSheet, ICONS } from '../utils/ui.js';
import { showToast } from '../toast.js';
import { refreshSidebar } from '../app.js';

// Question posée selon le type : [quantité faite, position atteinte, lien vers la quantité, lien vers la position]
const QUESTIONS = {
  book:     ['Combien de pages as-tu lues ?', 'À quelle page t\'es-tu arrêté ?', 'Saisir plutôt le nombre de pages lues', 'Saisir plutôt la page où tu t\'es arrêté'],
  series:   ['Combien d\'épisodes as-tu vus ?', 'Numéro du dernier épisode vu ?', 'Saisir plutôt le nombre d\'épisodes vus', 'Saisir plutôt le numéro du dernier épisode vu'],
  course:   ['Combien de modules as-tu faits ?', 'Combien de modules faits au total ?', 'Saisir plutôt les modules de cette séance', 'Saisir plutôt le total atteint'],
  revision: ['Combien de chapitres as-tu révisés ?', 'Combien de chapitres révisés au total ?', 'Saisir plutôt les chapitres de cette séance', 'Saisir plutôt le total atteint'],
  audio:    ['Combien de minutes as-tu écoutées ?', 'Où en es-tu (minute atteinte) ?', 'Saisir plutôt les minutes de cette séance', 'Saisir plutôt la minute atteinte'],
  writing:  ['Combien de mots as-tu écrits ?', 'Combien de mots au total maintenant ?', 'Saisir plutôt les mots de cette séance', 'Saisir plutôt le total de mots'],
};
const questions = goal => QUESTIONS[goal.kind] || (u => [
  `Combien de ${u.many} cette séance ?`, 'Où en es-tu au total ?', 'Saisir plutôt la quantité de cette séance', 'Saisir plutôt le total atteint',
])(unitOf(goal));

// Ouvre la feuille de saisie. `session` : séance existante à modifier (sinon nouvelle séance).
export function openLogSheet(goalId, { session = null, onDone } = {}) {
  const goal = getGoal(goalId);
  if (!goal) return;
  const s = summaryOf(goalId);
  const [askAmount, askPosition, toAmount, toPosition] = questions(goal);
  const cur = mondayOf(today());
  const prev = addDays(cur, -7);
  const editing = !!session;
  const suggested = s.current?.planned[0] || (s.phase === 'after' ? s.remaining : 0);
  // Semaine précédente proposée seulement si elle fait partie du plan (oubli de saisie le dimanche…)
  const showWeek = editing || s.weeks.some(w => w.monday === prev) || s.phase === 'after';
  let mode = !editing && KINDS[goal.kind]?.position ? 'position' : 'amount';

  const sheet = openSheet({
    title: editing ? 'Modifier la séance' : goal.name,
    html: `
      <form class="log-form" autocomplete="off">
        <label class="log-question" for="log-value" id="log-label"></label>
        <div class="stepper">
          <button type="button" class="stepper__btn" data-step="-1" aria-label="Moins">${ICONS.minus}</button>
          <input class="input-field stepper__input" id="log-value" type="number" inputmode="numeric" min="0" step="1" required>
          <button type="button" class="stepper__btn" data-step="1" aria-label="Plus">${ICONS.add}</button>
        </div>
        <div class="log-preview" id="log-preview"></div>
        <button type="button" class="link-btn log-switch" id="log-switch"></button>
        ${showWeek ? `
          <div class="form-group">
            <label class="form-label" for="log-week">Semaine</label>
            <select class="input-field" id="log-week">
              ${weekOptions(s, cur, prev, session?.week)}
            </select>
          </div>` : ''}
        <div class="form-group">
          <label class="form-label" for="log-note">Note (facultatif)</label>
          <input class="input-field" id="log-note" type="text" value="${esc(session?.note || '')}" placeholder="Ressenti, chapitre, passage marquant…">
        </div>
        <div class="row-actions">
          ${editing ? `<button type="button" class="btn btn--danger" data-delete>${ICONS.trash}Supprimer</button>` : ''}
          <button type="submit" class="btn btn--primary">Enregistrer</button>
        </div>
      </form>`,
  });

  const body = sheet.body;
  const input = body.querySelector('#log-value');
  const label = body.querySelector('#log-label');
  const preview = body.querySelector('#log-preview');
  const switchBtn = body.querySelector('#log-switch');
  // Position avant cette séance (en modification : sans la séance elle-même)
  const basePos = s.position - (session?.amount || 0);

  function amountValue() {
    const v = Math.round(Number(input.value));
    if (!input.value || !Number.isFinite(v)) return null;
    return mode === 'position' ? v - basePos : v;
  }

  function setMode(m) {
    const current = amountValue();
    mode = m;
    label.textContent = m === 'position' ? askPosition : askAmount;
    switchBtn.textContent = m === 'position' ? toAmount : toPosition;
    const amount = current ?? (editing ? session.amount : suggested);
    input.value = m === 'position' ? basePos + (amount || 0) : (amount || '');
    renderPreview();
  }

  // Ce que la saisie représente, dans l'autre unité, et ce qu'il restera cette semaine
  function renderPreview() {
    const a = amountValue();
    if (a == null) { preview.innerHTML = ''; return; }
    if (a <= 0) {
      preview.innerHTML = `<span class="late-text">${mode === 'position' ? `Tu étais déjà à ${esc(positionLabel(goal, basePos))}.` : 'Saisis une quantité positive.'}</span>`;
      return;
    }
    const pos = basePos + a;
    const parts = [mode === 'position' ? `soit ${fmt(a, goal)} cette séance` : `tu arrives à ${positionLabel(goal, Math.min(pos, goal.total))}`];
    if (pos >= goal.total) parts.push('objectif atteint');
    else if (s.current && !s.current.off && !editing) {
      const left = s.current.remaining - a;
      parts.push(left <= 0 ? 'semaine bouclée' : `il restera ${fmt(left, goal)} cette semaine`);
    }
    preview.textContent = parts.join(' · ');
  }

  switchBtn.addEventListener('click', () => setMode(mode === 'position' ? 'amount' : 'position'));
  body.querySelectorAll('.stepper__btn').forEach(b => b.addEventListener('click', () => {
    input.value = Math.max(0, (Number(input.value) || 0) + Number(b.dataset.step));
    renderPreview();
  }));
  input.addEventListener('input', renderPreview);

  body.querySelector('[data-delete]')?.addEventListener('click', () => {
    if (!confirm('Supprimer cette séance ?')) return;
    deleteSession(goalId, session.id);
    sheet.close();
    showToast('Séance supprimée');
    refreshSidebar();
    onDone?.();
  });

  body.querySelector('form').addEventListener('submit', e => {
    e.preventDefault();
    const amount = amountValue();
    if (!amount || amount <= 0) { input.focus(); return; }
    const week = body.querySelector('#log-week')?.value || (editing ? session.week : cur);
    const note = body.querySelector('#log-note').value.trim();
    if (editing) {
      updateSession(goalId, session.id, { amount, week, note });
      showToast('Séance modifiée', 'success');
    } else {
      addSession(goalId, { week, amount, note });
      showToast(afterLogMessage(goalId, amount), 'success');
    }
    sheet.close();
    refreshSidebar();
    onDone?.();
  });

  setMode(mode);
  if (!matchMedia('(pointer: coarse)').matches) input.select();
}

function weekOptions(s, cur, prev, selected) {
  const weeks = [...new Set([cur, prev, selected, ...s.weeks.map(w => w.monday).filter(m => m <= cur)].filter(Boolean))]
    .sort().reverse();
  const label = m => m === cur ? 'Cette semaine' : m === prev ? 'Semaine dernière' : formatRange(m, addDays(m, 6), true);
  const sel = selected || cur;
  return weeks.map(m => `<option value="${m}" ${m === sel ? 'selected' : ''}>${label(m)} (${formatRange(m, addDays(m, 6))})</option>`).join('');
}

// Récapitulatif après une séance : ce qu'elle apporte et ce qu'il reste, recalculé
export function afterLogMessage(goalId, amount) {
  const s = summaryOf(goalId);
  const head = amount ? `+${fmt(amount, s.goal)}` : 'Séance enregistrée';
  if (s.status === 'done') return `${head} · objectif atteint`;
  const w = s.current;
  if (!w || w.off) return head;
  if (w.complete) return `${head} · semaine bouclée`;
  if (w.catchUp) return `${head} · rattrapage : ${fmt(w.remaining, s.goal)}`;
  if (w.planned.length > 1) return `${head} · reste ${fmt(w.remaining, s.goal)} en ${w.planned.length} séances`;
  return `${head} · reste ${fmt(w.remaining, s.goal)}`;
}
