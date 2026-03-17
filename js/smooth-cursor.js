/**
 * Smooth Cursor - Vanilla JS port of Magic UI's SmoothCursor component
 * Uses spring physics for smooth, natural cursor following with rotation.
 * Only activates on devices with a fine pointer (mouse/trackpad).
 */
(function () {
  // Skip on touch-only devices
  if (!window.matchMedia('(pointer: fine)').matches) return;

  const FIXED_STEP = 1 / 120;
  const MAX_SIMULATION_DT = 1 / 20;
  const MAX_SPRING_ABS_VALUE = 1000000;
  const BASE_SCALE = 0.5;
  const CURSOR_OFFSET_X = 25;
  const CURSOR_OFFSET_Y = 5;
  const genericCursorValues = new Set(['', 'auto', 'default', 'pointer', 'none']);

  function isSafeSpringValue(value) {
    return Number.isFinite(value) && Math.abs(value) < MAX_SPRING_ABS_VALUE;
  }

  function normalizeAngle(angle) {
    let normalized = (angle + 180) % 360;
    if (normalized < 0) normalized += 360;
    return normalized - 180;
  }

  function buildTransform(x, y, rotation, scale) {
    return `translate3d(${x}px, ${y}px, 0) translate(-${CURSOR_OFFSET_X}px, -${CURSOR_OFFSET_Y}px) rotate(${normalizeAngle(rotation)}deg) scale(${scale * BASE_SCALE})`;
  }

  // --- Spring simulation ---
  function createSpring(config) {
    const { damping, stiffness, mass, restDelta } = config;
    let position = 0;
    let target = 0;
    let velocity = 0;

    function snapToTarget() {
      position = target;
      velocity = 0;
    }

    return {
      set(t) {
        target = isSafeSpringValue(t) ? t : 0;
      },
      get() { return position; },
      setPosition(p) {
        position = isSafeSpringValue(p) ? p : 0;
        target = position;
        velocity = 0;
      },
      step(dt) {
        let remaining = Math.min(Math.max(dt, 0), MAX_SIMULATION_DT);

        while (remaining > 0) {
          const t = Math.min(remaining, FIXED_STEP);
          const displacement = position - target;
          const springForce = -stiffness * displacement;
          const dampingForce = -damping * velocity;
          const acceleration = (springForce + dampingForce) / mass;
          velocity += acceleration * t;
          position += velocity * t;

          if (!isSafeSpringValue(position) || !isSafeSpringValue(velocity) || !isSafeSpringValue(target)) {
            snapToTarget();
            break;
          }

          remaining -= t;
        }

        if (!isSafeSpringValue(position) || !isSafeSpringValue(velocity)) {
          snapToTarget();
        }

        if (Math.abs(position - target) < restDelta && Math.abs(velocity) < restDelta) {
          snapToTarget();
          return true;
        }

        return false;
      }
    };
  }

  // Spring configs (matching Magic UI defaults)
  const posConfig = { damping: 70, stiffness: 900, mass: 1, restDelta: 0.001 };
  const rotConfig = { damping: 60, stiffness: 300, mass: 1, restDelta: 0.001 };
  const scaleConfig = { damping: 35, stiffness: 500, mass: 1, restDelta: 0.001 };

  const springX = createSpring(posConfig);
  const springY = createSpring(posConfig);
  const springRot = createSpring(rotConfig);
  const springScale = createSpring(scaleConfig);
  springScale.setPosition(1);
  springScale.set(1);

  // --- Velocity / rotation tracking ---
  let lastMouseX = 0, lastMouseY = 0;
  let lastTime = Date.now();
  let velX = 0, velY = 0;
  let previousAngle = 0;
  let accumulatedRotation = 0;
  let moveTimeout = null;
  let animating = false;
  let initialized = false;
  let usingNativeCursor = true;
  let currentCursorTarget = null;

  function getElementTarget(target) {
    if (!target) return null;
    return target.nodeType === Node.ELEMENT_NODE ? target : target.parentElement;
  }

  // --- Build cursor DOM ---
  const el = document.createElement('div');
  el.id = 'smooth-cursor';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="50" height="54" viewBox="0 0 50 54" fill="none" style="display:block">
    <g filter="url(#sc_shadow)">
      <path d="M42.6817 41.1495L27.5103 6.79925C26.7269 5.02557 24.2082 5.02558 23.3927 6.79925L7.59814 41.1495C6.75833 42.9759 8.52712 44.8902 10.4125 44.1954L24.3757 39.0496C24.8829 38.8627 25.4385 38.8627 25.9422 39.0496L39.8121 44.1954C41.6849 44.8902 43.4884 42.9759 42.6817 41.1495Z" fill="black"/>
      <path d="M43.7146 40.6933L28.5431 6.34306C27.3556 3.65428 23.5772 3.69516 22.3668 6.32755L6.57226 40.6778C5.3134 43.4156 7.97238 46.298 10.803 45.2549L24.7662 40.109C25.0221 40.0147 25.2999 40.0156 25.5494 40.1082L39.4193 45.254C42.2261 46.2953 44.9254 43.4347 43.7146 40.6933Z" stroke="white" stroke-width="2.258"/>
    </g>
    <defs>
      <filter id="sc_shadow" x="0.6" y="0.95" width="49.06" height="52.43" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
        <feFlood flood-opacity="0" result="bg"/>
        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="ha"/>
        <feOffset dy="2.258"/>
        <feGaussianBlur stdDeviation="2.258"/>
        <feComposite in2="ha" operator="out"/>
        <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.08 0"/>
        <feBlend mode="normal" in2="bg" result="ds"/>
        <feBlend mode="normal" in="SourceGraphic" in2="ds" result="shape"/>
      </filter>
    </defs>
  </svg>`;

  document.documentElement.appendChild(el);

  // Hide the native cursor only while the custom cursor is active.
  const cursorStyle = document.createElement('style');
  cursorStyle.textContent = `
    html.smooth-cursor-active,
    html.smooth-cursor-active *,
    html.smooth-cursor-active *::before,
    html.smooth-cursor-active *::after {
      cursor: none !important;
    }
    #smooth-cursor {
      position: fixed;
      top: 0; left: 0;
      z-index: 999999;
      pointer-events: none;
      will-change: transform;
      transform-origin: ${CURSOR_OFFSET_X}px ${CURSOR_OFFSET_Y}px;
      transform: translate(-${CURSOR_OFFSET_X}px, -${CURSOR_OFFSET_Y}px) scale(${BASE_SCALE});
      transition: filter 0.2s ease, opacity 0.12s ease;
    }
    #smooth-cursor.cursor-glow {
      filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.9)) drop-shadow(0 0 20px rgba(150, 180, 255, 0.6));
    }
  `;
  document.head.appendChild(cursorStyle);

  function setCursorMode(useNative) {
    if (usingNativeCursor === useNative) return;
    usingNativeCursor = useNative;
    document.documentElement.classList.toggle('smooth-cursor-active', !useNative);

    if (useNative) {
      el.style.opacity = '0';
    } else if (initialized) {
      el.style.opacity = '1';
    }
  }

  function getTargetCursor(target) {
    if (!target) return 'default';

    const root = document.documentElement;
    const shouldRestoreHiddenCursor = !usingNativeCursor;
    if (shouldRestoreHiddenCursor) {
      root.classList.remove('smooth-cursor-active');
    }

    const cursor = window.getComputedStyle(target).cursor || 'default';

    if (shouldRestoreHiddenCursor) {
      root.classList.add('smooth-cursor-active');
    }

    return cursor;
  }

  function shouldUseNativeCursor(target) {
    if (!target) return false;
    const cursor = getTargetCursor(target);
    if (cursor.indexOf('url(') !== -1) return true;
    return !genericCursorValues.has(cursor);
  }

  function updateCursorMode(target) {
    const elementTarget = getElementTarget(target);
    if (!elementTarget) return;

    if (elementTarget !== currentCursorTarget || usingNativeCursor) {
      currentCursorTarget = elementTarget;
      setCursorMode(shouldUseNativeCursor(elementTarget));
    }
  }

  // --- Animation loop ---
  function tick() {
    const now = performance.now();
    const dt = (now - (tick._last || now)) / 1000;
    tick._last = now;

    const doneX = springX.step(dt);
    const doneY = springY.step(dt);
    springRot.step(dt);
    springScale.step(dt);

    el.style.transform = buildTransform(springX.get(), springY.get(), springRot.get(), springScale.get());

    if (doneX && doneY) {
      animating = false;
    } else {
      requestAnimationFrame(tick);
    }
  }

  function startAnimation() {
    if (!animating) {
      animating = true;
      tick._last = performance.now();
      requestAnimationFrame(tick);
    }
  }

  // --- Mouse handler (RAF-throttled, always captures latest position) ---
  let pendingFrame = false;
  let latestX = 0;
  let latestY = 0;

  function onMouseMove(e) {
    // Always capture the latest position so we never use stale coordinates
    latestX = e.clientX;
    latestY = e.clientY;

    if (pendingFrame) return;
    pendingFrame = true;
    requestAnimationFrame(() => {
      pendingFrame = false;
      const cx = latestX;
      const cy = latestY;
      const target = document.elementFromPoint(cx, cy) || e.target;
      const now = Date.now();
      const dt = now - lastTime;

      if (!initialized) {
        // First move - jump immediately, no spring lag
        springX.setPosition(cx);
        springY.setPosition(cy);
        initialized = true;
      }

      updateCursorMode(target);

      if (dt > 0) {
        velX = (cx - lastMouseX) / dt;
        velY = (cy - lastMouseY) / dt;
      }
      lastTime = now;
      lastMouseX = cx;
      lastMouseY = cy;

      if (usingNativeCursor) {
        springX.setPosition(cx);
        springY.setPosition(cy);
        el.style.transform = buildTransform(cx, cy, springRot.get(), springScale.get());
        return;
      }

      springX.set(cx);
      springY.set(cy);

      const speed = Math.sqrt(velX * velX + velY * velY);
      if (speed > 0.1) {
        const angle = Math.atan2(velY, velX) * (180 / Math.PI) + 90;
        let diff = angle - previousAngle;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;
        accumulatedRotation = normalizeAngle(accumulatedRotation + diff);
        springRot.set(accumulatedRotation);
        previousAngle = normalizeAngle(angle);

        springScale.set(0.95);
        clearTimeout(moveTimeout);
        moveTimeout = setTimeout(() => {
          springScale.set(1);
        }, 150);
      }

      startAnimation();
    });
  }

  // --- Hover glow for clickable elements ---
  const clickableSelector = 'a, button, [role="button"], input[type="submit"], input[type="button"], summary, label, select, [onclick], [data-clickable]';
  let currentHovered = null;

  function updateGlow(target) {
    const hoveredTarget = target ? target.closest(clickableSelector) : null;
    if (hoveredTarget === currentHovered) return;

    currentHovered = hoveredTarget;
    el.classList.toggle('cursor-glow', Boolean(hoveredTarget));
  }

  document.addEventListener('mouseover', (e) => {
    const target = getElementTarget(e.target);
    updateCursorMode(target);
    updateGlow(target);
  });
  document.addEventListener('mouseout', (e) => {
    const relatedTarget = getElementTarget(e.relatedTarget);
    if (!relatedTarget) {
      currentCursorTarget = null;
      currentHovered = null;
      el.classList.remove('cursor-glow');
      return;
    }

    updateCursorMode(relatedTarget);
    updateGlow(relatedTarget);
  });

  // Hide cursor until first move
  el.style.opacity = '0';

  window.addEventListener('mousemove', onMouseMove);

  // Hide when mouse leaves viewport
  document.addEventListener('mouseleave', () => {
    currentCursorTarget = null;
    currentHovered = null;
    el.classList.remove('cursor-glow');
    setCursorMode(true);
    el.style.opacity = '0';
  });
  document.addEventListener('mouseenter', (e) => {
    const target = document.elementFromPoint(e.clientX, e.clientY) || e.target;
    updateCursorMode(target);
    updateGlow(getElementTarget(target));

    if (initialized) {
      springX.setPosition(e.clientX);
      springY.setPosition(e.clientY);
      el.style.transform = buildTransform(e.clientX, e.clientY, springRot.get(), springScale.get());
    }

    if (!usingNativeCursor && initialized) {
      el.style.opacity = '1';
    }
  });
})();
