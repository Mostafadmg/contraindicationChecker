// EveryDayMeds order page — MedExpress main-page.js pattern for .scr-cta
(function () {
  console.log('EDM SCR — main-page.js');

  const isOrderPage = () =>
    window.location.hostname === 'rx.everydaymeds.co.uk'
    && window.location.pathname.startsWith('/order/');

  if (!window.location.hostname.includes('rx.everydaymeds.co.uk')) {
    return;
  }

  window.scrExtensionLoaded = true;

  document.addEventListener('click', onScrClick, true);

  // Same event MedExpress Rx app fires — kept for compatibility
  window.addEventListener('loadSCR', (event) => {
    const userData = normaliseUserData(event.detail);
    if (userData) handleLoadSCRRequest(userData);
  });

  function onScrClick(e) {
    if (!isOrderPage()) return;

    const link = e.target.closest('.scr-cta');
    if (!link || e.button !== 0) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const userData = scrapePatientFromOrder();
    if (!userData) {
      alert(
        'Could not read patient name and date of birth from this order page.\n\n'
          + 'Make sure the patient panel is visible, then try again.'
      );
      return;
    }

    handleLoadSCRRequest(userData);
  }

  function scrapePatientFromOrder() {
    const fullName =
      document.querySelector('.patient-name-text')?.textContent?.trim() || '';
    const parts = fullName.split(/\s+/).filter(Boolean);
    const firstName = parts[0] || '';
    const lastName = parts.length > 1 ? parts.slice(1).join(' ') : '';

    let dob =
      document.querySelector('.meta-val-text[data-meta="dob"]')?.textContent?.trim()
      || '';
    if (!dob) {
      const editBtn = document.querySelector('button[data-edit-field="dob"]');
      dob = editBtn?.getAttribute('data-edit-current')?.trim() || '';
    }
    dob = formatDobForNhs(dob);

    const gender = scrapeGender();

    if (!firstName || !lastName || !dob) {
      return null;
    }

    return { firstName, lastName, dateOfBirth: dob, gender };
  }

  function scrapeGender() {
    const grid = document.querySelector('.od2-vitals-grid');
    if (!grid) return 'unknown';

    for (const vital of grid.querySelectorAll('.od2-vital')) {
      const label = vital.querySelector('.v-lbl')?.textContent?.trim().toLowerCase();
      const value = vital.querySelector('.v-text')?.textContent?.trim().toLowerCase() || '';
      if (label !== 'sex') continue;
      if (value.includes('female') || value === 'f') return 'female';
      if (value.includes('male') || value === 'm') return 'male';
      return 'unknown';
    }
    return 'unknown';
  }

  function formatDobForNhs(raw) {
    if (!raw) return '';
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
    const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dmy) {
      return `${dmy[1].padStart(2, '0')}/${dmy[2].padStart(2, '0')}/${dmy[3]}`;
    }
    return raw;
  }

  function normaliseUserData(detail) {
    if (!detail?.firstName || !detail?.lastName || !detail?.dateOfBirth) {
      return null;
    }
    const userData = { ...detail };
    const [year, month, day] = String(userData.dateOfBirth).split('-');
    if (year?.length === 4) {
      userData.dateOfBirth = `${day}/${month}/${year}`;
    }
    if (userData.gender) {
      userData.gender = String(userData.gender).toLowerCase();
    }
    return userData;
  }

  function handleLoadSCRRequest(userData) {
    console.log('EDM SCR — opening NHS portal for', userData.firstName, userData.lastName);

    chrome.runtime.sendMessage(
      { action: 'openNHSPage', userData },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error('openNHSPage failed:', chrome.runtime.lastError);
          alert('Failed to open NHS page. Please try again.');
          return;
        }
        if (response?.success) {
          console.log('NHS page opened, tab ID:', response.tabId);
        } else {
          alert(`Failed to open NHS page: ${response?.error || 'Unknown error'}`);
        }
      }
    );
  }

  function rewriteScrLinks() {
    document.querySelectorAll('.scr-cta').forEach((el) => {
      if (!(el instanceof HTMLAnchorElement)) return;
      if (el.getAttribute('href') !== SCR_CONFIG.NHS_URL) {
        el.setAttribute('href', SCR_CONFIG.NHS_URL);
      }
      el.target = '_blank';
      el.rel = 'noopener noreferrer';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', rewriteScrLinks, { once: true });
  } else {
    rewriteScrLinks();
  }

  let attempts = 0;
  const poller = setInterval(() => {
    rewriteScrLinks();
    if (++attempts >= 24) clearInterval(poller);
  }, 250);
})();
