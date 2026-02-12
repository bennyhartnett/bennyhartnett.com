/**
 * Wave Background Animation
 * Interactive 3D wave plane using Three.js with Simplex noise-based deformation
 * and color cycling animation.
 */

import * as THREE from "three";
import { SimplexNoise } from "three/addons/math/SimplexNoise.js";

export function initWaveBackground() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('black');

  const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight);
  camera.position.set(4, 2, 8);
  camera.lookAt(scene.position);

  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'low-power' });
  // Cap pixel ratio at 2 to avoid excessive GPU work on high-DPI screens
  const isMobile = window.innerWidth < 768;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.domElement.id = 'wave-canvas';
  document.body.appendChild(renderer.domElement);

  // Debounce resize handler to avoid excessive recalculation
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }, 150);
  });

  const planeWidth = 12;
  const planeHeight = 8;
  // Reduce geometry segments on mobile for better performance
  const segX = isMobile ? 50 : 150;
  const segY = isMobile ? 30 : 100;
  // Throttle frame rate on mobile to save battery (target ~30fps)
  const frameBudget = isMobile ? 33 : 0;
  let lastFrameTime = 0;
  const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight, segX, segY);
  const pos = geometry.getAttribute('position');
  const basePositions = new Float32Array(pos.array);
  const simplex = new SimplexNoise();

  const material = new THREE.PointsMaterial({ size: 0.02, color: 'blue' });
  const waves = new THREE.Points(geometry, material);
  waves.rotation.x = -Math.PI / 2;
  scene.add(waves);
  document.documentElement.style.setProperty(
    '--wave-color', '#' + material.color.getHexString()
  );

  const colorBlue = new THREE.Color('blue');
  const colorPurple = new THREE.Color('purple');
  const colorGold = new THREE.Color('#FFD700');

  let mouseX = 0;
  let mouseY = 0;
  let lastCssColor = '';

  window.addEventListener('mousemove', (event) => {
    mouseX = (event.clientX / window.innerWidth - 0.5) * 2;
    mouseY = (event.clientY / window.innerHeight - 0.5) * 2;
  });

  // Pause animation when tab is hidden to save CPU/GPU
  let isVisible = true;
  document.addEventListener('visibilitychange', () => {
    isVisible = !document.hidden;
    if (isVisible) {
      renderer.setAnimationLoop(animationLoop);
    } else {
      renderer.setAnimationLoop(null);
    }
  });

  function animationLoop(time) {
    // Skip frame if under budget on mobile to save battery
    if (frameBudget && time - lastFrameTime < frameBudget) return;
    lastFrameTime = time;

    const impactX = mouseX * (planeWidth / 2);
    const impactY = mouseY * (planeHeight / 2);

    for (let i = 0; i < pos.count; i++) {
      const baseX = basePositions[i * 3];
      const baseY = basePositions[i * 3 + 1];
      const edgeOffsetX = 0.1 * simplex.noise3d(baseX, baseY, time / 5000);
      const edgeOffsetY = 0.1 * simplex.noise3d(baseX, baseY, time / 6000);
      const x = baseX + edgeOffsetX;
      const y = baseY + edgeOffsetY;

      const nx = x / 2 + mouseX * 2;
      const ny = y / 2 + mouseY * 2;
      const nz = time / 4000;

      const dx = x - impactX;
      const dy = y - impactY;
      const dist2 = dx * dx + dy * dy;
      const radiationImpact = 2.0 / (dist2 + 0.5);

      const noiseVal = simplex.noise3d(nx, ny, nz);
      const z = 0.5 * noiseVal * radiationImpact;

      pos.setX(i, x);
      pos.setY(i, y);
      pos.setZ(i, z);
    }
    pos.needsUpdate = true;

    const cycleDuration = 9000;
    const t = time % cycleDuration;
    const segment = cycleDuration / 3;
    if (t < segment) {
      const lerpT = t / segment;
      material.color.copy(colorBlue).lerp(colorPurple, lerpT);
    } else if (t < 2 * segment) {
      const lerpT = (t - segment) / segment;
      material.color.copy(colorPurple).lerp(colorGold, lerpT);
    } else {
      const lerpT = (t - 2 * segment) / segment;
      material.color.copy(colorGold).lerp(colorBlue, lerpT);
    }
    // Only update CSS variable when color hex actually changes (avoids per-frame style recalc)
    const hexColor = '#' + material.color.getHexString();
    if (hexColor !== lastCssColor) {
      lastCssColor = hexColor;
      document.documentElement.style.setProperty('--wave-color', hexColor);
    }

    waves.rotation.z = mouseX * 0.3;
    camera.position.y = 2 + mouseY * 1;
    camera.lookAt(scene.position);

    renderer.render(scene, camera);
  }

  renderer.setAnimationLoop(animationLoop);
}
