import { auth } from "@clerk/nextjs/server";
import { ensureProfile } from "@/lib/profile";
import { getSupabaseAdmin } from "@/lib/supabase";
import { MESSAGE_MAX, isValidTimestamp } from "@/lib/reminders";

export const dynamic = "force-dynamic";

// PATCH /api/reminders/[id] — edit a reminder's time or message
export async function PATCH(request, { params }) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureProfile(userId);
    const supabase = getSupabaseAdmin();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const allowed = ["remind_at", "message", "is_sent"];

    const updates = {};
    for (const key of allowed) {
      if (key in body) {
        updates[key] = body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: "No valid fields to update" }, { status: 400 });
    }

    if ("remind_at" in updates) {
      if (!isValidTimestamp(updates.remind_at)) {
        return Response.json(
          { error: "remind_at must be an ISO timestamp" },
          { status: 400 }
        );
      }
      updates.remind_at = new Date(updates.remind_at).toISOString();
    }

    if ("message" in updates) {
      const message = updates.message?.trim() || null;
      if (message && message.length > MESSAGE_MAX) {
        return Response.json(
          { error: `Message must be ${MESSAGE_MAX} characters or fewer` },
          { status: 400 }
        );
      }
      updates.message = message;
    }

    if ("is_sent" in updates && typeof updates.is_sent !== "boolean") {
      return Response.json(
        { error: "is_sent must be true or false" },
        { status: 400 }
      );
    }

    // Moving a reminder's time makes it due again.
    if ("remind_at" in updates && !("is_sent" in updates)) {
      updates.is_sent = false;
      updates.sent_at = null;
    }

    const { data, error } = await supabase
      .from("reminders")
      .update(updates)
      .eq("id", id)
      .eq("clerk_user_id", userId)
      .select("*")
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return Response.json({ error: "Reminder not found" }, { status: 404 });
      }
      throw new Error(error.message);
    }

    return Response.json({ reminder: data });
  } catch (err) {
    console.error("PATCH /api/reminders/[id] error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/reminders/[id] — remove a reminder
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
      .from("reminders")
      .delete()
      .eq("id", id)
      .eq("clerk_user_id", userId);

    if (error) throw new Error(error.message);

    return Response.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/reminders/[id] error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
