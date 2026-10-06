import { auth } from "@clerk/nextjs/server";
import { ensureProfile } from "@/lib/profile";
import { getSupabaseAdmin } from "@/lib/supabase";
import { createApplication } from "@/lib/applications";

export const dynamic = "force-dynamic";

/** What the extension stamps on cards it creates, when it sends no source. */
const DEFAULT_SOURCE = "Extension";

/** The shape the extension needs back — never more than this. */
function summarize(application) {
  return {
    id: application.id,
    company_name: application.company_name,
    job_title: application.job_title,
  };
}

/**
 * Finds this user's existing card for a job URL, if any. Matches on the exact
 * stored string: normalising URLs (stripping query params, say) would be
 * guesswork, since for some boards the id lives in the query string.
 */
async function findByJobUrl({ supabase, userId, jobUrl }) {
  const { data, error } = await supabase
    .from("applications")
    .select("id, company_name, job_title")
    .eq("clerk_user_id", userId)
    .eq("job_url", jobUrl)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data || null;
}

/**
 * GET /api/extension/applications?job_url=... — duplicate check.
 *
 * The popup calls this on open so it can say "already saved" before the user
 * clicks anything, rather than after.
 */
export async function GET(request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureProfile(userId);
    const supabase = getSupabaseAdmin();

    const { searchParams } = new URL(request.url);
    const jobUrl = searchParams.get("job_url")?.trim();

    if (!jobUrl) {
      return Response.json({ error: "job_url is required" }, { status: 400 });
    }

    const existing = await findByJobUrl({ supabase, userId, jobUrl });

    return Response.json({ application: existing ? summarize(existing) : null });
  } catch (err) {
    console.error("GET /api/extension/applications error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/extension/applications — create a card from the browser extension.
 *
 * Auth is the same auth() as every other protected route: clerkMiddleware
 * reads the `Authorization: Bearer <session token>` header, so this needs no
 * extension-specific auth code. The extension gets that token from the user's
 * existing web session via Clerk's sync host.
 *
 * It's a separate route from POST /api/applications so the extension's payload
 * can be shaped and defaulted independently of the web form. The row itself is
 * created by the shared helper, so both produce identical cards.
 *
 * Returns 409 with the existing card when the job URL is already tracked,
 * unless the caller passes allow_duplicate — which the popup does once the
 * user has seen the warning and chosen to save anyway.
 */
export async function POST(request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureProfile(userId);
    const supabase = getSupabaseAdmin();
    const body = await request.json().catch(() => ({}));

    const jobUrl = body.job_url?.trim() || null;

    // Re-checked here and not only in the popup: the GET is advisory, and two
    // windows saving the same posting would otherwise both get through.
    if (jobUrl && body.allow_duplicate !== true) {
      const existing = await findByJobUrl({ supabase, userId, jobUrl });
      if (existing) {
        return Response.json(
          {
            error: "You've already saved this job",
            duplicate: true,
            application: summarize(existing),
          },
          { status: 409 }
        );
      }
    }

    const result = await createApplication({
      userId,
      input: { ...body, source: body.source?.trim() || DEFAULT_SOURCE },
    });

    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    return Response.json(
      { application: summarize(result.application) },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/extension/applications error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
