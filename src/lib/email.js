import { Resend } from "resend";
import {
  APP_TIMEZONE,
  formatZonedDate,
  formatZonedDateTime,
  zonedDaysUntil,
} from "./datetime";

/**
 * Email sending and templates.
 *
 * NOTE ON STYLING: this is the one place in the app that hardcodes colors.
 * Email clients don't support CSS custom properties or external stylesheets,
 * so the @theme tokens can't reach here — every value below is copied from
 * the light palette in src/app/globals.css and must be kept in step with it.
 * Layout is table-based and styles are inline for the same reason.
 */
const PALETTE = {
  bg: "#f5efe6",
  card: "#fbf6ed",
  border: "#e5dccc",
  text: "#2c2a26",
  textMuted: "#6b6359",
  textSubtle: "#9c9286",
  accent: "#7a8c5e",
  interview: "#d97742",
  deadline: "#c25450",
  reminder: "#d4a72c",
  archived: "#9c9286",
};

/**
 * Until a domain is verified in Resend, this is the only address allowed to
 * send. Override with EMAIL_FROM once a domain is set up.
 */
const FROM_ADDRESS = process.env.EMAIL_FROM || "Stint <onboarding@resend.dev>";

let resendClient = null;

/** Lazy so a missing key breaks sending, not importing or building. */
function getResend() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not set");
  }
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

/** Absolute origin for deep links. Emails can't use relative URLs. */
export function getBaseUrl() {
  const raw = process.env.APP_BASE_URL;
  if (!raw) throw new Error("APP_BASE_URL is not set");
  return raw.replace(/\/$/, "");
}

export function applicationUrl(applicationId) {
  return `${getBaseUrl()}/applications/${applicationId}`;
}

/** Nothing user-supplied reaches an email template unescaped. */
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * "Mon, Oct 6" for a bare date (deadlines), rendered in APP_TIMEZONE.
 * interview_rounds.scheduled_date and reminders.remind_at are timestamptz, so
 * they go through formatDateTime instead — formatting those in UTC would show
 * the wrong day for an evening US-Eastern interview.
 */
export function formatDate(value) {
  return formatZonedDate(value, APP_TIMEZONE);
}

/** "Mon, Oct 6 at 2:30 PM" — for timestamptz values that carry a real time. */
export function formatDateTime(value) {
  return formatZonedDateTime(value, APP_TIMEZONE);
}

/** Whole calendar days from `today` to `value`; negative means overdue. */
export function daysUntil(value, today) {
  return zonedDaysUntil(value, today, APP_TIMEZONE);
}

/** "today" / "tomorrow" / "in 3 days" / "3 days ago" */
export function relativeDay(value, today) {
  const diff = daysUntil(value, today);
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff === -1) return "yesterday";
  if (diff > 1) return `in ${diff} days`;
  return `${Math.abs(diff)} days ago`;
}

function itemRow({ title, subtitle, meta, url, accent }) {
  return `
    <tr>
      <td style="padding:0 0 10px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
               style="background-color:${PALETTE.bg};border-radius:8px;border-left:3px solid ${accent};">
          <tr>
            <td style="padding:12px 14px;">
              <a href="${escapeHtml(url)}"
                 style="color:${PALETTE.text};font-size:15px;font-weight:600;text-decoration:none;">
                ${escapeHtml(title)}
              </a>
              <div style="color:${PALETTE.textMuted};font-size:13px;padding-top:3px;">
                ${escapeHtml(subtitle)}
              </div>
              <div style="color:${PALETTE.textSubtle};font-size:12px;padding-top:4px;">
                ${escapeHtml(meta)}
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

function section({ heading, items }) {
  if (items.length === 0) return "";
  return `
    <tr>
      <td style="padding:0 0 6px 0;">
        <div style="color:${PALETTE.text};font-size:13px;font-weight:700;
                    text-transform:uppercase;letter-spacing:0.06em;padding:14px 0 10px 0;">
          ${escapeHtml(heading)}
        </div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          ${items.map(itemRow).join("")}
        </table>
      </td>
    </tr>`;
}

/**
 * Builds the daily digest.
 *
 * @param {object} input
 * @param {string|null} input.name - display name, for the greeting
 * @param {string} input.today - "YYYY-MM-DD"
 * @param {object[]} input.interviews - { applicationId, company, jobTitle, roundType, date }
 * @param {object[]} input.deadlines - { applicationId, company, jobTitle, date }
 * @param {object[]} input.reminders - { applicationId, company, jobTitle, message, date }
 * @param {object[]} [input.archived] - { applicationId, company, jobTitle, lastActivity }
 * @returns {{ subject: string, html: string, text: string }}
 */
export function renderDigest({
  name,
  today,
  interviews,
  deadlines,
  reminders,
  archived = [],
}) {
  const counts = [];
  if (interviews.length) {
    counts.push(`${interviews.length} interview${interviews.length !== 1 ? "s" : ""}`);
  }
  if (deadlines.length) {
    counts.push(`${deadlines.length} deadline${deadlines.length !== 1 ? "s" : ""}`);
  }
  if (reminders.length) {
    counts.push(`${reminders.length} reminder${reminders.length !== 1 ? "s" : ""}`);
  }
  if (archived.length) {
    counts.push(`${archived.length} auto-archived`);
  }

  const subject = `Stint: ${counts.join(", ")}`;

  const body = [
    section({
      heading: "Upcoming interviews",
      items: interviews.map((item) => ({
        title: item.company,
        subtitle: `${item.roundType} · ${item.jobTitle}`,
        meta: `${formatDateTime(item.date)} — ${relativeDay(item.date, today)}`,
        url: applicationUrl(item.applicationId),
        accent: PALETTE.interview,
      })),
    }),
    section({
      heading: "Deadlines approaching",
      items: deadlines.map((item) => ({
        title: item.company,
        subtitle: item.jobTitle,
        meta: `Due ${formatDate(item.date)} — ${relativeDay(item.date, today)}`,
        url: applicationUrl(item.applicationId),
        accent: PALETTE.deadline,
      })),
    }),
    section({
      heading: "Your reminders",
      items: reminders.map((item) => ({
        title: item.company,
        subtitle: item.message || item.jobTitle,
        meta: `${formatDate(item.date)} — ${relativeDay(item.date, today)}`,
        url: applicationUrl(item.applicationId),
        accent: PALETTE.reminder,
      })),
    }),
    section({
      heading: "Auto-archived for you",
      items: archived.map((item) => ({
        title: item.company,
        subtitle: item.jobTitle,
        meta: `No activity since ${formatDate(item.lastActivity)} — restore it any time`,
        url: applicationUrl(item.applicationId),
        accent: PALETTE.archived,
      })),
    }),
  ].join("");

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:${PALETTE.bg};
             font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    ${escapeHtml(counts.join(", "))} waiting in Stint.
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background-color:${PALETTE.bg};padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
               style="max-width:560px;background-color:${PALETTE.card};
                      border:1px solid ${PALETTE.border};border-radius:12px;">
          <tr>
            <td style="padding:26px 24px 0 24px;">
              <div style="color:${PALETTE.accent};font-size:17px;font-weight:700;
                          letter-spacing:-0.01em;">Stint</div>
              <div style="color:${PALETTE.text};font-size:19px;font-weight:600;padding-top:14px;">
                ${name ? `Morning, ${escapeHtml(name)}` : "Here's your day"}
              </div>
              <div style="color:${PALETTE.textMuted};font-size:14px;padding-top:5px;">
                ${escapeHtml(counts.join(" · "))}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:4px 24px 0 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                ${body}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 24px 26px 24px;">
              <a href="${escapeHtml(getBaseUrl())}"
                 style="display:inline-block;background-color:${PALETTE.accent};color:#ffffff;
                        font-size:14px;font-weight:600;text-decoration:none;
                        padding:11px 20px;border-radius:8px;">
                Open Stint
              </a>
            </td>
          </tr>
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
               style="max-width:560px;">
          <tr>
            <td style="padding:16px 24px;text-align:center;">
              <div style="color:${PALETTE.textSubtle};font-size:12px;line-height:1.5;">
                You're getting this because email reminders are on in Stint.<br>
                <a href="${escapeHtml(getBaseUrl())}/settings"
                   style="color:${PALETTE.textMuted};text-decoration:underline;">
                  Manage notification settings
                </a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  // Plain-text alternative — some clients show it, and spam filters like it.
  const textLines = [`Stint — ${counts.join(", ")}`, ""];
  if (interviews.length) {
    textLines.push("UPCOMING INTERVIEWS");
    for (const i of interviews) {
      textLines.push(
        `- ${i.company} (${i.roundType}) ${formatDateTime(i.date)} — ${relativeDay(i.date, today)}`,
        `  ${applicationUrl(i.applicationId)}`
      );
    }
    textLines.push("");
  }
  if (deadlines.length) {
    textLines.push("DEADLINES APPROACHING");
    for (const d of deadlines) {
      textLines.push(
        `- ${d.company} — due ${formatDate(d.date)} (${relativeDay(d.date, today)})`,
        `  ${applicationUrl(d.applicationId)}`
      );
    }
    textLines.push("");
  }
  if (reminders.length) {
    textLines.push("YOUR REMINDERS");
    for (const r of reminders) {
      textLines.push(
        `- ${r.company}: ${r.message || r.jobTitle} (${relativeDay(r.date, today)})`,
        `  ${applicationUrl(r.applicationId)}`
      );
    }
    textLines.push("");
  }
  if (archived.length) {
    textLines.push("AUTO-ARCHIVED FOR YOU");
    for (const a of archived) {
      textLines.push(
        `- ${a.company} — ${a.jobTitle} (no activity since ${formatDate(a.lastActivity)})`,
        `  ${applicationUrl(a.applicationId)}`
      );
    }
    textLines.push("");
  }
  textLines.push(`Manage notifications: ${getBaseUrl()}/settings`);

  return { subject, html, text: textLines.join("\n") };
}

/**
 * Shorter email for the case where auto-archiving is the ONLY thing that
 * happened. A full digest framed around "here's your day" would be odd when
 * the only news is that some stale cards were tidied away.
 *
 * @param {object} input
 * @param {string|null} input.name
 * @param {object[]} input.archived - { applicationId, company, jobTitle, lastActivity }
 * @param {number} input.days - the user's threshold, for the explanation line
 * @returns {{ subject: string, html: string, text: string }}
 */
export function renderArchiveNotice({ name, archived, days }) {
  const count = archived.length;
  const noun = `application${count !== 1 ? "s" : ""}`;
  const subject = `Stint: ${count} ${noun} auto-archived`;

  const items = archived
    .map((item) =>
      itemRow({
        title: item.company,
        subtitle: item.jobTitle,
        meta: `No activity since ${formatDate(item.lastActivity)}`,
        url: applicationUrl(item.applicationId),
        accent: PALETTE.archived,
      })
    )
    .join("");

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:${PALETTE.bg};
             font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    ${count} stale ${noun} moved to your archive.
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background-color:${PALETTE.bg};padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
               style="max-width:560px;background-color:${PALETTE.card};
                      border:1px solid ${PALETTE.border};border-radius:12px;">
          <tr>
            <td style="padding:26px 24px 0 24px;">
              <div style="color:${PALETTE.accent};font-size:17px;font-weight:700;
                          letter-spacing:-0.01em;">Stint</div>
              <div style="color:${PALETTE.text};font-size:19px;font-weight:600;padding-top:14px;">
                ${name ? `${escapeHtml(name)}, I tidied up` : "I tidied up"}
              </div>
              <div style="color:${PALETTE.textMuted};font-size:14px;padding-top:5px;line-height:1.5;">
                ${count} ${noun} had no activity for ${days} days, so ${count !== 1 ? "they were" : "it was"}
                moved to your archive. Nothing was deleted — restore
                ${count !== 1 ? "them" : "it"} any time.
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px 0 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                ${items}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 24px 26px 24px;">
              <a href="${escapeHtml(getBaseUrl())}"
                 style="display:inline-block;background-color:${PALETTE.accent};color:#ffffff;
                        font-size:14px;font-weight:600;text-decoration:none;
                        padding:11px 20px;border-radius:8px;">
                Open Stint
              </a>
            </td>
          </tr>
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
               style="max-width:560px;">
          <tr>
            <td style="padding:16px 24px;text-align:center;">
              <div style="color:${PALETTE.textSubtle};font-size:12px;line-height:1.5;">
                You're getting this because auto-archive is on in Stint.<br>
                <a href="${escapeHtml(getBaseUrl())}/settings"
                   style="color:${PALETTE.textMuted};text-decoration:underline;">
                  Manage settings
                </a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `Stint — ${count} ${noun} auto-archived`,
    "",
    `${count} ${noun} had no activity for ${days} days and ${count !== 1 ? "were" : "was"} moved to your archive.`,
    "Nothing was deleted; you can restore from the Archived tab.",
    "",
    ...archived.flatMap((a) => [
      `- ${a.company} — ${a.jobTitle} (no activity since ${formatDate(a.lastActivity)})`,
      `  ${applicationUrl(a.applicationId)}`,
    ]),
    "",
    `Manage settings: ${getBaseUrl()}/settings`,
  ].join("\n");

  return { subject, html, text };
}

/**
 * Sends one email. Resolves false on failure rather than throwing, so one
 * bad address can't abort a digest run partway through.
 */
export async function sendEmail({ to, subject, html, text }) {
  try {
    const { error } = await getResend().emails.send({
      from: FROM_ADDRESS,
      to,
      subject,
      html,
      text,
    });

    if (error) {
      console.error("sendEmail failed:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("sendEmail error:", err);
    return false;
  }
}
