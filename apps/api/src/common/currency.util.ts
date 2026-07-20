/**
 * Central currency utility — single source of truth for the platform currency.
 *
 * Currency selection belongs to the application configuration and is injected
 * into payment providers. This module only contains amount conversions.
 */

/** Convert a dollar amount to the smallest currency unit (e.g. cents). */
export function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/** Format a cent amount back to a human-readable dollar string. */
export function formatAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}
