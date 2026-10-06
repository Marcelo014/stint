import { auth } from "@clerk/nextjs/server";
import { ensureProfile } from "@/lib/profile";
import { getSupabaseAdmin } from "@/lib/supabase";
import { generateShareId } from "@/lib/share";
import { SHARE_OWNER_SELECT } from "@/lib/shareFields";

export const dynamic = "force-dynamic";

/**
 * POST /api/shares/regenerate — mint a new share_id, revoking the old URL.
 *
 * An in-place UPDATE, because clerk_user_id is unique: the moment this
 * returns, the previous link 404s and there's no orphan row left behind.
 */
export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureProfile(userId);
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("public_shares")
      .update({ share_id: generateShareId() })
      .eq("clerk_user_id", userId)
      .select(SHARE_OWNER_SELECT)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return Response.json({ error: "No share to regenerate" }, { status: 404 });
      }
      throw new Error(error.message);
    }

    return Response.json({ share: data });
  } catch (err) {
    console.error("POST /api/shares/regenerate error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
