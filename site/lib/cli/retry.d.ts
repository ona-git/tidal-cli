/**
 * GET helper with retry/backoff for the TIDAL API.
 * Retries when the call returns no data and no JSON error (empty body, typically HTTP 429/5xx),
 * or when the HTTP status is 429 or >= 500. Client errors (4xx with a body) are returned as is.
 */
export declare const sleep: (ms: number) => Promise<void>;
export declare function getWithRetry(client: any, path: string, options: any, maxRetries?: number, baseDelayMs?: number): Promise<{
    data?: any;
    error?: any;
    response?: any;
}>;
