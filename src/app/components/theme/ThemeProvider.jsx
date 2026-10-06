"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
} from "react";
import {
  applyTheme,
  normalizeThemePreference,
  resolveTheme,
} from "@/lib/theme";
import {
  readPrefersDark,
  readPrefersDarkOnServer,
  readStoredTheme,
  readStoredThemeOnServer,
  subscribeColorScheme,
  subscribeStoredTheme,
  writeStoredTheme,
} from "@/lib/themeStore";

const ThemeContext = createContext(null);

/**
 * Holds the theme preference for the whole app.
 *
 * It does NOT own first paint — ThemeScript already set the class before this
 * component existed, and also seeded the localStorage mirror from the stored
 * profile value. This component's jobs are to keep the class in step as the
 * preference or the OS setting changes, and to hand the resolved theme to
 * anything that needs a real value rather than a CSS token (Clerk's appearance
 * config, framer-motion).
 *
 * Precedence is mirror-then-server: ThemeScript writes the authoritative
 * server value into the mirror before React runs, so the mirror is the fresher
 * of the two by construction — and it's the one that moves when the user picks
 * a theme or another tab does.
 *
 * `serverPreference` is profiles.dark_mode_preference, rendered into the HTML
 * so there's no extra round trip; it's the fallback for a browser whose
 * storage is unavailable.
 */
export default function ThemeProvider({ serverPreference, children }) {
  const stored = useSyncExternalStore(
    subscribeStoredTheme,
    readStoredTheme,
    readStoredThemeOnServer
  );

  const prefersDark = useSyncExternalStore(
    subscribeColorScheme,
    readPrefersDark,
    readPrefersDarkOnServer
  );

  const preference = normalizeThemePreference(stored ?? serverPreference);
  const resolved = resolveTheme(preference, prefersDark);

  // Pushing a value into the DOM is what effects are for; the pre-paint script
  // has already done it once, so this only ever handles later changes.
  useEffect(() => {
    applyTheme(resolved);
  }, [resolved]);

  const setPreference = useCallback((next) => {
    writeStoredTheme(normalizeThemePreference(next));
  }, []);

  return (
    <ThemeContext.Provider value={{ preference, resolved, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

/** Throws outside the provider rather than silently reporting light mode. */
export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside ThemeProvider");
  return value;
}
