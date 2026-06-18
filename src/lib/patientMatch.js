/**
 * Conservative patient matching between order demographics and NHS search results.
 */

import { normaliseDob } from './dates.js';

/**
 * Normalise NHS number for comparison (strip spaces).
 * @param {string} nhs
 */
export function normaliseNhsNumber(nhs) {
  if (!nhs) return '';
  return nhs.replace(/\s+/g, '');
}

/**
 * Compare order patient to a search result row.
 * @param {object} orderPatient
 * @param {object} rowPatient
 * @returns {{ confident: boolean, reasons: string[] }}
 */
export function matchPatient(orderPatient, rowPatient) {
  const reasons = [];

  const orderNhs = normaliseNhsNumber(orderPatient.nhsNumber);
  const rowNhs = normaliseNhsNumber(rowPatient.nhsNumber);

  if (orderNhs && rowNhs) {
    if (orderNhs === rowNhs) {
      reasons.push('NHS number match');
      return { confident: true, reasons };
    }
    reasons.push('NHS number mismatch');
    return { confident: false, reasons };
  }

  const orderDob = normaliseDob(orderPatient.dob?.display || orderPatient.dob);
  const rowDobRaw = (rowPatient.dob || '').replace(/\s*\(\d+\)\s*$/, '').trim();
  const rowDob = normaliseDob(rowDobRaw);

  if (!orderDob || !rowDob) {
    reasons.push('DOB could not be normalised');
    return { confident: false, reasons };
  }

  if (orderDob.iso !== rowDob.iso) {
    reasons.push('DOB mismatch');
    return { confident: false, reasons };
  }
  reasons.push('DOB match');

  const orderSurname = (orderPatient.lastName || '').trim().toLowerCase();
  const rowName = (rowPatient.name || '').trim().toLowerCase();
  const rowSurname = rowName.split(/\s+/).pop() || '';

  if (!orderSurname || !rowSurname) {
    reasons.push('Surname missing');
    return { confident: false, reasons };
  }

  if (orderSurname !== rowSurname && !rowName.includes(orderSurname)) {
    reasons.push('Surname mismatch');
    return { confident: false, reasons };
  }
  reasons.push('Surname match');

  return { confident: true, reasons };
}
