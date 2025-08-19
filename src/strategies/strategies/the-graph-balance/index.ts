import { baseStrategy } from './utils/baseStrategy';
import { balanceStrategy } from './balances';

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
