import { BigNumber } from '@ethersproject/bignumber';
import { Multicaller } from '../../utils';

// Safe value of delegators returned per getDelegatedVoters call
const PAGE_SIZE = 1000;

const abi = [
  'function getDelegatedVotersCount(address _delegate) external view returns (uint256)',
  'function getDelegatedVoters(address _delegate, uint256 _offset, uint256 _limit) external view returns (address[] voters)'
];

// Full Lido Voting delegator list per delegate
export async function getVotingDelegators(
  network: string,
  provider: any,
  votingContract: string,
  addresses: string[],
  blockTag: number | string
): Promise<Record<string, string[]>> {
  const countMulticaller = new Multicaller(network, provider, abi, {
    blockTag
  });

  addresses.forEach(address =>
    countMulticaller.call(address, votingContract, 'getDelegatedVotersCount', [
      address
    ])
  );

  const delegatedVotersCounts: Record<string, BigNumber> =
    await countMulticaller.execute();

  const pagesCountsMap: Record<string, number> = {};
  addresses.forEach(address => {
    const count = delegatedVotersCounts[address].toNumber();
    pagesCountsMap[address] = Math.ceil(count / PAGE_SIZE);
  });

  const delegatedVotersMulticaller = new Multicaller(network, provider, abi, {
    blockTag
  });

  for (const address of addresses) {
    for (let page = 0; page < pagesCountsMap[address]; page++) {
      delegatedVotersMulticaller.call(
        `${address}:${page}`,
        votingContract,
        'getDelegatedVoters',
        [address, page * PAGE_SIZE, PAGE_SIZE]
      );
    }
  }

  const pageResults: Record<string, string[]> =
    await delegatedVotersMulticaller.execute();

  return Object.fromEntries(
    addresses.map(address => {
      const delegators: string[] = [];
      for (let page = 0; page < pagesCountsMap[address]; page++) {
        delegators.push(...(pageResults[`${address}:${page}`] || []));
      }
      return [address, delegators];
    })
  );
}
