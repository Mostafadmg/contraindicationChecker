/**
 * BMI / weight / height extraction from SCR HTML (ported from MedExpress Me(html)).
 */

import { parseScrDate } from '../lib/dates.js';

const DATE_FORMATS = [
  /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/,
  /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/,
  /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
];

/**
 * @param {string} raw
 * @returns {Date|null}
 */
function parseObservationDate(raw) {
  if (!raw) return null;

  for (const fmt of DATE_FORMATS) {
    const m = raw.trim().match(fmt);
    if (m) {
      const ts = parseScrDate(raw.trim());
      if (ts) return new Date(ts);
    }
  }

  const ts = parseScrDate(raw);
  return ts ? new Date(ts) : null;
}

/**
 * @param {string} raw
 * @returns {number|undefined}
 */
function parseNumericValue(raw) {
  const m = raw?.match(/[\d.]+/);
  return m ? parseFloat(m[0]) : undefined;
}

/**
 * @param {Date} from
 * @param {Date} to
 * @returns {number}
 */
function daysBetween(from, to) {
  const ms = from.getTime() - to.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

/**
 * Extract latest weight, height, and BMI from SCR HTML.
 * @param {string} html
 * @returns {object}
 */
export function extractBmiFromScrHtml(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const heading = Array.from(doc.querySelectorAll('h3.nhsuk-card__heading')).find(
    (h) => h.textContent?.trim() === 'Clinical Observations and Findings'
  );

  if (!heading) return {};

  const table = heading.closest('.nhsuk-card')?.querySelector('table.scr-table');
  if (!table) return {};

  /** @type {Map<string, { date: Date, reading: object }>} */
  const byDateKey = new Map();
  const rows = Array.from(table.querySelectorAll('tbody tr'));

  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i].querySelectorAll('td.scr-table__cell');
    if (cells[0]?.classList.contains('scr-table__cell--spacer')) continue;

    const dateRaw = cells[0]?.querySelector('p')?.textContent?.trim();
    const labelRaw = cells[1]?.querySelector('p')?.textContent?.trim();
    if (!dateRaw || !labelRaw) continue;

    const date = parseObservationDate(dateRaw);
    if (!date || Number.isNaN(date.getTime())) continue;

    const label = labelRaw.toLowerCase();
    const isWeight =
      label.includes('body weight') || label.includes('o / e - weight') || label === 'weight';
    const isHeight =
      label.includes('standing height') ||
      label.includes('o / e - height') ||
      label === 'height';
    const isBmi = label.includes('body mass index');

    if (!isWeight && !isHeight && !isBmi) continue;

    let valueRaw = cells[2]?.querySelector('p')?.textContent?.trim();
    if (!valueRaw) {
      const nextRow = rows[i + 1];
      if (
        !nextRow ||
        !nextRow.querySelectorAll('td.scr-table__cell')[0]?.classList.contains(
          'scr-table__cell--spacer'
        )
      ) {
        continue;
      }
      valueRaw = nextRow.querySelector('p.scr-supporting-inset')?.textContent?.trim();
      if (!valueRaw) continue;
    }

    const dateKey = dateRaw;
    if (!byDateKey.has(dateKey)) {
      byDateKey.set(dateKey, { date, reading: {} });
    }
    const entry = byDateKey.get(dateKey);

    if (isWeight) entry.reading.weight = parseNumericValue(valueRaw);
    if (isHeight) entry.reading.height = parseNumericValue(valueRaw);
    if (isBmi) entry.reading.bmi = parseNumericValue(valueRaw);
  }

  let latestWeight = null;
  let latestHeight = null;
  let latestBmi = null;

  for (const entry of byDateKey.values()) {
    if (entry.reading.weight !== undefined) {
      if (!latestWeight || entry.date > latestWeight.date) {
        latestWeight = { date: entry.date, value: entry.reading.weight };
      }
    }
    if (entry.reading.height !== undefined) {
      if (!latestHeight || entry.date > latestHeight.date) {
        latestHeight = { date: entry.date, value: entry.reading.height };
      }
    }
    if (entry.reading.bmi !== undefined) {
      if (!latestBmi || entry.date > latestBmi.date) {
        latestBmi = { date: entry.date, value: entry.reading.bmi };
      }
    }
  }

  const result = {};
  const now = new Date();
  const fmt = (d) =>
    d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  if (latestWeight) {
    result.weight = latestWeight.value;
    result.weightDate = fmt(latestWeight.date);
    result.weight_age = daysBetween(now, latestWeight.date);
  }
  if (latestHeight) {
    result.height = latestHeight.value;
    result.heightDate = fmt(latestHeight.date);
    result.height_age = daysBetween(now, latestHeight.date);
  }
  if (latestBmi) {
    result.bmi = latestBmi.value;
    result.bmiDate = fmt(latestBmi.date);
    result.bmi_age = daysBetween(now, latestBmi.date);
  }

  return result;
}

/**
 * Extract BMI data from the live patient page DOM.
 * @returns {object}
 */
export function extractBmiFromDocument() {
  return extractBmiFromScrHtml(document.documentElement.innerHTML);
}
