/**
 * Shared reminder rules.
 *
 * reminders.remind_at is TIMESTAMPTZ, so the UI collects a calendar date and
 * stores the instant that date begins in the *browser's* zone. The functions
 * below that mention "local" use plain Date getters deliberately — in a client
 * component that is the user's own zone, which is exactly what we want.
 * Server-side day arithmetic lives in src/lib/datetime.js.
 */

/** reminders.reminder_type is NOT NULL; user-authored ones are 'custom'. */
export const CUSTOM_REMINDER_TYPE = "custom";

export const MESSAGE_MAX = 300;

/** Lead-time options offered in Settings, in days. */
export const LEAD_TIME_OPTIONS = [0, 1, 2, 3, 5, 7, 14];

const pad = (n) => String(n).padStart(2, "0");

/** Today in the browser's zone, as "YYYY-MM-DD" — for input min= values. */
export function todayLocalDate(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * "2026-10-14" -> the ISO instant that date starts in the browser's zone.
 * `new Date("...T00:00")` with no Z is parsed as local time, which is the
 * whole point: a US-Eastern user picking the 14th gets 2026-10-14T04:00:00Z,
 * not a timestamp that renders as the 13th.
 */
export function localDateToTimestamp(dateString) {
  const parsed = new Date(`${dateString}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/** An ISO timestamp back to the calendar date it falls on locally. */
export function timestampToLocalDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return todayLocalDate(date);
}

/** An ISO timestamp to a <input type="datetime-local"> value. */
export function timestampToLocalInput(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${todayLocalDate(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** A <input type="datetime-local"> value to an ISO instant. */
export function localInputToTimestamp(value) {
  if (!value) return null;
  const parsed = new Date(value); // no Z -> parsed as local
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/** Accepts anything Date can parse into a real instant. */
export function isValidTimestamp(value) {
  if (typeof value !== "string" || value.trim() === "") return false;
  return !Number.isNaN(new Date(value).getTime());
}

/** Rejects anything that isn't a plain, real calendar date. */
export function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(y, m - 1, d));
  return (
    parsed.getUTCFullYear() === y &&
    parsed.getUTCMonth() === m - 1 &&
    parsed.getUTCDate() === d
  );
}
