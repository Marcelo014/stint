import { auth } from "@clerk/nextjs/server";
import { ensureProfile } from "@/lib/profile";
import { getSupabaseAdmin } from "@/lib/supabase";
import { APPLICATION_SELECT } from "@/lib/queries";
import { createApplication } from "@/lib/applications";

export const dynamic = "force-dynamic";

// GET /api/applications — fetch user's applications
export async function GET(request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureProfile(userId);
    const supabase = getSupabaseAdmin();

    const { searchParams } = new URL(request.url);
    const archived = searchParams.get("archived") === "true";
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const search = searchParams.get("search")?.trim() || "";
    const sort = searchParams.get("sort") || "updated_desc";

    let query = supabase
      .from("applications")
      .select(APPLICATION_SELECT, { count: "exact" })
      .eq("clerk_user_id", userId)
      .eq("is_archived", archived);

    if (search) {
      query = query.or(
        `company_name.ilike.%${search}%,job_title.ilike.%${search}%`
      );
    }

    switch (sort) {
      case "date_asc":
        query = query.order("date_applied", { ascending: true });
        break;
      case "date_desc":
        query = query.order("date_applied", { ascending: false });
        break;
      case "company_asc":
        query = query.order("company_name", { ascending: true });
        break;
      case "updated_desc":
      default:
        query = query.order("updated_at", { ascending: false });
        break;
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw new Error(error.message);

    return Response.json({ applications: data, total: count });
  } catch (err) {
    console.error("GET /api/applications error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/applications — create a new application card
export async function POST(request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureProfile(userId);
    const body = await request.json();

    // Shared with POST /api/extension/applications — see src/lib/applications.js
    const result = await createApplication({ userId, input: body });

    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    return Response.json({ application: result.application }, { status: 201 });
  } catch (err) {
    console.error("POST /api/applications error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
