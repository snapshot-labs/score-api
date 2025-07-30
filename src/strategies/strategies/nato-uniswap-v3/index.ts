import { getAddress } from '@ethersproject/address';
import { formatUnits } from '@ethersproject/units';
import { BigNumber } from '@ethersproject/bignumber';
import { ethers } from 'ethers';

const POSITION_MANAGER_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)'
];

const POOL_ABI = [
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)'
];

function getAmount1ForLiquidity(
  sqrtLower: any,
  sqrtUpper: any,
  sqrtPriceCurrent: any,
  liquidity: any
): bigint {
  const lower = BigInt(sqrtLower);
  const upper = BigInt(sqrtUpper);
  const current = BigInt(sqrtPriceCurrent);
  const liq = BigInt(liquidity);

  if (current <= lower) return 0n;
  if (current < upper) {
    return (liq * (current - lower)) / (2n ** 96n);
  }
  return (liq * (upper - lower)) / (2n ** 96n);
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

  const poolContract = new ethers.Contract(options.poolAddress, POOL_ABI, _provider);
  const pmContract = new ethers.Contract(options.positionManager, POSITION_MANAGER_ABI, _provider);

  const slot0 = await poolContract.slot0({ blockTag });
  const sqrtPriceX96 = BigInt(slot0[0]);

  for (const address of addresses) {
    const balance = await pmContract.balanceOf(address, { blockTag });
    let total = 0n;

    for (let i = 0; i < balance; i++) {
      const tokenId = await pmContract.tokenOfOwnerByIndex(address, i, { blockTag });
      const pos = await pmContract.positions(tokenId, { blockTag });

      const token1 = pos.token1.toLowerCase();
      const fee = Number(pos.fee);

      if (token1 !== options.tokenAddress.toLowerCase() || fee !== options.feeTier) continue;

      const liquidity = pos.liquidity;
      const owed = BigInt(pos.tokensOwed1);

      const tickLower = Number(pos.tickLower);
      const tickUpper = Number(pos.tickUpper);

      const sqrtLower = Math.floor(Math.sqrt(1.0001 ** tickLower) * 2 ** 96);
      const sqrtUpper = Math.floor(Math.sqrt(1.0001 ** tickUpper) * 2 ** 96);

      const amount1 = getAmount1ForLiquidity(sqrtLower, sqrtUpper, sqrtPriceX96, liquidity);
      const votingPower = amount1 + owed;
      total += votingPower;
    }

    results[getAddress(address)] = parseFloat(formatUnits(total.toString(), 18));
  }

  return results;
};
