import { auth } from "@clerk/nextjs/server";
import { ensureProfile } from "@/lib/profile";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const VALID_MARKERS = ["exclamation", "star", "pin", "clock"];

// POST /api/applications/[id]/markers — toggle a marker on/off
export async function POST(request, { params }) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureProfile(userId);
    const supabase = getSupabaseAdmin();
    const { id } = await params;
    const { marker_type } = await request.json();

    if (!VALID_MARKERS.includes(marker_type)) {
      return Response.json({ error: "Invalid marker type" }, { status: 400 });
    }

    // Check if marker already exists
    const { data: existing } = await supabase
      .from("card_markers")
      .select("id")
      .eq("application_id", id)
      .eq("clerk_user_id", userId)
      .eq("marker_type", marker_type)
      .maybeSingle();

    if (existing) {
      await supabase.from("card_markers").delete().eq("id", existing.id);
    } else {
      await supabase.from("card_markers").insert({
        application_id: id,
        clerk_user_id: userId,
        marker_type,
      });
    }

    // Return updated markers for this application
    const { data: markers } = await supabase
      .from("card_markers")
      .select("id, marker_type")
      .eq("application_id", id)
      .eq("clerk_user_id", userId);

    return Response.json({ markers: markers || [] });
  } catch (err) {
    console.error("POST /api/applications/[id]/markers error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}