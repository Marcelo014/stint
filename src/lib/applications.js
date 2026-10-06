import { getSupabaseAdmin } from "./supabase";
import { recordStatusEvent } from "./statusEvents";
import { APPLICATION_SELECT } from "./queries";
import { APPLIED_PRESET_NAME } from "./statuses";

/**
 * Shared application-create path, used by both POST /api/applications and
 * POST /api/extension/applications so the two can't drift — the extension
 * must produce exactly the same row the web app does, status event included.
 *
 * Returns a tagged result instead of throwing, so each route can map it onto
 * its own response shape.
 *
 * @param {object} args
 * @param {string} args.userId - Clerk user id
 * @param {object} args.input - untrusted body fields
 * @returns {Promise<{ ok: true, application: object } | { ok: false, status: number, error: string }>}
 */
export async function createApplication({ userId, input }) {
  const companyName = input.company_name?.trim();
  const jobTitle = input.job_title?.trim();

  if (!companyName || !jobTitle) {
    return {
      ok: false,
      status: 400,
      error: "Company name and job title are required",
    };
  }

  const supabase = getSupabaseAdmin();

  // Fall back to the user's Applied preset when no status is given.
  let statusId = input.status_id || null;
  if (!statusId) {
    const { data: appliedStatus } = await supabase
      .from("statuses")
      .select("id")
      .eq("clerk_user_id", userId)
      .eq("name", APPLIED_PRESET_NAME)
      .eq("is_preset", true)
      .single();

    statusId = appliedStatus?.id || null;
  }

  const { data: application, error } = await supabase
    .from("applications")
    .insert({
      clerk_user_id: userId,
      company_name: companyName,
      job_title: jobTitle,
      status_id: statusId,
      date_applied: input.date_applied || new Date().toISOString().split("T")[0],
      job_url: input.job_url?.trim() || null,
      deadline: input.deadline || null,
      salary: input.salary?.trim() || null,
      recruiter_name: input.recruiter_name?.trim() || null,
      recruiter_email: input.recruiter_email?.trim() || null,
      source: input.source?.trim() || null,
      notes: input.notes?.trim() || null,
    })
    .select(APPLICATION_SELECT)
    .single();

  if (error) throw new Error(error.message);

  // Seed the card's history with the status it was created on.
  await recordStatusEvent({
    applicationId: application.id,
    userId,
    statusId: application.status_id,
  });

  return { ok: true, application };
}
