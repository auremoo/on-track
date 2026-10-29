// Tests du moteur de calcul : node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeGoal, distribute, episodeLabel } from '../js/utils/plan.js';

// Lundi 2 nov. 2026 → 6 semaines, échéance dimanche 13 déc.
const book = {
  kind: 'book', from: 0, total: 300, sessionsPerWeek: 3,
  startWeek: '2026-11-02', deadline: '2026-12-13', offWeeks: [],
};
const s = (week, amount, at = week + 'T10:00:00Z') => ({ id: Math.random().toString(36), week, amount, at });

test('distribute : parts entières, les plus grosses en premier', () => {
  assert.deepEqual(distribute(10, 4), [3, 3, 2, 2]);
  assert.deepEqual(distribute(300, 6), [50, 50, 50, 50, 50, 50]);
  assert.deepEqual(distribute(0, 3), [0, 0, 0]);
});

test('plan initial : 50 p./semaine, 17/17/16 par séance', () => {
  const r = computeGoal(book, [], '2026-11-02');
  assert.equal(r.weeks.length, 6);
  assert.equal(r.current.target, 50);
  assert.deepEqual(r.current.planned, [17, 17, 16]);
  assert.equal(r.status, 'ontrack');
});

test('dans la semaine : le reste est réparti sur les séances restantes', () => {
  const r = computeGoal(book, [s('2026-11-02', 20)], '2026-11-03');
  assert.deepEqual(r.current.planned, [15, 15]);
});

test('3 séances faites sans atteindre la cible : séance de rattrapage', () => {
  const r = computeGoal(book, [s('2026-11-02', 20), s('2026-11-02', 10), s('2026-11-02', 10)], '2026-11-06');
  assert.equal(r.current.catchUp, true);
  assert.deepEqual(r.current.planned, [10]);
});

test('semaine terminée avec 10 p. de retard : lissage sur les 5 semaines restantes', () => {
  const r = computeGoal(book, [s('2026-11-02', 40)], '2026-11-09');
  assert.equal(r.weeks[0].status, 'short');
  assert.equal(r.current.target, 52);                 // 260 / 5
  assert.deepEqual(r.weeks.slice(2).map(w => w.target), [52, 52, 52, 52]);
  assert.equal(r.status, 'late');
  assert.equal(r.gap, 10);
});

test('avance : les semaines suivantes diminuent', () => {
  const r = computeGoal(book, [s('2026-11-02', 80)], '2026-11-04');
  assert.equal(r.current.complete, true);
  assert.deepEqual(r.weeks.slice(1).map(w => w.target), [44, 44, 44, 44, 44]);
  assert.equal(r.status, 'ahead');
});

test('semaine off : exclue du plan, le reste est redistribué', () => {
  const r = computeGoal({ ...book, offWeeks: ['2026-11-16'] }, [], '2026-11-02');
  assert.equal(r.weeks[2].status, 'off');
  assert.equal(r.weeks[2].target, 0);
  assert.deepEqual(r.weeks.filter(w => !w.off).map(w => w.target), [60, 60, 60, 60, 60]);
});

test('sans nombre de séances : une seule cible hebdo', () => {
  const r = computeGoal({ ...book, sessionsPerWeek: null }, [s('2026-11-02', 20)], '2026-11-03');
  assert.deepEqual(r.current.planned, [30]);
  assert.equal(r.current.catchUp, false);
});

test('échéance dépassée avec un reste : en retard', () => {
  const r = computeGoal(book, [s('2026-11-02', 50)], '2026-12-20');
  assert.equal(r.phase, 'after');
  assert.equal(r.status, 'overdue');
  assert.equal(r.remaining, 250);
});

test('objectif atteint', () => {
  const r = computeGoal({ ...book, total: 30 }, [s('2026-11-02', 30, '2026-11-03T20:00:00Z')], '2026-11-04');
  assert.equal(r.status, 'done');
  assert.equal(r.finishedAt, '2026-11-03T20:00:00Z');
});

test('point de départ : pages déjà lues déduites', () => {
  const r = computeGoal({ ...book, from: 60 }, [], '2026-11-02');
  assert.equal(r.amount, 240);
  assert.equal(r.current.target, 40);
});

test('pas encore commencé : tout est planifié', () => {
  const r = computeGoal(book, [], '2026-10-28');
  assert.equal(r.phase, 'before');
  assert.equal(r.status, 'before');
  assert.deepEqual(r.weeks.map(w => w.target), [50, 50, 50, 50, 50, 50]);
});

test('projection au rythme réel', () => {
  const r = computeGoal(book, [s('2026-11-02', 25), s('2026-11-09', 25)], '2026-11-16');
  assert.equal(r.projection.pace, 25);
  assert.equal(r.projection.late, true);   // 250 p. à 25 p./sem. → 10 semaines
});

test('série en saisons : S2E3', () => {
  const g = { seasons: [10, 8] };
  assert.equal(episodeLabel(g, 13), 'S2E3');
  assert.equal(episodeLabel(g, 10), 'S1E10');
  assert.equal(episodeLabel(g, 19), null);
});

// Rien ne se perd à l'arrondi : fait + reste de la semaine + semaines à venir = total exact,
// et les séances prévues de la semaine totalisent exactement son reste (retard, avance, semaines off…).
test('arrondis : on retombe toujours sur le total exact', () => {
  let seed = 42;
  const rnd = n => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
  const mondays = ['2026-10-26', '2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30', '2026-12-07', '2026-12-14'];
  let checked = 0;
  for (let k = 0; k < 3000; k++) {
    const nWeeks = 2 + rnd(7);
    const goal = {
      from: rnd(3) ? 0 : rnd(50), total: 60 + rnd(900), sessionsPerWeek: rnd(4) ? 1 + rnd(5) : null,
      startWeek: mondays[0], deadline: mondays[nWeeks - 1], offWeeks: rnd(3) ? [] : [mondays[1 + rnd(nWeeks - 1)]],
    };
    const curIdx = rnd(nWeeks);
    const sessions = [];
    for (let i = 0; i <= curIdx; i++) {
      for (let j = rnd(4); j > 0; j--) sessions.push(s(mondays[i], 1 + rnd(80), `${mondays[i]}T0${j}:00:00Z`));
    }
    const r = computeGoal(goal, sessions, mondays[curIdx]);
    if (r.status === 'done' || !r.current || r.current.off) continue;
    const future = r.weeks.filter(w => w.status === 'future').reduce((a, w) => a + w.target, 0);
    assert.equal(r.done + r.current.remaining + future, r.amount, JSON.stringify({ goal, curIdx, sessions }));
    assert.equal(r.current.planned.reduce((a, n) => a + n, 0), r.current.remaining);
    for (const w of r.weeks.filter(w => w.status === 'future')) {
      assert.equal(w.planned.reduce((a, n) => a + n, 0), w.target);
    }
    checked++;
  }
  assert.ok(checked > 1000, `${checked} cas vérifiés`);
});

test('livre de 467 pages : 32 + 32 + 13 × 31 = 467, séances 11 + 11 + 10', () => {
  const klara = { kind: 'book', from: 0, total: 467, sessionsPerWeek: 3, startWeek: '2026-10-26', deadline: '2027-02-07', offWeeks: [] };
  const r = computeGoal(klara, [], '2026-10-26');
  assert.equal(r.weeks.reduce((a, w) => a + w.target, 0), 467);
  assert.deepEqual(r.current.planned, [11, 11, 10]);
  // Avance : 60 pages la 1re semaine → le reste (407) est redécoupé sans perte
  const fast = computeGoal(klara, [s('2026-10-26', 60)], '2026-11-02');
  assert.equal(fast.done + fast.current.remaining + fast.weeks.filter(w => w.status === 'future').reduce((a, w) => a + w.target, 0), 467);
});
