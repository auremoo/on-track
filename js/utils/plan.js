// Moteur de calcul : découpe un objectif en semaines puis en séances, en lissant le retard
// (ou l'avance) sur toutes les semaines restantes jusqu'à l'échéance.
// Fonctions pures : aucune dépendance au DOM ni au store (testées dans tests/plan.test.mjs).

import { mondayOf, addDays, today } from './dates.js';

// Modèles d'objectifs. `position` : la saisie par défaut est la position atteinte (« je suis page 142 »).
export const KINDS = {
  book:     { label: 'Livre',               one: 'page',     many: 'pages',     position: true },
  series:   { label: 'Série',               one: 'épisode',  many: 'épisodes',  position: false },
  course:   { label: 'Cours / formation',   one: 'module',   many: 'modules',   position: false },
  revision: { label: 'Révisions',           one: 'chapitre', many: 'chapitres', position: false },
  audio:    { label: 'Livre audio / podcast', one: 'minute', many: 'minutes',   position: false },
  writing:  { label: 'Écriture',            one: 'mot',      many: 'mots',      position: false },
  custom:   { label: 'Autre',               one: 'unité',    many: 'unités',    position: false },
};

export function unitOf(goal) {
  const k = KINDS[goal.kind] || KINDS.custom;
  return { one: goal.unit?.one || k.one, many: goal.unit?.many || k.many };
}

// « 1 page », « 17 pages », « 0 page »
export function fmt(n, goal) {
  const u = unitOf(goal);
  return `${n.toLocaleString('fr-FR')} ${Math.abs(n) > 1 ? u.many : u.one}`;
}

// Répartit `total` (entier) en `n` parts entières, les plus grosses en premier : 10 / 4 → [3, 3, 2, 2].
export function distribute(total, n) {
  if (n <= 0) return [];
  const t = Math.max(0, Math.round(total));
  const base = Math.floor(t / n);
  const extra = t - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0));
}

// Lundis des semaines du plan : de la semaine de départ à celle de l'échéance incluse.
export function planWeeks(goal) {
  const first = mondayOf(goal.startWeek);
  const last = mondayOf(goal.deadline);
  const weeks = [];
  for (let w = first; w <= last; w = addDays(w, 7)) weeks.push(w);
  return weeks;
}

const sum = arr => arr.reduce((a, s) => a + s.amount, 0);

// Séance n° (1-based) d'une série découpée en saisons → « S2E3 ». null sans saisons.
export function episodeLabel(goal, n) {
  const seasons = goal.seasons || [];
  if (!seasons.length || n < 1) return null;
  let left = n;
  for (let i = 0; i < seasons.length; i++) {
    if (left <= seasons[i]) return `S${i + 1}E${left}`;
    left -= seasons[i];
  }
  return null;
}

// Position lisible : « page 142 », « S2E3 », « 12 modules »
export function positionLabel(goal, position) {
  if (goal.kind === 'book') return `page ${position}`;
  if (goal.kind === 'series') {
    const ep = episodeLabel(goal, position);
    if (ep) return `${ep} vu`;
  }
  return fmt(position, goal);
}

/**
 * Calcule tout ce qu'il faut afficher pour un objectif à la date `now`.
 * goal     : { startWeek, deadline, from, total, sessionsPerWeek, offWeeks }
 * sessions : [{ id, week (lundi ISO), amount, at, note }]
 */
export function computeGoal(goal, sessions = [], now = today()) {
  const amount = Math.max(0, (goal.total || 0) - (goal.from || 0));
  const S = goal.sessionsPerWeek > 0 ? goal.sessionsPerWeek : null;
  const off = new Set(goal.offWeeks || []);
  const mondays = planWeeks(goal);
  const cur = mondayOf(now);
  const byWeek = {};
  for (const s of sessions) (byWeek[s.week] ||= []).push(s);

  const done = sum(sessions);
  const remaining = Math.max(0, amount - done);
  const position = (goal.from || 0) + done;

  const first = mondays[0], last = mondays[mondays.length - 1];
  const phase = !mondays.length ? 'after' : cur < first ? 'before' : cur > last ? 'after' : 'during';

  // Rythme idéal (répartition régulière au départ) : sert à dire « en avance / en retard ».
  const activeMondays = mondays.filter(m => !off.has(m));
  const ideal = distribute(amount, activeMondays.length);
  const idealOf = {};
  activeMondays.forEach((m, i) => { idealOf[m] = ideal[i]; });

  // Séances saisies avant la première semaine du plan
  let doneBefore = sum(sessions.filter(s => first && s.week < first));
  const weeks = [];
  let remAfterCurrent = null;

  mondays.forEach((m, i) => {
    const list = (byWeek[m] || []).slice().sort((a, b) => (a.at || '').localeCompare(b.at || ''));
    const doneW = sum(list);
    const isOff = off.has(m);
    const activeLeft = mondays.slice(i).filter(x => !off.has(x)).length;
    const w = { monday: m, num: i + 1, off: isOff, done: doneW, sessions: list, ideal: idealOf[m] || 0 };

    if (m <= cur) {
      // Semaine passée ou en cours : cible calculée au lundi, d'après ce qui restait à faire.
      const rem = Math.max(0, amount - doneBefore);
      w.target = isOff ? 0 : (activeLeft ? Math.ceil(rem / activeLeft) : rem);
      if (m < cur) w.status = isOff ? 'off' : doneW >= w.target ? 'ok' : 'short';
      else {
        w.status = isOff ? 'off' : 'current';
        // Pour la suite, on suppose la cible de la semaine en cours atteinte.
        remAfterCurrent = Math.max(0, rem - Math.max(doneW, w.target));
      }
    } else {
      w.status = isOff ? 'off' : 'future';
    }
    doneBefore += doneW;
    weeks.push(w);
  });

  // Semaines à venir : le reste est réparti régulièrement.
  const future = weeks.filter(w => w.monday > cur && !w.off);
  const toPlan = remAfterCurrent ?? Math.max(0, amount - sum(sessions.filter(s => s.week <= cur)));
  distribute(toPlan, future.length).forEach((t, i) => { future[i].target = t; });
  for (const w of weeks) if (w.target == null) w.target = 0;

  // Séances de chaque semaine : faites + prévues (cible restante répartie sur les séances restantes).
  for (const w of weeks) {
    w.remaining = Math.max(0, w.target - w.done);
    w.planned = [];
    w.catchUp = false;
    if (w.status === 'future') {
      w.planned = S ? distribute(w.target, S) : (w.target ? [w.target] : []);
    } else if (w.status === 'current' && w.remaining > 0) {
      const left = S ? S - w.sessions.length : 1;
      if (left > 0) w.planned = distribute(w.remaining, left);
      else { w.planned = [w.remaining]; w.catchUp = true; }  // séances prévues faites, objectif non atteint
    }
    w.complete = w.target > 0 && w.done >= w.target;
  }

  const current = weeks.find(w => w.monday === cur) || null;

  // Avance / retard par rapport au rythme idéal
  const idealThrough = upTo => activeMondays.filter(m => m <= upTo).reduce((a, m) => a + idealOf[m], 0);
  const expectedPrev = idealThrough(addDays(cur, -7));
  const expectedCur = idealThrough(cur);
  let status, gap = 0;
  if (amount > 0 && remaining === 0) status = 'done';
  else if (phase === 'before') status = 'before';
  else if (phase === 'after') { status = 'overdue'; gap = remaining; }
  else if (done < expectedPrev) { status = 'late'; gap = expectedPrev - done; }
  else if (done > expectedCur) { status = 'ahead'; gap = done - expectedCur; }
  else status = 'ontrack';

  // Date de fin estimée au rythme réel (semaines passées actives uniquement)
  let projection = null;
  const pastActive = weeks.filter(w => w.monday < cur && !w.off);
  const pastDone = pastActive.reduce((a, w) => a + w.done, 0);
  if (status !== 'done' && phase === 'during' && pastActive.length && pastDone > 0) {
    const pace = pastDone / pastActive.length;
    const weeksNeeded = Math.max(1, Math.ceil(remaining / pace));
    projection = { end: addDays(cur, weeksNeeded * 7 - 1), pace, late: addDays(cur, weeksNeeded * 7 - 1) > goal.deadline };
  }

  // Date à laquelle l'objectif a été atteint
  let finishedAt = null;
  if (status === 'done') {
    let acc = 0;
    for (const s of sessions.slice().sort((a, b) => (a.at || '').localeCompare(b.at || ''))) {
      acc += s.amount;
      if (acc >= amount) { finishedAt = s.at; break; }
    }
  }

  return {
    goal, amount, done, remaining, position, phase, status, gap,
    pct: amount ? Math.min(100, Math.round(done / amount * 100)) : 0,
    weeks, current,
    currentIndex: current ? weeks.indexOf(current) : -1,
    activeWeeks: activeMondays.length,
    idealWeekly: ideal[0] || 0,
    projection, finishedAt,
    sessionCount: sessions.length,
  };
}

// Séances et volume prévus pour une semaine donnée (vue Planning, tous objectifs confondus).
export function weekOf(summary, monday) {
  return summary.weeks.find(w => w.monday === monday) || null;
}

// Proposition de séance : ce qu'il reste à faire à la prochaine séance de la semaine en cours.
export function nextSessionTarget(summary) {
  const w = summary.current;
  if (!w || w.off) return summary.phase === 'after' ? summary.remaining : null;
  return w.planned[0] ?? null;
}
