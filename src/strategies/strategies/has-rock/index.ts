import { multicall } from '../../utils';

const abi = [
  'function rocks(uint256) view returns (address owner, bool currentlyForSale, uint256 price, uint256 timesSold)'
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

  const calls = [] as any;
  for (let i = 0; i < 100; i++) {
    calls.push([options.address, 'rocks', [i]]);
  }

  const response = await multicall(network, provider, abi, calls, { blockTag });

  const result = {} as any;

  addresses.forEach(address => {
    let addressRocks = 0;
    response.forEach(rockObject => {
      if (rockObject.owner == address) {
        addressRocks++;
      }
    });
    result[address] = addressRocks;
  });

  return result;
}
