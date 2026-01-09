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
  // REAL-TIME CALCULATION HELPERS
  // ============================================================================

  const DEBOUNCE_DELAY = 300;

  function debounce(fn, delay) {
    let timeoutId;
    return function (...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  function clearOutputs(ids) {
    ids.forEach((id) => {
      const el = byId(id);
      if (el) el.value = '';
    });
  }

  function addRealTimeListeners(formId, inputIds, outputIds, calcFn) {
    const form = byId(formId);
    if (!form) return;

    const debouncedCalc = debounce(() => {
      calcFn(true);
    }, DEBOUNCE_DELAY);

    inputIds.forEach((id) => {
      const input = byId(id);
      if (input) {
        input.addEventListener('input', () => {
          clearOutputs(outputIds);
          debouncedCalc();
        });
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            calcFn(false);
          }
        });
      }
    });
  }

  // ============================================================================
  // CALCULATOR EVENT HANDLERS
  // ============================================================================

  function initMode1() {
    const inputIds = ['xp1', 'xw1', 'xf1'];
    const outputIds = ['feed1', 'waste1', 'swu1'];

    function calculate(silent) {
      try {
        const xp = parseAssay('xp1');
        const xw = parseAssay('xw1');
        const xf = parseAssay('xf1');
        const res = computeFeedSwuForOneKg(xp, xw, xf);
        byId('feed1').value = res.F.toFixed(MASS_PRECISION);
        byId('waste1').value = res.W.toFixed(MASS_PRECISION);
        byId('swu1').value = res.swu.toFixed(SWU_PRECISION);
      } catch (err) {
        if (!silent) showError(err.message);
      }
    }

    byId('calc1').addEventListener('click', () => calculate(false));
    byId('clear1').addEventListener('click', () => resetForm('form1'));
    addRealTimeListeners('form1', inputIds, outputIds, calculate);
  }

  function initMode2() {
    const inputIds = ['p2', 'xp2', 'xw2', 'xf2'];
    const outputIds = ['feed2', 'waste2', 'swu2'];

    function calculate(silent) {
      try {
        const P = parseMass('p2');
        const xp = parseAssay('xp2');
        const xw = parseAssay('xw2');
        const xf = parseAssay('xf2');
        const res = computeFeedSwu(xp, xw, xf, P);
        byId('feed2').value = res.F.toFixed(MASS_PRECISION);
        byId('waste2').value = res.W.toFixed(MASS_PRECISION);
        byId('swu2').value = res.swu.toFixed(SWU_PRECISION);
      } catch (err) {
        if (!silent) showError(err.message);
      }
    }

    byId('calc2').addEventListener('click', () => calculate(false));
    byId('clear2').addEventListener('click', () => resetForm('form2'));
    addRealTimeListeners('form2', inputIds, outputIds, calculate);
  }

  function initMode3() {
    const inputIds = ['F3', 'xp3', 'xw3', 'xf3'];
    const outputIds = ['P3', 'swu3'];

    function calculate(silent) {
      try {
        const F = parseMass('F3');
        const xp = parseAssay('xp3');
        const xw = parseAssay('xw3');
        const xf = parseAssay('xf3');
        const res = computeEupSwu(xp, xw, xf, F);
        byId('P3').value = res.P.toFixed(MASS_PRECISION);
        byId('swu3').value = res.swu.toFixed(SWU_PRECISION);
      } catch (err) {
        if (!silent) showError(err.message);
      }
    }

    byId('calc3').addEventListener('click', () => calculate(false));
    byId('clear3').addEventListener('click', () => resetForm('form3'));
    addRealTimeListeners('form3', inputIds, outputIds, calculate);
  }

  function initMode4() {
    const inputIds = ['S4', 'xp4', 'xw4', 'xf4'];
    const outputIds = ['P4', 'feed4'];

    function calculate(silent) {
      try {
        const S = parsePositiveNumber('S4');
        const xp = parseAssay('xp4');
        const xw = parseAssay('xw4');
        const xf = parseAssay('xf4');
        const res = computeFeedEupFromSwu(xp, xw, xf, S);
        byId('P4').value = res.P.toFixed(MASS_PRECISION);
        byId('feed4').value = res.F.toFixed(MASS_PRECISION);
      } catch (err) {
        if (!silent) showError(err.message);
      }
    }

    byId('calc4').addEventListener('click', () => calculate(false));
    byId('clear4').addEventListener('click', () => resetForm('form4'));
    addRealTimeListeners('form4', inputIds, outputIds, calculate);
  }

  function initMode5() {
    const inputIds = ['cf5', 'cs5', 'xp5', 'xf5'];
    const outputIds = ['xw5', 'feedPerP5', 'swuPerP5', 'costPerP5'];

    function calculate(silent) {
      try {
        const cf = parsePositiveNumber('cf5');
        const cs = parsePositiveNumber('cs5');
        const xp = parseAssay('xp5');
        const xf = parseAssay('xf5');
        const res = findOptimumTails(xp, xf, cf, cs);
        byId('xw5').value = (res.xw * 100).toFixed(PERCENT_PRECISION);
        byId('feedPerP5').value = res.F_per_P.toFixed(MASS_PRECISION);
        byId('swuPerP5').value = res.swu_per_P.toFixed(SWU_PRECISION);
        byId('costPerP5').value = res.cost_per_P.toFixed(2);
      } catch (err) {
        if (!silent) showError(err.message);
      }
    }

    byId('calc5').addEventListener('click', () => calculate(false));
    byId('clear5').addEventListener('click', () => resetForm('form5'));
    addRealTimeListeners('form5', inputIds, outputIds, calculate);
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
