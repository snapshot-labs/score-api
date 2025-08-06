import { formatUnits } from '@ethersproject/units';
import { Multicaller } from '../../utils';
import { BigNumber } from '@ethersproject/bignumber';

export const author = 'theyashgupta';
export const version = '0.1.0';

const abi = [
  'function getUserStakes(uint256 poolId, address user) view returns (tuple(uint256 amount, uint256 startTime, uint256 lastClaimTime)[])',
  'function getPoolInfo(uint256 poolId) view returns (tuple(string name, address stakingToken, address rewardToken, uint256 cooldownPeriod, uint256 currentTierVersion, bool isPaused, uint256 minStake, uint8 rewardStrategy, address rewardAddress, bool restricted, bool allowPartialUnstake) config, tuple(uint256 version, uint256 effectiveTime, uint256[] durations, uint256[] apys) activeTier)'
];

interface Options {
  staking_contract: string;
  pool_id: string;
  decimals: number;
  weightByStakeTime: boolean;
}

export async function strategy(
  space,
  network,
  provider,
  addresses,
  options: Options,
  snapshot
): Promise<Record<string, number>> {
  const blockTag = typeof snapshot === 'number' ? snapshot : 'latest';
  const multi = new Multicaller(network, provider, abi, { blockTag });

  try {
    // Get pool info
    multi.call('poolInfo', options.staking_contract, 'getPoolInfo', [
      options.pool_id
    ]);
    const { poolInfo } = await multi.execute();

    // Skip if pool is paused
    if (poolInfo?.config?.isPaused) {
      return addresses.reduce((acc, address) => ({ ...acc, [address]: 0 }), {});
    }

    // Get user stakes
    addresses.forEach(address => {
      multi.call(
        `stakes_${address}`,
        options.staking_contract,
        'getUserStakes',
        [options.pool_id, address]
      );
    });

    const results = await multi.execute();

    // Get block timestamp for deterministic results
    const block = await provider.getBlock(blockTag);
    const currentTime = block.timestamp;
    const votingPower: Record<string, number> = {};

    // Calculate max tier duration once (fallback to 1 year if no tiers)
    const maxTierDuration =
      poolInfo?.activeTier?.durations?.length > 0
        ? BigNumber.from(
            poolInfo.activeTier.durations[
              poolInfo.activeTier.durations.length - 1
            ]
          ).toNumber()
        : 365 * 24 * 60 * 60;

    // Process each address
    for (const address of addresses) {
      const stakes = results[`stakes_${address}`] || [];
      let totalVotingPower = 0;

      for (const stake of stakes) {
        const amount = parseFloat(formatUnits(stake.amount, options.decimals));
        if (amount === 0) continue;

        let weight = 1;
        if (options.weightByStakeTime) {
          const stakeDuration =
            currentTime - BigNumber.from(stake.startTime).toNumber();
          const durationRatio = Math.min(stakeDuration / maxTierDuration, 1);
          weight = 1 + durationRatio; // Linear scaling from 1x to 2x
        }

        totalVotingPower += amount * weight;
      }

      votingPower[address] = totalVotingPower;
    }

    return votingPower;
  } catch (error) {
    console.error('WelfStaking strategy error:', error);
    // Return zero voting power for all addresses if there's an error
    return addresses.reduce((acc, address) => ({ ...acc, [address]: 0 }), {});
  }
}
