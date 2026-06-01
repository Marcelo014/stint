"use client";

import { useState, useEffect, useCallback } from "react";
import { UserButton } from "@clerk/nextjs";
import CreateCardModal from "./CreateCardModal";
import ApplicationCard from "./ApplicationCard";

export default function DashboardClient({ userName }) {
  const [applications, setApplications] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchApplications = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);

      const res = await fetch(`/api/applications?${params.toString()}`);
      const data = await res.json();

      if (res.ok) {
        setApplications(data.applications);
        setTotal(data.total);
      }
    } catch (err) {
      console.error("Failed to fetch applications:", err);
    } finally {
      setLoading(false);
    }
  }, [search]);

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
    setApplications((prev) => [newApp, ...prev]);
    setTotal((prev) => prev + 1);
    setShowCreateModal(false);
  }

  async function handleStatusChange(appId, newStatusId) {
    // Optimistic update
    setApplications((prev) =>
      prev.map((app) => {
        if (app.id !== appId) return app;
        const newStatus = statuses.find((s) => s.id === newStatusId);
        return { ...app, status_id: newStatusId, statuses: newStatus || app.statuses };
      })
    );

    try {
      const res = await fetch(`/api/applications/${appId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status_id: newStatusId }),
      });

      if (!res.ok) {
        // Revert on failure
        fetchApplications();
      }
    } catch {
      fetchApplications();
    }
  }

  return (
    <main className="min-h-screen bg-bg px-6 py-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-text">
              Welcome back, {userName}
            </h1>
            <p className="mt-1 text-sm text-text-muted">
              {total} application{total !== 1 ? "s" : ""} tracked
            </p>
          </div>
          <UserButton />
        </header>

        {/* Controls */}
        <div className="mt-8 flex items-center gap-4">
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
          <button
            onClick={() => setShowCreateModal(true)}
            className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent-hover"
          >
            + New Card
          </button>
        </div>

        {/* Card Grid */}
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
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {applications.map((app) => (
              <ApplicationCard
                key={app.id}
                application={app}
                statuses={statuses}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Card Modal */}
      {showCreateModal && (
        <CreateCardModal
          statuses={statuses}
          onClose={() => setShowCreateModal(false)}
          onCreated={handleCardCreated}
        />
      )}
    </main>
  );
}