import { buildPublicShare } from "@/lib/publicShare";

export const dynamic = "force-dynamic";

/**
 * GET /api/share/[shareId] — the public stats card payload.
 *
 * Public by design (see src/proxy.js). It returns ONLY the fields whose
 * toggles are on, and 404s identically for unknown, malformed and disabled
 * share ids so the response can't be used to probe which ids exist.
 */
export async function GET(request, { params }) {
  try {
    const { shareId } = await params;

    const payload = await buildPublicShare(shareId);

    if (!payload) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    return Response.json(payload, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("GET /api/share/[shareId] error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
