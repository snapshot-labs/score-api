import { balanceStrategy } from './balances';
import { baseStrategy } from './utils/baseStrategy';

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
    { strategyType: 'balance', ..._options },
    snapshot,
    balanceStrategy
  );
}
