/**
 * Build EDM results payload from SCR HTML (after MedExpress-style retrieval).
 */

import { scanMedexpressHtml } from '../engine/medexpressKeywordEngine.js';
import { extractBmiFromScrHtml } from '../engine/bmiExtractor.js';

/**
 * @param {string} scrInnerHtml — .scr-print-wrapper innerHTML
 * @param {object} userData — { firstName, lastName, dateOfBirth, gender }
 */
export function buildScanResultFromScrHtml(scrInnerHtml, userData = {}) {
  const wrappedHtml = `<!DOCTYPE html><html><body><div class="scr-print-wrapper">${scrInnerHtml}</div></body></html>`;
  const medexpress = scanMedexpressHtml(wrappedHtml);
  const bmi = extractBmiFromScrHtml(wrappedHtml);

  return {
    patient: {
      firstName: userData.firstName || '',
      lastName: userData.lastName || '',
      name: [userData.firstName, userData.lastName].filter(Boolean).join(' '),
      dob: userData.dateOfBirth || '',
      gender: userData.gender || '',
    },
    scan: {
      banner: {},
      medications: [],
      medexpress: {
        overallPass: medexpress.overallPass,
        findings: medexpress.findings,
      },
      bmi,
    },
    generatedAt: new Date().toISOString(),
  };
}
