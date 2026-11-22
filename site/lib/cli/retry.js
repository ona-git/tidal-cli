"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sleep = void 0;
exports.getWithRetry = getWithRetry;
exports.writeWithRetry = writeWithRetry;
/**
 * GET helper with retry/backoff for the TIDAL API.
 * Retries when the call returns no data and no JSON error (empty body, typically HTTP 429/5xx),
 * or when the HTTP status is 429 or >= 500. Client errors (4xx with a body) are returned as is.
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
exports.sleep = sleep;
async function getWithRetry(client, path, options, maxRetries = 4, baseDelayMs = 600) {
    let last = {};
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            last = await client.GET(path, options);
        }
        catch (e) {
            last = { error: { message: String(e?.message ?? e) } };
        }
        const status = last.response?.status;
        if (last.data && !last.error)
            return last;
        const retryable = status === 429 || (status !== undefined && status >= 500) || (!last.error && !last.data);
        if (!retryable || attempt === maxRetries)
            return last;
        const retryAfter = Number(last.response?.headers?.get?.('retry-after'));
        const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 10000) : baseDelayMs * 2 ** attempt;
        await (0, exports.sleep)(wait);
    }
    return last;
}
/**
 * Runs a write call (POST/PATCH/DELETE) with retry/backoff.
 *
 * openapi-fetch returns `{ error: undefined }` for a failed response with an empty body
 * (for example HTTP 429 with Content-Length 0). Checking only `error` then treats a
 * rejected write as a success, which silently drops tracks. So success here means: no
 * error AND, when the HTTP response is known, a 2xx status.
 * Retries on 429, 5xx, a thrown network error or a failed response without a body.
 */
async function writeWithRetry(call, maxRetries = 4, baseDelayMs = 800) {
    let status;
    let error;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        let res = {};
        try {
            res = await call();
        }
        catch (e) {
            res = { error: { message: String(e?.message ?? e) } };
        }
        status = res.response?.status;
        const httpOk = res.response ? res.response.ok !== false && (status === undefined || (status >= 200 && status < 300)) : true;
        if (!res.error && httpOk)
            return { ok: true, status };
        error = res.error ?? { status, message: `HTTP ${status ?? '?'} without a response body` };
        const retryable = status === undefined || status === 429 || status >= 500 || res.error === undefined;
        if (!retryable || attempt === maxRetries)
            break;
        const retryAfter = Number(res.response?.headers?.get?.('retry-after'));
        const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 10000) : baseDelayMs * 2 ** attempt;
        await (0, exports.sleep)(wait);
    }
    return { ok: false, status, error };
}
//# sourceMappingURL=retry.js.map