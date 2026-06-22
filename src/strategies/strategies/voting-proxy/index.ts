import { getScoresDirect } from '../../utils';
import type { Snapshot } from '../../types';
import { scoreWithVotingProxy } from './proxyScoring';

const SOURCE_SELECTOR = '0x67e828bf';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

type InnerStrategy = {
  name: string;
  network?: string;
  params?: Record<string, unknown>;
};

export const supportedProtocols = ['evm'];

export async function strategy(
  space,
  network,
  provider,
  addresses,
  options,
  snapshot: Snapshot
): Promise<Record<string, number>> {
  const strategies = options?.strategies;
  if (!Array.isArray(strategies) || !strategies.length) {
    throw new Error('voting-proxy requires at least one inner strategy');
  }

  return scoreWithVotingProxy({
    addresses,
    scoreInner: scoringAddresses =>
      scoreStrategies(
        space,
        network,
        provider,
        scoringAddresses,
        strategies,
        snapshot
      ),
    resolveSources: proxies => resolveSources(provider, proxies, snapshot)
  });
}

async function scoreStrategies(
  space: string,
  network: string,
  provider,
  addresses: string[],
  strategies: InnerStrategy[],
  snapshot: Snapshot
): Promise<Record<string, number>> {
  const totals = Object.fromEntries(addresses.map(address => [address, 0]));
  const scoresByStrategy = await getScoresDirect(
    space,
    strategies,
    network,
    provider,
    addresses,
    snapshot
  );

  for (const scores of scoresByStrategy) {
    for (const [address, score] of Object.entries(scores)) {
      totals[address] = (totals[address] ?? 0) + Number(score);
    }
  }

  return totals;
}

async function resolveSources(
  provider,
  addresses: string[],
  snapshot: Snapshot
): Promise<Record<string, string>> {
  if (!provider?.call) return {};

  const blockTag = typeof snapshot === 'number' ? snapshot : 'latest';
  const entries = await Promise.all(
    addresses.map(async address => {
      try {
        const source = decodeSource(
          await provider.call({ to: address, data: SOURCE_SELECTOR }, blockTag)
        );

        return source && source !== ZERO_ADDRESS
          ? [address, source]
          : undefined;
      } catch {
        return undefined;
      }
    })
  );

  return Object.fromEntries(
    entries.filter((entry): entry is [string, string] => !!entry)
  );
}

function decodeSource(result: string): string | undefined {
  return /^0x[0-9a-fA-F]{64}$/.test(result)
    ? `0x${result.slice(26).toLowerCase()}`
    : undefined;
}
