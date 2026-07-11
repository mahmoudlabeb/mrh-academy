/**
 * Central currency utility — single source of truth for the platform currency.
 *
 * Override via PLATFORM_CURRENCY env variable (default: 'usd').
 */

export const PLATFORM_CURRENCY: string =
  process.env.PLATFORM_CURRENCY?.toLowerCase() || 'usd';

/** Convert a dollar amount to the smallest currency unit (e.g. cents). */
export function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/** Format a cent amount back to a human-readable dollar string. */
export function formatAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}
