import { formatUnits } from '@ethersproject/units';
import { multicall } from '../../utils';
import networks from '@snapshot-labs/snapshot.js/src/networks.json';
import { StaticJsonRpcProvider } from '@ethersproject/providers';

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
  // Create provider directly
  let customProvider;
  let API_URL;
  if (network.toString() === '1514') {
    API_URL = 'https://mainnet.storyrpc.io';
    customProvider = new StaticJsonRpcProvider(
      'https://mainnet.storyrpc.io', // RPC URL for Story mainnet
      1514 // chain ID for Story mainnet
    );
  } else if (network.toString() === '1315') {
    API_URL = 'http://127.0.0.1:1317';
    customProvider = new StaticJsonRpcProvider(
      'http://127.0.0.1:8545', // RPC URL for Aeneid
      1315 // chain ID for Aeneid
    );
  }

  const blockTag = typeof snapshot === 'number' ? snapshot : 'latest';

  // Get native balances for all addresses
  const response = await multicall(
    network,
    customProvider,
    abi,
    addresses.map((address: any) => [
      networks[network].multicall,
      'getEthBalance',
      [address]
    ]),
    { blockTag }
  );

  // Get staked balances for all addresses
  const stakedBalances = await Promise.all(
    addresses.map(async address => {
      const responseStaked = await fetch(
        `${API_URL}/staking/delegators/${address}/total_staked_token`,
        {
          headers: {
            'X-Block-Height': blockTag.toString()
          }
        }
      );
      const data = await responseStaked.json();
      return parseFloat(data.msg.staked_token);
    })
  );

  return Object.fromEntries(
    response.map((value, i) => {
      const ethBalance = parseFloat(formatUnits(value.toString(), 18)); // native balance comes from RPC with 0 decimals and we convert to achieve 18 decimals
      const stakedBalance = parseFloat(
        formatUnits(stakedBalances[i].toString(), 9)
      ); // staked balance comes from API comes in wei (10^9) and we remove those 9 significant digits to achieve 18 decimals
      const votingPower = ethBalance + 1.25 * stakedBalance;

      return [addresses[i], votingPower];
    })
  );
}
