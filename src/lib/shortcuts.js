/**
 * Keyboard-shortcut rules.
 *
 * SHORTCUTS is the single source of truth: the Settings reference list is
 * rendered from it, so the list can't drift from what's actually bound.
 */

export const SHORTCUTS = [
  { keys: "N", description: "Create a new card" },
  { keys: "F", description: "Focus the search bar" },
  { keys: "↑ ↓ ← →", description: "Move focus between cards" },
  { keys: "E", description: "Open the focused card" },
  { keys: "S", description: "Change the focused card's status" },
  { keys: "Esc", description: "Close any modal or panel" },
];

/**
 * True when the event originated somewhere the user is typing, so a bare
 * letter must stay a letter. Covers inputs, textareas, selects, anything
 * contenteditable, and ARIA widgets that behave like text fields.
 */
export function isTypingTarget(target) {
  if (!target || typeof target !== "object") return false;

  const el = target.nodeType === 1 ? target : null;
  if (!el) return false;

  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;

  const role = el.getAttribute?.("role");
  if (role === "textbox" || role === "searchbox" || role === "combobox") {
    return true;
  }

  // A contenteditable region's children are editable without carrying the
  // attribute themselves, so walk up as a backstop.
  return el.closest?.("[contenteditable=''],[contenteditable='true']") != null;
}

/**
 * True when a modifier is held — those belong to the browser and the OS
 * (Cmd+F, Ctrl+N), and a single-letter shortcut must never shadow them.
 */
export function hasModifier(event) {
  return event.metaKey || event.ctrlKey || event.altKey;
}
