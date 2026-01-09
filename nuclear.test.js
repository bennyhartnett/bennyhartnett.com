/**
 * Unit Tests for Uranium Enrichment Calculator
 * Tests core mathematical functions for correctness and edge cases.
 *
 * Run with: node nuclear.test.js
 */

// Simple test framework
let testsPassed = 0;
let testsFailed = 0;

function describe(name, fn) {
  console.log(`\n${name}`);
  fn();
}

function it(name, fn) {
  try {
    fn();
    testsPassed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    testsFailed++;
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${err.message}`);
  }
}

function expect(actual) {
  return {
    toBe(expected) {
      if (actual !== expected) {
        throw new Error(`Expected ${expected} but got ${actual}`);
      }
    },
    toBeCloseTo(expected, precision = 6) {
      const diff = Math.abs(actual - expected);
      const epsilon = Math.pow(10, -precision);
      if (diff > epsilon) {
        throw new Error(`Expected ${expected} (±${epsilon}) but got ${actual} (diff: ${diff})`);
      }
    },
    toBeGreaterThan(expected) {
      if (!(actual > expected)) {
        throw new Error(`Expected ${actual} to be greater than ${expected}`);
      }
    },
    toBeLessThan(expected) {
      if (!(actual < expected)) {
        throw new Error(`Expected ${actual} to be less than ${expected}`);
      }
    },
    toThrow(expectedMessage) {
      if (typeof actual !== 'function') {
        throw new Error('Expected a function to test for throws');
      }
      try {
        actual();
        throw new Error('Expected function to throw but it did not');
      } catch (err) {
        if (expectedMessage && !err.message.includes(expectedMessage)) {
          throw new Error(`Expected error message to contain "${expectedMessage}" but got "${err.message}"`);
        }
      }
    },
    toHaveProperty(prop) {
      if (!(prop in actual)) {
        throw new Error(`Expected object to have property "${prop}"`);
      }
    },
  };
}

// Import the module (works because we export in Node environment)
const nuclear = require('./nuclear.js');

const {
  valueFunction,
  checkOrdering,
  massBalance,
  swuFor,
  computeFeedSwuForOneKg,
  computeFeedSwu,
  computeEupSwu,
  computeFeedEupFromSwu,
  findOptimumTails,
  debounce,
  EPS,
} = nuclear;

// ============================================================================
// VALUE FUNCTION TESTS
// ============================================================================

describe('valueFunction', () => {
  it('should return 0 for x = 0.5 (natural uranium enrichment point)', () => {
    // V(0.5) = (1 - 2*0.5) * ln((1-0.5)/0.5) = 0 * ln(1) = 0
    expect(valueFunction(0.5)).toBeCloseTo(0, 10);
  });

  it('should return positive values for x < 0.5', () => {
    expect(valueFunction(0.007)).toBeGreaterThan(0); // Natural uranium ~0.7%
    expect(valueFunction(0.003)).toBeGreaterThan(0); // Tails ~0.3%
    expect(valueFunction(0.2)).toBeGreaterThan(0);
  });

  it('should return positive values for x > 0.5', () => {
    expect(valueFunction(0.6)).toBeGreaterThan(0);
    expect(valueFunction(0.9)).toBeGreaterThan(0);
  });

  it('should handle edge cases near 0 and 1', () => {
    // Should clamp to EPS and 1-EPS
    expect(valueFunction(0.0000001)).toBeGreaterThan(0);
    expect(valueFunction(0.9999999)).toBeGreaterThan(0);
  });

  it('should calculate correct value for typical LEU (5%)', () => {
    // V(0.05) = (1 - 2*0.05) * ln((1-0.05)/0.05) = 0.9 * ln(19) = 0.9 * 2.944 = 2.65
    const result = valueFunction(0.05);
    expect(result).toBeCloseTo(2.65, 1);
  });
});

// ============================================================================
// CHECK ORDERING TESTS
// ============================================================================

describe('checkOrdering', () => {
  it('should not throw for valid ordering (product > feed > tails)', () => {
    // Should not throw
    checkOrdering(0.05, 0.007, 0.003); // 5% > 0.7% > 0.3%
    expect(true).toBe(true); // If we get here, test passed
  });

  it('should throw for invalid ordering (product < feed)', () => {
    expect(() => checkOrdering(0.005, 0.007, 0.003)).toThrow('ordering is incorrect');
  });

  it('should throw for invalid ordering (feed < tails)', () => {
    expect(() => checkOrdering(0.05, 0.002, 0.003)).toThrow('ordering is incorrect');
  });

  it('should throw for equal values', () => {
    expect(() => checkOrdering(0.05, 0.05, 0.003)).toThrow('ordering is incorrect');
    expect(() => checkOrdering(0.05, 0.003, 0.003)).toThrow('ordering is incorrect');
  });
});

// ============================================================================
// MASS BALANCE TESTS
// ============================================================================

describe('massBalance', () => {
  it('should calculate correct feed and waste for 1 kg product', () => {
    // 5% product, 0.7% feed, 0.3% tails
    const { F, W } = massBalance(1, 0.05, 0.007, 0.003);

    // Feed should be approximately 11.75 kg
    expect(F).toBeCloseTo(11.75, 2);
    // Waste = Feed - Product
    expect(W).toBeCloseTo(F - 1, 6);
  });

  it('should scale linearly with product mass', () => {
    const result1 = massBalance(1, 0.05, 0.007, 0.003);
    const result10 = massBalance(10, 0.05, 0.007, 0.003);

    expect(result10.F).toBeCloseTo(result1.F * 10, 6);
    expect(result10.W).toBeCloseTo(result1.W * 10, 6);
  });

  it('should satisfy conservation of mass', () => {
    const P = 5;
    const { F, W } = massBalance(P, 0.05, 0.007, 0.003);
    expect(F).toBeCloseTo(P + W, 6);
  });

  it('should satisfy conservation of U-235', () => {
    const P = 1;
    const xp = 0.05;
    const xf = 0.007;
    const xw = 0.003;
    const { F, W } = massBalance(P, xp, xf, xw);

    // U-235 in feed = U-235 in product + U-235 in waste
    const u235Feed = F * xf;
    const u235Product = P * xp;
    const u235Waste = W * xw;

    expect(u235Feed).toBeCloseTo(u235Product + u235Waste, 6);
  });

  it('should throw for invalid assay ordering', () => {
    expect(() => massBalance(1, 0.003, 0.007, 0.05)).toThrow('ordering is incorrect');
  });
});

// ============================================================================
// SWU CALCULATION TESTS
// ============================================================================

describe('swuFor', () => {
  it('should calculate positive SWU for valid inputs', () => {
    const { F, W, swu } = swuFor(1, 0.05, 0.007, 0.003);
    expect(swu).toBeGreaterThan(0);
    expect(F).toBeGreaterThan(0);
    expect(W).toBeGreaterThan(0);
  });

  it('should calculate approximately correct SWU for standard enrichment', () => {
    // For 1 kg of 5% LEU from 0.7% feed with 0.3% tails
    // SWU should be approximately 7.0
    const { swu } = swuFor(1, 0.05, 0.007, 0.003);
    expect(swu).toBeCloseTo(7.0, 0); // Within 1 SWU
  });

  it('should scale SWU linearly with product mass', () => {
    const result1 = swuFor(1, 0.05, 0.007, 0.003);
    const result10 = swuFor(10, 0.05, 0.007, 0.003);

    expect(result10.swu).toBeCloseTo(result1.swu * 10, 4);
  });

  it('should require more SWU for higher enrichment', () => {
    const swu5 = swuFor(1, 0.05, 0.007, 0.003).swu;
    const swu20 = swuFor(1, 0.20, 0.007, 0.003).swu;

    expect(swu20).toBeGreaterThan(swu5);
  });

  it('should require more SWU for lower tails assay', () => {
    const swuHighTails = swuFor(1, 0.05, 0.007, 0.003).swu;
    const swuLowTails = swuFor(1, 0.05, 0.007, 0.002).swu;

    expect(swuLowTails).toBeGreaterThan(swuHighTails);
  });
});

// ============================================================================
// MODE 1: FEED & SWU FOR 1 KG TESTS
// ============================================================================

describe('computeFeedSwuForOneKg', () => {
  it('should return F, W, and swu', () => {
    const result = computeFeedSwuForOneKg(0.05, 0.003, 0.007);
    expect(result).toHaveProperty('F');
    expect(result).toHaveProperty('W');
    expect(result).toHaveProperty('swu');
  });

  it('should match swuFor with P=1', () => {
    const result1 = computeFeedSwuForOneKg(0.05, 0.003, 0.007);
    const result2 = swuFor(1, 0.05, 0.007, 0.003);

    expect(result1.F).toBeCloseTo(result2.F, 6);
    expect(result1.W).toBeCloseTo(result2.W, 6);
    expect(result1.swu).toBeCloseTo(result2.swu, 6);
  });
});

// ============================================================================
// MODE 2: FEED & SWU FROM EUP QUANTITY TESTS
// ============================================================================

describe('computeFeedSwu', () => {
  it('should scale results by product quantity', () => {
    const result1 = computeFeedSwu(0.05, 0.003, 0.007, 1);
    const result100 = computeFeedSwu(0.05, 0.003, 0.007, 100);

    expect(result100.F).toBeCloseTo(result1.F * 100, 4);
    expect(result100.swu).toBeCloseTo(result1.swu * 100, 4);
  });
});

// ============================================================================
// MODE 3: EUP & SWU FROM FEED QUANTITY TESTS
// ============================================================================

describe('computeEupSwu', () => {
  it('should calculate product and SWU from feed', () => {
    const result = computeEupSwu(0.05, 0.003, 0.007, 100);
    expect(result).toHaveProperty('P');
    expect(result).toHaveProperty('swu');
    expect(result.P).toBeGreaterThan(0);
    expect(result.swu).toBeGreaterThan(0);
  });

  it('should be inverse of computeFeedSwu', () => {
    const xp = 0.05, xw = 0.003, xf = 0.007;
    const P_original = 10;

    // Get feed from product
    const { F } = computeFeedSwu(xp, xw, xf, P_original);

    // Get product back from feed
    const { P } = computeEupSwu(xp, xw, xf, F);

    expect(P).toBeCloseTo(P_original, 4);
  });
});

// ============================================================================
// MODE 4: FEED & EUP FROM SWU QUANTITY TESTS
// ============================================================================

describe('computeFeedEupFromSwu', () => {
  it('should calculate product and feed from SWU', () => {
    const result = computeFeedEupFromSwu(0.05, 0.003, 0.007, 100);
    expect(result).toHaveProperty('P');
    expect(result).toHaveProperty('F');
    expect(result.P).toBeGreaterThan(0);
    expect(result.F).toBeGreaterThan(0);
  });

  it('should produce the correct SWU when verified', () => {
    const xp = 0.05, xw = 0.003, xf = 0.007;
    const targetSwu = 50;

    // Get product from SWU
    const { P, F } = computeFeedEupFromSwu(xp, xw, xf, targetSwu);

    // Verify by calculating SWU from product
    const { swu } = swuFor(P, xp, xf, xw);

    expect(swu).toBeCloseTo(targetSwu, 2);
  });

  it('should throw for extremely large SWU values', () => {
    expect(() => computeFeedEupFromSwu(0.05, 0.003, 0.007, 1e15)).toThrow('too large');
  });
});

// ============================================================================
// MODE 5: OPTIMUM TAILS ASSAY TESTS
// ============================================================================

describe('findOptimumTails', () => {
  it('should return all required outputs', () => {
    const result = findOptimumTails(0.05, 0.007, 75, 100);
    expect(result).toHaveProperty('xw');
    expect(result).toHaveProperty('F_per_P');
    expect(result).toHaveProperty('swu_per_P');
    expect(result).toHaveProperty('cost_per_P');
  });

  it('should find tails assay between 0 and feed assay', () => {
    const xf = 0.007;
    const result = findOptimumTails(0.05, xf, 75, 100);

    expect(result.xw).toBeGreaterThan(0);
    expect(result.xw).toBeLessThan(xf);
  });

  it('should minimize cost', () => {
    const xp = 0.05, xf = 0.007, cf = 75, cs = 100;
    const { xw: optXw, cost_per_P: optCost } = findOptimumTails(xp, xf, cf, cs);

    // Test that nearby tails values have higher cost
    const { swu: swuLower, F: fLower } = swuFor(1, xp, xf, optXw * 0.8);
    const costLower = cf * fLower + cs * swuLower;

    const { swu: swuHigher, F: fHigher } = swuFor(1, xp, xf, optXw * 1.2);
    const costHigher = cf * fHigher + cs * swuHigher;

    expect(optCost).toBeLessThan(costLower + 1); // Allow small tolerance
    expect(optCost).toBeLessThan(costHigher + 1);
  });

  it('should increase tails assay when SWU price increases relative to feed', () => {
    const xp = 0.05, xf = 0.007, cf = 75;

    const result1 = findOptimumTails(xp, xf, cf, 50);  // Low SWU price
    const result2 = findOptimumTails(xp, xf, cf, 200); // High SWU price

    // When SWU is expensive, optimal tails is higher (use less SWU, more feed)
    expect(result2.xw).toBeGreaterThan(result1.xw);
  });
});

// ============================================================================
// DEBOUNCE TESTS
// ============================================================================

describe('debounce', () => {
  it('should return a function', () => {
    const fn = debounce(() => {}, 100);
    expect(typeof fn).toBe('function');
  });

  it('should delay execution', (done) => {
    let called = false;
    const fn = debounce(() => { called = true; }, 50);

    fn();
    expect(called).toBe(false);

    setTimeout(() => {
      expect(called).toBe(true);
    }, 100);
  });
});

// ============================================================================
// EDGE CASES AND ERROR HANDLING
// ============================================================================

describe('Edge cases', () => {
  it('should handle very small assay differences', () => {
    // This should still work but might have precision issues
    const result = swuFor(1, 0.02, 0.007, 0.006);
    expect(result.swu).toBeGreaterThan(0);
  });

  it('should handle very high enrichment', () => {
    // 90% HEU
    const result = swuFor(1, 0.90, 0.007, 0.003);
    expect(result.swu).toBeGreaterThan(0);
    expect(result.F).toBeGreaterThan(0);
  });

  it('constants should have expected values', () => {
    expect(EPS).toBeLessThan(1e-8);
  });
});

// ============================================================================
// RUN TESTS
// ============================================================================

console.log('\n========================================');
console.log('Uranium Enrichment Calculator Tests');
console.log('========================================');

// Run all describe blocks (they execute immediately)

console.log('\n========================================');
console.log(`Results: ${testsPassed} passed, ${testsFailed} failed`);
console.log('========================================\n');

process.exit(testsFailed > 0 ? 1 : 0);
