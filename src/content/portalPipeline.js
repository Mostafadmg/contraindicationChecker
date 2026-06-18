/**
 * MedExpress-style linear NHS portal pipeline — runs all applicable steps in one burst.
 */

import { URLS, isFindPatientFormVisible } from '../config/selectors.config.js';
import { getFlow, setFlow, getPendingPatient, activateFlow } from '../lib/storage.js';
import { handleLanding } from './landing.js';
import { handleFindPatient } from './findPatient.js';
import { handleSearchResults, onPatientPageReached } from './searchResults.js';
import { handlePatientPage } from './patientPage.js';
import { handleScan } from './scan.js';
import { isScrContentPresent } from './scrParser.js';

let pipelineRunning = false;

/** @returns {boolean} */
export function isNhsPortalUrl(href = location.href) {
  return href.includes('/nationalcarerecordsservice/');
}

/**
 * Run every automation step that applies on the current page without waiting for
 * the next debounce cycle (matches MedExpress sequential flow).
 */
export async function runPortalPipeline() {
  if (pipelineRunning) return;
  pipelineRunning = true;

  try {
    let flow = await ensureScanFlowActive();
    if (!flow.active || flow.scanComplete) return;

    const patient = await getPendingPatient();
    if (!patient) {
      const { scanPending } = await chrome.storage.session.get('scanPending');
      if (scanPending) return;
      return;
    }

    const href = location.href;

    if (
      (URLS.landing.test(href) || isFindPatientFormVisible())
      && !flow.landingDone
      && !isFindPatientFormVisible()
    ) {
      await handleLanding();
      flow = await getFlow();
    }

    if (!flow.landingDone && isFindPatientFormVisible()) {
      await setFlow({ ...flow, landingDone: true });
      flow = await getFlow();
    }

    if (
      !flow.findPatientDone
      && (isFindPatientFormVisible() || URLS.findPatient.test(href))
    ) {
      await handleFindPatient();
      flow = await getFlow();
    }

    if (
      !flow.searchResultsDone
      && !flow.awaitingManualSelect
      && (URLS.searchResults.test(href) || document.querySelector('.query-results-container'))
    ) {
      await handleSearchResults();
      flow = await getFlow();
    }

    if (
      URLS.patientPage.test(href)
      || document.querySelector('#patient-clinicals-navigation-tab')
    ) {
      await onPatientPageReached();
      flow = await getFlow();

      if (isScrContentPresent()) {
        await handleScan();
      } else if (!flow.scanComplete) {
        await handlePatientPage();
        if (isScrContentPresent()) {
          await handleScan();
        }
      }
      return;
    }

    if (isScrContentPresent() && flow.active && !flow.scanComplete) {
      await handleScan();
    }
  } catch (err) {
    console.error('[edm-scr] Portal pipeline error:', err);
  } finally {
    pipelineRunning = false;
  }
}

async function ensureScanFlowActive() {
  const flow = await getFlow();
  if (flow.active) return flow;

  const patient = await getPendingPatient();
  if (patient && isNhsPortalUrl()) {
    await activateFlow({ landingDone: false });
    return getFlow();
  }

  return flow;
}
