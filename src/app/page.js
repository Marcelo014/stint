import { auth, currentUser } from "@clerk/nextjs/server";
import { ensureProfile } from "@/lib/profile";
import DashboardClient from "@/app/components/dashboard/DashboardClient";
import Link from "next/link";

export default async function HomePage() {
  const { userId } = await auth();

  if (userId) {
    const user = await currentUser();
    await ensureProfile(userId, {
      displayName: user?.firstName || null,
    });

    return (
      <DashboardClient
        userName={
          user?.firstName ||
          user?.emailAddresses[0]?.emailAddress ||
          "friend"
        }
      />
    );
  }

  return (
    <main className="min-h-screen bg-bg">
      <nav className="flex items-center justify-between px-6 py-4">
        <p className="text-lg font-semibold tracking-tight text-text">Stint</p>
        <div className="flex items-center gap-3">
          <Link
            href="/sign-in"
            className="text-sm font-medium text-text-muted transition hover:text-text"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-hover"
          >
            Get started
          </Link>
        </div>
      </nav>
      <div className="mx-auto max-w-2xl px-6 pt-32 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-text sm:text-5xl">
          Track every application.
          <br />
          Land the internship.
        </h1>
        <p className="mt-6 text-lg text-text-muted">
          A clean, free job application tracker built for CS students. Log
          applications, track statuses, and see your search at a glance.
        </p>
        <Link
          href="/sign-up"
          className="mt-8 inline-block rounded-lg bg-accent px-6 py-3 text-sm font-medium text-white transition hover:bg-accent-hover"
        >
          Start tracking — it&apos;s free
        </Link>
      </div>
    </main>
  );
}