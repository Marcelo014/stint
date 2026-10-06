import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4 py-10 sm:py-12">
      {/* Clerk's card is width:100% of its box (appearance.elements.rootBox),
          so the cap lives here rather than inside Clerk's own styles. */}
      <div className="w-full max-w-[25rem]">
        <SignUp />
      </div>
    </main>
  );
}