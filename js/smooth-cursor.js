/**
 * Smooth Cursor - Vanilla JS port of Magic UI's SmoothCursor component
 * Uses spring physics for smooth, natural cursor following with rotation.
 * Only activates on devices with a fine pointer (mouse/trackpad).
 */
(function () {
  // Skip on touch-only devices
  if (!window.matchMedia('(pointer: fine)').matches) return;

  // --- Spring simulation ---
  function createSpring(config) {
    const { damping, stiffness, mass, restDelta } = config;
    let position = 0;
    let target = 0;
    let velocity = 0;

    return {
      set(t) { target = t; },
      get() { return position; },
      setPosition(p) { position = p; target = p; velocity = 0; },
      step(dt) {
        // Clamp dt to avoid instability on tab-switch
        const t = Math.min(dt, 0.064);
        const displacement = position - target;
        const springForce = -stiffness * displacement;
        const dampingForce = -damping * velocity;
        const acceleration = (springForce + dampingForce) / mass;
        velocity += acceleration * t;
        position += velocity * t;
        return Math.abs(position - target) < restDelta && Math.abs(velocity) < restDelta;
      }
    };
  }

  // Spring configs (matching Magic UI defaults)
  const posConfig = { damping: 55, stiffness: 600, mass: 1, restDelta: 0.001 };
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

  // Hide the native cursor globally using inheritance (avoids universal selector style recalc)
  const cursorStyle = document.createElement('style');
  cursorStyle.textContent = `
    html { cursor: none !important; }
    *, *::before, *::after { cursor: none !important; }
    #smooth-cursor {
      position: fixed;
      top: 0; left: 0;
      z-index: 999999;
      pointer-events: none;
      will-change: transform;
      transform-origin: 25px 5px;
      transform: translate(-25px, -5px) scale(0.5);
      transition: filter 0.2s ease;
    }
    #smooth-cursor.cursor-glow {
      filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.9)) drop-shadow(0 0 20px rgba(150, 180, 255, 0.6));
    }
  `;
  document.head.appendChild(cursorStyle);

  // --- Animation loop ---
  function tick() {
    const now = performance.now();
    const dt = (now - (tick._last || now)) / 1000;
    tick._last = now;

    const doneX = springX.step(dt);
    const doneY = springY.step(dt);
    springRot.step(dt);
    springScale.step(dt);

    const x = springX.get();
    const y = springY.get();
    const rot = springRot.get();
    const s = springScale.get();

    el.style.transform =
      `translate3d(${x}px, ${y}px, 0) translate(-25px, -5px) rotate(${rot}deg) scale(${s * 0.5})`;

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

  // --- Mouse handler (RAF-throttled) ---
  let rafId = 0;
  function onMouseMove(e) {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      const cx = e.clientX;
      const cy = e.clientY;
      const now = Date.now();
      const dt = now - lastTime;

      if (!initialized) {
        // First move - jump immediately, no spring lag
        springX.setPosition(cx);
        springY.setPosition(cy);
        initialized = true;
        el.style.opacity = '1';
      }

      if (dt > 0) {
        velX = (cx - lastMouseX) / dt;
        velY = (cy - lastMouseY) / dt;
      }
      lastTime = now;
      lastMouseX = cx;
      lastMouseY = cy;

      springX.set(cx);
      springY.set(cy);

      const speed = Math.sqrt(velX * velX + velY * velY);
      if (speed > 0.1) {
        const angle = Math.atan2(velY, velX) * (180 / Math.PI) + 90;
        let diff = angle - previousAngle;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;
        accumulatedRotation += diff;
        springRot.set(accumulatedRotation);
        previousAngle = angle;

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

  function updateGlow(e) {
    const target = e.target.closest(clickableSelector);
    if (target && target !== currentHovered) {
      currentHovered = target;
      el.classList.add('cursor-glow');
    } else if (!target && currentHovered) {
      currentHovered = null;
      el.classList.remove('cursor-glow');
    }
  }

  document.addEventListener('mouseover', updateGlow);
  document.addEventListener('mouseout', (e) => {
    if (!e.relatedTarget || !e.relatedTarget.closest(clickableSelector)) {
      currentHovered = null;
      el.classList.remove('cursor-glow');
    }
  });

  // Hide cursor until first move
  el.style.opacity = '0';

  window.addEventListener('mousemove', onMouseMove);

  // Hide when mouse leaves viewport
  document.addEventListener('mouseleave', () => {
    el.style.opacity = '0';
  });
  document.addEventListener('mouseenter', (e) => {
    if (initialized) {
      springX.setPosition(e.clientX);
      springY.setPosition(e.clientY);
      el.style.transform =
        `translate3d(${e.clientX}px, ${e.clientY}px, 0) translate(-25px, -5px) rotate(${springRot.get()}deg) scale(${springScale.get() * 0.5})`;
    }
    el.style.opacity = '1';
  });
})();
