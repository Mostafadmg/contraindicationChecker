/**
 * Background find-patient automation — MAIN world form fill (MedExpress-style).
 */

import { getFlow, setFlow } from '../lib/storage.js';

const FIND_PATIENT_RE = /\/nationalcarerecordsservice\/app\/find_patient/;

/** @type {Map<number, ReturnType<typeof setTimeout>>} */
const retryTimers = new Map();

/**
 * Runs in MAIN world with serialised patient payload.
 * @param {object} patient
 */
function fillFindPatientMainWorld(patient) {
  const MONTHS = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  };

  function formatDob(p) {
    if (p.dateOfBirth) return p.dateOfBirth;
    const raw = String(p.dob || p.dobIso || '').trim();
    const named = raw.match(/^(\d{1,2})[-\s]([A-Za-z]{3,9})[-\s](\d{4})$/);
    if (named) {
      const mm = MONTHS[named[2].slice(0, 3).toLowerCase()];
      if (mm) return `${named[1].padStart(2, '0')}/${mm}/${named[3]}`;
    }
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(raw)) return raw;
    const iso = String(p.dobIso || raw);
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      const [y, m, d] = iso.split('-');
      return `${d}/${m}/${y}`;
    }
    return raw;
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
    if (form && typeof form.requestSubmit === 'function') form.requestSubmit(el);
    el.click();
  }

  function setInputValue(input, value) {
    const proto = Object.getPrototypeOf(input);
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(input, value);
    else input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function clickAdvancedTab() {
    const selectors = ['#advanced-search-tab', 'a#advanced-search-tab', '[href="#advanced-search"]'];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        clickEl(el);
        return true;
      }
    }
    return false;
  }

  if (document.querySelector('.query-results-container')) {
    return 'results-ready';
  }

  const firstNameEl = document.querySelector('#advanced-search-form-firstname');
  if (!firstNameEl) {
    if (!clickAdvancedTab()) return 'no-tabs';
    return 'tab-clicked';
  }

  const genderSelector =
    patient.gender === 'Male'
      ? '#advanced-search-form-gender-2'
      : patient.gender === 'Female'
        ? '#advanced-search-form-gender-1'
        : '#advanced-search-form-gender-3';

  const genderRadio = document.querySelector(genderSelector);
  const lastNameEl = document.querySelector('#advanced-search-form-surname');
  if (!genderRadio || !lastNameEl) return 'form-loading';

  let dobInput = document.querySelector('#advanced-search-form-dob-single');
  if (!dobInput) {
    const singleLink = document.querySelector('#advanced-search-form-dob-control-a');
    if (singleLink) {
      clickEl(singleLink);
      return 'dob-mode-clicked';
    }
    return 'form-loading';
  }

  clickEl(genderRadio);
  genderRadio.dispatchEvent(new Event('change', { bubbles: true }));
  setInputValue(firstNameEl, patient.firstName || '');
  setInputValue(lastNameEl, patient.lastName || '');
  setInputValue(dobInput, formatDob(patient));

  if (patient.postcode) {
    const pc = document.querySelector('#advanced-search-form-postcode');
    if (pc) setInputValue(pc, patient.postcode);
  }

  const submitBtn = document.querySelector('#advanced-search-form button[type="submit"]');
  if (!submitBtn) return 'no-submit';

  clickEl(submitBtn);
  return 'submitted';
}

export function initFindPatientAutomation() {
  chrome.tabs.onUpdated.addListener(onTabUpdated);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'session') return;
    if (changes.pendingPatient || changes.flow || changes.scanPending) {
      chrome.storage.session.get('portalTabId').then(({ portalTabId }) => {
        if (portalTabId != null) scheduleFindPatientRetries(portalTabId);
      });
    }
  });
}

export function scheduleFindPatientRetries(tabId) {
  stopFindPatientRetries(tabId);

  let attempts = 0;
  const maxAttempts = 200;

  const tick = async () => {
    attempts += 1;

    try {
      if (!(await shouldAutomateFindPatient(tabId))) {
        stopFindPatientRetries(tabId);
        return;
      }

      const data = await chrome.storage.session.get(['pendingPatient']);
      const patient = data.pendingPatient;
      if (!patient) {
        if (attempts >= maxAttempts) stopFindPatientRetries(tabId);
        else retryTimers.set(tabId, setTimeout(tick, 150));
        return;
      }

      const tab = await chrome.tabs.get(tabId).catch(() => null);
      if (!tab?.id || tab.status !== 'complete') {
        if (attempts >= maxAttempts) stopFindPatientRetries(tabId);
        else retryTimers.set(tabId, setTimeout(tick, 150));
        return;
      }

      const url = tab.url || '';
      if (!FIND_PATIENT_RE.test(url)) {
        if (attempts >= maxAttempts) stopFindPatientRetries(tabId);
        else retryTimers.set(tabId, setTimeout(tick, 150));
        return;
      }

      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: fillFindPatientMainWorld,
        args: [patient],
      });

      if (result === 'results-ready' || result === 'submitted') {
        console.info('[edm-scr] Find patient filled (MAIN):', result, patient.firstName, patient.lastName);
        await markFindPatientDone();
        stopFindPatientRetries(tabId);
        return;
      }

      if (attempts >= maxAttempts) {
        console.warn('[edm-scr] Find patient automation timed out:', result);
        stopFindPatientRetries(tabId);
        return;
      }

      retryTimers.set(tabId, setTimeout(tick, 150));
    } catch (err) {
      console.warn('[edm-scr] Find patient fill attempt failed:', err);
      if (attempts < maxAttempts) {
        retryTimers.set(tabId, setTimeout(tick, 150));
      } else {
        stopFindPatientRetries(tabId);
      }
    }
  };

  tick();
}

async function onTabUpdated(tabId, changeInfo, tab) {
  const url = changeInfo.url || tab.url || '';
  if (!FIND_PATIENT_RE.test(url)) return;
  if (changeInfo.status !== 'complete') return;
  if (!(await shouldAutomateFindPatient(tabId))) return;
  scheduleFindPatientRetries(tabId);
}

async function shouldAutomateFindPatient(tabId) {
  const data = await chrome.storage.session.get(['flow', 'scanPending', 'portalTabId']);
  const flow = data.flow || {};
  if (flow.findPatientDone || flow.scanComplete) return false;
  if (data.portalTabId === tabId) return true;
  if (data.scanPending) return true;
  if (flow.active) return true;
  return false;
}

function stopFindPatientRetries(tabId) {
  const timer = retryTimers.get(tabId);
  if (timer) clearTimeout(timer);
  retryTimers.delete(tabId);
}

async function markFindPatientDone() {
  const flow = await getFlow();
  if (!flow.findPatientDone) {
    await setFlow({ ...flow, findPatientDone: true, landingDone: true, active: true });
  }
}
