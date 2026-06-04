import { auth } from "@clerk/nextjs/server";
import { ensureProfile } from "@/lib/profile";
import { getSupabaseAdmin } from "@/lib/supabase";

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
      .select("*, statuses(id, name, color_hex, is_preset, sort_order), card_markers(id, marker_type)", { count: "exact" })
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
    const supabase = getSupabaseAdmin();
    const body = await request.json();

    const { company_name, job_title } = body;

    if (!company_name?.trim() || !job_title?.trim()) {
      return Response.json(
        { error: "Company name and job title are required" },
        { status: 400 }
      );
    }

    let statusId = body.status_id || null;
    if (!statusId) {
      const { data: appliedStatus } = await supabase
        .from("statuses")
        .select("id")
        .eq("clerk_user_id", userId)
        .eq("name", "Applied")
        .eq("is_preset", true)
        .single();

      statusId = appliedStatus?.id || null;
    }

    const { data: application, error } = await supabase
      .from("applications")
      .insert({
        clerk_user_id: userId,
        company_name: company_name.trim(),
        job_title: job_title.trim(),
        status_id: statusId,
        date_applied: body.date_applied || new Date().toISOString().split("T")[0],
        job_url: body.job_url?.trim() || null,
        deadline: body.deadline || null,
        salary: body.salary?.trim() || null,
        recruiter_name: body.recruiter_name?.trim() || null,
        recruiter_email: body.recruiter_email?.trim() || null,
        source: body.source?.trim() || null,
        notes: body.notes?.trim() || null,
      })
      .select("*, statuses(id, name, color_hex, is_preset, sort_order), card_markers(id, marker_type)")
      .single();

    if (error) throw new Error(error.message);

    return Response.json({ application }, { status: 201 });
  } catch (err) {
    console.error("POST /api/applications error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}