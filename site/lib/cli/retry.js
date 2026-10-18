"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sleep = void 0;
exports.getWithRetry = getWithRetry;
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
