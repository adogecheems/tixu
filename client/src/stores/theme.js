import { reactive } from 'vue';

const STORAGE_KEY = 'tixu.theme';
const mediaQuery =
  typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

function readPreference() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return ['system', 'light', 'dark'].includes(value) ? value : 'system';
  } catch {
    return 'system';
  }
}

function effectiveFor(preference) {
  if (preference === 'dark') return 'dark';
  if (preference === 'light') return 'light';
  return mediaQuery?.matches ? 'dark' : 'light';
}

export const themeState = reactive({
  preference: readPreference(),
  effective: 'light',
});

export function applyTheme(preference = themeState.preference) {
  const effective = effectiveFor(preference);
  themeState.preference = preference;
  themeState.effective = effective;
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.theme = effective;
  root.dataset.themePreference = preference;
  root.style.colorScheme = effective;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', effective === 'dark' ? '#141414' : '#FAFAF9');
}

export function setThemePreference(preference) {
  const next = ['system', 'light', 'dark'].includes(preference) ? preference : 'system';
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Theme is still applied for this page.
  }
  applyTheme(next);
}

export function initTheme() {
  applyTheme(themeState.preference);
  if (mediaQuery) {
    const handler = () => {
      if (themeState.preference === 'system') applyTheme('system');
    };
    if (mediaQuery.addEventListener) mediaQuery.addEventListener('change', handler);
    else if (mediaQuery.addListener) mediaQuery.addListener(handler);
  }
}
