/**
 * Central registry for ALL DOM selectors and URL patterns.
 * Update here when NHS portal or Rx order page markup changes.
 */

/** True when the Rx order workspace is open (SPA-safe). */
export function isOrderPageUrl(href = location.href) {
  try {
    const { hostname, pathname } = new URL(href);
    return hostname === 'rx.everydaymeds.co.uk' && pathname.startsWith('/order/');
  } catch {
    return false;
  }
}

/** URL path patterns used by the state machine to route steps. */
export const URLS = {
  orderPage: isOrderPageUrl,
  landing: /\/nationalcarerecordsservice\/app\/landing/,
  findPatient: /\/nationalcarerecordsservice\/app\/find_patient/,
  searchResults: /\/nationalcarerecordsservice\/app\/search_results/,
  patientPage: /\/nationalcarerecordsservice\/app\/patient/,
};

/**
 * NHS portal URLs and landing-page controls.
 */
export const PORTAL = {
  /** Role confirm page — NHS may redirect here even when opening find_patient. */
  landingUrl:
    'https://portal.spineservices.nhs.uk/nationalcarerecordsservice/app/landing',
  /** Tab opened from Rx order — go straight to find patient (MedExpress). */
  entryUrl:
    'https://portal.spineservices.nhs.uk/nationalcarerecordsservice/app/find_patient',
  findPatientUrl:
    'https://portal.spineservices.nhs.uk/nationalcarerecordsservice/app/find_patient',
  landingConfirmButton: '#confirm-current-role',
  roleSelectHeader: '#select-role-header',
  findPatientBasicTab: '#basic-search-tab',
  findPatientAdvancedTab: '#advanced-search-tab',
  findPatientNavButton: '#masthead-find-patient-button',
};

/** NHS landing is a SPA — find-patient form can appear while URL stays on /landing. */
export function isFindPatientFormVisible(root = document) {
  return Boolean(
    root.querySelector(PORTAL.findPatientAdvancedTab)
      || root.querySelector(PORTAL.findPatientBasicTab)
  );
}

/** Rx order page — patient panel in `.od2-col-left`. */
export const ORDER_PAGE = {
  trigger: '.scr-cta',
  /** Full name in one element (e.g. "Helen Batters"); split into first/last. */
  fullName: '.patient-name-text',
  /** Optional separate fields if the page uses split name inputs. */
  firstName: '',
  lastName: '',
  dob: '.meta-val-text[data-meta="dob"]',
  /** Edit button carries `data-edit-current="DD/MM/YYYY"` when display text is empty. */
  dobEditButton: 'button[data-edit-field="dob"]',
  vitalsGrid: '.od2-vitals-grid',
  metaRow: '.od2-meta-row',
  /** Not shown on the order page; leave empty unless added to the UI later. */
  postcode: '',
  nhsNumber: '',
};

/** NHS find-patient advanced search form. */
export const FIND_PATIENT = {
  advancedTab: '#advanced-search-tab',
  basicTab: '#basic-search-tab',
  nhsNumberTab: '#nhs-number-search-tab',
  form: '#advanced-search-form',
  genderFemale: '#advanced-search-form-gender-1',
  genderMale: '#advanced-search-form-gender-2',
  genderAll: '#advanced-search-form-gender-3',
  firstName: '#advanced-search-form-firstname',
  lastName: '#advanced-search-form-surname',
  dobFrom: '#advanced-search-form-dob-date-range-from',
  dobTo: '#advanced-search-form-dob-date-range-to',
  dobSingleDateLink: '#advanced-search-form-dob-control-a',
  dobSingle: '#advanced-search-form-dob-single',
  postcode: '#advanced-search-form-postcode',
  submitButton: '.patient-search-form__button, #advanced-search-form button[type="submit"]',
};

/** NHS search results table. */
export const SEARCH_RESULTS = {
  container: '.query-results-container',
  tableBody: 'table.query-results-table tbody',
  dataRow: 'tr.query-results-table__data-row',
  nameCell: 'td[id$="_name0"] .query-results-table__data-row-name',
  genderCell: 'td[id$="_Gender1"]',
  dobCell: 'td[id$="_dob2"]',
  addressCell: 'td[id$="_Address3"]',
  nhsNumberCell: 'td[id$="_nhsNumber4"] .query-results-table__data-row-nhsNumber',
  gpCodeCell: 'td[id$="_GP Code5"]',
};

/** NHS patient page clinical tab. */
export const PATIENT_PAGE = {
  clinicalTab: '#patient-clinicals-navigation-tab',
  clinicalTabActiveClass: 'nhsuk-tab-set__tab--active',
};

/** SCR consent modal — never interact with no or emergency buttons. */
export const CONSENT = {
  yesButton: '#access-management-yes',
  noButton: '#access-management-no',
  emergencyButton: '#access-management-emergency',
  modalRoot: '[id*="access-management"], .nhsuk-modal',
};

/** SCR clinical content and patient banner. */
export const SCR = {
  table: 'table.scr-table',
  spacerRow: '.scr-table__cell--spacer',
  supportingInset: '.scr-supporting-inset',
  /** Static section element ids (subset may be present). */
  staticSectionIds: [
    'AllergiesandAdverseReactions',
    'CurrentRepeatMedications',
    'Diagnoses',
    'ProblemsandIssues',
    'ClinicalObservationsandFindings',
    'Treatments',
    'InvestigationResults',
    'FamilyHistory',
    'CareEvents',
    'ServicesCareProfessionalsandCarers',
    'CareProfessionalDocumentation',
    'PatientCarerCorrespondence',
  ],
  /** Prefix patterns for dated section ids. */
  prefixSectionIds: ['AcuteMedications', 'DiscontinuedRepeatMedications'],
};

/** Patient summary banner on SCR view. */
export const BANNER = {
  name: '#summary-name',
  age: '#summary-age',
  gender: '#summary-gender',
  dob: '#summary-dob',
  address: '#summary-address',
  nhsNumber: '[id*="summary-nhs"], #summary-nhs-number, .summary-nhs-number',
};
