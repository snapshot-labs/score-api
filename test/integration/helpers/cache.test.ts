import { cachedVp, VP_KEY_PREFIX } from '../../../src/helpers/cache';
import redis from '../../../src/redis';

describe('cache', () => {
  describe('getVp()', () => {
    if (redis) {
      const key = 'test-vp-cache';
      const hKey = `${VP_KEY_PREFIX}:${key}`;
      const vp = {
        vp: 1,
        vp_by_strategy: [1],
        vp_state: 'final'
      };
      const altVp = {
        vp: 2,
        vp_by_strategy: [3],
        vp_state: 'final'
      };
      const mockedGetVp = jest.fn();
      const callback = () => {
        return mockedGetVp();
      };
      mockedGetVp.mockResolvedValue(vp);

      afterAll(async () => {
        await redis.quit();
        jest.resetAllMocks();
      });

      afterEach(() => {
        redis.del(`${VP_KEY_PREFIX}:${key}`);
      });

      describe('when cached', () => {
        let result;

        beforeEach(() => {
          const multi = redis.multi();
          multi.hSet(hKey, 'vp', altVp.vp);
          multi.hSet(hKey, 'vp_by_strategy', JSON.stringify(altVp.vp_by_strategy));
          multi.hSet(hKey, 'vp_state', altVp.vp_state);
          multi.exec();

          result = cachedVp(key, callback);
        });

        it('returns the cached results', async () => {
          await expect(result).resolves.toEqual({
            result: altVp,
            cache: true
          });
        });

        it('does not call the callback function', () => {
          expect(mockedGetVp).not.toHaveBeenCalled();
        });
      });

      describe('when not cached', () => {
        describe('when setting toCache to true', () => {
          it('returns the live results', async () => {
            await expect(cachedVp(key, callback, true)).resolves.toEqual({
              result: vp,
              cache: false
            });
            expect(mockedGetVp).toHaveBeenCalled();
          });

          it('caches the results when vp_state is final', async () => {
            await cachedVp(key, callback, true);
            await new Promise(resolve => setTimeout(resolve, 500));

            expect(await redis.hGetAll(hKey)).toEqual({
              vp: vp.vp.toString(),
              vp_by_strategy: JSON.stringify(vp.vp_by_strategy),
              vp_state: vp.vp_state
            });
            expect(mockedGetVp).toHaveBeenCalled();
          });

          it('does not cache the results when vp_state is not final', async () => {
            mockedGetVp.mockResolvedValueOnce({ ...vp, vp_state: 'pending' });
            await cachedVp(key, callback, true);
            await new Promise(resolve => setTimeout(resolve, 500));
            await expect(redis.exists(hKey)).resolves.toEqual(0);
            expect(mockedGetVp).toHaveBeenCalled();
          });
        });

        describe('when setting toCache to false', () => {
          it('does not cache the results', async () => {
            await expect(cachedVp(key, callback, false)).resolves.toEqual({
              result: vp,
              cache: false
            });
            await new Promise(resolve => setTimeout(resolve, 500));
            await expect(redis.exists(hKey)).resolves.toEqual(0);
            expect(mockedGetVp).toHaveBeenCalled();
          });
        });
      });
    } else {
      it.todo('needs to set Redis credentials');
    }
  });
});
