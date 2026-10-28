// Saisie d'une séance (quantité faite ou position atteinte) et modification d'une séance existante.

import { getGoal, addSession, updateSession, deleteSession, summaryOf } from '../store.js';
import { fmt, positionLabel, unitOf, KINDS } from '../utils/plan.js';
import { mondayOf, addDays, today, formatRange } from '../utils/dates.js';
import { esc, openSheet, ICONS } from '../utils/ui.js';
import { showToast } from '../toast.js';
import { refreshSidebar } from '../app.js';
import { emojiOf, weekHeadline } from './goal-ui.js';

function positionFieldLabel(goal) {
  if (goal.kind === 'book') return 'Page atteinte';
  if (goal.kind === 'series') return 'Dernier épisode vu (n°)';
  return 'Total atteint';
}

// Ouvre la feuille de saisie. `session` : séance existante à modifier (sinon nouvelle séance).
export function openLogSheet(goalId, { session = null, onDone } = {}) {
  const goal = getGoal(goalId);
  if (!goal) return;
  const s = summaryOf(goalId);
  const u = unitOf(goal);
  const cur = mondayOf(today());
  const prev = addDays(cur, -7);
  const editing = !!session;
  const suggested = s.current?.planned[0] || (s.phase === 'after' ? s.remaining : 0);
  // Semaine précédente proposée seulement si elle fait partie du plan (oubli de saisie le dimanche…)
  const showWeek = editing || s.weeks.some(w => w.monday === prev) || s.phase === 'after';
  let mode = !editing && KINDS[goal.kind]?.position ? 'position' : 'amount';

  const sheet = openSheet({
    title: editing ? 'Modifier la séance' : `${emojiOf(goal)} ${goal.name}`,
    html: `
      <form class="log-form" autocomplete="off">
        ${editing ? '' : `
          <p class="hint">${esc(weekHeadline(s))}</p>
          <div class="seg" role="tablist">
            <button type="button" class="seg__btn" data-mode="amount">${esc(u.many[0].toUpperCase() + u.many.slice(1))} faites</button>
            <button type="button" class="seg__btn" data-mode="position">${esc(positionFieldLabel(goal))}</button>
          </div>`}
        <label class="form-label" for="log-value" id="log-label"></label>
        <div class="stepper">
          <button type="button" class="stepper__btn" data-step="-1" aria-label="Moins">${ICONS.minus}</button>
          <input class="input-field stepper__input" id="log-value" type="number" inputmode="numeric" min="0" step="1" required>
          <button type="button" class="stepper__btn" data-step="1" aria-label="Plus">${ICONS.add}</button>
        </div>
        <div class="chips log-chips" id="log-chips"></div>
        <div class="log-preview" id="log-preview"></div>
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
          <button type="submit" class="btn btn--primary">${editing ? 'Enregistrer' : 'Valider la séance'}</button>
        </div>
      </form>`,
  });

  const body = sheet.body;
  const input = body.querySelector('#log-value');
  const label = body.querySelector('#log-label');
  const chips = body.querySelector('#log-chips');
  const preview = body.querySelector('#log-preview');
  // Position avant cette séance (en modification : sans la séance elle-même)
  const basePos = s.position - (session?.amount || 0);

  function amountValue() {
    const v = Math.round(Number(input.value));
    if (!input.value || !Number.isFinite(v)) return null;
    return mode === 'position' ? v - basePos : v;
  }

  function setMode(m) {
    mode = m;
    body.querySelectorAll('.seg__btn').forEach(b => b.classList.toggle('seg__btn--on', b.dataset.mode === m));
    label.textContent = m === 'position' ? positionFieldLabel(goal) : `Nombre de ${u.many}`;
    const amount = editing ? session.amount : suggested;
    input.value = m === 'position' ? basePos + (amount || 0) : (amount || '');
    renderChips();
    renderPreview();
  }

  function renderChips() {
    const opts = [];
    const w = s.current;
    if (w?.planned.length) opts.push([w.catchUp ? 'Rattrapage' : 'Séance prévue', w.planned[0]]);
    if (w?.planned.length > 1) opts.push(['Toute la semaine', w.remaining]);
    if (s.remaining && !opts.some(o => o[1] === s.remaining)) opts.push(['Jusqu\'à la fin', s.remaining]);
    chips.innerHTML = editing ? '' : opts.map(([l, n]) => `
      <button type="button" class="chip" data-amount="${n}">${esc(l)} · ${n}</button>`).join('');
  }

  function renderPreview() {
    const a = amountValue();
    if (a == null) { preview.innerHTML = ''; return; }
    if (a <= 0) {
      preview.innerHTML = `<span class="late-text">${mode === 'position' ? `Tu étais déjà à ${esc(positionLabel(goal, basePos))}.` : 'Saisis une quantité positive.'}</span>`;
      return;
    }
    const pos = basePos + a;
    const parts = [mode === 'position' ? `${fmt(a, goal)} cette séance` : `→ ${positionLabel(goal, Math.min(pos, goal.total))}`];
    if (pos >= goal.total) parts.push('objectif atteint 🎉');
    else if (s.current && !s.current.off && !editing) {
      const left = s.current.remaining - a;
      parts.push(left <= 0 ? 'semaine bouclée ✓' : `reste ${fmt(left, goal)} cette semaine`);
    }
    preview.textContent = parts.join(' · ');
  }

  body.querySelectorAll('.seg__btn').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
  body.querySelectorAll('.stepper__btn').forEach(b => b.addEventListener('click', () => {
    input.value = Math.max(0, (Number(input.value) || 0) + Number(b.dataset.step));
    renderPreview();
  }));
  chips.addEventListener('click', e => {
    const c = e.target.closest('[data-amount]');
    if (!c) return;
    const n = Number(c.dataset.amount);
    input.value = mode === 'position' ? basePos + n : n;
    renderPreview();
  });
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
      showToast(afterLogMessage(goalId), 'success');
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

// Récapitulatif après une séance : ce qu'il reste à faire, recalculé
function afterLogMessage(goalId) {
  const s = summaryOf(goalId);
  if (s.status === 'done') return 'Objectif atteint 🎉';
  const w = s.current;
  if (!w || w.off) return 'Séance enregistrée';
  if (w.complete) return 'Semaine bouclée ✓';
  if (w.catchUp) return `Rattrapage : ${fmt(w.remaining, s.goal)}`;
  if (w.planned.length > 1) return `Reste ${fmt(w.remaining, s.goal)} en ${w.planned.length} séances`;
  return `Reste ${fmt(w.remaining, s.goal)}`;
}
