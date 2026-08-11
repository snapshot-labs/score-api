import { getAddress } from '@ethersproject/address';

const mockSubgraphRequest = jest.fn();
const mockGetVotingDelegators = jest.fn();
const mockErc20BalanceOf = jest.fn();

jest.mock('../../utils', () => ({
  subgraphRequest: (...args: any[]) => mockSubgraphRequest(...args),
  SNAPSHOT_SUBGRAPH_URL: { '1': 'https://mock.com' }
}));

jest.mock('./votingDelegations', () => ({
  getVotingDelegators: (...args: any[]) => mockGetVotingDelegators(...args)
}));

jest.mock('../erc20-balance-of', () => ({
  strategy: (...args: any[]) => mockErc20BalanceOf(...args)
}));

import { strategy } from './index';

const SPACE = 'lido-snapshot.eth';
const NETWORK = '1';
const GLOBAL = '';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const LDO_TOKEN = getAddress('0x' + 'ff'.repeat(20));
const VOTING_CONTRACT = getAddress('0x' + 'ee'.repeat(20));

// Scored delegates
const DELEGATE_A = getAddress('0x' + 'a1'.repeat(20));
const DELEGATE_B = getAddress('0x' + 'b2'.repeat(20));
// Delegate outside the scored set
const UNSCORED_DELEGATE = getAddress('0x' + 'c3'.repeat(20));
// Delegators
const SNAPSHOT_DELEGATOR = getAddress('0x' + 'd4'.repeat(20));
const VOTING_DELEGATOR = getAddress('0x' + 'e5'.repeat(20));

interface DelegationRow {
  delegator: string;
  delegate: string;
  space: string;
  timestamp: number;
}

function row(
  delegator: string,
  delegate: string,
  space: string,
  timestamp: number
): DelegationRow {
  return {
    delegator: delegator.toLowerCase(),
    delegate: delegate.toLowerCase(),
    space,
    timestamp
  };
}

describe('lido-voting-delegation strategy', () => {
  // In-memory Delegate Registry: rows served through the same `where` filters the strategy sends
  let subgraphRows: DelegationRow[];
  // Address → balance map
  let balances: Record<string, number>;

  beforeEach(() => {
    subgraphRows = [];
    balances = {};

    mockSubgraphRequest.mockImplementation(async (_url, params) => {
      const { where, first } = params.delegations.__args;
      const delegations = subgraphRows
        .filter(r => where.space_in.includes(r.space))
        .filter(
          r => !where.delegate_in || where.delegate_in.includes(r.delegate)
        )
        .filter(
          r => !where.delegator_in || where.delegator_in.includes(r.delegator)
        )
        .filter(r => r.timestamp >= where.timestamp_gte)
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(0, first);
      return { delegations };
    });

    mockGetVotingDelegators.mockResolvedValue({});

    mockErc20BalanceOf.mockImplementation(
      async (_space, _network, _provider, addresses: string[]) =>
        Object.fromEntries(
          addresses.map(address => [address, balances[address] ?? 0])
        )
    );
  });

  function run(
    addresses: string[] = [DELEGATE_A, DELEGATE_B],
    extraOptions: Record<string, any> = {}
  ) {
    return strategy(
      SPACE,
      NETWORK,
      {},
      addresses,
      {
        address: LDO_TOKEN,
        votingContract: VOTING_CONTRACT,
        ...extraOptions
      },
      'latest'
    );
  }

  it('credits a global Snapshot delegation to its scored delegate', async () => {
    subgraphRows = [row(SNAPSHOT_DELEGATOR, DELEGATE_A, GLOBAL, 1)];
    balances[SNAPSHOT_DELEGATOR] = 100;

    expect(await run()).toEqual({ [DELEGATE_A]: 100, [DELEGATE_B]: 0 });
  });

  it('does not credit a global delegation overridden by a space-scoped one pointing outside the scored set', async () => {
    // The space-scoped row wins even though the global one is newer, so the
    // delegator's power belongs to the unscored delegate and must not inflate
    // DELEGATE_A
    subgraphRows = [
      row(SNAPSHOT_DELEGATOR, UNSCORED_DELEGATE, SPACE, 1),
      row(SNAPSHOT_DELEGATOR, DELEGATE_A, GLOBAL, 2)
    ];
    balances[SNAPSHOT_DELEGATOR] = 100;

    expect(await run()).toEqual({ [DELEGATE_A]: 0, [DELEGATE_B]: 0 });
  });

  it('credits a space-scoped delegation to a scored delegate over a global one pointing outside the scored set', async () => {
    subgraphRows = [
      row(SNAPSHOT_DELEGATOR, DELEGATE_A, SPACE, 1),
      row(SNAPSHOT_DELEGATOR, UNSCORED_DELEGATE, GLOBAL, 2)
    ];
    balances[SNAPSHOT_DELEGATOR] = 100;

    expect(await run()).toEqual({ [DELEGATE_A]: 100, [DELEGATE_B]: 0 });
  });

  it('credits only the space-scoped delegate when global and space-scoped delegates are both scored', async () => {
    subgraphRows = [
      row(SNAPSHOT_DELEGATOR, DELEGATE_B, SPACE, 1),
      row(SNAPSHOT_DELEGATOR, DELEGATE_A, GLOBAL, 2)
    ];
    balances[SNAPSHOT_DELEGATOR] = 100;

    expect(await run()).toEqual({ [DELEGATE_A]: 0, [DELEGATE_B]: 100 });
  });

  it('treats a delegation to the `.eth`-less space alias as space-scoped', async () => {
    subgraphRows = [
      row(SNAPSHOT_DELEGATOR, DELEGATE_B, SPACE.replace('.eth', ''), 1),
      row(SNAPSHOT_DELEGATOR, DELEGATE_A, GLOBAL, 2)
    ];
    balances[SNAPSHOT_DELEGATOR] = 100;

    expect(await run()).toEqual({ [DELEGATE_A]: 0, [DELEGATE_B]: 100 });
  });

  it('credits a Voting delegator that has no Snapshot delegation', async () => {
    mockGetVotingDelegators.mockResolvedValue({
      [DELEGATE_A]: [VOTING_DELEGATOR]
    });
    balances[VOTING_DELEGATOR] = 40;

    expect(await run()).toEqual({ [DELEGATE_A]: 40, [DELEGATE_B]: 0 });
  });

  it('does not credit a Voting delegator that has any Snapshot delegation (Snapshot wins)', async () => {
    mockGetVotingDelegators.mockResolvedValue({
      [DELEGATE_A]: [VOTING_DELEGATOR]
    });
    subgraphRows = [row(VOTING_DELEGATOR, UNSCORED_DELEGATE, GLOBAL, 1)];
    balances[VOTING_DELEGATOR] = 40;

    expect(await run()).toEqual({ [DELEGATE_A]: 0, [DELEGATE_B]: 0 });
  });

  it('does not credit a delegator that is itself in the scored set (votes directly)', async () => {
    subgraphRows = [row(DELEGATE_B, DELEGATE_A, GLOBAL, 1)];
    mockGetVotingDelegators.mockResolvedValue({ [DELEGATE_A]: [DELEGATE_B] });
    balances[DELEGATE_B] = 50;

    expect(await run()).toEqual({ [DELEGATE_A]: 0, [DELEGATE_B]: 0 });
  });

  it('sums the balances of all credited delegators per delegate', async () => {
    subgraphRows = [row(SNAPSHOT_DELEGATOR, DELEGATE_A, GLOBAL, 1)];
    mockGetVotingDelegators.mockResolvedValue({
      [DELEGATE_A]: [VOTING_DELEGATOR]
    });
    balances[SNAPSHOT_DELEGATOR] = 100;
    balances[VOTING_DELEGATOR] = 40;

    expect(await run()).toEqual({ [DELEGATE_A]: 140, [DELEGATE_B]: 0 });
  });

  it('credits the Snapshot delegate when a delegator delegates to different scored delegates in both systems', async () => {
    subgraphRows = [row(SNAPSHOT_DELEGATOR, DELEGATE_B, GLOBAL, 1)];
    mockGetVotingDelegators.mockResolvedValue({
      [DELEGATE_A]: [SNAPSHOT_DELEGATOR]
    });
    balances[SNAPSHOT_DELEGATOR] = 100;

    expect(await run()).toEqual({ [DELEGATE_A]: 0, [DELEGATE_B]: 100 });
  });

  it('counts a delegator once when it delegates to the same delegate in both systems', async () => {
    subgraphRows = [row(SNAPSHOT_DELEGATOR, DELEGATE_A, GLOBAL, 1)];
    mockGetVotingDelegators.mockResolvedValue({
      [DELEGATE_A]: [SNAPSHOT_DELEGATOR]
    });
    balances[SNAPSHOT_DELEGATOR] = 100;

    expect(await run()).toEqual({ [DELEGATE_A]: 100, [DELEGATE_B]: 0 });
  });

  it('resolves Snapshot delegations against the delegationSpace option instead of the space', async () => {
    const delegationSpace = 'lido.eth';
    subgraphRows = [row(SNAPSHOT_DELEGATOR, DELEGATE_A, delegationSpace, 1)];
    balances[SNAPSHOT_DELEGATOR] = 100;

    expect(await run([DELEGATE_A, DELEGATE_B], { delegationSpace })).toEqual({
      [DELEGATE_A]: 100,
      [DELEGATE_B]: 0
    });
  });

  it('excludes the zero address from Voting contract reads', async () => {
    subgraphRows = [row(SNAPSHOT_DELEGATOR, DELEGATE_A, GLOBAL, 1)];
    balances[SNAPSHOT_DELEGATOR] = 100;

    expect(await run([DELEGATE_A, DELEGATE_B, ZERO_ADDRESS])).toEqual({
      [DELEGATE_A]: 100,
      [DELEGATE_B]: 0,
      [ZERO_ADDRESS]: 0
    });
    // getVotingDelegators(network, provider, votingContract, addresses, blockTag)
    expect(mockGetVotingDelegators.mock.calls[0][3]).toEqual([
      DELEGATE_A,
      DELEGATE_B
    ]);
  });
});
