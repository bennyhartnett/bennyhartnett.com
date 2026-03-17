import { initRouter } from './spa-router.js';
import {
  applyPerformanceProfile,
  getPerformanceProfile,
  loadExternalScript,
  scheduleDeferredTask
} from './performance-profile.js';

const ANALYTICS_ID = 'G-GGGPH0X4LN';

function isNuclearSubdomain() {
  return window.location.hostname.startsWith('nuclear.');
}

function primeAnalyticsQueue() {
  window.dataLayer = window.dataLayer || [];

  if (typeof window.gtag !== 'function') {
    window.gtag = function gtag() {
      window.dataLayer.push(arguments);
    };
  }

  window.gtag('js', new Date());
  window.gtag('config', ANALYTICS_ID, { send_page_view: false });
}

function loadAnalytics(profile) {
  const load = () => loadExternalScript(`https://www.googletagmanager.com/gtag/js?id=${ANALYTICS_ID}`);

  if (document.visibilityState === 'hidden') {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        scheduleDeferredTask(load, {
          timeout: profile.analyticsDelayMs,
          delay: profile.analyticsDelayMs
        });
      }
    }, { once: true });
    return;
  }

  scheduleDeferredTask(load, {
    timeout: profile.analyticsDelayMs,
    delay: Math.round(profile.analyticsDelayMs / 2)
  });
}

function scheduleWaveBackground(profile) {
  if (isNuclearSubdomain()) {
    document.body.classList.remove('adaptive-gradient-bg');
    document.body.classList.add('nuclear-gradient-bg');
    return;
  }

  if (!profile.allowWave) {
    return;
  }

  scheduleDeferredTask(async () => {
    const { initWaveBackground } = await import('./wave-background.js');
    initWaveBackground(profile);
  }, {
    timeout: profile.heavyWorkDelayMs,
    delay: Math.round(profile.heavyWorkDelayMs / 3)
  });
}

function scheduleSmoothCursor(profile) {
  if (!profile.enableSmoothCursor) {
    return;
  }

  scheduleDeferredTask(() => import('./smooth-cursor.js'), {
    timeout: profile.cursorDelayMs,
    delay: profile.cursorDelayMs
  });
}

function bootstrap() {
  const profile = getPerformanceProfile();
  window.__BH_PERF_PROFILE = profile;

  applyPerformanceProfile(profile);
  primeAnalyticsQueue();
  initRouter();
  scheduleWaveBackground(profile);
  scheduleSmoothCursor(profile);
  loadAnalytics(profile);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
  bootstrap();
}
