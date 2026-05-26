import redis from '../redis';
import { get, set } from '../aws';
import { cacheActivitesCount } from '../metrics';

export const VP_KEY_PREFIX = 'vp';

interface VpResult {
  vp: number;
  vp_by_strategy?: number[];
  vp_state: string;
}

export async function cachedVp<Type extends Promise<VpResult>>(
  key: string,
  callback: () => Type,
  toCache = true
) {
  if (!toCache || !redis) {
    cacheActivitesCount.inc({ type: 'vp', status: 'skip' });
    return { result: await callback(), cache: false };
  }

  const cache = await redis.hGetAll(`${VP_KEY_PREFIX}:${key}`);

  if (cache?.vp_state) {
    cache.vp = parseFloat(cache.vp);
    cache.vp_by_strategy = JSON.parse(cache.vp_by_strategy);

    cacheActivitesCount.inc({ type: 'vp', status: 'hit' });
    return { result: cache as Awaited<Type>, cache: true };
  }

  const result = await callback();
  let cacheHitStatus = 'unqualified';

  if (result.vp_state === 'final') {
    cacheHitStatus = 'miss';
    const multi = redis.multi();
    multi.hSet(`${VP_KEY_PREFIX}:${key}`, 'vp', result.vp);
    multi.hSet(`${VP_KEY_PREFIX}:${key}`, 'vp_by_strategy', JSON.stringify(result.vp_by_strategy));
    multi.hSet(`${VP_KEY_PREFIX}:${key}`, 'vp_state', result.vp_state);
    multi.exec();
  }

  cacheActivitesCount.inc({ type: 'vp', status: cacheHitStatus });
  return { result, cache: false };
}

export async function cachedScores<Type>(key: string, callback: () => Type, toCache = false) {
  if (!toCache || !!process.env.AWS_REGION) {
    cacheActivitesCount.inc({ type: 'scores', status: 'skip' });
    return { scores: await callback(), cache: false };
  }

  const cache = await get(key);

  if (cache) {
    cacheActivitesCount.inc({ type: 'scores', status: 'hit' });
    return { scores: cache as Awaited<Type>, cache: true };
  }

  const scores = await callback();
  set(key, scores);

  cacheActivitesCount.inc({ type: 'scores', status: 'miss' });
  return { scores, cache: false };
}
