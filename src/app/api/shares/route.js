import { auth } from "@clerk/nextjs/server";
import { ensureProfile } from "@/lib/profile";
import { getSupabaseAdmin } from "@/lib/supabase";
import { generateShareId } from "@/lib/share";
import { SHARE_OWNER_SELECT, SHARE_TOGGLE_COLUMNS } from "@/lib/shareFields";

export const dynamic = "force-dynamic";

/**
 * Owner-facing share management. Deliberately at /api/shares (plural):
 * /api/share/* is public in src/proxy.js, so these endpoints must not live
 * under it.
 */

// GET /api/shares — this user's share, or null if they've never made one.
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureProfile(userId);
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("public_shares")
      .select(SHARE_OWNER_SELECT)
      .eq("clerk_user_id", userId)
      .maybeSingle();

    if (error) throw new Error(error.message);

    return Response.json({ share: data || null });
  } catch (err) {
    console.error("GET /api/shares error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/shares — create this user's share. Idempotent: returns the
// existing one rather than erroring, since the modal calls it on first open.
export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureProfile(userId);
    const supabase = getSupabaseAdmin();

    const { data: existing } = await supabase
      .from("public_shares")
      .select(SHARE_OWNER_SELECT)
      .eq("clerk_user_id", userId)
      .maybeSingle();

    if (existing) return Response.json({ share: existing });

    const { data, error } = await supabase
      .from("public_shares")
      .insert({ clerk_user_id: userId, share_id: generateShareId() })
      .select(SHARE_OWNER_SELECT)
      .single();

    if (error) {
      // 23505 = another request created it between our SELECT and INSERT.
      if (error.code === "23505") {
        const { data: raced } = await supabase
          .from("public_shares")
          .select(SHARE_OWNER_SELECT)
          .eq("clerk_user_id", userId)
          .maybeSingle();
        return Response.json({ share: raced });
      }
      throw new Error(error.message);
    }

    return Response.json({ share: data }, { status: 201 });
  } catch (err) {
    console.error("POST /api/shares error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/shares — flip per-field toggles, or disable sharing entirely.
export async function PATCH(request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureProfile(userId);
    const supabase = getSupabaseAdmin();
    const body = await request.json().catch(() => ({}));

    const allowed = ["is_enabled", ...SHARE_TOGGLE_COLUMNS];

    const updates = {};
    for (const key of allowed) {
      if (key in body) {
        if (typeof body[key] !== "boolean") {
          return Response.json(
            { error: `${key} must be true or false` },
            { status: 400 }
          );
        }
        updates[key] = body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: "No valid fields to update" }, { status: 400 });
    }

    // updated_at is maintained by the public_shares_updated_at trigger.
    const { data, error } = await supabase
      .from("public_shares")
      .update(updates)
      .eq("clerk_user_id", userId)
      .select(SHARE_OWNER_SELECT)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return Response.json({ error: "No share to update" }, { status: 404 });
      }
      throw new Error(error.message);
    }

    return Response.json({ share: data });
  } catch (err) {
    console.error("PATCH /api/shares error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
