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
  const MASS_PRECISION = 3;
  const SWU_PRECISION = 3;
  const PERCENT_PRECISION = 3;

  /**
   * Format a number to max precision decimal places, removing trailing zeros
   * @param {number} value - The number to format
   * @param {number} precision - Maximum decimal places
   * @returns {string} Formatted number string
   */
  function formatNumber(value, precision) {
    return parseFloat(value.toFixed(precision)).toString();
  }

  // ============================================================================
  // UNIT CONVERSION CONSTANTS
  // ============================================================================

  // Mass conversion factors (to kg)
  const MASS_UNITS = {
    'kg': { factor: 1, label: 'kg' },
    'g': { factor: 0.001, label: 'g' },
    'lb': { factor: 0.453592, label: 'lb' },
    't': { factor: 1000, label: 't' },
    'st': { factor: 907.185, label: 'short ton' }
  };

  // Assay conversion factors (to fraction 0-1)
  const ASSAY_UNITS = {
    'percent': { factor: 0.01, label: '% U-235' },
    'ppm': { factor: 0.000001, label: 'ppm U-235' },
    'fraction': { factor: 1, label: 'wt fraction' }
  };

  // SWU conversion factors (to SWU)
  const SWU_UNITS = {
    'swu': { factor: 1, label: 'SWU' },
    'kswu': { factor: 1000, label: 'kSWU' },
    'mswu': { factor: 1000000, label: 'MSWU' }
  };

  // ============================================================================
  // UNIT CONVERSION FUNCTIONS
  // ============================================================================

  /**
   * Convert a value from one unit to the base unit (kg for mass, fraction for assay, SWU for work)
   */
  function toBaseUnit(value, unitType, unit) {
    const units = unitType === 'mass' ? MASS_UNITS : unitType === 'assay' ? ASSAY_UNITS : SWU_UNITS;
    return value * units[unit].factor;
  }

  /**
   * Convert a value from base unit to the selected display unit
   */
  function fromBaseUnit(value, unitType, unit) {
    const units = unitType === 'mass' ? MASS_UNITS : unitType === 'assay' ? ASSAY_UNITS : SWU_UNITS;
    return value / units[unit].factor;
  }

  /**
   * Get the selected unit from a select element
   */
  function getSelectedUnit(selectId) {
    const select = byId(selectId);
    return select ? select.value : null;
  }

  // ============================================================================
  // DOM UTILITIES
  // ============================================================================

  const byId = (id) => document.getElementById(id);

  // ============================================================================
  // INPUT PARSING
  // ============================================================================

  function parseAssay(id, unitSelectId) {
    const raw = byId(id).value.trim();
    const label = byId(id).closest('div')?.querySelector('label')?.textContent || 'Assay';
    const value = parseFloat(raw);
    if (!isFinite(value)) {
      throw new Error(`${label} must be a valid number. Please enter a numeric value (e.g., 5 or 0.7).`);
    }

    // Get the selected unit and convert to fraction
    const unit = unitSelectId ? getSelectedUnit(unitSelectId) : 'percent';
    const fraction = toBaseUnit(value, 'assay', unit);

    if (fraction <= 0 || fraction >= 1) {
      const unitLabel = ASSAY_UNITS[unit].label;
      throw new Error(`${label} must be between 0 and 100% (exclusive). The value ${value} ${unitLabel} is outside the valid range.`);
    }
    return fraction;
  }

  function parseMass(id, unitSelectId) {
    const raw = byId(id).value.trim();
    const label = byId(id).closest('div')?.querySelector('label')?.textContent || 'Mass';
    const value = parseFloat(raw);
    if (!isFinite(value)) {
      throw new Error(`${label} must be a valid number. Please enter a numeric value greater than zero.`);
    }
    if (value <= 0) {
      throw new Error(`${label} must be a positive number. You entered ${value}, but the value must be greater than zero.`);
    }

    // Get the selected unit and convert to kg
    const unit = unitSelectId ? getSelectedUnit(unitSelectId) : 'kg';
    return toBaseUnit(value, 'mass', unit);
  }

  function parseSwu(id, unitSelectId) {
    const raw = byId(id).value.trim();
    const label = byId(id).closest('div')?.querySelector('label')?.textContent || 'SWU';
    const value = parseFloat(raw);
    if (!isFinite(value)) {
      throw new Error(`${label} must be a valid number. Please enter a numeric value greater than zero.`);
    }
    if (value <= 0) {
      throw new Error(`${label} must be a positive number. You entered ${value}, but the value must be greater than zero.`);
    }

    // Get the selected unit and convert to SWU
    const unit = unitSelectId ? getSelectedUnit(unitSelectId) : 'swu';
    return toBaseUnit(value, 'swu', unit);
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

  /**
   * Format and display a mass value in the selected output unit
   */
  function displayMass(elementId, valueInKg, unitSelectId) {
    const unit = unitSelectId ? getSelectedUnit(unitSelectId) : 'kg';
    const converted = fromBaseUnit(valueInKg, 'mass', unit);
    byId(elementId).value = formatNumber(converted, MASS_PRECISION);
  }

  /**
   * Format and display an assay value in the selected output unit
   */
  function displayAssay(elementId, valueAsFraction, unitSelectId) {
    const unit = unitSelectId ? getSelectedUnit(unitSelectId) : 'percent';
    const converted = fromBaseUnit(valueAsFraction, 'assay', unit);
    byId(elementId).value = formatNumber(converted, PERCENT_PRECISION);
  }

  /**
   * Format and display a SWU value in the selected output unit
   */
  function displaySwu(elementId, valueInSwu, unitSelectId) {
    const unit = unitSelectId ? getSelectedUnit(unitSelectId) : 'swu';
    const converted = fromBaseUnit(valueInSwu, 'swu', unit);
    byId(elementId).value = formatNumber(converted, SWU_PRECISION);
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
   * @param {string} [announcement] - Optional announcement for screen readers
   */
  function triggerShimmer(elementIds, announcement) {
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
    // Announce results to screen readers
    if (announcement) {
      announceToScreenReader(announcement);
    }
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
   * Announces a message to screen readers via ARIA live region
   * @param {string} message - The message to announce
   */
  function announceToScreenReader(message) {
    const announcer = byId('sr-announcements');
    if (announcer) {
      // Clear and set with a slight delay to ensure announcement
      announcer.textContent = '';
      setTimeout(() => {
        announcer.textContent = message;
      }, 100);
    }
  }

  function showError(message) {
    // Announce error to screen readers
    announceToScreenReader('Error: ' + message);
    Swal.fire({
      icon: 'error',
      title: 'Invalid Input',
      text: message,
      confirmButtonText: 'Got it',
      customClass: {
        confirmButton: 'swal-btn-gradient-animate',
      },
      buttonsStyling: false,
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
    const mode1Inputs = ['xp1', 'xw1', 'xf1'];
    const mode1Outputs = ['feed1', 'waste1', 'swu1'];
    const mode1UnitSelects = ['xp1-unit', 'xw1-unit', 'xf1-unit', 'feed1-unit', 'waste1-unit', 'swu1-unit'];

    const calculate1 = () => {
      try {
        const xp = parseAssay('xp1', 'xp1-unit');
        const xw = parseAssay('xw1', 'xw1-unit');
        const xf = parseAssay('xf1', 'xf1-unit');
        console.log('Mode 1 inputs:', { xp, xw, xf });
        const res = computeFeedSwuForOneKg(xp, xw, xf);
        console.log('Mode 1 results:', res);
        displayMass('feed1', res.F, 'feed1-unit');
        displayMass('waste1', res.W, 'waste1-unit');
        displaySwu('swu1', res.swu, 'swu1-unit');
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
        const xp = parseAssay('xp1', 'xp1-unit');
        const xw = parseAssay('xw1', 'xw1-unit');
        const xf = parseAssay('xf1', 'xf1-unit');
        const res = computeFeedSwuForOneKg(xp, xw, xf);
        displayMass('feed1', res.F, 'feed1-unit');
        displayMass('waste1', res.W, 'waste1-unit');
        displaySwu('swu1', res.swu, 'swu1-unit');
        triggerShimmer(mode1Outputs, `Calculation complete. Feed: ${byId('feed1').value} ${MASS_UNITS[getSelectedUnit('feed1-unit')].label}, Waste: ${byId('waste1').value} ${MASS_UNITS[getSelectedUnit('waste1-unit')].label}, SWU: ${byId('swu1').value} ${SWU_UNITS[getSelectedUnit('swu1-unit')].label}`);
      } catch (err) {
        showError(err.message);
      }
    };

    byId('calc1').addEventListener('click', calculateWithError1);
    byId('clear1').addEventListener('click', () => {
      triggerClearShimmer([...mode1Inputs, ...mode1Outputs]);
      triggerClearButtonAnimation('clear1');
      resetForm('form1');
    });

    // Real-time calculation on input
    ['xp1', 'xw1', 'xf1'].forEach((id) => {
      byId(id).addEventListener('input', calculate1);
    });

    // Recalculate when unit selects change
    mode1UnitSelects.forEach((id) => {
      byId(id).addEventListener('change', calculate1);
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
    const mode2Inputs = ['p2', 'xp2', 'xw2', 'xf2'];
    const mode2Outputs = ['feed2', 'waste2', 'swu2'];
    const mode2UnitSelects = ['p2-unit', 'xp2-unit', 'xw2-unit', 'xf2-unit', 'feed2-unit', 'waste2-unit', 'swu2-unit'];

    const calculate2 = () => {
      try {
        const P = parseMass('p2', 'p2-unit');
        const xp = parseAssay('xp2', 'xp2-unit');
        const xw = parseAssay('xw2', 'xw2-unit');
        const xf = parseAssay('xf2', 'xf2-unit');
        const res = computeFeedSwu(xp, xw, xf, P);
        displayMass('feed2', res.F, 'feed2-unit');
        displayMass('waste2', res.W, 'waste2-unit');
        displaySwu('swu2', res.swu, 'swu2-unit');
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
        const P = parseMass('p2', 'p2-unit');
        const xp = parseAssay('xp2', 'xp2-unit');
        const xw = parseAssay('xw2', 'xw2-unit');
        const xf = parseAssay('xf2', 'xf2-unit');
        const res = computeFeedSwu(xp, xw, xf, P);
        displayMass('feed2', res.F, 'feed2-unit');
        displayMass('waste2', res.W, 'waste2-unit');
        displaySwu('swu2', res.swu, 'swu2-unit');
        triggerShimmer(mode2Outputs, `Calculation complete. Feed: ${byId('feed2').value} ${MASS_UNITS[getSelectedUnit('feed2-unit')].label}, Waste: ${byId('waste2').value} ${MASS_UNITS[getSelectedUnit('waste2-unit')].label}, SWU: ${byId('swu2').value} ${SWU_UNITS[getSelectedUnit('swu2-unit')].label}`);
      } catch (err) {
        showError(err.message);
      }
    };

    byId('calc2').addEventListener('click', calculateWithError2);
    byId('clear2').addEventListener('click', () => {
      triggerClearShimmer([...mode2Inputs, ...mode2Outputs]);
      triggerClearButtonAnimation('clear2');
      resetForm('form2');
    });

    // Real-time calculation on input
    ['p2', 'xp2', 'xw2', 'xf2'].forEach((id) => {
      byId(id).addEventListener('input', calculate2);
    });

    // Recalculate when unit selects change
    mode2UnitSelects.forEach((id) => {
      byId(id).addEventListener('change', calculate2);
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
    const mode3Inputs = ['F3', 'xp3', 'xw3', 'xf3'];
    const mode3Outputs = ['P3', 'swu3'];
    const mode3UnitSelects = ['F3-unit', 'xp3-unit', 'xw3-unit', 'xf3-unit', 'P3-unit', 'swu3-unit'];

    const calculate3 = () => {
      try {
        const F = parseMass('F3', 'F3-unit');
        const xp = parseAssay('xp3', 'xp3-unit');
        const xw = parseAssay('xw3', 'xw3-unit');
        const xf = parseAssay('xf3', 'xf3-unit');
        const res = computeEupSwu(xp, xw, xf, F);
        displayMass('P3', res.P, 'P3-unit');
        displaySwu('swu3', res.swu, 'swu3-unit');
        triggerShimmer(mode3Outputs);
      } catch (err) {
        // Clear outputs on invalid input (for real-time calc)
        byId('P3').value = '';
        byId('swu3').value = '';
      }
    };

    const calculateWithError3 = () => {
      try {
        const F = parseMass('F3', 'F3-unit');
        const xp = parseAssay('xp3', 'xp3-unit');
        const xw = parseAssay('xw3', 'xw3-unit');
        const xf = parseAssay('xf3', 'xf3-unit');
        const res = computeEupSwu(xp, xw, xf, F);
        displayMass('P3', res.P, 'P3-unit');
        displaySwu('swu3', res.swu, 'swu3-unit');
        triggerShimmer(mode3Outputs, `Calculation complete. EUP: ${byId('P3').value} ${MASS_UNITS[getSelectedUnit('P3-unit')].label}, SWU: ${byId('swu3').value} ${SWU_UNITS[getSelectedUnit('swu3-unit')].label}`);
      } catch (err) {
        showError(err.message);
      }
    };

    byId('calc3').addEventListener('click', calculateWithError3);
    byId('clear3').addEventListener('click', () => {
      triggerClearShimmer([...mode3Inputs, ...mode3Outputs]);
      triggerClearButtonAnimation('clear3');
      resetForm('form3');
    });

    // Real-time calculation on input
    ['F3', 'xp3', 'xw3', 'xf3'].forEach((id) => {
      byId(id).addEventListener('input', calculate3);
    });

    // Recalculate when unit selects change
    mode3UnitSelects.forEach((id) => {
      byId(id).addEventListener('change', calculate3);
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
    const mode4Inputs = ['S4', 'xp4', 'xw4', 'xf4'];
    const mode4Outputs = ['P4', 'feed4'];
    const mode4UnitSelects = ['S4-unit', 'xp4-unit', 'xw4-unit', 'xf4-unit', 'P4-unit', 'feed4-unit'];

    const calculate4 = () => {
      try {
        const S = parseSwu('S4', 'S4-unit');
        const xp = parseAssay('xp4', 'xp4-unit');
        const xw = parseAssay('xw4', 'xw4-unit');
        const xf = parseAssay('xf4', 'xf4-unit');
        const res = computeFeedEupFromSwu(xp, xw, xf, S);
        displayMass('P4', res.P, 'P4-unit');
        displayMass('feed4', res.F, 'feed4-unit');
        triggerShimmer(mode4Outputs);
      } catch (err) {
        // Clear outputs on invalid input (for real-time calc)
        byId('P4').value = '';
        byId('feed4').value = '';
      }
    };

    const calculateWithError4 = () => {
      try {
        const S = parseSwu('S4', 'S4-unit');
        const xp = parseAssay('xp4', 'xp4-unit');
        const xw = parseAssay('xw4', 'xw4-unit');
        const xf = parseAssay('xf4', 'xf4-unit');
        const res = computeFeedEupFromSwu(xp, xw, xf, S);
        displayMass('P4', res.P, 'P4-unit');
        displayMass('feed4', res.F, 'feed4-unit');
        triggerShimmer(mode4Outputs, `Calculation complete. EUP: ${byId('P4').value} ${MASS_UNITS[getSelectedUnit('P4-unit')].label}, Feed: ${byId('feed4').value} ${MASS_UNITS[getSelectedUnit('feed4-unit')].label}`);
      } catch (err) {
        showError(err.message);
      }
    };

    byId('calc4').addEventListener('click', calculateWithError4);
    byId('clear4').addEventListener('click', () => {
      triggerClearShimmer([...mode4Inputs, ...mode4Outputs]);
      triggerClearButtonAnimation('clear4');
      resetForm('form4');
    });

    // Real-time calculation on input
    ['S4', 'xp4', 'xw4', 'xf4'].forEach((id) => {
      byId(id).addEventListener('input', calculate4);
    });

    // Recalculate when unit selects change
    mode4UnitSelects.forEach((id) => {
      byId(id).addEventListener('change', calculate4);
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
    const COST_PRECISION = 3;
    const mode5Inputs = ['cf5', 'cs5', 'xp5', 'xf5'];
    const mode5Outputs = ['xw5', 'feedPerP5', 'swuPerP5', 'costPerP5'];
    const mode5UnitSelects = ['xp5-unit', 'xf5-unit', 'xw5-unit', 'feedPerP5-unit', 'swuPerP5-unit'];

    const calculate5 = () => {
      try {
        const cf = parsePositiveNumber('cf5');
        const cs = parsePositiveNumber('cs5');
        const xp = parseAssay('xp5', 'xp5-unit');
        const xf = parseAssay('xf5', 'xf5-unit');
        console.log('Mode 5 inputs:', { cf, cs, xp, xf });
        const res = findOptimumTails(xp, xf, cf, cs);
        console.log('Mode 5 results:', res);
        displayAssay('xw5', res.xw, 'xw5-unit');
        displayMass('feedPerP5', res.F_per_P, 'feedPerP5-unit');
        displaySwu('swuPerP5', res.swu_per_P, 'swuPerP5-unit');
        byId('costPerP5').value = formatNumber(res.cost_per_P, COST_PRECISION);
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
        const xp = parseAssay('xp5', 'xp5-unit');
        const xf = parseAssay('xf5', 'xf5-unit');
        const res = findOptimumTails(xp, xf, cf, cs);
        displayAssay('xw5', res.xw, 'xw5-unit');
        displayMass('feedPerP5', res.F_per_P, 'feedPerP5-unit');
        displaySwu('swuPerP5', res.swu_per_P, 'swuPerP5-unit');
        byId('costPerP5').value = formatNumber(res.cost_per_P, COST_PRECISION);
        triggerShimmer(mode5Outputs, `Calculation complete. Optimum tails assay: ${byId('xw5').value} ${ASSAY_UNITS[getSelectedUnit('xw5-unit')].label}, Feed: ${byId('feedPerP5').value} ${MASS_UNITS[getSelectedUnit('feedPerP5-unit')].label}, SWU: ${byId('swuPerP5').value} ${SWU_UNITS[getSelectedUnit('swuPerP5-unit')].label}, Cost: ${formatNumber(res.cost_per_P, COST_PRECISION)}`);
      } catch (err) {
        showError(err.message);
      }
    };

    byId('calc5').addEventListener('click', calculateWithError5);
    byId('clear5').addEventListener('click', () => {
      triggerClearShimmer([...mode5Inputs, ...mode5Outputs]);
      triggerClearButtonAnimation('clear5');
      resetForm('form5');
    });

    // Real-time calculation on input
    ['cf5', 'cs5', 'xp5', 'xf5'].forEach((id) => {
      byId(id).addEventListener('input', calculate5);
    });

    // Recalculate when unit selects change
    mode5UnitSelects.forEach((id) => {
      byId(id).addEventListener('change', calculate5);
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
