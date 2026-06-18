/**
 * Generic data-driven rules evaluator — flags, extractors, and computed values.
 * Contains no clinical content; all rules live in rules.config.js.
 */

import { pickLatestByDate, parseScrDate } from '../lib/dates.js';
import { normaliseText } from '../lib/text.js';
import { runCompute, compareValue } from './compute.js';

/**
 * Evaluate all rules against parsed SCR data.
 * @param {object} parsedScr
 * @param {{ FLAG_RULES: object[], EXTRACTORS: object[], COMPUTED: object[] }} config
 */
export function evaluateRules(parsedScr, config) {
  const { FLAG_RULES, EXTRACTORS, COMPUTED } = config;
  const sections = parsedScr.sections || [];

  const flags = evaluateFlagRules(FLAG_RULES, sections);
  const extractors = evaluateExtractors(EXTRACTORS, sections);
  const { computed, computedFlags } = evaluateComputed(COMPUTED, extractors);
  const medications = extractMedications(sections);

  return {
    flags: dedupeFlags([...flags, ...computedFlags]),
    extractors,
    computed,
    medications,
  };
}

/**
 * @param {object[]} rules
 * @param {object[]} sections
 */
function evaluateFlagRules(rules, sections) {
  const findings = [];

  for (const rule of rules) {
    const targetSections = rule.match.sections
      ? sections.filter((s) => sectionMatchesScope(s.id, rule.match.sections))
      : sections;

    for (const section of targetSections) {
      for (const row of section.rows || []) {
        const text = row.searchableText || normaliseText(Object.values(row.columns || {}).join(' '));
        const excerpt = buildExcerpt(row);
        const matched = matchRule(rule, text);

        if (matched) {
          findings.push({
            ruleId: rule.id,
            label: rule.label,
            severity: rule.severity,
            category: rule.category,
            guidance: rule.guidance,
            action: rule.action,
            section: section.label || section.id,
            date: row.date || '',
            matchedExcerpt: excerpt,
          });
        }
      }

      if (!rule.match.sections && section.sectionSearchableText) {
        const matched = matchRule(rule, section.sectionSearchableText);
        if (matched && !(section.rows || []).length) {
          findings.push({
            ruleId: rule.id,
            label: rule.label,
            severity: rule.severity,
            category: rule.category,
            guidance: rule.guidance,
            action: rule.action,
            section: section.label || section.id,
            date: '',
            matchedExcerpt: section.sectionSearchableText.slice(0, 200),
          });
        }
      }
    }
  }

  return findings;
}

/** @param {object} rule @param {string} text */
function matchRule(rule, text) {
  const normalised = normaliseText(text);
  const { type, terms = [] } = rule.match;

  if (type === 'keyword') {
    return terms.some((term) => normalised.includes(normaliseText(term)));
  }

  if (type === 'regex') {
    return terms.some((pattern) => {
      try {
        return new RegExp(pattern, 'i').test(text);
      } catch {
        return false;
      }
    });
  }

  return false;
}

/** @param {string} sectionId @param {string[]} scopes */
function sectionMatchesScope(sectionId, scopes) {
  return scopes.some(
    (scope) => sectionId === scope || sectionId.startsWith(scope)
  );
}

/** @param {object} row */
function buildExcerpt(row) {
  const parts = Object.values(row.columns || {}).filter(Boolean);
  if (row.supporting) parts.push(row.supporting);
  return parts.join(' — ').slice(0, 300);
}

/**
 * @param {object[]} extractors
 * @param {object[]} sections
 */
function evaluateExtractors(extractors, sections) {
  const results = [];

  for (const ext of extractors) {
    const section = sections.find(
      (s) => s.id === ext.section || s.id.startsWith(ext.section)
    );
    if (!section) continue;

    const rowMatch = ext.rowMatch instanceof RegExp
      ? ext.rowMatch
      : new RegExp(ext.rowMatch, 'i');
    const valuePattern = ext.valuePattern instanceof RegExp
      ? ext.valuePattern
      : new RegExp(ext.valuePattern, 'i');

    const matches = [];

    for (const row of section.rows || []) {
      const rowText = row.searchableText || Object.values(row.columns || {}).join(' ');
      if (!rowMatch.test(rowText)) continue;

      const valueMatch = rowText.match(valuePattern);
      if (!valueMatch?.[1]) continue;

      matches.push({
        id: ext.id,
        label: ext.label,
        value: valueMatch[1].replace(/\s+/g, ''),
        unit: ext.unit || '',
        date: row.date || '',
        _ts: parseScrDate(row.date),
      });
    }

    if (!matches.length) continue;

    let chosen;
    if (ext.pickLatest) {
      chosen = pickLatestByDate(matches, (m) => m.date);
    } else {
      chosen = matches[0];
    }

    if (chosen) {
      results.push({
        id: chosen.id,
        label: chosen.label,
        value: chosen.value,
        unit: chosen.unit,
        date: chosen.date,
      });
    }
  }

  return results;
}

/**
 * @param {object[]} computedRules
 * @param {object[]} extractors
 */
function evaluateComputed(computedRules, extractors) {
  const computed = [];
  const computedFlags = [];

  for (const rule of computedRules) {
    const inputValues = rule.inputs.map((id) => {
      const ext = extractors.find((e) => e.id === id);
      return ext ? parseFloat(ext.value) : null;
    });

    if (inputValues.some((v) => v == null || Number.isNaN(v))) continue;

    let value = runCompute(rule.compute, inputValues);
    if (value == null) continue;

    if (rule.decimals != null) {
      value = Math.round(value * 10 ** rule.decimals) / 10 ** rule.decimals;
    }

    computed.push({
      id: rule.id,
      label: rule.label,
      value: String(value),
      unit: rule.unit || '',
    });

    for (const flag of rule.flagIf || []) {
      if (compareValue(value, flag.op, flag.value)) {
        computedFlags.push({
          ruleId: `${rule.id}-${flag.op}-${flag.value}`,
          label: `${rule.label} ${flag.op} ${flag.value}`,
          severity: flag.severity,
          category: flag.category,
          guidance: flag.guidance,
          action: flag.action,
          section: 'Computed',
          date: '',
          matchedExcerpt: `${rule.label}: ${value}`,
        });
      }
    }
  }

  return { computed, computedFlags };
}

/** @param {object[]} sections */
function extractMedications(sections) {
  const medSections = sections.filter(
    (s) =>
      s.id === 'CurrentRepeatMedications' ||
      s.id.startsWith('AcuteMedications')
  );

  const meds = [];

  for (const section of medSections) {
    for (const row of section.rows || []) {
      const cols = row.columns || {};
      const name =
        cols['Medication'] ||
        cols['Drug Name'] ||
        cols['Name'] ||
        Object.values(cols)[0] ||
        '';
      if (!name) continue;
      meds.push({
        name: String(name).trim(),
        date: row.date || '',
        section: section.label || section.id,
      });
    }
  }

  return meds;
}

/** @param {object[]} flags */
function dedupeFlags(flags) {
  const seen = new Set();
  return flags.filter((f) => {
    const key = `${f.ruleId}|${f.section}|${f.date}|${f.matchedExcerpt}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
