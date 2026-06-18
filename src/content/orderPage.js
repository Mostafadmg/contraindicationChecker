/**
 * Rx order page — scrape patient demographics and wire SCR scan trigger.
 */

import { ORDER_PAGE, PORTAL } from '../config/selectors.config.js';
import {
  INJECT_FALLBACK_SCAN_BUTTON,
  OVERRIDE_SCR_CTA_URL,
} from '../config/config.js';
import { setPendingPatient, activateFlow } from '../lib/storage.js';
import { normaliseDob, formatDobForNhs } from '../lib/dates.js';
import { toast } from '../lib/toast.js';
import { confirmPatientDetails } from './patientConfirmModal.js';

const FALLBACK_BTN_ID = 'edm-scr-fallback-trigger';
const WIRED_ATTR = 'data-edm-scr-wired';
const ACTIVATE_EVENT = 'edm-scr-activate';
let globalListenersReady = false;
let rewriteTimer = null;

const MISSING_GENDER_VALUES = new Set(['', '—', '-', 'unknown', 'unknown gender']);

/**
 * Extract patient demographics from the order page using configured selectors.
 * Returns partial data with missingFields even when incomplete.
 * @returns {{ firstName: string, lastName: string, dob: string, gender: string, postcode: string, nhsNumber: string, missingFields: string[] }}
 */
export function extractPatientFromOrder() {
  const { firstName, lastName } = extractName();
  const dobRaw = extractDob();
  const genderRaw = extractSexFromVitals();
  const postcode = extractPostcodeFromAddress() || getOptionalField(ORDER_PAGE.postcode);
  const nhsNumber = getOptionalField(ORDER_PAGE.nhsNumber);

  const dobNorm = normaliseDob(dobRaw);
  const gender = mapGender(genderRaw);

  const missingFields = [];
  if (!firstName) missingFields.push('firstName');
  if (!lastName) missingFields.push('lastName');
  if (!dobNorm) missingFields.push('dob');
  if (isGenderMissing(genderRaw, gender)) missingFields.push('gender');

  return {
    firstName: firstName || '',
    lastName: lastName || '',
    dob: dobNorm?.display || dobRaw || '',
    dobIso: dobNorm?.iso || '',
    gender,
    postcode: postcode || '',
    nhsNumber: nhsNumber || '',
    missingFields,
  };
}

function extractName() {
  const fullName = getFieldText(ORDER_PAGE.fullName);
  if (fullName) {
    const parts = fullName.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
    }
    if (parts.length === 1) {
      return { firstName: parts[0], lastName: '' };
    }
  }

  return {
    firstName: getFieldText(ORDER_PAGE.firstName),
    lastName: getFieldText(ORDER_PAGE.lastName),
  };
}

function extractDob() {
  const displayDob = getFieldText(ORDER_PAGE.dob);
  if (displayDob) return displayDob;

  const editBtn = document.querySelector(ORDER_PAGE.dobEditButton);
  if (editBtn instanceof HTMLButtonElement) {
    const current = editBtn.getAttribute('data-edit-current')?.trim();
    if (current) return current;
  }

  return '';
}

function extractSexFromVitals() {
  const grid = document.querySelector(ORDER_PAGE.vitalsGrid);
  if (!grid) return '';

  for (const vital of grid.querySelectorAll('.od2-vital')) {
    const label = vital.querySelector('.v-lbl');
    const value = vital.querySelector('.v-text');
    if (!label || !value) continue;
    if (label.textContent?.trim().toLowerCase() !== 'sex') continue;
    return value.textContent?.trim() || '';
  }

  return '';
}

function extractPostcodeFromAddress() {
  for (const row of document.querySelectorAll(ORDER_PAGE.metaRow)) {
    const label = row.querySelector('.lbl');
    const value = row.querySelector('.val');
    if (!label || !value) continue;
    if (label.textContent?.trim().toLowerCase() !== 'address') continue;

    const address = value.textContent?.trim() || '';
    const match = address.match(/\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i);
    return match ? match[1].toUpperCase() : '';
  }

  return '';
}

/** @param {string} selector */
function getFieldText(selector) {
  if (!selector || selector.startsWith('/*')) return '';
  const el = document.querySelector(selector);
  if (!el) return '';
  if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) {
    return el.value.trim();
  }
  return el.textContent?.trim() || '';
}

/** @param {string} selector */
function getOptionalField(selector) {
  if (!selector || selector.startsWith('/*')) return '';
  return getFieldText(selector) || '';
}

/** @param {string} raw */
function mapGender(raw) {
  const lower = (raw || '').toLowerCase().trim();
  if (!lower || lower === '—' || lower === '-' || lower === 'unknown') return 'Unknown';
  if (lower.includes('female') || lower === 'f') return 'Female';
  if (lower.includes('male') || lower === 'm') return 'Male';
  return 'Unknown';
}

/** @param {string} raw @param {string} mapped */
function isGenderMissing(raw, mapped) {
  const lower = (raw || '').toLowerCase().trim();
  if (MISSING_GENDER_VALUES.has(lower)) return true;
  return mapped === 'Unknown';
}

/**
 * Build pending patient record from extracted or confirmed data.
 * @param {ReturnType<typeof extractPatientFromOrder>} draft
 */
function toPendingPatient(draft) {
  const dobNorm = normaliseDob(draft.dob);
  return {
    firstName: draft.firstName,
    lastName: draft.lastName,
    dob: dobNorm?.display || draft.dob,
    dobIso: dobNorm?.iso || draft.dobIso || '',
    dateOfBirth: formatDobForNhs(draft),
    gender: draft.gender,
    ...(draft.postcode ? { postcode: draft.postcode } : {}),
    ...(draft.nhsNumber ? { nhsNumber: draft.nhsNumber } : {}),
  };
}

/**
 * Resolve patient data — show modal when required fields are missing.
 * @returns {Promise<object|null>}
 */
export async function resolvePatientForScan() {
  const draft = extractPatientFromOrder();

  if (draft.missingFields.length === 0) {
    return toPendingPatient(draft);
  }

  const confirmed = await confirmPatientDetails(draft);
  if (!confirmed) {
    toast(
      draft.missingFields.length
        ? 'SCR scan cancelled — patient details are required.'
        : 'SCR scan cancelled.',
      'warn'
    );
    return null;
  }

  const merged = {
    ...draft,
    ...confirmed,
    missingFields: [],
  };

  const dobNorm = normaliseDob(merged.dob);
  if (!merged.firstName || !merged.lastName || !dobNorm) {
    toast('Please enter valid first name, last name, and date of birth.', 'error');
    return null;
  }
  if (isGenderMissing('', merged.gender) || merged.gender === 'Unknown') {
    toast('Please select a gender for NHS SCR search.', 'error');
    return null;
  }

  return toPendingPatient({ ...merged, dob: dobNorm.display, dobIso: dobNorm.iso });
}

/**
 * Start scan flow: validate patient, save to session, activate flow.
 * @returns {Promise<boolean>} true if patient data was saved
 */
export async function startScanFlow() {
  const patient = await resolvePatientForScan();

  if (!patient) {
    return false;
  }

  await setPendingPatient(patient);
  await activateFlow();

  if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    chrome.runtime.sendMessage({ type: 'PATIENT_READY' }, () => {
      void chrome.runtime.lastError;
    });
  }

  return true;
}

/**
 * Idempotent setup for order page — safe to call on SPA navigation and DOM updates.
 */
export function initOrderPageTrigger() {
  window.__edmScrHandleClick = handleScrButtonClick;
  window.__edmScrSavePatientOnly = () => {
    void runScrFromOrder({ openPortal: false });
  };

  ensureGlobalListeners();
  rewriteScrCtaLinks();

  if (INJECT_FALLBACK_SCAN_BUTTON) {
    injectFallbackButton();
  }
}

/** MedExpress-style: portal opens immediately; patient scrape runs in parallel. */
export function handleScrButtonClick() {
  void runScrFromOrder({ openPortal: true });
}

async function runScrFromOrder({ openPortal = true } = {}) {
  if (openPortal) {
    openPortalTab();
  }

  const draft = extractPatientFromOrder();
  let patient = buildPatientFromDraft(draft);

  if (!patient) {
    patient = await resolvePatientForScan();
  }

  if (!patient) {
    toast('NHS portal opened — enter patient details on this tab if search does not auto-fill.', 'warn');
    return;
  }

  await setPendingPatient(patient);
  notifyPatientReady();
}

function buildPatientFromDraft(draft) {
  if (draft.missingFields.length === 0) {
    return toPendingPatient(draft);
  }
  if (canSearchWithPartialDraft(draft)) {
    return toPendingPatient({ ...draft, gender: draft.gender || 'Unknown' });
  }
  return null;
}

/** Allow Advanced search when only gender is missing — NHS "All" radio. */
function canSearchWithPartialDraft(draft) {
  const needs = new Set(draft.missingFields);
  if (needs.size === 1 && needs.has('gender')) return true;
  if (needs.size === 0) return true;
  return false;
}

function notifyPatientReady() {
  if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    chrome.runtime.sendMessage({ type: 'PATIENT_READY' }, () => {
      void chrome.runtime.lastError;
    });
  }
}

function scheduleRewriteScrCtaLinks() {
  clearTimeout(rewriteTimer);
  rewriteTimer = setTimeout(() => {
    rewriteScrCtaLinks();
  }, 150);
}

function ensureGlobalListeners() {
  if (globalListenersReady) return;
  globalListenersReady = true;

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        scheduleRewriteScrCtaLinks();
        return;
      }

      if (
        mutation.type === 'attributes'
        && mutation.target instanceof Element
        && mutation.target.matches(ORDER_PAGE.trigger)
      ) {
        scheduleRewriteScrCtaLinks();
        return;
      }
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['href', WIRED_ATTR],
  });
}

/** Open NHS portal in a new tab (background API avoids popup blockers). */
function openPortalTab() {
  if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    chrome.runtime.sendMessage(
      { type: 'OPEN_PORTAL_TAB', url: PORTAL.entryUrl },
      () => {
        if (chrome.runtime.lastError) {
          window.open(PORTAL.entryUrl, '_blank', 'noopener,noreferrer');
        }
      }
    );
    return;
  }

  window.open(PORTAL.entryUrl, '_blank', 'noopener,noreferrer');
}

function activateScrScan() {
  handleScrButtonClick();
}

/** Dev: point `.scr-cta` at /find_patient instead of the NHS auth URL baked into the page. */
function rewriteScrCtaLinks() {
  for (const link of document.querySelectorAll(ORDER_PAGE.trigger)) {
    wireScrCtaLink(link);
  }
}

/** @param {Element} link */
function wireScrCtaLink(link) {
  if (!(link instanceof HTMLAnchorElement)) return;

  if (OVERRIDE_SCR_CTA_URL) {
    if (link.getAttribute('href') !== PORTAL.entryUrl) {
      link.setAttribute('href', PORTAL.entryUrl);
    }
    if (link.target !== '_blank') link.target = '_blank';
    if (link.rel !== 'noopener noreferrer') link.rel = 'noopener noreferrer';
  }

  if (link.getAttribute(WIRED_ATTR) === '1') return;
  link.setAttribute(WIRED_ATTR, '1');

  link.addEventListener(ACTIVATE_EVENT, () => {
    activateScrScan();
  });

  console.info('[edm-scr] Go to NHS SCR wired →', PORTAL.entryUrl);
}

function injectFallbackButton() {
  const tryInject = () => {
    if (document.getElementById(FALLBACK_BTN_ID)) return;

    const anchor = document.querySelector(ORDER_PAGE.trigger);
    if (!anchor?.parentElement) return;

    const btn = document.createElement('button');
    btn.id = FALLBACK_BTN_ID;
    btn.type = 'button';
    btn.textContent = 'Scan SCR';
    Object.assign(btn.style, {
      marginLeft: '8px',
      padding: '6px 12px',
      cursor: 'pointer',
      background: '#0d9488',
      color: '#fff',
      border: 'none',
      borderRadius: '4px',
      fontSize: '14px',
    });

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      activateScrScan();
    });

    anchor.parentElement.insertBefore(btn, anchor.nextSibling);
  };

  tryInject();
}
