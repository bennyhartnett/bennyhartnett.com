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
  // DEBOUNCE UTILITY
  // ============================================================================

  const DEBOUNCE_DELAY = 300;

  function debounce(fn, delay = DEBOUNCE_DELAY) {
    let timeoutId;
    return function (...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  // ============================================================================
  // INLINE ERROR DISPLAY
  // ============================================================================

  function showInlineError(formId, message) {
    const form = byId(formId);
    if (!form) return;

    // Find or create error container
    let errorContainer = form.querySelector('.inline-error');
    if (!errorContainer) {
      errorContainer = document.createElement('div');
      errorContainer.className = 'inline-error mt-2 p-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm';
      // Insert before the action buttons
      const actionsDiv = form.querySelector('.flex.flex-col.gap-3');
      if (actionsDiv) {
        actionsDiv.parentNode.insertBefore(errorContainer, actionsDiv);
      } else {
        form.appendChild(errorContainer);
      }
    }

    errorContainer.textContent = message;
    errorContainer.style.display = 'block';

    // Auto-hide after 5 seconds
    setTimeout(() => {
      if (errorContainer) {
        errorContainer.style.display = 'none';
      }
    }, 5000);
  }

  function clearInlineError(formId) {
    const form = byId(formId);
    if (!form) return;
    const errorContainer = form.querySelector('.inline-error');
    if (errorContainer) {
      errorContainer.style.display = 'none';
    }
  }

  // ============================================================================
  // CALCULATOR FACTORY
  // ============================================================================

  function createCalculatorHandlers(config) {
    const {
      formId,
      inputIds,
      outputIds,
      calcButtonId,
      clearButtonId,
      parseInputs,
      compute,
      formatOutputs,
    } = config;

    const clearOutputs = () => {
      outputIds.forEach((id) => {
        byId(id).value = '';
      });
    };

    const calculate = () => {
      try {
        clearInlineError(formId);
        const inputs = parseInputs();
        const result = compute(inputs);
        formatOutputs(result);
        triggerShimmer(outputIds);
      } catch (err) {
        clearOutputs();
      }
    };

    const calculateWithError = () => {
      try {
        clearInlineError(formId);
        const inputs = parseInputs();
        const result = compute(inputs);
        formatOutputs(result);
        triggerShimmer(outputIds);
      } catch (err) {
        showInlineError(formId, err.message);
      }
    };

    const debouncedCalculate = debounce(calculate);

    return {
      calculate,
      calculateWithError,
      debouncedCalculate,
      clearOutputs,
      setup: () => {
        byId(calcButtonId).addEventListener('click', calculateWithError);
        byId(clearButtonId).addEventListener('click', () => {
          triggerClearShimmer([...inputIds, ...outputIds]);
          triggerClearButtonAnimation(clearButtonId);
          resetForm(formId);
          clearInlineError(formId);
        });

        inputIds.forEach((id) => {
          byId(id).addEventListener('input', debouncedCalculate);
        });

        byId(formId).addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            calculateWithError();
          }
        });
      },
    };
  }

  // ============================================================================
  // INPUT PARSING
  // ============================================================================

  function parseAssay(id) {
    const raw = byId(id).value.trim();
    const label = byId(id).closest('div')?.querySelector('label')?.textContent || 'Assay';
    const value = parseFloat(raw);
    if (!isFinite(value)) {
      throw new Error(`${label} must be a valid number. Please enter a numeric value (e.g., 5 or 0.7).`);
    }
    if (value <= 0 || value >= 100) {
      throw new Error(`${label} must be between 0% and 100% (exclusive). You entered ${value}%, which is outside the valid range.`);
    }
    return value / 100;
  }

  function parseMass(id) {
    const raw = byId(id).value.trim();
    const label = byId(id).closest('div')?.querySelector('label')?.textContent || 'Mass';
    const value = parseFloat(raw);
    if (!isFinite(value)) {
      throw new Error(`${label} must be a valid number. Please enter a numeric value greater than zero.`);
    }
    if (value <= 0) {
      throw new Error(`${label} must be a positive number. You entered ${value}, but the value must be greater than zero.`);
    }
    return value;
  }

  function parsePositiveNumber(id) {
    const raw = byId(id).value.trim();
    const label = byId(id).closest('div')?.querySelector('label')?.textContent || 'Value';
    const value = parseFloat(raw);
    if (!isFinite(value)) {
      throw new Error(`${label} must be a valid number. Please enter a numeric value greater than zero.`);
    }
    if (value <= 0) {
      throw new Error(`${label} must be a positive number. You entered ${value}, but the value must be greater than zero.`);
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
  // UI FUNCTIONS
  // ============================================================================

  /**
   * Triggers a green-to-blue shimmer effect on result fields
   * Applies to the full input group wrapper (input + unit label)
   * @param {string[]} elementIds - Array of element IDs to apply shimmer to
   */
  function triggerShimmer(elementIds) {
    elementIds.forEach((id) => {
      const el = byId(id);
      if (el) {
        // Apply shimmer to the input group wrapper (parent div)
        const wrapper = el.parentElement;
        if (wrapper) {
          // Remove class first to allow re-triggering
          wrapper.classList.remove('result-shimmer');
          // Force reflow to restart animation
          void wrapper.offsetWidth;
          wrapper.classList.add('result-shimmer');
        }
      }
    });
  }

  /**
   * Triggers a red shimmer effect on cleared result fields
   * Applies to the full input group wrapper (input + unit label)
   * @param {string[]} elementIds - Array of element IDs to apply red shimmer to
   */
  function triggerClearShimmer(elementIds) {
    elementIds.forEach((id) => {
      const el = byId(id);
      if (el) {
        // Apply shimmer to the input group wrapper (parent div)
        const wrapper = el.parentElement;
        if (wrapper) {
          // Remove class first to allow re-triggering
          wrapper.classList.remove('clear-shimmer');
          // Force reflow to restart animation
          void wrapper.offsetWidth;
          wrapper.classList.add('clear-shimmer');
        }
      }
    });
  }

  /**
   * Triggers the clear button red animation for 3 seconds
   * @param {string} buttonId - The ID of the clear button
   */
  function triggerClearButtonAnimation(buttonId) {
    const btn = byId(buttonId);
    if (btn) {
      // Remove class first to allow re-triggering
      btn.classList.remove('clear-btn-active');
      // Force reflow to restart animation
      void btn.offsetWidth;
      btn.classList.add('clear-btn-active');
      // Remove the class after animation completes (3 seconds)
      setTimeout(() => {
        btn.classList.remove('clear-btn-active');
      }, 3000);
    }
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

  function openAccordionForHash(hash, shouldScroll = true) {
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
      // Smooth scroll to the section after a brief delay to let animation start
      if (shouldScroll) {
        setTimeout(() => {
          section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
      }
    }
  }

  function initAccordionNavigation() {
    // Handle mode navigation link clicks
    document.querySelectorAll('nav a[href^="#mode"]').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const hash = link.getAttribute('href');
        // Update URL without jumping
        history.pushState(null, '', hash);
        openAccordionForHash(hash);
      });
    });

    // Handle hash on page load (don't scroll on initial load if already at top)
    if (window.location.hash) {
      openAccordionForHash(window.location.hash, false);
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
    createCalculatorHandlers({
      formId: 'form1',
      inputIds: ['xp1', 'xw1', 'xf1'],
      outputIds: ['feed1', 'waste1', 'swu1'],
      calcButtonId: 'calc1',
      clearButtonId: 'clear1',
      parseInputs: () => ({
        xp: parseAssay('xp1'),
        xw: parseAssay('xw1'),
        xf: parseAssay('xf1'),
      }),
      compute: ({ xp, xw, xf }) => computeFeedSwuForOneKg(xp, xw, xf),
      formatOutputs: (res) => {
        byId('feed1').value = res.F.toFixed(MASS_PRECISION);
        byId('waste1').value = res.W.toFixed(MASS_PRECISION);
        byId('swu1').value = res.swu.toFixed(SWU_PRECISION);
      },
    }).setup();
  }

  function initMode2() {
    createCalculatorHandlers({
      formId: 'form2',
      inputIds: ['p2', 'xp2', 'xw2', 'xf2'],
      outputIds: ['feed2', 'waste2', 'swu2'],
      calcButtonId: 'calc2',
      clearButtonId: 'clear2',
      parseInputs: () => ({
        P: parseMass('p2'),
        xp: parseAssay('xp2'),
        xw: parseAssay('xw2'),
        xf: parseAssay('xf2'),
      }),
      compute: ({ P, xp, xw, xf }) => computeFeedSwu(xp, xw, xf, P),
      formatOutputs: (res) => {
        byId('feed2').value = res.F.toFixed(MASS_PRECISION);
        byId('waste2').value = res.W.toFixed(MASS_PRECISION);
        byId('swu2').value = res.swu.toFixed(SWU_PRECISION);
      },
    }).setup();
  }

  function initMode3() {
    createCalculatorHandlers({
      formId: 'form3',
      inputIds: ['F3', 'xp3', 'xw3', 'xf3'],
      outputIds: ['P3', 'swu3'],
      calcButtonId: 'calc3',
      clearButtonId: 'clear3',
      parseInputs: () => ({
        F: parseMass('F3'),
        xp: parseAssay('xp3'),
        xw: parseAssay('xw3'),
        xf: parseAssay('xf3'),
      }),
      compute: ({ F, xp, xw, xf }) => computeEupSwu(xp, xw, xf, F),
      formatOutputs: (res) => {
        byId('P3').value = res.P.toFixed(MASS_PRECISION);
        byId('swu3').value = res.swu.toFixed(SWU_PRECISION);
      },
    }).setup();
  }

  function initMode4() {
    createCalculatorHandlers({
      formId: 'form4',
      inputIds: ['S4', 'xp4', 'xw4', 'xf4'],
      outputIds: ['P4', 'feed4'],
      calcButtonId: 'calc4',
      clearButtonId: 'clear4',
      parseInputs: () => ({
        S: parsePositiveNumber('S4'),
        xp: parseAssay('xp4'),
        xw: parseAssay('xw4'),
        xf: parseAssay('xf4'),
      }),
      compute: ({ S, xp, xw, xf }) => computeFeedEupFromSwu(xp, xw, xf, S),
      formatOutputs: (res) => {
        byId('P4').value = res.P.toFixed(MASS_PRECISION);
        byId('feed4').value = res.F.toFixed(MASS_PRECISION);
      },
    }).setup();
  }

  function initMode5() {
    const COST_PRECISION = 2;
    createCalculatorHandlers({
      formId: 'form5',
      inputIds: ['cf5', 'cs5', 'xp5', 'xf5'],
      outputIds: ['xw5', 'feedPerP5', 'swuPerP5', 'costPerP5'],
      calcButtonId: 'calc5',
      clearButtonId: 'clear5',
      parseInputs: () => ({
        cf: parsePositiveNumber('cf5'),
        cs: parsePositiveNumber('cs5'),
        xp: parseAssay('xp5'),
        xf: parseAssay('xf5'),
      }),
      compute: ({ cf, cs, xp, xf }) => findOptimumTails(xp, xf, cf, cs),
      formatOutputs: (res) => {
        byId('xw5').value = (res.xw * 100).toFixed(PERCENT_PRECISION);
        byId('feedPerP5').value = res.F_per_P.toFixed(MASS_PRECISION);
        byId('swuPerP5').value = res.swu_per_P.toFixed(SWU_PRECISION);
        byId('costPerP5').value = res.cost_per_P.toFixed(COST_PRECISION);
      },
    }).setup();
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
