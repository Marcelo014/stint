/**
 * Deadline warnings for dashboard cards.
 *
 * applications.deadline is a DATE column — "2026-10-20" with no time and no
 * zone. `new Date("2026-10-20")` parses that as midnight **UTC**, which for
 * anyone west of Greenwich renders and compares as the 19th. Every function
 * here therefore works on the Y/M/D triple, never on a parsed instant.
 *
 * Client-side only: "today" is the user's own calendar day, which the browser
 * knows and the server does not. Server-side day arithmetic lives in
 * src/lib/datetime.js.
 */

import { HIRED_PRESET_NAME } from "./statuses";

/**
 * Statuses where a deadline no longer means anything.
 *
 * Matched by name, not by preset flag: unlike the hired celebration, a custom
 * status someone has called "Rejected" should suppress the warning too — the
 * point is to stop nagging about a closed application, whoever named the
 * status.
 */
const SETTLED_STATUS_NAMES = new Set([
  "Rejected",
  "Withdrawn",
  HIRED_PRESET_NAME,
]);

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "2026-10-20" -> a Date at local midnight on that calendar day. */
export function parseLocalDate(value) {
  const match = typeof value === "string" ? value.match(DATE_ONLY) : null;
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Whole calendar days from today to `deadline`, both read as Y/M/D and
 * compared as integers — so the count never slips across a DST boundary or a
 * UTC offset.
 *
 * @param {string} deadline - "YYYY-MM-DD"
 * @param {Date} now - the instant to treat as "now", in the browser's zone
 * @returns {number|null} negative when the deadline has passed
 */
export function daysUntilDeadline(deadline, now) {
  const match = typeof deadline === "string" ? deadline.match(DATE_ONLY) : null;
  if (!match) return null;
  const [, y, m, d] = match.map(Number);

  const target = Date.UTC(y, m - 1, d);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());

  return Math.round((target - today) / 86400000);
}

/**
 * The warning a card should show, or null for no warning.
 *
 * Suppressed entirely when the card is archived or its status has settled —
 * a rejected application's deadline is history, not a thing to chase.
 *
 * @param {object} args
 * @param {string|null} args.deadline - applications.deadline
 * @param {boolean} args.isArchived
 * @param {object|null} args.status - the joined statuses row
 * @param {number} args.nowMs - read once per mount, not per render
 * @returns {{ tone: "passed"|"today"|"urgent"|"soon", label: string, days: number }|null}
 */
export function deadlineWarning({ deadline, isArchived, status, nowMs }) {
  if (!deadline || isArchived === true) return null;
  if (status?.name && SETTLED_STATUS_NAMES.has(status.name)) return null;

  const days = daysUntilDeadline(deadline, new Date(nowMs));
  if (days === null) return null;

  if (days < 0) return { tone: "passed", label: "Deadline passed", days };
  if (days === 0) return { tone: "today", label: "Due today", days };
  if (days <= 2) {
    return {
      tone: "urgent",
      label: days === 1 ? "Due tomorrow" : `Due in ${days} days`,
      days,
    };
  }
  if (days <= 7) return { tone: "soon", label: `Due in ${days} days`, days };

  return null;
}

/**
 * Token-only classes per tone. Severity climbs from a muted past-tense note,
 * through a quiet chip, to a filled one — colour is never the only signal,
 * since the label says the same thing in words.
 */
export const DEADLINE_TONE_CLASS = {
  passed: "bg-card-hover text-text-subtle",
  soon: "bg-accent-soft text-text-muted",
  urgent: "bg-status-applied/15 text-status-applied ring-1 ring-status-applied/40",
  today: "bg-status-rejected text-white",
};
