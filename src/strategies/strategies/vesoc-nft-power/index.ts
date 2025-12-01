import { BigNumberish, BigNumber } from '@ethersproject/bignumber';
import { formatUnits } from '@ethersproject/units';
import { customFetch, Multicaller } from '../../utils';

// ABI for VeSocLocker contract
const veSocLockerAbi = [
  'function getUserLock(address user) external view returns (tuple(uint128 amount, uint128 veSocAmount, uint64 startTime, uint64 endTime, uint8 duration))',
  'function balanceOf(address account) external view returns (uint256)',
  'function totalSupply() external view returns (uint256)'
];

// ABI for NFT contract to get user's NFT IDs
const nftContractAbi = [
  'function userPasses(address owner) external view returns (uint256[] memory)'
];

// Strategy types enum
enum StrategyType {
  VESOC_NFT_POWER = 'vesoc-nft-power',
  VESOC_SUPPLY_RATIO = 'vesoc-supply-ratio'
}

interface LockPosition {
  amount: BigNumberish;
  veSocAmount: BigNumberish;
  startTime: BigNumberish;
  endTime: BigNumberish;
  duration: BigNumberish;
}

interface NFTConsensusResponse {
  id: string;
  consensusValue: number;
}

/**
 * Strategy 1: vesoc-nft-power - calculates voting power based on veSOC position and NFT consensus values
 */
async function calculateVeSocNftPower(
  network: any,
  provider: any,
  addresses: string[],
  options: any,
  blockTag: any,
  currentTimestamp: number
): Promise<Record<string, number>> {
  // 1. Get user lock information from VeSocLocker
  const veSocMulti = new Multicaller(network, provider, veSocLockerAbi, {
    blockTag
  });
  addresses.forEach(address =>
    veSocMulti.call(address, options.veSocLockerAddress, 'getUserLock', [
      address
    ])
  );
  const lockResults: Record<string, LockPosition> = await veSocMulti.execute();

  // 2. Get user NFT IDs from NFT contract
  const nftMulti = new Multicaller(network, provider, nftContractAbi, {
    blockTag
  });
  addresses.forEach(address =>
    nftMulti.call(address, options.nftContractAddress, 'userPasses', [address])
  );
  const nftResults: Record<string, BigNumberish[]> = await nftMulti.execute();

  // 3. Collect all unique NFT IDs across all users to minimize API calls
  const allNftIds = new Set<string>();
  const userToNftIds: Record<string, string[]> = {};

  for (const address of addresses) {
    const nftIds = nftResults[address] || [];
    const nftIdStrings = nftIds.map(id => id.toString());
    userToNftIds[address] = nftIdStrings;
    nftIdStrings.forEach(id => allNftIds.add(id));
  }

  // 4. Single batch API call for all NFT consensus values
  const nftConsensusMap: Record<string, number> = {};

  if (allNftIds.size > 0) {
    const queryParams = new URLSearchParams();
    queryParams.append('ids', Array.from(allNftIds).join(','));

    const response = await customFetch(
      `${options.consensusApi}?${queryParams}`
    );

    if (response.ok) {
      const data: NFTConsensusResponse[] = await response.json();
      data.forEach(nft => {
        nftConsensusMap[nft.id] = nft.consensusValue;
      });
    } else {
      throw Error(response.statusText);
    }
  }

  // 5. Calculate final scores
  const scores: Record<string, number> = {};

  for (const address of addresses) {
    const lock = lockResults[address];
    let veSocPower = 0;

    // Check if user has an active lock (amount > 0 and lock hasn't expired)
    if (lock && Number(lock.amount) > 0) {
      const endTime = Number(lock.endTime);
      const startTime = Number(lock.startTime);

      // Only calculate power if lock hasn't expired
      if (endTime > currentTimestamp) {
        const veSocAmount = parseFloat(
          formatUnits(lock.veSocAmount, options.decimals || 18)
        );

        // Calculate lock duration and remaining time
        const lockDuration = endTime - startTime;
        const remainingTime = endTime - currentTimestamp;

        if (lockDuration > 0) {
          // veSocPower = veSocAmount * (remainingTime / lockDuration)
          veSocPower = veSocAmount * (remainingTime / lockDuration);
        }
      }
    }

    // Get maxConsensusValue from user's NFTs
    let maxConsensusValue = 1; // Default value if user has no NFTs

    const userNftIds = userToNftIds[address] || [];
    if (userNftIds.length > 0) {
      const consensusValues = userNftIds
        .map(nftId => nftConsensusMap[nftId])
        .filter(value => value !== undefined && value > 0);

      if (consensusValues.length > 0) {
        maxConsensusValue = Math.max(...consensusValues, 1);
      }
    }

    // Calculate final score: veSocPower * maxConsensusValue
    scores[address] = veSocPower * maxConsensusValue;
  }

  return scores;
}

/**
 * Strategy 2: vesoc-supply-ratio - calculates voting power as ratio of total veSOC supply
 */
async function calculateVeSocSupplyRatio(
  network: any,
  provider: any,
  addresses: string[],
  options: any,
  blockTag: any
): Promise<Record<string, number>> {
  // Get user balances and total supply in a single multicall
  const multi = new Multicaller(network, provider, veSocLockerAbi, {
    blockTag
  });

  addresses.forEach(address =>
    multi.call(address, options.veSocLockerAddress, 'balanceOf', [address])
  );

  multi.call('totalSupply', options.veSocLockerAddress, 'totalSupply', []);

  const results = await multi.execute();
  const totalSupply = results.totalSupply;
  const multiplier = options.multiplier || 10000;
  const decimals = options.decimals || 2;

  // Calculate scores using BigNumber for precision
  const scores: Record<string, number> = {};

  // Convert totalSupply to BigNumber and check if it's zero
  const totalSupplyBN = BigNumber.from(totalSupply);

  if (totalSupplyBN.isZero()) {
    // If total supply is zero, all scores are zero
    addresses.forEach(address => {
      scores[address] = 0;
    });
    return scores;
  }

  for (const address of addresses) {
    const userBalance = results[address];
    const userBalanceBN = BigNumber.from(userBalance);
    const multiplierBN = BigNumber.from(multiplier);

    // Calculate ratio using BigNumber: (userBalance * multiplier) / totalSupply
    // Both userBalance and totalSupply are already in the smallest unit (wei)
    const ratioBN = userBalanceBN.mul(multiplierBN).div(totalSupplyBN);

    // Convert to decimal representation (e.g., 0.01 for 1%)
    scores[address] = parseFloat(formatUnits(ratioBN, decimals));
  }

  return scores;
}

export async function strategy(
  space,
  network,
  provider,
  addresses,
  options,
  snapshot
): Promise<Record<string, number>> {
  const blockTag = typeof snapshot === 'number' ? snapshot : 'latest';
  const strategyType = options.strategyType || StrategyType.VESOC_NFT_POWER;

  // Route to appropriate strategy based on strategyType
  if (strategyType === StrategyType.VESOC_SUPPLY_RATIO) {
    return await calculateVeSocSupplyRatio(
      network,
      provider,
      addresses,
      options,
      blockTag
    );
  } else {
    // Get current block timestamp for veSocPower calculation
    const block = await provider.getBlock(blockTag);
    const currentTimestamp = block.timestamp;

    return await calculateVeSocNftPower(
      network,
      provider,
      addresses,
      options,
      blockTag,
      currentTimestamp
    );
  }
}
