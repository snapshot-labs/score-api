import { formatRawScores, getMulticallAddress, multicall } from '../../utils';

const abi = [
  'function getEthBalance(address addr) public view returns (uint256 balance)'
];

// Exact: native balances in wei
export async function rawStrategy(
  _space,
  network,
  provider,
  addresses,
  _options,
  snapshot
): Promise<Record<string, bigint>> {
  const blockTag = typeof snapshot === 'number' ? snapshot : 'latest';
  const response = await multicall(
    network,
    provider,
    abi,
    addresses.map((address: any) => [
      getMulticallAddress(network),
      'getEthBalance',
      [address]
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
    options.decimals || 18
  );
}
