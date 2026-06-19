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
    const address = scrapeAddress();
    const vitals = scrapeHeightWeight();

    if (!firstName || !lastName || !dob) {
      return null;
    }

    return {
      firstName,
      lastName,
      dateOfBirth: dob,
      gender,
      address,
      height: vitals.height,
      weight: vitals.weight,
      bmi: vitals.bmi,
      heightWeightDate: vitals.heightWeightDate,
    };
  }

  function isEmptyVitalCell(text) {
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    return !t || t === '—' || t === '-' || t === '–';
  }

  function scrapeHeightWeight() {
    const fromTable = scrapeBmiHistoryTable();
    if (fromTable.height || fromTable.weight || fromTable.bmi) {
      return fromTable;
    }
    return scrapeHeightWeightFallback();
  }

  function scrapeBmiHistoryTable() {
    const result = { height: null, weight: null, bmi: null, heightWeightDate: null };
    const table = document.querySelector('table.od2-bmi-table');
    if (!table) return result;

    const firstRow = table.querySelector('tbody tr');
    if (!firstRow) return result;

    const cells = firstRow.querySelectorAll('td');
    if (cells.length < 4) return result;

    const dateText = cells[0].textContent
      .replace(/\s+/g, ' ')
      .replace(/\b(Current|Start)\b/gi, '')
      .trim();

    const bmiRaw = cells[1]?.textContent?.trim();
    const heightRaw = cells[2]?.textContent?.trim();
    const weightRaw = cells[3]?.textContent?.trim();

    if (dateText) result.heightWeightDate = dateText;
    if (!isEmptyVitalCell(bmiRaw)) result.bmi = bmiRaw;
    if (!isEmptyVitalCell(heightRaw)) result.height = heightRaw;
    if (!isEmptyVitalCell(weightRaw)) result.weight = weightRaw;

    return result;
  }

  function scrapeHeightWeightFallback() {
    const result = { height: null, weight: null, bmi: null, heightWeightDate: null };

    for (const stat of document.querySelectorAll('.od2-cons-stat')) {
      const label = stat.querySelector('.cs-lbl')?.textContent?.trim().toLowerCase();
      const value = stat.querySelector('.cs-val')?.textContent?.trim();
      if (!label || !value || isEmptyVitalCell(value)) continue;
      if (label === 'height') result.height = value;
      if (label === 'current weight') result.weight = value;
      if (label === 'current bmi') result.bmi = value;
    }

    if (result.height || result.weight) return result;

    const grid = document.querySelector('.od2-vitals-grid');
    if (!grid) return result;

    for (const vital of grid.querySelectorAll('.od2-vital')) {
      const label = vital.querySelector('.v-lbl')?.textContent?.trim().toLowerCase();
      const value = vital.querySelector('.v-text')?.textContent?.trim();
      if (!label || !value) continue;
      if (label === 'height') result.height = value;
      if (label === 'weight') result.weight = value;
    }
    return result;
  }

  function scrapeAddress() {
    for (const row of document.querySelectorAll('.od2-meta-row')) {
      const label = row.querySelector('.lbl');
      const value = row.querySelector('.val');
      if (!label || !value) continue;
      if (label.textContent?.trim().toLowerCase() !== 'address') continue;
      return value.textContent?.trim() || '';
    }
    return '';
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
    if (userData.height) {
      userData.height = String(userData.height).trim();
    }
    if (userData.weight) {
      userData.weight = String(userData.weight).trim();
    }
    if (userData.bmi) {
      userData.bmi = String(userData.bmi).trim();
    }
    if (userData.heightWeightDate) {
      userData.heightWeightDate = String(userData.heightWeightDate).trim();
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
