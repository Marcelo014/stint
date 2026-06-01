import { getSupabaseAdmin } from "./supabase";

/**
 * Preset statuses seeded on first profile creation.
 * Hex values match the @theme block in globals.css exactly.
 */
const PRESET_STATUSES = [
  { sort_order: 0, name: "Applied", color_hex: "#D4A72C" },
  { sort_order: 1, name: "OA", color_hex: "#4A90C2" },
  { sort_order: 2, name: "Phone Screen", color_hex: "#6BB0D6" },
  { sort_order: 3, name: "Interview", color_hex: "#D97742" },
  { sort_order: 4, name: "Final Round", color_hex: "#8B6CB0" },
  { sort_order: 5, name: "Offer", color_hex: "#7FB069" },
  { sort_order: 6, name: "Hired", color_hex: "#5BA84A" },
  { sort_order: 7, name: "Rejected", color_hex: "#C25450" },
  { sort_order: 8, name: "Withdrawn", color_hex: "#9C9286" },
  { sort_order: 9, name: "Ghosted", color_hex: "#6B6359" },
];

/**
 * Ensures a Supabase profile row exists for the given Clerk user.
 * If the profile already exists, returns it immediately.
 * If not, creates the profile and seeds all 10 preset statuses.
 *
 * Race-safe: plain INSERT catches unique_violation (23505) and
 * re-fetches instead of crashing on concurrent first-access calls.
 *
 * Call this at the top of every protected API route before doing
 * any database work.
 *
 * @param {string} userId - Clerk user ID (e.g. "user_2x...")
 * @param {object} [opts] - Optional display_name to set on first creation
 * @param {string} [opts.displayName]
 * @returns {Promise<object>} The profile row
 */
export async function ensureProfile(userId, opts = {}) {
  const supabase = getSupabaseAdmin();

  // Check if profile already exists
  const { data: existing, error: fetchError } = await supabase
    .from("profiles")
    .select("*")
    .eq("clerk_user_id", userId)
    .single();

  if (fetchError && fetchError.code !== "PGRST116") {
    // PGRST116 = "no rows returned" — expected for new users
    throw new Error(`Failed to fetch profile: ${fetchError.message}`);
  }

  if (existing) return existing;

  // Profile doesn't exist — create it
  const { data: newProfile, error: insertError } = await supabase
    .from("profiles")
    .insert({
      clerk_user_id: userId,
      display_name: opts.displayName || null,
    })
    .select()
    .single();

  if (insertError) {
    // 23505 = unique_violation — another call created the profile
    // between our SELECT and INSERT. Just re-fetch.
    if (insertError.code === "23505") {
      const { data: raceProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("clerk_user_id", userId)
        .single();
      return raceProfile;
    }
    throw new Error(`Failed to create profile: ${insertError.message}`);
  }

  // Seed preset statuses for the new user
  const statusRows = PRESET_STATUSES.map((s) => ({
    clerk_user_id: userId,
    name: s.name,
    color_hex: s.color_hex,
    is_preset: true,
    is_hidden: false,
    sort_order: s.sort_order,
  }));

  const { error: statusError } = await supabase
    .from("statuses")
    .insert(statusRows);

  if (statusError) {
    throw new Error(`Failed to seed preset statuses: ${statusError.message}`);
  }

  return newProfile;
}