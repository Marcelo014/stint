import { auth } from "@clerk/nextjs/server";
import { ensureProfile } from "@/lib/profile";
import { getSupabaseAdmin } from "@/lib/supabase";
import { MAX_STATUSES } from "@/lib/statuses";

export const dynamic = "force-dynamic";

// POST /api/statuses/reorder — set sort_order from an ordered array of ids.
// A static segment, so it takes precedence over /api/statuses/[id].
export async function POST(request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureProfile(userId);
    const supabase = getSupabaseAdmin();
    const body = await request.json().catch(() => ({}));

    const ids = body.ids;

    if (!Array.isArray(ids) || ids.length === 0) {
      return Response.json(
        { error: "ids must be a non-empty array of status ids" },
        { status: 400 }
      );
    }

    if (ids.length > MAX_STATUSES) {
      return Response.json(
        { error: `Cannot reorder more than ${MAX_STATUSES} statuses` },
        { status: 400 }
      );
    }

    if (!ids.every((id) => typeof id === "string" && id.length > 0)) {
      return Response.json({ error: "ids must be strings" }, { status: 400 });
    }

    if (new Set(ids).size !== ids.length) {
      return Response.json({ error: "ids must be unique" }, { status: 400 });
    }

    // Every id has to be one of this user's statuses, or we'd be renumbering
    // rows that aren't theirs.
    const { data: owned, error: ownedError } = await supabase
      .from("statuses")
      .select("id")
      .eq("clerk_user_id", userId)
      .in("id", ids);

    if (ownedError) throw new Error(ownedError.message);

    if (!owned || owned.length !== ids.length) {
      return Response.json(
        { error: "One or more statuses do not exist" },
        { status: 400 }
      );
    }

    // Each status takes its index in the array as its new sort_order.
    const results = await Promise.all(
      ids.map((id, index) =>
        supabase
          .from("statuses")
          .update({ sort_order: index })
          .eq("id", id)
          .eq("clerk_user_id", userId)
      )
    );

    const failed = results.find((r) => r.error);
    if (failed) throw new Error(failed.error.message);

    const { data: statuses, error } = await supabase
      .from("statuses")
      .select("*")
      .eq("clerk_user_id", userId)
      .order("sort_order", { ascending: true });

    if (error) throw new Error(error.message);

    return Response.json({ statuses });
  } catch (err) {
    console.error("POST /api/statuses/reorder error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
