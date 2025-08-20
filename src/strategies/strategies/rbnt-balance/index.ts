import { strategy as ethBalanceStrategy } from '../eth-balance';

export async function strategy(
  space,
  network,
  provider,
  addresses,
  options,
  snapshot
) {
  // Call the eth-balance strategy internally
  const ethBalances = await ethBalanceStrategy(
    space,
    network,
    provider,
    addresses,
    options,
    snapshot
  );

  // For now, return the eth balances as-is
  // This can be modified to apply any RBNT-specific logic in the future
  return ethBalances;
}
