/**
 * Manual verification helpers for order-page extraction (run with node + jsdom).
 * Usage: node scripts/test-order-extraction.mjs
 */
import { JSDOM } from 'jsdom';
import { scanMedexpressHtml } from '../src/engine/medexpressKeywordEngine.js';

const COMPLETE_ORDER_HTML = `
<div class="od2-col-left">
  <span class="patient-name-text">Helen Batters</span>
  <div class="od2-meta-row">
    <span class="lbl">Address</span>
    <span class="val">12 High Street, Swansea, SA3 5QL</span>
  </div>
  <span class="meta-val-text" data-meta="dob">04-May-1985</span>
  <button data-edit-field="dob" data-edit-current="04/05/1985"></button>
  <div class="od2-vitals-grid">
    <div class="od2-vital"><span class="v-lbl">Sex</span><span class="v-text">Female</span></div>
  </div>
  <a class="scr-cta" href="#">Go to NHS SCR</a>
</div>`;

const INCOMPLETE_ORDER_HTML = `
<div class="od2-col-left">
  <span class="patient-name-text">Helen</span>
  <div class="od2-vitals-grid">
    <div class="od2-vital"><span class="v-lbl">Sex</span><span class="v-text">—</span></div>
  </div>
</div>`;

function runExtraction(html) {
  const dom = new JSDOM(html);
  const { document } = dom.window;

  const fullName = document.querySelector('.patient-name-text')?.textContent?.trim() || '';
  const parts = fullName.split(/\s+/).filter(Boolean);
  const firstName = parts[0] || '';
  const lastName = parts.length >= 2 ? parts.slice(1).join(' ') : '';

  let dobRaw = document.querySelector('.meta-val-text[data-meta="dob"]')?.textContent?.trim() || '';
  if (!dobRaw) {
    dobRaw = document.querySelector('button[data-edit-field="dob"]')?.getAttribute('data-edit-current') || '';
  }

  let genderRaw = '';
  for (const vital of document.querySelectorAll('.od2-vital')) {
    const label = vital.querySelector('.v-lbl')?.textContent?.trim().toLowerCase();
    if (label === 'sex') genderRaw = vital.querySelector('.v-text')?.textContent?.trim() || '';
  }

  let postcode = '';
  for (const row of document.querySelectorAll('.od2-meta-row')) {
    if (row.querySelector('.lbl')?.textContent?.trim().toLowerCase() === 'address') {
      const address = row.querySelector('.val')?.textContent?.trim() || '';
      const match = address.match(/\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i);
      postcode = match ? match[1].toUpperCase() : '';
    }
  }

  const missingFields = [];
  if (!firstName) missingFields.push('firstName');
  if (!lastName) missingFields.push('lastName');
  if (!dobRaw) missingFields.push('dob');
  const gLower = genderRaw.toLowerCase();
  if (!genderRaw || gLower === '—' || gLower === 'unknown') missingFields.push('gender');

  return { firstName, lastName, dobRaw, genderRaw, postcode, missingFields };
}

globalThis.DOMParser = new JSDOM('').window.DOMParser;

console.log('Complete patient:', runExtraction(COMPLETE_ORDER_HTML));
console.log('Incomplete patient:', runExtraction(INCOMPLETE_ORDER_HTML));

const failHtml = '<html><body>Patient history includes Pancreatitis and insulin glargine</body></html>';
const scan = scanMedexpressHtml(failHtml);
console.log('Keyword fail test:', scan.overallPass ? 'PASS' : 'FAIL', '- hits:', scan.findings.map((f) => `${f.ruleId}:${f.keyword}`).join(', '));
