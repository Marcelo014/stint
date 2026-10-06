/**
 * Share-card field definitions.
 *
 * Kept separate from src/lib/share.js because the modal is a client component
 * and share.js imports node:crypto — pulling that into the browser bundle is
 * at best dead weight and at worst a build error.
 */

/**
 * The per-field toggles, in the order the modal lists them.
 *
 * `column` is the public_shares boolean. `key` is what the public API emits
 * when that toggle is on — and a field with its toggle off is OMITTED from
 * the response entirely rather than sent as null, so the payload can't even
 * hint at what wasn't shared.
 */
export const SHARE_FIELDS = [
  { column: "show_total_sent", key: "total_sent", label: "Total sent" },
  { column: "show_response_rate", key: "response_rate", label: "Response rate" },
  { column: "show_active_interviews", key: "active_interviews", label: "Active interviews" },
  { column: "show_offers", key: "offers", label: "Offers" },
  { column: "show_rejection_count", key: "rejections", label: "Rejection count" },
  { column: "show_photo", key: "photo_url", label: "Photo" },
  { column: "show_display_name", key: "display_name", label: "Display name" },
  { column: "show_social_links", key: "social_links", label: "Social links" },
];

/** Toggle columns the owner may PATCH. */
export const SHARE_TOGGLE_COLUMNS = SHARE_FIELDS.map((f) => f.column);

/** Every column the owner's own endpoint returns. Never includes clerk_user_id. */
export const SHARE_OWNER_SELECT = [
  "share_id",
  "is_enabled",
  ...SHARE_TOGGLE_COLUMNS,
].join(", ");

/** Matches the DB check constraint on public_shares.share_id. */
export function isValidShareId(value) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{22,64}$/.test(value);
}
