/**
 * Session-only storage helpers — no patient data persisted beyond browser session.
 */

const KEYS = {
  flow: 'flow',
  pendingPatient: 'pendingPatient',
  scanResult: 'scanResult',
  resultsTabId: 'resultsTabId',
};

/** Default automation flow state when a scan starts. */
export function defaultFlowState(overrides = {}) {
  return {
    active: true,
    awaitingManualSelect: false,
    scanComplete: false,
    landingDone: false,
    findPatientDone: false,
    searchResultsDone: false,
    clinicalTabClicked: false,
    consentHandled: false,
    ...overrides,
  };
}

/** Mark the SCR automation flow as active — resets step flags unless overridden. */
export async function activateFlow(overrides = {}) {
  await setFlow(defaultFlowState({ active: true, ...overrides }));
  await chrome.storage.session.set({ scanPending: true });
}

/** @returns {Promise<{ active: boolean, awaitingManualSelect?: boolean, scanComplete?: boolean, findPatientDone?: boolean, searchResultsDone?: boolean, patientPageDone?: boolean, consentHandled?: boolean }>} */
export async function getFlow() {
  const data = await chrome.storage.session.get(KEYS.flow);
  return data[KEYS.flow] || { active: false };
}

/** @param {object} flow */
export async function setFlow(flow) {
  await chrome.storage.session.set({ [KEYS.flow]: flow });
}

/** @returns {Promise<object|null>} */
export async function getPendingPatient() {
  const data = await chrome.storage.session.get(KEYS.pendingPatient);
  return data[KEYS.pendingPatient] || null;
}

/** @param {object} patient */
export async function setPendingPatient(patient) {
  await chrome.storage.session.set({ [KEYS.pendingPatient]: patient });
}

/** @returns {Promise<object|null>} */
export async function getScanResult() {
  const data = await chrome.storage.session.get(KEYS.scanResult);
  return data[KEYS.scanResult] || null;
}

/** @param {object} result */
export async function setScanResult(result) {
  await chrome.storage.session.set({ [KEYS.scanResult]: result });
}

export async function clearScanResult() {
  await chrome.storage.session.remove(KEYS.scanResult);
}

/** @returns {Promise<number|null>} */
export async function getResultsTabId() {
  const data = await chrome.storage.session.get(KEYS.resultsTabId);
  return data[KEYS.resultsTabId] ?? null;
}

/** @param {number|null} tabId */
export async function setResultsTabId(tabId) {
  if (tabId == null) {
    await chrome.storage.session.remove(KEYS.resultsTabId);
  } else {
    await chrome.storage.session.set({ [KEYS.resultsTabId]: tabId });
  }
}
