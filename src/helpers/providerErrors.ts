const PROVIDER_ERROR_CODES = new Set([
  'SERVER_ERROR',
  'TIMEOUT',
  'NETWORK_ERROR',
  'CALL_EXCEPTION'
]);

const PROVIDER_ERROR_STATUSES = new Set([403, 429, 500, 502, 503, 504]);

export function isProviderError(e: any): boolean {
  if (!e) return false;
  if (typeof e.code === 'string' && PROVIDER_ERROR_CODES.has(e.code)) {
    return true;
  }
  const status = e.status ?? e.statusCode ?? e.error?.status;
  if (typeof status === 'number' && PROVIDER_ERROR_STATUSES.has(status)) {
    return true;
  }
  // Proxy 403s can arrive with neither a code nor a status.
  const url: string | undefined = e.error?.url ?? e.url ?? e.requestUrl;
  if (typeof url === 'string' && url.includes('rpc.snapshot.org')) {
    return true;
  }
  return false;
}

export function summarizeError(e: any): string {
  if (!e) return 'Unknown error';
  if (e?.reason && e?.error?.reason && e?.error?.url) {
    return `[provider issue] ${e.error.url}, reason: ${e.reason}, ${e.error.reason}`;
  }
  const code = e.code ? `${e.code}: ` : '';
  const message = e.message ?? String(e);
  // An ethers message embeds the request body and the upstream response.
  return `${code}${message}`.slice(0, 256);
}

const REPORT_WINDOW_MS = 30_000;
const lastReportedAt = new Map<string, number>();
const MAX_KEYS = 500;

export function shouldReport(key: string, now: number = Date.now()): boolean {
  const last = lastReportedAt.get(key);
  if (last !== undefined && now - last < REPORT_WINDOW_MS) {
    return false;
  }
  // The network segment of the key comes from the request body.
  if (lastReportedAt.size >= MAX_KEYS && last === undefined) {
    const oldestKey = lastReportedAt.keys().next().value;
    if (oldestKey !== undefined) lastReportedAt.delete(oldestKey);
  }
  lastReportedAt.set(key, now);
  return true;
}

// Only referenced from tests.
export function _resetThrottle(): void {
  lastReportedAt.clear();
}
