const container = () => document.getElementById('toast-container');

export function showToast(msg, type = '') {
  const el = document.createElement('div');
  el.className = `toast ${type ? 'toast--' + type : ''}`;
  el.textContent = msg;
  container()?.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}
