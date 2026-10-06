-- =============================================================================
-- Stint — combined migration for this session's features.
--
-- Run ONCE in the Supabase SQL editor. Safe to re-run: every statement is
-- idempotent (`if not exists`, guarded DO blocks, `drop trigger if exists`).
--
-- Written against the real schema, so it deliberately does NOT re-add:
--   profiles.username, profiles.social_links, profiles.profile_photo_url,
--   profiles.email_notifications_enabled, profiles.default_reminder_hours,
--   profiles.auto_archive_days, profiles.default_card_size,
--   profiles.dark_mode_preference, applications.card_size,
--   applications.is_archived/archived_at/archived_reason,
--   interview_rounds.updated_at, or the reminders table.
--
-- New CHECK constraints are added NOT VALID: they enforce every future write
-- without the migration failing on pre-existing rows that might not conform.
--
-- Sections:
--   1. profiles — new preference columns
--   2. profiles — username uniqueness + format
--   3. status_events — new table
--   4. reminders — indexes only (table already exists)
--   5. public_shares — new table
--   6. applications — auto-archive scan index
--   7. Offer preset recolour
--   8. status_events backfill
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. profiles — new preference columns
-- -----------------------------------------------------------------------------
-- hide_avatar: the profile photo always comes from Clerk's user.imageUrl
-- (nothing is uploaded or stored), so this only records whether to render it.
-- profiles.profile_photo_url is left untouched and unused by this feature.
--
-- The two lead times are per-kind and in DAYS. They don't reuse
-- default_reminder_hours because one hours column can't hold two independent
-- day-granularity settings; default_reminder_hours is left untouched.
alter table public.profiles
  add column if not exists hide_avatar             boolean not null default false,
  add column if not exists interview_reminder_days integer not null default 2,
  add column if not exists deadline_reminder_days  integer not null default 3;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_interview_reminder_days_range') then
    alter table public.profiles
      add constraint profiles_interview_reminder_days_range
      check (interview_reminder_days between 0 and 30) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'profiles_deadline_reminder_days_range') then
    alter table public.profiles
      add constraint profiles_deadline_reminder_days_range
      check (deadline_reminder_days between 0 and 30) not valid;
  end if;

  -- auto_archive_days already exists. NULL means auto-archive is off.
  if not exists (select 1 from pg_constraint where conname = 'profiles_auto_archive_days_range') then
    alter table public.profiles
      add constraint profiles_auto_archive_days_range
      check (auto_archive_days is null or auto_archive_days between 1 and 365) not valid;
  end if;
end $$;


-- -----------------------------------------------------------------------------
-- 2. profiles — username uniqueness + format
-- -----------------------------------------------------------------------------
-- Case-insensitive uniqueness. The API stores usernames already-lowercased;
-- the functional index also covers any pre-existing mixed-case rows. NULL
-- repeats freely, so a username stays optional.
--
-- NOTE: this is the one statement that can fail on existing data — it errors
-- if two profiles already hold the same username case-insensitively. See the
-- duplicate-finder query in the notes accompanying this migration.
create unique index if not exists profiles_username_lower_key
  on public.profiles (lower(username));

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_username_format') then
    alter table public.profiles
      add constraint profiles_username_format
      check (username is null or username ~ '^[a-z0-9][a-z0-9_-]{2,29}$') not valid;
  end if;
end $$;


-- -----------------------------------------------------------------------------
-- 3. status_events — new table
-- -----------------------------------------------------------------------------
-- Append-only log of every status a card has been on, including its initial
-- status at create time. Powers the stats that need history rather than
-- current state ("ever reached Offer", "ever left Applied").
--
-- clerk_user_id is denormalized off applications, same as card_markers,
-- statuses and interview_rounds, so stats queries can filter it directly.
-- No updated_at: rows are never edited, so no set_updated_at trigger.
create table if not exists public.status_events (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  clerk_user_id  text not null,
  -- Presets can only be hidden, never deleted, so Applied/Offer/Hired ids are
  -- stable. A deleted *custom* status nulls this out rather than deleting the
  -- event, which would silently rewrite a card's history.
  status_id      uuid references public.statuses (id) on delete set null,
  changed_at     timestamptz not null default now(),
  created_at     timestamptz not null default now()
);

-- Timeline reads: all events for one card, oldest first.
create index if not exists status_events_application_id_changed_at_idx
  on public.status_events (application_id, changed_at);

-- Stats reads: this user's whole log, bucketed by status.
create index if not exists status_events_clerk_user_id_status_id_idx
  on public.status_events (clerk_user_id, status_id);

-- Deny-all: RLS on, no policies. Reads and writes go through
-- getSupabaseAdmin() (service role, bypasses RLS).
alter table public.status_events enable row level security;

revoke all on public.status_events from anon, authenticated;


-- -----------------------------------------------------------------------------
-- 4. reminders — indexes only
-- -----------------------------------------------------------------------------
-- The table already exists with: id, application_id, clerk_user_id,
-- remind_at (timestamptz NOT NULL), reminder_type (text NOT NULL), message,
-- is_sent, sent_at, created_at. No columns are added here, and no
-- set_updated_at trigger — the table has no updated_at.
--
-- The detail page's list: every reminder on one application, soonest first.
create index if not exists reminders_application_id_remind_at_idx
  on public.reminders (application_id, remind_at);

-- The digest's only query: this user's unsent reminders that are now due.
create index if not exists reminders_due_idx
  on public.reminders (clerk_user_id, remind_at)
  where not is_sent;

alter table public.reminders enable row level security;

revoke all on public.reminders from anon, authenticated;


-- -----------------------------------------------------------------------------
-- 5. public_shares — new table
-- -----------------------------------------------------------------------------
-- One opt-in, per-user public stats card. clerk_user_id is UNIQUE, so a user
-- has exactly one share at a time: "regenerate" replaces share_id in place
-- (the old URL stops resolving immediately, no orphan rows), and "disable"
-- flips is_enabled without destroying the toggle choices.
--
-- share_id is generated in app code with node:crypto, never in SQL — there is
-- no default here on purpose, so a row can't be created without one.
create table if not exists public.public_shares (
  id            uuid primary key default gen_random_uuid(),
  -- Unguessable, URL-safe. crypto.randomBytes(16).toString("base64url") = 22
  -- chars, 128 bits of entropy. This is the only thing protecting the card,
  -- so the length floor is enforced here too.
  share_id      text not null unique,
  clerk_user_id text not null unique,

  -- Master switch. Disabling 404s the URL but keeps the toggles below.
  is_enabled    boolean not null default true,

  -- Per-field opt-in. The public API returns a field ONLY when its flag is
  -- true, so any field added later defaults to not-shared.
  show_total_sent        boolean not null default true,
  show_response_rate     boolean not null default true,
  show_active_interviews boolean not null default true,
  show_offers            boolean not null default true,
  show_rejection_count   boolean not null default false,

  -- Identity fields default OFF: sharing numbers shouldn't silently attach a
  -- face and a set of social profiles to them.
  show_photo             boolean not null default false,
  show_display_name      boolean not null default true,
  show_social_links      boolean not null default false,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint public_shares_share_id_format
    check (share_id ~ '^[A-Za-z0-9_-]{22,64}$')
);

-- The public route's only lookup: share_id + is_enabled.
create index if not exists public_shares_share_id_enabled_idx
  on public.public_shares (share_id)
  where is_enabled;

-- Reuses the existing set_updated_at() function, matching the
-- <table>_updated_at trigger convention already used by profiles, statuses,
-- applications and interview_rounds.
drop trigger if exists public_shares_updated_at on public.public_shares;

create trigger public_shares_updated_at
  before update on public.public_shares
  for each row
  execute function public.set_updated_at();

-- Deny-all. The public /api/share/[shareId] route reads this through
-- getSupabaseAdmin() and returns only the fields whose flags are true — the
-- anon role never touches the table, so it can never read the toggles or
-- anyone else's row.
alter table public.public_shares enable row level security;

revoke all on public.public_shares from anon, authenticated;


-- -----------------------------------------------------------------------------
-- 6. applications — auto-archive scan index
-- -----------------------------------------------------------------------------
-- The daily sweep scans a user's live applications by activity.
create index if not exists applications_auto_archive_scan_idx
  on public.applications (clerk_user_id, updated_at)
  where not is_archived;


-- -----------------------------------------------------------------------------
-- 7. Offer preset recolour
-- -----------------------------------------------------------------------------
-- The old Offer green (#7FB069) sat ΔE 6.0 from Hired (#5BA84A) at normal
-- vision — below the readable floor, and the two are adjacent in sort order.
-- Jade separates them to ΔE 10.8, and clears the colour-vision-deficiency
-- check that the old pair failed.
--
-- Scoped to rows still holding the exact old value, so a user who has
-- recoloured Offer themselves keeps their choice. Must stay in step with
-- PRESET_STATUSES in src/lib/profile.js and --color-status-offer in
-- src/app/globals.css.
update public.statuses
set color_hex = '#3E9E92'
where is_preset = true
  and name = 'Offer'
  and color_hex = '#7FB069';


-- -----------------------------------------------------------------------------
-- 8. status_events backfill
-- -----------------------------------------------------------------------------
-- Guarded by `where not exists` on each insert, so re-running is a no-op
-- rather than a duplicated history.

-- 8a. Every existing application gets an Applied event at date_applied.
--     date_applied is a date; midnight UTC is the best timestamp available.
--     Rows without one fall back to created_at.
insert into public.status_events (application_id, clerk_user_id, status_id, changed_at)
select
  a.id,
  a.clerk_user_id,
  applied.id,
  coalesce(a.date_applied::timestamptz, a.created_at)
from public.applications a
join public.statuses applied
  on applied.clerk_user_id = a.clerk_user_id
 and applied.name = 'Applied'
 and applied.is_preset = true
where not exists (
  select 1 from public.status_events e where e.application_id = a.id
);

-- 8b. Applications currently on a non-Applied status also get an event for
--     that status at updated_at, so the log ends where the card actually is.
insert into public.status_events (application_id, clerk_user_id, status_id, changed_at)
select
  a.id,
  a.clerk_user_id,
  a.status_id,
  a.updated_at
from public.applications a
join public.statuses s on s.id = a.status_id
where s.name <> 'Applied'
  and not exists (
    select 1
    from public.status_events e
    where e.application_id = a.id
      and e.status_id = a.status_id
  );
