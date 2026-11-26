import { defaultAbiCoder } from '@ethersproject/abi';
import { keccak256 } from '@ethersproject/keccak256';
import { toUtf8Bytes } from '@ethersproject/strings';
import { verifyTypedData, Wallet } from '@ethersproject/wallet';
import { capture } from '@snapshot-labs/snapshot-sentry';
import { getProvider } from './helpers/provider';
import {
  canonicalize,
  getSignedVp,
  NOT_FINAL_ERROR,
  verifySignedVp
} from './oracle';
import snapshot from './strategies';

jest.mock('./helpers/provider', () => ({ getProvider: jest.fn() }));
jest.mock('@snapshot-labs/snapshot-sentry', () => ({ capture: jest.fn() }));
jest.mock('./strategies', () => ({
  __esModule: true,
  default: {
    strategies: {
      'erc20-balance-of': { rawStrategy: jest.fn(), strategy: jest.fn() },
      'erc20-with-floats': { strategy: jest.fn() }
    }
  }
}));

const STRATEGY = '0x59db2D5A9dC316bdc8015172Cf80891d95E2D201';
const SAFE = Wallet.createRandom().address;
const VOTER = '0x537f1896541d28F4c70116EEa602b1B34Da95163';
const SAFE_HEAD = 12_000_100;
const owners = [Wallet.createRandom(), Wallet.createRandom()];
const rawStrategy = snapshot.strategies['erc20-balance-of']
  .rawStrategy as jest.Mock;
const provider = {
  getBlock: jest.fn(async () => ({ number: SAFE_HEAD }))
};

function hexOf(json: string) {
  return `0x${Buffer.from(json).toString('hex')}`;
}

const strategyParams = {
  address: '0x6b175474e89094c44da98b954eedeac495271d0f',
  symbol: 'DAI'
};
const strategyJson = canonicalize({
  id: 'erc20-balance-of',
  network: '11155111',
  decimals: 18,
  params: strategyParams
});
const request = {
  address: VOTER,
  network: '11155111',
  snapshot: 12_000_000,
  params: hexOf(strategyJson),
  strategy: STRATEGY
};

// The digest exactly as OracleVotingStrategy computes it, without the ethers typed data encoder
function contractDigest(vp: bigint) {
  const domainSeparator = keccak256(
    defaultAbiCoder.encode(
      ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
      [
        keccak256(
          toUtf8Bytes(
            'EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)'
          )
        ),
        keccak256(toUtf8Bytes('snapshot-x')),
        keccak256(toUtf8Bytes('1.0.0')),
        11155111,
        STRATEGY
      ]
    )
  );
  const structHash = keccak256(
    defaultAbiCoder.encode(
      ['bytes32', 'bytes32', 'uint256', 'uint32', 'address'],
      [
        keccak256(
          toUtf8Bytes(
            'Score(bytes params,uint256 votingPower,uint32 blockNumber,address voter)'
          )
        ),
        keccak256(request.params),
        vp,
        request.snapshot,
        VOTER
      ]
    )
  );
  return keccak256(`0x1901${domainSeparator.slice(2)}${structHash.slice(2)}`);
}

describe('get_signed_vp', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ORACLE_SAFE_ADDRESS = SAFE;
    process.env.ORACLE_OWNER_PRIVATE_KEYS = owners
      .map(o => o.privateKey)
      .join(',');
    (getProvider as jest.Mock).mockReturnValue(provider);
    rawStrategy.mockResolvedValue({ [VOTER]: 1_514_415_861_332_052_753n });
  });

  it('signs the exact raw voting power as the Safe, owner signatures sorted by address', async () => {
    const { result } = await getSignedVp(request);

    // A balance a float can't hold exactly is signed to the wei
    expect(result.vp).toBe('1514415861332052753');
    const signatures = result.signature.slice(2).match(/.{130}/g)!;
    expect(signatures).toHaveLength(2);
    const recovered = signatures.map(s =>
      verifyTypedData(
        { chainId: 11155111, verifyingContract: SAFE },
        { SafeMessage: [{ name: 'message', type: 'bytes' }] },
        { message: contractDigest(1_514_415_861_332_052_753n) },
        `0x${s}`
      )
    );
    expect(recovered).toEqual(
      owners
        .map(o => o.address)
        .sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1))
    );
  });

  it('reads the strategy raw values for the voter alone, without the space id', async () => {
    await getSignedVp(request);

    expect(rawStrategy).toHaveBeenCalledWith(
      '',
      '11155111',
      provider,
      [VOTER],
      strategyParams,
      12_000_000
    );
  });

  it.each([
    ['the voter is missing from the result', {}],
    ['the strategy returns a negative value', { [VOTER]: -5n }]
  ])('signs 0 when %s', async (_, scores) => {
    rawStrategy.mockResolvedValue(scores);

    expect((await getSignedVp(request)).result.vp).toBe('0');
  });

  it('signs 0 outside the strategy block range, without reading it', async () => {
    const params = hexOf(
      canonicalize({
        id: 'erc20-balance-of',
        network: '11155111',
        decimals: 18,
        params: { ...strategyParams, start: 12_000_001 }
      })
    );

    expect((await getSignedVp({ ...request, params })).result.vp).toBe('0');
    expect(rawStrategy).not.toHaveBeenCalled();
  });

  it('refuses to sign a value that may have gone through floats', async () => {
    rawStrategy.mockResolvedValue({ [VOTER]: 1.5e18 });

    await expect(getSignedVp(request)).rejects.toThrow(
      'strategy erc20-balance-of returned inexact voting power'
    );
  });

  it('refuses to sign when the oracle is not configured', async () => {
    delete process.env.ORACLE_OWNER_PRIVATE_KEYS;

    await expect(getSignedVp(request)).rejects.toThrow(
      'oracle is not configured'
    );
  });

  it.each([
    ['one character missing', (key: string) => key.slice(0, -1)],
    ['one character too many', (key: string) => `${key}0`],
    ['quotes', (key: string) => `"${key}"`]
  ])('never echoes an owner key with %s in its error', async (_, mangle) => {
    process.env.ORACLE_OWNER_PRIVATE_KEYS = mangle(owners[0].privateKey);

    const error = await getSignedVp(request).catch(err => err);
    expect(error.message).toBe('oracle is not configured correctly');
    expect(JSON.stringify(error)).not.toContain(
      owners[0].privateKey.slice(2, 40)
    );
  });

  it('logs what it signs, without keys', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    await getSignedVp(request);

    const line = log.mock.calls.map(c => c.join(' ')).join('\n');
    expect(line).toContain('[oracle] signed');
    expect(line).toContain(keccak256(request.params));
    expect(line).toContain('1514415861332052753');
    for (const owner of owners) {
      expect(line).not.toContain(owner.privateKey.slice(2));
    }
    log.mockRestore();
  });
});

describe('verifySignedVp', () => {
  const withJson = (json: string) => ({ ...request, params: hexOf(json) });

  beforeEach(() => {
    (getProvider as jest.Mock).mockReturnValue(provider);
  });

  it('accepts a valid request', async () => {
    await expect(verifySignedVp(request)).resolves.toBeUndefined();
  });

  it('refuses a block above the safe head, as a request error', async () => {
    await expect(
      verifySignedVp({ ...request, snapshot: SAFE_HEAD + 1 })
    ).rejects.toThrow(NOT_FINAL_ERROR);
  });

  it('reads the safe head once, however many requests come in at once', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 60_000);
    provider.getBlock.mockClear();

    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        verifySignedVp({ ...request, snapshot: SAFE_HEAD + 1 })
      )
    );

    expect(results.every(r => r.status === 'rejected')).toBe(true);
    expect(provider.getBlock).toHaveBeenCalledTimes(1);
    now.mockRestore();
  });

  it('reports a safe head it cannot read, and reads it again next time', async () => {
    (capture as jest.Mock).mockClear();
    const now = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 120_000);
    provider.getBlock.mockClear();
    provider.getBlock.mockRejectedValueOnce(new Error('rpc down'));

    await expect(
      verifySignedVp({ ...request, snapshot: SAFE_HEAD + 1 })
    ).rejects.toThrow('rpc down');
    await expect(
      verifySignedVp({ ...request, snapshot: SAFE_HEAD + 1 })
    ).rejects.toThrow(NOT_FINAL_ERROR);
    expect(provider.getBlock).toHaveBeenCalledTimes(2);
    expect(capture).toHaveBeenCalledTimes(1);
    now.mockRestore();
  });

  it.each([
    ['an invalid voter', { address: '0x123' }, 'invalid address'],
    [
      'a Starknet address',
      {
        address:
          '0x07bd3419669f9f0cc8f19e9e2457089cdd4804a4c41a5729ee9c7fd02ab8ab62'
      },
      'invalid address'
    ],
    [
      'a bad checksum',
      { address: '0x537F1896541d28F4c70116EEa602b1B34Da95163' },
      'invalid address'
    ],
    ['several voters', { address: [VOTER, VOTER] }, 'invalid address'],
    ['an unsupported network', { network: '1' }, 'unsupported oracle strategy'],
    [
      'an unknown strategy contract',
      { strategy: '0x0000000000000000000000000000000000000001' },
      'unsupported oracle strategy'
    ],
    ['a zero snapshot', { snapshot: 0 }, 'invalid snapshot'],
    ['a fractional snapshot', { snapshot: 1.5 }, 'invalid snapshot'],
    ['a string snapshot', { snapshot: '12000000' }, 'invalid snapshot'],
    ['non hex params', { params: 'erc20' }, 'invalid oracle params'],
    [
      'params over the size limit',
      {
        params: hexOf(
          canonicalize({
            id: 'erc20-balance-of',
            network: '11155111',
            decimals: 18,
            params: { a: 'x'.repeat(20_000) }
          })
        )
      },
      'invalid oracle params'
    ]
  ])('rejects %s', async (_, override, error) => {
    await expect(
      verifySignedVp({ ...request, ...(override as any) })
    ).rejects.toThrow(error);
  });

  it.each([
    ['whitespace', strategyJson.replace(':', ': ')],
    [
      'unsorted keys',
      JSON.stringify({
        network: '11155111',
        id: 'erc20-balance-of',
        decimals: 18,
        params: strategyParams
      })
    ],
    [
      'unsorted nested keys',
      strategyJson.replace(
        '{"address":"0x6b175474e89094c44da98b954eedeac495271d0f","symbol":"DAI"}',
        '{"symbol":"DAI","address":"0x6b175474e89094c44da98b954eedeac495271d0f"}'
      )
    ]
  ])('rejects params with %s, which are not canonical', async (_, json) => {
    await expect(verifySignedVp(withJson(json))).rejects.toThrow(
      'oracle params are not canonical'
    );
  });

  it.each([
    [
      'the legacy name key',
      {
        name: 'erc20-balance-of',
        network: '11155111',
        decimals: 18,
        params: {}
      }
    ],
    [
      'no decimals',
      { id: 'erc20-balance-of', network: '11155111', params: {} }
    ],
    [
      'fractional decimals',
      { id: 'erc20-balance-of', network: '11155111', decimals: 1.5, params: {} }
    ],
    [
      'negative decimals',
      { id: 'erc20-balance-of', network: '11155111', decimals: -1, params: {} }
    ],
    [
      'an extra key',
      {
        id: 'erc20-balance-of',
        network: '11155111',
        decimals: 18,
        params: {},
        space: 'x.eth'
      }
    ],
    [
      'array params',
      { id: 'erc20-balance-of', network: '11155111', decimals: 18, params: [] }
    ],
    [
      'null params',
      {
        id: 'erc20-balance-of',
        network: '11155111',
        decimals: 18,
        params: null
      }
    ],
    ['a number', 42],
    ['null', null]
  ])('rejects params with %s', async (_, value) => {
    await expect(verifySignedVp(withJson(canonicalize(value)))).rejects.toThrow(
      'invalid oracle params'
    );
  });

  it('rejects params that are not JSON', async () => {
    await expect(
      verifySignedVp({ ...request, params: '0xdeadbeef' })
    ).rejects.toThrow();
  });

  it('rejects a strategy on another network than the oracle', async () => {
    const json = canonicalize({
      id: 'erc20-balance-of',
      network: '1',
      decimals: 18,
      params: strategyParams
    });

    await expect(verifySignedVp(withJson(json))).rejects.toThrow(
      'strategy network must be the oracle network'
    );
  });

  it.each(['erc20-with-floats', 'unknown-strategy'])(
    'rejects %s, which has no exact voting power',
    async id => {
      const json = canonicalize({
        id,
        network: '11155111',
        decimals: 18,
        params: strategyParams
      });

      await expect(verifySignedVp(withJson(json))).rejects.toThrow(
        `strategy ${id} has no exact voting power`
      );
    }
  );
});

describe('canonicalize', () => {
  it('sorts keys at every level and keeps array order', () => {
    expect(canonicalize({ b: 1, a: { d: [3, { f: 1, e: 2 }], c: 'x' } })).toBe(
      '{"a":{"c":"x","d":[3,{"e":2,"f":1}]},"b":1}'
    );
  });
});
