import { getSupabaseAdmin } from "./supabase";

/**
 * Appends a row to status_events.
 *
 * Deliberately non-fatal: a card's own write has already succeeded by the
 * time this runs, and losing one history row is much cheaper than failing
 * the user's save. Failures are logged for follow-up instead of thrown.
 *
 * @param {object} args
 * @param {string} args.applicationId
 * @param {string} args.userId - Clerk user id
 * @param {string|null} args.statusId
 */
export async function recordStatusEvent({ applicationId, userId, statusId }) {
  if (!statusId) return; // nothing meaningful to log

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("status_events").insert({
      application_id: applicationId,
      clerk_user_id: userId,
      status_id: statusId,
      changed_at: new Date().toISOString(),
    });

    if (error) {
      console.error("recordStatusEvent insert failed:", error.message);
    }
  } catch (err) {
    console.error("recordStatusEvent error:", err);
  }
}
