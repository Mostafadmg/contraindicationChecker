/**
 * Text normalisation for SCR keyword matching.
 * @param {string} text
 */
export function normaliseText(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
