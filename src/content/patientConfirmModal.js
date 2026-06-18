/**
 * SweetAlert2 patient confirmation modal (page-context injection + postMessage).
 */

import { toast } from '../lib/toast.js';

const RESULT_TYPE = 'edm-scr-patient-confirm-result';
const REQUEST_TYPE = 'edm-scr-patient-confirm-request';

/**
 * @typedef {object} PatientDraft
 * @property {string} firstName
 * @property {string} lastName
 * @property {string} dob — display string
 * @property {string} gender — Female | Male | Unknown
 * @property {string} [postcode]
 */

/**
 * Show modal to confirm/correct patient details when fields are missing.
 * @param {PatientDraft & { missingFields: string[] }} draft
 * @returns {Promise<PatientDraft|null>} confirmed patient or null if cancelled
 */
export function confirmPatientDetails(draft) {
  return new Promise((resolve) => {
    const requestId = `edm-scr-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const onMessage = (event) => {
      if (event.source !== window) return;
      const data = event.data;
      if (!data || data.type !== RESULT_TYPE || data.requestId !== requestId) return;

      window.removeEventListener('message', onMessage);
      if (data.error) {
        toast(data.error, 'error');
      }
      resolve(data.confirmed ? data.patient : null);
    };

    window.addEventListener('message', onMessage);

    injectPatientModalScript({
      requestId,
      draft: {
        firstName: draft.firstName || '',
        lastName: draft.lastName || '',
        dob: draft.dob || '',
        gender: draft.gender || '',
        postcode: draft.postcode || '',
        missingFields: draft.missingFields || [],
      },
    });

    setTimeout(() => {
      window.removeEventListener('message', onMessage);
      resolve(null);
    }, 5 * 60 * 1000);
  });
}

/**
 * @param {object} payload
 */
function injectPatientModalScript(payload) {
  const script = document.createElement('script');
  script.textContent = `
(function () {
  var payload = ${JSON.stringify(payload)};
  var REQUEST = ${JSON.stringify(REQUEST_TYPE)};
  var RESULT = ${JSON.stringify(RESULT_TYPE)};

  if (typeof Swal === 'undefined') {
    window.postMessage({
      type: RESULT,
      requestId: payload.requestId,
      confirmed: false,
      error: 'SweetAlert2 not available on page'
    }, '*');
    return;
  }


  var genderOptions = ['Female', 'Male'];
  var selectedGender = payload.draft.gender || '';
  if (selectedGender !== 'Female' && selectedGender !== 'Male') selectedGender = '';

  var genderSelect = genderOptions.map(function (g) {
    var sel = g === selectedGender ? ' selected' : '';
    return '<option value="' + g + '"' + sel + '>' + g + '</option>';
  }).join('');

  var html =
    '<p style="text-align:left;margin-bottom:1rem;">Patient name, date of birth, or gender is missing. Enter the details to use on NHS SCR search.</p>' +
    '<div style="text-align:left;display:flex;flex-direction:column;gap:0.75rem;">' +
    '<label>First name<br><input id="edm-scr-fn" class="swal2-input" style="margin:0.25rem 0 0;width:100%;" value="' + escapeAttr(payload.draft.firstName) + '"></label>' +
    '<label>Last name<br><input id="edm-scr-ln" class="swal2-input" style="margin:0.25rem 0 0;width:100%;" value="' + escapeAttr(payload.draft.lastName) + '"></label>' +
    '<label>Date of birth (DD/MM/YYYY or 4 May 1985)<br><input id="edm-scr-dob" class="swal2-input" style="margin:0.25rem 0 0;width:100%;" value="' + escapeAttr(payload.draft.dob) + '"></label>' +
    '<label>Gender<br><select id="edm-scr-gender" class="swal2-input" style="margin:0.25rem 0 0;width:100%;">' +
    '<option value="">— Select —</option>' + genderSelect + '</select></label>' +
    (payload.draft.postcode
      ? '<label>Postcode (optional)<br><input id="edm-scr-pc" class="swal2-input" style="margin:0.25rem 0 0;width:100%;" value="' + escapeAttr(payload.draft.postcode) + '"></label>'
      : '') +
    '</div>';

  Swal.fire({
    title: 'Confirm patient details',
    html: html,
    showCancelButton: true,
    confirmButtonText: 'Continue to NHS SCR',
    cancelButtonText: 'Cancel',
    focusConfirm: false,
    preConfirm: function () {
      var fn = document.getElementById('edm-scr-fn')?.value?.trim() || '';
      var ln = document.getElementById('edm-scr-ln')?.value?.trim() || '';
      var dob = document.getElementById('edm-scr-dob')?.value?.trim() || '';
      var gender = document.getElementById('edm-scr-gender')?.value?.trim() || '';
      var pcEl = document.getElementById('edm-scr-pc');
      var postcode = pcEl ? (pcEl.value?.trim() || '') : (payload.draft.postcode || '');

      if (!fn || !ln || !dob || !gender) {
        Swal.showValidationMessage('First name, last name, date of birth, and gender are required.');
        return false;
      }

      return {
        firstName: fn,
        lastName: ln,
        dob: dob,
        gender: gender,
        postcode: postcode
      };
    }
  }).then(function (result) {
    window.postMessage({
      type: RESULT,
      requestId: payload.requestId,
      confirmed: !!(result.isConfirmed && result.value),
      patient: result.value || null
    }, '*');
  });

  function escapeAttr(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
})();
`;
  (document.head || document.documentElement).appendChild(script);
  script.remove();
}
