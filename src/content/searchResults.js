/**
 * NHS search results — parse rows, match patient, auto-select (MedExpress speed).
 */

import { SEARCH_RESULTS } from '../config/selectors.config.js';
import { DOM_WAIT_TIMEOUT_MS } from '../config/config.js';
import { getFlow, setFlow, getPendingPatient } from '../lib/storage.js';
import { matchPatient } from '../lib/patientMatch.js';
import { waitForContentChange } from '../lib/dom.js';
import { toast } from '../lib/toast.js';

let processingResults = false;

/**
 * Handle search_results step when flow is active.
 */
export async function handleSearchResults() {
  const flow = await getFlow();
  if (!flow.active) return;
  if (flow.awaitingManualSelect) return;
  if (flow.searchResultsDone) return;
  if (processingResults) return;

  processingResults = true;

  try {
    await waitForContentChange(
      [SEARCH_RESULTS.container, SEARCH_RESULTS.tableBody],
      { timeout: DOM_WAIT_TIMEOUT_MS }
    );

    const rows = parseSearchRows();
    const patient = await getPendingPatient();

    if (!rows.length) {
      toast('No matching patient found.', 'error');
      await setFlow({ ...flow, active: false });
      return;
    }

    const evaluated = rows.map((row) => ({
      row,
      match: matchPatient(patient, row),
    }));

    const confident = evaluated.filter((e) => e.match.confident);

    if (confident.length === 1) {
      confident[0].row.element.click();
      await setFlow({ ...flow, searchResultsDone: true });
      await waitForContentChange(['#patient-clinicals-navigation-tab'], {
        timeout: DOM_WAIT_TIMEOUT_MS,
      }).catch(() => {});
      return;
    }

    toast('Multiple/ambiguous results — please select the correct patient.', 'warn');
    await setFlow({ ...flow, awaitingManualSelect: true });
  } catch (err) {
    console.error('[edm-scr] Search results failed:', err);
    const currentFlow = await getFlow();
    await setFlow({ ...currentFlow, active: false });
  } finally {
    processingResults = false;
  }
}

/** @returns {object[]} */
function parseSearchRows() {
  const tbody = document.querySelector(SEARCH_RESULTS.tableBody);
  if (!tbody) return [];

  return Array.from(tbody.querySelectorAll(SEARCH_RESULTS.dataRow)).map((tr) => {
    const getCell = (sel) => tr.querySelector(sel)?.textContent?.trim() || '';
    return {
      element: tr,
      name: getCell(SEARCH_RESULTS.nameCell) || tr.querySelector('td')?.textContent?.trim() || '',
      gender: getCell(SEARCH_RESULTS.genderCell),
      dob: getCell(SEARCH_RESULTS.dobCell),
      address: getCell(SEARCH_RESULTS.addressCell),
      nhsNumber: getCell(SEARCH_RESULTS.nhsNumberCell),
      gpCode: getCell(SEARCH_RESULTS.gpCodeCell),
    };
  });
}

/**
 * Clear awaitingManualSelect when user navigates to patient page manually.
 */
export async function onPatientPageReached() {
  const flow = await getFlow();
  if (flow.awaitingManualSelect) {
    await setFlow({
      ...flow,
      awaitingManualSelect: false,
      searchResultsDone: true,
    });
  }
}
