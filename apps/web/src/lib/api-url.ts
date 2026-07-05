export function getApiBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
  return configured.replace(/\/+$/, '');
}

export function getApiOriginUrl() {
  return getApiBaseUrl().replace(/\/api\/v1$/, '');
}
