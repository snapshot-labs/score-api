import { Interface } from '@ethersproject/abi';
import networks from '@snapshot-labs/snapshot.js/src/networks.json';
import { strategy } from '../../../src/strategies/strategies/voting-proxy';
import { scoreWithVotingProxy } from '../../../src/strategies/strategies/voting-proxy/proxyScoring';
import { getScoresDirect } from '../../../src/strategies/utils';

jest.mock('../../../src/strategies/utils', () => ({
  getScoresDirect: jest.fn()
}));

const direct = address('10');
const source = address('20');
const proxyHigh = address('30');
const proxyLow = address('11');
const zeroAddress = address('00');
const aggregateInterface = new Interface([
  'function aggregate(tuple(address target, bytes callData)[] calls) view returns (uint256 blockNumber, bytes[] returnData)'
]);
const sourceInterface = new Interface([
  'function source() view returns (address)'
]);
const sourceCalldata = sourceInterface.encodeFunctionData('source', []);
type ProviderCallTx = { to: string; data: string };
type ProviderCall = [ProviderCallTx, number | 'latest'];

const getScoresDirectMock = jest.mocked(getScoresDirect);

describe('voting-proxy scoring', () => {
  it('returns source voting power for a zero-vp proxy voter', async () => {
    const { result } = await scoreFixture({
      addresses: [proxyHigh],
      directScores: { [proxyHigh]: 0 },
      sourceByProxy: { [proxyHigh]: source },
      sourceScores: { [source]: 12 }
    });

    expect(result).toEqual({ [proxyHigh]: 12 });
  });

  it('keeps direct scores and only resolves zero-vp proxy candidates', async () => {
    const { result, scoredAddressSets, resolvedAddressSets } =
      await scoreFixture({
        addresses: [direct, proxyHigh],
        directScores: { [direct]: 7, [proxyHigh]: 0 },
        sourceByProxy: { [proxyHigh]: source },
        sourceScores: { [source]: 12 }
      });

    expect(result).toEqual({ [direct]: 7, [proxyHigh]: 12 });
    expect(scoredAddressSets).toEqual([[direct, proxyHigh], [source]]);
    expect(resolvedAddressSets).toEqual([[proxyHigh]]);
  });

  it('deduplicates voters resolving to the same source', async () => {
    const { result, scoredAddressSets } = await scoreFixture({
      addresses: [proxyHigh, proxyLow],
      directScores: { [proxyHigh]: 0, [proxyLow]: 0 },
      sourceByProxy: { [proxyHigh]: source, [proxyLow]: source },
      sourceScores: { [source]: 12 }
    });

    expect(result).toEqual({ [proxyHigh]: 0, [proxyLow]: 12 });
    expect(scoredAddressSets).toEqual([[proxyHigh, proxyLow], [source]]);
  });

  it('lets a direct source voter win over its proxy', async () => {
    const { result } = await scoreFixture({
      addresses: [source, proxyHigh],
      directScores: { [source]: 12, [proxyHigh]: 0 },
      sourceByProxy: { [proxyHigh]: source },
      sourceScores: { [source]: 12 }
    });

    expect(result).toEqual({ [source]: 12, [proxyHigh]: 0 });
  });
});

describe('voting-proxy strategy', () => {
  beforeEach(() => {
    getScoresDirectMock.mockReset();
  });

  it('resolves zero-vp proxy sources with one multicall at the snapshot block', async () => {
    const provider = createProvider([source]);
    getScoresDirectMock
      .mockResolvedValueOnce([{ [proxyHigh]: 0 }])
      .mockResolvedValueOnce([{ [source]: 12 }]);

    await expect(scoreStrategy(provider, [proxyHigh], 123)).resolves.toEqual({
      [proxyHigh]: 12
    });
    expect(provider.call).toHaveBeenCalledTimes(1);
    expect(firstProviderCall(provider)[0].to).toBe(networks['1'].multicall);
    expect(firstProviderCall(provider)[1]).toBe(123);
    expect(decodeAggregateCalls(provider)).toEqual([
      [proxyHigh.toLowerCase(), sourceCalldata]
    ]);
    expect(getScoresDirectMock).toHaveBeenNthCalledWith(
      2,
      'space',
      [{ name: 'fixed-score' }],
      '1',
      provider,
      [source],
      123
    );
  });

  it('keeps malformed and zero source results unresolved', async () => {
    getScoresDirectMock.mockResolvedValueOnce([{ [proxyHigh]: 0 }]);
    const provider = createProvider(['malformed', zeroAddress]);

    await expect(
      scoreStrategy(provider, [proxyHigh, proxyLow], 123)
    ).resolves.toEqual({
      [proxyHigh]: 0,
      [proxyLow]: 0
    });
    expect(getScoresDirectMock).toHaveBeenCalledTimes(1);
  });

  it('decodes aggregate source results and uses latest for non-number snapshots', async () => {
    const provider = createProvider([source]);
    getScoresDirectMock
      .mockResolvedValueOnce([{ [proxyHigh]: 0 }])
      .mockResolvedValueOnce([{ [source]: 12 }]);

    await expect(
      scoreStrategy(provider, [proxyHigh], 'latest')
    ).resolves.toEqual({
      [proxyHigh]: 12
    });
    expect(firstProviderCall(provider)[1]).toBe('latest');
  });

  it('treats failed multicalls and missing providers as unresolved sources', async () => {
    getScoresDirectMock.mockResolvedValue([{ [proxyHigh]: 0 }]);
    const provider = createProvider([], new Error('not a contract'));

    await expect(scoreStrategy(provider, [proxyHigh], 123)).resolves.toEqual({
      [proxyHigh]: 0
    });
    await expect(scoreStrategy(null, [proxyHigh], 123)).resolves.toEqual({
      [proxyHigh]: 0
    });
  });
});

function address(byte: string): string {
  return `0x${byte.repeat(20)}`;
}

function createProvider(sourceResults: Array<string>, error?: Error) {
  return {
    call: jest.fn<Promise<string>, ProviderCall>(async () => {
      if (error) throw error;

      return aggregateInterface.encodeFunctionResult('aggregate', [
        123,
        sourceResults.map(encodeSourceResult)
      ]);
    })
  };
}

function encodeSourceResult(sourceResult: string): string {
  if (sourceResult === 'malformed') return '0x1234';
  return sourceInterface.encodeFunctionResult('source', [sourceResult]);
}

function firstProviderCall(
  provider: ReturnType<typeof createProvider>
): ProviderCall {
  return provider.call.mock.calls[0] as ProviderCall;
}

function decodeAggregateCalls(
  provider: ReturnType<typeof createProvider>
): string[][] {
  const calls = aggregateInterface.decodeFunctionData(
    'aggregate',
    firstProviderCall(provider)[0].data
  )[0];

  return Array.from(calls as unknown as Array<[string, string]>).map(
    ([target, data]) => [target, data]
  );
}

async function scoreFixture({
  addresses,
  directScores = {},
  sourceByProxy = {},
  sourceScores = {}
}) {
  const scoredAddressSets: string[][] = [];
  const resolvedAddressSets: string[][] = [];
  let scoreCalls = 0;

  const result = await scoreWithVotingProxy({
    addresses,
    scoreInner: async scoringAddresses => {
      scoredAddressSets.push(scoringAddresses);
      scoreCalls += 1;

      return scoreCalls === 1 ? directScores : sourceScores;
    },
    resolveSources: async sourceCandidates => {
      resolvedAddressSets.push(sourceCandidates);

      return sourceByProxy;
    }
  });

  return { result, scoredAddressSets, resolvedAddressSets };
}

function scoreStrategy(provider, addresses: string[], snapshot) {
  return strategy(
    'space',
    '1',
    provider,
    addresses,
    { strategies: [{ name: 'fixed-score' }] },
    snapshot
  );
}
