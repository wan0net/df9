import './publicShell.css';

const params = new URLSearchParams(window.location.search);
if (import.meta.env.VITE_E2E === 'true' && params.get('e2e') === '1') {
  window.location.replace(`./game.html${window.location.search}`);
}
