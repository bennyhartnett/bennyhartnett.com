/**
 * Unit tests for Uranium Enrichment Calculator core math functions
 * Run with: node nuclear.test.js
 */

const assert = require('assert');

// ============================================================================
// CONSTANTS (duplicated from nuclear.js for testing)
// ============================================================================

const EPS = 1e-9;
const BINARY_SEARCH_ITERATIONS = 80;
const GOLDEN_SECTION_ITERATIONS = 80;

// ============================================================================
// CORE MATH FUNCTIONS (duplicated from nuclear.js for testing)
// ============================================================================

/**
 * Value function V(x) for SWU calculation
 * V(x) = (1 - 2x) * ln((1-x)/x)
 */
function valueFunction(x) {
  const xx = Math.min(Math.max(x, EPS), 1 - EPS);
  return (1 - 2 * xx) * Math.log((1 - xx) / xx);
}

/**
 * Validates that assays satisfy: product > feed > tails
 */
function checkOrdering(xp, xf, xw) {
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
 */
function massBalance(P, xp, xf, xw) {
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
 */
function swuFor(P, xp, xf, xw) {
  const { F, W } = massBalance(P, xp, xf, xw);
  const swu =
    P * valueFunction(xp) + W * valueFunction(xw) - F * valueFunction(xf);
  if (swu <= 0) {
    throw new Error(`SWU calculation resulted in a non-positive value (${swu.toFixed(3)} SWU). This typically indicates the assay values are too close together or physically unrealistic.`);
  }
  return { F, W, swu };
}

/**
 * Mode 1: Feed & SWU for 1 kg U EUP
 */
function computeFeedSwuForOneKg(xp, xw, xf) {
  return swuFor(1, xp, xf, xw);
}

/**
 * Mode 2: Feed & SWU from EUP Quantity
 */
function computeFeedSwu(xp, xw, xf, P) {
  return swuFor(P, xp, xf, xw);
}

/**
 * Mode 3: EUP & SWU from Feed Quantity
 */
function computeEupSwu(xp, xw, xf, F) {
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
 */
function computeFeedEupFromSwu(xp, xw, xf, S) {
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
 */
function findOptimumTails(xp, xf, cf, cs) {
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

// ============================================================================
// TESTS
// ============================================================================

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS: ${name}`);
    passed++;
  } catch (err) {
    console.log(`  FAIL: ${name}`);
    console.log(`        ${err.message}`);
    failed++;
  }
}

function assertClose(actual, expected, tolerance = 1e-6, message = '') {
  const diff = Math.abs(actual - expected);
  if (diff > tolerance) {
    throw new Error(`${message} Expected ${expected}, got ${actual} (diff: ${diff})`);
  }
}

console.log('\n=== valueFunction tests ===\n');

test('valueFunction at x=0.5 should return 0', () => {
  assertClose(valueFunction(0.5), 0, 1e-9);
});

test('valueFunction at x=0.007 (natural uranium) should be positive', () => {
  const result = valueFunction(0.007);
  assert(result > 0, `Expected positive value, got ${result}`);
  assertClose(result, 4.885, 0.02);
});

test('valueFunction at x=0.05 (5% enriched) should be positive', () => {
  const result = valueFunction(0.05);
  assert(result > 0, `Expected positive value, got ${result}`);
  assertClose(result, 2.650, 0.001);
});

test('valueFunction at x=0.003 (depleted tails) should be positive', () => {
  const result = valueFunction(0.003);
  assert(result > 0, `Expected positive value, got ${result}`);
  assertClose(result, 5.772, 0.001);
});

test('valueFunction handles edge case near 0', () => {
  const result = valueFunction(1e-10);
  assert(isFinite(result), `Expected finite value, got ${result}`);
});

test('valueFunction handles edge case near 1', () => {
  const result = valueFunction(1 - 1e-10);
  assert(isFinite(result), `Expected finite value, got ${result}`);
});

console.log('\n=== checkOrdering tests ===\n');

test('checkOrdering accepts valid ordering (product > feed > tails)', () => {
  checkOrdering(0.05, 0.007, 0.003); // 5% > 0.7% > 0.3%
});

test('checkOrdering throws for invalid ordering (feed > product)', () => {
  assert.throws(() => {
    checkOrdering(0.003, 0.007, 0.001);
  }, /Assay ordering is incorrect/);
});

test('checkOrdering throws for equal values', () => {
  assert.throws(() => {
    checkOrdering(0.05, 0.05, 0.003);
  }, /Assay ordering is incorrect/);
});

test('checkOrdering throws when tails > feed', () => {
  assert.throws(() => {
    checkOrdering(0.05, 0.003, 0.007);
  }, /Assay ordering is incorrect/);
});

console.log('\n=== massBalance tests ===\n');

test('massBalance calculates correct feed and waste for 1kg product', () => {
  // 5% product, 0.7% feed, 0.3% tails
  const { F, W } = massBalance(1, 0.05, 0.007, 0.003);
  // F = (0.05 - 0.003) / (0.007 - 0.003) * 1 = 0.047 / 0.004 = 11.75
  assertClose(F, 11.75, 0.01, 'Feed quantity');
  assertClose(W, 10.75, 0.01, 'Waste quantity');
});

test('massBalance scales linearly with product mass', () => {
  const res1 = massBalance(1, 0.05, 0.007, 0.003);
  const res10 = massBalance(10, 0.05, 0.007, 0.003);
  assertClose(res10.F, res1.F * 10, 0.01, 'Feed should scale linearly');
  assertClose(res10.W, res1.W * 10, 0.01, 'Waste should scale linearly');
});

test('massBalance throws for invalid ordering', () => {
  assert.throws(() => {
    massBalance(1, 0.003, 0.007, 0.05);
  }, /Assay ordering is incorrect/);
});

console.log('\n=== swuFor tests ===\n');

test('swuFor calculates positive SWU for valid inputs', () => {
  // 5% product, 0.7% feed, 0.3% tails
  const { F, W, swu } = swuFor(1, 0.05, 0.007, 0.003);
  assert(swu > 0, `Expected positive SWU, got ${swu}`);
  assertClose(F, 11.75, 0.01, 'Feed quantity');
  assertClose(W, 10.75, 0.01, 'Waste quantity');
});

test('swuFor returns consistent results for standard enrichment scenario', () => {
  // Standard LEU enrichment: 5% product, 0.7% feed, 0.3% tails
  const { swu } = swuFor(1, 0.05, 0.007, 0.003);
  // Expected SWU for this scenario is approximately 7.19
  assertClose(swu, 7.19, 0.1, 'SWU quantity');
});

test('swuFor scales linearly with product mass', () => {
  const res1 = swuFor(1, 0.05, 0.007, 0.003);
  const res10 = swuFor(10, 0.05, 0.007, 0.003);
  assertClose(res10.swu, res1.swu * 10, 0.01, 'SWU should scale linearly');
});

console.log('\n=== computeFeedSwuForOneKg tests ===\n');

test('computeFeedSwuForOneKg returns correct values for standard scenario', () => {
  const { F, W, swu } = computeFeedSwuForOneKg(0.05, 0.003, 0.007);
  assertClose(F, 11.75, 0.01, 'Feed quantity');
  assertClose(W, 10.75, 0.01, 'Waste quantity');
  assert(swu > 0, `Expected positive SWU, got ${swu}`);
});

console.log('\n=== computeFeedSwu tests ===\n');

test('computeFeedSwu returns correct values for 100kg product', () => {
  const { F, W, swu } = computeFeedSwu(0.05, 0.003, 0.007, 100);
  assertClose(F, 1175, 1, 'Feed quantity for 100kg product');
  assertClose(W, 1075, 1, 'Waste quantity for 100kg product');
});

console.log('\n=== computeEupSwu tests ===\n');

test('computeEupSwu calculates product from feed correctly', () => {
  // Given feed, calculate product
  const { P, W, swu } = computeEupSwu(0.05, 0.003, 0.007, 11.75);
  assertClose(P, 1, 0.01, 'Product quantity');
  assertClose(W, 10.75, 0.01, 'Waste quantity');
});

test('computeEupSwu is inverse of computeFeedSwu', () => {
  // Start with known product, get feed, then reverse
  const res1 = computeFeedSwu(0.05, 0.003, 0.007, 50);
  const res2 = computeEupSwu(0.05, 0.003, 0.007, res1.F);
  assertClose(res2.P, 50, 0.01, 'Should recover original product quantity');
});

console.log('\n=== computeFeedEupFromSwu tests ===\n');

test('computeFeedEupFromSwu finds correct product for given SWU', () => {
  // First calculate SWU for known product
  const knownResult = swuFor(100, 0.05, 0.007, 0.003);

  // Then find product from that SWU
  const { P, F } = computeFeedEupFromSwu(0.05, 0.003, 0.007, knownResult.swu);
  assertClose(P, 100, 0.1, 'Product quantity');
  assertClose(F, knownResult.F, 0.1, 'Feed quantity');
});

test('computeFeedEupFromSwu throws for negative SWU', () => {
  assert.throws(() => {
    computeFeedEupFromSwu(0.05, 0.003, 0.007, -100);
  }, /SWU Quantity must be a positive number/);
});

test('computeFeedEupFromSwu throws for zero SWU', () => {
  assert.throws(() => {
    computeFeedEupFromSwu(0.05, 0.003, 0.007, 0);
  }, /SWU Quantity must be a positive number/);
});

console.log('\n=== findOptimumTails tests ===\n');

test('findOptimumTails finds optimum in valid range', () => {
  const { xw, F_per_P, swu_per_P, cost_per_P } = findOptimumTails(0.05, 0.007, 75, 100);

  // Optimum tails should be between 0 and feed assay
  assert(xw > 0 && xw < 0.007, `Optimum tails ${xw} should be between 0 and feed assay`);
  assert(F_per_P > 0, `Feed per product ${F_per_P} should be positive`);
  assert(swu_per_P > 0, `SWU per product ${swu_per_P} should be positive`);
  assert(cost_per_P > 0, `Cost per product ${cost_per_P} should be positive`);
});

test('findOptimumTails responds to price changes', () => {
  // Higher SWU price should push optimum tails higher (less SWU, more feed)
  const lowSwuPrice = findOptimumTails(0.05, 0.007, 75, 50);
  const highSwuPrice = findOptimumTails(0.05, 0.007, 75, 200);

  assert(highSwuPrice.xw > lowSwuPrice.xw,
    `Higher SWU price should give higher optimum tails. Low: ${lowSwuPrice.xw}, High: ${highSwuPrice.xw}`);
});

test('findOptimumTails gives reasonable tails assay', () => {
  // For typical prices, optimum tails should be around 0.2-0.4%
  const { xw } = findOptimumTails(0.05, 0.007, 75, 100);
  const xwPercent = xw * 100;
  assert(xwPercent > 0.1 && xwPercent < 0.6,
    `Optimum tails ${xwPercent}% should be in reasonable range (0.1-0.6%)`);
});

// ============================================================================
// SUMMARY
// ============================================================================

console.log('\n=== TEST SUMMARY ===\n');
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);
console.log(`  Total:  ${passed + failed}`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('\nAll tests passed!');
  process.exit(0);
}
