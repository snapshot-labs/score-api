import { getAddress, isAddress } from '@ethersproject/address';
import { isHexString } from '@ethersproject/bytes';
import { _TypedDataEncoder } from '@ethersproject/hash';
import { keccak256 } from '@ethersproject/keccak256';
import { toUtf8String } from '@ethersproject/strings';
import { Wallet } from '@ethersproject/wallet';
import { capture } from '@snapshot-labs/snapshot-sentry';
import { INVALID_ADDRESS_MESSAGE } from './constants';
import { getProvider } from './helpers/provider';
import snapshot from './strategies';

// Snapshot X oracle voting strategy deployments that score-api attests for, by chain id
const ORACLE_STRATEGIES: Record<string, string[]> = {
  '11155111': ['0x59db2D5A9dC316bdc8015172Cf80891d95E2D201']
};

const MAX_PARAMS_LENGTH = 20_000;
const SAFE_BLOCK_TTL = 5_000;
export const NOT_FINAL_ERROR = 'voting power is not final yet';

const SCORE_TYPES = {
  Score: [
    { name: 'params', type: 'bytes' },
    { name: 'votingPower', type: 'uint256' },
    { name: 'blockNumber', type: 'uint32' },
    { name: 'voter', type: 'address' }
  ]
};
const SAFE_MESSAGE_TYPES = {
  SafeMessage: [{ name: 'message', type: 'bytes' }]
};

interface SignedVpRequestParams {
  address: string;
  network: string;
  snapshot: number;
  // Canonical UTF-8 JSON of one Snapshot strategy, as stored onchain in the space strategy params
  params: string;
  strategy: string;
}

type OracleStrategy = {
  id: string;
  network: string;
  decimals: number;
  params: Record<string, any>;
};

const safeBlocks: Record<string, { number: number; fetchedAt: number }> = {};
const safeBlockRequests: Record<string, Promise<number>> = {};

// The oracle is a Safe. score-api holds owner keys, enough to reach its threshold
function getOracle() {
  const safe = process.env.ORACLE_SAFE_ADDRESS;
  const keys = process.env.ORACLE_OWNER_PRIVATE_KEYS;
  if (!safe || !keys) throw new Error('oracle is not configured');

  try {
    return {
      safe: getAddress(safe),
      owners: keys.split(',').map(key => new Wallet(key.trim()))
    };
  } catch {
    // ethers puts an invalid key in its error message, which would be logged and returned to the caller
    throw new Error('oracle is not configured correctly');
  }
}

// A single encoding per strategy: keys sorted at every level, no whitespace
export function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map(
        key =>
          `${JSON.stringify(key)}:${canonicalize(
            (value as Record<string, unknown>)[key]
          )}`
      )
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

function parseStrategy(params: string): OracleStrategy {
  const json = toUtf8String(params);
  const strategy = JSON.parse(json);
  if (json !== canonicalize(strategy)) {
    throw new Error('oracle params are not canonical');
  }

  if (
    strategy === null ||
    typeof strategy !== 'object' ||
    Object.keys(strategy).join(',') !== 'decimals,id,network,params' ||
    typeof strategy.id !== 'string' ||
    typeof strategy.network !== 'string' ||
    !Number.isInteger(strategy.decimals) ||
    strategy.decimals < 0 ||
    strategy.decimals > 77 ||
    strategy.params === null ||
    typeof strategy.params !== 'object' ||
    Array.isArray(strategy.params)
  ) {
    throw new Error('invalid oracle params');
  }

  return strategy;
}

// Only blocks at or below the safe head are signed, so a reorg can't leave a valid signature for
// voting power that changed
async function isSafeBlock(network: string, block: number) {
  const known = safeBlocks[network];
  if (known && block <= known.number) return true;
  if (known && Date.now() - known.fetchedAt < SAFE_BLOCK_TTL) return false;

  // One request per network at a time, however many come in at once
  safeBlockRequests[network] ??= getProvider(network)
    .getBlock('safe')
    .then(({ number }) => {
      safeBlocks[network] = { number, fetchedAt: Date.now() };
      return number;
    })
    .catch(err => {
      // Refused below as a request error, so reported here: it is the RPC failing, not the request
      capture(err, { network });
      throw err;
    })
    .finally(() => delete safeBlockRequests[network]);

  return block <= (await safeBlockRequests[network]);
}

export async function verifySignedVp(params: SignedVpRequestParams) {
  // The oracle is EVM only: score-api's address check also accepts Starknet addresses
  if (typeof params.address !== 'string' || !isAddress(params.address)) {
    throw new Error(INVALID_ADDRESS_MESSAGE);
  }
  if (!Number.isInteger(params.snapshot) || params.snapshot <= 0) {
    throw new Error('invalid snapshot');
  }

  const deployments = ORACLE_STRATEGIES[params.network] ?? [];
  if (
    typeof params.strategy !== 'string' ||
    !deployments.some(d => d.toLowerCase() === params.strategy.toLowerCase())
  ) {
    throw new Error('unsupported oracle strategy');
  }

  if (!isHexString(params.params) || params.params.length > MAX_PARAMS_LENGTH) {
    throw new Error('invalid oracle params');
  }

  const strategy = parseStrategy(params.params);
  // The block is the oracle network's, and other networks would need an external block mapping
  if (strategy.network !== params.network) {
    throw new Error('strategy network must be the oracle network');
  }

  if (!snapshot.strategies[strategy.id]?.rawStrategy) {
    throw new Error(`strategy ${strategy.id} has no exact voting power`);
  }

  // A request issue, not a server error: answered as such, and not reported to Sentry
  if (!(await isSafeBlock(params.network, params.snapshot))) {
    throw new Error(NOT_FINAL_ERROR);
  }
}

export async function getSignedVp(params: SignedVpRequestParams) {
  const oracle = getOracle();
  const strategy = parseStrategy(params.params);
  const voter = getAddress(params.address);
  const { start, end } = strategy.params;
  // Like the score API: no voting power outside the strategy's block range, or below 1
  const isActive =
    !(start > params.snapshot) && !(end && params.snapshot > end);
  const scores = isActive
    ? await snapshot.strategies[strategy.id].rawStrategy(
        '',
        params.network,
        getProvider(params.network),
        [voter],
        strategy.params,
        params.snapshot
      )
    : {};
  const raw =
    Object.entries(scores).find(
      ([address]) => address.toLowerCase() === voter.toLowerCase()
    )?.[1] ?? 0n;
  // Strategies load untyped: never sign a value that may have gone through floats
  if (typeof raw !== 'bigint') {
    throw new Error(`strategy ${strategy.id} returned inexact voting power`);
  }
  const vp = raw > 0n ? raw : 0n;

  const chainId = Number(params.network);
  const digest = _TypedDataEncoder.hash(
    {
      name: 'snapshot-x',
      version: '1.0.0',
      chainId,
      verifyingContract: getAddress(params.strategy)
    },
    SCORE_TYPES,
    {
      params: params.params,
      votingPower: vp,
      blockNumber: params.snapshot,
      voter
    }
  );

  // EIP-1271 through the Safe fallback handler: each owner signs the Safe message over the digest, and
  // the Safe expects the signatures sorted by owner address
  const signatures = await Promise.all(
    oracle.owners.map(async owner => ({
      owner: owner.address.toLowerCase(),
      signature: await owner._signTypedData(
        { chainId, verifyingContract: oracle.safe },
        SAFE_MESSAGE_TYPES,
        { message: digest }
      )
    }))
  );
  signatures.sort((a, b) => (a.owner < b.owner ? -1 : 1));

  console.log(
    '[oracle] signed',
    JSON.stringify({
      voter,
      network: params.network,
      block: params.snapshot,
      strategy: params.strategy,
      params: keccak256(params.params),
      vp: vp.toString()
    })
  );

  return {
    result: {
      vp: vp.toString(),
      signature: `0x${signatures.map(s => s.signature.slice(2)).join('')}`
    },
    cache: false
  };
}
