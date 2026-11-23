const SETTINGS_KEY = 'awg_v1_settings';

const DEFAULT_SETTINGS = {
  appName: 'AUTO WORD',
  theme: 'light',
  dateFormat: 'dd/MM/yyyy',
  defaultPlace: 'Đồng Tháp',
  maxFileSizeMB: 15,
};

export function getSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(partial) {
  const next = { ...getSettings(), ...partial };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  applySettingsToUI(next);
  return next;
}

export function applySettingsToUI(settings = getSettings()) {
  document.documentElement.setAttribute('data-theme', settings.theme || 'light');
  const brand = document.getElementById('appBrandName');
  if (brand) brand.textContent = settings.appName || DEFAULT_SETTINGS.appName;
  document.title = `${settings.appName || 'AUTO WORD'} GENERATOR v1.0`;
}
