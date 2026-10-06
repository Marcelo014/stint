"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import CreateCardModal from "./CreateCardModal";
import ApplicationCard from "./ApplicationCard";
import StatsSummary from "./StatsSummary";
import ShareModal from "./ShareModal";
import useCardShortcuts from "./useCardShortcuts";
import { resolveCardSize } from "@/lib/cardSize";
import { isHiredStatus } from "@/lib/statuses";

const LIMIT = 15;

const SORT_OPTIONS = [
  { value: "updated_desc", label: "Most recently updated" },
  { value: "date_desc", label: "Latest applied" },
  { value: "date_asc", label: "Earliest applied" },
  { value: "company_asc", label: "Company A–Z" },
  { value: "status_grouped", label: "Status grouped" },
];

/**
 * Mixed card sizes share one column grid: a large card is simply taller than
 * a small one. `items-start` is what keeps that clean — without it the grid
 * stretches every card in a row to the tallest one, so a single large card
 * would inflate its whole row.
 */
const GRID_CLASS =
  "grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3";

function sortByStatus(apps) {
  return [...apps].sort((a, b) => {
    const aOrder = a.statuses?.sort_order ?? 999;
    const bOrder = b.statuses?.sort_order ?? 999;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return new Date(b.updated_at) - new Date(a.updated_at);
  });
}

export default function DashboardClient({ userName, statuses, defaultCardSize }) {
  const router = useRouter();
  const [applications, setApplications] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("updated_desc");
  const [view, setView] = useState("active");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  // Bumped after any card mutation so StatsSummary refetches.
  const [statsKey, setStatsKey] = useState(0);

  // Keyboard focus is tracked by id, not index, so a card that moves (status
  // regroup, reorder after a save) keeps the ring.
  const [focusedId, setFocusedId] = useState(null);
  const [statusOpenId, setStatusOpenId] = useState(null);
  const [celebrateId, setCelebrateId] = useState(null);
  const searchRef = useRef(null);

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (sort && sort !== "status_grouped") params.set("sort", sort);
      if (view === "archived") params.set("archived", "true");
      params.set("limit", String(LIMIT));
      params.set("offset", "0");

      const res = await fetch(`/api/applications?${params.toString()}`);
      const data = await res.json();

      if (res.ok) {
        const apps =
          sort === "status_grouped"
            ? sortByStatus(data.applications)
            : data.applications;
        setApplications(apps);
        setTotal(data.total);
      }
    } catch (err) {
      console.error("Failed to fetch applications:", err);
    } finally {
      setLoading(false);
    }
  }, [search, sort, view]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (sort && sort !== "status_grouped") params.set("sort", sort);
      if (view === "archived") params.set("archived", "true");
      params.set("limit", String(LIMIT));
      params.set("offset", String(applications.length));

      const res = await fetch(`/api/applications?${params.toString()}`);
      const data = await res.json();

      if (res.ok) {
        setApplications((prev) => {
          const merged = [...prev, ...data.applications];
          return sort === "status_grouped" ? sortByStatus(merged) : merged;
        });
        setTotal(data.total);
      }
    } catch (err) {
      console.error("Failed to load more:", err);
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(fetchApplications, 200);
    return () => clearTimeout(timeout);
  }, [fetchApplications]);

  function handleCardCreated(newApp) {
    setApplications((prev) => {
      const updated = [newApp, ...prev];
      return sort === "status_grouped" ? sortByStatus(updated) : updated;
    });
    setTotal((prev) => prev + 1);
    setStatsKey((k) => k + 1);
    setShowCreateModal(false);
  }

  async function handleStatusChange(appId, newStatusId) {
    const current = applications.find((a) => a.id === appId);
    const newStatus = statuses.find((s) => s.id === newStatusId);

    // Only a real move TO Hired celebrates. Re-picking Hired on a card that is
    // already Hired changes nothing, so it stays quiet.
    if (isHiredStatus(newStatus) && current?.status_id !== newStatusId) {
      setCelebrateId(appId);
    }

    setApplications((prev) => {
      const updated = prev.map((app) => {
        if (app.id !== appId) return app;
        return { ...app, status_id: newStatusId, statuses: newStatus || app.statuses };
      });
      return sort === "status_grouped" ? sortByStatus(updated) : updated;
    });

    try {
      const res = await fetch(`/api/applications/${appId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status_id: newStatusId }),
      });
      if (!res.ok) fetchApplications();
      setStatsKey((k) => k + 1);
    } catch {
      fetchApplications();
    }
  }

  // A row that changes archived state leaves whichever view we're in, so
  // remove it locally and adjust the total rather than refetching the page.
  async function handleArchivedChange(appId, isArchived) {
    const previous = applications;
    setApplications((prev) => prev.filter((a) => a.id !== appId));
    setTotal((prev) => Math.max(0, prev - 1));

    try {
      const res = await fetch(`/api/applications/${appId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_archived: isArchived }),
      });
      if (!res.ok) {
        setApplications(previous);
        setTotal((prev) => prev + 1);
      } else {
        setStatsKey((k) => k + 1);
      }
    } catch {
      setApplications(previous);
      setTotal((prev) => prev + 1);
    }
  }

  function handleCardClick(appId) {
    router.push(`/applications/${appId}`);
  }

  const modalOpen = showCreateModal || showShareModal;
  const focusedIndex = focusedId
    ? applications.findIndex((a) => a.id === focusedId)
    : -1;

  useCardShortcuts({
    // Each modal owns its own Escape, so the grid's keys go quiet behind one.
    enabled: !modalOpen,
    count: applications.length,
    focusedIndex,
    onFocusIndex: (index) => {
      setFocusedId(applications[index]?.id ?? null);
      setStatusOpenId(null);
    },
    onNew: () => {
      if (view === "active") setShowCreateModal(true);
    },
    onFocusSearch: () => {
      searchRef.current?.focus();
      searchRef.current?.select();
    },
    onOpen: (index) => {
      const app = applications[index];
      if (app) handleCardClick(app.id);
    },
    onStatus: (index) => {
      const app = applications[index];
      if (app) setStatusOpenId(app.id);
    },
    onEscape: () => {
      // Innermost thing first: the open panel, then the focus ring itself.
      if (statusOpenId) setStatusOpenId(null);
      else setFocusedId(null);
    },
  });

  const cardProps = {
    statuses,
    onStatusChange: handleStatusChange,
    onArchivedChange: handleArchivedChange,
    defaultCardSize,
    focusedId,
    statusOpenId,
    celebrateId,
    onStatusOpen: setStatusOpenId,
    onCelebrationDone: () => setCelebrateId(null),
    onCardClick: handleCardClick,
  };

  const hasMore = applications.length < total;

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-bg px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-6xl">
          <header>
            <h1 className="text-xl font-semibold tracking-tight text-text sm:text-2xl">
              Welcome back, {userName}
            </h1>
            <p className="mt-1 text-sm text-text-muted">
              {total} {view === "archived" ? "archived" : "active"} application
              {total !== 1 ? "s" : ""}
            </p>
          </header>

          <StatsSummary refreshKey={statsKey} />

          <div className="mt-6 inline-flex rounded-lg border border-border bg-card p-1">
            {[
              { value: "active", label: "Active" },
              { value: "archived", label: "Archived" },
            ].map((tab) => (
              <button
                key={tab.value}
                onClick={() => setView(tab.value)}
                aria-pressed={view === tab.value}
                className={`min-h-11 rounded-md px-4 text-sm font-medium transition ${
                  view === tab.value
                    ? "bg-accent text-accent-fg"
                    : "text-text-muted hover:text-text"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:items-center">
            <div className="relative sm:flex-1">
              <input
                ref={searchRef}
                type="text"
                placeholder="Search by company or job title..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="min-h-11 w-full rounded-lg border border-border bg-card px-4 py-2.5 pr-10 text-sm text-text placeholder-text-subtle outline-none transition focus:border-accent"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                  className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center text-text-subtle hover:text-text"
                >
                  ✕
                </button>
              )}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                aria-label="Sort applications"
                className="min-h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-text outline-none transition focus:border-accent sm:w-auto"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  onClick={() => setShowShareModal(true)}
                  className="min-h-11 flex-1 rounded-lg border border-border bg-card px-4 text-sm font-medium text-text-muted transition hover:border-accent hover:text-text sm:flex-none"
                >
                  Share
                </button>
                {view === "active" && (
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="min-h-11 flex-1 whitespace-nowrap rounded-lg bg-accent px-5 text-sm font-medium text-accent-fg transition hover:bg-accent-hover sm:flex-none"
                  >
                    + New Card
                  </button>
                )}
              </div>
            </div>
          </div>

          {loading ? (
            <div className={`mt-8 ${GRID_CLASS}`}>
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="h-36 animate-pulse rounded-xl border border-border bg-card"
                />
              ))}
            </div>
          ) : applications.length === 0 ? (
            <div className="mt-20 text-center">
              <p className="text-lg font-medium text-text">
                {search
                  ? "No applications match your search"
                  : view === "archived"
                    ? "Nothing archived yet"
                    : "No applications yet"}
              </p>
              <p className="mt-2 text-sm text-text-muted">
                {search
                  ? "Try a different search term"
                  : view === "archived"
                    ? "Archived applications stay here until you restore them"
                    : "Press N or click + New Card to track your first application"}
              </p>
            </div>
          ) : sort === "status_grouped" ? (
            <StatusGroupedGrid applications={applications} {...cardProps} />
          ) : (
            <div className={`mt-8 ${GRID_CLASS}`}>
              {applications.map((app) => (
                <CardSlot key={app.id} application={app} {...cardProps} />
              ))}
            </div>
          )}

          {/* Load More */}
          {!loading && hasMore && (
            <div className="mt-8 text-center">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="min-h-11 rounded-lg border border-border bg-card px-6 text-sm font-medium text-text-muted transition hover:border-accent hover:text-text disabled:opacity-50"
              >
                {loadingMore
                  ? "Loading..."
                  : `Load more (${applications.length} of ${total})`}
              </button>
            </div>
          )}
        </div>

        {showCreateModal && (
          <CreateCardModal
            statuses={statuses}
            onClose={() => setShowCreateModal(false)}
            onCreated={handleCardCreated}
          />
        )}

        {showShareModal && (
          <ShareModal onClose={() => setShowShareModal(false)} />
        )}
      </main>
    </>
  );
}

/**
 * Binds one application to the shared per-card props. Keeping it in one place
 * means the flat grid and the grouped grid can't drift.
 */
function CardSlot({
  application,
  statuses,
  onStatusChange,
  onArchivedChange,
  defaultCardSize,
  focusedId,
  statusOpenId,
  celebrateId,
  onStatusOpen,
  onCelebrationDone,
  onCardClick,
}) {
  return (
    <ApplicationCard
      application={application}
      statuses={statuses}
      size={resolveCardSize(application.card_size, defaultCardSize)}
      isFocused={focusedId === application.id}
      statusOpen={statusOpenId === application.id}
      onStatusOpenChange={(open) => onStatusOpen(open ? application.id : null)}
      celebrate={celebrateId === application.id}
      onCelebrationDone={onCelebrationDone}
      onStatusChange={onStatusChange}
      onClick={() => onCardClick(application.id)}
      onArchivedChange={onArchivedChange}
    />
  );
}

function StatusGroupedGrid({ applications, ...cardProps }) {
  const groups = [];
  let currentOrder = null;
  let currentGroup = null;

  for (const app of applications) {
    const order = app.statuses?.sort_order ?? 999;
    if (order !== currentOrder) {
      currentGroup = { status: app.statuses, apps: [] };
      groups.push(currentGroup);
      currentOrder = order;
    }
    currentGroup.apps.push(app);
  }

  return (
    <div className="mt-8 space-y-8">
      {groups.map((group) => (
        <div key={group.status?.id || "none"}>
          <div className="mb-3 flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: group.status?.color_hex || "#9C9286" }}
            />
            <h2 className="text-sm font-semibold text-text">
              {group.status?.name || "No status"}
            </h2>
            <span className="text-xs text-text-subtle">({group.apps.length})</span>
          </div>
          <div className={GRID_CLASS}>
            {group.apps.map((app) => (
              <CardSlot key={app.id} application={app} {...cardProps} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
