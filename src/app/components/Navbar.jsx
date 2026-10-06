"use client";

import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight text-text transition hover:text-accent"
        >
          Stint
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/stats"
            className="text-sm text-text-muted transition hover:text-text"
          >
            Stats
          </Link>
          <Link
            href="/settings"
            className="text-sm text-text-muted transition hover:text-text"
          >
            Settings
          </Link>
          <UserButton />
        </div>
      </div>
    </nav>
  );
}