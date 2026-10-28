// Gestes de saisie partagés par les vues (Semaine, Planning, page d'un objectif) :
// - toucher un rond prévu  [data-quick][data-amount] → séance faite comme prévu, annulable ;
// - toucher un rond fait   [data-edit-session][data-goal] → corriger ou supprimer la séance ;
// - « Autre quantité »     [data-log] → feuille de saisie libre.

import { addSession, deleteSession, getSessions } from '../store.js';
import { mondayOf, today } from '../utils/dates.js';
import { showToast } from '../toast.js';
import { refreshSidebar } from '../app.js';
import { openLogSheet, afterLogMessage } from './log-sheet.js';

export function bindQuickLog(root, rerender) {
  root.addEventListener('click', e => {
    const quick = e.target.closest('[data-quick]');
    if (quick) {
      const goalId = quick.dataset.quick;
      const amount = Number(quick.dataset.amount);
      const session = addSession(goalId, { week: mondayOf(today()), amount });
      refreshSidebar();
      rerender();
      showToast(afterLogMessage(goalId, amount), 'success', {
        action: { label: 'Annuler', fn: () => { deleteSession(goalId, session.id); refreshSidebar(); rerender(); } },
      });
      return;
    }

    const edit = e.target.closest('[data-edit-session]');
    if (edit) {
      const session = getSessions(edit.dataset.goal).find(x => x.id === edit.dataset.editSession);
      if (session) openLogSheet(edit.dataset.goal, { session, onDone: rerender });
      return;
    }

    const log = e.target.closest('[data-log]');
    if (log) openLogSheet(log.dataset.log, { onDone: rerender });
  });
}
