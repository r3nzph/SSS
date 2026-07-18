// ===============================
// THEME MANAGER — centralized theme system
// Single source of truth for dark/light mode.
// All colors inherit from CSS custom properties (no hardcoded colors).
// Persists to StorageService (centralized data store).
// Dispatches 'theme-changed' event for reactive UI updates.
// ===============================

import StorageService from './storage.js';

const THEMES = { DARK: 'dark', LIGHT: 'light' };
const LOCAL_STORAGE_KEY = 'pos-theme';

class ThemeManager {
  constructor() {
    this._currentTheme = THEMES.DARK;
    this._boundHandler = null;
    this._boundEvents = null;
  }

  /** Initialize: load persisted theme, apply, update buttons */
  async init() {
    this._currentTheme = await this._loadPersisted();
    this._apply(this._currentTheme);
    this._updateButtons();
    console.log(`[Theme] Initialized: ${this._currentTheme}`);
  }

  get current() { return this._currentTheme; }
  get isDark() { return this._currentTheme === THEMES.DARK; }
  get isLight() { return this._currentTheme === THEMES.LIGHT; }

  /** Toggle between dark and light */
  toggle() {
    const next = this.isDark ? THEMES.LIGHT : THEMES.DARK;
    this.set(next);
  }

  /** Set theme and persist */
  set(theme) {
    if (theme !== THEMES.DARK && theme !== THEMES.LIGHT) return;
    if (theme === this._currentTheme) return;

    this._currentTheme = theme;
    this._apply(theme);
    this._updateButtons();
    this._persist(theme);
    this._emitChange(theme);
  }

  // ---- Internal ----

  /** Apply theme by toggling `.light-mode` class on <html> */
  _apply(theme) {
    if (theme === THEMES.LIGHT) {
      document.documentElement.classList.add('light-mode');
    } else {
      document.documentElement.classList.remove('light-mode');
    }
  }

  /** Update all theme toggle buttons */
  _updateButtons() {
    const isLight = this.isLight;
    // Support both plain toggle buttons AND nested icon elements
    document.querySelectorAll('#themeToggleBtn').forEach(btn => {
      const iconEl = btn.querySelector('#themeToggleIcon');
      if (iconEl) {
        // New premium mini toggle: update only the nested icon span
        iconEl.textContent = isLight ? '\u{1F31B}' : '\u{1F319}';
      } else {
        // Old plain button: update entire content
        btn.innerHTML = isLight ? '\u{1F319} Dark' : '\u{2600}\u{FE0F} Light';
      }
    });
  }

  /** Persist theme: StorageService as primary, localStorage as fast cache */
  _persist(theme) {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, theme);
    } catch (_) { /* quota exceeded — ignore */ }
    try {
      StorageService.update('settings', 'main', { theme });
    } catch (e) {
      console.warn('[Theme] Failed to persist via StorageService:', e);
    }
  }

  /** Load persisted theme: StorageService first, then localStorage fallback */
  async _loadPersisted() {
    // 1. Try StorageService (settings.theme — centralized data)
    try {
      const settings = StorageService.load('settings', 'main');
      if (settings && (settings.theme === THEMES.DARK || settings.theme === THEMES.LIGHT)) {
        // Sync localStorage cache
        try { localStorage.setItem(LOCAL_STORAGE_KEY, settings.theme); } catch (_) {}
        return settings.theme;
      }
    } catch (_) { /* ignore — fall through */ }

    // 2. Fallback: localStorage (for users who set theme before this version)
    try {
      const local = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (local === THEMES.DARK || local === THEMES.LIGHT) {
        // Back-sync to StorageService
        try { StorageService.update('settings', 'main', { theme: local }); } catch (_) {}
        return local;
      }
    } catch (_) { /* ignore */ }

    // 3. Default
    return THEMES.DARK;
  }

  /** Dispatch a custom event so other modules can react to theme changes */
  _emitChange(theme) {
    try {
      window.dispatchEvent(new CustomEvent('theme-changed', {
        detail: { theme, isDark: theme === THEMES.DARK, isLight: theme === THEMES.LIGHT }
      }));
    } catch (_) { /* ignore */ }
  }
}

// Singleton instance
const Theme = new ThemeManager();

export default Theme;
