import { formatRawScores, multicall } from '../../utils';

const abi = ['function getVotes(address account) view returns (uint256)'];

// Exact: votes in token base units
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
      'getVotes',
      [address.toLowerCase()]
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
