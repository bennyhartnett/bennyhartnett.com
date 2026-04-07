import { getPerformanceProfile } from './performance-profile.js';

const SETTINGS_STORAGE_KEY = 'bh-home-fx-settings-v1';
const PANEL_STORAGE_KEY = 'bh-home-fx-panel-open-v1';
const FILTER_ID = 'home-fx-targeted-filter';

const FILTER_PROFILES = [
  {
    id: 'original',
    label: 'Original',
    description: 'No color remapping.'
  },
  {
    id: 'negative',
    label: 'Negative',
    description: 'Opposite colors like a photo negative.'
  },
  {
    id: 'spectrum',
    label: 'Spectrum',
    description: 'Rotates colors around the spectrum instead of inverting them.'
  },
  {
    id: 'ocean',
    label: 'Ocean',
    description: 'Pushes tones toward cool aqua and deep blue.'
  },
  {
    id: 'sunset',
    label: 'Sunset',
    description: 'Warmer reds, pinks, and golden highlights.'
  },
  {
    id: 'neon',
    label: 'Neon',
    description: 'Punchy cyberpunk-like saturation and contrast.'
  },
  {
    id: 'forest',
    label: 'Forest',
    description: 'Shifts the palette toward mossy greens and earth tones.'
  },
  {
    id: 'violet',
    label: 'Violet',
    description: 'Moves the image into blue-violet territory.'
  },
  {
    id: 'thermal',
    label: 'Thermal',
    description: 'A heat-map style remap with dramatic warm colors.'
  }
];

const SWAP_PRESETS = [
  {
    id: 'black-white',
    label: 'Black -> White',
    source: '#111111',
    target: '#ffffff',
    description: 'Lift dark tones into bright highlights.'
  },
  {
    id: 'red-blue',
    label: 'Red -> Blue',
    source: '#ff3b30',
    target: '#2f6bff',
    description: 'Turn warm reds into cool blues.'
  },
  {
    id: 'blue-orange',
    label: 'Blue -> Orange',
    source: '#2f6bff',
    target: '#ff8a2a',
    description: 'Push sky-like blues into warm orange.'
  },
  {
    id: 'green-magenta',
    label: 'Green -> Magenta',
    source: '#22c55e',
    target: '#d946ef',
    description: 'Swap greens toward a pink-magenta feel.'
  },
  {
    id: 'yellow-violet',
    label: 'Yellow -> Violet',
    source: '#facc15',
    target: '#7c3aed',
    description: 'Shift sunny yellows into deep violet.'
  }
];

const DEFAULT_STATE = {
  enabled: true,
  profileId: 'spectrum',
  intensity: 85,
  hueShift: 300,
  swapEnabled: true,
  swapPresetId: 'red-blue',
  sourceColor: '#ff3b30',
  targetColor: '#2f6bff',
  swapStrength: 72,
  swapThreshold: 18,
  swapSoftness: 22
};

let initialized = false;
let activePage = '';
let currentState = loadState();
let panelOpen = loadPanelOpen();
let performanceProfile = null;

let shell = null;
let controlsRoot = null;
let toggleButton = null;
let panelHost = null;
let panelMounted = false;

let maskSeedNode = null;
let maskAlphaNode = null;
let maskBlurNode = null;
let tintMatrixNode = null;
let strengthAlphaNode = null;

export function initHomeFx() {
  if (initialized) {
    return;
  }

  initialized = true;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupHomeFx, { once: true });
    return;
  }

  setupHomeFx();
}

function setupHomeFx() {
  shell = document.getElementById('site-shell');
  controlsRoot = document.getElementById('fx-controls');
  toggleButton = document.getElementById('home-fx-toggle');
  panelHost = document.getElementById('home-fx-panel');
  maskSeedNode = document.getElementById('home-fx-mask-seed');
  maskAlphaNode = document.getElementById('home-fx-mask-alpha');
  maskBlurNode = document.getElementById('home-fx-mask-blur');
  tintMatrixNode = document.getElementById('home-fx-tint-matrix');
  strengthAlphaNode = document.getElementById('home-fx-strength-alpha');
  performanceProfile = getPerformanceProfile();

  if (!shell || !controlsRoot || !toggleButton || !panelHost) {
    return;
  }

  toggleButton.addEventListener('click', handleToggleButtonClick);
  panelHost.addEventListener('click', handlePanelClick);
  panelHost.addEventListener('input', handlePanelInput);
  panelHost.addEventListener('change', handlePanelInput);
  document.addEventListener('keydown', handleDocumentKeydown);
  document.addEventListener('pointerdown', handleDocumentPointerDown);
  document.addEventListener('spa:content-loaded', handleRouteLoaded);

  syncRouteState(document.body.dataset.page || '');
}

function handleRouteLoaded(event) {
  const nextPage = event.detail && typeof event.detail.page === 'string'
    ? event.detail.page
    : '';
  syncRouteState(nextPage);
}

function syncRouteState(nextPage) {
  activePage = nextPage;
  const isFxPage = activePage === 'fx';

  if (!controlsRoot || !toggleButton || !panelHost) {
    return;
  }

  controlsRoot.hidden = !isFxPage;

  if (!isFxPage) {
    updatePanelVisibility(false, false);
    applyShellFilter();
    return;
  }

  mountPanelIfNeeded();
  updatePanelVisibility(panelOpen, true);
  renderPanel();
  applyShellFilter();
}

function mountPanelIfNeeded() {
  if (panelMounted || !panelHost) {
    return;
  }

  const template = document.getElementById('fx-panel-template');
  if (!template) {
    return;
  }

  panelHost.innerHTML = '';
  panelHost.appendChild(template.content.cloneNode(true));
  panelMounted = true;
}

function handleToggleButtonClick() {
  if (activePage !== 'fx') {
    return;
  }

  mountPanelIfNeeded();
  panelOpen = !panelOpen;
  savePanelOpen(panelOpen);
  updatePanelVisibility(panelOpen, true);
  renderPanel();
}

function updatePanelVisibility(shouldOpen, isHomePage) {
  const visible = Boolean(isHomePage && shouldOpen && panelMounted);

  if (!toggleButton || !panelHost) {
    return;
  }

  toggleButton.hidden = !isHomePage;
  toggleButton.setAttribute('aria-expanded', String(visible));
  toggleButton.dataset.open = visible ? 'true' : 'false';
  toggleButton.dataset.active = isHomePage && currentState.enabled ? 'true' : 'false';
  panelHost.hidden = !visible;
  panelHost.setAttribute('aria-hidden', String(!visible));
}

function handleDocumentKeydown(event) {
  if (event.key === 'Escape' && panelOpen && activePage === 'fx') {
    panelOpen = false;
    savePanelOpen(panelOpen);
    updatePanelVisibility(panelOpen, true);
    renderPanel();
  }
}

function handleDocumentPointerDown(event) {
  if (!panelOpen || activePage !== 'fx' || !panelHost || !toggleButton) {
    return;
  }

  if (panelHost.contains(event.target) || toggleButton.contains(event.target)) {
    return;
  }

  panelOpen = false;
  savePanelOpen(panelOpen);
  updatePanelVisibility(panelOpen, true);
  renderPanel();
}

function handlePanelClick(event) {
  const profileButton = event.target.closest('[data-fx-profile]');
  if (profileButton) {
    currentState.profileId = profileButton.dataset.fxProfile;
    persistAndRender();
    return;
  }

  const presetButton = event.target.closest('[data-fx-preset]');
  if (presetButton) {
    const preset = getSwapPresetById(presetButton.dataset.fxPreset);
    currentState.swapPresetId = preset.id;
    currentState.sourceColor = preset.source;
    currentState.targetColor = preset.target;
    currentState.swapEnabled = true;
    persistAndRender();
    return;
  }

  const toggleControl = event.target.closest('[data-fx-action]');
  if (!toggleControl) {
    return;
  }

  const action = toggleControl.dataset.fxAction;
  if (action === 'toggle-enabled') {
    currentState.enabled = !currentState.enabled;
    persistAndRender();
    return;
  }

  if (action === 'toggle-swap') {
    currentState.swapEnabled = !currentState.swapEnabled;
    persistAndRender();
  }
}

function handlePanelInput(event) {
  const control = event.target;
  if (!control || !control.dataset || !control.dataset.fxControl) {
    return;
  }

  const key = control.dataset.fxControl;
  if (key === 'sourceColor' || key === 'targetColor') {
    currentState[key] = normalizeHexColor(control.value, DEFAULT_STATE[key]);
    currentState.swapPresetId = getMatchingSwapPresetId(currentState.sourceColor, currentState.targetColor) || 'custom';
    persistAndRender();
    return;
  }

  if (key === 'profileId') {
    currentState.profileId = control.value;
    persistAndRender();
    return;
  }

  currentState[key] = Number(control.value);
  persistAndRender();
}

function persistAndRender() {
  currentState = sanitizeState(currentState);
  saveState(currentState);
  renderPanel();
  applyShellFilter();
}

function renderPanel() {
  if (!panelMounted || !panelHost) {
    return;
  }

  const swapPreviewSupported = isSwapPreviewSupported();
  const activeProfile = getProfileById(currentState.profileId);
  const activePreset = getSwapPresetById(currentState.swapPresetId);

  const enabledButton = panelHost.querySelector('[data-fx-action="toggle-enabled"]');
  const swapButton = panelHost.querySelector('[data-fx-action="toggle-swap"]');
  const summaryNode = panelHost.querySelector('[data-fx-summary]');
  const detailNode = panelHost.querySelector('[data-fx-detail]');
  const noteNode = panelHost.querySelector('[data-fx-note]');
  const intensityOutput = panelHost.querySelector('[data-fx-output="intensity"]');
  const hueOutput = panelHost.querySelector('[data-fx-output="hueShift"]');
  const swapStrengthOutput = panelHost.querySelector('[data-fx-output="swapStrength"]');
  const swapThresholdOutput = panelHost.querySelector('[data-fx-output="swapThreshold"]');
  const swapSoftnessOutput = panelHost.querySelector('[data-fx-output="swapSoftness"]');

  if (enabledButton) {
    enabledButton.setAttribute('aria-pressed', String(currentState.enabled));
    enabledButton.textContent = currentState.enabled ? 'Effects on' : 'Effects off';
  }

  if (swapButton) {
    swapButton.setAttribute('aria-pressed', String(currentState.swapEnabled));
    swapButton.textContent = currentState.swapEnabled ? 'Swap on' : 'Swap off';
  }

  if (intensityOutput) {
    intensityOutput.textContent = `${Math.round(currentState.intensity)}%`;
  }
  if (hueOutput) {
    hueOutput.textContent = `${Math.round(currentState.hueShift)}deg`;
  }
  if (swapStrengthOutput) {
    swapStrengthOutput.textContent = `${Math.round(currentState.swapStrength)}%`;
  }
  if (swapThresholdOutput) {
    swapThresholdOutput.textContent = `${Math.round(currentState.swapThreshold)}%`;
  }
  if (swapSoftnessOutput) {
    swapSoftnessOutput.textContent = `${Math.round(currentState.swapSoftness)}%`;
  }

  setControlValue('intensity', String(currentState.intensity));
  setControlValue('hueShift', String(currentState.hueShift));
  setControlValue('swapStrength', String(currentState.swapStrength));
  setControlValue('swapThreshold', String(currentState.swapThreshold));
  setControlValue('swapSoftness', String(currentState.swapSoftness));
  setControlValue('sourceColor', currentState.sourceColor);
  setControlValue('targetColor', currentState.targetColor);

  panelHost.querySelectorAll('[data-fx-profile]').forEach((button) => {
    const selected = button.dataset.fxProfile === currentState.profileId;
    button.dataset.selected = selected ? 'true' : 'false';
    button.setAttribute('aria-pressed', String(selected));
  });

  panelHost.querySelectorAll('[data-fx-preset]').forEach((button) => {
    const selected = button.dataset.fxPreset === currentState.swapPresetId;
    button.dataset.selected = selected ? 'true' : 'false';
    button.setAttribute('aria-pressed', String(selected));
  });

  panelHost.querySelectorAll('[data-fx-swatch="source"]').forEach((swatch) => {
    swatch.style.backgroundColor = currentState.sourceColor;
  });
  panelHost.querySelectorAll('[data-fx-swatch="target"]').forEach((swatch) => {
    swatch.style.backgroundColor = currentState.targetColor;
  });

  panelHost.querySelectorAll('[data-fx-color-value="source"]').forEach((node) => {
    node.textContent = currentState.sourceColor.toUpperCase();
  });
  panelHost.querySelectorAll('[data-fx-color-value="target"]').forEach((node) => {
    node.textContent = currentState.targetColor.toUpperCase();
  });

  const effectSummary = getEffectLabel({
    profileId: currentState.profileId,
    intensity: currentState.intensity,
    hueShift: currentState.hueShift,
    enabled: currentState.enabled,
    swapEnabled: currentState.swapEnabled,
    swapStrength: currentState.swapStrength,
    sourceColor: currentState.sourceColor,
    targetColor: currentState.targetColor,
    swapPreviewSupported
  });

  if (summaryNode) {
    summaryNode.textContent = effectSummary;
  }

  if (detailNode) {
    const presetDescription = activePreset && currentState.swapPresetId !== 'custom'
      ? activePreset.description
      : `${currentState.sourceColor.toUpperCase()} shifts toward ${currentState.targetColor.toUpperCase()}.`;
    detailNode.textContent = `${activeProfile.label}: ${activeProfile.description} ${presetDescription}`;
  }

  if (noteNode) {
    const showNote = currentState.swapEnabled && currentState.swapStrength > 0 && !swapPreviewSupported;
    noteNode.hidden = !showNote;
    noteNode.textContent = showNote
      ? 'Targeted color swap preview is paused on this device profile to keep the homepage responsive.'
      : '';
  }
}

function setControlValue(controlName, value) {
  if (!panelHost) {
    return;
  }

  const control = panelHost.querySelector(`[data-fx-control="${controlName}"]`);
  if (control) {
    control.value = value;
  }
}

function applyShellFilter() {
  if (!shell) {
    return;
  }

  if (activePage !== 'fx' || !currentState.enabled) {
    shell.style.filter = 'none';
    shell.dataset.fxActive = 'false';
    updateTargetedSwapFilter(false);
    if (toggleButton) {
      toggleButton.dataset.active = activePage === 'fx' && currentState.enabled ? 'true' : 'false';
    }
    return;
  }

  const profileFilter = buildColorFilter(currentState.profileId, currentState.intensity, currentState.hueShift);
  const applySwap = currentState.swapEnabled && currentState.swapStrength > 0 && isSwapPreviewSupported();

  updateTargetedSwapFilter(applySwap);

  const filters = [];
  if (profileFilter !== 'none') {
    filters.push(profileFilter);
  }
  if (applySwap) {
    filters.push(`url(#${FILTER_ID})`);
  }

  shell.style.filter = filters.length > 0 ? filters.join(' ') : 'none';
  shell.dataset.fxActive = filters.length > 0 ? 'true' : 'false';

  if (toggleButton) {
    toggleButton.dataset.active = currentState.enabled ? 'true' : 'false';
  }
}

function updateTargetedSwapFilter(isActive) {
  if (!maskSeedNode || !maskAlphaNode || !maskBlurNode || !tintMatrixNode || !strengthAlphaNode) {
    return;
  }

  const source = hexToRgb(currentState.sourceColor);
  const target = hexToRgb(currentState.targetColor);
  const sourceWeights = getSourceWeights(source);
  const tolerance = clamp(currentState.swapThreshold, 1, 100) / 100;
  const softness = clamp(currentState.swapSoftness, 0, 100) / 100;
  const cutoff = clamp(0.82 - tolerance * 0.62, 0.12, 0.82);
  const band = Math.max(0.035, softness * 0.28);
  const blur = formatNumber(softness * 1.8, 3);
  const targetValues = getTintMatrix(target);

  maskSeedNode.setAttribute(
    'values',
    `0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 ${sourceWeights.r} ${sourceWeights.g} ${sourceWeights.b} 0 ${sourceWeights.bias}`
  );
  maskAlphaNode.setAttribute('tableValues', buildMaskTable(cutoff, band));
  maskBlurNode.setAttribute('stdDeviation', blur);
  tintMatrixNode.setAttribute('values', targetValues);
  strengthAlphaNode.setAttribute(
    'slope',
    isActive ? formatNumber(clamp(currentState.swapStrength, 0, 100) / 100, 3) : '0'
  );
}

function isSwapPreviewSupported() {
  if (!performanceProfile) {
    performanceProfile = getPerformanceProfile();
  }

  return !performanceProfile.reducedMotion && performanceProfile.tier !== 'low' && performanceProfile.tier !== 'off';
}

function getSourceWeights(source) {
  const red = source.r / 255;
  const green = source.g / 255;
  const blue = source.b / 255;

  return {
    r: formatNumber(red * 1.8 - (1 - red) * 0.55, 4),
    g: formatNumber(green * 1.8 - (1 - green) * 0.55, 4),
    b: formatNumber(blue * 1.8 - (1 - blue) * 0.55, 4),
    bias: formatNumber(0.24, 4)
  };
}

function getTintMatrix(target) {
  const red = formatNumber(target.r / 255, 4);
  const green = formatNumber(target.g / 255, 4);
  const blue = formatNumber(target.b / 255, 4);
  const lumR = 0.2126;
  const lumG = 0.7152;
  const lumB = 0.0722;

  return [
    formatNumber(lumR * red, 4), formatNumber(lumG * red, 4), formatNumber(lumB * red, 4), 0, 0,
    formatNumber(lumR * green, 4), formatNumber(lumG * green, 4), formatNumber(lumB * green, 4), 0, 0,
    formatNumber(lumR * blue, 4), formatNumber(lumG * blue, 4), formatNumber(lumB * blue, 4), 0, 0,
    0, 0, 0, 1, 0
  ].join(' ');
}

function buildMaskTable(cutoff, softness) {
  const values = [];
  for (let index = 0; index <= 20; index += 1) {
    const step = index / 20;
    values.push(formatNumber(smoothstep(cutoff - softness, cutoff + softness, step), 3));
  }
  return values.join(' ');
}

function smoothstep(edge0, edge1, value) {
  if (edge0 === edge1) {
    return value < edge0 ? 0 : 1;
  }

  const x = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return x * x * (3 - 2 * x);
}

function getEffectLabel(effectState) {
  if (!effectState.enabled) {
    return 'FX page filters are paused.';
  }

  const profile = getProfileById(effectState.profileId);
  let baseLabel = 'Showing the original FX page shell';

  if (!(effectState.profileId === 'original' || effectState.intensity === 0)) {
    baseLabel = effectState.profileId === 'spectrum'
      ? `${profile.label} remap at ${Math.round(effectState.intensity)}% with ${Math.round(effectState.hueShift)}deg hue travel`
      : `${profile.label} remap at ${Math.round(effectState.intensity)}%`;
  }

  if (!effectState.swapEnabled || effectState.swapStrength === 0) {
    return baseLabel;
  }

  if (!effectState.swapPreviewSupported) {
    return `${baseLabel}. Targeted swap settings are saved but preview is paused for this device profile.`;
  }

  return `${baseLabel}. Targeted swap ${effectState.sourceColor.toUpperCase()} -> ${effectState.targetColor.toUpperCase()} at ${Math.round(effectState.swapStrength)}%.`;
}

function buildColorFilter(profileId, intensity, hueShift) {
  const amount = clamp(intensity, 0, 100) / 100;

  if (profileId === 'original' || amount === 0) {
    return 'none';
  }

  if (profileId === 'negative') {
    return `invert(${formatNumber(amount)}) hue-rotate(${formatNumber(amount * 180, 1)}deg) contrast(${formatNumber(1 + amount * 0.05)})`;
  }

  if (profileId === 'spectrum') {
    return `hue-rotate(${formatNumber(clamp(hueShift, 0, 360) * amount, 1)}deg) saturate(${formatNumber(1 + amount * 1.4)}) contrast(${formatNumber(1 + amount * 0.06)})`;
  }

  if (profileId === 'ocean') {
    return `sepia(${formatNumber(amount * 0.28)}) hue-rotate(${formatNumber(amount * 160, 1)}deg) saturate(${formatNumber(1 + amount * 1.35)}) contrast(${formatNumber(1 + amount * 0.08)})`;
  }

  if (profileId === 'sunset') {
    return `sepia(${formatNumber(amount * 0.72)}) hue-rotate(${formatNumber(amount * -32, 1)}deg) saturate(${formatNumber(1 + amount * 1.55)}) brightness(${formatNumber(1 + amount * 0.06)})`;
  }

  if (profileId === 'neon') {
    return `hue-rotate(${formatNumber(amount * 240, 1)}deg) saturate(${formatNumber(1 + amount * 2.2)}) contrast(${formatNumber(1 + amount * 0.22)})`;
  }

  if (profileId === 'forest') {
    return `sepia(${formatNumber(amount * 0.38)}) hue-rotate(${formatNumber(amount * 72, 1)}deg) saturate(${formatNumber(1 + amount * 1.05)}) contrast(${formatNumber(1 + amount * 0.1)})`;
  }

  if (profileId === 'violet') {
    return `hue-rotate(${formatNumber(amount * 282, 1)}deg) saturate(${formatNumber(1 + amount * 1.2)}) brightness(${formatNumber(1 + amount * 0.04)})`;
  }

  return `invert(${formatNumber(amount * 0.18)}) sepia(${formatNumber(amount * 0.95)}) hue-rotate(${formatNumber(amount * -48, 1)}deg) saturate(${formatNumber(1 + amount * 2.6)}) contrast(${formatNumber(1 + amount * 0.24)})`;
}

function getProfileById(profileId) {
  return FILTER_PROFILES.find((profile) => profile.id === profileId) || FILTER_PROFILES[0];
}

function getSwapPresetById(presetId) {
  return SWAP_PRESETS.find((preset) => preset.id === presetId) || SWAP_PRESETS[0];
}

function getMatchingSwapPresetId(sourceColor, targetColor) {
  const normalizedSource = normalizeHexColor(sourceColor, DEFAULT_STATE.sourceColor);
  const normalizedTarget = normalizeHexColor(targetColor, DEFAULT_STATE.targetColor);
  const match = SWAP_PRESETS.find((preset) => preset.source === normalizedSource && preset.target === normalizedTarget);
  return match ? match.id : null;
}

function hexToRgb(hex) {
  const normalized = normalizeHexColor(hex, '#000000').slice(1);
  const value = Number.parseInt(normalized, 16);

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function formatNumber(value, decimals = 3) {
  return Number(value.toFixed(decimals));
}

function normalizeHexColor(value, fallback) {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(trimmed)) {
    return trimmed;
  }

  if (/^#[0-9a-f]{3}$/.test(trimmed)) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`;
  }

  return fallback;
}

function loadState() {
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_STATE };
    }

    return sanitizeState(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function saveState(nextState) {
  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(nextState));
  } catch {
    // Ignore storage failures in private mode or locked-down contexts.
  }
}

function loadPanelOpen() {
  try {
    return window.localStorage.getItem(PANEL_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function savePanelOpen(nextValue) {
  try {
    window.localStorage.setItem(PANEL_STORAGE_KEY, String(Boolean(nextValue)));
  } catch {
    // Ignore storage failures in private mode or locked-down contexts.
  }
}

function sanitizeState(state) {
  const nextState = {
    ...DEFAULT_STATE,
    ...(state && typeof state === 'object' ? state : {})
  };

  nextState.enabled = Boolean(nextState.enabled);
  nextState.profileId = FILTER_PROFILES.some((profile) => profile.id === nextState.profileId)
    ? nextState.profileId
    : DEFAULT_STATE.profileId;
  nextState.intensity = clamp(Number(nextState.intensity) || 0, 0, 100);
  nextState.hueShift = clamp(Number(nextState.hueShift) || 0, 0, 360);
  nextState.swapEnabled = Boolean(nextState.swapEnabled);
  nextState.sourceColor = normalizeHexColor(nextState.sourceColor, DEFAULT_STATE.sourceColor);
  nextState.targetColor = normalizeHexColor(nextState.targetColor, DEFAULT_STATE.targetColor);
  nextState.swapStrength = clamp(Number(nextState.swapStrength) || 0, 0, 100);
  nextState.swapThreshold = clamp(Number(nextState.swapThreshold) || 0, 1, 100);
  nextState.swapSoftness = clamp(Number(nextState.swapSoftness) || 0, 0, 100);

  const matchingPresetId = getMatchingSwapPresetId(nextState.sourceColor, nextState.targetColor);
  nextState.swapPresetId = matchingPresetId || 'custom';

  return nextState;
}
