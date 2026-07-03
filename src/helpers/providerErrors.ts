// Helpers to detect upstream RPC-provider failures (e.g. rpc.snapshot.org
// returning HTTP 403/5xx) and to throttle the per-request error reporting they
// trigger.
//
// Background: when the shared RPC proxy (rpc.snapshot.org) starts returning
// 403s, ethers throws a SERVER_ERROR/CALL_EXCEPTION for *every* failing
// strategy call. Previously score-api called `capture()` (Sentry) and
// `console.log` once per failed request. Under a provider outage that is
// thousands of failures per minute, each serializing the full ethers error
// object (which embeds the request body and the upstream HTML response). That
// log/Sentry amplification — not the 403 itself — is what stalls the event
// loop and makes score-api miss the HTTP header timeout (the "flapping").
//
// This module lets the request handler (a) recognise upstream-provider errors
// and (b) report only a throttled sample of them, so a provider outage no
// longer turns into a self-inflicted event-loop stall.

// ethers error `code` values that indicate the upstream node/proxy failed
// rather than the request being invalid.
const PROVIDER_ERROR_CODES = new Set([
  'SERVER_ERROR',
  'TIMEOUT',
  'NETWORK_ERROR',
  'CALL_EXCEPTION'
]);

// HTTP statuses returned by the proxy/upstream that we treat as transient
// provider failures.
const PROVIDER_ERROR_STATUSES = new Set([403, 429, 500, 502, 503, 504]);

/**
 * Returns true when an error looks like it originated from the upstream RPC
 * provider/proxy (e.g. rpc.snapshot.org) rather than from invalid input.
 */
export function isProviderError(e: any): boolean {
  if (!e) return false;
  if (typeof e.code === 'string' && PROVIDER_ERROR_CODES.has(e.code)) {
    return true;
  }
  const status = e.status ?? e.statusCode ?? e.error?.status;
  if (typeof status === 'number' && PROVIDER_ERROR_STATUSES.has(status)) {
    return true;
  }
  // ethers SERVER_ERROR wraps the upstream response; the body/url often carry
  // the proxy signature even when `code` is missing.
  const url: string | undefined = e.error?.url ?? e.url ?? e.requestUrl;
  if (typeof url === 'string' && url.includes('rpc.snapshot.org')) {
    return true;
  }
  return false;
}

/**
 * Builds a short, bounded, human-readable summary of an error suitable for a
 * single log line. Never serializes the full ethers error object.
 */
export function summarizeError(e: any): string {
  if (!e) return 'Unknown error';
  if (e?.reason && e?.error?.reason && e?.error?.url) {
    return `[provider issue] ${e.error.url}, reason: ${e.reason}, ${e.error.reason}`;
  }
  const code = e.code ? `${e.code}: ` : '';
  const message = e.message ?? String(e);
  return `${code}${message}`.slice(0, 256);
}

// Throttle state: at most one report per (key) per window. Keyed by a coarse
// fingerprint so a 403 storm on chain 1 reports ~once/window instead of
// thousands of times.
const REPORT_WINDOW_MS = 30_000;
const lastReportedAt = new Map<string, number>();
// Bound the map so a pathological set of distinct keys can't grow it forever.
const MAX_KEYS = 500;

/**
 * Returns true at most once per `REPORT_WINDOW_MS` per key. Use to decide
 * whether to emit a Sentry capture / log line for a recurring provider error,
 * so an outage produces a steady trickle of reports instead of a flood.
 */
export function shouldReport(key: string, now: number = Date.now()): boolean {
  const last = lastReportedAt.get(key);
  if (last !== undefined && now - last < REPORT_WINDOW_MS) {
    return false;
  }
  if (lastReportedAt.size >= MAX_KEYS && last === undefined) {
    // Drop the oldest entry to keep the map bounded.
    const oldestKey = lastReportedAt.keys().next().value;
    if (oldestKey !== undefined) lastReportedAt.delete(oldestKey);
  }
  lastReportedAt.set(key, now);
  return true;
}

// Exposed for tests.
export function _resetThrottle(): void {
  lastReportedAt.clear();
}
