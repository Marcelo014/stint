/**
 * Validation for the editable profile fields.
 *
 * Lives outside the route so the client can mirror the same rules for
 * instant feedback without the two drifting apart.
 */

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;

/** Lowercase, starts alphanumeric, then alphanumeric / underscore / hyphen. */
const USERNAME_PATTERN = /^[a-z0-9][a-z0-9_-]{2,29}$/;

/**
 * Names that would collide with a route if usernames ever appear at
 * /share/<username>, plus the obvious impersonation risks.
 */
const RESERVED_USERNAMES = new Set([
  "admin", "api", "applications", "settings", "share", "stats", "stint",
  "sign-in", "sign-up", "support", "help", "about", "new", "me", "root",
  "profile", "dashboard", "login", "logout", "static", "public",
]);

export const USERNAME_RULES =
  "3–30 characters: lowercase letters, numbers, hyphens and underscores, starting with a letter or number.";

/** Max custom links a profile can hold. */
export const MAX_CUSTOM_LINKS = 8;
export const LINK_LABEL_MAX = 40;
const URL_MAX = 500;

/**
 * @returns {{ ok: true, value: string|null } | { ok: false, error: string }}
 */
export function validateUsername(raw) {
  if (raw === null || raw === undefined || raw === "") {
    return { ok: true, value: null };
  }
  if (typeof raw !== "string") {
    return { ok: false, error: "Username must be text" };
  }

  const value = raw.trim().toLowerCase();
  if (value === "") return { ok: true, value: null };

  if (value.length < USERNAME_MIN || value.length > USERNAME_MAX) {
    return {
      ok: false,
      error: `Username must be ${USERNAME_MIN}–${USERNAME_MAX} characters`,
    };
  }
  if (!USERNAME_PATTERN.test(value)) {
    return { ok: false, error: USERNAME_RULES };
  }
  if (RESERVED_USERNAMES.has(value)) {
    return { ok: false, error: "That username is reserved" };
  }

  return { ok: true, value };
}

/**
 * Accepts a bare host ("github.com/x") by assuming https, but only ever
 * returns an http(s) URL — this value ends up in an href, so a
 * javascript: or data: scheme must never survive validation.
 *
 * @returns {{ ok: true, value: string|null } | { ok: false, error: string }}
 */
export function validateUrl(raw) {
  if (raw === null || raw === undefined || raw === "") {
    return { ok: true, value: null };
  }
  if (typeof raw !== "string") {
    return { ok: false, error: "Link must be text" };
  }

  const trimmed = raw.trim();
  if (trimmed === "") return { ok: true, value: null };
  if (trimmed.length > URL_MAX) {
    return { ok: false, error: "That link is too long" };
  }

  const candidate = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    return { ok: false, error: "That doesn't look like a valid link" };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: "Links must start with http:// or https://" };
  }
  if (!parsed.hostname.includes(".")) {
    return { ok: false, error: "That doesn't look like a valid link" };
  }

  return { ok: true, value: parsed.toString() };
}

/** The stored shape, with every key present. */
export function emptySocialLinks() {
  return { linkedin: null, github: null, custom: [] };
}

/**
 * Normalises whatever is in the column into the canonical shape, so the UI
 * never has to defend against a half-written blob.
 */
export function normalizeSocialLinks(value) {
  const base = emptySocialLinks();
  if (!value || typeof value !== "object" || Array.isArray(value)) return base;

  return {
    linkedin: typeof value.linkedin === "string" ? value.linkedin : null,
    github: typeof value.github === "string" ? value.github : null,
    custom: Array.isArray(value.custom)
      ? value.custom
          .filter((l) => l && typeof l.url === "string")
          .slice(0, MAX_CUSTOM_LINKS)
          .map((l) => ({
            label: typeof l.label === "string" ? l.label : "",
            url: l.url,
          }))
      : [],
  };
}

/**
 * Validates an incoming social_links payload in full — the client always
 * sends the whole object, so a partial write can't drop a sibling link.
 *
 * @returns {{ ok: true, value: object } | { ok: false, error: string }}
 */
export function validateSocialLinks(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "social_links must be an object" };
  }

  const linkedin = validateUrl(raw.linkedin);
  if (!linkedin.ok) return { ok: false, error: `LinkedIn: ${linkedin.error}` };

  const github = validateUrl(raw.github);
  if (!github.ok) return { ok: false, error: `GitHub: ${github.error}` };

  const customInput = raw.custom === undefined ? [] : raw.custom;
  if (!Array.isArray(customInput)) {
    return { ok: false, error: "Custom links must be a list" };
  }
  if (customInput.length > MAX_CUSTOM_LINKS) {
    return { ok: false, error: `At most ${MAX_CUSTOM_LINKS} custom links` };
  }

  const custom = [];
  for (const entry of customInput) {
    if (!entry || typeof entry !== "object") {
      return { ok: false, error: "Each custom link needs a label and a URL" };
    }

    const label = typeof entry.label === "string" ? entry.label.trim() : "";
    if (label.length > LINK_LABEL_MAX) {
      return {
        ok: false,
        error: `Link labels must be ${LINK_LABEL_MAX} characters or fewer`,
      };
    }

    const url = validateUrl(entry.url);
    if (!url.ok) {
      return { ok: false, error: `${label || "Custom link"}: ${url.error}` };
    }

    // A row with neither a label nor a URL is just an empty editor row the
    // user never filled in — drop it rather than erroring.
    if (!label && !url.value) continue;
    if (!url.value) {
      return { ok: false, error: `${label}: add a link or remove the row` };
    }

    custom.push({ label: label || url.value, url: url.value });
  }

  return {
    ok: true,
    value: { linkedin: linkedin.value, github: github.value, custom },
  };
}

/** display_name: optional, trimmed, capped. */
export function validateDisplayName(raw) {
  if (raw === null || raw === undefined || raw === "") {
    return { ok: true, value: null };
  }
  if (typeof raw !== "string") {
    return { ok: false, error: "Display name must be text" };
  }
  const value = raw.trim();
  if (value === "") return { ok: true, value: null };
  if (value.length > 80) {
    return { ok: false, error: "Display name must be 80 characters or fewer" };
  }
  return { ok: true, value };
}
