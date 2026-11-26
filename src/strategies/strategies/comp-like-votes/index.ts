import { formatRawScores, multicall } from '../../utils';

const abi = [
  {
    constant: true,
    inputs: [
      {
        internalType: 'address',
        name: 'account',
        type: 'address'
      }
    ],
    name: 'getCurrentVotes',
    outputs: [
      {
        internalType: 'uint96',
        name: '',
        type: 'uint96'
      }
    ],
    payable: false,
    stateMutability: 'view',
    type: 'function'
  }
];

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
      'getCurrentVotes',
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
