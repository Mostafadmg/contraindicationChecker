/**
 * NHS find-patient — advanced search (MedExpress: single DOB, fast poll, immediate submit).
 */

import { FIND_PATIENT, SEARCH_RESULTS } from '../config/selectors.config.js';
import { DOM_WAIT_TIMEOUT_MS } from '../config/config.js';
import { getFlow, setFlow, getPendingPatient } from '../lib/storage.js';
import { formatDobForNhs } from '../lib/dates.js';
import {
  waitForContentChange,
  setNativeValue,
  clickNhsButton,
} from '../lib/dom.js';
import { toast } from '../lib/toast.js';

let fillingInProgress = false;

/**
 * Handle find_patient step when flow is active.
 */
export async function handleFindPatient() {
  const flow = await getFlow();
  if (!flow.active || flow.findPatientDone) return;
  if (fillingInProgress) return;

  const patient = await getPendingPatient();
  if (!patient) {
    const { scanPending } = await chrome.storage.session.get('scanPending');
    if (scanPending || flow.active) return;
    toast('No patient data in session. Start from an order page.', 'error');
    await setFlow({ ...flow, active: false });
    return;
  }

  fillingInProgress = true;

  try {
    await waitForContentChange([FIND_PATIENT.advancedTab, FIND_PATIENT.basicTab], {
      timeout: DOM_WAIT_TIMEOUT_MS,
    }).catch(() => {});

    if (!document.querySelector(FIND_PATIENT.firstName)) {
      const advancedTab = document.querySelector(FIND_PATIENT.advancedTab);
      if (advancedTab) clickNhsButton(advancedTab);
    }

    await waitForContentChange([FIND_PATIENT.form, FIND_PATIENT.genderFemale], {
      timeout: DOM_WAIT_TIMEOUT_MS,
    });

    const form = document.querySelector(FIND_PATIENT.form);
    if (!form) throw new Error('Advanced search form not found');

    await fillAdvancedSearch(form, patient);

    const submitBtn = document.querySelector('#advanced-search-form button[type="submit"]');
    if (!submitBtn) throw new Error('Advanced search submit button not found');
    clickNhsButton(submitBtn);

    await setFlow({ ...(await getFlow()), findPatientDone: true });

    await waitForContentChange(
      [SEARCH_RESULTS.container, SEARCH_RESULTS.tableBody],
      { timeout: DOM_WAIT_TIMEOUT_MS }
    ).catch(() => {
      /* results step will retry on next pipeline tick */
    });
  } catch (err) {
    console.error('[edm-scr] Find patient failed:', err);
    toast('Find patient form failed — retrying…', 'warn');
  } finally {
    fillingInProgress = false;
  }
}

/** @param {HTMLFormElement} form @param {object} patient */
async function fillAdvancedSearch(form, patient) {
  const genderMap = {
    Female: FIND_PATIENT.genderFemale,
    Male: FIND_PATIENT.genderMale,
    Unknown: FIND_PATIENT.genderAll,
  };
  const genderSelector = genderMap[patient.gender] || FIND_PATIENT.genderAll;
  const genderRadio = form.querySelector(genderSelector);
  if (genderRadio) {
    genderRadio.click();
    genderRadio.dispatchEvent(new Event('change', { bubbles: true }));
  }

  const firstNameEl = form.querySelector(FIND_PATIENT.firstName);
  const lastNameEl = form.querySelector(FIND_PATIENT.lastName);
  if (firstNameEl) setNativeValue(firstNameEl, patient.firstName || '');
  if (lastNameEl) setNativeValue(lastNameEl, patient.lastName || '');

  const singleDateLink = form.querySelector(FIND_PATIENT.dobSingleDateLink);
  if (singleDateLink) {
    singleDateLink.click();
    await waitForContentChange([FIND_PATIENT.dobSingle], {
      timeout: DOM_WAIT_TIMEOUT_MS,
    }).catch(() => {});
  }

  const dobSingle = form.querySelector(FIND_PATIENT.dobSingle);
  const dobNhs = formatDobForNhs(patient);
  if (dobSingle) {
    setNativeValue(dobSingle, dobNhs);
  } else {
    const dobFromEl = form.querySelector(FIND_PATIENT.dobFrom);
    const dobToEl = form.querySelector(FIND_PATIENT.dobTo);
    const dobDisplay = patient.dob?.display || patient.dob || dobNhs;
    if (dobFromEl) setNativeValue(dobFromEl, dobDisplay);
    if (dobToEl) setNativeValue(dobToEl, dobDisplay);
  }

  if (patient.postcode) {
    const postcodeEl = form.querySelector(FIND_PATIENT.postcode);
    if (postcodeEl) setNativeValue(postcodeEl, patient.postcode);
  }
}
