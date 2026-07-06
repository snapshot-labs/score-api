import { indexersStrategy } from './indexers';
import { baseStrategy } from '../the-graph-balance/utils/baseStrategy';

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
