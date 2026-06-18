/**
 * Lightweight on-page toast notifications for portal automation status.
 */

const TOAST_CONTAINER_ID = 'edm-scr-toast-container';
const AUTO_DISMISS_MS = 5000;

/** Ensure toast container exists (z-index below NHS modals). */
function getContainer() {
  let container = document.getElementById(TOAST_CONTAINER_ID);
  if (!container) {
    container = document.createElement('div');
    container.id = TOAST_CONTAINER_ID;
    container.setAttribute('aria-live', 'polite');
    Object.assign(container.style, {
      position: 'fixed',
      top: '16px',
      right: '16px',
      zIndex: '9990',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      maxWidth: '360px',
      pointerEvents: 'none',
    });
    document.body.appendChild(container);
  }
  return container;
}

/**
 * Show a toast message on the active portal page.
 * @param {string} message
 * @param {'info'|'warn'|'error'} [type='info']
 */
export function toast(message, type = 'info') {
  const container = getContainer();
  const el = document.createElement('div');
  el.className = `edm-scr-toast edm-scr-toast--${type}`;
  el.textContent = message;
  Object.assign(el.style, {
    padding: '12px 16px',
    borderRadius: '6px',
    fontFamily: 'system-ui, sans-serif',
    fontSize: '14px',
    lineHeight: '1.4',
    boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
    pointerEvents: 'auto',
    background:
      type === 'error' ? '#7f1d1d' : type === 'warn' ? '#78350f' : '#1e3a5f',
    color: '#f8fafc',
    border: `1px solid ${
      type === 'error' ? '#ef4444' : type === 'warn' ? '#f59e0b' : '#3b82f6'
    }`,
  });

  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.3s';
    setTimeout(() => el.remove(), 300);
  }, AUTO_DISMISS_MS);
}
