export function getApiBaseUrl() {
  // Browser requests always use the same-origin Next rewrite.
  return "/api/v1";
}

export function getServerApiBaseUrl() {
  const configured = process.env.API_UPSTREAM_URL;
  if (configured) {
    const normalized = configured.replace(/\/+$/, "");
    return normalized.endsWith("/api/v1") ? normalized : `${normalized}/api/v1`;
  }
  return "http://localhost:4000/api/v1";
}

export function getApiOriginUrl() {
  const configured = process.env.NEXT_PUBLIC_WS_URL;
  if (configured) return configured.replace(/\/+$/, "");
  return "http://localhost:4000";
}
