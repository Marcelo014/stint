import { auth, currentUser } from "@clerk/nextjs/server";
import { ensureProfile } from "@/lib/profile";
import DashboardClient from "@/app/components/dashboard/DashboardClient";

export default async function DashboardPage() {
  const { userId } = await auth();
  const user = await currentUser();

  // Ensure profile + preset statuses exist before rendering
  await ensureProfile(userId, {
    displayName: user?.firstName || null,
  });

  return (
    <DashboardClient
      userName={user?.firstName || user?.emailAddresses[0]?.emailAddress || "friend"}
    />
  );
}