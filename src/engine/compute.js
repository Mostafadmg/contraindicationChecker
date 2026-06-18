/**
 * Whitelisted compute functions for derived clinical values.
 * Config references these by name — no arbitrary eval.
 */

/** @type {Record<string, (...args: number[]) => number|null>} */
export const COMPUTE_FUNCTIONS = {
  /**
   * BMI from weight (kg) and height (cm).
   * @param {number} weightKg
   * @param {number} heightCm
   */
  bmi(weightKg, heightCm) {
    if (!weightKg || !heightCm || heightCm <= 0) return null;
    const heightM = heightCm / 100;
    return weightKg / (heightM * heightM);
  },
};

/**
 * Run a named compute function with numeric inputs.
 * @param {string} name
 * @param {number[]} inputs
 * @returns {number|null}
 */
export function runCompute(name, inputs) {
  const fn = COMPUTE_FUNCTIONS[name];
  if (!fn) return null;
  return fn(...inputs);
}

/**
 * @param {number|null} value
 * @param {string} op
 * @param {number} threshold
 */
export function compareValue(value, op, threshold) {
  if (value == null || Number.isNaN(value)) return false;
  switch (op) {
    case '<': return value < threshold;
    case '>': return value > threshold;
    case '<=': return value <= threshold;
    case '>=': return value >= threshold;
    case '==': return value === threshold;
    default: return false;
  }
}
