export function getApiBaseUrl() {
  // Browser requests always use the same-origin Next rewrite.
  return "/api/v1";
}

export function getApiOriginUrl() {
  const configured = process.env.NEXT_PUBLIC_WS_URL;
  if (configured) return configured.replace(/\/+$/, "");
  return "http://localhost:4000";
}
