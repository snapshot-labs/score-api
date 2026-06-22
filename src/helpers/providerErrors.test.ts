import {
  _resetThrottle,
  isProviderError,
  shouldReport,
  summarizeError
} from './providerErrors';

describe('providerErrors', () => {
  beforeEach(() => {
    _resetThrottle();
  });

  describe('isProviderError', () => {
    it('detects ethers SERVER_ERROR', () => {
      expect(isProviderError({ code: 'SERVER_ERROR' })).toBe(true);
    });

    it('detects TIMEOUT / NETWORK_ERROR / CALL_EXCEPTION', () => {
      expect(isProviderError({ code: 'TIMEOUT' })).toBe(true);
      expect(isProviderError({ code: 'NETWORK_ERROR' })).toBe(true);
      expect(isProviderError({ code: 'CALL_EXCEPTION' })).toBe(true);
    });

    it('detects HTTP 403/5xx statuses', () => {
      expect(isProviderError({ status: 403 })).toBe(true);
      expect(isProviderError({ statusCode: 502 })).toBe(true);
      expect(isProviderError({ error: { status: 503 } })).toBe(true);
    });

    it('detects the rpc.snapshot.org url signature', () => {
      expect(
        isProviderError({ error: { url: 'https://rpc.snapshot.org/1' } })
      ).toBe(true);
    });

    it('returns false for input/validation errors', () => {
      expect(isProviderError(new Error('invalid address'))).toBe(false);
      expect(isProviderError({ code: 'INVALID_ARGUMENT' })).toBe(false);
      expect(isProviderError(null)).toBe(false);
      expect(isProviderError(undefined)).toBe(false);
    });
  });

  describe('summarizeError', () => {
    it('prefers the provider-issue shape', () => {
      const e = {
        reason: 'bad response',
        error: { reason: '403', url: 'https://rpc.snapshot.org/1' }
      };
      expect(summarizeError(e)).toBe(
        '[provider issue] https://rpc.snapshot.org/1, reason: bad response, 403'
      );
    });

    it('includes code and message and is bounded to 256 chars', () => {
      const e = { code: 'SERVER_ERROR', message: 'x'.repeat(1000) };
      const out = summarizeError(e);
      expect(out.startsWith('SERVER_ERROR: ')).toBe(true);
      expect(out.length).toBeLessThanOrEqual(256);
    });

    it('handles missing error', () => {
      expect(summarizeError(null)).toBe('Unknown error');
    });
  });

  describe('shouldReport', () => {
    it('reports the first occurrence then throttles within the window', () => {
      const t0 = 1_000_000;
      expect(shouldReport('k', t0)).toBe(true);
      expect(shouldReport('k', t0 + 1)).toBe(false);
      expect(shouldReport('k', t0 + 29_999)).toBe(false);
      expect(shouldReport('k', t0 + 30_001)).toBe(true);
    });

    it('tracks keys independently', () => {
      const t0 = 2_000_000;
      expect(shouldReport('a', t0)).toBe(true);
      expect(shouldReport('b', t0)).toBe(true);
      expect(shouldReport('a', t0 + 1)).toBe(false);
    });
  });
});
