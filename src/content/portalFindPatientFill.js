/**
 * Plain-script find patient fill — MedExpress Advanced search sequence.
 */
(function () {
  const FIND_PATIENT_RE = /\/nationalcarerecordsservice\/app\/find_patient/;
  const RETRY_MS = 150;
  const MAX_MS = 120000;
  const startedAt = Date.now();
  let filling = false;
  let statusShown = false;

  const MONTHS = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  };

  function formatDob(patient) {
    if (patient.dateOfBirth) return patient.dateOfBirth;
    const raw = String(patient.dob || patient.dobIso || '').trim();
    const named = raw.match(/^(\d{1,2})[-\s]([A-Za-z]{3,9})[-\s](\d{4})$/);
    if (named) {
      const mm = MONTHS[named[2].slice(0, 3).toLowerCase()];
      if (mm) return `${named[1].padStart(2, '0')}/${mm}/${named[3]}`;
    }
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(raw)) return raw;
    const iso = String(patient.dobIso || raw);
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      const [y, m, d] = iso.split('-');
      return `${d}/${m}/${y}`;
    }
    return raw;
  }

  function showStatus(msg) {
    if (statusShown) return;
    statusShown = true;
    const el = document.createElement('div');
    el.textContent = msg;
    Object.assign(el.style, {
      position: 'fixed', top: '12px', right: '12px', zIndex: '99999',
      background: '#1e3a5f', color: '#fff', padding: '10px 14px',
      borderRadius: '6px', fontFamily: 'system-ui,sans-serif', fontSize: '14px',
    });
    document.documentElement.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }

  function clickElement(el) {
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
    el.focus();
    const rect = el.getBoundingClientRect();
    const opts = {
      bubbles: true, cancelable: true, view: window,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
      button: 0,
    };
    for (const type of ['pointerover', 'pointerenter', 'pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
      const Cls = type.startsWith('pointer') ? PointerEvent : MouseEvent;
      el.dispatchEvent(new Cls(type, opts));
    }
    el.click();
  }

  function setInputValue(input, value) {
    const proto = Object.getPrototypeOf(input);
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(input, value);
    else input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function clickAdvancedTab() {
    for (const sel of ['#advanced-search-tab', 'a#advanced-search-tab', '[href="#advanced-search"]']) {
      const el = document.querySelector(sel);
      if (el) {
        clickElement(el);
        return true;
      }
    }
    return false;
  }

  async function markFindPatientDone() {
    const data = await chrome.storage.session.get(['flow']);
    const flow = data.flow || {};
    if (!flow.findPatientDone) {
      await chrome.storage.session.set({
        flow: { ...flow, findPatientDone: true, landingDone: true, active: true },
      });
    }
  }

  async function getPatientIfReady() {
    const data = await chrome.storage.session.get(['flow', 'pendingPatient', 'scanPending']);
    const flow = data.flow || {};
    if (flow.findPatientDone || flow.scanComplete) return null;
    if (!data.pendingPatient) return null;
    if (!flow.active && !data.scanPending) return null;
    return data.pendingPatient;
  }

  async function tryFill() {
    if (!FIND_PATIENT_RE.test(location.href)) return;
    if (Date.now() - startedAt > MAX_MS) return;
    if (filling) return;

    if (document.querySelector('.query-results-container')) {
      await markFindPatientDone();
      return;
    }

    const patient = await getPatientIfReady();
    if (!patient) return;

    filling = true;
    try {
      showStatus('SCR: filling Advanced search…');

      let firstNameEl = document.querySelector('#advanced-search-form-firstname');
      if (!firstNameEl) {
        if (!clickAdvancedTab()) return;
        console.info('[edm-scr] Clicked Advanced tab');
        return;
      }

      const genderSelector =
        patient.gender === 'Male'
          ? '#advanced-search-form-gender-2'
          : patient.gender === 'Female'
            ? '#advanced-search-form-gender-1'
            : '#advanced-search-form-gender-3';

      const genderRadio = document.querySelector(genderSelector);
      const lastNameEl = document.querySelector('#advanced-search-form-surname');
      if (!genderRadio || !lastNameEl) return;

      let dobInput = document.querySelector('#advanced-search-form-dob-single');
      if (!dobInput) {
        const singleLink = document.querySelector('#advanced-search-form-dob-control-a');
        if (singleLink) {
          clickElement(singleLink);
          return;
        }
        return;
      }

      clickElement(genderRadio);
      genderRadio.dispatchEvent(new Event('change', { bubbles: true }));
      setInputValue(firstNameEl, patient.firstName || '');
      setInputValue(lastNameEl, patient.lastName || '');
      setInputValue(dobInput, formatDob(patient));

      if (patient.postcode) {
        const pc = document.querySelector('#advanced-search-form-postcode');
        if (pc) setInputValue(pc, patient.postcode);
      }

      const submitBtn = document.querySelector('#advanced-search-form button[type="submit"]');
      if (!submitBtn) return;

      clickElement(submitBtn);
      console.info('[edm-scr] Submitted Advanced search:', patient.firstName, patient.lastName);
      await markFindPatientDone();
    } finally {
      filling = false;
    }
  }

  setInterval(tryFill, RETRY_MS);
  new MutationObserver(tryFill).observe(document.documentElement, { childList: true, subtree: true });

  if (chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'session' && (changes.pendingPatient || changes.scanPending || changes.flow)) {
        statusShown = false;
        tryFill();
      }
    });
  }

  tryFill();
  document.addEventListener('DOMContentLoaded', tryFill);
  console.info('[edm-scr] Find patient fill watcher active');
})();
