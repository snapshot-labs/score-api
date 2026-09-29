import { getAddress } from '@ethersproject/address';
import { BigNumber } from '@ethersproject/bignumber';
import { formatUnits } from '@ethersproject/units';
import { Multicaller } from '../../utils';

type SourceType = 'uniswap-v3' | 'algebra-integral';

interface PoolConfig {
  address: string;
  // Algebra Integral only: the pool deployer stored in each position (zero address for base pools)
  deployer?: string;
}

interface SourceConfig {
  type: SourceType;
  positionManager: string;
  // Contracts that hold staked position NFTs and expose balanceOf / tokenOfOwnerByIndex per user (e.g. PancakeSwap MasterChefV3)
  stakingContracts?: string[];
  pools: PoolConfig[];
}

interface PoolState {
  sqrtPriceX96: bigint;
  tick: number;
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const abi = [
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  // The fifth field is the fee tier on Uniswap v3 style managers and the pool deployer on Algebra Integral
  'function positions(uint256 tokenId) view returns (uint256 nonce, address operator, address token0, address token1, uint256 poolKey, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function fee() view returns (uint24)',
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint32 feeProtocol, bool unlocked)',
  'function globalState() view returns (uint160 price, int24 tick, uint16 lastFee, uint8 pluginConfig, uint16 communityFee, bool unlocked)'
];

const Q96 = 1n << 96n;
const MAX_UINT256 = (1n << 256n) - 1n;
const MAX_TICK = 887272;
const TICK_RATIOS: [number, bigint][] = [
  [0x2, 0xfff97272373d413259a46990580e213an],
  [0x4, 0xfff2e50f5f656932ef12357cf3c7fdccn],
  [0x8, 0xffe5caca7e10e4e61c3624eaa0941cd0n],
  [0x10, 0xffcb9843d60f6159c9db58835c926644n],
  [0x20, 0xff973b41fa98c081472e6896dfb254c0n],
  [0x40, 0xff2ea16466c96a3843ec78b326b52861n],
  [0x80, 0xfe5dee046a99a2a811c461f1969c3053n],
  [0x100, 0xfcbe86c7900a88aedcffc83b479aa3a4n],
  [0x200, 0xf987a7253ac413176f2b074cf7815e54n],
  [0x400, 0xf3392b0822b70005940c7a398e4b70f3n],
  [0x800, 0xe7159475a2c29b7443b29c7fa6e889d9n],
  [0x1000, 0xd097f3bdfd2022b8845ad8f792aa5825n],
  [0x2000, 0xa9f746462d870fdf8a65dc1f90e061e5n],
  [0x4000, 0x70d869a156d2a1b890bb3df62baf32f7n],
  [0x8000, 0x31be135f97d08fd981231505542fcfa6n],
  [0x10000, 0x9aa508b5b7a84e1c677de54f3e99bc9n],
  [0x20000, 0x5d6af8dedb81196699c329225ee604n],
  [0x40000, 0x2216e584f5fa1ea926041bedfe98n],
  [0x80000, 0x48a170391f7dc42444e8fa2n]
];

// TickMath.getSqrtRatioAtTick, identical in Uniswap v3 and Algebra
function getSqrtRatioAtTick(tick: number): bigint {
  const absTick = Math.abs(tick);
  if (absTick > MAX_TICK) throw new Error(`Tick out of range: ${tick}`);
  let ratio = absTick & 0x1 ? 0xfffcb933bd6fad37aa2d162d1a594001n : 1n << 128n;
  for (const [bit, multiplier] of TICK_RATIOS) {
    if (absTick & bit) ratio = (ratio * multiplier) >> 128n;
  }
  if (tick > 0) ratio = MAX_UINT256 / ratio;
  return (ratio >> 32n) + (ratio % (1n << 32n) === 0n ? 0n : 1n);
}

// Amounts returned by burning the whole position, rounded down as the pools do
function getTokenAmounts(
  liquidity: bigint,
  tickLower: number,
  tickUpper: number,
  pool: PoolState
): [bigint, bigint] {
  const sqrtLower = getSqrtRatioAtTick(tickLower);
  const sqrtUpper = getSqrtRatioAtTick(tickUpper);
  const { sqrtPriceX96, tick } = pool;
  if (tick < tickLower) {
    return [
      ((liquidity << 96n) * (sqrtUpper - sqrtLower)) / sqrtUpper / sqrtLower,
      0n
    ];
  }
  if (tick < tickUpper) {
    return [
      ((liquidity << 96n) * (sqrtUpper - sqrtPriceX96)) /
        sqrtUpper /
        sqrtPriceX96,
      (liquidity * (sqrtPriceX96 - sqrtLower)) / Q96
    ];
  }
  return [0n, (liquidity * (sqrtUpper - sqrtLower)) / Q96];
}

function poolKey(
  source: number,
  token0: string,
  token1: string,
  suffix: string
): string {
  return `${source}-${token0.toLowerCase()}-${token1.toLowerCase()}-${suffix.toLowerCase()}`;
}

function toAddress(value: BigNumber): string {
  return `0x${BigInt(value.toString()).toString(16).padStart(40, '0')}`;
}

export async function strategy(
  space,
  network,
  provider,
  addresses: string[],
  options,
  snapshot
): Promise<Record<string, number>> {
  const blockTag = typeof snapshot === 'number' ? snapshot : 'latest';
  const token = options.token.toLowerCase();
  const sources: SourceConfig[] = options.sources;
  sources.forEach(source => {
    if (source.type !== 'uniswap-v3' && source.type !== 'algebra-integral') {
      throw new Error(`Unsupported source type: ${source.type}`);
    }
  });
  const holdersOf = (source: SourceConfig) => [
    source.positionManager,
    ...(source.stakingContracts ?? [])
  ];

  // Request 1: position NFT counts per voter and holder contract, plus pool tokens and prices
  const first = new Multicaller(network, provider, abi, { blockTag });
  sources.forEach((source, s) => {
    holdersOf(source).forEach((holder, h) =>
      addresses.forEach((address, a) =>
        first.call(`balances.${s}.${h}.${a}`, holder, 'balanceOf', [address])
      )
    );
    source.pools.forEach((pool, p) => {
      first.call(`pools.${s}.${p}.token0`, pool.address, 'token0', []);
      first.call(`pools.${s}.${p}.token1`, pool.address, 'token1', []);
      if (source.type === 'uniswap-v3') {
        first.call(`pools.${s}.${p}.fee`, pool.address, 'fee', []);
        first.call(`pools.${s}.${p}.state`, pool.address, 'slot0', []);
      } else {
        first.call(`pools.${s}.${p}.state`, pool.address, 'globalState', []);
      }
    });
  });
  const firstResult = await first.execute();

  const pools: Record<string, PoolState> = {};
  sources.forEach((source, s) =>
    source.pools.forEach((pool, p) => {
      const data = firstResult.pools[s][p];
      const suffix =
        source.type === 'uniswap-v3'
          ? String(data.fee)
          : pool.deployer ?? ZERO_ADDRESS;
      pools[poolKey(s, data.token0, data.token1, suffix)] = {
        sqrtPriceX96: BigInt(data.state[0].toString()),
        tick: Number(data.state[1])
      };
    })
  );

  // Request 2: token IDs owned (or staked) by each voter
  const owned: { source: number; voter: number }[] = [];
  const second = new Multicaller(network, provider, abi, { blockTag });
  sources.forEach((source, s) =>
    holdersOf(source).forEach((holder, h) =>
      addresses.forEach((address, a) => {
        const count = BigNumber.from(firstResult.balances[s][h][a]).toNumber();
        for (let i = 0; i < count; i++) {
          second.call(`ids.${owned.length}`, holder, 'tokenOfOwnerByIndex', [
            address,
            i
          ]);
          owned.push({ source: s, voter: a });
        }
      })
    )
  );
  const totals = addresses.map(() => 0n);

  if (owned.length > 0) {
    const tokenIds = (await second.execute()).ids;

    // Request 3: position details
    const third = new Multicaller(network, provider, abi, { blockTag });
    owned.forEach(({ source }, i) =>
      third.call(
        `positions.${i}`,
        sources[source].positionManager,
        'positions',
        [tokenIds[i]]
      )
    );
    const positions = (await third.execute()).positions;

    owned.forEach(({ source, voter }, i) => {
      const position = positions[i];
      const token0 = position.token0.toLowerCase();
      const token1 = position.token1.toLowerCase();
      if (token0 !== token && token1 !== token) return;
      const suffix =
        sources[source].type === 'uniswap-v3'
          ? position.poolKey.toString()
          : toAddress(position.poolKey);
      const pool = pools[poolKey(source, token0, token1, suffix)];
      if (!pool) return;
      const liquidity = BigInt(position.liquidity.toString());
      if (liquidity === 0n) return;
      const [amount0, amount1] = getTokenAmounts(
        liquidity,
        Number(position.tickLower),
        Number(position.tickUpper),
        pool
      );
      totals[voter] += token0 === token ? amount0 : amount1;
    });
  }

  return Object.fromEntries(
    addresses.map((address, a) => [
      getAddress(address),
      parseFloat(formatUnits(totals[a].toString(), options.decimals))
    ])
  );
}
