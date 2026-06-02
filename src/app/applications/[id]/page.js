import { auth } from "@clerk/nextjs/server";
import { ensureProfile } from "@/lib/profile";
import { getSupabaseAdmin } from "@/lib/supabase";
import { notFound } from "next/navigation";
import ApplicationDetail from "@/app/components/applications/ApplicationDetail";

export default async function ApplicationPage({ params }) {
  const { userId } = await auth();
  const { id } = await params;

  await ensureProfile(userId);
  const supabase = getSupabaseAdmin();

  const { data: application, error: appError } = await supabase
    .from("applications")
    .select("*, statuses(id, name, color_hex, is_preset, sort_order)")
    .eq("id", id)
    .eq("clerk_user_id", userId)
    .single();

  if (appError || !application) notFound();

  const { data: statuses } = await supabase
    .from("statuses")
    .select("*")
    .eq("clerk_user_id", userId)
    .eq("is_hidden", false)
    .order("sort_order", { ascending: true });

  return <ApplicationDetail application={application} statuses={statuses || []} />;
}