import { Interface } from '@ethersproject/abi';
import networks from '@snapshot-labs/snapshot.js/src/networks.json';
import type { Snapshot } from '../../types';
import { scoreWithVotingProxy } from './proxyScoring';

const MULTICALL_ABI = [
  'function aggregate(tuple(address target, bytes callData)[] calls) view returns (uint256 blockNumber, bytes[] returnData)'
];
const SOURCE_ABI = ['function source() view returns (address)'];
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const multicallInterface = new Interface(MULTICALL_ABI);
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
    resolveSources: proxies =>
      resolveSources(network, provider, proxies, snapshot)
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
  const scoresByStrategy = await getInnerScores(
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

async function getInnerScores(
  space: string,
  strategies: InnerStrategy[],
  network: string,
  provider,
  addresses: string[],
  snapshot: Snapshot
): Promise<Record<string, number>[]> {
  const { getScoresDirect } = await import('../../utils');
  return getScoresDirect(
    space,
    strategies,
    network,
    provider,
    addresses,
    snapshot
  );
}

async function resolveSources(
  network: string,
  provider,
  addresses: string[],
  snapshot: Snapshot
): Promise<Record<string, string>> {
  if (!provider) return {};
  const blockTag = typeof snapshot === 'number' ? snapshot : 'latest';

  let sources: unknown[];
  try {
    sources = await callSourceMulticall(network, provider, addresses, blockTag);
  } catch {
    return {};
  }

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
  network: string,
  provider,
  addresses: string[],
  blockTag: number | 'latest'
): Promise<unknown[]> {
  const multicallAddress = getMulticallAddress(network);
  if (!multicallAddress) return [];

  const result = await provider.call(
    {
      to: multicallAddress,
      data: multicallInterface.encodeFunctionData('aggregate', [
        addresses.map(address => [
          address.toLowerCase(),
          sourceInterface.encodeFunctionData('source', [])
        ])
      ])
    },
    blockTag
  );

  const [, returnData] = multicallInterface.decodeFunctionResult(
    'aggregate',
    result
  );

  return returnData.map(decodeSourceResult);
}

function decodeSourceResult(result: string): string | undefined {
  try {
    return sourceInterface.decodeFunctionResult('source', result)[0];
  } catch {
    return undefined;
  }
}

function getMulticallAddress(network: string): string | undefined {
  return (networks as Record<string, { multicall?: string }>)[network]
    ?.multicall;
}
