/**
 * Stats computation for /api/stats.
 *
 * Everything here is pure — the route fetches rows, this derives numbers.
 *
 * Statuses are matched by NAME, the same way the rest of the app does it
 * (see the Applied lookups in src/app/api/applications/route.js and the
 * status DELETE route). A user who renames a preset falls out of these
 * buckets; that tradeoff is already baked into the project.
 *
 * Archived applications are INCLUDED everywhere except `active`. Stats are
 * about the whole search, not the current working set.
 */

export const APPLIED_NAME = "Applied";
export const HIRED_NAME = "Hired";

/** Current-status names that mean the application is over. */
export const CLOSED_STATUS_NAMES = ["Rejected", "Withdrawn", "Hired"];

/** Statuses that mean an interview process is underway. */
export const INTERVIEW_STATUS_NAMES = [
  "OA",
  "Phone Screen",
  "Interview",
  "Final Round",
];

/** Reaching one of these counts as an offer. */
export const OFFER_STATUS_NAMES = ["Offer", "Hired"];

/** Reaching this counts as a rejection, even if the card later moved on. */
export const REJECTED_NAME = "Rejected";

/**
 * Leaving Applied for one of these is not a response — nobody replied,
 * or the candidate pulled out. Everything else (including Rejected, and
 * including every custom status) counts as a response.
 */
export const NON_RESPONSE_STATUS_NAMES = ["Ghosted", "Withdrawn"];

/**
 * Funnel stages, widest first. `key` matches the keys in the stages object
 * returned by computeStats.
 */
export const FUNNEL_STAGES = [
  { key: "applied", label: "Applied" },
  { key: "responded", label: "Responded" },
  { key: "interviewing", label: "Interviewing" },
  { key: "offer", label: "Offer" },
  { key: "hired", label: "Hired" },
];

/** Stage keys ordered deepest-first, for the monotonic rollup. */
const STAGES_DEEPEST_FIRST = [...FUNNEL_STAGES].reverse().map((s) => s.key);

const DAY_MS = 86400000;

/**
 * Monday of the week containing a "YYYY-MM-DD" date, as "YYYY-MM-DD".
 * Pure UTC — date_applied is a bare date, so local time would drift it.
 */
export function weekStart(dateString) {
  const [y, m, d] = dateString.split("-").map(Number);
  const ms = Date.UTC(y, m - 1, d);
  const dow = new Date(ms).getUTCDay(); // 0 = Sunday
  const shift = dow === 0 ? -6 : 1 - dow;
  return new Date(ms + shift * DAY_MS).toISOString().slice(0, 10);
}

/** Every Monday from `from` through `to`, inclusive. */
function weeksBetween(from, to) {
  const out = [];
  let cursor = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  while (cursor <= end) {
    out.push(new Date(cursor).toISOString().slice(0, 10));
    cursor += 7 * DAY_MS;
  }
  return out;
}

/** How many trailing weeks the bar chart shows before it gets unreadable. */
export const MAX_WEEKS = 26;

/**
 * @param {object} input
 * @param {object[]} input.applications - rows with interview_rounds(id, is_completed)
 * @param {object[]} input.events - status_events rows (status_id, changed_at)
 * @param {object[]} input.statuses - the user's statuses
 * @param {Date} [input.now] - injectable clock, for tests
 */
export function computeStats({ applications, events, statuses, now = new Date() }) {
  const nowMs = now.getTime();

  const statusById = new Map(statuses.map((s) => [s.id, s]));
  const nameOf = (statusId) => statusById.get(statusId)?.name ?? null;

  // Group events per application, oldest first.
  const eventsByApp = new Map();
  for (const event of events) {
    if (!eventsByApp.has(event.application_id)) {
      eventsByApp.set(event.application_id, []);
    }
    eventsByApp.get(event.application_id).push(event);
  }
  for (const list of eventsByApp.values()) {
    list.sort((a, b) => Date.parse(a.changed_at) - Date.parse(b.changed_at));
  }

  const stageMembers = {
    applied: [],
    responded: [],
    interviewing: [],
    offer: [],
    hired: [],
  };

  let activeCount = 0;
  let inInterviewsCount = 0;
  let rejectedCount = 0;

  // status_id -> { totalDays, spans }
  const durations = new Map();
  // source label -> { total, responded }
  const sources = new Map();

  const perWeek = new Map();
  let earliestWeek = null;
  let latestWeek = null;

  const respondedIds = new Set();

  for (const app of applications) {
    const appEvents = eventsByApp.get(app.id) || [];
    const currentName = nameOf(app.status_id);

    // Names this card has ever been on. The current status is folded in so a
    // card whose event is missing (created before the log, or a failed
    // insert) still lands in the right stages.
    const everNames = new Set(
      appEvents.map((e) => nameOf(e.status_id)).filter(Boolean)
    );
    if (currentName) everNames.add(currentName);

    const rounds = app.interview_rounds || [];

    // ---- funnel stage membership (raw, before the rollup) ----
    const reached = {
      applied: true,
      responded: [...everNames].some(
        (name) =>
          name !== APPLIED_NAME && !NON_RESPONSE_STATUS_NAMES.includes(name)
      ),
      // Any logged round means a real interview happened, whatever the
      // status says.
      interviewing:
        rounds.length > 0 ||
        INTERVIEW_STATUS_NAMES.some((name) => everNames.has(name)),
      offer: OFFER_STATUS_NAMES.some((name) => everNames.has(name)),
      hired: everNames.has(HIRED_NAME),
    };

    // A funnel must not widen as it deepens: reaching a stage implies having
    // passed through every stage above it, even when the log skipped one.
    let deeper = false;
    for (const key of STAGES_DEEPEST_FIRST) {
      if (reached[key]) deeper = true;
      else if (deeper) reached[key] = true;
    }

    const member = {
      id: app.id,
      company_name: app.company_name,
      job_title: app.job_title,
      status_name: currentName,
      status_color: statusById.get(app.status_id)?.color_hex ?? null,
      is_archived: app.is_archived,
    };
    for (const { key } of FUNNEL_STAGES) {
      if (reached[key]) stageMembers[key].push(member);
    }

    if (reached.responded) respondedIds.add(app.id);

    // Ever rejected, not currently rejected — consistent with how offers are
    // counted, and a rejection doesn't stop being one if the card moves on.
    if (everNames.has(REJECTED_NAME)) rejectedCount += 1;

    // ---- summary counters ----
    if (!app.is_archived && !CLOSED_STATUS_NAMES.includes(currentName)) {
      activeCount += 1;
    }
    if (
      rounds.some((r) => !r.is_completed) ||
      INTERVIEW_STATUS_NAMES.includes(currentName)
    ) {
      inInterviewsCount += 1;
    }

    // ---- time spent per status ----
    // Each event runs until the next one; the last runs until now, so the
    // status a card is sitting in right now still accumulates.
    for (let i = 0; i < appEvents.length; i += 1) {
      const event = appEvents[i];
      if (!event.status_id) continue; // status was deleted
      const startMs = Date.parse(event.changed_at);
      const endMs = appEvents[i + 1]
        ? Date.parse(appEvents[i + 1].changed_at)
        : nowMs;
      const days = (endMs - startMs) / DAY_MS;
      if (!Number.isFinite(days) || days < 0) continue;

      const bucket = durations.get(event.status_id) || { totalDays: 0, spans: 0 };
      bucket.totalDays += days;
      bucket.spans += 1;
      durations.set(event.status_id, bucket);
    }

    // ---- source breakdown ----
    const sourceLabel = app.source?.trim() || null;
    const sourceKey = sourceLabel ?? "__none__";
    const sourceBucket = sources.get(sourceKey) || {
      source: sourceLabel,
      total: 0,
      responded: 0,
    };
    sourceBucket.total += 1;
    if (reached.responded) sourceBucket.responded += 1;
    sources.set(sourceKey, sourceBucket);

    // ---- applications per week ----
    if (app.date_applied) {
      const week = weekStart(app.date_applied);
      perWeek.set(week, (perWeek.get(week) || 0) + 1);
      if (!earliestWeek || week < earliestWeek) earliestWeek = week;
      if (!latestWeek || week > latestWeek) latestWeek = week;
    }
  }

  const total = applications.length;

  // Zero-fill the gaps so a quiet fortnight reads as two empty bars rather
  // than vanishing, and always run the axis out to the current week.
  let weekly = [];
  if (earliestWeek) {
    const thisWeek = weekStart(new Date(nowMs).toISOString().slice(0, 10));
    const end = latestWeek > thisWeek ? latestWeek : thisWeek;
    weekly = weeksBetween(earliestWeek, end).map((week) => ({
      week,
      count: perWeek.get(week) || 0,
    }));
  }
  const weeklyTruncated = weekly.length > MAX_WEEKS;
  if (weeklyTruncated) weekly = weekly.slice(-MAX_WEEKS);

  const statusDurations = statuses
    .filter((s) => durations.has(s.id))
    .map((s) => {
      const { totalDays, spans } = durations.get(s.id);
      return {
        status_id: s.id,
        name: s.name,
        color_hex: s.color_hex,
        sort_order: s.sort_order,
        avg_days: Math.round((totalDays / spans) * 10) / 10,
        spans,
      };
    })
    .sort((a, b) => a.sort_order - b.sort_order);

  const sourceBreakdown = [...sources.values()]
    .map((s) => ({
      source: s.source,
      total: s.total,
      responded: s.responded,
      response_rate: s.total > 0 ? s.responded / s.total : 0,
    }))
    .sort((a, b) => b.total - a.total || (a.source || "").localeCompare(b.source || ""));

  const funnel = FUNNEL_STAGES.map(({ key, label }) => ({
    key,
    label,
    count: stageMembers[key].length,
    applications: stageMembers[key],
  }));

  return {
    summary: {
      total,
      active: activeCount,
      in_interviews: inInterviewsCount,
      offers: stageMembers.offer.length,
      rejections: rejectedCount,
      responded: respondedIds.size,
      response_rate: total > 0 ? respondedIds.size / total : 0,
    },
    funnel,
    weekly,
    weekly_truncated: weeklyTruncated,
    status_durations: statusDurations,
    sources: sourceBreakdown,
  };
}
