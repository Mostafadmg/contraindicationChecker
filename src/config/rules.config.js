/**
 * Clinical rules — MedExpress keyword rules (R001–R006) for SCR pre-screen.
 */

import medexpressRules from './medexpress.rules.json' with { type: 'json' };

/** @deprecated Use MEDEXPRESS_RULES — kept for backward compatibility with rulesEngine. */
export const FLAG_RULES = [];

export const MEDEXPRESS_RULES = medexpressRules;

export const EXTRACTORS = [
  {
    id: 'latestWeight',
    label: 'Most recent weight',
    section: 'ClinicalObservationsandFindings',
    rowMatch: /body weight/i,
    valuePattern: /([\d.]+)\s*kg/i,
    unit: 'kg',
    pickLatest: true,
  },
  {
    id: 'latestHeight',
    label: 'Height',
    section: 'ClinicalObservationsandFindings',
    rowMatch: /(standing )?height/i,
    valuePattern: /([\d.]+)\s*cm/i,
    unit: 'cm',
    pickLatest: true,
  },
];

export const COMPUTED = [];
