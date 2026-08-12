import { getAddress } from '@ethersproject/address';
import { strategy as erc20BalanceOfStrategy } from '../erc20-balance-of';
import {
  getSnapshotDelegationCandidates,
  getSnapshotEffectiveDelegates
} from './snapshotDelegations';
import { getVotingDelegators } from './votingDelegations';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export async function strategy(
  space,
  network,
  provider,
  addresses,
  options,
  snapshot
): Promise<Record<string, number>> {
  const blockTag = typeof snapshot === 'number' ? snapshot : 'latest';
  const votingContract = options.votingContract;
  const delegationSpace = options.delegationSpace || space;
  const scoredAddressByLc = new Map<string, string>(
    addresses.map((address: string) => [address.toLowerCase(), address])
  );
  const votingAddresses = addresses.filter(
    (address: string) => address.toLowerCase() !== ZERO_ADDRESS
  );

  // delegate → set of its delegators, accumulated from both sources
  const delegations: Record<string, Set<string>> = {};
  addresses.forEach((address: string) => (delegations[address] = new Set()));

  // Fetch Voting delegators and the Snapshot delegators pointing at a scored delegate
  const [votingDelegatorsMap, snapshotCandidates] = await Promise.all([
    getVotingDelegators(
      network,
      provider,
      votingContract,
      votingAddresses,
      blockTag
    ),
    getSnapshotDelegationCandidates(
      delegationSpace,
      network,
      addresses,
      snapshot
    )
  ]);

  const votingCandidates: { delegate: string; delegator: string }[] = [];
  Object.entries(votingDelegatorsMap).forEach(([delegate, delegators]) => {
    delegators.forEach((delegator: string) => {
      if (scoredAddressByLc.has(delegator.toLowerCase())) {
        return; // delegator is voting directly → keeps its own power
      }
      votingCandidates.push({ delegate, delegator });
    });
  });

  // One `delegator_in` read serves both sides: the Snapshot delegator's effective
  // delegate, and whether a Voting delegator has a Snapshot delegation at all.
  const effectiveSnapshotDelegates = await getSnapshotEffectiveDelegates(
    delegationSpace,
    network,
    [
      ...snapshotCandidates,
      ...votingCandidates.map(candidate => candidate.delegator)
    ],
    snapshot
  );

  snapshotCandidates.forEach(delegator => {
    const effectiveDelegate = effectiveSnapshotDelegates.get(delegator);
    if (!effectiveDelegate) {
      return;
    }

    // A space-specific override can point outside the scored set; that power
    // belongs to the override target, not to any scored delegate.
    const scoredDelegate = scoredAddressByLc.get(effectiveDelegate);
    if (!scoredDelegate) {
      return;
    }

    delegations[scoredDelegate].add(getAddress(delegator));
  });

  // A delegator from Voting is credited only if it has no Snapshot delegation.
  votingCandidates.forEach(({ delegate, delegator }) => {
    if (effectiveSnapshotDelegates.has(delegator.toLowerCase())) {
      return; // Snapshot wins
    }

    delegations[delegate].add(getAddress(delegator));
  });

  // Unique delegators across all delegates
  const allDelegators = [
    ...new Set(Object.values(delegations).flatMap(set => [...set]))
  ];
  if (allDelegators.length === 0) {
    return Object.fromEntries(addresses.map((address: string) => [address, 0]));
  }

  // Fetch all delegators LDO balances
  const score = await erc20BalanceOfStrategy(
    space,
    network,
    provider,
    allDelegators,
    options,
    snapshot
  );

  // Each delegate's score is the sum of its delegators' LDO balances
  return Object.fromEntries(
    addresses.map((address: string) => [
      address,
      [...delegations[address]].reduce(
        (total, delegator) => total + (score[delegator] || 0),
        0
      )
    ])
  );
}
