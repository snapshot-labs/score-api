import { Interface } from '@ethersproject/abi';
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
const multicall3Address = '0xcA11bde05977b3631167028862bE2a173976CA11';
const sourcePageSize = 200;
const aggregate3Interface = new Interface([
  'function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) view returns (tuple(bool success, bytes returnData)[] returnData)'
]);
const sourceInterface = new Interface([
  'function source() view returns (address)'
]);
const sourceCalldata = sourceInterface.encodeFunctionData('source', []);
type ProviderCallTx = { to: string; data: string };
type ProviderCall = [ProviderCallTx, number | 'latest'];
type SourceResult = string | 'failed' | 'malformed';

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

  it('lets a proxy use the source score when the direct source voter has no score', async () => {
    const { result } = await scoreFixture({
      addresses: [source, proxyHigh],
      directScores: { [source]: 0, [proxyHigh]: 0 },
      sourceByProxy: { [proxyHigh]: source },
      sourceScores: { [source]: 12 }
    });

    expect(result).toEqual({ [source]: 0, [proxyHigh]: 12 });
  });
});

describe('voting-proxy strategy', () => {
  beforeEach(() => {
    getScoresDirectMock.mockReset();
  });

  it('requires at least one configured proxy', async () => {
    await expect(
      strategy(
        'space',
        '1',
        null,
        [proxyHigh],
        { strategies: [{ name: 'fixed-score' }] },
        123
      )
    ).rejects.toThrow('voting-proxy requires at least one proxy');
  });

  it('resolves zero-vp proxy sources with multicall3 allowFailure at the snapshot block', async () => {
    const provider = createProvider([source]);
    getScoresDirectMock
      .mockResolvedValueOnce([{ [proxyHigh]: 0 }])
      .mockResolvedValueOnce([{ [source]: 12 }]);

    await expect(scoreStrategy(provider, [proxyHigh], 123)).resolves.toEqual({
      [proxyHigh]: 12
    });
    expect(provider.call).toHaveBeenCalledTimes(1);
    expect(firstProviderCall(provider)[0].to).toBe(multicall3Address);
    expect(firstProviderCall(provider)[1]).toBe(123);
    expect(decodeAggregate3Calls(provider)).toEqual([
      [proxyHigh.toLowerCase(), true, sourceCalldata]
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

  it('ignores source lookups from voters outside the configured proxies', async () => {
    const provider = createProvider([source]);
    getScoresDirectMock
      .mockResolvedValueOnce([{ [proxyHigh]: 0, [proxyLow]: 0 }])
      .mockResolvedValueOnce([{ [source]: 12 }]);

    await expect(
      scoreStrategy(provider, [proxyHigh, proxyLow], 123, {
        proxies: [proxyLow]
      })
    ).resolves.toEqual({
      [proxyHigh]: 0,
      [proxyLow]: 12
    });
    expect(decodeAggregate3Calls(provider)).toEqual([
      [proxyLow.toLowerCase(), true, sourceCalldata]
    ]);
  });

  it('keeps successful source results when other multicall3 calls fail', async () => {
    const provider = createProvider(['failed', source]);
    getScoresDirectMock
      .mockResolvedValueOnce([{ [proxyHigh]: 0, [proxyLow]: 0 }])
      .mockResolvedValueOnce([{ [source]: 12 }]);

    await expect(
      scoreStrategy(provider, [proxyHigh, proxyLow], 123)
    ).resolves.toEqual({
      [proxyHigh]: 0,
      [proxyLow]: 12
    });
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

  it('pages source lookups through multicall3', async () => {
    const proxies = Array.from({ length: sourcePageSize + 1 }, (_, i) =>
      numberedAddress(i + 1)
    );
    const sources = proxies.map((_, i) => numberedAddress(i + 1000));
    const directScores = Object.fromEntries(proxies.map(proxy => [proxy, 0]));
    const sourceScores = Object.fromEntries(
      sources.map(sourceAddress => [sourceAddress, 1])
    );
    const provider = createProvider(sources);

    getScoresDirectMock
      .mockResolvedValueOnce([directScores])
      .mockResolvedValueOnce([sourceScores]);

    await scoreStrategy(provider, proxies, 123);

    expect(provider.call).toHaveBeenCalledTimes(2);
    expect(decodeAggregate3Calls(provider, 0)).toHaveLength(sourcePageSize);
    expect(decodeAggregate3Calls(provider, 1)).toHaveLength(1);
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

  it('decodes aggregate3 source results and uses latest for non-number snapshots', async () => {
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

  it('propagates multicall3 transport failures', async () => {
    getScoresDirectMock.mockResolvedValue([{ [proxyHigh]: 0 }]);
    const provider = createProvider([], new Error('rpc failed'));

    await expect(scoreStrategy(provider, [proxyHigh], 123)).rejects.toThrow(
      'rpc failed'
    );
  });

  it('treats missing providers as unresolved sources', async () => {
    getScoresDirectMock.mockResolvedValue([{ [proxyHigh]: 0 }]);

    await expect(scoreStrategy(null, [proxyHigh], 123)).resolves.toEqual({
      [proxyHigh]: 0
    });
  });
});

function address(byte: string): string {
  return `0x${byte.repeat(20)}`;
}

function numberedAddress(value: number): string {
  return `0x${value.toString(16).padStart(40, '0')}`;
}

function createProvider(sourceResults: SourceResult[], error?: Error) {
  let resultIndex = 0;

  return {
    call: jest.fn<Promise<string>, ProviderCall>(async ({ data }) => {
      if (error) throw error;

      const calls = aggregate3Interface.decodeFunctionData(
        'aggregate3',
        data
      )[0];
      const pageResults = sourceResults.slice(
        resultIndex,
        resultIndex + calls.length
      );
      resultIndex += calls.length;

      return aggregate3Interface.encodeFunctionResult('aggregate3', [
        pageResults.map(encodeAggregate3Result)
      ]);
    })
  };
}

function encodeAggregate3Result(sourceResult: SourceResult): [boolean, string] {
  if (sourceResult === 'failed') return [false, '0x'];
  if (sourceResult === 'malformed') return [true, '0x1234'];
  return [true, encodeSourceResult(sourceResult)];
}

function encodeSourceResult(sourceResult: string): string {
  return sourceInterface.encodeFunctionResult('source', [sourceResult]);
}

function firstProviderCall(
  provider: ReturnType<typeof createProvider>
): ProviderCall {
  return provider.call.mock.calls[0] as ProviderCall;
}

function decodeAggregate3Calls(
  provider: ReturnType<typeof createProvider>,
  callIndex = 0
): Array<[string, boolean, string]> {
  const calls = aggregate3Interface.decodeFunctionData(
    'aggregate3',
    (provider.call.mock.calls[callIndex] as ProviderCall)[0].data
  )[0];

  return Array.from(calls as unknown as Array<[string, boolean, string]>).map(
    ([target, allowFailure, data]) => [target, allowFailure, data]
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

function scoreStrategy(
  provider,
  addresses: string[],
  snapshot,
  options: Record<string, unknown> = {}
) {
  return strategy(
    'space',
    '1',
    provider,
    addresses,
    { proxies: addresses, strategies: [{ name: 'fixed-score' }], ...options },
    snapshot
  );
}
