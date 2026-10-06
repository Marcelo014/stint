import { auth } from "@clerk/nextjs/server";
import { ensureProfile } from "@/lib/profile";
import StatsClient from "@/app/components/stats/StatsClient";

export const metadata = {
  title: "Stats — Stint",
};

export default async function StatsPage() {
  const { userId } = await auth();
  await ensureProfile(userId);
  return <StatsClient />;
}
