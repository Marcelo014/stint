/**
 * The auto-archive decision, kept pure so it can be reasoned about and
 * tested without a database. The cron route does the I/O around it.
 */

/**
 * Picks the applications that have gone quiet long enough to archive.
 *
 * "Latest activity" is the newest of the application's own updated_at and its
 * rounds' updated_at — editing a round is activity on the application, so it
 * postpones archiving.
 *
 * @param {object} input
 * @param {object[]} input.applications - rows with interview_rounds(is_completed, scheduled_date, updated_at)
 * @param {number} input.days - threshold; must be > 0
 * @param {Date} [input.now] - injectable clock
 * @returns {object[]} { applicationId, company, jobTitle, lastActivity }
 */
export function selectStaleApplications({ applications, days, now = new Date() }) {
  if (!days || days <= 0) return [];

  const cutoffMs = now.getTime() - days * 86400000;
  const stale = [];

  for (const app of applications) {
    const rounds = app.interview_rounds || [];

    // An interview still ahead of us means this search is live, whatever the
    // timestamps say. scheduled_date is TIMESTAMPTZ, so this is an instant
    // comparison — a string compare against a date would be both fragile and
    // a day out west of UTC. Undated incomplete rounds don't count as
    // upcoming; there's no moment for them to be ahead of.
    const hasUpcomingRound = rounds.some(
      (r) =>
        !r.is_completed &&
        r.scheduled_date &&
        Date.parse(r.scheduled_date) >= now.getTime()
    );
    if (hasUpcomingRound) continue;

    const timestamps = [
      Date.parse(app.updated_at),
      ...rounds.map((r) => Date.parse(r.updated_at)),
    ].filter(Number.isFinite);

    // No usable timestamp means no evidence of staleness. Leaving it alone is
    // the safe failure: archiving on a guess loses the user's card from view.
    if (timestamps.length === 0) continue;

    const lastActivityMs = Math.max(...timestamps);
    if (lastActivityMs >= cutoffMs) continue;

    stale.push({
      applicationId: app.id,
      company: app.company_name,
      jobTitle: app.job_title,
      lastActivity: new Date(lastActivityMs).toISOString().slice(0, 10),
    });
  }

  return stale;
}
