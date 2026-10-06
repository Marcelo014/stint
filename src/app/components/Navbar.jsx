"use client";

import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

const LINKS = [
  { href: "/stats", label: "Stats" },
  { href: "/settings", label: "Settings" },
];

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-sm">
      {/* The two links are short enough to stay inline at 375px, so there's no
          hamburger to open — just tappable targets and tighter padding. */}
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2 sm:px-6 sm:py-3">
        <Link
          href="/"
          className="flex min-h-11 shrink-0 items-center text-lg font-semibold tracking-tight text-text transition hover:text-accent"
        >
          Stint
        </Link>
        <div className="flex items-center gap-1 sm:gap-2">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex min-h-11 items-center rounded-lg px-3 text-sm text-text-muted transition hover:bg-card-hover hover:text-text"
            >
              {link.label}
            </Link>
          ))}
          {/* Clerk's own button is 28px; the wrapper gives it a real target. */}
          <div className="ml-1 flex min-h-11 min-w-11 items-center justify-center">
            <UserButton />
          </div>
        </div>
      </div>
    </nav>
  );
}
