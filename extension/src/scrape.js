/**
 * Page scraper.
 *
 * IMPORTANT: `scrapeJobPage` is serialized and injected into the page by
 * chrome.scripting.executeScript, so it must be entirely self-contained —
 * no imports, no references to anything in this module's scope. Every helper
 * lives inside it. That's why it's one long function rather than a tidy set
 * of exports.
 *
 * Strategy, in order:
 *   1. schema.org JobPosting JSON-LD — most boards embed it, and it's
 *      structured, so it gives salary and deadline too.
 *   2. Site-specific DOM extractors for LinkedIn, Greenhouse, Lever, Workday.
 *   3. Page title + URL, which always yields something.
 *
 * Every field except `job_url` may come back null; the popup shows only what
 * was found.
 */
export function scrapeJobPage() {
  const result = {
    company_name: null,
    job_title: null,
    job_url: window.location.href,
    salary: null,
    deadline: null,
    detected_by: "fallback",
  };

  const clean = (value) => {
    if (typeof value !== "string") return null;
    // Collapse the whitespace that DOM text extraction always drags in.
    const trimmed = value.replace(/\s+/g, " ").trim();
    return trimmed.length > 0 && trimmed.length <= 200 ? trimmed : null;
  };

  /** Greenhouse and friends render the company as "at Acme". */
  const stripLeadingAt = (value) =>
    typeof value === "string" ? value.replace(/^\s*at\s+/i, "") : value;

  const textOf = (selectors) => {
    for (const selector of selectors) {
      try {
        const el = document.querySelector(selector);
        const text = clean(el?.textContent);
        if (text) return text;
      } catch {
        // A selector unsupported by this browser shouldn't kill the scrape.
      }
    }
    return null;
  };

  /** "2026-10-14T00:00:00Z" or "2026-10-14" -> "2026-10-14" */
  const toDate = (value) => {
    if (typeof value !== "string") return null;
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (!match) return null;
    const parsed = new Date(`${match[1]}T00:00:00Z`);
    return Number.isNaN(parsed.getTime()) ? null : match[1];
  };

  // ---------------------------------------------------------------------
  // 1. schema.org JobPosting JSON-LD
  // ---------------------------------------------------------------------
  const formatSalary = (baseSalary) => {
    if (!baseSalary || typeof baseSalary !== "object") return null;

    const currencySymbols = { USD: "$", EUR: "€", GBP: "£", CAD: "C$", AUD: "A$" };
    const currency = baseSalary.currency || baseSalary.salaryCurrency || "";
    const symbol = currencySymbols[currency] || (currency ? `${currency} ` : "");

    const value = baseSalary.value;
    const amount = typeof value === "object" && value !== null ? value : baseSalary;

    const num = (v) => {
      const parsed = typeof v === "string" ? Number(v.replace(/[^0-9.]/g, "")) : v;
      return typeof parsed === "number" && Number.isFinite(parsed) && parsed > 0
        ? parsed
        : null;
    };

    const min = num(amount.minValue);
    const max = num(amount.maxValue);
    const single = num(amount.value);

    const unitLabels = {
      HOUR: "/hr", DAY: "/day", WEEK: "/wk", MONTH: "/mo", YEAR: "/yr",
    };
    const unit = unitLabels[String(amount.unitText || "").toUpperCase()] || "";
    // Keep cents on hourly rates (32.5 -> 32.50) but not on salaries.
    const fmt = (n) =>
      symbol +
      n.toLocaleString("en-US", {
        minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
        maximumFractionDigits: 2,
      });

    if (min && max) return `${fmt(min)} – ${fmt(max)}${unit}`;
    if (single) return `${fmt(single)}${unit}`;
    if (min) return `${fmt(min)}+${unit}`;
    return null;
  };

  const fromJsonLd = () => {
    const nodes = document.querySelectorAll('script[type="application/ld+json"]');

    for (const node of nodes) {
      let parsed;
      try {
        parsed = JSON.parse(node.textContent);
      } catch {
        continue; // malformed JSON-LD is common; just skip it
      }

      // A document can hold a single object, an array, or an @graph wrapper.
      const candidates = [];
      const push = (value) => {
        if (!value || typeof value !== "object") return;
        if (Array.isArray(value)) value.forEach(push);
        else {
          candidates.push(value);
          if (value["@graph"]) push(value["@graph"]);
        }
      };
      push(parsed);

      for (const candidate of candidates) {
        const type = candidate["@type"];
        const types = Array.isArray(type) ? type : [type];
        if (!types.includes("JobPosting")) continue;

        const org = candidate.hiringOrganization;
        const company =
          clean(typeof org === "string" ? org : org?.name) ||
          clean(candidate.hiringOrganizationName);

        return {
          company_name: company,
          job_title: clean(candidate.title),
          salary: formatSalary(candidate.baseSalary),
          deadline: toDate(candidate.validThrough),
        };
      }
    }
    return null;
  };

  // ---------------------------------------------------------------------
  // 2. Site-specific extractors
  // ---------------------------------------------------------------------
  const host = window.location.hostname;
  const pathParts = window.location.pathname.split("/").filter(Boolean);

  /** Turns a URL slug or tenant name into something presentable. */
  const humanize = (slug) =>
    clean(
      String(slug || "")
        .replace(/[-_]+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
    );

  const extractors = {
    linkedin: () => {
      if (!host.includes("linkedin.com")) return null;
      return {
        // Signed-in and signed-out LinkedIn render completely different DOMs.
        job_title: textOf([
          ".job-details-jobs-unified-top-card__job-title h1",
          ".job-details-jobs-unified-top-card__job-title",
          "h1.top-card-layout__title",
          ".topcard__title",
          "h1",
        ]),
        company_name: textOf([
          ".job-details-jobs-unified-top-card__company-name a",
          ".job-details-jobs-unified-top-card__company-name",
          ".topcard__org-name-link",
          ".top-card-layout__second-subline a",
        ]),
        salary: textOf([
          ".job-details-jobs-unified-top-card__job-insight span",
          ".compensation__salary",
        ]),
      };
    },

    greenhouse: () => {
      if (!host.includes("greenhouse.io")) return null;
      return {
        job_title: textOf([
          "h1.app-title",
          ".job__title h1",
          '[class*="job-title"]',
          "h1",
        ]),
        company_name:
          stripLeadingAt(
            textOf([".company-name", ".job__company", '[class*="company-name"]'])
          ) ||
          // boards.greenhouse.io/{company}/jobs/{id}
          humanize(pathParts[0]),
        salary: textOf(['[class*="pay-range"]', '[class*="compensation"]']),
      };
    },

    lever: () => {
      if (!host.includes("lever.co")) return null;
      return {
        job_title: textOf([".posting-headline h2", "h2", "h1"]),
        company_name:
          clean(document.querySelector(".main-header-logo img")?.alt) ||
          // jobs.lever.co/{company}/{id} — reliable even when the DOM shifts
          humanize(pathParts[0]),
        salary: textOf(['[class*="salary"]', ".posting-categories .commitment"]),
      };
    },

    workday: () => {
      if (!host.includes("myworkdayjobs.com") && !host.includes("workday.com")) {
        return null;
      }
      return {
        job_title: textOf([
          '[data-automation-id="jobPostingHeader"]',
          'h2[data-automation-id="jobPostingHeader"]',
          "h1",
        ]),
        company_name:
          textOf(['[data-automation-id="jobPostingCompany"]']) ||
          // {tenant}.wd1.myworkdayjobs.com
          humanize(host.split(".")[0]),
        salary: textOf(['[data-automation-id="payRange"]']),
      };
    },
  };

  // ---------------------------------------------------------------------
  // 3. Fallback — page title and URL
  // ---------------------------------------------------------------------
  const fromTitle = () => {
    const raw = clean(document.title);
    if (!raw) return null;

    // Titles are near-universally "Job Title - Company" or "Job Title | Company".
    const parts = raw.split(/\s+[-|–—·]\s+/);
    if (parts.length >= 2) {
      return {
        job_title: clean(parts[0]),
        company_name: clean(parts[parts.length - 1]),
      };
    }
    return { job_title: raw, company_name: null };
  };

  // ---------------------------------------------------------------------
  // Merge: JSON-LD wins, then the site extractor, then the title. Each layer
  // only fills gaps the layer above left empty.
  // ---------------------------------------------------------------------
  const apply = (data, label) => {
    if (!data) return false;
    let used = false;
    for (const key of ["company_name", "job_title", "salary", "deadline"]) {
      if (result[key] == null && data[key] != null) {
        result[key] = data[key];
        used = true;
      }
    }
    if (used && result.detected_by === "fallback") result.detected_by = label;
    return used;
  };

  try {
    apply(fromJsonLd(), "schema.org JobPosting");
  } catch {
    // Keep going — a broken JSON-LD block shouldn't lose the DOM extractors.
  }

  for (const [name, extractor] of Object.entries(extractors)) {
    try {
      if (apply(extractor(), name)) break;
    } catch {
      // Site DOMs change constantly; a failed extractor just falls through.
    }
  }

  try {
    apply(fromTitle(), "page title");
  } catch {
    // Nothing left to try.
  }

  return result;
}
