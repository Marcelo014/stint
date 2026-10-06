"use client";

import { useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

/**
 * A small poof of confetti around the status control, played once when a card
 * moves TO the Hired preset.
 *
 * Deliberately *not* driven by "is this card Hired" — that would fire on every
 * page load for every hired card. The parent flips `active` from inside its
 * status-change handler and only when the previous status wasn't Hired, so the
 * burst marks the transition, never the state.
 *
 * Renders absolutely over its parent, which must be positioned. It never takes
 * pointer events, so the status control underneath stays clickable mid-burst.
 */

const PARTICLE_COUNT = 12;

/** Celebratory but on-palette: the greens plus the two warm accents. */
const PARTICLE_COLORS = [
  "var(--color-status-hired)",
  "var(--color-status-offer)",
  "var(--color-accent)",
  "var(--color-status-applied)",
];

/** Even fan with a varied reach, so it reads as a burst, not a clock face. */
const PARTICLES = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
  const angle = (i / PARTICLE_COUNT) * Math.PI * 2;
  const distance = 26 + (i % 3) * 9;
  return {
    id: i,
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance,
    color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
    size: i % 2 === 0 ? 6 : 4,
  };
});

const BURST_SECONDS = 0.85;
const FADE_SECONDS = 1.2;

export default function HiredCelebration({ active, onDone }) {
  // null until measured, so treat only an explicit true as "reduce".
  const reduceMotion = useReducedMotion() === true;
  const lifetime = reduceMotion ? FADE_SECONDS : BURST_SECONDS;

  // The animation is fire-and-forget; the parent just needs to know when to
  // stop rendering it so a second Hired change can play again.
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => onDone?.(), lifetime * 1000 + 100);
    return () => clearTimeout(timer);
  }, [active, lifetime, onDone]);

  return (
    <>
      {/* Screen readers get the news in words rather than a silent animation. */}
      <span role="status" aria-live="polite" className="sr-only">
        {active ? "Hired — congratulations!" : ""}
      </span>

      <AnimatePresence>
        {active && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 z-20 h-0 w-0"
          >
            {reduceMotion ? (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-status-hired px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm"
              >
                Hired!
              </motion.span>
            ) : (
              <>
                {/* Ring: one quick expanding pulse behind the particles. */}
                <motion.span
                  initial={{ opacity: 0.5, scale: 0.2 }}
                  animate={{ opacity: 0, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.55, ease: "easeOut" }}
                  className="absolute -left-10 -top-10 h-20 w-20 rounded-full border-2 border-status-hired"
                />
                {PARTICLES.map((particle) => (
                  <motion.span
                    key={particle.id}
                    initial={{ opacity: 0, x: 0, y: 0, scale: 0.4 }}
                    animate={{
                      opacity: [0, 1, 1, 0],
                      x: particle.x,
                      // Slight extra drop at the end — gravity, not a sphere.
                      y: [0, particle.y, particle.y + 6],
                      scale: [0.4, 1, 0.9],
                    }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: BURST_SECONDS, ease: "easeOut" }}
                    style={{
                      backgroundColor: particle.color,
                      height: particle.size,
                      width: particle.size,
                    }}
                    className="absolute rounded-full"
                  />
                ))}
              </>
            )}
          </span>
        )}
      </AnimatePresence>
    </>
  );
}
