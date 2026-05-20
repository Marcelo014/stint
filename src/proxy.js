import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * Route protection for Stint.
 *
 * Public routes are accessible without authentication. Everything else
 * requires a signed-in user — unauthenticated requests to API routes
 * return 401, and page requests redirect to /sign-in.
 *
 * Public routes:
 *   - / (marketing/landing page)
 *   - /sign-in/*, /sign-up/* (Clerk auth flows)
 *   - /share/* (public shareable stats cards)
 *   - /api/share/* (data for public stats cards)
 *
 * Everything else is gated.
 */

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/share(.*)",
  "/api/share(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Run on all routes except static files and Next.js internals
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run on API routes
    "/(api|trpc)(.*)",
  ],
};