import { formatUnits } from '@ethersproject/units';
import { strategy as erc20BalanceOfStrategy } from '../erc20-balance-of';

const AVT_DECIMALS = 18;
const MAX_BATCH_SIZE = 500;
const MAINNET_NETWORK = '1';
const SEPOLIA_NETWORK = '11155111';

const CONFIG = {
  [MAINNET_NETWORK]: {
    avn: 'https://avn-parachain.mainnet.aventus.io',
    avt: '0x0d88eD6E74bbFD96B831231638b66C05571e824F'
  },
  [SEPOLIA_NETWORK]: {
    avn: 'https://avn-parachain.testnet.aventus.io',
    avt: '0x608156959E3a2192a870b4BaC660200afB4c649F'
  }
} as const;

type AvnBalancesResponse = {
  balances?: Record<string, string>;
};

async function callJsonRpc<T>(
  url: string,
  method: string,
  params: unknown[]
): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params
    })
  });

  const text = await res.text();
  let json: { result?: T; error?: { message?: string } };

  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON-RPC response: ${text}`);
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  if (json.error) {
    throw new Error(`${method}: ${json.error.message || 'Unknown RPC error'}`);
  }

  return json.result as T;
}

function normalizeAddress(address: string): string {
  return address.toLowerCase();
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }

  return chunks;
}

export async function strategy(
  _space: string,
  network: string,
  provider: any,
  addresses: string[],
  _options: any,
  snapshot: number | string
): Promise<Record<string, number>> {
  if (!addresses.length) {
    return {};
  }

  const config = CONFIG[network as keyof typeof CONFIG];

  if (!config) {
    throw new Error(`Unsupported network: ${network}`);
  }

  const { avn: AVN_RPC_URL, avt: AVT_TOKEN_ADDRESS } = config;

  const blockTag = typeof snapshot === 'number' ? snapshot : 'latest';

  const erc20ScoresPromise = erc20BalanceOfStrategy(
    _space,
    network,
    provider,
    addresses,
    {
      address: AVT_TOKEN_ADDRESS,
      decimals: AVT_DECIMALS
    },
    snapshot
  );

  const block = await provider.getBlock(blockTag);
  if (!block || block.timestamp == null) {
    throw new Error(
      `Unable to resolve timestamp for snapshot ${String(blockTag)}`
    );
  }

  const timestampSec = Number(block.timestamp);
  const uniqueAddresses = [...new Set(addresses.map(normalizeAddress))];
  const addressChunks = chunkArray(uniqueAddresses, MAX_BATCH_SIZE);

  const avnBalancesByAddress: Record<string, string> = {};

  for (const chunk of addressChunks) {
    const avnResponse = await callJsonRpc<AvnBalancesResponse>(
      AVN_RPC_URL,
      'avn_getLinkedBalancesAtOrBeforeTimestamp',
      [chunk, timestampSec]
    );

    for (const [address, balance] of Object.entries(
      avnResponse?.balances ?? {}
    )) {
      avnBalancesByAddress[normalizeAddress(address)] = balance;
    }
  }

  const erc20Scores = await erc20ScoresPromise;

  return Object.fromEntries(
    addresses.map(address => {
      const avnRaw = avnBalancesByAddress[normalizeAddress(address)] ?? '0';
      const avnScore = Number(formatUnits(avnRaw, AVT_DECIMALS));
      const erc20Score = erc20Scores[address] ?? 0;

      return [address, erc20Score + avnScore];
    })
  );
}
