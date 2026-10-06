/**
 * Card size rules.
 *
 * Per-card size lives in applications.card_size and may be NULL, meaning
 * "whatever the profile default is" — so changing the default later moves
 * every card that never had an explicit size.
 *
 * What each size shows:
 *   small   company, job title, status
 *   medium  the above plus markers, reminder, round progress, applied date,
 *           salary and source
 *   large   the above plus a notes preview, recruiter and deadline
 *
 * A deadline *warning* is deliberately outside that ladder and renders at
 * every size: it is a time-critical signal, not a detail field.
 */

export const CARD_SIZES = ["small", "medium", "large"];

export const DEFAULT_CARD_SIZE = "medium";

export const CARD_SIZE_OPTIONS = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
];

export function isValidCardSize(value) {
  return CARD_SIZES.includes(value);
}

/** The profile default, with anything unrecognised falling back to medium. */
export function normalizeCardSize(value) {
  return isValidCardSize(value) ? value : DEFAULT_CARD_SIZE;
}

/**
 * The size a card actually renders at: its own, else the profile default,
 * else medium.
 */
export function resolveCardSize(cardSize, defaultSize) {
  if (isValidCardSize(cardSize)) return cardSize;
  return normalizeCardSize(defaultSize);
}
