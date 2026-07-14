export function getApiBaseUrl() {
  // Use relative path through Next.js rewrite proxy to avoid direct connection failures
  const configured = process.env.NEXT_PUBLIC_API_URL;
  if (configured && !configured.startsWith('http://localhost')) {
    return configured.replace(/\/+$/, '');
  }
  return '/api/v1';
}

export function getApiOriginUrl() {
  return getApiBaseUrl().replace(/\/api\/v1$/, '');
}
