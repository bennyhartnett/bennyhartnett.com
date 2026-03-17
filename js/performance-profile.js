const STORAGE_KEY = 'bh-performance-profile-v1';
const STORAGE_TTL_MS = 1000 * 60 * 60 * 24 * 30;

let cachedProfile = null;

function readStoredHints() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    if (parsed.updatedAt && (Date.now() - parsed.updatedAt) > STORAGE_TTL_MS) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writeStoredHints(nextHints) {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...nextHints,
        updatedAt: Date.now()
      })
    );
  } catch {
    // Ignore storage failures in private mode or locked-down contexts.
  }
}

function getConnection() {
  return navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
}

function getMediaQueryValue(query) {
  return typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function getPerformanceProfile() {
  if (cachedProfile) {
    return cachedProfile;
  }

  const connection = getConnection();
  const storedHints = readStoredHints();
  const reducedMotion = getMediaQueryValue('(prefers-reduced-motion: reduce)');
  const coarsePointer = getMediaQueryValue('(pointer: coarse)');
  const finePointer = getMediaQueryValue('(pointer: fine)');
  const deviceMemory = navigator.deviceMemory || 4;
  const hardwareConcurrency = navigator.hardwareConcurrency || 4;
  const effectiveType = connection?.effectiveType || 'unknown';
  const saveData = Boolean(connection?.saveData);
  const downlink = connection?.downlink || 0;
  const screenWidth = Math.min(window.innerWidth || screen.width || 1280, screen.width || 1280);

  let score = 100;

  if (saveData) score -= 30;

  if (effectiveType === 'slow-2g' || effectiveType === '2g') {
    score -= 28;
  } else if (effectiveType === '3g') {
    score -= 16;
  }

  if (downlink > 0 && downlink < 1.2) {
    score -= 16;
  } else if (downlink >= 1.2 && downlink < 2.5) {
    score -= 8;
  }

  if (deviceMemory <= 2) {
    score -= 24;
  } else if (deviceMemory <= 4) {
    score -= 10;
  }

  if (hardwareConcurrency <= 2) {
    score -= 24;
  } else if (hardwareConcurrency <= 4) {
    score -= 10;
  }

  if (coarsePointer || !finePointer) score -= 8;
  if (screenWidth < 768) score -= 6;

  const storedWave = storedHints?.wave;
  if (storedWave?.recommendation === 'off') {
    score -= 35;
  } else if (storedWave?.recommendation === 'low') {
    score -= 18;
  }

  if (storedWave?.averageFrameMs >= 40) {
    score -= 16;
  } else if (storedWave?.averageFrameMs >= 28) {
    score -= 8;
  }

  score = clamp(score, 0, 100);

  let tier = 'high';
  if (score < 30) {
    tier = 'off';
  } else if (score < 55) {
    tier = 'low';
  } else if (score < 78) {
    tier = 'medium';
  }

  cachedProfile = {
    score,
    tier,
    reducedMotion,
    animateWave: !reducedMotion,
    coarsePointer,
    finePointer,
    saveData,
    downlink,
    effectiveType,
    deviceMemory,
    hardwareConcurrency,
    storedHints,
    allowWave: tier !== 'off',
    waveQuality: tier === 'high' ? 'high' : tier === 'medium' ? 'medium' : tier === 'low' ? 'low' : 'off',
    enableSmoothCursor: tier === 'high' && finePointer && !saveData && !reducedMotion,
    prefetchPages: !saveData && (tier === 'high' || tier === 'medium'),
    maxPrefetchPages: tier === 'high' ? 3 : tier === 'medium' ? 1 : 0,
    heavyWorkDelayMs: tier === 'high' ? 900 : tier === 'medium' ? 1500 : 2400,
    cursorDelayMs: tier === 'high' ? 1400 : 2600,
    analyticsDelayMs: saveData ? 4500 : tier === 'high' ? 1800 : 2800
  };

  return cachedProfile;
}

export function applyPerformanceProfile(profile = getPerformanceProfile()) {
  const root = document.documentElement;

  root.dataset.performanceTier = profile.tier;
  root.classList.toggle('perf-constrained', profile.tier === 'low' || profile.tier === 'off');
  root.classList.toggle('perf-reduced-motion', profile.reducedMotion);
  root.classList.toggle('perf-save-data', profile.saveData);

  if (document.body && !document.body.classList.contains('nuclear-gradient-bg')) {
    document.body.classList.add('adaptive-gradient-bg');
  }
}

export function scheduleDeferredTask(callback, options = {}) {
  const timeout = options.timeout ?? 1500;
  const delay = options.delay ?? 0;

  const run = () => {
    Promise.resolve()
      .then(callback)
      .catch((error) => {
        console.warn('Deferred task failed', error);
      });
  };

  const schedule = () => {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(() => run(), { timeout });
    } else {
      window.setTimeout(run, Math.min(timeout, 300));
    }
  };

  window.requestAnimationFrame(() => {
    if (delay > 0) {
      window.setTimeout(schedule, delay);
    } else {
      schedule();
    }
  });
}

export function loadExternalScript(src, { async = true, defer = false } = {}) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === 'true') {
        resolve(existing);
        return;
      }

      existing.addEventListener('load', () => resolve(existing), { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = async;
    script.defer = defer;
    script.crossOrigin = 'anonymous';
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true';
      resolve(script);
    }, { once: true });
    script.addEventListener('error', reject, { once: true });
    document.head.appendChild(script);
  });
}

export function recordWavePerformance(sample = {}) {
  const previous = readStoredHints() || {};
  const nextWave = {
    recommendation: sample.recommendation || sample.quality || previous.wave?.recommendation || 'medium',
    averageFrameMs: sample.averageFrameMs ?? previous.wave?.averageFrameMs ?? null,
    frameRate: sample.frameRate ?? previous.wave?.frameRate ?? null,
    disabled: Boolean(sample.disabled),
    reason: sample.reason || previous.wave?.reason || ''
  };

  writeStoredHints({
    ...previous,
    wave: nextWave
  });
}
