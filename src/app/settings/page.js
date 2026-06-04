import { auth } from "@clerk/nextjs/server";
import { ensureProfile } from "@/lib/profile";
import SettingsClient from "@/app/components/settings/SettingsClient";

export default async function SettingsPage() {
  const { userId } = await auth();
  await ensureProfile(userId);
  return <SettingsClient />;
}