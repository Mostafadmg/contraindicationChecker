/**
 * NHS patient page — Clinical tab + consent (MedExpress: auto-click Yes).
 */

import { PATIENT_PAGE, CONSENT } from '../config/selectors.config.js';
import {
  AUTO_CONFIRM_CONSENT,
  DOM_WAIT_TIMEOUT_MS,
} from '../config/config.js';
import { getFlow, setFlow } from '../lib/storage.js';
import {
  waitForContentChange,
  scrollIntoViewIfNeeded,
  clickNhsButton,
} from '../lib/dom.js';
import { toast } from '../lib/toast.js';
import { isScrContentPresent } from './scrParser.js';

let patientPageInProgress = false;

/**
 * Handle patient page step — click Clinical tab and manage consent modal.
 */
export async function handlePatientPage() {
  const flow = await getFlow();
  if (!flow.active || flow.scanComplete) return;
  if (isScrContentPresent()) return;
  if (patientPageInProgress) return;

  patientPageInProgress = true;

  try {
    if (!flow.clinicalTabClicked) {
      const clinicalTab = await waitForContentChange([PATIENT_PAGE.clinicalTab], {
        timeout: DOM_WAIT_TIMEOUT_MS,
      });

      if (!clinicalTab.classList.contains(PATIENT_PAGE.clinicalTabActiveClass)) {
        clickNhsButton(clinicalTab);
      }

      await setFlow({ ...flow, clinicalTabClicked: true });
    }

    await handleConsentModal();
  } catch (err) {
    console.warn('[edm-scr] Patient page step:', err);
  } finally {
    patientPageInProgress = false;
  }
}

async function handleConsentModal() {
  const flow = await getFlow();
  if (flow.consentHandled && !AUTO_CONFIRM_CONSENT) return;

  let yesButton;
  try {
    yesButton = await waitForContentChange(
      [CONSENT.yesButton, '.clinicals-page', '.scr-print-wrapper'],
      { timeout: DOM_WAIT_TIMEOUT_MS }
    );
  } catch {
    return;
  }

  if (
    yesButton.id !== 'access-management-yes'
    && (yesButton.classList?.contains('clinicals-page') || document.querySelector('.scr-print-wrapper'))
  ) {
    await setFlow({ ...(await getFlow()), consentHandled: true });
    return;
  }

  if (
    AUTO_CONFIRM_CONSENT
    && yesButton instanceof HTMLElement
    && yesButton.id === 'access-management-yes'
    && !flow.consentHandled
  ) {
    clickNhsButton(yesButton);
    await setFlow({ ...(await getFlow()), consentHandled: true });
    await waitForContentChange(['.scr-print-wrapper', '.clinicals-page'], {
      timeout: DOM_WAIT_TIMEOUT_MS,
    }).catch(() => {});
    return;
  }

  if (!flow.consentHandled) {
    scrollIntoViewIfNeeded(yesButton);
    toast('Confirm patient consent to continue the scan.', 'info');
  }
}
