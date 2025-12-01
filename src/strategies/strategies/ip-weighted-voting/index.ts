import { formatUnits } from '@ethersproject/units';
import { multicall } from '../../utils';
import networks from '@snapshot-labs/snapshot.js/src/networks.json';

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
  let API_CHAIN_URL;
  let API_TOTAL_SUPPLY_URL;
  let minimumTotalTokenSupply;

  if (network.toString() === '1514') {
    API_CHAIN_URL = 'https://internal-archive.storyrpc.io';
    API_TOTAL_SUPPLY_URL =
      'https://mainnet-circulation-supply.storyapis.com/history/total-supply?block=';
    minimumTotalTokenSupply = 1000000000; // 1 billion
  } else {
    throw new Error('Network not supported');
  }

  const blockTag = typeof snapshot === 'number' ? snapshot : 'latest';

  // Get native balances for all addresses
  const nativeBalances = await multicall(
    network,
    provider,
    abi,
    addresses.map((address: any) => [
      networks[network].multicall,
      'getEthBalance',
      [address]
    ]),
    { blockTag }
  );

  // Get staked balances for validator addresses
  const stakedBalances = await Promise.all(
    addresses.map(async address => {
      const responseStaked = await fetch(
        `${API_CHAIN_URL}/staking/validators/${address}`,
        {
          headers: {
            'X-Block-Height': blockTag.toString()
          }
        }
      );
      const data = await responseStaked.json();

      // Check if the response indicates that the address is an address that is not a validator
      // and if so return 0 for the staked balance of non-validators
      if (
        data.code === 500 &&
        data.error &&
        data.error.includes('rpc error: code = NotFound desc = validator')
      ) {
        return 0;
      }

      return parseFloat(data.msg.validator.tokens);
    })
  );

  // Get the total token supply (staked and unstaked)
  const totalTokenSupplyResponse = await fetch(
    `${API_TOTAL_SUPPLY_URL}${blockTag.toString()}`
  );
  const totalTokenSupplyData = await totalTokenSupplyResponse.json();
  const totalTokenSupply = parseFloat(totalTokenSupplyData.result);
  if (totalTokenSupply < minimumTotalTokenSupply) {
    throw new Error(
      'Total token supply is less than minimum total token supply'
    );
  }

  // Get the total staked token supply
  const totalStakedSupplyResponse = await fetch(
    `${API_CHAIN_URL}/staking/total_staked_token`,
    {
      headers: {
        'X-Block-Height': blockTag.toString()
      }
    }
  );
  const totalStakedSupplyData = await totalStakedSupplyResponse.json();
  const totalStakedSupply = parseFloat(
    formatUnits(totalStakedSupplyData.msg.total_staked_token.toString(), 9)
  ); // staked balance comes from API comes in wei (10^9) and we remove those 9 significant digits

  const totalVotingPower =
    (totalTokenSupply - totalStakedSupply) * 1 + totalStakedSupply * 1.25;

  //console.log("totalVotingPower", totalVotingPower, "totalTokenSupply", totalTokenSupply, "totalStakedSupply", totalStakedSupply);

  return Object.fromEntries(
    nativeBalances.map((value, i) => {
      const nativeBalance = parseFloat(formatUnits(value.toString(), 18)); // native balance comes from RPC with 0 decimals and we convert to achieve 18 decimals
      const stakedBalance = parseFloat(
        formatUnits(stakedBalances[i].toString(), 9)
      ); // staked balance comes from API comes in wei (10^9) and we remove those 9 significant digits
      const votingPower = nativeBalance * 1 + stakedBalance * 1.25;

      const votingPowerPercentage = (votingPower * 100) / totalVotingPower;

      // console.log(addresses[i], "nativeBalance", nativeBalance, "stakedBalance", stakedBalance, "votingPower", votingPower, "votingPowerPercentage", votingPowerPercentage);

      return [addresses[i], votingPowerPercentage];
    })
  );
}
