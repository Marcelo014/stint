-- =============================================================================
-- Stint — Tier 3 polish: theme preference and card sizes.
--
-- Run ONCE in the Supabase SQL editor, after 20261006000000_session_features.
-- Safe to re-run: every statement is idempotent or guarded.
--
-- Background: profiles.dark_mode_preference, profiles.default_card_size and
-- applications.card_size already exist in the live schema (the previous
-- migration lists them under "deliberately does NOT re-add"), but their types
-- and allowed values were never pinned down in version control. This migration
-- normalises all three to text with a value CHECK, so the app's validators and
-- the database agree on exactly three theme preferences and three card sizes.
--
-- Sections:
--   1. profiles.dark_mode_preference — normalise to text, default 'system'
--   2. profiles.default_card_size    — normalise to text, default 'medium'
--   3. applications.card_size        — normalise to text, NULL allowed
--   4. applications.card_size        — dashboard read index
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. profiles.dark_mode_preference
-- -----------------------------------------------------------------------------
-- Three values: 'light', 'dark', 'system'. NOT NULL with a 'system' default,
-- because "no preference recorded" and "follow the device" are the same thing
-- and a nullable column would make the app check for both.
--
-- The boolean branch covers the possibility that the column was originally
-- created as a simple on/off flag: true becomes 'dark', false becomes
-- 'system' (NOT 'light' — a user who never turned dark mode on has expressed
-- no preference, so they should follow their device).
do $$
declare
  col_type text;
begin
  select data_type into col_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'profiles'
    and column_name = 'dark_mode_preference';

  if col_type is null then
    alter table public.profiles
      add column dark_mode_preference text not null default 'system';

  elsif col_type = 'boolean' then
    alter table public.profiles
      alter column dark_mode_preference drop default;

    alter table public.profiles
      alter column dark_mode_preference type text
      using case when dark_mode_preference then 'dark' else 'system' end;

    alter table public.profiles
      alter column dark_mode_preference set default 'system';
  end if;

  -- Any stale or unrecognised value becomes 'system' before the CHECK lands,
  -- so the constraint can be validated rather than left NOT VALID.
  update public.profiles
  set dark_mode_preference = 'system'
  where dark_mode_preference is null
     or dark_mode_preference not in ('light', 'dark', 'system');

  alter table public.profiles
    alter column dark_mode_preference set default 'system';

  alter table public.profiles
    alter column dark_mode_preference set not null;

  if not exists (
    select 1 from pg_constraint where conname = 'profiles_dark_mode_preference_values'
  ) then
    alter table public.profiles
      add constraint profiles_dark_mode_preference_values
      check (dark_mode_preference in ('light', 'dark', 'system'));
  end if;
end $$;


-- -----------------------------------------------------------------------------
-- 2. profiles.default_card_size
-- -----------------------------------------------------------------------------
-- Three values: 'small', 'medium', 'large'. NOT NULL with a 'medium' default —
-- every profile has an effective default, so there's no "unset" state here.
-- Must stay in step with CARD_SIZES in src/lib/cardSize.js.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'default_card_size'
  ) then
    alter table public.profiles
      add column default_card_size text not null default 'medium';
  end if;

  update public.profiles
  set default_card_size = 'medium'
  where default_card_size is null
     or default_card_size not in ('small', 'medium', 'large');

  alter table public.profiles
    alter column default_card_size set default 'medium';

  alter table public.profiles
    alter column default_card_size set not null;

  if not exists (
    select 1 from pg_constraint where conname = 'profiles_default_card_size_values'
  ) then
    alter table public.profiles
      add constraint profiles_default_card_size_values
      check (default_card_size in ('small', 'medium', 'large'));
  end if;
end $$;


-- -----------------------------------------------------------------------------
-- 3. applications.card_size
-- -----------------------------------------------------------------------------
-- NULL is meaningful and is the default: it means "follow
-- profiles.default_card_size", so changing the profile default moves every
-- card that was never pinned. Only a non-NULL value is constrained.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'applications'
      and column_name = 'card_size'
  ) then
    alter table public.applications
      add column card_size text;
  end if;

  -- Anything outside the three sizes goes back to "follow the default" rather
  -- than being coerced into a size the user never chose.
  update public.applications
  set card_size = null
  where card_size is not null
    and card_size not in ('small', 'medium', 'large');

  if not exists (
    select 1 from pg_constraint where conname = 'applications_card_size_values'
  ) then
    alter table public.applications
      add constraint applications_card_size_values
      check (card_size is null or card_size in ('small', 'medium', 'large'));
  end if;
end $$;


-- -----------------------------------------------------------------------------
-- 4. applications.card_size — read index
-- -----------------------------------------------------------------------------
-- The dashboard only ever reads card_size as part of the row it already
-- selects, so there is nothing to index on it. This index instead covers the
-- partial-index gap the size feature exposed: the active-cards page is ordered
-- by updated_at, which section 6 of the previous migration already covers.
-- No new index is needed here — left as a note so the omission is deliberate
-- rather than forgotten.
