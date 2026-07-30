import { formatCurrency, formatPaymentMethod, formatWeekday } from "./format";

describe("formatPaymentMethod", () => {
  it.each([
    ["card", "بطاقة ائتمان", "Credit Card"],
    ["paypal", "PayPal", "PayPal"],
    ["vodafone", "فودافون كاش", "Vodafone Cash"],
    ["vodafone_cash", "فودافون كاش", "Vodafone Cash"],
    ["instapay", "إنستاباي", "Instapay"],
    ["binance", "باينانس", "Binance"],
    ["bank", "تحويل بنكي", "Bank Transfer"],
    ["bank_transfer", "تحويل بنكي", "Bank Transfer"],
    ["stripe_connect", "تحويل عبر Stripe", "Stripe Connect"],
  ])("localizes %s", (method, arabic, english) => {
    expect(formatPaymentMethod("ar", method)).toBe(arabic);
    expect(formatPaymentMethod("en", method)).toBe(english);
  });

  it("humanizes unknown values and handles missing values safely", () => {
    expect(formatPaymentMethod("en", "future_wallet")).toBe("Future Wallet");
    expect(formatPaymentMethod("ar", "future-wallet")).toBe("future wallet");
    expect(formatPaymentMethod("en", null)).toBe("—");
    expect(formatPaymentMethod("ar", "  ")).toBe("—");
  });
});

describe("formatCurrency", () => {
  it("preserves the original EGP currency on payment records", () => {
    expect(formatCurrency("en", 1500, 2, "EGP")).toContain("EGP");
    expect(formatCurrency("en", 1500, 2, "EGP")).toContain("1,500.00");
  });
});

describe("formatWeekday", () => {
  it("preserves the Sunday-based dayOfWeek contract in UTC", () => {
    expect(formatWeekday("en", 0, "long")).toBe("Sunday");
    expect(formatWeekday("en", 1, "long")).toBe("Monday");
    expect(formatWeekday("en", 6, "long")).toBe("Saturday");
    expect(formatWeekday("en", 7, "long")).toBe("Sunday");
  });
});
