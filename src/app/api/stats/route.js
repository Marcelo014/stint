import { auth } from "@clerk/nextjs/server";
import { ensureProfile } from "@/lib/profile";
import { getSupabaseAdmin } from "@/lib/supabase";
import { computeStats } from "@/lib/stats";

export const dynamic = "force-dynamic";

/**
 * Supabase caps an unbounded select at 1000 rows. Stats are wrong rather
 * than slow if they silently truncate, so ask for a high explicit ceiling
 * and log when we actually hit it.
 */
const ROW_CAP = 10000;

// GET /api/stats — derived numbers for the dashboard summary and /stats.
// ?view=summary returns only the summary block (the dashboard refetches it
// on every card change, and doesn't need the chart payloads).
export async function GET(request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureProfile(userId);
    const supabase = getSupabaseAdmin();

    const { searchParams } = new URL(request.url);
    const summaryOnly = searchParams.get("view") === "summary";

    const [appsResult, eventsResult, statusesResult] = await Promise.all([
      supabase
        .from("applications")
        .select(
          "id, company_name, job_title, status_id, date_applied, source, is_archived, interview_rounds(id, is_completed)"
        )
        .eq("clerk_user_id", userId)
        .limit(ROW_CAP),
      supabase
        .from("status_events")
        .select("application_id, status_id, changed_at")
        .eq("clerk_user_id", userId)
        .limit(ROW_CAP),
      supabase
        .from("statuses")
        .select("id, name, color_hex, sort_order")
        .eq("clerk_user_id", userId)
        .order("sort_order", { ascending: true }),
    ]);

    if (appsResult.error) throw new Error(appsResult.error.message);
    if (eventsResult.error) throw new Error(eventsResult.error.message);
    if (statusesResult.error) throw new Error(statusesResult.error.message);

    if (appsResult.data.length >= ROW_CAP || eventsResult.data.length >= ROW_CAP) {
      console.warn(
        `GET /api/stats: row cap hit for ${userId} — stats may be truncated`
      );
    }

    const stats = computeStats({
      applications: appsResult.data,
      events: eventsResult.data,
      statuses: statusesResult.data,
    });

    if (summaryOnly) {
      return Response.json({ summary: stats.summary });
    }

    return Response.json(stats);
  } catch (err) {
    console.error("GET /api/stats error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
