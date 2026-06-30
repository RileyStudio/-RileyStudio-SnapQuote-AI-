import { supabase } from './supabaseClient';

export const FOUNDER_SEAT_TOTAL = 10;

// Returns remaining Founder seats out of 10. If the RPC is missing or the
// table is empty, use the launch-safe default: 10 seats remaining. The
// webhook still performs an overflow guard at activation time.
export async function getFounderSeatsRemaining() {
  if (!supabase) return FOUNDER_SEAT_TOTAL;

  const { data, error } = await supabase.rpc('count_active_founder_subscribers');
  if (error || typeof data !== 'number' || !Number.isFinite(data)) return FOUNDER_SEAT_TOTAL;

  return Math.max(0, FOUNDER_SEAT_TOTAL - data);
}

export async function areFounderSeatsAvailable() {
  const remaining = await getFounderSeatsRemaining();
  return remaining > 0;
}

// ─────────────────────────────────────────────────────────
// DISPLAY-ONLY seat math for the Plans page.
//
// Fails OPEN: null / undefined / error / empty table all collapse to an
// active count of 0, so the page shows a friendly "10 of 10 Founder seats
// remaining" instead of a bare "—". This is safe HERE because it drives a
// label and a button's disabled state only — NOT the actual oversell
// prevention. The checkout route uses the same launch-safe default when the count cannot
// be reached, and the webhook's overflow guard parks an 11th racing payment
// for manual resolution. Display optimism, activation protection — on purpose.
//
// Returns { activeFounderCount, remainingFounderSeats, soldOut } so the
// page never has to special-case null.
export async function getFounderSeatDisplay() {
  let activeFounderCount = 0;

  if (supabase) {
    const { data, error } = await supabase.rpc('count_active_founder_subscribers');
    if (!error && typeof data === 'number' && Number.isFinite(data) && data > 0) {
      activeFounderCount = data;
    }
  }

  const remainingFounderSeats = Math.max(0, FOUNDER_SEAT_TOTAL - activeFounderCount);
  const soldOut = remainingFounderSeats <= 0;

  return { activeFounderCount, remainingFounderSeats, soldOut };
}
