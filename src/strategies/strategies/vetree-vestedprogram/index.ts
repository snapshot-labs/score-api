import { BigNumber, BigNumberish } from '@ethersproject/bignumber';
import { formatUnits } from '@ethersproject/units';
import { Multicaller, customFetch } from '../../utils';

const abi = [
  'function claimed(uint256 tranche, address user) external view returns (bool)',
  'function claimableBalance(uint256 _tranche, uint256 _amount) external view returns (uint256,uint256)'
];

export async function strategy(
  space,
  network,
  provider,
  addresses,
  options,
  snapshot
): Promise<Record<string, number>> {
  const blockTag = typeof snapshot === 'number' ? snapshot : 'latest';
  const tranche = options.tranche || 2;

  // 1. Check which addresses have already claimed.
  const claimedMulti = new Multicaller(network, provider, abi, { blockTag });
  addresses.forEach(address =>
    claimedMulti.call(address, options.address, 'claimed', [tranche, address])
  );
  const claimedResult: Record<string, boolean> = await claimedMulti.execute();

  const notClaimedAddresses = addresses.filter(
    address => !claimedResult[address]
  );

  if (notClaimedAddresses.length === 0) {
    return {};
  }

  // 2. Get amounts for addresses that have not claimed from an external API.
  if (!options.apiUrl) {
    throw new Error('apiUrl is not defined in options');
  }

  const url = options.apiUrl + '?address=' + notClaimedAddresses.join(',');
  const apiResponse = await customFetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });
  const amounts: Record<string, number> = await apiResponse.json();

  // 3. For addresses that have not claimed, get their claimable balance.
  const claimableMulti = new Multicaller(network, provider, abi, { blockTag });
  notClaimedAddresses.forEach(address => {
    const amount = amounts[address.toLowerCase()] || amounts[address];
    if (amount) {
      claimableMulti.call(address, options.address, 'claimableBalance', [
        tranche,
        BigNumber.from(amount).mul(BigNumber.from(10).pow(options.decimals))
      ]);
    }
  });
  const claimableResult: Record<string, [BigNumberish, BigNumberish]> =
    await claimableMulti.execute();

  // 4. Calculate voting power.
  const scores = {};
  for (const address of addresses) {
    if (claimableResult[address]) {
      const [claimable, amount] = claimableResult[address];
      const totalClaimable = BigNumber.from(claimable).add(amount);
      const score = Math.sqrt(
        parseFloat(formatUnits(totalClaimable, options.decimals))
      );
      scores[address] = score;
    } else {
      scores[address] = 0;
    }
  }

  return scores;
}
