import { auth, currentUser } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";

export default async function DashboardPage() {
  const { userId } = await auth();
  const user = await currentUser();

  return (
    <main className="min-h-screen px-8 py-16">
      <div className="mx-auto max-w-3xl">
        <header className="flex items-center justify-between">
          <p className="text-lg font-semibold tracking-tight text-text">
            Stint
          </p>
          <UserButton />
        </header>

        <section className="mt-16">
          <h1 className="text-3xl font-semibold tracking-tight text-text">
            Welcome,{" "}
            {user?.firstName || user?.emailAddresses[0]?.emailAddress || "friend"}
          </h1>
          <p className="mt-3 text-text-muted">
            You are signed in. Clerk user ID:{" "}
            <code className="rounded bg-card px-2 py-1 text-sm">{userId}</code>
          </p>
          <p className="mt-6 text-text-muted">
            This page is protected by the proxy middleware. Signed-out users get
            redirected to /sign-in. Real dashboard coming next.
          </p>
        </section>
      </div>
    </main>
  );
}