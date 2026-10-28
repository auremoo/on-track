// On Track — Auteur : Aurélien Moote - Moo - 2026 — Licence MIT
import { getFile, putFile } from './github-api.js';
import { showToast } from './toast.js';
import { computeGoal } from './utils/plan.js';

// ── État en mémoire ───────────────────────────────────────────────
// goals.json : { goals: [goal] }                  ← définition des objectifs, écrit immédiatement
// state.json : { version, sessions: { goalId: [session] } }  ← journal des séances, écrit en différé

const GOALS_PATH = 'goals.json';
const STATE_PATH = 'state.json';

let _goals     = [];
let _state     = { version: 1, sessions: {} };
let _syncTimer = null;
let _syncing   = false;

export async function initStore() {
  const [goalsFile, stateFile] = await Promise.all([getFile(GOALS_PATH), getFile(STATE_PATH)]);
  // Dépôt vierge : aucun fichier n'est obligatoire, ils sont créés au premier enregistrement.
  _goals = goalsFile ? (JSON.parse(goalsFile.content).goals || []) : [];
  if (stateFile) {
    _state = JSON.parse(stateFile.content);
    if (!_state.sessions) _state.sessions = {};
  }

  // Fermeture de l'onglet avant la fin d'un enregistrement : le navigateur demande confirmation.
  window.addEventListener('beforeunload', e => {
    if (_syncTimer || _syncing) { e.preventDefault(); e.returnValue = ''; }
  });

  // Sur mobile, l'app peut être fermée pendant le délai de synchro : on vide la file tout de suite.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && _syncTimer) {
      clearTimeout(_syncTimer);
      _syncTimer = null;
      syncState();
    }
  });
}

// ── Objectifs ─────────────────────────────────────────────────────

export function getGoals() { return _goals; }
export function getGoal(id) { return _goals.find(g => g.id === id) || null; }
export const isActive = g => (g.status || 'active') === 'active';

// Résumé calculé (plan, semaine en cours, statut) d'un objectif
export function summaryOf(id, now) {
  const goal = getGoal(id);
  return goal ? computeGoal(goal, getSessions(id), now) : null;
}

async function writeGoals(message) {
  const file = await getFile(GOALS_PATH);
  await putFile(GOALS_PATH, JSON.stringify({ goals: _goals }, null, 2), file?.sha || null,
    { commitMessage: `on-track: ${message} [skip ci]` });
}

export function slugify(name) {
  const base = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'objectif';
  let id = base, i = 2;
  while (getGoal(id)) id = `${base}-${i++}`;
  return id;
}

export async function createGoal(data) {
  const goal = { ...data, id: slugify(data.name), status: 'active', createdAt: new Date().toISOString() };
  _goals.push(goal);
  try {
    await writeGoals(`nouvel objectif ${goal.id}`);
  } catch (err) {
    _goals = _goals.filter(g => g !== goal);
    throw err;
  }
  return goal.id;
}

export async function updateGoal(id, updates) {
  const i = _goals.findIndex(g => g.id === id);
  if (i < 0) throw new Error('Objectif introuvable');
  const prev = _goals[i];
  _goals[i] = { ...prev, ...updates, id };
  try {
    await writeGoals(`objectif ${id}`);
  } catch (err) {
    _goals[i] = prev;
    throw err;
  }
}

export async function deleteGoal(id) {
  const prev = _goals;
  _goals = _goals.filter(g => g.id !== id);
  try {
    await writeGoals(`suppression ${id}`);
  } catch (err) {
    _goals = prev;
    throw err;
  }
  delete _state.sessions[id];
  scheduleSync();
}

// ── Séances (state.json) ──────────────────────────────────────────
// session : { id, week (lundi ISO), amount, at (ISO), note }

export function getSessions(goalId) { return _state.sessions[goalId] || []; }

// Toutes les séances, tous objectifs confondus (plus récentes d'abord)
export function getAllSessions() {
  return Object.entries(_state.sessions)
    .flatMap(([goalId, list]) => list.map(s => ({ ...s, goalId })))
    .sort((a, b) => (b.at || '').localeCompare(a.at || ''));
}

export function addSession(goalId, { week, amount, note = '' }) {
  const session = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    week, amount, at: new Date().toISOString(),
  };
  if (note) session.note = note;
  (_state.sessions[goalId] ||= []).push(session);
  scheduleSync();
  return session;
}

export function updateSession(goalId, sessionId, updates) {
  const list = getSessions(goalId);
  const i = list.findIndex(s => s.id === sessionId);
  if (i < 0) return;
  list[i] = { ...list[i], ...updates };
  if (!list[i].note) delete list[i].note;
  scheduleSync();
}

export function deleteSession(goalId, sessionId) {
  _state.sessions[goalId] = getSessions(goalId).filter(s => s.id !== sessionId);
  scheduleSync();
}

function scheduleSync() {
  if (_syncTimer) clearTimeout(_syncTimer);
  _syncTimer = setTimeout(() => { _syncTimer = null; syncState(); }, 600);
}

async function syncState() {
  if (_syncing) { scheduleSync(); return; }
  _syncing = true;
  try {
    // Toujours relire le SHA pour éviter les 409
    const current = await getFile(STATE_PATH);
    _state.lastUpdated = new Date().toISOString();
    await putFile(STATE_PATH, JSON.stringify(_state, null, 2), current?.sha || null,
      { commitMessage: 'on-track: update state.json [skip ci]' });
  } catch (err) {
    console.error('Sync state failed', err);
    showToast('Erreur de synchronisation', 'error');
  } finally {
    _syncing = false;
  }
}
