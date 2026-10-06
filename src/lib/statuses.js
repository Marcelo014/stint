/**
 * Shared rules for custom statuses.
 */

/** Per-user ceiling on statuses, presets included. */
export const MAX_STATUSES = 50;

/**
 * Preset a status's applications fall back to when that status is deleted.
 * Must match the seeded preset name in PRESET_STATUSES (src/lib/profile.js).
 */
export const APPLIED_PRESET_NAME = "Applied";

/** color_hex is injected into inline styles, so only accept #rrggbb. */
export function isValidHexColor(value) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}
