import { getAddress } from '@ethersproject/address';
import { formatUnits } from '@ethersproject/units';
import { Interface } from '@ethersproject/abi';
import { Contract } from '@ethersproject/contracts';
import { JsonRpcProvider } from '@ethersproject/providers';

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
    return (liq * (current - lower)) / (2n ** 96n);
  }
  return (liq * (upper - lower)) / (2n ** 96n);
}

async function multicall(
  provider: JsonRpcProvider,
  abi: string[],
  calls: [string, string, any[]][]
): Promise<any[]> {
  const iface = new Interface(abi);
  const results: any[] = [];

  for (const [address, method, params] of calls) {
    const contract = new Contract(address, abi, provider);
    try {
      const result = await contract[method](...params);
      results.push([[...(Array.isArray(result) ? result : [result])]]);
    } catch (err: any) {
      console.warn(`Multicall failed for ${method} on ${address}:`, err?.message);
      results.push([[undefined]]);
    }
  }

  return results;
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

const provider = new JsonRpcProvider(
  'https://developer-access-mainnet.base.org',
  {
    name: 'base',
    chainId: 8453
  }
);


  const [[slot0Result]] = await multicall(provider, POOL_ABI, [
    [options.poolAddress, 'slot0', []]
  ]);

  if (!slot0Result || !slot0Result[0]) {
    throw new Error('❌ Failed to fetch slot0() from the pool contract.');
  }

  const sqrtPriceX96 = BigInt(slot0Result[0]);

  for (const address of addresses) {
    const [[balanceResult]] = await multicall(provider, POSITION_MANAGER_ABI, [
      [options.positionManager, 'balanceOf', [address]]
    ]);

    const balance = Number(balanceResult);
    if (!balance) {
      results[getAddress(address)] = 0;
      continue;
    }

    const tokenIdsCall: [string, string, any[]][] = [];
    for (let i = 0; i < balance; i++) {
      tokenIdsCall.push([options.positionManager, 'tokenOfOwnerByIndex', [address, i]]);
    }

    const tokenIdsRaw = await multicall(provider, POSITION_MANAGER_ABI, tokenIdsCall);
    const tokenIds = tokenIdsRaw.map(([[id]]) => id);

    const positionsCall = tokenIds.map(
      (tokenId) => [options.positionManager, 'positions', [tokenId]] as [string, string, any[]]
    );
    const positions = await multicall(provider, POSITION_MANAGER_ABI, positionsCall);

    let total = 0n;

    for (const [[, , , token1, fee, tickLower, tickUpper, liquidity, , , , tokensOwed1]] of positions) {
      if (
        token1.toLowerCase() !== options.tokenAddress.toLowerCase() ||
        Number(fee) !== options.feeTier
      ) {
        continue;
      }

      const sqrtLower = Math.floor(Math.sqrt(1.0001 ** Number(tickLower)) * 2 ** 96);
      const sqrtUpper = Math.floor(Math.sqrt(1.0001 ** Number(tickUpper)) * 2 ** 96);

      const amount1 = getAmount1ForLiquidity(sqrtLower, sqrtUpper, sqrtPriceX96, liquidity);
      const votingPower = amount1 + BigInt(tokensOwed1);

      total += votingPower;
    }

    results[getAddress(address)] = parseFloat(formatUnits(total.toString(), 18));
  }

  return results;
};
