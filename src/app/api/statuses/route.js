import { auth } from "@clerk/nextjs/server";
import { ensureProfile } from "@/lib/profile";
import { getSupabaseAdmin } from "@/lib/supabase";
import { MAX_STATUSES, isValidHexColor } from "@/lib/statuses";

export const dynamic = "force-dynamic";

// GET /api/statuses — visible statuses, or all of them with include_hidden=true
export async function GET(request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureProfile(userId);
    const supabase = getSupabaseAdmin();

    const { searchParams } = new URL(request.url);
    const includeHidden = searchParams.get("include_hidden") === "true";

    let query = supabase
      .from("statuses")
      .select("*")
      .eq("clerk_user_id", userId);

    if (!includeHidden) {
      query = query.eq("is_hidden", false);
    }

    const { data, error } = await query.order("sort_order", { ascending: true });

    if (error) throw new Error(error.message);

    return Response.json({ statuses: data });
  } catch (err) {
    console.error("GET /api/statuses error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/statuses — create a custom status
export async function POST(request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureProfile(userId);
    const supabase = getSupabaseAdmin();
    const body = await request.json().catch(() => ({}));

    const name = body.name?.trim();
    if (!name) {
      return Response.json({ error: "Name is required" }, { status: 400 });
    }

    if (!isValidHexColor(body.color_hex)) {
      return Response.json(
        { error: "color_hex must be a hex color like #7A8C5E" },
        { status: 400 }
      );
    }

    const { count, error: countError } = await supabase
      .from("statuses")
      .select("id", { count: "exact", head: true })
      .eq("clerk_user_id", userId);

    if (countError) throw new Error(countError.message);

    if ((count ?? 0) >= MAX_STATUSES) {
      return Response.json(
        { error: `You can have at most ${MAX_STATUSES} statuses` },
        { status: 400 }
      );
    }

    // New statuses go to the end of the user's list
    const { data: last } = await supabase
      .from("statuses")
      .select("sort_order")
      .eq("clerk_user_id", userId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: status, error } = await supabase
      .from("statuses")
      .insert({
        clerk_user_id: userId,
        name,
        color_hex: body.color_hex,
        is_preset: false,
        is_hidden: false,
        sort_order: (last?.sort_order ?? -1) + 1,
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    return Response.json({ status }, { status: 201 });
  } catch (err) {
    console.error("POST /api/statuses error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
