/**
 * Tests for Uranium Enrichment Math Functions
 * Comprehensive test suite for SWU calculations, mass balance, and optimization algorithms.
 */

import { describe, it, expect } from 'vitest';
import {
  EPS,
  valueFunction,
  checkOrdering,
  massBalance,
  swuFor,
  computeFeedSwuForOneKg,
  computeFeedSwu,
  computeEupSwu,
  computeFeedEupFromSwu,
  findOptimumTails
} from './nuclear-math.js';

// ============================================================================
// TEST CONSTANTS
// ============================================================================

// Standard uranium enrichment values for testing
// Natural uranium: 0.711% U-235
// Typical LEU product: 3-5% U-235
// Typical tails: 0.2-0.3% U-235
const NATURAL_U = 0.00711;  // 0.711% natural uranium
const LEU_5 = 0.05;         // 5% enriched
const TAILS_03 = 0.003;     // 0.3% tails

// Tolerance for floating point comparisons
const TOLERANCE = 1e-6;

// ============================================================================
// VALUE FUNCTION TESTS
// ============================================================================

describe('valueFunction', () => {
  it('should return correct value for natural uranium (0.711%)', () => {
    const result = valueFunction(NATURAL_U);
    // V(0.00711) ≈ 4.869 (known value)
    expect(result).toBeCloseTo(4.869, 2);
  });

  it('should return correct value for 5% enriched uranium', () => {
    const result = valueFunction(LEU_5);
    // V(0.05) ≈ 2.65 (calculated value)
    expect(result).toBeCloseTo(2.65, 2);
  });

  it('should return 0 for x = 0.5 (equal mixture)', () => {
    const result = valueFunction(0.5);
    // V(0.5) = (1 - 1) * ln(1) = 0
    expect(result).toBeCloseTo(0, 10);
  });

  it('should be symmetric around 0.5: V(x) = V(1-x)', () => {
    const testValues = [0.1, 0.2, 0.3, 0.4];
    testValues.forEach(x => {
      const vx = valueFunction(x);
      const v1mx = valueFunction(1 - x);
      expect(vx).toBeCloseTo(v1mx, 10);
    });
  });

  it('should handle very small values near EPS', () => {
    const result = valueFunction(EPS);
    expect(isFinite(result)).toBe(true);
    expect(result).toBeGreaterThan(0);
  });

  it('should handle values very close to 1', () => {
    const result = valueFunction(1 - EPS);
    expect(isFinite(result)).toBe(true);
    expect(result).toBeGreaterThan(0);
  });

  it('should increase as x decreases from 0.5 toward 0', () => {
    const v05 = valueFunction(0.5);
    const v03 = valueFunction(0.3);
    const v01 = valueFunction(0.1);
    expect(v03).toBeGreaterThan(v05);
    expect(v01).toBeGreaterThan(v03);
  });
});

// ============================================================================
// CHECK ORDERING TESTS
// ============================================================================

describe('checkOrdering', () => {
  it('should not throw for valid ordering (product > feed > tails)', () => {
    expect(() => checkOrdering(LEU_5, NATURAL_U, TAILS_03)).not.toThrow();
  });

  it('should throw when product < feed', () => {
    expect(() => checkOrdering(NATURAL_U, LEU_5, TAILS_03)).toThrow(/Assay ordering is incorrect/);
  });

  it('should throw when feed < tails', () => {
    expect(() => checkOrdering(LEU_5, TAILS_03, NATURAL_U)).toThrow(/Assay ordering is incorrect/);
  });

  it('should throw when product = feed', () => {
    expect(() => checkOrdering(LEU_5, LEU_5, TAILS_03)).toThrow(/Assay ordering is incorrect/);
  });

  it('should throw when feed = tails', () => {
    expect(() => checkOrdering(LEU_5, NATURAL_U, NATURAL_U)).toThrow(/Assay ordering is incorrect/);
  });

  it('should throw when all values are equal', () => {
    expect(() => checkOrdering(LEU_5, LEU_5, LEU_5)).toThrow(/Assay ordering is incorrect/);
  });
});

// ============================================================================
// MASS BALANCE TESTS
// ============================================================================

describe('massBalance', () => {
  it('should satisfy conservation: F = P + W', () => {
    const P = 1;
    const { F, W } = massBalance(P, LEU_5, NATURAL_U, TAILS_03);
    expect(F).toBeCloseTo(P + W, 10);
  });

  it('should satisfy U-235 mass balance: F*xf = P*xp + W*xw', () => {
    const P = 1;
    const xp = LEU_5;
    const xf = NATURAL_U;
    const xw = TAILS_03;
    const { F, W } = massBalance(P, xp, xf, xw);

    const feedU235 = F * xf;
    const productU235 = P * xp;
    const wasteU235 = W * xw;

    expect(feedU235).toBeCloseTo(productU235 + wasteU235, 10);
  });

  it('should scale linearly with product mass', () => {
    const { F: F1, W: W1 } = massBalance(1, LEU_5, NATURAL_U, TAILS_03);
    const { F: F10, W: W10 } = massBalance(10, LEU_5, NATURAL_U, TAILS_03);

    expect(F10).toBeCloseTo(F1 * 10, 10);
    expect(W10).toBeCloseTo(W1 * 10, 10);
  });

  it('should require more feed when product enrichment is higher', () => {
    const { F: F5 } = massBalance(1, 0.05, NATURAL_U, TAILS_03);
    const { F: F10 } = massBalance(1, 0.10, NATURAL_U, TAILS_03);

    expect(F10).toBeGreaterThan(F5);
  });

  it('should require more feed when tails assay is higher', () => {
    // Higher tails = more U-235 lost in waste = need more feed
    const { F: F_low_tails } = massBalance(1, LEU_5, NATURAL_U, 0.002);
    const { F: F_high_tails } = massBalance(1, LEU_5, NATURAL_U, 0.004);

    expect(F_high_tails).toBeGreaterThan(F_low_tails);
  });

  it('should throw for invalid ordering', () => {
    expect(() => massBalance(1, TAILS_03, NATURAL_U, LEU_5)).toThrow();
  });
});

// ============================================================================
// SWU CALCULATION TESTS
// ============================================================================

describe('swuFor', () => {
  it('should return positive SWU for valid inputs', () => {
    const { swu } = swuFor(1, LEU_5, NATURAL_U, TAILS_03);
    expect(swu).toBeGreaterThan(0);
  });

  it('should scale linearly with product mass', () => {
    const { swu: swu1 } = swuFor(1, LEU_5, NATURAL_U, TAILS_03);
    const { swu: swu10 } = swuFor(10, LEU_5, NATURAL_U, TAILS_03);

    expect(swu10).toBeCloseTo(swu1 * 10, 6);
  });

  it('should require more SWU for higher enrichment', () => {
    const { swu: swu5 } = swuFor(1, 0.05, NATURAL_U, TAILS_03);
    const { swu: swu10 } = swuFor(1, 0.10, NATURAL_U, TAILS_03);

    expect(swu10).toBeGreaterThan(swu5);
  });

  it('should require more SWU for lower tails assay', () => {
    const { swu: swu_low_tails } = swuFor(1, LEU_5, NATURAL_U, 0.002);
    const { swu: swu_high_tails } = swuFor(1, LEU_5, NATURAL_U, 0.004);

    expect(swu_low_tails).toBeGreaterThan(swu_high_tails);
  });

  it('should return known SWU value for standard case', () => {
    // For 1 kg of 5% enriched U from natural U with 0.3% tails:
    // SWU ≈ 7.1 (well-known industry value)
    const { swu } = swuFor(1, 0.05, 0.00711, 0.003);
    expect(swu).toBeCloseTo(7.1, 0);
  });

  it('should include correct F and W values', () => {
    const { F, W, swu } = swuFor(1, LEU_5, NATURAL_U, TAILS_03);

    expect(F).toBeGreaterThan(1);  // Feed > Product
    expect(W).toBeGreaterThan(0);  // Some waste
    expect(F).toBeCloseTo(1 + W, 10);  // Conservation
  });
});

// ============================================================================
// MODE 1: FEED & SWU FOR 1 KG TESTS
// ============================================================================

describe('computeFeedSwuForOneKg (Mode 1)', () => {
  it('should compute feed and SWU for 1 kg product', () => {
    const result = computeFeedSwuForOneKg(LEU_5, TAILS_03, NATURAL_U);

    expect(result.F).toBeGreaterThan(1);
    expect(result.W).toBeGreaterThan(0);
    expect(result.swu).toBeGreaterThan(0);
  });

  it('should match swuFor with P=1', () => {
    const mode1Result = computeFeedSwuForOneKg(LEU_5, TAILS_03, NATURAL_U);
    const swuResult = swuFor(1, LEU_5, NATURAL_U, TAILS_03);

    expect(mode1Result.F).toBeCloseTo(swuResult.F, 10);
    expect(mode1Result.W).toBeCloseTo(swuResult.W, 10);
    expect(mode1Result.swu).toBeCloseTo(swuResult.swu, 10);
  });

  it('should satisfy mass balance', () => {
    const { F, W } = computeFeedSwuForOneKg(LEU_5, TAILS_03, NATURAL_U);
    expect(F).toBeCloseTo(1 + W, 10);
  });
});

// ============================================================================
// MODE 2: FEED & SWU FROM EUP QUANTITY TESTS
// ============================================================================

describe('computeFeedSwu (Mode 2)', () => {
  it('should scale proportionally with product quantity', () => {
    const result1 = computeFeedSwu(LEU_5, TAILS_03, NATURAL_U, 1);
    const result100 = computeFeedSwu(LEU_5, TAILS_03, NATURAL_U, 100);

    expect(result100.F).toBeCloseTo(result1.F * 100, 6);
    expect(result100.W).toBeCloseTo(result1.W * 100, 6);
    expect(result100.swu).toBeCloseTo(result1.swu * 100, 6);
  });

  it('should match Mode 1 when P=1', () => {
    const mode1 = computeFeedSwuForOneKg(LEU_5, TAILS_03, NATURAL_U);
    const mode2 = computeFeedSwu(LEU_5, TAILS_03, NATURAL_U, 1);

    expect(mode2.F).toBeCloseTo(mode1.F, 10);
    expect(mode2.W).toBeCloseTo(mode1.W, 10);
    expect(mode2.swu).toBeCloseTo(mode1.swu, 10);
  });

  it('should handle large product quantities', () => {
    const result = computeFeedSwu(LEU_5, TAILS_03, NATURAL_U, 1000000);

    expect(result.F).toBeGreaterThan(1000000);
    expect(result.swu).toBeGreaterThan(0);
  });

  it('should handle small product quantities', () => {
    const result = computeFeedSwu(LEU_5, TAILS_03, NATURAL_U, 0.001);

    expect(result.F).toBeGreaterThan(0.001);
    expect(result.swu).toBeGreaterThan(0);
  });
});

// ============================================================================
// MODE 3: EUP & SWU FROM FEED QUANTITY TESTS
// ============================================================================

describe('computeEupSwu (Mode 3)', () => {
  it('should compute product from feed quantity', () => {
    const feedQty = 10;
    const result = computeEupSwu(LEU_5, TAILS_03, NATURAL_U, feedQty);

    expect(result.P).toBeGreaterThan(0);
    expect(result.P).toBeLessThan(feedQty);  // Product < Feed
    expect(result.W).toBeGreaterThan(0);
    expect(result.swu).toBeGreaterThan(0);
  });

  it('should satisfy mass balance: F = P + W', () => {
    const feedQty = 10;
    const { P, W } = computeEupSwu(LEU_5, TAILS_03, NATURAL_U, feedQty);

    expect(feedQty).toBeCloseTo(P + W, 10);
  });

  it('should be inverse of Mode 2', () => {
    // Mode 2: Given P, compute F
    const P_input = 5;
    const mode2 = computeFeedSwu(LEU_5, TAILS_03, NATURAL_U, P_input);

    // Mode 3: Given F (from Mode 2), should get back P_input
    const mode3 = computeEupSwu(LEU_5, TAILS_03, NATURAL_U, mode2.F);

    expect(mode3.P).toBeCloseTo(P_input, 6);
    expect(mode3.swu).toBeCloseTo(mode2.swu, 6);
  });

  it('should scale linearly with feed', () => {
    const result1 = computeEupSwu(LEU_5, TAILS_03, NATURAL_U, 10);
    const result2 = computeEupSwu(LEU_5, TAILS_03, NATURAL_U, 20);

    expect(result2.P).toBeCloseTo(result1.P * 2, 6);
    expect(result2.swu).toBeCloseTo(result1.swu * 2, 6);
  });
});

// ============================================================================
// MODE 4: FEED & EUP FROM SWU QUANTITY TESTS (BINARY SEARCH)
// ============================================================================

describe('computeFeedEupFromSwu (Mode 4)', () => {
  it('should compute product and feed from SWU quantity', () => {
    const swuQty = 100;
    const result = computeFeedEupFromSwu(LEU_5, TAILS_03, NATURAL_U, swuQty);

    expect(result.P).toBeGreaterThan(0);
    expect(result.F).toBeGreaterThan(result.P);
  });

  it('should produce correct SWU when verified with swuFor', () => {
    const targetSwu = 50;
    const { P, F } = computeFeedEupFromSwu(LEU_5, TAILS_03, NATURAL_U, targetSwu);

    // Verify the result produces the target SWU
    const verification = swuFor(P, LEU_5, NATURAL_U, TAILS_03);
    expect(verification.swu).toBeCloseTo(targetSwu, 4);
  });

  it('should be inverse of Mode 2 (round-trip)', () => {
    // Mode 2: Given P, compute SWU
    const P_input = 10;
    const mode2 = computeFeedSwu(LEU_5, TAILS_03, NATURAL_U, P_input);

    // Mode 4: Given SWU, should get back P_input
    const mode4 = computeFeedEupFromSwu(LEU_5, TAILS_03, NATURAL_U, mode2.swu);

    expect(mode4.P).toBeCloseTo(P_input, 4);
    expect(mode4.F).toBeCloseTo(mode2.F, 4);
  });

  it('should handle small SWU values', () => {
    const result = computeFeedEupFromSwu(LEU_5, TAILS_03, NATURAL_U, 1);

    expect(result.P).toBeGreaterThan(0);
    expect(result.F).toBeGreaterThan(0);
  });

  it('should handle large SWU values', () => {
    const result = computeFeedEupFromSwu(LEU_5, TAILS_03, NATURAL_U, 10000);

    expect(result.P).toBeGreaterThan(0);
    expect(result.F).toBeGreaterThan(0);
  });

  it('should throw for zero or negative SWU', () => {
    expect(() => computeFeedEupFromSwu(LEU_5, TAILS_03, NATURAL_U, 0)).toThrow();
    expect(() => computeFeedEupFromSwu(LEU_5, TAILS_03, NATURAL_U, -10)).toThrow();
  });
});

// ============================================================================
// MODE 5: OPTIMUM TAILS ASSAY TESTS (GOLDEN SECTION SEARCH)
// ============================================================================

describe('findOptimumTails (Mode 5)', () => {
  it('should find optimum tails assay between 0 and feed assay', () => {
    const cf = 100;  // $100/kg feed
    const cs = 150;  // $150/SWU
    const result = findOptimumTails(LEU_5, NATURAL_U, cf, cs);

    expect(result.xw).toBeGreaterThan(0);
    expect(result.xw).toBeLessThan(NATURAL_U);
  });

  it('should return consistent cost calculation', () => {
    const cf = 100;
    const cs = 150;
    const result = findOptimumTails(LEU_5, NATURAL_U, cf, cs);

    // Verify cost = cf * F_per_P + cs * swu_per_P
    const expectedCost = cf * result.F_per_P + cs * result.swu_per_P;
    expect(result.cost_per_P).toBeCloseTo(expectedCost, 6);
  });

  it('should find lower cost than arbitrary tails values', () => {
    const cf = 100;
    const cs = 150;
    const optimum = findOptimumTails(LEU_5, NATURAL_U, cf, cs);

    // Compare with some arbitrary tails values
    const testTails = [0.002, 0.003, 0.004, 0.005];
    testTails.forEach(xw => {
      if (xw < NATURAL_U) {
        const { F, swu } = swuFor(1, LEU_5, NATURAL_U, xw);
        const cost = cf * F + cs * swu;
        expect(optimum.cost_per_P).toBeLessThanOrEqual(cost + TOLERANCE);
      }
    });
  });

  it('should shift optimum tails with different cost ratios', () => {
    // Higher SWU cost -> higher optimum tails (to save SWU at expense of feed)
    const result_low_swu_cost = findOptimumTails(LEU_5, NATURAL_U, 100, 50);
    const result_high_swu_cost = findOptimumTails(LEU_5, NATURAL_U, 100, 300);

    expect(result_high_swu_cost.xw).toBeGreaterThan(result_low_swu_cost.xw);
  });

  it('should return per-kg values', () => {
    const cf = 100;
    const cs = 150;
    const result = findOptimumTails(LEU_5, NATURAL_U, cf, cs);

    // F_per_P should be feed per 1 kg product
    // Verify with direct calculation
    const { F, swu } = swuFor(1, LEU_5, NATURAL_U, result.xw);
    expect(result.F_per_P).toBeCloseTo(F, 4);
    expect(result.swu_per_P).toBeCloseTo(swu, 4);
  });

  it('should handle various enrichment levels', () => {
    const enrichments = [0.03, 0.05, 0.10, 0.20];
    const cf = 100;
    const cs = 150;

    enrichments.forEach(xp => {
      const result = findOptimumTails(xp, NATURAL_U, cf, cs);
      expect(result.xw).toBeGreaterThan(0);
      expect(result.xw).toBeLessThan(NATURAL_U);
      expect(result.cost_per_P).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// INTEGRATION / CONSISTENCY TESTS
// ============================================================================

describe('Integration Tests', () => {
  it('should maintain consistency across all modes', () => {
    // Start with a product quantity
    const P = 100;

    // Mode 2: Get F and SWU from P
    const mode2 = computeFeedSwu(LEU_5, TAILS_03, NATURAL_U, P);

    // Mode 3: From F, get back P and SWU
    const mode3 = computeEupSwu(LEU_5, TAILS_03, NATURAL_U, mode2.F);
    expect(mode3.P).toBeCloseTo(P, 4);
    expect(mode3.swu).toBeCloseTo(mode2.swu, 4);

    // Mode 4: From SWU, get back P and F
    const mode4 = computeFeedEupFromSwu(LEU_5, TAILS_03, NATURAL_U, mode2.swu);
    expect(mode4.P).toBeCloseTo(P, 4);
    expect(mode4.F).toBeCloseTo(mode2.F, 4);
  });

  it('should handle typical LEU enrichment scenario', () => {
    // Typical LEU: 3.5% enriched from natural uranium with 0.25% tails
    const xp = 0.035;
    const xf = 0.00711;
    const xw = 0.0025;

    const result = swuFor(1, xp, xf, xw);

    // For 1 kg of 3.5% LEU:
    // Feed should be ~5-6 kg
    // SWU should be ~4-5
    expect(result.F).toBeGreaterThan(4);
    expect(result.F).toBeLessThan(8);
    expect(result.swu).toBeGreaterThan(3);
    expect(result.swu).toBeLessThan(7);
  });

  it('should handle HEU enrichment scenario', () => {
    // Hypothetical HEU: 90% enriched from natural uranium
    const xp = 0.90;
    const xf = 0.00711;
    const xw = 0.003;

    const result = swuFor(1, xp, xf, xw);

    // HEU requires much more feed and SWU than LEU
    expect(result.F).toBeGreaterThan(100);  // ~180 kg feed per kg HEU
    expect(result.swu).toBeGreaterThan(100);  // ~230 SWU per kg HEU
  });
});

// ============================================================================
// EDGE CASE TESTS
// ============================================================================

describe('Edge Cases', () => {
  it('should handle assays very close together', () => {
    // Very close assays should still work but require high SWU
    const xp = 0.01;
    const xf = 0.009;
    const xw = 0.008;

    const { swu } = swuFor(1, xp, xf, xw);
    expect(swu).toBeGreaterThan(0);
  });

  it('should handle very small product quantities', () => {
    const result = computeFeedSwu(LEU_5, TAILS_03, NATURAL_U, 1e-6);
    expect(result.F).toBeGreaterThan(0);
    expect(result.swu).toBeGreaterThan(0);
  });

  it('should handle very large product quantities', () => {
    const result = computeFeedSwu(LEU_5, TAILS_03, NATURAL_U, 1e9);
    expect(result.F).toBeGreaterThan(1e9);
    expect(result.swu).toBeGreaterThan(0);
  });

  it('should handle extreme enrichment (close to 100%)', () => {
    const xp = 0.99;  // 99% enriched
    const result = swuFor(1, xp, NATURAL_U, TAILS_03);

    expect(result.F).toBeGreaterThan(100);
    expect(result.swu).toBeGreaterThan(100);
  });

  it('should throw for invalid assay orderings in all modes', () => {
    expect(() => computeFeedSwuForOneKg(TAILS_03, LEU_5, NATURAL_U)).toThrow();
    expect(() => computeFeedSwu(TAILS_03, LEU_5, NATURAL_U, 1)).toThrow();
    expect(() => computeEupSwu(TAILS_03, LEU_5, NATURAL_U, 10)).toThrow();
    expect(() => computeFeedEupFromSwu(TAILS_03, LEU_5, NATURAL_U, 100)).toThrow();
  });
});
