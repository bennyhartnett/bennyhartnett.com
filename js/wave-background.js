/**
 * Wave Background Animation
 * Adaptive 3D wave plane that can lower its own quality on constrained devices.
 */

import * as THREE from 'three';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';
import { recordWavePerformance } from './performance-profile.js';

const QUALITY_ORDER = ['low', 'medium', 'high'];

const QUALITY_PRESETS = {
  low: {
    segX: 40,
    segY: 24,
    frameRate: 24,
    pixelRatioCap: 1,
    pointSize: 0.024,
    animateXY: false,
    xyAmplitude: 0,
    zAmplitude: 0.32,
    mouseFactor: 1.1,
    impactScale: 1.4,
    impactOffset: 0.8,
    rotationFactor: 0.18,
    cameraOffset: 0.45
  },
  medium: {
    segX: 64,
    segY: 40,
    frameRate: 36,
    pixelRatioCap: 1.25,
    pointSize: 0.022,
    animateXY: true,
    xyAmplitude: 0.06,
    zAmplitude: 0.4,
    mouseFactor: 1.55,
    impactScale: 1.7,
    impactOffset: 0.65,
    rotationFactor: 0.24,
    cameraOffset: 0.7
  },
  high: {
    segX: 88,
    segY: 56,
    frameRate: 48,
    pixelRatioCap: 1.5,
    pointSize: 0.02,
    animateXY: true,
    xyAmplitude: 0.085,
    zAmplitude: 0.5,
    mouseFactor: 2,
    impactScale: 2,
    impactOffset: 0.5,
    rotationFactor: 0.3,
    cameraOffset: 1
  }
};

function clampQuality(requestedQuality) {
  return requestedQuality === 'off' || QUALITY_ORDER.includes(requestedQuality) ? requestedQuality : 'medium';
}

function getViewportScale() {
  return window.innerWidth < 768 ? 0.72 : 1;
}

export function initWaveBackground(profile = {}) {
  if (document.getElementById('wave-canvas')) {
    return null;
  }

  const requestedQuality = clampQuality(profile.waveQuality);
  if (requestedQuality === 'off') {
    return null;
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight);
  camera.position.set(4, 2, 8);
  camera.lookAt(scene.position);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true,
      powerPreference: profile.tier === 'high' ? 'default' : 'low-power'
    });
  } catch (error) {
    console.warn('Wave background disabled: WebGL initialization failed.', error);
    recordWavePerformance({
      recommendation: 'off',
      disabled: true,
      reason: 'webgl-init'
    });
    return null;
  }

  renderer.domElement.id = 'wave-canvas';
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  document.body.appendChild(renderer.domElement);

  const planeWidth = 12;
  const planeHeight = 8;
  const simplex = new SimplexNoise();
  const material = new THREE.PointsMaterial({ size: 0.02, color: 'blue' });
  const waves = new THREE.Points(undefined, material);
  waves.rotation.x = -Math.PI / 2;
  scene.add(waves);

  const colorBlue = new THREE.Color('blue');
  const colorPurple = new THREE.Color('purple');
  const colorGold = new THREE.Color('#FFD700');

  let qualityIndex = QUALITY_ORDER.indexOf(requestedQuality);
  let geometry = null;
  let positionAttribute = null;
  let positions = null;
  let basePositions = null;
  let mouseX = 0;
  let mouseY = 0;
  let isVisible = !document.hidden;
  let resizeTimer = null;
  let lastCssColor = '';
  let lastRenderAt = 0;
  let sampleFrames = 0;
  let sampleFrameMs = 0;
  let lastPersistAt = 0;
  let degradeCooldownUntil = 0;
  let pointerTracking = false;

  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reducedMotion = Boolean(profile.reducedMotion || motionQuery.matches);

  function getActiveQuality() {
    return QUALITY_ORDER[qualityIndex];
  }

  function getPreset() {
    return QUALITY_PRESETS[getActiveQuality()];
  }

  function persistSample(recommendation, averageFrameMs, frameRate, reason = '', disabled = false) {
    const now = performance.now();
    if (!disabled && reason !== 'degrade' && (now - lastPersistAt) < 8000) {
      return;
    }

    lastPersistAt = now;
    recordWavePerformance({
      recommendation,
      averageFrameMs: Number(averageFrameMs.toFixed(1)),
      frameRate: Math.round(frameRate),
      reason,
      disabled
    });
  }

  function applyRendererQuality() {
    const preset = getPreset();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, preset.pixelRatioCap));
    material.size = preset.pointSize;
  }

  function rebuildGeometry() {
    const preset = getPreset();
    const scale = getViewportScale();
    const segX = Math.max(18, Math.round(preset.segX * scale));
    const segY = Math.max(12, Math.round(preset.segY * scale));

    if (geometry) {
      geometry.dispose();
    }

    geometry = new THREE.PlaneGeometry(planeWidth, planeHeight, segX, segY);
    positionAttribute = geometry.getAttribute('position');
    positions = positionAttribute.array;
    basePositions = new Float32Array(positions);
    waves.geometry = geometry;
    applyRendererQuality();
  }

  function syncWaveColor() {
    const hexColor = `#${material.color.getHexString()}`;
    if (hexColor === lastCssColor) {
      return;
    }

    lastCssColor = hexColor;
    document.documentElement.style.setProperty('--wave-color', hexColor);
  }

  function setWaveReady() {
    if (!document.body.classList.contains('wave-ready')) {
      document.body.classList.add('wave-ready');
    }
  }

  function setPointerTracking(enabled) {
    if (enabled && !pointerTracking) {
      window.addEventListener('pointermove', onPointerMove, { passive: true });
      pointerTracking = true;
      return;
    }

    if (!enabled && pointerTracking) {
      window.removeEventListener('pointermove', onPointerMove);
      pointerTracking = false;
    }
  }

  function cleanupCanvas() {
    renderer.setAnimationLoop(null);
    if (geometry) geometry.dispose();
    material.dispose();
    renderer.dispose();
    renderer.domElement.remove();
    document.body.classList.remove('wave-ready');
  }

  function destroy(reason = 'disabled') {
    clearTimeout(resizeTimer);
    setPointerTracking(false);
    window.removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', onVisibilityChange);

    if (typeof motionQuery.removeEventListener === 'function') {
      motionQuery.removeEventListener('change', onMotionChange);
    }

    cleanupCanvas();
    persistSample('off', sampleFrames ? (sampleFrameMs / sampleFrames) : 0, 0, reason, true);
  }

  function degradeWave(reason, averageFrameMs, frameRate) {
    if (qualityIndex > 0) {
      qualityIndex -= 1;
      degradeCooldownUntil = performance.now() + 5000;
      sampleFrames = 0;
      sampleFrameMs = 0;
      lastRenderAt = 0;
      rebuildGeometry();
      persistSample(getActiveQuality(), averageFrameMs, frameRate, 'degrade');
      return;
    }

    destroy(reason);
  }

  function evaluatePerformance() {
    const preset = getPreset();
    const minimumSampleSize = Math.max(24, preset.frameRate);
    if (sampleFrames < minimumSampleSize) {
      return;
    }

    const averageFrameMs = sampleFrameMs / sampleFrames;
    const observedFrameRate = 1000 / averageFrameMs;
    const targetFrameMs = 1000 / preset.frameRate;

    persistSample(getActiveQuality(), averageFrameMs, observedFrameRate, 'sample');

    if (performance.now() > degradeCooldownUntil && averageFrameMs > targetFrameMs * 1.45) {
      degradeWave('frame-budget', averageFrameMs, observedFrameRate);
      return;
    }

    sampleFrames = 0;
    sampleFrameMs = 0;
  }

  function onPointerMove(event) {
    mouseX = (event.clientX / window.innerWidth - 0.5) * 2;
    mouseY = (event.clientY / window.innerHeight - 0.5) * 2;
  }

  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight, false);
      rebuildGeometry();
      if (reducedMotion) {
        renderFrame(0);
      }
    }, 150);
  }

  function onVisibilityChange() {
    if (reducedMotion) {
      return;
    }

    isVisible = !document.hidden;
    if (isVisible) {
      renderer.setAnimationLoop(animationLoop);
    } else {
      renderer.setAnimationLoop(null);
    }
  }

  function onMotionChange(event) {
    reducedMotion = event.matches;
    lastRenderAt = 0;
    sampleFrames = 0;
    sampleFrameMs = 0;
    setPointerTracking(!reducedMotion);

    if (reducedMotion) {
      renderer.setAnimationLoop(null);
      renderFrame(0);
      return;
    }

    if (isVisible) {
      renderer.setAnimationLoop(animationLoop);
    }
  }

  function renderFrame(time = 0) {
    const preset = getPreset();
    const useMotion = !reducedMotion;
    const impactX = useMotion ? (mouseX * (planeWidth / 2)) : 0;
    const impactY = useMotion ? (mouseY * (planeHeight / 2)) : 0;
    const positionTime = useMotion ? (time * 0.0002) : 0;
    const zTime = useMotion ? (time * 0.00024) : 0;
    const mouseOffsetX = useMotion ? (mouseX * preset.mouseFactor) : 0;
    const mouseOffsetY = useMotion ? (mouseY * preset.mouseFactor) : 0;

    for (let i = 0; i < positionAttribute.count; i += 1) {
      const offset = i * 3;
      const baseX = basePositions[offset];
      const baseY = basePositions[offset + 1];

      let x = baseX;
      let y = baseY;

      if (preset.animateXY && useMotion) {
        x += preset.xyAmplitude * simplex.noise3d(baseX * 0.6, baseY * 0.6, positionTime);
        y += preset.xyAmplitude * simplex.noise3d(baseX * 0.6, baseY * 0.6, zTime);
      }

      const dx = x - impactX;
      const dy = y - impactY;
      const dist2 = dx * dx + dy * dy;
      const noiseVal = simplex.noise3d((x / 2) + mouseOffsetX, (y / 2) + mouseOffsetY, zTime);
      const z = preset.zAmplitude * noiseVal * (preset.impactScale / (dist2 + preset.impactOffset));

      positions[offset] = x;
      positions[offset + 1] = y;
      positions[offset + 2] = z;
    }

    positionAttribute.needsUpdate = true;

    if (useMotion) {
      const cycleDuration = 9000;
      const t = time % cycleDuration;
      const segment = cycleDuration / 3;
      if (t < segment) {
        material.color.copy(colorBlue).lerp(colorPurple, t / segment);
      } else if (t < 2 * segment) {
        material.color.copy(colorPurple).lerp(colorGold, (t - segment) / segment);
      } else {
        material.color.copy(colorGold).lerp(colorBlue, (t - (2 * segment)) / segment);
      }
    } else {
      material.color.copy(colorBlue);
    }
    syncWaveColor();

    waves.rotation.z = useMotion ? (mouseX * preset.rotationFactor) : 0;
    camera.position.y = 2 + (useMotion ? (mouseY * preset.cameraOffset) : 0);
    camera.lookAt(scene.position);

    renderer.render(scene, camera);
    setWaveReady();
  }

  function animationLoop(time) {
    if (!isVisible) {
      return;
    }

    const preset = getPreset();
    const minFrameInterval = 1000 / preset.frameRate;

    if (lastRenderAt && (time - lastRenderAt) < minFrameInterval) {
      return;
    }

    const frameDelta = lastRenderAt ? (time - lastRenderAt) : minFrameInterval;
    lastRenderAt = time;
    sampleFrames += 1;
    sampleFrameMs += frameDelta;

    renderFrame(time);
    evaluatePerformance();
  }

  rebuildGeometry();
  window.addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', onVisibilityChange);
  if (typeof motionQuery.addEventListener === 'function') {
    motionQuery.addEventListener('change', onMotionChange);
  }

  if (reducedMotion) {
    renderFrame(0);
  } else {
    setPointerTracking(true);
    renderer.setAnimationLoop(animationLoop);
  }

  return {
    destroy
  };
}
