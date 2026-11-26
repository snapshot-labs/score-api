import { formatRawScores, multicall } from '../../utils';

const abi = [
  'function balanceOf(address owner, uint256 id) view returns (uint256)'
];

// Exact: balances of the token id in base units
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
    addresses.map((address: any) => [
      options.address,
      'balanceOf',
      [address, options.tokenId]
    ]),
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
    options.decimals
  );
}
