/**
 * Plain-script landing confirm — auto-click through EVERYDAYMEDS role screen.
 */
(function () {
  const LANDING_RE = /\/nationalcarerecordsservice\/app\/landing/;
  const FIND_PATIENT_URL =
    'https://portal.spineservices.nhs.uk/nationalcarerecordsservice/app/find_patient';
  const CONFIRM_BTN = '#confirm-current-role';
  const FIND_PATIENT_NAV = '#masthead-find-patient-button';
  const AUTH_SUBSTRING = 'FJE59';
  const RETRY_MS = 200;
  const MAX_MS = 90000;

  let lastClickAt = 0;
  let confirmAttempts = 0;
  const startedAt = Date.now();

  function isFindPatientReady() {
    return Boolean(
      document.querySelector('#advanced-search-tab')
        || document.querySelector('#basic-search-tab')
        || document.querySelector('#nhs-number-search-form-nhs-number')
    );
  }

  function verifyOrg() {
    const bodyText = document.body?.innerText || document.body?.textContent || '';
    return bodyText.includes(AUTH_SUBSTRING) || bodyText.includes('EVERYDAYMEDS');
  }

  function findConfirmButton() {
    const byId = document.querySelector(CONFIRM_BTN);
    if (byId) return byId;

    for (const el of document.querySelectorAll('button, input[type="submit"], a')) {
      const text = (el.textContent || el.value || '').trim();
      if (text.includes('Confirm and continue')) return el;
    }
    return null;
  }

  function clickElement(el) {
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
    el.focus();

    const rect = el.getBoundingClientRect();
    const opts = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
      button: 0,
    };

    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
      const Cls = type.startsWith('pointer') ? PointerEvent : MouseEvent;
      el.dispatchEvent(new Cls(type, opts));
    }

    const form = el.closest('form');
    if (form && typeof form.requestSubmit === 'function') {
      form.requestSubmit(el);
    }
    el.click();
  }

  async function markLandingDone() {
    const data = await chrome.storage.session.get(['flow']);
    const flow = data.flow || {};
    if (!flow.landingDone) {
      await chrome.storage.session.set({
        flow: { ...flow, landingDone: true, active: true },
      });
    }
  }

  async function shouldRun() {
    const data = await chrome.storage.session.get(['flow', 'pendingPatient', 'scanPending']);
    const flow = data.flow || {};
    if (flow.landingDone) return false;
    if (data.scanPending) return true;
    if (flow.active) return true;
    if (data.pendingPatient) return true;
    return false;
  }

  async function tryConfirm() {
    if (!LANDING_RE.test(location.href)) return;
    if (Date.now() - startedAt > MAX_MS) return;
    if (!(await shouldRun())) return;

    if (isFindPatientReady()) {
      await markLandingDone();
      console.info('[edm-scr] Find patient form visible — landing step complete');
      return;
    }

    if (!verifyOrg()) return;

    const now = Date.now();
    if (now - lastClickAt < RETRY_MS) return;

    const confirmBtn = findConfirmButton();
    if (confirmBtn) {
      lastClickAt = now;
      confirmAttempts += 1;
      clickElement(confirmBtn);
      console.info('[edm-scr] Clicked Confirm and continue on landing');

      if (confirmAttempts >= 8 && !isFindPatientReady()) {
        console.info('[edm-scr] Redirecting to find_patient after confirm retries');
        window.location.href = FIND_PATIENT_URL;
      }
      return;
    }

    const navBtn = document.querySelector(FIND_PATIENT_NAV);
    if (navBtn) {
      lastClickAt = now;
      clickElement(navBtn);
      console.info('[edm-scr] Clicked masthead Find patient');
    }
  }

  setInterval(tryConfirm, RETRY_MS);
  new MutationObserver(tryConfirm).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  tryConfirm();
  document.addEventListener('DOMContentLoaded', tryConfirm);
  console.info('[edm-scr] Landing auto-confirm active (FJE59)');
})();
