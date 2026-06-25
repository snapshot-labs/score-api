import { Interface } from '@ethersproject/abi';
import type { Snapshot } from '../../types';
import { getScoresDirect } from '../../utils';
import { scoreWithVotingProxy } from './proxyScoring';

const MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11';
const MULTICALL3_ABI = [
  'function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) view returns (tuple(bool success, bytes returnData)[] returnData)'
];
const SOURCE_ABI = ['function source() view returns (address)'];
const SOURCE_PAGE_SIZE = 200;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const multicallInterface = new Interface(MULTICALL3_ABI);
const sourceInterface = new Interface(SOURCE_ABI);

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
  const proxies = options?.proxies;
  if (!Array.isArray(proxies) || !proxies.length) {
    throw new Error('voting-proxy requires at least one proxy');
  }
  const proxyKeys = new Set(proxies.map(addressKey));

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
    resolveSources: candidates =>
      resolveSources(
        provider,
        candidates.filter(address => proxyKeys.has(addressKey(address))),
        snapshot
      )
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
  const sources = await callSourceMulticall(provider, addresses, blockTag);

  const entries = addresses.map((address, i) => {
    const source = normalizeSource(sources[i]);
    return source && source !== ZERO_ADDRESS ? [address, source] : undefined;
  });

  return Object.fromEntries(
    entries.filter((entry): entry is [string, string] => !!entry)
  );
}

function normalizeSource(value: unknown): string | undefined {
  const source = Array.isArray(value) ? value[0] : value;
  return typeof source === 'string' && /^0x[0-9a-fA-F]{40}$/.test(source)
    ? source.toLowerCase()
    : undefined;
}

async function callSourceMulticall(
  provider,
  addresses: string[],
  blockTag: number | 'latest'
): Promise<unknown[]> {
  const pages = Math.ceil(addresses.length / SOURCE_PAGE_SIZE);
  const results = await Promise.all(
    Array.from({ length: pages }, (_, i) =>
      callSourceMulticallPage(
        provider,
        addresses.slice(i * SOURCE_PAGE_SIZE, (i + 1) * SOURCE_PAGE_SIZE),
        blockTag
      )
    )
  );

  return results.flat();
}

async function callSourceMulticallPage(
  provider,
  addresses: string[],
  blockTag: number | 'latest'
): Promise<unknown[]> {
  const result = await provider.call(
    {
      to: MULTICALL3_ADDRESS,
      data: multicallInterface.encodeFunctionData('aggregate3', [
        addresses.map(address => [
          address.toLowerCase(),
          true,
          sourceInterface.encodeFunctionData('source', [])
        ])
      ])
    },
    blockTag
  );

  const [returnData] = multicallInterface.decodeFunctionResult(
    'aggregate3',
    result
  ) as [unknown[]];

  return returnData.map(decodeSourceResult);
}

function decodeSourceResult(result): string | undefined {
  const success = result.success ?? result[0];
  const returnData = result.returnData ?? result[1];
  if (!success || typeof returnData !== 'string') return undefined;

  try {
    return sourceInterface.decodeFunctionResult('source', returnData)[0];
  } catch {
    return undefined;
  }
}

function addressKey(address: string): string {
  return address.toLowerCase();
}
