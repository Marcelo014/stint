import { auth } from "@clerk/nextjs/server";
import { ensureProfile } from "@/lib/profile";
import { getSupabaseAdmin } from "@/lib/supabase";
import { APPLICATION_SELECT } from "@/lib/queries";
import { notFound } from "next/navigation";
import ApplicationDetail from "@/app/components/applications/ApplicationDetail";

export default async function ApplicationPage({ params }) {
  const { userId } = await auth();
  const { id } = await params;

  await ensureProfile(userId);
  const supabase = getSupabaseAdmin();

  const { data: application, error: appError } = await supabase
    .from("applications")
    .select(APPLICATION_SELECT)
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

  const { data: rounds } = await supabase
    .from("interview_rounds")
    .select("*")
    .eq("application_id", id)
    .eq("clerk_user_id", userId)
    .order("sort_order", { ascending: true });

  return (
    <ApplicationDetail
      application={application}
      statuses={statuses || []}
      rounds={rounds || []}
    />
  );
}