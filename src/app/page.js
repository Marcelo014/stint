import { Show, UserButton } from "@clerk/nextjs";
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen px-8 py-16">
      <div className="mx-auto max-w-3xl">
        {/* Top bar with auth state */}
        <header className="flex items-center justify-between">
          <p className="text-lg font-semibold tracking-tight text-text">
            Stint
          </p>
          <div className="flex items-center gap-3">
            <Show when="signed-out">
              <Link
                href="/sign-in"
                className="text-sm text-text-muted transition hover:text-text"
              >
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-card transition hover:bg-accent-hover"
              >
                Get started
              </Link>
            </Show>
            <Show when="signed-in">
              <Link
                href="/dashboard"
                className="text-sm text-text-muted transition hover:text-text"
              >
                Dashboard
              </Link>
              <UserButton />
            </Show>
          </div>
        </header>

        {/* Hero */}
        <section className="mt-24">
          <h1 className="text-5xl font-semibold tracking-tight text-text">
            Track every application.
            <br />
            Land the internship.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-text-muted">
            Stint is a clean, minimal tracker for the chaos of job hunting. Log
            applications, track interviews, and see your search at a glance.
            Built for CS students applying in Fall 2026.
          </p>

          <div className="mt-10 flex items-center gap-4">
            <Show when="signed-out">
              <Link
                href="/sign-up"
                className="rounded-md bg-accent px-6 py-3 text-base font-medium text-card transition hover:bg-accent-hover"
              >
                Get started — free
              </Link>
              <Link
                href="/sign-in"
                className="text-base text-text-muted transition hover:text-text"
              >
                Sign in →
              </Link>
            </Show>
            <Show when="signed-in">
              <Link
                href="/dashboard"
                className="rounded-md bg-accent px-6 py-3 text-base font-medium text-card transition hover:bg-accent-hover"
              >
                Go to dashboard →
              </Link>
            </Show>
          </div>
        </section>
      </div>
    </main>
  );
}