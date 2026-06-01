import { auth } from "@clerk/nextjs/server";
import { ensureProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const profile = await ensureProfile(userId);
    return Response.json({ profile });
  } catch (err) {
    console.error("GET /api/profile error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}