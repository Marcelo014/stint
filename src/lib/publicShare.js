import { clerkClient } from "@clerk/nextjs/server";
import { getSupabaseAdmin } from "./supabase";
import { computeStats } from "./stats";
import { normalizeSocialLinks } from "./profileFields";
import { isValidShareId } from "./shareFields";

/**
 * Builds the public payload for a share card.
 *
 * The one rule that matters: a field whose toggle is false is ABSENT from the
 * returned object — not null, not empty. The response must not reveal even the
 * shape of what wasn't shared. Nothing here ever reads an email address, a
 * clerk_user_id, or any application row's own fields.
 *
 * @returns {Promise<object|null>} null for unknown, malformed or disabled shares
 */
export async function buildPublicShare(shareId) {
  // Reject malformed ids before touching the database.
  if (!isValidShareId(shareId)) return null;

  const supabase = getSupabaseAdmin();

  const { data: share, error } = await supabase
    .from("public_shares")
    .select("*")
    .eq("share_id", shareId)
    .eq("is_enabled", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!share) return null;

  const ownerId = share.clerk_user_id;

  const [appsResult, eventsResult, statusesResult, profileResult] =
    await Promise.all([
      supabase
        .from("applications")
        .select(
          "id, company_name, job_title, status_id, date_applied, source, is_archived, interview_rounds(id, is_completed)"
        )
        .eq("clerk_user_id", ownerId)
        .limit(10000),
      supabase
        .from("status_events")
        .select("application_id, status_id, changed_at")
        .eq("clerk_user_id", ownerId)
        .limit(10000),
      supabase
        .from("statuses")
        .select("id, name, color_hex, sort_order")
        .eq("clerk_user_id", ownerId),
      supabase
        .from("profiles")
        .select("display_name, social_links, hide_avatar, profile_photo_url")
        .eq("clerk_user_id", ownerId)
        .maybeSingle(),
    ]);

  if (appsResult.error) throw new Error(appsResult.error.message);
  if (eventsResult.error) throw new Error(eventsResult.error.message);
  if (statusesResult.error) throw new Error(statusesResult.error.message);

  const { summary } = computeStats({
    applications: appsResult.data || [],
    events: eventsResult.data || [],
    statuses: statusesResult.data || [],
  });

  const profile = profileResult.data || {};

  // Built key by key, each one gated on its own toggle. Deliberately NOT a
  // filtered copy of a complete object — that pattern is one typo away from
  // leaking a field.
  const payload = {};

  if (share.show_total_sent) payload.total_sent = summary.total;
  if (share.show_response_rate) payload.response_rate = summary.response_rate;
  if (share.show_active_interviews) {
    payload.active_interviews = summary.in_interviews;
  }
  if (share.show_offers) payload.offers = summary.offers;
  if (share.show_rejection_count) payload.rejections = summary.rejections;

  if (share.show_display_name && profile.display_name) {
    payload.display_name = profile.display_name;
  }

  // hide_avatar is the owner's app-wide preference and overrides the share
  // toggle — if they've hidden their photo in Stint, a share link must not
  // resurrect it.
  if (share.show_photo && !profile.hide_avatar) {
    // profile_photo_url wins if it's ever set; otherwise fall back to Clerk's
    // hosted image, which is what the Settings page displays. Only fetched
    // when the toggle is actually on.
    let photoUrl = profile.profile_photo_url || null;

    if (!photoUrl) {
      try {
        const client = await clerkClient();
        const user = await client.users.getUser(ownerId);
        photoUrl = user.hasImage ? user.imageUrl : null;
      } catch (err) {
        // A missing photo is cosmetic; never fail the card over it.
        console.warn("buildPublicShare: Clerk image lookup failed:", err);
      }
    }

    if (photoUrl) payload.photo_url = photoUrl;
  }

  if (share.show_social_links) {
    const links = normalizeSocialLinks(profile.social_links);
    const shared = [];
    if (links.linkedin) shared.push({ label: "LinkedIn", url: links.linkedin });
    if (links.github) shared.push({ label: "GitHub", url: links.github });
    for (const link of links.custom) shared.push(link);
    if (shared.length > 0) payload.social_links = shared;
  }

  return payload;
}
