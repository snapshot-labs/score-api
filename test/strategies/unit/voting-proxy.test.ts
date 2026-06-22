import { scoreWithVotingProxy } from '../../../src/strategies/strategies/voting-proxy/proxyScoring';

const direct = address('10');
const source = address('20');
const proxyHigh = address('30');
const proxyLow = address('11');

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

function address(byte: string): string {
  return `0x${byte.repeat(20)}`;
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
