import { auth } from "@clerk/nextjs/server";
import { ensureProfile } from "@/lib/profile";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureProfile(userId);
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("statuses")
      .select("*")
      .eq("clerk_user_id", userId)
      .eq("is_hidden", false)
      .order("sort_order", { ascending: true });

    if (error) throw new Error(error.message);

    return Response.json({ statuses: data });
  } catch (err) {
    console.error("GET /api/statuses error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}