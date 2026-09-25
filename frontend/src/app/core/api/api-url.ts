/**
 * API paths are relative to <base href>, so the app works at a domain root or under a
 * sub-path as long as the API is served alongside it (see README → Deployment).
 */
export const api = (path: string) => `api/${path.replace(/^\//, '')}`;

/** Query params without empty values, typed for HttpClient/httpResource. */
export function queryParams(values: Record<string, string | number | boolean | null | undefined>): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(values)) {
    if (value !== null && value !== undefined && value !== '') result[key] = value;
  }
  return result;
}
