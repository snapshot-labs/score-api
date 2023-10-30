import snapshot from '@snapshot-labs/strategies';
import redis from '../redis';

type VpResult = ReturnType<typeof snapshot.utils.getVp>;

const VP_KEY_PREFIX = 'vp';

export async function cachedVp(key: string, callback: () => VpResult, toCache = false) {
  if (!toCache || !redis) {
    return { result: await callback(), cache: false };
  }

  const cache = await redis.hGetAll(`${VP_KEY_PREFIX}:${key}`);

  if (cache?.vp_state) {
    cache.vp = parseFloat(cache.vp);
    cache.vp_by_strategy = JSON.parse(cache.vp_by_strategy);

    return { result: cache as Awaited<VpResult>, cache: true };
  }

  const result = await callback();

  if (result.vp_state === 'final') {
    const multi = redis.multi();
    multi.hSet(`${VP_KEY_PREFIX}:${key}`, 'vp', result.vp);
    multi.hSet(`${VP_KEY_PREFIX}:${key}`, 'vp_by_strategy', JSON.stringify(result.vp_by_strategy));
    multi.hSet(`${VP_KEY_PREFIX}:${key}`, 'vp_state', result.vp_state);
    multi.exec();
  }

  return { result, cache: false };
}
