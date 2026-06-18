/**
 * Parse NHS SCR clinical sections and patient banner into structured data.
 */

import { SCR, BANNER } from '../config/selectors.config.js';
import { normaliseText } from '../lib/text.js';

const SECTION_LABELS = {
  AllergiesandAdverseReactions: 'Allergies and Adverse Reactions',
  CurrentRepeatMedications: 'Current Repeat Medications',
  Diagnoses: 'Diagnoses',
  ProblemsandIssues: 'Problems and Issues',
  ClinicalObservationsandFindings: 'Clinical Observations and Findings',
  Treatments: 'Treatments',
  InvestigationResults: 'Investigation Results',
  FamilyHistory: 'Family History',
  CareEvents: 'Care Events',
  ServicesCareProfessionalsandCarers: 'Services, Care Professionals and Carers',
  CareProfessionalDocumentation: 'Care Professional Documentation',
  PatientCarerCorrespondence: 'Patient/Carer Correspondence',
};

/**
 * Parse the full SCR page into structured sections and banner.
 * @returns {{ banner: object, sections: object[] }}
 */
export function parseScr() {
  const banner = parseBanner();
  const sections = discoverSections().map(parseSection).filter(Boolean);
  return { banner, sections };
}

/** @returns {object} */
function parseBanner() {
  const getText = (sel) => document.querySelector(sel)?.textContent?.trim() || '';
  let nhsNumber = '';
  for (const sel of BANNER.nhsNumber.split(', ')) {
    const el = document.querySelector(sel.trim());
    if (el?.textContent) {
      nhsNumber = el.textContent.trim();
      break;
    }
  }

  return {
    name: getText(BANNER.name),
    age: getText(BANNER.age),
    gender: getText(BANNER.gender),
    dob: getText(BANNER.dob),
    address: getText(BANNER.address),
    nhsNumber,
  };
}

/** @returns {Element[]} */
function discoverSections() {
  const found = [];

  for (const id of SCR.staticSectionIds) {
    const el = document.getElementById(id);
    if (el) found.push(el);
  }

  for (const prefix of SCR.prefixSectionIds) {
    const matches = document.querySelectorAll(`[id^="${prefix}"]`);
    matches.forEach((el) => {
      if (!found.includes(el)) found.push(el);
    });
  }

  return found;
}

/** @param {Element} sectionEl */
function parseSection(sectionEl) {
  try {
    const id = sectionEl.id;
    const label =
      SECTION_LABELS[id] ||
      sectionEl.querySelector('h2, h3, .nhsuk-card__heading')?.textContent?.trim() ||
      id;

    const table = sectionEl.querySelector(SCR.table);
    if (!table) {
      return {
        id,
        label,
        rows: [],
        sectionSearchableText: '',
      };
    }

    const headers = extractHeaders(table);
    const rows = extractRows(table, headers);
    const sectionSearchableText = normaliseText(
      rows.map((r) => r.searchableText).join(' ')
    );

    return { id, label, rows, sectionSearchableText };
  } catch (err) {
    console.warn('[edm-scr] Section parse error:', sectionEl?.id, err);
    return null;
  }
}

/** @param {HTMLTableElement} table */
function extractHeaders(table) {
  const headerCells = table.querySelectorAll('thead th, tr:first-child th');
  if (headerCells.length) {
    return Array.from(headerCells).map((th) => th.textContent.trim() || 'Column');
  }
  return [];
}

/**
 * @param {HTMLTableElement} table
 * @param {string[]} headers
 */
function extractRows(table, headers) {
  const rows = [];
  const trs = table.querySelectorAll('tbody tr, tr');

  for (let i = 0; i < trs.length; i++) {
    const tr = trs[i];

    if (tr.querySelector(SCR.spacerRow) || tr.classList.contains('scr-table__cell--spacer')) {
      continue;
    }

    const isSupporting = tr.querySelector(SCR.supportingInset);
    if (isSupporting && rows.length) {
      const insetText = tr.textContent.trim();
      rows[rows.length - 1].supporting = insetText;
      rows[rows.length - 1].searchableText = normaliseText(
        Object.values(rows[rows.length - 1].columns).join(' ') + ' ' + insetText
      );
      continue;
    }

    const cells = tr.querySelectorAll('td');
    if (!cells.length) continue;

    const columns = {};
    cells.forEach((td, idx) => {
      const key = headers[idx] || `col${idx}`;
      columns[key] = td.textContent.trim();
    });

    const date =
      columns['Date'] ||
      columns['Start Date'] ||
      columns['Observed Date'] ||
      cells[0]?.textContent?.trim() ||
      '';

    const searchableText = normaliseText(Object.values(columns).join(' '));

    rows.push({ date, columns, supporting: '', searchableText });
  }

  return rows;
}

/**
 * Detect whether SCR clinical content is present on the page.
 * @returns {boolean}
 */
export function isScrContentPresent() {
  for (const id of SCR.staticSectionIds) {
    if (document.getElementById(id)?.querySelector(SCR.table)) return true;
  }
  for (const prefix of SCR.prefixSectionIds) {
    const el = document.querySelector(`[id^="${prefix}"] ${SCR.table}`);
    if (el) return true;
  }
  return false;
}
