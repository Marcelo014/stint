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

/**
 * The preset that triggers the hired celebration. Presets can be hidden but
 * never renamed or deleted, so matching on the name is stable — and a *custom*
 * status a user happens to call "Hired" deliberately doesn't fire it.
 */
export const HIRED_PRESET_NAME = "Hired";

/** True for the Hired preset specifically, not any status named like it. */
export function isHiredStatus(status) {
  return status?.is_preset === true && status?.name === HIRED_PRESET_NAME;
}

/** color_hex is injected into inline styles, so only accept #rrggbb. */
export function isValidHexColor(value) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}
