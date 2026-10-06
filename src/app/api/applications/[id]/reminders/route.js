import { auth } from "@clerk/nextjs/server";
import { ensureProfile } from "@/lib/profile";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  CUSTOM_REMINDER_TYPE,
  MESSAGE_MAX,
  isValidTimestamp,
} from "@/lib/reminders";

export const dynamic = "force-dynamic";

// GET /api/applications/[id]/reminders — reminders for one application
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
      .from("reminders")
      .select("*")
      .eq("application_id", id)
      .eq("clerk_user_id", userId)
      .order("remind_at", { ascending: true });

    if (error) throw new Error(error.message);

    return Response.json({ reminders: data || [] });
  } catch (err) {
    console.error("GET /api/applications/[id]/reminders error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/applications/[id]/reminders — add a reminder
export async function POST(request, { params }) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureProfile(userId);
    const supabase = getSupabaseAdmin();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    // The application must belong to this user before we attach anything.
    const { data: application, error: appError } = await supabase
      .from("applications")
      .select("id")
      .eq("id", id)
      .eq("clerk_user_id", userId)
      .single();

    if (appError || !application) {
      return Response.json({ error: "Application not found" }, { status: 404 });
    }

    // remind_at is timestamptz; the client sends an ISO instant built from the
    // date the user picked in their own zone.
    if (!isValidTimestamp(body.remind_at)) {
      return Response.json(
        { error: "remind_at must be an ISO timestamp" },
        { status: 400 }
      );
    }

    const message = body.message?.trim() || null;
    if (message && message.length > MESSAGE_MAX) {
      return Response.json(
        { error: `Message must be ${MESSAGE_MAX} characters or fewer` },
        { status: 400 }
      );
    }

    const { data: reminder, error } = await supabase
      .from("reminders")
      .insert({
        application_id: id,
        clerk_user_id: userId,
        remind_at: new Date(body.remind_at).toISOString(),
        // NOT NULL in the schema — user-authored reminders are 'custom'.
        reminder_type: CUSTOM_REMINDER_TYPE,
        message,
        is_sent: false,
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    return Response.json({ reminder }, { status: 201 });
  } catch (err) {
    console.error("POST /api/applications/[id]/reminders error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
