/** Parse a fetch Response as JSON when possible; otherwise return a readable error. */
export async function readJsonResponse<T extends Record<string, unknown>>(
  res: Response,
): Promise<T> {
  const text = await res.text();
  if (!text) {
    return {} as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      res.ok
        ? "Server returned an invalid response."
        : `Request failed (${res.status}). ${text.slice(0, 200)}`,
    );
  }
}
