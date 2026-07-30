import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const apiPath = path.resolve(root, process.argv[2] || "apps/api/.env");
const webPath = path.resolve(root, process.argv[3] || "apps/web/.env.local");

function readEnv(file) {
  if (!fs.existsSync(file)) return null;
  const values = {};
  for (const rawLine of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

const api = readEnv(apiPath);
const web = readEnv(webPath);
const failures = [];

if (!api) failures.push(`Missing API configuration: ${apiPath}`);
if (!web) failures.push(`Missing web configuration: ${webPath}`);

const placeholder = /^(|change_me|replace_me|your_|<.*>)|example\.com/i;
const present = (values, key) =>
  Boolean(values?.[key] && !placeholder.test(values[key].trim()));
const group = (label, values, keys, options = {}) => {
  const missing = keys.filter((key) => !present(values, key));
  const status = missing.length ? "MISSING" : "READY";
  console.log(`[${status}] ${label}`);
  if (missing.length) {
    console.log(`        Required: ${missing.join(", ")}`);
    if (!options.optional) failures.push(`${label}: ${missing.join(", ")}`);
  }
};

console.log("MRH Academy production configuration check\n");
group("Core API", api, [
  "FRONTEND_URL",
  "DATABASE_URL",
  "JWT_SECRET",
  "REDIS_URL",
  "ADMIN_EMAILS",
  "SUBADMIN_DEFAULT_PASSWORD",
  "REFERRAL_SECRET",
]);
if (api?.JWT_SECRET && api.JWT_SECRET.length < 64) {
  failures.push("Core API: JWT_SECRET must be at least 64 characters");
}
group("Web application", web, [
  "NEXT_PUBLIC_SITE_URL",
  "API_UPSTREAM_URL",
  "NEXT_PUBLIC_WS_URL",
]);
group("Google login", api, [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_CALLBACK_URL",
]);
group("Google Calendar / Meet", api, [
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
  "GOOGLE_CALENDAR_IMPERSONATE_EMAIL",
]);
group("Facebook login", api, [
  "FACEBOOK_APP_ID",
  "FACEBOOK_APP_SECRET",
  "FACEBOOK_CALLBACK_URL",
]);
group("Apple login", api, [
  "APPLE_CLIENT_ID",
  "APPLE_TEAM_ID",
  "APPLE_KEY_ID",
  "APPLE_PRIVATE_KEY",
  "APPLE_CALLBACK_URL",
]);
group("Cloudinary uploads", api, [
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
]);
group("Bunny video", api, [
  "BUNNY_API_KEY",
  "BUNNY_LIBRARY_ID",
  "BUNNY_CDN_HOSTNAME",
  "BUNNY_TOKEN_AUTH_KEY",
]);
group("Metered TURN", api, ["METERED_API_KEY", "METERED_APP_NAME"]);
group("Stripe payments", api, [
  "STRIPE_SECRET_KEY",
  "STRIPE_PUBLISHABLE_KEY",
  "STRIPE_WEBHOOK_SECRET",
]);
group("PayPal payments", api, [
  "PAYPAL_CLIENT_ID",
  "PAYPAL_CLIENT_SECRET",
  "PAYPAL_BASE_URL",
  "PAYPAL_WEBHOOK_ID",
]);
group("SMTP email", api, [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM",
]);

console.log(
  "\nExternal acceptance actions: configure Stripe and PayPal webhook endpoints, run sandbox payment/refund/dispute checks, verify the real inbox, configure the Bunny domain restriction, and run the two-device classroom test.",
);

if (failures.length) {
  console.error(`\nConfiguration is incomplete (${failures.length} issue(s)).`);
  process.exit(1);
}

console.log(
  "\nConfiguration is complete. Proceed with migrations and acceptance tests.",
);
