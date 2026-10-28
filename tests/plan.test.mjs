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
