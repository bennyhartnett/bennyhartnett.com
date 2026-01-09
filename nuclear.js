/**
 * Uranium Enrichment Calculators
 * Built for Centrus Energy to compute feed quantity, SWU requirements,
 * and optimum tails assay from input assays.
 */

(function () {
  'use strict';

  // ============================================================================
  // CONSTANTS
  // ============================================================================

  const EPS = 1e-9;
  const BINARY_SEARCH_ITERATIONS = 80;
  const GOLDEN_SECTION_ITERATIONS = 80;
  const MASS_PRECISION = 6;
  const SWU_PRECISION = 3;
  const PERCENT_PRECISION = 3;

  // ============================================================================
  // DOM UTILITIES
  // ============================================================================

  const byId = (id) => document.getElementById(id);

  // ============================================================================
  // INPUT PARSING
  // ============================================================================

  function parseAssay(id) {
    const raw = byId(id).value.trim();
    const value = parseFloat(raw);
    if (!isFinite(value)) {
      throw new Error('Assay must be a number.');
    }
    if (value <= 0 || value >= 100) {
      throw new Error('Assay must be between 0 and 100 (exclusive).');
    }
    return value / 100;
  }

  function parseMass(id) {
    const raw = byId(id).value.trim();
    const value = parseFloat(raw);
    if (!isFinite(value) || value <= 0) {
      throw new Error('Mass values must be positive numbers.');
    }
    return value;
  }

  function parsePositiveNumber(id) {
    const raw = byId(id).value.trim();
    const value = parseFloat(raw);
    if (!isFinite(value) || value <= 0) {
      throw new Error('Values must be positive numbers.');
    }
    return value;
  }

  // ============================================================================
  // CORE MATH FUNCTIONS
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
      throw new Error('Assays must satisfy: product > feed > tails.');
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
      throw new Error('Computed masses must be positive.');
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
      throw new Error('Computed SWU must be positive.');
    }
    return { F, W, swu };
  }

  // ============================================================================
  // CALCULATOR FUNCTIONS
  // ============================================================================

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
      throw new Error('Computed product mass must be positive.');
    }
    const W = F - P;
    const swu =
      P * valueFunction(xp) + W * valueFunction(xw) - F * valueFunction(xf);
    if (swu <= 0) {
      throw new Error('Computed SWU must be positive.');
    }
    return { P, W, swu };
  }

  /**
   * Mode 4: Feed & EUP from SWU Quantity
   * Uses binary search to find product mass given SWU constraint
   */
  function computeFeedEupFromSwu(xp, xw, xf, S) {
    checkOrdering(xp, xf, xw);
    if (S <= 0) throw new Error('SWU must be positive.');

    // Find upper bound for binary search
    let Plo = EPS;
    let Phi = 1;

    while (true) {
      const { swu } = swuFor(Phi, xp, xf, xw);
      if (swu > S) break;
      Phi *= 2;
      if (Phi > 1e7) {
        throw new Error('SWU too large or parameters unrealistic.');
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
  // UI FUNCTIONS
  // ============================================================================

  /**
   * Triggers a green-to-blue shimmer effect on result fields
   * @param {string[]} elementIds - Array of element IDs to apply shimmer to
   */
  function triggerShimmer(elementIds) {
    elementIds.forEach((id) => {
      const el = byId(id);
      if (el) {
        // Remove class first to allow re-triggering
        el.classList.remove('result-shimmer');
        // Force reflow to restart animation
        void el.offsetWidth;
        el.classList.add('result-shimmer');
      }
    });
  }

  function showError(message) {
    Swal.fire({
      icon: 'error',
      title: 'Invalid input',
      text: message,
    });
  }

  function resetForm(formId) {
    const form = byId(formId);
    if (!form) return;
    form.reset();
    form.querySelectorAll('input').forEach((input) => {
      if (input.hasAttribute('readonly')) {
        input.value = '';
      }
    });
  }

  // ============================================================================
  // DARK MODE
  // ============================================================================

  function initDarkMode() {
    const darkModeToggle = byId('darkModeToggle');
    if (darkModeToggle) {
      darkModeToggle.addEventListener('click', () => {
        const html = document.documentElement;
        const isDark = html.classList.toggle('dark');
        localStorage.setItem('darkMode', isDark);
      });
    }
  }

  // ============================================================================
  // ACCORDION NAVIGATION
  // ============================================================================

  function openAccordionForHash(hash) {
    if (!hash) return;
    const section = document.querySelector(hash);
    if (!section) return;
    const details = section.querySelector('details');
    if (details) {
      // Close all other accordions
      document.querySelectorAll("section[id^='mode'] details").forEach((d) => {
        if (d !== details) d.removeAttribute('open');
      });
      // Open the target accordion
      details.setAttribute('open', '');
    }
  }

  function initAccordionNavigation() {
    // Handle mode navigation link clicks
    document.querySelectorAll('nav a[href^="#mode"]').forEach((link) => {
      link.addEventListener('click', () => {
        const hash = link.getAttribute('href');
        openAccordionForHash(hash);
      });
    });

    // Handle hash on page load
    if (window.location.hash) {
      openAccordionForHash(window.location.hash);
    }

    // Handle hash changes (e.g., back/forward navigation)
    window.addEventListener('hashchange', () => {
      openAccordionForHash(window.location.hash);
    });
  }

  // ============================================================================
  // CALCULATOR EVENT HANDLERS
  // ============================================================================

  function initMode1() {
    const mode1Outputs = ['feed1', 'waste1', 'swu1'];

    const calculate1 = () => {
      try {
        const xp = parseAssay('xp1');
        const xw = parseAssay('xw1');
        const xf = parseAssay('xf1');
        console.log('Mode 1 inputs:', { xp, xw, xf });
        const res = computeFeedSwuForOneKg(xp, xw, xf);
        console.log('Mode 1 results:', res);
        byId('feed1').value = res.F.toFixed(MASS_PRECISION);
        byId('waste1').value = res.W.toFixed(MASS_PRECISION);
        byId('swu1').value = res.swu.toFixed(SWU_PRECISION);
        console.log('Mode 1 values set:', {
          feed1: byId('feed1').value,
          waste1: byId('waste1').value,
          swu1: byId('swu1').value
        });
        triggerShimmer(mode1Outputs);
      } catch (err) {
        // Clear outputs on invalid input (for real-time calc)
        console.log('Mode 1 error:', err.message);
        byId('feed1').value = '';
        byId('waste1').value = '';
        byId('swu1').value = '';
      }
    };

    const calculateWithError1 = () => {
      try {
        const xp = parseAssay('xp1');
        const xw = parseAssay('xw1');
        const xf = parseAssay('xf1');
        const res = computeFeedSwuForOneKg(xp, xw, xf);
        byId('feed1').value = res.F.toFixed(MASS_PRECISION);
        byId('waste1').value = res.W.toFixed(MASS_PRECISION);
        byId('swu1').value = res.swu.toFixed(SWU_PRECISION);
        triggerShimmer(mode1Outputs);
      } catch (err) {
        showError(err.message);
      }
    };

    byId('calc1').addEventListener('click', calculateWithError1);
    byId('clear1').addEventListener('click', () => resetForm('form1'));

    // Real-time calculation on input
    ['xp1', 'xw1', 'xf1'].forEach((id) => {
      byId(id).addEventListener('input', calculate1);
    });

    // Enter key support
    byId('form1').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        calculateWithError1();
      }
    });
  }

  function initMode2() {
    const mode2Outputs = ['feed2', 'waste2', 'swu2'];

    const calculate2 = () => {
      try {
        const P = parseMass('p2');
        const xp = parseAssay('xp2');
        const xw = parseAssay('xw2');
        const xf = parseAssay('xf2');
        const res = computeFeedSwu(xp, xw, xf, P);
        byId('feed2').value = res.F.toFixed(MASS_PRECISION);
        byId('waste2').value = res.W.toFixed(MASS_PRECISION);
        byId('swu2').value = res.swu.toFixed(SWU_PRECISION);
        triggerShimmer(mode2Outputs);
      } catch (err) {
        // Clear outputs on invalid input (for real-time calc)
        byId('feed2').value = '';
        byId('waste2').value = '';
        byId('swu2').value = '';
      }
    };

    const calculateWithError2 = () => {
      try {
        const P = parseMass('p2');
        const xp = parseAssay('xp2');
        const xw = parseAssay('xw2');
        const xf = parseAssay('xf2');
        const res = computeFeedSwu(xp, xw, xf, P);
        byId('feed2').value = res.F.toFixed(MASS_PRECISION);
        byId('waste2').value = res.W.toFixed(MASS_PRECISION);
        byId('swu2').value = res.swu.toFixed(SWU_PRECISION);
        triggerShimmer(mode2Outputs);
      } catch (err) {
        showError(err.message);
      }
    };

    byId('calc2').addEventListener('click', calculateWithError2);
    byId('clear2').addEventListener('click', () => resetForm('form2'));

    // Real-time calculation on input
    ['p2', 'xp2', 'xw2', 'xf2'].forEach((id) => {
      byId(id).addEventListener('input', calculate2);
    });

    // Enter key support
    byId('form2').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        calculateWithError2();
      }
    });
  }

  function initMode3() {
    const mode3Outputs = ['P3', 'swu3'];

    const calculate3 = () => {
      try {
        const F = parseMass('F3');
        const xp = parseAssay('xp3');
        const xw = parseAssay('xw3');
        const xf = parseAssay('xf3');
        const res = computeEupSwu(xp, xw, xf, F);
        byId('P3').value = res.P.toFixed(MASS_PRECISION);
        byId('swu3').value = res.swu.toFixed(SWU_PRECISION);
        triggerShimmer(mode3Outputs);
      } catch (err) {
        // Clear outputs on invalid input (for real-time calc)
        byId('P3').value = '';
        byId('swu3').value = '';
      }
    };

    const calculateWithError3 = () => {
      try {
        const F = parseMass('F3');
        const xp = parseAssay('xp3');
        const xw = parseAssay('xw3');
        const xf = parseAssay('xf3');
        const res = computeEupSwu(xp, xw, xf, F);
        byId('P3').value = res.P.toFixed(MASS_PRECISION);
        byId('swu3').value = res.swu.toFixed(SWU_PRECISION);
        triggerShimmer(mode3Outputs);
      } catch (err) {
        showError(err.message);
      }
    };

    byId('calc3').addEventListener('click', calculateWithError3);
    byId('clear3').addEventListener('click', () => resetForm('form3'));

    // Real-time calculation on input
    ['F3', 'xp3', 'xw3', 'xf3'].forEach((id) => {
      byId(id).addEventListener('input', calculate3);
    });

    // Enter key support
    byId('form3').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        calculateWithError3();
      }
    });
  }

  function initMode4() {
    const mode4Outputs = ['P4', 'feed4'];

    const calculate4 = () => {
      try {
        const S = parsePositiveNumber('S4');
        const xp = parseAssay('xp4');
        const xw = parseAssay('xw4');
        const xf = parseAssay('xf4');
        const res = computeFeedEupFromSwu(xp, xw, xf, S);
        byId('P4').value = res.P.toFixed(MASS_PRECISION);
        byId('feed4').value = res.F.toFixed(MASS_PRECISION);
        triggerShimmer(mode4Outputs);
      } catch (err) {
        // Clear outputs on invalid input (for real-time calc)
        byId('P4').value = '';
        byId('feed4').value = '';
      }
    };

    const calculateWithError4 = () => {
      try {
        const S = parsePositiveNumber('S4');
        const xp = parseAssay('xp4');
        const xw = parseAssay('xw4');
        const xf = parseAssay('xf4');
        const res = computeFeedEupFromSwu(xp, xw, xf, S);
        byId('P4').value = res.P.toFixed(MASS_PRECISION);
        byId('feed4').value = res.F.toFixed(MASS_PRECISION);
        triggerShimmer(mode4Outputs);
      } catch (err) {
        showError(err.message);
      }
    };

    byId('calc4').addEventListener('click', calculateWithError4);
    byId('clear4').addEventListener('click', () => resetForm('form4'));

    // Real-time calculation on input
    ['S4', 'xp4', 'xw4', 'xf4'].forEach((id) => {
      byId(id).addEventListener('input', calculate4);
    });

    // Enter key support
    byId('form4').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        calculateWithError4();
      }
    });
  }

  function initMode5() {
    const COST_PRECISION = 2;
    const mode5Outputs = ['xw5', 'feedPerP5', 'swuPerP5', 'costPerP5'];

    const calculate5 = () => {
      try {
        const cf = parsePositiveNumber('cf5');
        const cs = parsePositiveNumber('cs5');
        const xp = parseAssay('xp5');
        const xf = parseAssay('xf5');
        console.log('Mode 5 inputs:', { cf, cs, xp, xf });
        const res = findOptimumTails(xp, xf, cf, cs);
        console.log('Mode 5 results:', res);
        byId('xw5').value = (res.xw * 100).toFixed(PERCENT_PRECISION);
        byId('feedPerP5').value = res.F_per_P.toFixed(MASS_PRECISION);
        byId('swuPerP5').value = res.swu_per_P.toFixed(SWU_PRECISION);
        byId('costPerP5').value = res.cost_per_P.toFixed(COST_PRECISION);
        console.log('Mode 5 values set:', {
          xw5: byId('xw5').value,
          feedPerP5: byId('feedPerP5').value,
          swuPerP5: byId('swuPerP5').value,
          costPerP5: byId('costPerP5').value
        });
        triggerShimmer(mode5Outputs);
      } catch (err) {
        // Clear outputs on invalid input (for real-time calc)
        console.log('Mode 5 error:', err.message);
        byId('xw5').value = '';
        byId('feedPerP5').value = '';
        byId('swuPerP5').value = '';
        byId('costPerP5').value = '';
      }
    };

    const calculateWithError5 = () => {
      try {
        const cf = parsePositiveNumber('cf5');
        const cs = parsePositiveNumber('cs5');
        const xp = parseAssay('xp5');
        const xf = parseAssay('xf5');
        const res = findOptimumTails(xp, xf, cf, cs);
        byId('xw5').value = (res.xw * 100).toFixed(PERCENT_PRECISION);
        byId('feedPerP5').value = res.F_per_P.toFixed(MASS_PRECISION);
        byId('swuPerP5').value = res.swu_per_P.toFixed(SWU_PRECISION);
        byId('costPerP5').value = res.cost_per_P.toFixed(COST_PRECISION);
        triggerShimmer(mode5Outputs);
      } catch (err) {
        showError(err.message);
      }
    };

    byId('calc5').addEventListener('click', calculateWithError5);
    byId('clear5').addEventListener('click', () => resetForm('form5'));

    // Real-time calculation on input
    ['cf5', 'cs5', 'xp5', 'xf5'].forEach((id) => {
      byId(id).addEventListener('input', calculate5);
    });

    // Enter key support
    byId('form5').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        calculateWithError5();
      }
    });
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  function initFooterYear() {
    const yearEl = byId('current-year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();
  }

  function setupHandlers() {
    // Initialize calculator modes
    initMode1();
    initMode2();
    initMode3();
    initMode4();
    initMode5();

    // Initialize UI features
    initFooterYear();
    initDarkMode();
    initAccordionNavigation();
  }

  // Start initialization when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupHandlers);
  } else {
    // Use setTimeout to defer execution, ensuring DOM is ready after SPA navigation
    setTimeout(setupHandlers, 0);
  }
})();
