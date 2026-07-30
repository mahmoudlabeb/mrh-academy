type SupportedLocale = "ar" | "en";

const paymentMethodLabels: Record<string, Record<SupportedLocale, string>> = {
  card: { ar: "بطاقة ائتمان", en: "Credit Card" },
  stripe: { ar: "بطاقة عبر Stripe", en: "Card via Stripe" },
  paypal: { ar: "PayPal", en: "PayPal" },
  vodafone: { ar: "فودافون كاش", en: "Vodafone Cash" },
  vodafone_cash: { ar: "فودافون كاش", en: "Vodafone Cash" },
  instapay: { ar: "إنستاباي", en: "Instapay" },
  binance: { ar: "باينانس", en: "Binance" },
  bank: { ar: "تحويل بنكي", en: "Bank Transfer" },
  bank_transfer: { ar: "تحويل بنكي", en: "Bank Transfer" },
  stripe_connect: { ar: "تحويل عبر Stripe", en: "Stripe Connect" },
};

export function formatPaymentMethod(
  locale: SupportedLocale,
  method: string | null | undefined,
) {
  const value = method?.trim();
  if (!value) return "—";

  const lookupKey = value.toLowerCase().replace(/[\s-]+/g, "_");
  const knownLabel = paymentMethodLabels[lookupKey];
  if (knownLabel) return knownLabel[locale];

  const humanized = value
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (locale === "ar") return humanized;

  return humanized
    .split(" ")
    .map((word) =>
      word === word.toLowerCase()
        ? word.charAt(0).toUpperCase() + word.slice(1)
        : word,
    )
    .join(" ");
}

export function formatCurrency(
  locale: SupportedLocale,
  value: number,
  maximumFractionDigits = 2,
  currency = "USD",
) {
  return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: maximumFractionDigits,
    maximumFractionDigits,
  }).format(Number(value));
}

export function formatWeekday(
  locale: SupportedLocale,
  dayOfWeek: number,
  width: "short" | "long" = "short",
) {
  const sunday = Date.UTC(1970, 0, 4);
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    weekday: width,
    timeZone: "UTC",
  }).format(new Date(sunday + dayOfWeek * 24 * 60 * 60 * 1000));
}
