export default function Home() {
  return (
    <main className="min-h-screen px-8 py-16">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-5xl font-semibold tracking-tight text-text">
          Stint
        </h1>
        <p className="mt-3 text-lg text-text-muted">
          Design system smoke test — confirm the warm matte palette renders correctly.
        </p>

        {/* Color swatches */}
        <section className="mt-12">
          <h2 className="text-sm font-medium uppercase tracking-wide text-text-subtle">
            Palette
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Swatch name="bg" className="bg-bg border border-border" />
            <Swatch name="card" className="bg-card border border-border" />
            <Swatch name="border" className="bg-border" />
            <Swatch name="accent" className="bg-accent" />
            <Swatch name="accent-soft" className="bg-accent-soft" />
            <Swatch name="text" className="bg-text" />
            <Swatch name="text-muted" className="bg-text-muted" />
            <Swatch name="text-subtle" className="bg-text-subtle" />
          </div>
        </section>

        {/* Status dots */}
        <section className="mt-12">
          <h2 className="text-sm font-medium uppercase tracking-wide text-text-subtle">
            Status Dots
          </h2>
          <div className="mt-4 flex flex-wrap gap-6">
            <StatusDot color="bg-status-applied" label="Applied" />
            <StatusDot color="bg-status-oa" label="OA" />
            <StatusDot color="bg-status-phone" label="Phone Screen" />
            <StatusDot color="bg-status-interview" label="Interview" />
            <StatusDot color="bg-status-final" label="Final Round" />
            <StatusDot color="bg-status-offer" label="Offer" />
            <StatusDot color="bg-status-hired" label="Hired" />
            <StatusDot color="bg-status-rejected" label="Rejected" />
            <StatusDot color="bg-status-withdrawn" label="Withdrawn" />
            <StatusDot color="bg-status-ghosted" label="Ghosted" />
          </div>
        </section>

        {/* Sample card */}
        <section className="mt-12">
          <h2 className="text-sm font-medium uppercase tracking-wide text-text-subtle">
            Sample Card
          </h2>
          <div className="mt-4 max-w-sm rounded-lg border border-border bg-card p-5 transition hover:bg-card-hover">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-status-interview" />
              <p className="text-sm font-medium text-text">
                Anthropic · Software Engineer Intern
              </p>
            </div>
            <p className="mt-3 text-sm text-text-muted">Applied Jul 18, 2026</p>
            <p className="text-sm text-text-muted">Next interview Jul 24</p>
            <button className="mt-4 rounded-md bg-accent px-4 py-2 text-sm font-medium text-card transition hover:bg-accent-hover">
              View details
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

function Swatch({ name, className }) {
  return (
    <div className="flex flex-col gap-2">
      <div className={`h-16 rounded-md ${className}`} />
      <p className="text-xs text-text-subtle">{name}</p>
    </div>
  );
}

function StatusDot({ color, label }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-3 w-3 rounded-full ${color}`} />
      <span className="text-sm text-text">{label}</span>
    </div>
  );
}