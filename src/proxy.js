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
 *   - /api/cron/* (no Clerk session on a cron request; the route checks
 *     Authorization: Bearer CRON_SECRET itself)
 *
 * Everything else is gated.
 *
 * Note the trailing slashes on the share matchers. "/api/share(.*)" would
 * also match /api/shares — the OWNER-facing endpoint that manages toggles and
 * regenerates the link — and silently make it public.
 */

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/share/(.*)",
  "/api/share/(.*)",
  "/api/cron(.*)",
]);

/**
 * Origins allowed to present a session token, checked against the token's
 * `azp` claim. Without this, a token minted for Stint could be replayed from
 * another origin on the same device.
 *
 * The chrome-extension origin is fixed by the "key" in extension/manifest.json,
 * which pins the extension ID across machines.
 */
const authorizedParties = [
  "http://localhost:3000",
  "chrome-extension://mlhnojpajbdffkbacbkcmbmjkccgjlfb",
];

export default clerkMiddleware(
  async (auth, req) => {
    if (!isPublicRoute(req)) {
      await auth.protect();
    }
  },
  { authorizedParties }
);

export const config = {
  matcher: [
    // Run on all routes except static files and Next.js internals
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run on API routes
    "/(api|trpc)(.*)",
  ],
};
