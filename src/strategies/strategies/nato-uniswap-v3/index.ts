import { getAddress } from '@ethersproject/address';
import { formatUnits } from '@ethersproject/units';
import { Multicaller } from '../../utils';

const POSITION_MANAGER_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)'
];

const POOL_ABI = [
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)'
];

function getAmount1ForLiquidity(
  sqrtLower: number,
  sqrtUpper: number,
  sqrtPriceCurrent: bigint,
  liquidity: bigint
): bigint {
  const lower = BigInt(sqrtLower);
  const upper = BigInt(sqrtUpper);
  const current = BigInt(sqrtPriceCurrent);
  const liq = BigInt(liquidity);

  if (current <= lower) return 0n;
  if (current < upper) {
    return (liq * (current - lower)) / 2n ** 96n;
  }
  return (liq * (upper - lower)) / 2n ** 96n;
}

export const strategy = async (
  _space: string,
  _network: string,
  _provider: any,
  addresses: string[],
  options: any,
  snapshot: number | 'latest'
) => {
  const results: Record<string, number> = {};
  const blockTag = typeof snapshot === 'number' ? snapshot : 'latest';

  // 1) slot0 call
  const poolCaller = new Multicaller(_network, _provider, POOL_ABI, {
    blockTag
  });
  poolCaller.call('slot0', options.poolAddress, 'slot0', []);
  const poolRes = await poolCaller.execute();
  const slot0Arr = poolRes.slot0 as any[];
  if (!slot0Arr || !slot0Arr[0])
    throw new Error('❌ Failed to fetch slot0() from pool');
  const sqrtPriceX96 = BigInt(slot0Arr[0]);

  // 2) balanceOf batch
  const balancesCaller = new Multicaller(
    _network,
    _provider,
    POSITION_MANAGER_ABI,
    { blockTag }
  );
  addresses.forEach(addr => {
    balancesCaller.call(
      `${getAddress(addr)}.balance`,
      options.positionManager,
      'balanceOf',
      [addr]
    );
  });
  const balancesRes = (await balancesCaller.execute()) as Record<
    string,
    { balance: any }
  >;

  // 3) tokenOfOwnerByIndex batch
  const tokensCaller = new Multicaller(
    _network,
    _provider,
    POSITION_MANAGER_ABI,
    { blockTag }
  );
  Object.entries(balancesRes).forEach(([addr, { balance }]) => {
    const count = Number(balance || 0);
    for (let i = 0; i < count; i++) {
      tokensCaller.call(
        `${addr}.tokenIds.${i}`,
        options.positionManager,
        'tokenOfOwnerByIndex',
        [addr, i]
      );
    }
  });
  const tokensRes = (await tokensCaller.execute()) as Record<
    string,
    { tokenIds: Record<string, any> }
  >;

  // 4) positions batch
  const positionsCaller = new Multicaller(
    _network,
    _provider,
    POSITION_MANAGER_ABI,
    { blockTag }
  );
  Object.values(tokensRes).forEach((entry: any) => {
    if (!entry?.tokenIds) return;
    Object.values(entry.tokenIds).forEach((tokenId: any) => {
      if (tokenId !== undefined) {
        positionsCaller.call(
          `pos.${tokenId}`,
          options.positionManager,
          'positions',
          [tokenId.toString()]
        );
      }
    });
  });
  const positionsRes = (await positionsCaller.execute()) as Record<
    string,
    any[]
  >;

  // 5) Aggregate results
  for (const addrRaw of addresses) {
    const addr = getAddress(addrRaw);
    const bal = balancesRes[addr]?.balance
      ? Number(balancesRes[addr].balance)
      : 0;
    if (!bal) {
      results[addr] = 0;
      continue;
    }

    const tokenIdsObj = (tokensRes[addr]?.tokenIds || {}) as Record<
      string,
      any
    >;
    const tokenIds = Object.values(tokenIdsObj)
      .map((v: any) => v?.toString())
      .filter(Boolean);

    let total = 0n;
    for (const tokenId of tokenIds) {
      const pos = positionsRes[`pos.${tokenId}`];
      if (!pos) continue;

      const [
        ,
        ,
        ,
        token1,
        fee,
        tickLower,
        tickUpper,
        liquidity,
        ,
        ,
        ,
        tokensOwed1
      ] = pos;

      if (
        String(token1).toLowerCase() !==
          String(options.tokenAddress).toLowerCase() ||
        Number(fee) !== Number(options.feeTier)
      )
        continue;

      const sqrtLower = Math.floor(
        Math.sqrt(Math.pow(1.0001, Number(tickLower))) * 2 ** 96
      );
      const sqrtUpper = Math.floor(
        Math.sqrt(Math.pow(1.0001, Number(tickUpper))) * 2 ** 96
      );

      const amount1 = getAmount1ForLiquidity(
        sqrtLower,
        sqrtUpper,
        sqrtPriceX96,
        BigInt(liquidity)
      );
      total += amount1 + BigInt(tokensOwed1);
    }

    results[addr] = parseFloat(formatUnits(total.toString(), 18));
  }

  return results;
};
