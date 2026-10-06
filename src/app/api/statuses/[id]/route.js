import { auth } from "@clerk/nextjs/server";
import { ensureProfile } from "@/lib/profile";
import { getSupabaseAdmin } from "@/lib/supabase";
import { APPLIED_PRESET_NAME, isValidHexColor } from "@/lib/statuses";

export const dynamic = "force-dynamic";

// PATCH /api/statuses/[id] — rename, recolor, reorder or hide a status
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

    const allowed = ["name", "color_hex", "sort_order", "is_hidden"];

    const updates = {};
    for (const key of allowed) {
      if (key in body) {
        updates[key] = body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: "No valid fields to update" }, { status: 400 });
    }

    if ("name" in updates) {
      const name = updates.name?.trim();
      if (!name) {
        return Response.json({ error: "Name cannot be empty" }, { status: 400 });
      }
      updates.name = name;
    }

    if ("color_hex" in updates && !isValidHexColor(updates.color_hex)) {
      return Response.json(
        { error: "color_hex must be a hex color like #7A8C5E" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("statuses")
      .update(updates)
      .eq("id", id)
      .eq("clerk_user_id", userId)
      .select("*")
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return Response.json({ error: "Status not found" }, { status: 404 });
      }
      throw new Error(error.message);
    }

    return Response.json({ status: data });
  } catch (err) {
    console.error("PATCH /api/statuses/[id] error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/statuses/[id] — delete a custom status, moving its
// applications back to the Applied preset. Presets can only be hidden.
export async function DELETE(request, { params }) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureProfile(userId);
    const supabase = getSupabaseAdmin();
    const { id } = await params;

    const { data: status, error: fetchError } = await supabase
      .from("statuses")
      .select("id, is_preset")
      .eq("id", id)
      .eq("clerk_user_id", userId)
      .single();

    if (fetchError || !status) {
      return Response.json({ error: "Status not found" }, { status: 404 });
    }

    if (status.is_preset) {
      return Response.json(
        { error: "Preset statuses can be hidden but not deleted" },
        { status: 400 }
      );
    }

    const { data: applied, error: appliedError } = await supabase
      .from("statuses")
      .select("id")
      .eq("clerk_user_id", userId)
      .eq("name", APPLIED_PRESET_NAME)
      .eq("is_preset", true)
      .single();

    if (appliedError || !applied) {
      throw new Error("Applied preset not found; refusing to orphan applications");
    }

    // Reassign first — deleting with applications still pointing at this
    // status would either fail the FK or null their status out.
    const { error: reassignError } = await supabase
      .from("applications")
      .update({ status_id: applied.id })
      .eq("clerk_user_id", userId)
      .eq("status_id", id);

    if (reassignError) throw new Error(reassignError.message);

    const { error: deleteError } = await supabase
      .from("statuses")
      .delete()
      .eq("id", id)
      .eq("clerk_user_id", userId);

    if (deleteError) throw new Error(deleteError.message);

    return Response.json({ success: true, reassigned_to: applied.id });
  } catch (err) {
    console.error("DELETE /api/statuses/[id] error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
