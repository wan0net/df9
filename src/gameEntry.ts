import './publicShell.css';

const TERMS_KEY = 'df9_ownership_terms_v1';
const params = new URLSearchParams(window.location.search);
const gate = document.getElementById('ownership-gate') as HTMLElement;
const checkbox = document.getElementById('ownership-confirmation') as HTMLInputElement;
const accept = document.getElementById('accept-terms') as HTMLButtonElement;

function hasAcceptedTerms(): boolean {
  try {
    return localStorage.getItem(TERMS_KEY) === 'accepted';
  } catch {
    return false;
  }
}

async function openGame(): Promise<void> {
  gate.hidden = true;
  document.body.classList.add('game-open');
  await import('./main');
}

const e2eBuild = import.meta.env.VITE_E2E === 'true';
const forceTerms = params.get('terms') === '1';

if ((e2eBuild && !forceTerms) || (hasAcceptedTerms() && !forceTerms)) {
  void openGame();
} else {
  gate.hidden = false;
  checkbox.addEventListener('change', () => {
    accept.disabled = !checkbox.checked;
  });
  accept.addEventListener('click', () => {
    if (!checkbox.checked) return;
    try {
      localStorage.setItem(TERMS_KEY, 'accepted');
    } catch {
      // Storage can be unavailable in privacy modes; acceptance still applies
      // to the current page load.
    }
    void openGame();
  });
}
