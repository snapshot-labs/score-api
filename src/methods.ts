import snapshot from '@snapshot-labs/strategies';
import redis from './redis';
import { sha256, rpcSuccess, rpcError, getBlockNum } from './utils';
import disabled from './disabled.json';

interface GetVpRequestParams {
  address: string;
  network: string;
  strategies: any[];
  snapshot: number | 'latest';
  space: string;
  delegation?: boolean;
}

interface ValidateRequestParams {
  validation: string;
  author: string;
  space: string;
  network: string;
  snapshot: number | 'latest';
  params: any;
}

export async function getVp(res, params: GetVpRequestParams, id) {
  if (typeof params.snapshot !== 'number') params.snapshot = 'latest';
  if (params.snapshot !== 'latest') {
    const currentBlockNum = await getBlockNum(params.network);
    params.snapshot = currentBlockNum < params.snapshot ? 'latest' : params.snapshot;
  }
  const key = sha256(JSON.stringify(params));
  if (redis && params.snapshot !== 'latest') {
    const cache = await redis.hGetAll(`vp:${key}`);
    if (cache && cache.vp_state) {
      cache.vp = parseFloat(cache.vp);
      cache.vp_by_strategy = JSON.parse(cache.vp_by_strategy);
      return rpcSuccess(res, cache, id, true);
    }
  }

  if (['1319'].includes(params.network)) // || disabled.includes(params.space)
    return rpcError(res, 500, 'something wrong with the strategies', null);

  const result = await snapshot.utils.getVp(
    params.address,
    params.network,
    params.strategies,
    params.snapshot,
    params.space,
    params.delegation
  );
  if (redis && result.vp_state === 'final') {
    const multi = redis.multi();
    multi.hSet(`vp:${key}`, 'vp', result.vp);
    multi.hSet(`vp:${key}`, 'vp_by_strategy', JSON.stringify(result.vp_by_strategy));
    multi.hSet(`vp:${key}`, 'vp_state', result.vp_state);
    multi.exec();
  }
  return rpcSuccess(res, result, id);
}

export async function validate(res, params: ValidateRequestParams, id) {
  const validation = new snapshot.validations[params.validation].validation(
    params.author,
    params.space,
    params.network,
    params.snapshot,
    params.params
  );
  return rpcSuccess(res, await validation.validate(), id);
}
