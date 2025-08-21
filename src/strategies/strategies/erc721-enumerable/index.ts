import { strategy as erc20BalanceOfStrategy } from '../erc20-balance-of';

export async function strategy(
  space,
  network,
  provider,
  addresses,
  options,
  snapshot
) {
  options.decimals = 0;
  return await erc20BalanceOfStrategy(
    space,
    network,
    provider,
    addresses,
    options,
    snapshot
  );
}
