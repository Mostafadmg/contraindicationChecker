/**
 * MedExpress-style full-document keyword scan with * wildcard support.
 */

import medexpressRules from '../config/medexpress.rules.json' with { type: 'json' };

/**
 * Flatten SCR HTML to normalised searchable text (matches MedExpress preprocessing).
 * @param {string} html
 * @returns {string}
 */
export function flattenScrHtml(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.body.querySelectorAll('*').forEach((el) => el.prepend(' '));
  return doc.body.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

/**
 * Build a case-insensitive RegExp from a keyword ( * → \S* ).
 * @param {string} keyword
 * @returns {RegExp}
 */
export function keywordToRegex(keyword) {
  const lower = keyword.toLowerCase();
  const escaped = lower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '\\S*');
  return new RegExp(escaped, 'gi');
}

/**
 * @param {string} text — flattened SCR text
 * @param {string} keyword
 * @returns {{ index: number, actualMatch: string }[]}
 */
function findKeywordMatches(text, keyword) {
  const hits = [];

  if (keyword.includes('*')) {
    const re = keywordToRegex(keyword);
    let match;
    while ((match = re.exec(text)) !== null) {
      hits.push({ index: match.index, actualMatch: match[0] });
    }
    return hits;
  }

  const lowerText = text.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();
  let from = 0;
  while (from < lowerText.length) {
    const index = lowerText.indexOf(lowerKeyword, from);
    if (index === -1) break;
    hits.push({
      index,
      actualMatch: text.substring(index, index + keyword.length),
    });
    from = index + 1;
  }

  return hits;
}

/**
 * @param {string} text
 * @param {number} index
 * @param {number} matchLen
 * @returns {string}
 */
function buildSnippet(text, index, matchLen) {
  const start = Math.max(0, index - 50);
  const end = Math.min(text.length, index + matchLen + 50);
  let snippet = text.substring(start, end).trim();
  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';
  return snippet;
}

/**
 * Scan flattened SCR text against MedExpress rules.
 * @param {string} text — output of flattenScrHtml
 * @param {object[]} [rules] — defaults to medexpress.rules.json
 * @returns {{ overallPass: boolean, findings: object[] }}
 */
export function scanMedexpressKeywords(text, rules = medexpressRules) {
  const findings = [];

  for (const rule of rules) {
    if (!rule.fail_if_found) continue;

    for (const keyword of rule.keywords) {
      const matches = findKeywordMatches(text, keyword);
      matches.forEach((hit, i) => {
        const occurrence = i + 1;
        findings.push({
          ruleId: rule.id,
          ruleName: rule.name,
          category: rule.category,
          keyword,
          present: true,
          rationale: `Found "${keyword}" in clinical record (occurrence ${occurrence})`,
          snippet: buildSnippet(text, hit.index, hit.actualMatch.length),
          matchIndex: hit.index,
          actualMatch: hit.actualMatch,
        });
      });
    }
  }

  return {
    overallPass: findings.length === 0,
    findings,
  };
}

/**
 * Scan raw SCR HTML (primary entry point).
 * @param {string} html
 * @param {object[]} [rules]
 * @returns {{ overallPass: boolean, findings: object[], flattenedText: string }}
 */
export function scanMedexpressHtml(html, rules = medexpressRules) {
  const flattenedText = flattenScrHtml(html);
  const result = scanMedexpressKeywords(flattenedText, rules);
  return { ...result, flattenedText };
}

export { medexpressRules as MEDEXPRESS_RULES };
