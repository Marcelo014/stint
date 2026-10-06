/**
 * Shared frame for a /stats section: titled card with an optional caption
 * and a built-in empty slot.
 */
export default function Section({ title, caption, isEmpty, emptyText, children }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <header className="mb-4">
        <h2 className="text-sm font-semibold text-text">{title}</h2>
        {caption && <p className="mt-1 text-xs text-text-subtle">{caption}</p>}
      </header>
      {isEmpty ? (
        <p className="py-8 text-center text-sm text-text-muted">{emptyText}</p>
      ) : (
        children
      )}
    </section>
  );
}

/** Percentage of a 0–1 ratio, as a whole number with a % sign. */
export function formatPercent(ratio) {
  return `${Math.round(ratio * 100)}%`;
}
