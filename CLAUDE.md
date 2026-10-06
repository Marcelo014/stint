# Stint

A job application tracker for CS students. Users create application "cards",
set a status, flag them with markers, and edit details inline.

## Stack

- **Next.js 16** App Router, **plain JavaScript — no TypeScript**. Turbopack is
  the bundler; React Compiler is on (`reactCompiler: true` in `next.config.mjs`),
  so don't hand-add `useMemo`/`useCallback` for performance alone.
- **React 19**, **Clerk v7 (Core 3)** for auth, **Supabase** (service-role client)
  for data, **Tailwind v4**, framer-motion, resend.
- `@/*` maps to `./src/*` (`jsconfig.json`).

## Layout

```
src/proxy.js                      # Clerk middleware (route protection)
src/lib/supabase.js               # getSupabaseAdmin() — server-only
src/lib/profile.js                # ensureProfile() + PRESET_STATUSES seed
src/app/globals.css               # @theme design tokens + .dark overrides
src/app/page.js                   # landing (signed out) / dashboard (signed in)
src/app/applications/[id]/page.js # server-fetched detail page
src/app/settings/page.js
src/app/api/{applications,statuses,profile}/...
src/app/components/{dashboard,applications,settings}/
```

## Styling

- Tailwind v4 with **no config file**. All tokens live in the `@theme` block in
  `src/app/globals.css`; dark mode re-declares them under `.dark`.
- **Always use tokens** (`bg-bg`, `bg-card`, `border-border`, `text-text`,
  `text-text-muted`, `text-text-subtle`, `bg-accent`, `bg-accent-hover`,
  `bg-accent-soft`, `rounded-lg`, …). Never hardcode a color.
- The one exception: per-row status colors, which come from
  `statuses.color_hex` and are applied via `style={{ backgroundColor: ... }}`.
  The `--color-status-*` tokens exist for fixed UI accents (e.g. marker chips)
  and mirror the seeded preset hexes in `src/lib/profile.js`.

## Auth

- Clerk v7 Core 3: use **`Show`**, not `SignedIn`/`SignedOut`.
- Middleware lives at **`src/proxy.js`** (not `middleware.js`). Public routes:
  `/`, `/sign-in(.*)`, `/sign-up(.*)`, `/share(.*)`, `/api/share(.*)`.
  Everything else goes through `auth.protect()`.
- `getSupabaseAdmin()` is **server-only** — it uses the service-role key and
  bypasses RLS. Never import it from a client component.

## Next 16

Route params are async. Always `const { id } = await params;` — same for
`await auth()`.

## Protected API route pattern

```js
export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureProfile(userId);
    const supabase = getSupabaseAdmin();
    const { id } = await params;
    // ...query
  } catch (err) {
    console.error("GET /api/... error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

- `auth()` → 401 if no `userId`; then `ensureProfile(userId)`.
- **Filter every query by `clerk_user_id` plus the row id** — never trust an id
  alone. `.eq("id", id).eq("clerk_user_id", userId)`.
- Log the real error server-side; return a generic 500 to the client.
- PATCH routes use a **field allowlist** and return **400** when the body
  contains none of the allowed fields.
- Child tables (`card_markers`, `statuses`) carry a **denormalized
  `clerk_user_id`** so they can be filtered directly.

## Select-string gotcha

`card_markers` is a **sibling** of `statuses`, not nested inside its parens:

```js
.select("*, statuses(id, name, color_hex, is_preset, sort_order), card_markers(id, marker_type)")
```

## UI conventions

- **No `<form>` elements.** Submit via a `<button onClick={...}>`.
- Inline edit pattern (canonical example: `ApplicationDetail.jsx`):
  - Local state per field, seeded from the server row; `app` state holds the
    last-saved row.
  - **Auto-save on blur, only if the trimmed value actually changed.**
  - Empty strings become `null`.
  - **Selects save on change**, not on blur.
  - Write the PATCH response back into state (`setApp(data.application)`).
  - Show the transient `Saving...` / `✓ Saved` indicator (fades after ~2.5s).
- Destructive actions use a **two-step inline confirm** (not a modal), and
  **Escape cancels** it.

# Rules

- **One task at a time.** Give a short plan before implementing.
- After implementing: run `npm run lint`, then give me manual test steps and
  **STOP**. Don't commit yet.
- **Commit only after I confirm testing passed.** Sequence:
  1. `git status`
  2. `git add` with **specific files only — never `git add .`**
  3. `git status` again
  4. `git commit`
- Commit message: short subject line, blank line, then 2–3 sentences of context.
- **NEVER push.**
- **No new dependencies without asking.**
- **Don't touch `.env.local`.**
- Ask at most 2–3 questions, conversationally, and only when something is
  genuinely ambiguous.
- Shell is zsh.
