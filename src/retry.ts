/**
 * GET helper with retry/backoff for the TIDAL API.
 * Retries when the call returns no data and no JSON error (empty body, typically HTTP 429/5xx),
 * or when the HTTP status is 429 or >= 500. Client errors (4xx with a body) are returned as is.
 */
export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function getWithRetry(
  client: any,
  path: string,
  options: any,
  maxRetries = 4,
  baseDelayMs = 600,
): Promise<{ data?: any; error?: any; response?: any }> {
  let last: { data?: any; error?: any; response?: any } = {};
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      last = await client.GET(path as any, options);
    } catch (e: any) {
      last = { error: { message: String(e?.message ?? e) } };
    }
    const status: number | undefined = last.response?.status;
    if (last.data && !last.error) return last;
    const retryable = status === 429 || (status !== undefined && status >= 500) || (!last.error && !last.data);
    if (!retryable || attempt === maxRetries) return last;
    const retryAfter = Number(last.response?.headers?.get?.('retry-after'));
    const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 10000) : baseDelayMs * 2 ** attempt;
    await sleep(wait);
  }
  return last;
}
