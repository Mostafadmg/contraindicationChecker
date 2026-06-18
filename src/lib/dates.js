/**
 * Date normalisation and sorting helpers for patient matching and SCR extractors.
 */

const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/**
 * Normalise a UK-style DOB string to display and ISO forms.
 * @param {string} raw
 * @returns {{ display: string, iso: string } | null}
 */
export function normaliseDob(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();

  // DD-MMM-YYYY or DD MMM YYYY
  let m = trimmed.match(/^(\d{1,2})[-\s]([A-Za-z]{3,9})[-\s](\d{4})$/);
  if (m) {
    const day = parseInt(m[1], 10);
    const monthKey = m[2].slice(0, 3).toLowerCase();
    const year = parseInt(m[3], 10);
    const month = MONTHS[monthKey];
    if (month === undefined) return null;
    const date = new Date(year, month, day);
    return { display: formatDisplay(date), iso: formatIso(date) };
  }

  // DD/MM/YYYY or DD-MM-YYYY
  m = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    const day = parseInt(m[1], 10);
    const month = parseInt(m[2], 10) - 1;
    const year = parseInt(m[3], 10);
    const date = new Date(year, month, day);
    return { display: formatDisplay(date), iso: formatIso(date) };
  }

  // YYYY-MM-DD
  m = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const year = parseInt(m[1], 10);
    const month = parseInt(m[2], 10) - 1;
    const day = parseInt(m[3], 10);
    const date = new Date(year, month, day);
    return { display: formatDisplay(date), iso: formatIso(date) };
  }

  return null;
}

/** @param {Date} date */
function formatDisplay(date) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const d = String(date.getDate()).padStart(2, '0');
  return `${d}-${months[date.getMonth()]}-${date.getFullYear()}`;
}

/** @param {Date} date */
function formatIso(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * NHS advanced search single-date field expects DD/MM/YYYY (MedExpress format).
 * @param {string|object} rawOrPatient
 * @returns {string}
 */
export function formatDobForNhs(rawOrPatient) {
  const raw = typeof rawOrPatient === 'string'
    ? rawOrPatient
    : (rawOrPatient?.dob?.display || rawOrPatient?.dob || rawOrPatient?.dobIso || '');
  const norm = normaliseDob(String(raw));
  if (!norm) return String(raw).trim();
  const [y, m, d] = norm.iso.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * Parse an SCR row date string for sorting (handles DD-MMM-YYYY and variants).
 * @param {string} str
 * @returns {number} timestamp or 0
 */
export function parseScrDate(str) {
  if (!str) return 0;
  const cleaned = str.trim().split(/\s+/)[0];
  const norm = normaliseDob(cleaned);
  if (norm) {
    return new Date(norm.iso).getTime();
  }
  const t = Date.parse(str);
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Pick the item with the latest date field.
 * @template T
 * @param {T[]} items
 * @param {(item: T) => string} getDate
 * @returns {T|null}
 */
export function pickLatestByDate(items, getDate) {
  if (!items?.length) return null;
  return items.reduce((best, item) => {
    const bestTs = parseScrDate(getDate(best));
    const itemTs = parseScrDate(getDate(item));
    return itemTs >= bestTs ? item : best;
  });
}
