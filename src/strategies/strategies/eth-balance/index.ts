import { formatUnits } from '@ethersproject/units';
import { getMulticallAddress, multicall } from '../../utils';

const abi = [
  'function getEthBalance(address addr) public view returns (uint256 balance)'
];

export async function strategy(
  space,
  network,
  provider,
  addresses,
  options,
  snapshot
) {
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
  const decimals = options.decimals || 18;

  return Object.fromEntries(
    response.map((value, i) => [
      addresses[i],
      parseFloat(formatUnits(value.toString(), decimals))
    ])
  );
}
