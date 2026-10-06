"use client";

/**
 * The two external sources the theme reads from: the localStorage mirror and
 * the OS colour-scheme setting.
 *
 * Both are exposed as useSyncExternalStore triples rather than state kept in
 * sync by an effect. Neither exists during SSR, so each has a server snapshot
 * that matches what the server could have rendered — and React handles the
 * post-hydration switch to the real value itself.
 */

import { THEME_STORAGE_KEY, isValidThemePreference } from "./theme";

/**
 * Last value written in this tab. It shadows localStorage so the control still
 * works where storage throws or is blocked (private windows, hardened
 * browsers) — the preference just doesn't survive a reload there.
 */
let memoryPreference = null;

const listeners = new Set();

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeStoredTheme(onChange) {
  listeners.add(onChange);

  // Another tab moving the preference moves this one too.
  function onStorage(event) {
    if (event.key === THEME_STORAGE_KEY) emit();
  }
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** The stored preference, or null when there isn't a valid one. */
export function readStoredTheme() {
  if (memoryPreference) return memoryPreference;
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return isValidThemePreference(value) ? value : null;
  } catch {
    return null;
  }
}

/** The server has no localStorage, so it can only report "nothing stored". */
export function readStoredThemeOnServer() {
  return null;
}

export function writeStoredTheme(value) {
  memoryPreference = value;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, value);
  } catch {
    // memoryPreference above still drives this tab.
  }
  emit();
}

export function subscribeColorScheme(onChange) {
  const query = window.matchMedia("(prefers-color-scheme: dark)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function readPrefersDark() {
  if (!window.matchMedia) return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/**
 * The server can't know the device setting, so "system" renders light there —
 * which matches the default palette, and the pre-paint script has already
 * corrected the real document by the time anyone sees it.
 */
export function readPrefersDarkOnServer() {
  return false;
}
