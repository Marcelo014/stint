import { randomBytes } from "node:crypto";

/**
 * Server-only share helpers. Field definitions live in src/lib/shareFields.js
 * so client components can import them without dragging node:crypto along.
 */

/**
 * 16 random bytes as base64url — 22 URL-safe characters, 128 bits of entropy.
 * The share_id is the only thing protecting the card, so it's CSPRNG output
 * rather than anything derived from the user.
 */
export function generateShareId() {
  return randomBytes(16).toString("base64url");
}
