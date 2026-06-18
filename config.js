// Configuration — same shape as MedExpress SCR extension
const SCR_CONFIG = {
  NHS_URL:
    'https://portal.spineservices.nhs.uk/nationalcarerecordsservice/app/find_patient',
  MAIN_APP_HOMEPAGE: 'https://rx.everydaymeds.co.uk',
  EXTENSION_VERSION: '2.0.4',
  /** Shown on NHS landing role-confirm page for EveryDayMeds */
  AUTH_TEXT: 'EVERYDAYMEDS',
  AUTH_ORG_CODE: 'FJE59',
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
  REDIRECT_WAIT_TIME: 2000,
  DOM_WAIT_TIMEOUT: 5000,
};

if (typeof self !== 'undefined') {
  self.SCR_CONFIG = SCR_CONFIG;
}
if (typeof window !== 'undefined') {
  window.SCR_CONFIG = SCR_CONFIG;
}
