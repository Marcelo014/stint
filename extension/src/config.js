/**
 * Stint extension configuration.
 *
 * Switching to production is a one-line change per constant below — nothing
 * else in the extension hardcodes a URL.
 */

/** Stint's origin. Production: "https://stint.yourdomain.com" */
export const API_BASE_URL = "http://localhost:3000";

/**
 * Clerk publishable key for this instance. Public by design (it ships in the
 * web app's client bundle too), so it's safe to keep here.
 * Copy the value of NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY from .env.local.
 */
export const CLERK_PUBLISHABLE_KEY = "pk_test_bWVldC1ib2JjYXQtNzUuY2xlcmsuYWNjb3VudHMuZGV2JA";

/**
 * The host whose Clerk session this extension piggybacks on — this is what
 * makes sign-in silent.
 *
 * Development: "http://localhost" (no port — Clerk matches on host).
 * Production:  your Clerk Frontend API origin, e.g. "https://clerk.yourdomain.com"
 */
export const CLERK_SYNC_HOST = "http://localhost";

/** Where to send someone who isn't signed in. */
export const SIGN_IN_URL = `${API_BASE_URL}/sign-in`;
