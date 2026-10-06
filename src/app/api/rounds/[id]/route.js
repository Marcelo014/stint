import { auth } from "@clerk/nextjs/server";
import { ensureProfile } from "@/lib/profile";
import { getSupabaseAdmin } from "@/lib/supabase";
import { ROUND_TYPES } from "@/lib/rounds";

export const dynamic = "force-dynamic";

// PATCH /api/rounds/[id] — update one interview round
export async function PATCH(request, { params }) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureProfile(userId);
    const supabase = getSupabaseAdmin();
    const { id } = await params;
    const body = await request.json();

    const allowed = [
      "round_type",
      "scheduled_date",
      "notes",
      "is_completed",
      "sort_order",
    ];

    const updates = {};
    for (const key of allowed) {
      if (key in body) {
        updates[key] = body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: "No valid fields to update" }, { status: 400 });
    }

    if ("round_type" in updates && !ROUND_TYPES.includes(updates.round_type)) {
      return Response.json({ error: "Invalid round type" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("interview_rounds")
      .update(updates)
      .eq("id", id)
      .eq("clerk_user_id", userId)
      .select("*")
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return Response.json({ error: "Round not found" }, { status: 404 });
      }
      throw new Error(error.message);
    }

    return Response.json({ round: data });
  } catch (err) {
    console.error("PATCH /api/rounds/[id] error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/rounds/[id] — permanently delete one interview round
export async function DELETE(request, { params }) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureProfile(userId);
    const supabase = getSupabaseAdmin();
    const { id } = await params;

    const { error } = await supabase
      .from("interview_rounds")
      .delete()
      .eq("id", id)
      .eq("clerk_user_id", userId);

    if (error) throw new Error(error.message);

    return Response.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/rounds/[id] error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
