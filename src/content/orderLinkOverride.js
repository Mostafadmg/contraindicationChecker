/**
 * Early `.scr-cta` click guard — MedExpress pattern: always open NHS tab on click.
 */
(function () {
  const PORTAL_URL =
    'https://portal.spineservices.nhs.uk/nationalcarerecordsservice/app/find_patient';
  const TRIGGER = '.scr-cta';
  const HANDLER_POLL_MS = 25;
  const HANDLER_POLL_MAX = 80;

  function openPortalNow() {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'OPEN_PORTAL_TAB', url: PORTAL_URL }, () => {
        if (chrome.runtime.lastError) {
          window.open(PORTAL_URL, '_blank', 'noopener,noreferrer');
        }
      });
      return;
    }
    window.open(PORTAL_URL, '_blank', 'noopener,noreferrer');
  }

  function savePatientWhenReady() {
    if (typeof window.__edmScrSavePatientOnly === 'function') {
      window.__edmScrSavePatientOnly();
      return true;
    }
    return false;
  }

  function pollForPatientSave(attempt = 0) {
    if (savePatientWhenReady()) return;
    if (attempt >= HANDLER_POLL_MAX) {
      console.warn('[edm-scr] Patient auto-fill unavailable — enter details manually on NHS tab');
      return;
    }
    setTimeout(() => pollForPatientSave(attempt + 1), HANDLER_POLL_MS);
  }

  function handleScrClick() {
    openPortalNow();
    if (!savePatientWhenReady()) {
      pollForPatientSave(0);
    }
  }

  function rewriteScrLinks() {
    document.querySelectorAll(TRIGGER).forEach((el) => {
      if (!(el instanceof HTMLAnchorElement)) return;
      if (el.getAttribute('href') !== PORTAL_URL) {
        el.setAttribute('href', PORTAL_URL);
      }
      if (el.target !== '_blank') el.target = '_blank';
      if (el.rel !== 'noopener noreferrer') el.rel = 'noopener noreferrer';
    });
  }

  document.addEventListener(
    'click',
    (e) => {
      const link = e.target.closest(TRIGGER);
      if (!link) return;
      if (e.button !== 0) return;

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      handleScrClick();
    },
    true
  );

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', rewriteScrLinks, { once: true });
  } else {
    rewriteScrLinks();
  }

  let rewriteAttempts = 0;
  const rewritePoller = setInterval(() => {
    rewriteScrLinks();
    if (++rewriteAttempts >= 20) clearInterval(rewritePoller);
  }, 250);

  console.info('[edm-scr] Order click guard active (MedExpress: portal opens immediately)');
})();
