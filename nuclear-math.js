/**
 * Uranium Enrichment Math Functions
 * Pure mathematical functions for SWU calculations, mass balance, and optimization.
 * Extracted for testability from nuclear.js
 */

// ============================================================================
// CONSTANTS
// ============================================================================

export const EPS = 1e-9;
export const BINARY_SEARCH_ITERATIONS = 80;
export const GOLDEN_SECTION_ITERATIONS = 80;

// ============================================================================
// CORE MATH FUNCTIONS
// ============================================================================

/**
 * Value function V(x) for SWU calculation
 * V(x) = (1 - 2x) * ln((1-x)/x)
 * @param {number} x - Assay as a fraction (0 < x < 1)
 * @returns {number} The value function result
 */
export function valueFunction(x) {
  const xx = Math.min(Math.max(x, EPS), 1 - EPS);
  return (1 - 2 * xx) * Math.log((1 - xx) / xx);
}

/**
 * Validates that assays satisfy: product > feed > tails
 * @param {number} xp - Product assay (fraction)
 * @param {number} xf - Feed assay (fraction)
 * @param {number} xw - Tails/waste assay (fraction)
 * @throws {Error} If ordering constraint is violated
 */
export function checkOrdering(xp, xf, xw) {
  if (!(xp > xf && xf > xw)) {
    const xpPct = (xp * 100).toFixed(3);
    const xfPct = (xf * 100).toFixed(3);
    const xwPct = (xw * 100).toFixed(3);
    throw new Error(`Assay ordering is incorrect. Product (${xpPct}%) must be greater than Feed (${xfPct}%), which must be greater than Tails (${xwPct}%). Required: Product > Feed > Tails.`);
  }
}

/**
 * Mass balance equation
 * Given product mass P, calculates feed mass F and waste mass W
 * @param {number} P - Product mass (kg)
 * @param {number} xp - Product assay (fraction)
 * @param {number} xf - Feed assay (fraction)
 * @param {number} xw - Tails/waste assay (fraction)
 * @returns {{F: number, W: number}} Feed and waste masses
 */
export function massBalance(P, xp, xf, xw) {
  checkOrdering(xp, xf, xw);
  const F = ((xp - xw) / (xf - xw)) * P;
  const W = F - P;
  if (F <= 0 || W <= 0) {
    throw new Error(`Mass balance calculation resulted in invalid values (Feed: ${F.toFixed(3)} kg, Waste: ${W.toFixed(3)} kg). Please check that your assay values are physically realistic.`);
  }
  return { F, W };
}

/**
 * SWU calculation
 * Given product mass P and assays, calculates feed, waste, and SWU
 * @param {number} P - Product mass (kg)
 * @param {number} xp - Product assay (fraction)
 * @param {number} xf - Feed assay (fraction)
 * @param {number} xw - Tails/waste assay (fraction)
 * @returns {{F: number, W: number, swu: number}} Feed, waste, and SWU values
 */
export function swuFor(P, xp, xf, xw) {
  const { F, W } = massBalance(P, xp, xf, xw);
  const swu =
    P * valueFunction(xp) + W * valueFunction(xw) - F * valueFunction(xf);
  if (swu <= 0) {
    throw new Error(`SWU calculation resulted in a non-positive value (${swu.toFixed(3)} SWU). This typically indicates the assay values are too close together or physically unrealistic.`);
  }
  return { F, W, swu };
}

// ============================================================================
// CALCULATOR FUNCTIONS
// ============================================================================

/**
 * Mode 1: Feed & SWU for 1 kg U EUP
 * @param {number} xp - Product assay (fraction)
 * @param {number} xw - Tails assay (fraction)
 * @param {number} xf - Feed assay (fraction)
 * @returns {{F: number, W: number, swu: number}} Results for 1 kg product
 */
export function computeFeedSwuForOneKg(xp, xw, xf) {
  return swuFor(1, xp, xf, xw);
}

/**
 * Mode 2: Feed & SWU from EUP Quantity
 * @param {number} xp - Product assay (fraction)
 * @param {number} xw - Tails assay (fraction)
 * @param {number} xf - Feed assay (fraction)
 * @param {number} P - Product mass (kg)
 * @returns {{F: number, W: number, swu: number}} Feed, waste, and SWU
 */
export function computeFeedSwu(xp, xw, xf, P) {
  return swuFor(P, xp, xf, xw);
}

/**
 * Mode 3: EUP & SWU from Feed Quantity
 * @param {number} xp - Product assay (fraction)
 * @param {number} xw - Tails assay (fraction)
 * @param {number} xf - Feed assay (fraction)
 * @param {number} F - Feed mass (kg)
 * @returns {{P: number, W: number, swu: number}} Product, waste, and SWU
 */
export function computeEupSwu(xp, xw, xf, F) {
  checkOrdering(xp, xf, xw);
  const P = ((xf - xw) / (xp - xw)) * F;
  if (P <= 0) {
    throw new Error(`Product mass calculation resulted in a non-positive value (${P.toFixed(3)} kg). The assay values may be too close together or configured incorrectly.`);
  }
  const W = F - P;
  const swu =
    P * valueFunction(xp) + W * valueFunction(xw) - F * valueFunction(xf);
  if (swu <= 0) {
    throw new Error(`SWU calculation resulted in a non-positive value (${swu.toFixed(3)} SWU). This typically indicates the assay values are too close together or physically unrealistic.`);
  }
  return { P, W, swu };
}

/**
 * Mode 4: Feed & EUP from SWU Quantity
 * Uses binary search to find product mass given SWU constraint
 * @param {number} xp - Product assay (fraction)
 * @param {number} xw - Tails assay (fraction)
 * @param {number} xf - Feed assay (fraction)
 * @param {number} S - SWU quantity
 * @returns {{P: number, F: number}} Product and feed masses
 */
export function computeFeedEupFromSwu(xp, xw, xf, S) {
  checkOrdering(xp, xf, xw);
  if (S <= 0) throw new Error(`SWU Quantity must be a positive number. You entered ${S}, but the value must be greater than zero.`);

  // Find upper bound for binary search
  let Plo = EPS;
  let Phi = 1;

  while (true) {
    const { swu } = swuFor(Phi, xp, xf, xw);
    if (swu > S) break;
    Phi *= 2;
    if (Phi > 1e7) {
      throw new Error(`The SWU value (${S}) is too large for the given assay parameters, or the parameters are physically unrealistic. Try reducing the SWU or adjusting the assay values.`);
    }
  }

  // Binary search for target SWU
  for (let i = 0; i < BINARY_SEARCH_ITERATIONS; i++) {
    const Pmid = 0.5 * (Plo + Phi);
    const { swu } = swuFor(Pmid, xp, xf, xw);
    if (Math.abs(swu - S) / S < 1e-6) {
      Plo = Phi = Pmid;
      break;
    }
    if (swu > S) {
      Phi = Pmid;
    } else {
      Plo = Pmid;
    }
  }

  const P = 0.5 * (Plo + Phi);
  const { F } = massBalance(P, xp, xf, xw);
  return { P, F };
}

/**
 * Mode 5: Optimum Tails Assay
 * Uses golden section search to minimize cost per kg product
 * @param {number} xp - Product assay (fraction)
 * @param {number} xf - Feed assay (fraction)
 * @param {number} cf - Cost per kg of feed ($/kg)
 * @param {number} cs - Cost per SWU ($/SWU)
 * @returns {{xw: number, F_per_P: number, swu_per_P: number, cost_per_P: number}} Optimum results
 */
export function findOptimumTails(xp, xf, cf, cs) {
  checkOrdering(xp, xf, xf / 2); // loose check to ensure xp > xf

  const a = Math.max(EPS, xf * 0.01);
  const b = Math.max(a + EPS, xf - EPS);

  function costPerKg(xw) {
    const { F, swu } = swuFor(1, xp, xf, xw);
    return cf * F + cs * swu;
  }

  // Golden section search
  let left = a;
  let right = b;
  const phi = (1 + Math.sqrt(5)) / 2;
  let x1 = right - (right - left) / phi;
  let x2 = left + (right - left) / phi;
  let f1 = costPerKg(x1);
  let f2 = costPerKg(x2);

  for (let i = 0; i < GOLDEN_SECTION_ITERATIONS; i++) {
    if (f1 > f2) {
      left = x1;
      x1 = x2;
      f1 = f2;
      x2 = left + (right - left) / phi;
      f2 = costPerKg(x2);
    } else {
      right = x2;
      x2 = x1;
      f2 = f1;
      x1 = right - (right - left) / phi;
      f1 = costPerKg(x1);
    }
  }

  const xwOpt = 0.5 * (left + right);
  const { F, swu } = swuFor(1, xp, xf, xwOpt);
  const cost = costPerKg(xwOpt);
  return { xw: xwOpt, F_per_P: F, swu_per_P: swu, cost_per_P: cost };
}
