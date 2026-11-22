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
/**
 * Runs a write call (POST/PATCH/DELETE) with retry/backoff.
 *
 * openapi-fetch returns `{ error: undefined }` for a failed response with an empty body
 * (for example HTTP 429 with Content-Length 0). Checking only `error` then treats a
 * rejected write as a success, which silently drops tracks. So success here means: no
 * error AND, when the HTTP response is known, a 2xx status.
 * Retries on 429, 5xx, a thrown network error or a failed response without a body.
 */
export declare function writeWithRetry(call: () => Promise<{
    data?: any;
    error?: any;
    response?: any;
}>, maxRetries?: number, baseDelayMs?: number): Promise<{
    ok: boolean;
    status?: number;
    error?: any;
}>;
