import { formatRawScores, multicall } from '../../utils';

const abi = [
  'function balanceOf(address account) external view returns (uint256)'
];

// Exact: number of tokens held, with 0 decimals
export async function rawStrategy(
  _space,
  network,
  provider,
  addresses,
  options,
  snapshot
): Promise<Record<string, bigint>> {
  const blockTag = typeof snapshot === 'number' ? snapshot : 'latest';
  const response = await multicall(
    network,
    provider,
    abi,
    addresses.map((address: any) => [options.address, 'balanceOf', [address]]),
    { blockTag }
  );

  return Object.fromEntries(
    response.map((value, i) => [addresses[i], BigInt(value.toString())])
  );
}

export async function strategy(
  space,
  network,
  provider,
  addresses,
  options,
  snapshot
) {
  return formatRawScores(
    await rawStrategy(space, network, provider, addresses, options, snapshot),
    0
  );
}
