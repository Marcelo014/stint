"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import {
  LINK_LABEL_MAX,
  MAX_CUSTOM_LINKS,
  USERNAME_RULES,
  emptySocialLinks,
} from "@/lib/profileFields";

const FIELD_CLASS =
  "min-h-11 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder-text-subtle outline-none transition focus:border-accent";

export default function ProfileSection() {
  const { user, isLoaded: userLoaded } = useUser();

  const [profile, setProfile] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const savedTimeout = useRef(null);

  // Local state per field, seeded from the server row. `profile` always holds
  // the last-saved values, so a blur can tell whether anything changed.
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [github, setGithub] = useState("");
  const [customLinks, setCustomLinks] = useState([]);

  const [usernameError, setUsernameError] = useState("");
  const [linksError, setLinksError] = useState("");

  useEffect(() => {
    let cancelled = false;

    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (!d.profile) {
          setLoadFailed(true);
          return;
        }
        seed(d.profile);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });

    return () => {
      cancelled = true;
    };

    function seed(row) {
      const links = row.social_links || emptySocialLinks();
      setProfile(row);
      setDisplayName(row.display_name || "");
      setUsername(row.username || "");
      setLinkedin(links.linkedin || "");
      setGithub(links.github || "");
      setCustomLinks(links.custom || []);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (savedTimeout.current) clearTimeout(savedTimeout.current);
    };
  }, []);

  // Same transient Saving.../Saved indicator as the detail page.
  const withSaveIndicator = useCallback(async (request) => {
    setSaving(true);
    setShowSaved(false);
    if (savedTimeout.current) clearTimeout(savedTimeout.current);

    try {
      const ok = await request();
      if (ok !== false) {
        setShowSaved(true);
        savedTimeout.current = setTimeout(() => setShowSaved(false), 2500);
      }
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
  }, []);

  /**
   * @param {object} updates
   * @param {(message: string) => void} [onError] - shows a field-level message
   */
  const save = useCallback(
    (updates, onError) =>
      withSaveIndicator(async () => {
        const res = await fetch("/api/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          onError?.(data.error || "Could not save");
          return false;
        }

        // Write the response back, so normalised values (lowercased username,
        // https:// prefixed links) show up in the inputs.
        setProfile(data.profile);
        onError?.("");
        return data.profile;
      }),
    [withSaveIndicator]
  );

  function saveDisplayName() {
    const trimmed = displayName.trim();
    if (trimmed === (profile.display_name || "")) return;
    save({ display_name: trimmed || null });
  }

  async function saveUsername() {
    const trimmed = username.trim().toLowerCase();
    if (trimmed === (profile.username || "")) return;

    const result = await save({ username: trimmed || null }, setUsernameError);
    // Reflect the stored value; a rejected username stays in the box for
    // the user to fix rather than silently reverting.
    if (result) setUsername(result.username || "");
  }

  /**
   * A row the user is still filling in (no URL yet) must not be sent — the
   * server would reject or drop it. It's held back, and re-appended after the
   * response so an in-progress row never disappears from under the cursor.
   */
  async function saveLinks(next) {
    const drafts = (next.custom || []).filter((l) => !l.url?.trim());
    const payload = {
      ...next,
      custom: (next.custom || []).filter((l) => l.url?.trim()),
    };

    const result = await save({ social_links: payload }, setLinksError);
    if (result) {
      const links = result.social_links;
      setLinkedin(links.linkedin || "");
      setGithub(links.github || "");
      setCustomLinks([...(links.custom || []), ...drafts]);
    }
  }

  /** Links are validated as a whole object, so always send the full set. */
  function currentLinks(overrides = {}) {
    return {
      linkedin: linkedin.trim() || null,
      github: github.trim() || null,
      custom: customLinks,
      ...overrides,
    };
  }

  function saveSocialField(key, value) {
    const saved = profile.social_links || emptySocialLinks();
    if ((value.trim() || null) === (saved[key] || null)) return;
    saveLinks(currentLinks({ [key]: value.trim() || null }));
  }

  function updateCustomLink(index, patch) {
    setCustomLinks((prev) =>
      prev.map((link, i) => (i === index ? { ...link, ...patch } : link))
    );
  }

  function saveCustomLinks(links) {
    const saved = profile.social_links || emptySocialLinks();
    const complete = links.filter((l) => l.url?.trim());
    // Nothing committable changed — a label-only draft row isn't a change yet.
    if (JSON.stringify(complete) === JSON.stringify(saved.custom)) return;
    saveLinks(currentLinks({ custom: links }));
  }

  function addCustomLink() {
    if (customLinks.length >= MAX_CUSTOM_LINKS) return;
    setCustomLinks((prev) => [...prev, { label: "", url: "" }]);
    setLinksError("");
  }

  function removeCustomLink(index) {
    const next = customLinks.filter((_, i) => i !== index);
    setCustomLinks(next);
    // Dropping a draft row that was never stored needs no request.
    if (customLinks[index]?.url?.trim()) {
      saveLinks(currentLinks({ custom: next }));
    } else {
      setLinksError("");
    }
  }

  function toggleAvatar() {
    save({ hide_avatar: !profile.hide_avatar });
  }

  if (loadFailed) {
    return (
      <Shell>
        <p className="mt-4 text-sm text-text-muted">
          Couldn&apos;t load your profile. Try reloading the page.
        </p>
      </Shell>
    );
  }

  if (!profile) {
    return (
      <Shell>
        <div className="mt-4 space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-bg" />
          ))}
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      {/* Photo — always Clerk's image; nothing is uploaded or stored here. */}
      <div className="mt-5 flex items-center gap-4">
        <Avatar
          user={user}
          userLoaded={userLoaded}
          hidden={profile.hide_avatar}
          displayName={displayName}
        />
        <div className="min-w-0">
          <p className="text-sm font-medium text-text">Profile photo</p>
          <p className="mt-0.5 text-xs text-text-muted">
            Comes from your account photo. Change it in your account settings.
          </p>
          <button
            onClick={toggleAvatar}
            aria-pressed={!profile.hide_avatar}
            className="mt-1 min-h-11 text-xs font-medium text-accent transition hover:text-accent-hover"
          >
            {profile.hide_avatar ? "Show my photo" : "Hide my photo"}
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field label="Display name" htmlFor="display-name">
          <input
            id="display-name"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            onBlur={saveDisplayName}
            placeholder="How your name appears"
            maxLength={80}
            className={FIELD_CLASS}
          />
        </Field>

        <Field
          label="Username"
          htmlFor="username"
          hint={usernameError || USERNAME_RULES}
          hasError={Boolean(usernameError)}
        >
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-text-subtle">@</span>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setUsernameError("");
              }}
              onBlur={saveUsername}
              placeholder="yourname"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={30}
              aria-invalid={Boolean(usernameError)}
              className={FIELD_CLASS}
            />
          </div>
        </Field>
      </div>

      <div className="mt-6 border-t border-border pt-5">
        <h3 className="text-sm font-medium text-text">Links</h3>

        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label="LinkedIn" htmlFor="linkedin">
            <input
              id="linkedin"
              type="url"
              inputMode="url"
              value={linkedin}
              onChange={(e) => setLinkedin(e.target.value)}
              onBlur={() => saveSocialField("linkedin", linkedin)}
              placeholder="linkedin.com/in/yourname"
              className={FIELD_CLASS}
            />
          </Field>

          <Field label="GitHub" htmlFor="github">
            <input
              id="github"
              type="url"
              inputMode="url"
              value={github}
              onChange={(e) => setGithub(e.target.value)}
              onBlur={() => saveSocialField("github", github)}
              placeholder="github.com/yourname"
              className={FIELD_CLASS}
            />
          </Field>
        </div>

        {customLinks.length > 0 && (
          <div className="mt-4 space-y-2">
            {customLinks.map((link, i) => (
              <CustomLinkRow
                key={i}
                link={link}
                onChange={(patch) => updateCustomLink(i, patch)}
                onCommit={() =>
                  saveCustomLinks(
                    customLinks.map((l, j) => (j === i ? link : l))
                  )
                }
                onRemove={() => removeCustomLink(i)}
              />
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={addCustomLink}
            disabled={customLinks.length >= MAX_CUSTOM_LINKS}
            className="min-h-11 rounded-lg border border-border bg-bg px-3 text-xs font-medium text-text-muted transition hover:border-accent hover:text-text disabled:opacity-50"
          >
            + Add link
          </button>
          {customLinks.length >= MAX_CUSTOM_LINKS && (
            <span className="text-xs text-text-subtle">
              {MAX_CUSTOM_LINKS} links max
            </span>
          )}
        </div>

        {linksError && (
          <p className="mt-2 text-xs text-status-rejected">{linksError}</p>
        )}
      </div>

      <p
        className={`mt-5 text-sm text-accent transition-opacity duration-500 ${
          saving || showSaved ? "opacity-100" : "opacity-0"
        }`}
      >
        {saving ? "Saving..." : "✓ Saved"}
      </p>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <section className="mt-8 rounded-xl border border-border bg-card p-4 sm:p-6">
      <h2 className="text-lg font-semibold text-text">Profile</h2>
      <p className="mt-1 text-sm text-text-muted">
        Your name, username and links. Changes save as you go.
      </p>
      {children}
    </section>
  );
}

function Avatar({ user, userLoaded, hidden, displayName }) {
  const initial = (displayName || user?.firstName || "?").trim().charAt(0).toUpperCase();

  if (!userLoaded) {
    return <div className="h-16 w-16 shrink-0 animate-pulse rounded-full bg-bg" />;
  }

  if (hidden || !user?.hasImage) {
    return (
      <div
        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xl font-semibold text-text-muted"
        aria-hidden="true"
      >
        {initial}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- Clerk's CDN isn't in next.config remotePatterns
    <img
      src={user.imageUrl}
      alt="Your profile photo"
      width={64}
      height={64}
      className="h-16 w-16 shrink-0 rounded-full object-cover"
    />
  );
}

function Field({ label, htmlFor, hint, hasError, children }) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-xs font-medium text-text-muted"
      >
        {label}
      </label>
      {children}
      {hint && (
        <p
          className={`mt-1.5 text-xs ${
            hasError ? "text-status-rejected" : "text-text-subtle"
          }`}
        >
          {hint}
        </p>
      )}
    </div>
  );
}

function CustomLinkRow({ link, onChange, onCommit, onRemove }) {
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    if (!confirmRemove) return;
    function handleKey(e) {
      if (e.key === "Escape") setConfirmRemove(false);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [confirmRemove]);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-bg px-3 py-2">
      <input
        type="text"
        value={link.label}
        onChange={(e) => onChange({ label: e.target.value })}
        onBlur={onCommit}
        placeholder="Label"
        aria-label="Link label"
        maxLength={LINK_LABEL_MAX}
        className="min-h-9 w-24 shrink-0 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-text placeholder-text-subtle outline-none transition hover:border-border focus:border-accent sm:w-28"
      />
      <input
        type="url"
        inputMode="url"
        value={link.url}
        onChange={(e) => onChange({ url: e.target.value })}
        onBlur={onCommit}
        placeholder="https://example.com"
        aria-label="Link URL"
        className="min-h-9 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-text placeholder-text-subtle outline-none transition hover:border-border focus:border-accent"
      />
      {!confirmRemove ? (
        <button
          onClick={() => setConfirmRemove(true)}
          className="min-h-9 shrink-0 px-1 text-xs text-text-subtle transition hover:text-status-rejected"
        >
          Remove
        </button>
      ) : (
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-text-muted">Remove?</span>
          <button
            onClick={onRemove}
            className="rounded-md bg-status-rejected px-2.5 py-1 text-xs font-medium text-white transition hover:bg-status-rejected/80"
          >
            Yes
          </button>
          <button
            onClick={() => setConfirmRemove(false)}
            className="text-xs text-text-muted transition hover:text-text"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
