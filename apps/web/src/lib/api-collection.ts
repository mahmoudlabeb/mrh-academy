export type CollectionResponse<T> = T[] | { data?: T[]; items?: T[] };

export function normalizeCollection<T>(response: CollectionResponse<T>): T[] {
  if (Array.isArray(response)) return response;
  return response.data ?? response.items ?? [];
}
