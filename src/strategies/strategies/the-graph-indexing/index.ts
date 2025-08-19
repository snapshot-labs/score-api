import { baseStrategy } from '../the-graph-balance/utils/baseStrategy';
import { indexersStrategy } from './indexers';

export async function strategy(
  _space,
  network,
  _provider,
  addresses,
  _options,
  snapshot
) {
  return await baseStrategy(
    _space,
    network,
    _provider,
    addresses,
    { strategyType: 'indexing', ..._options },
    snapshot,
    indexersStrategy
  );
}
