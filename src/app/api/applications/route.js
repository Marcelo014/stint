import { auth } from "@clerk/nextjs/server";
import { ensureProfile } from "@/lib/profile";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// GET /api/applications — fetch user's applications (non-archived by default)
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
    const limit = Math.min(parseInt(searchParams.get("limit") || "15", 10), 50);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const search = searchParams.get("search")?.trim() || "";

    let query = supabase
      .from("applications")
      .select("*, statuses(id, name, color_hex, is_preset, sort_order)", { count: "exact" })
      .eq("clerk_user_id", userId)
      .eq("is_archived", archived)
      .order("updated_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Search filters across company name and job title
    if (search) {
      query = query.or(
        `company_name.ilike.%${search}%,job_title.ilike.%${search}%`
      );
    }

    const { data, error, count } = await query;

    if (error) {
      throw new Error(error.message);
    }

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

    // Default to the user's "Applied" status
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
      .select("*, statuses(id, name, color_hex, is_preset, sort_order)")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return Response.json({ application }, { status: 201 });
  } catch (err) {
    console.error("POST /api/applications error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}