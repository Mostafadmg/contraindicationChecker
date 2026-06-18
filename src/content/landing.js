/**
 * NHS portal landing page — verify org code and click "Confirm and continue".
 */

import { PORTAL, isFindPatientFormVisible } from '../config/selectors.config.js';
import {
  DOM_WAIT_TIMEOUT_MS,
  LANDING_RETRY_MS,
  NHS_AUTH_TEXT_SUBSTRING,
  NHS_AUTH_ORG_LABEL,
} from '../config/config.js';
import { getFlow, setFlow, getPendingPatient, activateFlow } from '../lib/storage.js';
import {
  waitForContentChange,
  clickNhsButton,
  isElementVisible,
} from '../lib/dom.js';
import { toast } from '../lib/toast.js';

let confirmInProgress = false;
let lastAttemptAt = 0;
let authFailureShown = false;

/**
 * Verify the logged-in NHS org matches EveryDayMeds (FJE59).
 * @returns {boolean}
 */
export function verifyNhsOrgAuth() {
  const bodyText = document.body?.innerText || document.body?.textContent || '';
  if (bodyText.includes(NHS_AUTH_TEXT_SUBSTRING)) return true;
  if (bodyText.includes(NHS_AUTH_ORG_LABEL)) return true;

  if (!authFailureShown) {
    authFailureShown = true;
    toast(
      `Wrong NHS organisation — log in as ${NHS_AUTH_ORG_LABEL} (${NHS_AUTH_TEXT_SUBSTRING}).`,
      'error'
    );
  }
  return false;
}

/**
 * Find the green "Confirm and continue" control (id or button text).
 * @returns {HTMLElement|null}
 */
export function findLandingConfirmButton() {
  const byId = document.querySelector(PORTAL.landingConfirmButton);
  if (byId instanceof HTMLElement && isElementVisible(byId)) return byId;

  for (const el of document.querySelectorAll('button, input[type="submit"], a')) {
    const text = (el.textContent || el.value || '').trim();
    if (
      text.includes('Confirm and continue to Find a patient')
      || text.includes('Confirm and continue')
    ) {
      return /** @type {HTMLElement} */ (el);
    }
  }

  return null;
}

/**
 * Click confirm on /landing, then wait for find-patient form (SPA — URL may stay /landing).
 */
export async function handleLanding() {
  if (!verifyNhsOrgAuth()) return;

  if (isFindPatientFormVisible()) {
    const flow = await getFlow();
    if (!flow.landingDone) {
      await setFlow({ ...flow, landingDone: true });
    }
    return;
  }

  let flow = await getFlow();
  const patient = await getPendingPatient();

  if (!flow.active && patient) {
    await activateFlow({ landingDone: false });
    flow = await getFlow();
  }

  if (!flow.active || flow.landingDone || confirmInProgress) return;

  const now = Date.now();
  if (now - lastAttemptAt < LANDING_RETRY_MS) return;
  lastAttemptAt = now;

  confirmInProgress = true;

  try {
    await waitForContentChange([PORTAL.roleSelectHeader, PORTAL.landingConfirmButton], {
      timeout: DOM_WAIT_TIMEOUT_MS,
    }).catch(() => {});

    const btn = findLandingConfirmButton();
    if (!btn) {
      throw new Error('Confirm button not found');
    }

    clickNhsButton(btn);
    console.info('[edm-scr] Clicked Confirm and continue to Find a patient');

    await waitForContentChange(
      [PORTAL.findPatientAdvancedTab, PORTAL.findPatientBasicTab],
      { timeout: DOM_WAIT_TIMEOUT_MS }
    );

    await setFlow({ ...(await getFlow()), landingDone: true });
  } catch (err) {
    if (isFindPatientFormVisible()) {
      await setFlow({ ...(await getFlow()), landingDone: true });
      return;
    }
    const nav = document.querySelector(PORTAL.findPatientNavButton);
    if (nav) {
      clickNhsButton(nav);
      await waitForContentChange(
        [PORTAL.findPatientAdvancedTab, PORTAL.findPatientBasicTab],
        { timeout: DOM_WAIT_TIMEOUT_MS }
      ).catch(() => {});
      await setFlow({ ...(await getFlow()), landingDone: true });
    } else {
      console.warn('[edm-scr] Landing step:', err);
    }
  } finally {
    confirmInProgress = false;
  }
}
