/**
 * Theme preference rules, shared by the pre-paint inline script, the
 * ThemeProvider and the /api/profile validator.
 *
 * Three preferences, one resolved value: "system" follows
 * prefers-color-scheme, "light" and "dark" pin it. Only the resolved value
 * ever reaches the DOM — the `.dark` class in globals.css.
 */

export const THEME_PREFERENCES = ["light", "dark", "system"];

export const DEFAULT_THEME_PREFERENCE = "system";

/**
 * localStorage mirror of profiles.dark_mode_preference.
 *
 * The server value is authoritative and is rendered into the HTML, so this
 * only has to cover the signed-out and pre-session cases. It is read by the
 * inline script, which runs before any bundle has loaded — hence a literal
 * key rather than an imported constant on that side.
 */
export const THEME_STORAGE_KEY = "stint-theme";

export function isValidThemePreference(value) {
  return THEME_PREFERENCES.includes(value);
}

/** Anything unrecognised (null, a stale value, a boolean) becomes "system". */
export function normalizeThemePreference(value) {
  return isValidThemePreference(value) ? value : DEFAULT_THEME_PREFERENCE;
}

/** The preference plus the OS setting, collapsed to "light" or "dark". */
export function resolveTheme(preference, systemPrefersDark) {
  if (preference === "dark") return "dark";
  if (preference === "light") return "light";
  return systemPrefersDark ? "dark" : "light";
}

/**
 * Writes the resolved theme to <html>. `color-scheme` is set alongside the
 * class so native widgets — date pickers, selects, scrollbars — follow too.
 */
export function applyTheme(resolved) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
}

export const THEME_OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];
