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
  const DEBOUNCE_DELAY = 150; // milliseconds

  // ============================================================================
  // DOM UTILITIES
  // ============================================================================

  const byId = (id) => document.getElementById(id);

  /**
   * Creates a debounced version of a function
   * @param {Function} fn - Function to debounce
   * @param {number} delay - Delay in milliseconds
   * @returns {Function} Debounced function
   */
  function debounce(fn, delay) {
    let timeoutId;
    return function (...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn.apply(this, args), delay);
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

  /**
   * Shows an inline error message for a specific form
   * @param {string} formId - The form ID (e.g., 'form1')
   * @param {string} message - The error message to display
   */
  function showInlineError(formId, message) {
    const form = byId(formId);
    if (!form) return;

    // Find or create error container
    let errorContainer = form.querySelector('.inline-error');
    if (!errorContainer) {
      errorContainer = document.createElement('div');
      errorContainer.className = 'inline-error';
      // Insert before the action buttons
      const actionsDiv = form.querySelector('.flex.flex-col.gap-3');
      if (actionsDiv) {
        form.insertBefore(errorContainer, actionsDiv);
      } else {
        form.appendChild(errorContainer);
      }
    }

    // Set error message and show
    errorContainer.textContent = message;
    errorContainer.classList.add('visible');

    // Auto-hide after 5 seconds
    setTimeout(() => {
      hideInlineError(formId);
    }, 5000);
  }

  /**
   * Hides the inline error message for a specific form
   * @param {string} formId - The form ID
   */
  function hideInlineError(formId) {
    const form = byId(formId);
    if (!form) return;
    const errorContainer = form.querySelector('.inline-error');
    if (errorContainer) {
      errorContainer.classList.remove('visible');
    }
  }

  /**
   * Clears output fields by setting their values to empty strings
   * @param {string[]} outputIds - Array of output element IDs
   */
  function clearOutputs(outputIds) {
    outputIds.forEach((id) => {
      const el = byId(id);
      if (el) el.value = '';
    });
  }

  /**
   * Sets output field values from a results object
   * @param {Object} outputMap - Map of element ID to {value, precision} or just value
   */
  function setOutputs(outputMap) {
    Object.entries(outputMap).forEach(([id, config]) => {
      const el = byId(id);
      if (el) {
        if (typeof config === 'object' && config.precision !== undefined) {
          el.value = config.value.toFixed(config.precision);
        } else {
          el.value = config.toFixed(MASS_PRECISION);
        }
      }
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
    hideInlineError(formId);
  }

  // ============================================================================
  // GENERIC CALCULATOR MODE INITIALIZATION
  // ============================================================================

  /**
   * Initializes a calculator mode with event handlers
   * @param {Object} config - Configuration object
   * @param {number} config.modeNumber - The mode number (1-5)
   * @param {string[]} config.inputIds - Array of input element IDs
   * @param {string[]} config.outputIds - Array of output element IDs
   * @param {Function} config.calculate - Function that performs the calculation and returns output map
   */
  function initCalculatorMode({ modeNumber, inputIds, outputIds, calculate }) {
    const formId = `form${modeNumber}`;
    const calcBtnId = `calc${modeNumber}`;
    const clearBtnId = `clear${modeNumber}`;

    // Real-time calculation (silently clears on error)
    const performCalculation = () => {
      hideInlineError(formId);
      try {
        const outputMap = calculate();
        setOutputs(outputMap);
        triggerShimmer(outputIds);
      } catch (err) {
        clearOutputs(outputIds);
      }
    };

    // Debounced version for real-time input
    const debouncedCalculation = debounce(performCalculation, DEBOUNCE_DELAY);

    // Calculation with inline error display (for button click / enter key)
    const performCalculationWithError = () => {
      hideInlineError(formId);
      try {
        const outputMap = calculate();
        setOutputs(outputMap);
        triggerShimmer(outputIds);
      } catch (err) {
        showInlineError(formId, err.message);
      }
    };

    // Event listeners
    byId(calcBtnId).addEventListener('click', performCalculationWithError);

    byId(clearBtnId).addEventListener('click', () => {
      triggerClearShimmer(inputIds);
      triggerClearButtonAnimation(clearBtnId);
      resetForm(formId);
    });

    // Real-time calculation on input (debounced)
    inputIds.forEach((id) => {
      byId(id).addEventListener('input', debouncedCalculation);
    });

    // Enter key support
    byId(formId).addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        performCalculationWithError();
      }
    });
  }

  // ============================================================================
  // CALCULATOR MODE CONFIGURATIONS
  // ============================================================================

  function initMode1() {
    initCalculatorMode({
      modeNumber: 1,
      inputIds: ['xp1', 'xw1', 'xf1'],
      outputIds: ['feed1', 'waste1', 'swu1'],
      calculate: () => {
        const xp = parseAssay('xp1');
        const xw = parseAssay('xw1');
        const xf = parseAssay('xf1');
        const res = computeFeedSwuForOneKg(xp, xw, xf);
        return {
          feed1: { value: res.F, precision: MASS_PRECISION },
          waste1: { value: res.W, precision: MASS_PRECISION },
          swu1: { value: res.swu, precision: SWU_PRECISION },
        };
      },
    });
  }

  function initMode2() {
    initCalculatorMode({
      modeNumber: 2,
      inputIds: ['p2', 'xp2', 'xw2', 'xf2'],
      outputIds: ['feed2', 'waste2', 'swu2'],
      calculate: () => {
        const P = parseMass('p2');
        const xp = parseAssay('xp2');
        const xw = parseAssay('xw2');
        const xf = parseAssay('xf2');
        const res = computeFeedSwu(xp, xw, xf, P);
        return {
          feed2: { value: res.F, precision: MASS_PRECISION },
          waste2: { value: res.W, precision: MASS_PRECISION },
          swu2: { value: res.swu, precision: SWU_PRECISION },
        };
      },
    });
  }

  function initMode3() {
    initCalculatorMode({
      modeNumber: 3,
      inputIds: ['F3', 'xp3', 'xw3', 'xf3'],
      outputIds: ['P3', 'swu3'],
      calculate: () => {
        const F = parseMass('F3');
        const xp = parseAssay('xp3');
        const xw = parseAssay('xw3');
        const xf = parseAssay('xf3');
        const res = computeEupSwu(xp, xw, xf, F);
        return {
          P3: { value: res.P, precision: MASS_PRECISION },
          swu3: { value: res.swu, precision: SWU_PRECISION },
        };
      },
    });
  }

  function initMode4() {
    initCalculatorMode({
      modeNumber: 4,
      inputIds: ['S4', 'xp4', 'xw4', 'xf4'],
      outputIds: ['P4', 'feed4'],
      calculate: () => {
        const S = parsePositiveNumber('S4');
        const xp = parseAssay('xp4');
        const xw = parseAssay('xw4');
        const xf = parseAssay('xf4');
        const res = computeFeedEupFromSwu(xp, xw, xf, S);
        return {
          P4: { value: res.P, precision: MASS_PRECISION },
          feed4: { value: res.F, precision: MASS_PRECISION },
        };
      },
    });
  }

  function initMode5() {
    const COST_PRECISION = 2;
    initCalculatorMode({
      modeNumber: 5,
      inputIds: ['cf5', 'cs5', 'xp5', 'xf5'],
      outputIds: ['xw5', 'feedPerP5', 'swuPerP5', 'costPerP5'],
      calculate: () => {
        const cf = parsePositiveNumber('cf5');
        const cs = parsePositiveNumber('cs5');
        const xp = parseAssay('xp5');
        const xf = parseAssay('xf5');
        const res = findOptimumTails(xp, xf, cf, cs);
        return {
          xw5: { value: res.xw * 100, precision: PERCENT_PRECISION },
          feedPerP5: { value: res.F_per_P, precision: MASS_PRECISION },
          swuPerP5: { value: res.swu_per_P, precision: SWU_PRECISION },
          costPerP5: { value: res.cost_per_P, precision: COST_PRECISION },
        };
      },
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

  // Start initialization when DOM is ready (browser environment only)
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setupHandlers);
    } else {
      // Use setTimeout to defer execution, ensuring DOM is ready after SPA navigation
      setTimeout(setupHandlers, 0);
    }
  }

  // ============================================================================
  // EXPORTS FOR TESTING
  // ============================================================================

  // Export functions for unit testing (only in Node.js/test environment)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
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
      BINARY_SEARCH_ITERATIONS,
      GOLDEN_SECTION_ITERATIONS,
    };
  }
})();
