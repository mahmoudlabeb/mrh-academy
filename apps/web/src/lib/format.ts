export type SupportedLocale = "ar" | "en";

export function formatCurrency(
  locale: SupportedLocale,
  value: number,
  maximumFractionDigits = 2,
) {
  return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: maximumFractionDigits,
    maximumFractionDigits,
  }).format(Number(value));
}

export function formatWeekday(
  locale: SupportedLocale,
  dayOfWeek: number,
  width: "short" | "long" = "short",
) {
  const sunday = Date.UTC(2023, 0, 1);
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    weekday: width,
    timeZone: "UTC",
  }).format(new Date(sunday + dayOfWeek * 24 * 60 * 60 * 1000));
}
