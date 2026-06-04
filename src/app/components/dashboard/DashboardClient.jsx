"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import CreateCardModal from "./CreateCardModal";
import ApplicationCard from "./ApplicationCard";

const LIMIT = 15;

const SORT_OPTIONS = [
  { value: "updated_desc", label: "Most recently updated" },
  { value: "date_desc", label: "Latest applied" },
  { value: "date_asc", label: "Earliest applied" },
  { value: "company_asc", label: "Company A–Z" },
  { value: "status_grouped", label: "Status grouped" },
];

function sortByStatus(apps) {
  return [...apps].sort((a, b) => {
    const aOrder = a.statuses?.sort_order ?? 999;
    const bOrder = b.statuses?.sort_order ?? 999;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return new Date(b.updated_at) - new Date(a.updated_at);
  });
}

export default function DashboardClient({ userName }) {
  const router = useRouter();
  const [applications, setApplications] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("updated_desc");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchApplications = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (sort && sort !== "status_grouped") params.set("sort", sort);
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
  }, [search, sort]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (sort && sort !== "status_grouped") params.set("sort", sort);
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

  const fetchStatuses = useCallback(async () => {
    try {
      const res = await fetch("/api/statuses");
      const data = await res.json();
      if (res.ok) setStatuses(data.statuses);
    } catch (err) {
      console.error("Failed to fetch statuses:", err);
    }
  }, []);

  useEffect(() => {
    fetchStatuses();
  }, [fetchStatuses]);

  useEffect(() => {
    setLoading(true);
    const timeout = setTimeout(fetchApplications, 200);
    return () => clearTimeout(timeout);
  }, [fetchApplications]);

  function handleCardCreated(newApp) {
    setApplications((prev) => {
      const updated = [newApp, ...prev];
      return sort === "status_grouped" ? sortByStatus(updated) : updated;
    });
    setTotal((prev) => prev + 1);
    setShowCreateModal(false);
  }

  async function handleStatusChange(appId, newStatusId) {
    setApplications((prev) => {
      const updated = prev.map((app) => {
        if (app.id !== appId) return app;
        const newStatus = statuses.find((s) => s.id === newStatusId);
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
    } catch {
      fetchApplications();
    }
  }

  function handleCardClick(appId) {
    router.push(`/applications/${appId}`);
  }

  const hasMore = applications.length < total;

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-bg px-6 py-8">
        <div className="mx-auto max-w-6xl">
          <header>
            <h1 className="text-2xl font-semibold tracking-tight text-text">
              Welcome back, {userName}
            </h1>
            <p className="mt-1 text-sm text-text-muted">
              {total} application{total !== 1 ? "s" : ""} tracked
            </p>
          </header>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search by company or job title..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-text placeholder-text-subtle outline-none transition focus:border-accent"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-subtle hover:text-text"
                >
                  ✕
                </button>
              )}
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-text outline-none transition focus:border-accent"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowCreateModal(true)}
              className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent-hover"
            >
              + New Card
            </button>
          </div>

          {loading ? (
            <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                {search ? "No applications match your search" : "No applications yet"}
              </p>
              <p className="mt-2 text-sm text-text-muted">
                {search
                  ? "Try a different search term"
                  : "Click + New Card to track your first application"}
              </p>
            </div>
          ) : sort === "status_grouped" ? (
            <StatusGroupedGrid
              applications={applications}
              statuses={statuses}
              onStatusChange={handleStatusChange}
              onCardClick={handleCardClick}
            />
          ) : (
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {applications.map((app) => (
                <ApplicationCard
                  key={app.id}
                  application={app}
                  statuses={statuses}
                  onStatusChange={handleStatusChange}
                  onClick={() => handleCardClick(app.id)}
                />
              ))}
            </div>
          )}

          {/* Load More */}
          {!loading && hasMore && (
            <div className="mt-8 text-center">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="rounded-lg border border-border bg-card px-6 py-2.5 text-sm font-medium text-text-muted transition hover:border-accent hover:text-text disabled:opacity-50"
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
      </main>
    </>
  );
}

function StatusGroupedGrid({ applications, statuses, onStatusChange, onCardClick }) {
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
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: group.status?.color_hex || "#9C9286" }}
            />
            <h2 className="text-sm font-semibold text-text">
              {group.status?.name || "No status"}
            </h2>
            <span className="text-xs text-text-subtle">({group.apps.length})</span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {group.apps.map((app) => (
              <ApplicationCard
                key={app.id}
                application={app}
                statuses={statuses}
                onStatusChange={onStatusChange}
                onClick={() => onCardClick(app.id)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}