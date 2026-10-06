import { clerkClient } from "@clerk/nextjs/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { renderArchiveNotice, renderDigest, sendEmail } from "@/lib/email";
import {
  APP_TIMEZONE,
  addDays,
  zonedDayEnd,
  zonedDayStart,
  zonedToday,
} from "@/lib/datetime";
import { selectStaleApplications } from "@/lib/autoArchive";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/daily — the daily sweep. Two jobs, in order:
 *
 *   1. Auto-archive stale applications (users with auto_archive_days set).
 *   2. Send one digest email (users with email_notifications_enabled).
 *
 * These are independent settings: auto-archive runs whether or not the user
 * takes email, and archiving happens BEFORE the digest so the email can
 * report what it just did.
 *
 * Public in src/proxy.js (there's no Clerk session on a cron request), so the
 * bearer check below IS the authorization for this route. It must come before
 * any work.
 */
const CLERK_BATCH = 100;

/** Ceiling on one user's sweep, so a pathological account can't stall the run. */
const ARCHIVE_SCAN_CAP = 2000;

function isAuthorized(request) {
  const secret = process.env.CRON_SECRET;
  // No configured secret means no way to authorize — fail closed.
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const today = zonedToday();

    // Anyone who has opted into either job.
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select(
        "clerk_user_id, display_name, interview_reminder_days, deadline_reminder_days, email_notifications_enabled, auto_archive_days"
      )
      .or("auto_archive_days.not.is.null,email_notifications_enabled.eq.true");

    if (profilesError) throw new Error(profilesError.message);

    if (!profiles || profiles.length === 0) {
      return Response.json({
        ok: true,
        considered: 0,
        archived: 0,
        sent: 0,
        skipped: 0,
        failed: 0,
      });
    }

    // Only users who actually get email need a Clerk lookup.
    const emailByUserId = await fetchEmails(
      profiles
        .filter((p) => p.email_notifications_enabled)
        .map((p) => p.clerk_user_id)
    );

    let archivedTotal = 0;
    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const profile of profiles) {
      const userId = profile.clerk_user_id;

      // ---- 1. auto-archive ----
      let archived = [];
      if (profile.auto_archive_days) {
        try {
          archived = await autoArchive({ supabase, profile, now: new Date() });
          archivedTotal += archived.length;
        } catch (err) {
          // A failed sweep shouldn't block this user's email.
          console.error(`cron/daily: auto-archive failed for ${userId}:`, err);
        }
      }

      // ---- 2. digest ----
      if (!profile.email_notifications_enabled) continue;

      const email = emailByUserId.get(userId);
      if (!email) {
        console.warn(`cron/daily: no primary email for ${userId}, skipping`);
        skipped += 1;
        continue;
      }

      const digest = await collectForUser({ supabase, profile, today });

      const hasReminderContent =
        digest.interviews.length > 0 ||
        digest.deadlines.length > 0 ||
        digest.reminders.length > 0;

      // Nothing to say at all — don't send an empty email.
      if (!hasReminderContent && archived.length === 0) {
        skipped += 1;
        continue;
      }

      // Auto-archiving alone gets the short notice, not a full day-ahead digest.
      const message = hasReminderContent
        ? renderDigest({
            name: profile.display_name,
            today,
            ...digest,
            archived,
          })
        : renderArchiveNotice({
            name: profile.display_name,
            archived,
            days: profile.auto_archive_days,
          });

      const ok = await sendEmail({ to: email, ...message });

      if (!ok) {
        // Reminders stay unsent so the next run retries them.
        failed += 1;
        continue;
      }

      sent += 1;

      // Only mark sent once the email is actually away.
      if (digest.reminderIds.length > 0) {
        const { error: markError } = await supabase
          .from("reminders")
          .update({ is_sent: true, sent_at: new Date().toISOString() })
          .in("id", digest.reminderIds)
          .eq("clerk_user_id", userId);

        if (markError) {
          // A duplicate tomorrow is better than losing the email, but this
          // needs to be visible.
          console.error(
            `cron/daily: sent digest to ${userId} but failed to mark reminders:`,
            markError.message
          );
        }
      }
    }

    return Response.json({
      ok: true,
      considered: profiles.length,
      archived: archivedTotal,
      sent,
      skipped,
      failed,
    });
  } catch (err) {
    console.error("GET /api/cron/daily error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Archives this user's stale applications. The decision itself lives in
 * src/lib/autoArchive.js; this does the I/O around it.
 *
 * @returns {Promise<object[]>} what was archived: { applicationId, company, jobTitle, lastActivity }
 */
async function autoArchive({ supabase, profile, now }) {
  const userId = profile.clerk_user_id;

  const { data: applications, error } = await supabase
    .from("applications")
    .select(
      "id, company_name, job_title, updated_at, interview_rounds(id, is_completed, scheduled_date, updated_at)"
    )
    .eq("clerk_user_id", userId)
    .eq("is_archived", false)
    .limit(ARCHIVE_SCAN_CAP);

  if (error) throw new Error(error.message);
  if (!applications || applications.length === 0) return [];

  const stale = selectStaleApplications({
    applications,
    days: profile.auto_archive_days,
    now,
  });

  if (stale.length === 0) return [];

  const { error: updateError } = await supabase
    .from("applications")
    .update({
      is_archived: true,
      archived_at: new Date().toISOString(),
      archived_reason: "auto",
    })
    .in(
      "id",
      stale.map((s) => s.applicationId)
    )
    .eq("clerk_user_id", userId);

  if (updateError) throw new Error(updateError.message);

  return stale;
}

/** Clerk user id -> primary email address. */
async function fetchEmails(userIds) {
  if (userIds.length === 0) return new Map();

  const client = await clerkClient();
  const map = new Map();

  for (let i = 0; i < userIds.length; i += CLERK_BATCH) {
    const batch = userIds.slice(i, i + CLERK_BATCH);
    try {
      const { data } = await client.users.getUserList({
        userId: batch,
        limit: CLERK_BATCH,
      });

      for (const user of data) {
        const primary = user.emailAddresses.find(
          (e) => e.id === user.primaryEmailAddressId
        );
        if (primary?.emailAddress) map.set(user.id, primary.emailAddress);
      }
    } catch (err) {
      // One bad batch shouldn't sink the whole run.
      console.error("cron/daily: Clerk lookup failed for a batch:", err);
    }
  }

  return map;
}

/** Everything due for one user, within their own lead times. */
async function collectForUser({ supabase, profile, today }) {
  const userId = profile.clerk_user_id;

  const interviewCutoff = addDays(today, profile.interview_reminder_days ?? 2);
  const deadlineCutoff = addDays(today, profile.deadline_reminder_days ?? 3);

  // scheduled_date is TIMESTAMPTZ, so the window has to be real instants.
  // Comparing it against a bare "YYYY-MM-DD" would silently mean midnight and
  // drop everything scheduled later that day.
  const windowStart = zonedDayStart(today, APP_TIMEZONE).toISOString();
  const windowEnd = zonedDayEnd(interviewCutoff, APP_TIMEZONE).toISOString();

  // remind_at is TIMESTAMPTZ too. "Due today or overdue" is simply
  // "the moment has passed" — the user picked an instant, so honour it.
  const dueBy = new Date().toISOString();

  const [roundsResult, deadlinesResult, remindersResult] = await Promise.all([
    // Incomplete rounds inside the interview lead time.
    supabase
      .from("interview_rounds")
      .select(
        "id, round_type, scheduled_date, application_id, applications(id, company_name, job_title, is_archived)"
      )
      .eq("clerk_user_id", userId)
      .eq("is_completed", false)
      .gte("scheduled_date", windowStart)
      .lte("scheduled_date", windowEnd)
      .order("scheduled_date", { ascending: true }),

    // deadline is a plain date, so date-string bounds are correct here.
    supabase
      .from("applications")
      .select("id, company_name, job_title, deadline")
      .eq("clerk_user_id", userId)
      .eq("is_archived", false)
      .gte("deadline", today)
      .lte("deadline", deadlineCutoff)
      .order("deadline", { ascending: true }),

    supabase
      .from("reminders")
      .select(
        "id, remind_at, message, application_id, applications(id, company_name, job_title, is_archived)"
      )
      .eq("clerk_user_id", userId)
      .eq("is_sent", false)
      .lte("remind_at", dueBy)
      .order("remind_at", { ascending: true }),
  ]);

  if (roundsResult.error) throw new Error(roundsResult.error.message);
  if (deadlinesResult.error) throw new Error(deadlinesResult.error.message);
  if (remindersResult.error) throw new Error(remindersResult.error.message);

  // Archived applications are out of the search — nothing about them is worth
  // an email. This also drops anything the sweep just archived above.
  const interviews = (roundsResult.data || [])
    .filter((row) => row.applications && !row.applications.is_archived)
    .map((row) => ({
      applicationId: row.application_id,
      company: row.applications.company_name,
      jobTitle: row.applications.job_title,
      roundType: row.round_type,
      date: row.scheduled_date,
    }));

  const deadlines = (deadlinesResult.data || []).map((row) => ({
    applicationId: row.id,
    company: row.company_name,
    jobTitle: row.job_title,
    date: row.deadline,
  }));

  const dueReminders = (remindersResult.data || []).filter(
    (row) => row.applications && !row.applications.is_archived
  );

  const reminders = dueReminders.map((row) => ({
    applicationId: row.application_id,
    company: row.applications.company_name,
    jobTitle: row.applications.job_title,
    message: row.message,
    date: row.remind_at,
  }));

  return {
    interviews,
    deadlines,
    reminders,
    // Only the ones that made it into the email get marked sent.
    reminderIds: dueReminders.map((row) => row.id),
  };
}
