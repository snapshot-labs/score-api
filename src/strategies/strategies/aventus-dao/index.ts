import { formatUnits } from '@ethersproject/units';
import { strategy as erc20BalanceOfStrategy } from '../erc20-balance-of';

const AVN_RPC_URL = 'https://avn-parachain.mainnet.aventus.io';
const AVT_TOKEN_ADDRESS = '0x0d88eD6E74bbFD96B831231638b66C05571e824F';
const AVT_DECIMALS = 18;
const MAX_BATCH_SIZE = 500;

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
  _network: string,
  provider: any,
  addresses: string[],
  _options: any,
  snapshot: number | string
): Promise<Record<string, number>> {
  if (!addresses.length) {
    return {};
  }

  const blockTag = typeof snapshot === 'number' ? snapshot : 'latest';

  const erc20ScoresPromise = erc20BalanceOfStrategy(
    _space,
    _network,
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
