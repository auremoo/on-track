const DAYS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const MONTHS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
];

export function today() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatDate(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${DAYS_FR[date.getDay()]} ${d} ${MONTHS_FR[m - 1]} ${y}`;
}

export function formatDateShort(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-').map(Number);
  return `${d} ${MONTHS_SHORT[m - 1]}`;
}

export function daysUntil(isoDate) {
  if (!isoDate) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const [y, m, d] = isoDate.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  return Math.round((target - now) / 86400000);
}

export function isPast(isoDate) {
  return isoDate < today();
}

export function isSameDay(a, b) {
  return a === b;
}

export function formatDaysUntil(isoDate) {
  const d = daysUntil(isoDate);
  if (d === null) return '';
  if (d < 0) return `Il y a ${Math.abs(d)} j`;
  if (d === 0) return "Aujourd'hui";
  if (d === 1) return 'Demain';
  if (d < 7) return `Dans ${d} j`;
  const weeks = Math.round(d / 7);
  if (weeks < 8) return `Dans ${weeks} sem.`;
  return `Dans ${Math.round(d / 30)} mois`;
}

export function addDays(isoDate, days) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

// Nombre de semaines couvertes entre deux dates incluses (ex: lundi -> dimanche
// de la même semaine = 1 semaine).
export function weeksBetween(startIso, endIso) {
  const [y1, m1, d1] = startIso.split('-').map(Number);
  const [y2, m2, d2] = endIso.split('-').map(Number);
  const diffDays = Math.round((new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1)) / 86400000);
  return Math.max(1, Math.ceil((diffDays + 1) / 7));
}

const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

// Plage "12 → 18 oct." (ou "28 sept. → 4 oct. 2026" si les mois diffèrent).
export function formatRange(startIso, endIso, withYear = false) {
  if (!startIso || !endIso) return '';
  const [y1, m1, d1] = startIso.split('-').map(Number);
  const [y2, m2, d2] = endIso.split('-').map(Number);
  const mon = m => MONTHS_SHORT[m - 1];
  const year = withYear ? ` ${y2}` : '';
  if (m1 === m2 && y1 === y2) return `${d1} → ${d2} ${mon(m2)}${year}`;
  return `${d1} ${mon(m1)} → ${d2} ${mon(m2)}${year}`;
}

export function mondayOf(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const shift = (date.getDay() + 6) % 7;
  return addDays(isoDate, -shift);
}

export function daysBetween(startIso, endIso) {
  const [y1, m1, d1] = startIso.split('-').map(Number);
  const [y2, m2, d2] = endIso.split('-').map(Number);
  return Math.round((new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1)) / 86400000);
}
