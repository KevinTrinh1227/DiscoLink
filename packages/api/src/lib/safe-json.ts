/**
 * Safely parse a JSON string, returning a fallback value if parsing fails.
 * Prevents crashes from corrupted or malformed JSON data in the database.
 */
export function safeParseJson<T = unknown[]>(
  str: string | null | undefined,
  fallback: T = [] as unknown as T
): T {
  if (str === null || str === undefined) return fallback;
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}
