import { auth } from "@clerk/nextjs/server";
import { ensureProfile } from "@/lib/profile";
import { getSupabaseAdmin } from "@/lib/supabase";
import { ROUND_TYPES } from "@/lib/rounds";

export const dynamic = "force-dynamic";

// GET /api/applications/[id]/rounds — interview rounds for one application
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
      .from("interview_rounds")
      .select("*")
      .eq("application_id", id)
      .eq("clerk_user_id", userId)
      .order("sort_order", { ascending: true });

    if (error) throw new Error(error.message);

    return Response.json({ rounds: data || [] });
  } catch (err) {
    console.error("GET /api/applications/[id]/rounds error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/applications/[id]/rounds — append a round to the timeline
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

    // The application must belong to this user before we attach anything to it
    const { data: application, error: appError } = await supabase
      .from("applications")
      .select("id")
      .eq("id", id)
      .eq("clerk_user_id", userId)
      .single();

    if (appError || !application) {
      return Response.json({ error: "Application not found" }, { status: 404 });
    }

    const roundType = body.round_type?.trim() || ROUND_TYPES[0];
    if (!ROUND_TYPES.includes(roundType)) {
      return Response.json({ error: "Invalid round type" }, { status: 400 });
    }

    // sort_order is max + 1 so new rounds land at the end of the timeline
    const { data: last } = await supabase
      .from("interview_rounds")
      .select("sort_order")
      .eq("application_id", id)
      .eq("clerk_user_id", userId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextSortOrder = (last?.sort_order ?? -1) + 1;

    const { data: round, error } = await supabase
      .from("interview_rounds")
      .insert({
        application_id: id,
        clerk_user_id: userId,
        round_type: roundType,
        scheduled_date: body.scheduled_date || null,
        notes: body.notes?.trim() || null,
        is_completed: body.is_completed === true,
        sort_order: nextSortOrder,
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    return Response.json({ round }, { status: 201 });
  } catch (err) {
    console.error("POST /api/applications/[id]/rounds error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
