import { createClerkClient } from "@clerk/chrome-extension/client";
import {
  API_BASE_URL,
  CLERK_PUBLISHABLE_KEY,
  CLERK_SYNC_HOST,
  SIGN_IN_URL,
} from "./config.js";
import { scrapeJobPage } from "./scrape.js";

/**
 * Popup entry point. Plain JS — no React, no framework.
 *
 * Auth is delegated entirely to the Stint web session: createClerkClient with
 * syncHost reads the session from the host's Clerk cookie (hence the "cookies"
 * permission) and mints a fresh token. There's no sign-in UI in here on
 * purpose — no session means we point at the website.
 *
 * Nothing runs until the icon is clicked: no content_scripts, no badge, no
 * background worker, no notifications.
 */

const el = (id) => document.getElementById(id);

const views = {
  loading: el("view-loading"),
  signedOut: el("view-signed-out"),
  form: el("view-form"),
  saved: el("view-saved"),
};

const fields = {
  company: el("f-company"),
  title: el("f-title"),
  salary: el("f-salary"),
  deadline: el("f-deadline"),
  status: el("f-status"),
  url: el("f-url"),
};

const statusEl = el("status");
const saveButton = el("save");
const duplicateBox = el("duplicate");
const duplicateLink = el("duplicate-link");

let clerk = null;
/** Set once a duplicate has been shown, so Save becomes "save anyway". */
let acknowledgedDuplicate = false;

function showView(name) {
  for (const [key, node] of Object.entries(views)) {
    node.hidden = key !== name;
  }
}

function setStatus(message, tone = "muted") {
  statusEl.textContent = message;
  statusEl.dataset.tone = tone;
}

function cardUrl(id) {
  return `${API_BASE_URL}/applications/${id}`;
}

/** Fresh token per request — they're short-lived by design. */
async function authHeaders() {
  const token = await clerk.session?.getToken();
  if (!token) return null;
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

/** Runs the scraper in the active tab. Requires activeTab, granted on click. */
async function scrapeActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return null;

  try {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scrapeJobPage,
    });
    return injection?.result ?? null;
  } catch (err) {
    // chrome:// pages, the Web Store, and PDFs can't be scripted.
    console.warn("Could not read the page:", err);
    return tab.url ? { job_url: tab.url, job_title: tab.title || null } : null;
  }
}

async function loadStatuses(headers) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/statuses`, { headers });
    if (!res.ok) return [];
    const data = await res.json();
    return data.statuses || [];
  } catch (err) {
    console.warn("Could not load statuses:", err);
    return [];
  }
}

async function checkDuplicate(headers, jobUrl) {
  if (!jobUrl) return null;
  try {
    const res = await fetch(
      `${API_BASE_URL}/api/extension/applications?job_url=${encodeURIComponent(jobUrl)}`,
      { headers }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.application || null;
  } catch (err) {
    console.warn("Duplicate check failed:", err);
    return null;
  }
}

function showDuplicate(application) {
  duplicateLink.href = cardUrl(application.id);
  duplicateBox.hidden = false;
  saveButton.textContent = "Save anyway";
  acknowledgedDuplicate = true;
}

async function init() {
  el("sign-in-link").href = SIGN_IN_URL;

  try {
    clerk = createClerkClient({
      publishableKey: CLERK_PUBLISHABLE_KEY,
      syncHost: CLERK_SYNC_HOST,
    });
    await clerk.load();
  } catch (err) {
    console.error("Clerk failed to load:", err);
    showView("signedOut");
    return;
  }

  if (!clerk.user) {
    showView("signedOut");
    return;
  }

  const headers = await authHeaders();
  if (!headers) {
    showView("signedOut");
    return;
  }

  // Scrape and fetch in parallel — the popup should feel instant.
  const [scraped, statuses] = await Promise.all([
    scrapeActiveTab(),
    loadStatuses(headers),
  ]);

  const data = scraped || { job_url: "" };

  fields.company.value = data.company_name || "";
  fields.title.value = data.job_title || "";
  fields.url.value = data.job_url || "";

  // Only fields that were actually detected get shown. Company, title and URL
  // are always present because they're what a card needs.
  if (data.salary) {
    fields.salary.value = data.salary;
    el("field-salary").hidden = false;
  }
  if (data.deadline) {
    fields.deadline.value = data.deadline;
    el("field-deadline").hidden = false;
  }

  if (data.detected_by) {
    const tag = el("detected-by");
    tag.textContent = `via ${data.detected_by}`;
    tag.hidden = false;
  }

  for (const status of statuses) {
    const option = document.createElement("option");
    option.value = status.id;
    option.textContent = status.name;
    fields.status.append(option);
  }
  if (statuses.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Applied (default)";
    fields.status.append(option);
  }

  showView("form");

  // Focus whichever required field needs a human, so saving is one keystroke
  // away when the scrape came up short.
  if (!fields.company.value) fields.company.focus();
  else if (!fields.title.value) fields.title.focus();

  const existing = await checkDuplicate(headers, data.job_url);
  if (existing) showDuplicate(existing);
}

async function save() {
  const company = fields.company.value.trim();
  const title = fields.title.value.trim();

  if (!company || !title) {
    setStatus("Company and job title are required.", "error");
    (company ? fields.title : fields.company).focus();
    return;
  }

  saveButton.disabled = true;
  setStatus("Saving...");

  try {
    const headers = await authHeaders();
    if (!headers) {
      showView("signedOut");
      return;
    }

    const res = await fetch(`${API_BASE_URL}/api/extension/applications`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        company_name: company,
        job_title: title,
        job_url: fields.url.value.trim() || null,
        salary: fields.salary.value.trim() || null,
        deadline: fields.deadline.value || null,
        status_id: fields.status.value || null,
        allow_duplicate: acknowledgedDuplicate,
      }),
    });

    const data = await res.json().catch(() => ({}));

    // The server re-checks, so a duplicate can still surface here.
    if (res.status === 409 && data.application) {
      showDuplicate(data.application);
      setStatus("Already saved — press again to save a second copy.", "error");
      return;
    }

    if (!res.ok) {
      setStatus(data.error || `Save failed (${res.status})`, "error");
      return;
    }

    el("saved-summary").textContent =
      `${data.application.company_name} — ${data.application.job_title}`;
    el("saved-link").href = cardUrl(data.application.id);
    showView("saved");
  } catch (err) {
    console.error("Save failed:", err);
    setStatus("Couldn't reach Stint. Is the dev server running?", "error");
  } finally {
    saveButton.disabled = false;
  }
}

saveButton.addEventListener("click", save);

// Enter saves from any text field — keeps it to two clicks, or none.
for (const input of [fields.company, fields.title, fields.salary, fields.url]) {
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") save();
  });
}

init();
