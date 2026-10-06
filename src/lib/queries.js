/**
 * Shared Supabase select strings.
 *
 * Note the shape: card_markers and interview_rounds are SIBLINGS of
 * statuses, not nested inside its parentheses. Nesting one silently
 * returns the wrong rows.
 */
export const APPLICATION_SELECT =
  "*, statuses(id, name, color_hex, is_preset, sort_order), card_markers(id, marker_type), interview_rounds(id, is_completed, scheduled_date)";
