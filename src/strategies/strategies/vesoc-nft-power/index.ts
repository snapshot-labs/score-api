import { BigNumberish, BigNumber } from '@ethersproject/bignumber';
import { formatUnits } from '@ethersproject/units';
import { customFetch, Multicaller, subgraphRequest } from '../../utils';
import networks from '@snapshot-labs/snapshot.js/src/networks.json';

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

const multicall3Abi = [
  'function getCurrentBlockTimestamp() external view returns (uint256 timestamp)'
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

const DEFAULT_SNAPSHOT_GRAPHQL = 'https://testnet.hub.snapshot.org/graphql';

async function fetchActiveVotesCount(
  addresses: string[],
  graphqlEndpoint: string,
  spaceId: string,
  currentTimestamp: number
): Promise<Record<string, number>> {
  const voters = addresses.map(address => address.toLowerCase());
  const counts: Record<string, number> = Object.fromEntries(
    voters.map(voter => [voter, 0])
  );
  const spaces = [spaceId];
  const proposalIds: string[] = [];
  let proposalSkip = 0;

  while (true) {
    const proposalPayload = await subgraphRequest(graphqlEndpoint, {
      proposals: {
        __args: {
          first: 1000,
          skip: proposalSkip,
          where: {
            space_in: spaces,
            start_lte: currentTimestamp,
            end_gt: currentTimestamp
          }
        },
        id: true
      }
    });
    const proposals = proposalPayload?.proposals || [];
    proposals.forEach(proposal => {
      if (proposal?.id) proposalIds.push(proposal.id);
    });

    if (proposals.length < 1000) {
      break;
    }

    proposalSkip += 1000;
  }

  if (proposalIds.length === 0) {
    return counts;
  }
  let skip = 0;
  while (true) {
    const payload = await subgraphRequest(graphqlEndpoint, {
      votes: {
        __args: {
          first: 1000,
          skip,
          where: {
            voter_in: voters,
            proposal_in: proposalIds,
            created_lt: currentTimestamp
          }
        },
        voter: true
      }
    });
    const votes = payload?.votes || [];
    votes.forEach(vote => {
      const voter = vote.voter?.toLowerCase();
      if (voter && counts[voter] !== undefined) {
        counts[voter] += 1;
      }
    });

    if (votes.length < 1000) {
      break;
    }

    skip += 1000;
  }

  return counts;
}

/**
 * Strategy 1: vesoc-nft-power - calculates voting power based on veSOC position and NFT consensus values
 */
async function calculateVeSocNftPower(
  space: any,
  network: any,
  provider: any,
  addresses: string[],
  options: any,
  blockTag: any
): Promise<Record<string, number>> {
  const multicallAddress =
    options.multicallAddress || networks[network]?.multicall;
  if (!multicallAddress) {
    throw new Error('missing multicall address for current timestamp');
  }

  // 1. Get user lock info, current timestamp, and NFT IDs in one multicall
  const multi = new Multicaller(
    network,
    provider,
    [...multicall3Abi, ...veSocLockerAbi, ...nftContractAbi],
    {
      blockTag
    }
  );
  multi.call(
    'currentTimestamp',
    multicallAddress,
    'getCurrentBlockTimestamp',
    []
  );
  addresses.forEach(address =>
    multi.call(address, options.veSocLockerAddress, 'getUserLock', [address])
  );
  addresses.forEach(address =>
    multi.call(`nfts.${address}`, options.nftContractAddress, 'userPasses', [
      address
    ])
  );
  const multiResults = await multi.execute();
  const currentTimestamp = Number(multiResults.currentTimestamp || 0);
  const lockResults: Record<string, LockPosition> = Object.fromEntries(
    addresses.map(address => [address, multiResults[address]])
  );
  const nftResults: Record<string, BigNumberish[]> = Object.fromEntries(
    addresses.map(address => [address, multiResults.nfts?.[address] || []])
  );

  const minLockPerActiveVote = options.minLockPerActiveVote || 0;
  const enforceActiveVoteLock = !(minLockPerActiveVote === 0);
  const snapshotGraphqlEndpoint =
    options.snapshotGraphqlEndpoint || DEFAULT_SNAPSHOT_GRAPHQL;
  const activeVotesByAddress = enforceActiveVoteLock
    ? await fetchActiveVotesCount(
        addresses,
        snapshotGraphqlEndpoint,
        options.snapshotSpace || space,
        currentTimestamp
      )
    : {};

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

  // @ts-ignore
  for (const address of addresses) {
    const lock = lockResults[address];
    let veSocPower = 0;

    const socAmount = lock
      ? parseFloat(formatUnits(lock.veSocAmount, options.decimals || 18))
      : 0;
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

    if (enforceActiveVoteLock && veSocPower > 0) {
      let activeVotes = activeVotesByAddress[address.toLowerCase()] || 0;
      activeVotes += 1; // Add one for the current vote
      const requiredLock = minLockPerActiveVote * activeVotes;
      if (socAmount < requiredLock) {
        veSocPower = 0;
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
    return await calculateVeSocNftPower(
      space,
      network,
      provider,
      addresses,
      options,
      blockTag
    );
  }
}
