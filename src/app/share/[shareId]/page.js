import { notFound } from "next/navigation";
import { buildPublicShare } from "@/lib/publicShare";

export const dynamic = "force-dynamic";

/**
 * Public, read-only stats card.
 *
 * Reads the database directly rather than fetching its own API, so the page
 * server-renders in one pass and generateMetadata can emit real OG tags.
 * Deliberately contains NO navigation into the app — no navbar, no links to
 * /applications, nothing that assumes a session.
 */

function formatPercent(ratio) {
  return `${Math.round(ratio * 100)}%`;
}

/** Only the stats that were actually shared, in a stable order. */
function statTiles(share) {
  const tiles = [];
  if (share.total_sent !== undefined) {
    tiles.push({ label: "Applications", value: share.total_sent });
  }
  if (share.active_interviews !== undefined) {
    tiles.push({ label: "In interviews", value: share.active_interviews });
  }
  if (share.offers !== undefined) {
    tiles.push({ label: "Offers", value: share.offers });
  }
  if (share.rejections !== undefined) {
    tiles.push({ label: "Rejections", value: share.rejections });
  }
  if (share.response_rate !== undefined) {
    tiles.push({ label: "Response rate", value: formatPercent(share.response_rate) });
  }
  return tiles;
}

export async function generateMetadata({ params }) {
  const { shareId } = await params;

  let share = null;
  try {
    share = await buildPublicShare(shareId);
  } catch {
    // Fall through to the generic metadata below.
  }

  if (!share) {
    return { title: "Stint", robots: { index: false, follow: false } };
  }

  const who = share.display_name ? `${share.display_name}'s` : "A";
  const title = `${who} job search — Stint`;

  const bits = [];
  if (share.total_sent !== undefined) bits.push(`${share.total_sent} applications`);
  if (share.active_interviews !== undefined) {
    bits.push(`${share.active_interviews} in interviews`);
  }
  if (share.offers !== undefined) bits.push(`${share.offers} offers`);
  if (share.response_rate !== undefined) {
    bits.push(`${formatPercent(share.response_rate)} response rate`);
  }

  const description =
    bits.length > 0
      ? `${bits.join(" · ")} — tracked with Stint.`
      : "A job search tracked with Stint.";

  return {
    title,
    description,
    // A share link is unlisted, not secret. Keeping it out of search indexes
    // is the whole point of an unguessable URL.
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      type: "profile",
      siteName: "Stint",
      ...(share.photo_url ? { images: [{ url: share.photo_url }] } : {}),
    },
    twitter: {
      card: "summary",
      title,
      description,
      ...(share.photo_url ? { images: [share.photo_url] } : {}),
    },
  };
}

export default async function SharePage({ params }) {
  const { shareId } = await params;

  const share = await buildPublicShare(shareId);

  // Unknown, malformed and disabled shares are indistinguishable from here.
  if (!share) notFound();

  const tiles = statTiles(share);

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4 py-10 sm:px-6 sm:py-12">
      <div className="w-full max-w-md">
        <div className="rounded-xl border border-border bg-card p-5 sm:p-7">
          <header className="flex items-center gap-4">
            {share.photo_url && (
              /* eslint-disable-next-line @next/next/no-img-element -- Clerk's CDN isn't in next.config remotePatterns */
              <img
                src={share.photo_url}
                alt=""
                width={56}
                height={56}
                className="h-14 w-14 shrink-0 rounded-full object-cover"
              />
            )}
            <div className="min-w-0">
              {share.display_name && (
                <p className="truncate text-lg font-semibold text-text">
                  {share.display_name}
                </p>
              )}
              <p className="text-sm text-text-muted">Job search snapshot</p>
            </div>
          </header>

          {tiles.length > 0 && (
            <dl className="mt-6 grid grid-cols-2 gap-3 sm:gap-4">
              {tiles.map((tile) => (
                <div
                  key={tile.label}
                  className="rounded-lg bg-bg px-3 py-3 sm:px-4"
                >
                  <dt className="text-xs text-text-subtle">{tile.label}</dt>
                  <dd className="mt-0.5 text-2xl font-semibold tabular-nums text-text">
                    {tile.value}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          {share.social_links && share.social_links.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-5">
              {share.social_links.map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="flex min-h-11 items-center rounded-lg border border-border bg-bg px-3 text-xs font-medium text-text-muted transition hover:border-accent hover:text-text"
                >
                  {link.label}
                </a>
              ))}
            </div>
          )}

          {tiles.length === 0 && !share.social_links && (
            <p className="mt-6 text-sm text-text-muted">
              Nothing has been shared on this card.
            </p>
          )}
        </div>

        {/* Attribution only — deliberately not a link into the app. */}
        <p className="mt-4 text-center text-xs text-text-subtle">
          Tracked with Stint
        </p>
      </div>
    </main>
  );
}
