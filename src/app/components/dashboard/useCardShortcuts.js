"use client";

import { useEffect } from "react";
import { hasModifier, isTypingTarget } from "@/lib/shortcuts";

/**
 * How many cards sit on a row, mirroring the grid's own breakpoints
 * (grid-cols-1 / sm:grid-cols-2 / lg:grid-cols-3). Up and Down move by this
 * much, so arrowing down lands on the card visually below rather than the next
 * one in the list.
 *
 * Read at keypress time rather than tracked in state: it's only ever needed
 * inside the handler, so there's no resize listener and no render to keep in
 * sync with the viewport.
 */
function readColumns() {
  if (window.matchMedia("(min-width: 1024px)").matches) return 3;
  if (window.matchMedia("(min-width: 640px)").matches) return 2;
  return 1;
}

/**
 * Dashboard keyboard shortcuts.
 *
 * Nothing fires while the user is typing, and nothing fires with a modifier
 * held — Cmd+F has to stay the browser's find, and Ctrl+N the browser's new
 * window. `enabled` goes false while a modal is open, so the keys behind it are
 * inert; each modal owns its own Escape.
 */
export default function useCardShortcuts({
  enabled,
  count,
  focusedIndex,
  onFocusIndex,
  onNew,
  onFocusSearch,
  onOpen,
  onStatus,
  onEscape,
}) {
  useEffect(() => {
    if (!enabled) return;

    function handleKey(event) {
      if (hasModifier(event)) return;
      if (isTypingTarget(event.target)) return;

      const { key } = event;

      if (key === "Escape") {
        onEscape?.();
        return;
      }

      if (key === "n" || key === "N") {
        event.preventDefault();
        onNew?.();
        return;
      }

      if (key === "f" || key === "F") {
        // Without this, the F also lands in the input we just focused.
        event.preventDefault();
        onFocusSearch?.();
        return;
      }

      if (key === "e" || key === "E") {
        if (focusedIndex < 0) return;
        event.preventDefault();
        onOpen?.(focusedIndex);
        return;
      }

      if (key === "s" || key === "S") {
        if (focusedIndex < 0) return;
        event.preventDefault();
        onStatus?.(focusedIndex);
        return;
      }

      const columns = readColumns();
      const step = {
        ArrowRight: 1,
        ArrowLeft: -1,
        ArrowDown: columns,
        ArrowUp: -columns,
      }[key];

      if (step === undefined) return;
      if (count === 0) return;

      // Arrow keys scroll the page by default, which fights the focus ring
      // moving under them.
      event.preventDefault();

      // Nothing focused yet: the first arrow press picks up the first card (or
      // the last, arrowing backwards).
      if (focusedIndex < 0) {
        onFocusIndex?.(step > 0 ? 0 : count - 1);
        return;
      }

      // Clamped, not wrapped: focus shouldn't jump across the grid when you
      // hold an arrow at the edge.
      const next = focusedIndex + step;
      if (next < 0 || next >= count) return;
      onFocusIndex?.(next);
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [
    enabled,
    count,
    focusedIndex,
    onFocusIndex,
    onNew,
    onFocusSearch,
    onOpen,
    onStatus,
    onEscape,
  ]);
}
