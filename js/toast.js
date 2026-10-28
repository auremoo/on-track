const container = () => document.getElementById('toast-container');

// action : { label, fn } — bouton dans le toast (ex. « Annuler »), le toast reste alors plus longtemps
export function showToast(msg, type = '', { action = null } = {}) {
  const el = document.createElement('div');
  el.className = `toast ${type ? 'toast--' + type : ''} ${action ? 'toast--action' : ''}`;
  const text = document.createElement('span');
  text.textContent = msg;
  el.appendChild(text);
  if (action) {
    const btn = document.createElement('button');
    btn.className = 'toast__action';
    btn.textContent = action.label;
    btn.addEventListener('click', () => { el.remove(); action.fn(); });
    el.appendChild(btn);
  }
  // Un seul toast à la fois : le nouveau remplace le précédent (sinon ils s'empilent sur le contenu)
  container()?.replaceChildren(el);
  setTimeout(() => el.remove(), action ? 5000 : 2600);
}
