"use client";

import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link
          href="/dashboard"
          className="text-lg font-semibold tracking-tight text-text transition hover:text-accent"
        >
          Stint
        </Link>
        <UserButton />
      </div>
    </nav>
  );
}