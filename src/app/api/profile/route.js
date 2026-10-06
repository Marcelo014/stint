import { auth } from "@clerk/nextjs/server";
import { ensureProfile } from "@/lib/profile";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  normalizeSocialLinks,
  validateDisplayName,
  validateSocialLinks,
  validateUsername,
} from "@/lib/profileFields";

export const dynamic = "force-dynamic";

/** Fields the client may write. Everything else in the body is ignored. */
const ALLOWED_FIELDS = [
  "display_name",
  "username",
  "social_links",
  "hide_avatar",
  "email_notifications_enabled",
  "interview_reminder_days",
  "deadline_reminder_days",
  "auto_archive_days",
];

/** social_links is normalised on the way out so the UI gets a stable shape. */
function serialize(profile) {
  return { ...profile, social_links: normalizeSocialLinks(profile.social_links) };
}

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const profile = await ensureProfile(userId);
    return Response.json({ profile: serialize(profile) });
  } catch (err) {
    console.error("GET /api/profile error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/profile — update the signed-in user's own profile.
export async function PATCH(request) {
  const { userId } = await auth();

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureProfile(userId);
    const supabase = getSupabaseAdmin();
    const body = await request.json().catch(() => ({}));

    const present = ALLOWED_FIELDS.filter((field) => field in body);
    if (present.length === 0) {
      return Response.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const updates = {};

    for (const field of present) {
      switch (field) {
        case "display_name": {
          const result = validateDisplayName(body.display_name);
          if (!result.ok) {
            return Response.json({ error: result.error }, { status: 400 });
          }
          updates.display_name = result.value;
          break;
        }
        case "username": {
          const result = validateUsername(body.username);
          if (!result.ok) {
            return Response.json(
              { error: result.error, field: "username" },
              { status: 400 }
            );
          }
          updates.username = result.value;
          break;
        }
        case "social_links": {
          const result = validateSocialLinks(body.social_links);
          if (!result.ok) {
            return Response.json(
              { error: result.error, field: "social_links" },
              { status: 400 }
            );
          }
          updates.social_links = result.value;
          break;
        }
        case "hide_avatar":
        case "email_notifications_enabled": {
          if (typeof body[field] !== "boolean") {
            return Response.json(
              { error: `${field} must be true or false` },
              { status: 400 }
            );
          }
          updates[field] = body[field];
          break;
        }
        case "auto_archive_days": {
          // null is meaningful here: it's how auto-archive is turned off.
          const days = body.auto_archive_days;
          if (days === null) {
            updates.auto_archive_days = null;
            break;
          }
          if (!Number.isInteger(days) || days < 1 || days > 365) {
            return Response.json(
              {
                error:
                  "auto_archive_days must be null, or a whole number of days from 1 to 365",
              },
              { status: 400 }
            );
          }
          updates.auto_archive_days = days;
          break;
        }
        case "interview_reminder_days":
        case "deadline_reminder_days": {
          const days = body[field];
          if (!Number.isInteger(days) || days < 0 || days > 30) {
            return Response.json(
              { error: `${field} must be a whole number of days from 0 to 30` },
              { status: 400 }
            );
          }
          updates[field] = days;
          break;
        }
      }
    }

    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("clerk_user_id", userId)
      .select("*")
      .single();

    if (error) {
      // 23505 = unique_violation on the username index. A taken username is
      // the user's problem to fix, not a server fault.
      if (error.code === "23505") {
        return Response.json(
          { error: "That username is already taken", field: "username" },
          { status: 409 }
        );
      }
      throw new Error(error.message);
    }

    return Response.json({ profile: serialize(data) });
  } catch (err) {
    console.error("PATCH /api/profile error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
