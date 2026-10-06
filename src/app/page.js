import { auth, currentUser } from "@clerk/nextjs/server";
import { ensureProfile } from "@/lib/profile";
import { getSupabaseAdmin } from "@/lib/supabase";
import DashboardClient from "@/app/components/dashboard/DashboardClient";
import Link from "next/link";

export default async function HomePage() {
  const { userId } = await auth();

  if (userId) {
    const user = await currentUser();
    // ensureProfile returns the row, so default_card_size comes along without
    // a second query.
    const profile = await ensureProfile(userId, {
      displayName: user?.firstName || null,
    });

    const supabase = getSupabaseAdmin();
    const { data: statuses } = await supabase
      .from("statuses")
      .select("*")
      .eq("clerk_user_id", userId)
      .eq("is_hidden", false)
      .order("sort_order", { ascending: true });

    return (
      <DashboardClient
        userName={
          user?.firstName ||
          user?.emailAddresses[0]?.emailAddress ||
          "friend"
        }
        statuses={statuses || []}
        defaultCardSize={profile?.default_card_size}
      />
    );
  }

  return (
    <main className="min-h-screen bg-bg">
      <nav className="flex items-center justify-between px-4 py-4 sm:px-6">
        <p className="text-lg font-semibold tracking-tight text-text">Stint</p>
        <div className="flex items-center gap-3">
          <Link
            href="/sign-in"
            className="flex min-h-11 items-center px-2 text-sm font-medium text-text-muted transition hover:text-text"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="flex min-h-11 items-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg transition hover:bg-accent-hover"
          >
            Get started
          </Link>
        </div>
      </nav>
      <div className="mx-auto max-w-2xl px-4 pt-20 text-center sm:px-6 sm:pt-32">
        <h1 className="text-3xl font-bold tracking-tight text-text sm:text-4xl md:text-5xl">
          Track every application.
          <br />
          Land the internship.
        </h1>
        <p className="mt-6 text-base text-text-muted sm:text-lg">
          A clean, free job application tracker built for CS students. Log
          applications, track statuses, and see your search at a glance.
        </p>
        <Link
          href="/sign-up"
          className="mt-8 inline-flex min-h-11 items-center rounded-lg bg-accent px-6 py-3 text-sm font-medium text-accent-fg transition hover:bg-accent-hover"
        >
          Start tracking — it&apos;s free
        </Link>
      </div>
    </main>
  );
}