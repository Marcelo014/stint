import { auth } from "@clerk/nextjs/server";
import { ensureProfile } from "@/lib/profile";
import { getSupabaseAdmin } from "@/lib/supabase";
import { APPLICATION_SELECT } from "@/lib/queries";

export const dynamic = "force-dynamic";

// GET /api/applications/[id] — fetch a single application
export async function GET(request, { params }) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureProfile(userId);
    const supabase = getSupabaseAdmin();
    const { id } = await params;

    const { data, error } = await supabase
      .from("applications")
      .select(APPLICATION_SELECT)
      .eq("id", id)
      .eq("clerk_user_id", userId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return Response.json({ error: "Application not found" }, { status: 404 });
      }
      throw new Error(error.message);
    }

    return Response.json({ application: data });
  } catch (err) {
    console.error("GET /api/applications/[id] error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/applications/[id] — update any fields on an application
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
      "company_name",
      "job_title",
      "status_id",
      "date_applied",
      "job_url",
      "deadline",
      "salary",
      "recruiter_name",
      "recruiter_email",
      "source",
      "notes",
      "card_size",
      "is_archived",
      "archived_reason",
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

    if (updates.is_archived === true) {
      updates.archived_at = new Date().toISOString();
      if (!updates.archived_reason) updates.archived_reason = "manual";
    }

    if (updates.is_archived === false) {
      updates.archived_at = null;
      updates.archived_reason = null;
    }

    const { data, error } = await supabase
      .from("applications")
      .update(updates)
      .eq("id", id)
      .eq("clerk_user_id", userId)
      .select(APPLICATION_SELECT)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return Response.json({ error: "Application not found" }, { status: 404 });
      }
      throw new Error(error.message);
    }

    return Response.json({ application: data });
  } catch (err) {
    console.error("PATCH /api/applications/[id] error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/applications/[id] — permanently delete an application
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
      .from("applications")
      .delete()
      .eq("id", id)
      .eq("clerk_user_id", userId);

    if (error) throw new Error(error.message);

    return Response.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/applications/[id] error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}