/**
 * Background landing automation — inject clicks into NHS /landing via MAIN world.
 */

import { getFlow, setFlow } from '../lib/storage.js';

const LANDING_RE = /\/nationalcarerecordsservice\/app\/landing/;
const FIND_PATIENT_RE = /\/nationalcarerecordsservice\/app\/find_patient/;
const FIND_PATIENT_URL =
  'https://portal.spineservices.nhs.uk/nationalcarerecordsservice/app/find_patient';
const AUTH_SUBSTRING = 'FJE59';

/** @type {Map<number, ReturnType<typeof setTimeout>>} */
const retryTimers = new Map();

/** Runs inside the NHS page (MAIN world). Must be fully self-contained. */
function GetLandingClickResult(attempt) {
  const AUTH = 'FJE59';
  const FIND_PATIENT_URL =
    'https://portal.spineservices.nhs.uk/nationalcarerecordsservice/app/find_patient';

  function isFindPatientReady() {
    return Boolean(
      document.querySelector('#advanced-search-tab')
        || document.querySelector('#basic-search-tab')
        || document.querySelector('#nhs-number-search-form-nhs-number')
    );
  }

  function clickEl(el) {
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
      buttons: 1,
    };

    for (const type of ['pointerover', 'pointerenter', 'pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
      const Cls = type.startsWith('pointer') ? PointerEvent : MouseEvent;
      el.dispatchEvent(new Cls(type, opts));
    }

    const form = el.closest('form');
    if (form && typeof form.requestSubmit === 'function') {
      form.requestSubmit(el);
    }

    el.click();
  }

  function findConfirmButton() {
    const byId = document.getElementById('confirm-current-role');
    if (byId) return byId;

    for (const el of document.querySelectorAll('button, input[type="submit"], a')) {
      const text = (el.textContent || el.value || '').trim();
      if (text.includes('Confirm and continue')) return el;
    }
    return null;
  }

  if (isFindPatientReady()) {
    return 'form-ready';
  }

  const bodyText = document.body?.innerText || document.body?.textContent || '';
  if (!bodyText.includes(AUTH)) {
    return 'wrong-org';
  }

  const confirm = findConfirmButton();
  if (confirm) {
    clickEl(confirm);
    if (attempt >= 8 && !isFindPatientReady()) {
      window.location.href = FIND_PATIENT_URL;
      return 'redirect';
    }
    return 'confirm';
  }

  const nav = document.getElementById('masthead-find-patient-button');
  if (nav) {
    clickEl(nav);
    return 'nav';
  }

  return null;
}

export function initLandingAutomation() {
  chrome.tabs.onUpdated.addListener(onTabUpdated);
}

async function onTabUpdated(tabId, changeInfo, tab) {
  const url = changeInfo.url || tab.url || '';
  if (!LANDING_RE.test(url)) return;

  const isComplete = changeInfo.status === 'complete';
  const isNav = Boolean(changeInfo.url);
  if (!isComplete && !isNav) return;

  const shouldAct = await shouldAutomateLanding(tabId);
  if (!shouldAct) return;

  scheduleLandingRetries(tabId);
}

async function shouldAutomateLanding(tabId) {
  const data = await chrome.storage.session.get(['flow', 'pendingPatient', 'scanPending', 'portalTabId']);
  const flow = data.flow || {};
  if (flow.landingDone) return false;
  if (data.portalTabId === tabId) return true;
  if (data.scanPending) return true;
  if (flow.active) return true;
  if (data.pendingPatient) return true;
  return false;
}

function scheduleLandingRetries(tabId) {
  if (retryTimers.has(tabId)) return;

  let attempts = 0;
  const maxAttempts = 90;

  const tick = async () => {
    attempts += 1;

    try {
      const tab = await chrome.tabs.get(tabId);
      const url = tab.url || '';

      if (FIND_PATIENT_RE.test(url)) {
        await markLandingDone();
        stopRetries(tabId);
        return;
      }

      if (!LANDING_RE.test(url)) {
        stopRetries(tabId);
        return;
      }

      if (!(await shouldAutomateLanding(tabId))) {
        stopRetries(tabId);
        return;
      }

      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: GetLandingClickResult,
        args: [attempts],
      });

      if (result === 'form-ready') {
        console.info('[edm-scr] Find patient form already visible on landing SPA');
        await markLandingDone();
        stopRetries(tabId);
        return;
      }

      if (result === 'wrong-org') {
        console.warn('[edm-scr] Landing automation stopped — org code', AUTH_SUBSTRING, 'not found');
        stopRetries(tabId);
        return;
      }

      if (result === 'confirm' || result === 'nav') {
        console.info('[edm-scr] Background injected landing click:', result);
      }

      if (attempts >= maxAttempts) {
        stopRetries(tabId);
        return;
      }

      retryTimers.set(tabId, setTimeout(tick, 200));
    } catch (err) {
      console.warn('[edm-scr] Landing click attempt failed:', err);
      if (attempts < maxAttempts) {
        retryTimers.set(tabId, setTimeout(tick, 200));
      } else {
        stopRetries(tabId);
      }
    }
  };

  tick();
}

function stopRetries(tabId) {
  const timer = retryTimers.get(tabId);
  if (timer) clearTimeout(timer);
  retryTimers.delete(tabId);
}

async function markLandingDone() {
  const flow = await getFlow();
  if (!flow.landingDone) {
    await setFlow({ ...flow, landingDone: true, active: true });
  }
}
