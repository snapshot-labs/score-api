import { getAddress } from '@ethersproject/address';
import { strategy as erc20BalanceOfStrategy } from '../erc20-balance-of';
import { getVotingDelegators } from './votingDelegations';
import {
  getSnapshotDelegations,
  getSnapshotDelegatorSet
} from './snapshotDelegations';

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
  const addressesLc = new Set(addresses.map((a: string) => a.toLowerCase()));
  const votingAddresses = addresses.filter(
    (address: string) => address.toLowerCase() !== ZERO_ADDRESS
  );

  // delegate → set of its delegators, accumulated from both sources
  const delegations: Record<string, Set<string>> = {};
  addresses.forEach((address: string) => (delegations[address] = new Set()));

  // Fetch both Voting and Snapshot delegators
  const [votingDelegatorsMap, snapshotDelegatorsMap] = await Promise.all([
    getVotingDelegators(
      network,
      provider,
      votingContract,
      votingAddresses,
      blockTag
    ),
    getSnapshotDelegations(delegationSpace, network, addresses, snapshot)
  ]);

  // Snapshot delegators go in first; the Voting pass below defers to them (Snapshot wins).
  Object.entries(snapshotDelegatorsMap).forEach(([delegate, delegators]) => {
    delegators.forEach(delegator =>
      delegations[delegate].add(getAddress(delegator))
    );
  });

  // A delegator from Voting is credited only if it has no Snapshot delegation.
  const votingCandidates: { delegate: string; delegator: string }[] = [];
  Object.entries(votingDelegatorsMap).forEach(([delegate, delegators]) => {
    delegators.forEach((delegator: string) => {
      if (addressesLc.has(delegator.toLowerCase())) {
        return; // delegator is voting directly → keeps its own power
      }
      votingCandidates.push({ delegate, delegator });
    });
  });

  // Apply the "Snapshot wins" rule: if a delegator has a Snapshot delegation, it is not credited to its Voting delegate.
  if (votingCandidates.length > 0) {
    const uniqueDelegators = [
      ...new Set(votingCandidates.map(c => c.delegator))
    ];
    const snapshotDelegators = await getSnapshotDelegatorSet(
      delegationSpace,
      network,
      uniqueDelegators,
      snapshot
    );
    votingCandidates.forEach(({ delegate, delegator }) => {
      if (snapshotDelegators.has(delegator.toLowerCase())) {
        return; // Snapshot wins
      }

      delegations[delegate].add(getAddress(delegator));
    });
  }

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
