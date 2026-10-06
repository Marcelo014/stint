/**
 * Server-side timezone helpers.
 *
 * interview_rounds.scheduled_date and reminders.remind_at are TIMESTAMPTZ, so
 * "is this round within 2 days" and "is this reminder due today" are questions
 * about a calendar day in a *place*, not about a UTC instant. Asking them in
 * UTC shifts the answer by a day for anyone west of Greenwich — a 9pm
 * US-Eastern interview is already "tomorrow" in UTC.
 *
 * The browser knows its own zone, so client code uses plain local Date
 * methods (see src/lib/reminders.js). The server doesn't, hence APP_TIMEZONE.
 */

/**
 * IANA zone the daily digest reasons about days in.
 * There's no per-user timezone column, so this is instance-wide.
 */
export const APP_TIMEZONE = process.env.APP_TIMEZONE || "UTC";

/** Milliseconds `timeZone` is ahead of UTC at the given instant. */
function offsetMs(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
    .formatToParts(date)
    .reduce((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});

  const asIfUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second)
  );

  return asIfUtc - date.getTime();
}

/** Today's calendar date in `timeZone`, as "YYYY-MM-DD". */
export function zonedToday(now = new Date(), timeZone = APP_TIMEZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return parts; // en-CA formats as YYYY-MM-DD
}

/** "YYYY-MM-DD" `days` later, as a plain date string. */
export function addDays(dateString, days) {
  const [y, m, d] = dateString.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * 86400000)
    .toISOString()
    .slice(0, 10);
}

/**
 * The instant midnight begins on `dateString` in `timeZone`.
 * Off by an hour across a DST transition, which is immaterial for day-window
 * queries and not worth a dependency to fix.
 */
export function zonedDayStart(dateString, timeZone = APP_TIMEZONE) {
  const guess = new Date(`${dateString}T00:00:00Z`);
  return new Date(guess.getTime() - offsetMs(guess, timeZone));
}

/** The last instant of `dateString` in `timeZone`. */
export function zonedDayEnd(dateString, timeZone = APP_TIMEZONE) {
  return new Date(zonedDayStart(addDays(dateString, 1), timeZone).getTime() - 1);
}

/** "Mon, Oct 6" for a date string or an ISO timestamp, rendered in `timeZone`. */
export function formatZonedDate(value, timeZone = APP_TIMEZONE) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00Z`) // midday avoids any zone pushing it a day
    : new Date(value);

  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

/** "Mon, Oct 6 at 2:30 PM" — for rounds, which carry a real time. */
export function formatZonedDateTime(value, timeZone = APP_TIMEZONE) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

/** Whole days from today to `value`, counted in calendar days in `timeZone`. */
export function zonedDaysUntil(value, today, timeZone = APP_TIMEZONE) {
  const target = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : zonedToday(new Date(value), timeZone);

  const [ty, tm, td] = today.split("-").map(Number);
  const [vy, vm, vd] = target.split("-").map(Number);
  return Math.round(
    (Date.UTC(vy, vm - 1, vd) - Date.UTC(ty, tm - 1, td)) / 86400000
  );
}
