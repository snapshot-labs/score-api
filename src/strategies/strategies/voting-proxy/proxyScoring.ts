type ScoreMap = Record<string, number>;
type SourceMap = Record<string, string>;

export async function scoreWithVotingProxy({
  addresses,
  scoreInner,
  resolveSources
}: {
  addresses: string[];
  scoreInner: (addresses: string[]) => Promise<ScoreMap>;
  resolveSources: (addresses: string[]) => Promise<SourceMap>;
}): Promise<ScoreMap> {
  const directScores = normalizeAddressKeys(await scoreInner(addresses));
  const proxyCandidates = addresses.filter(
    address => (directScores[addressKey(address)] ?? 0) === 0
  );
  const sourcesByProxy = normalizeAddressKeys(
    proxyCandidates.length ? await resolveSources(proxyCandidates) : {}
  );
  const winningProxyBySource = winnersBySource(
    proxyCandidates,
    sourcesByProxy,
    new Set(addresses.map(addressKey))
  );
  const sources = Object.keys(winningProxyBySource);
  const sourceScores = normalizeAddressKeys(
    sources.length ? await scoreInner(sources) : {}
  );

  return Object.fromEntries(
    addresses.map(address => [
      address,
      score(
        address,
        directScores,
        sourcesByProxy,
        winningProxyBySource,
        sourceScores
      )
    ])
  );
}

function winnersBySource(
  proxies: string[],
  sourcesByProxy: SourceMap,
  voterKeys: Set<string>
): SourceMap {
  const winners: SourceMap = {};

  for (const proxy of proxies) {
    const source = sourcesByProxy[addressKey(proxy)];
    const sourceKey = source && addressKey(source);
    if (!sourceKey || voterKeys.has(sourceKey)) continue;

    const proxyKey = addressKey(proxy);
    if (!winners[sourceKey] || proxyKey < winners[sourceKey]) {
      winners[sourceKey] = proxyKey;
    }
  }

  return winners;
}

function score(
  address: string,
  directScores: ScoreMap,
  sourcesByProxy: SourceMap,
  sourceWinners: SourceMap,
  sourceScores: ScoreMap
): number {
  const key = addressKey(address);
  const directScore = directScores[key] ?? 0;
  if (directScore !== 0) return directScore;

  const source = sourcesByProxy[key];
  if (!source) return 0;

  const sourceKey = addressKey(source);
  if (sourceWinners[sourceKey] !== key) return 0;

  return sourceScores[sourceKey] ?? 0;
}

function normalizeAddressKeys<T>(values: Record<string, T>): Record<string, T> {
  return Object.fromEntries(
    Object.entries(values).map(([address, value]) => [
      addressKey(address),
      value
    ])
  );
}

function addressKey(address: string): string {
  return address.toLowerCase();
}
