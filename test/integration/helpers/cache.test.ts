import redis from '../../../src/redis';

describe('cache', () => {
  describe('getVp()', () => {
    if (redis) {
      afterAll(async () => {
        await redis.quit();
      });

      describe('when cached', () => {
        it.todo('returns the cached results');
        it.todo('does not call the callback function');
      });

      describe('when not cached', () => {
        it.todo('returns the live results');

        describe('when the results should be cached', () => {
          it.todo('caches the results when vp_state is final');
          it.todo('does not cache the results when vp_state is not final');
        });

        describe('when the results should not be cached', () => {
          it.todo('does not cache the results');
        });
      });

      describe('when the cache engine is unavailable', () => {
        it.todo('returns the live results');
      });
    } else {
      it.todo('needs to set Redis credentials');
    }
  });
});
