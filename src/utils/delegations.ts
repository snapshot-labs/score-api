import snapshot from '@snapshot-labs/strategies';
import { get, set } from '../aws';
import { rpcSuccess, sha256 } from '../utils';

const withCache = !!process.env.AWS_REGION;

export async function getDelegatesBySpace(res, params, id) {
  if (typeof params.snapshot !== 'number') params.snapshot = 'latest';
  const key = sha256(JSON.stringify(params));
  let delegates;
  if (withCache && params.snapshot !== 'latest') delegates = await get(key);
  let cache = true;
  if (!delegates) {
    cache = false;
    delegates = await snapshot.utils.getDelegatesBySpace(
      params.network,
      params.space,
      params.snapshot
    );

    if (withCache) {
      set(key, delegates);
    }
  }

  return rpcSuccess(res, { delegates }, id, cache);
}
