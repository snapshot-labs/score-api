import { subgraphRequest } from '../../utils';
import { getAllReserves } from '../uniswap-v3/helper';
import { FeeAmount, Pool, Position } from '@uniswap/v3-sdk';
import { Token } from '@uniswap/sdk-core';

const UNISWAP_V3_SUBGRAPH_URL = {
  '1': 'https://subgrapher.snapshot.org/subgraph/arbitrum/5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV',
  '8453': 'https://subgrapher.snapshot.org/subgraph/arbitrum/43Hwfi3dJSoGpyas9VwNoDAv55yjgGrPpNSmbQZArzMG'
};

export const author = 'vitalii';
export const version = '0.1.0';

// Custom function to calculate total token amounts from position
function calculateTotalTokenAmounts(position: any) {
  const {
    tickLower,
    tickUpper,
    liquidity,
    pool: { tick, sqrtPrice, feeTier },
    token0,
    token1
  } = position;

  const baseToken = new Token(1, token0.id, Number(token0.decimals), token0.symbol);
  const quoteToken = new Token(1, token1.id, Number(token1.decimals), token1.symbol);
  
  const fee = Object.values(FeeAmount).includes(parseFloat(feeTier)) ? parseFloat(feeTier) : 0;
  const pool = new Pool(baseToken, quoteToken, fee, sqrtPrice, liquidity, Number(tick));
  
  const position_obj = new Position({
    pool,
    liquidity,
    tickLower: Number(tickLower.tickIdx),
    tickUpper: Number(tickUpper.tickIdx)
  });

  // Calculate the total amounts (this includes both in-range and out-of-range portions)
  const amount0 = position_obj.amount0;
  const amount1 = position_obj.amount1;

  return {
    token0Amount: parseFloat(amount0.toSignificant(18)),
    token1Amount: parseFloat(amount1.toSignificant(18)),
    inRange: parseInt(tick) >= parseInt(tickLower.tickIdx) && parseInt(tick) <= parseInt(tickUpper.tickIdx)
  };
}

export async function strategy(
  _space,
  network,
  _provider,
  addresses,
  options,
  snapshot
): Promise<Record<string, number>> {
  const tokenReserve = options.tokenReserve === 0 ? 'token0Reserve' : 'token1Reserve';
  const requiredFeeTier = options.feeTier || 10000; // Default to 1% fee tier (10000 = 1%)

  const _addresses = addresses.map(address => address.toLowerCase());

  const params = {
    positions: {
      __args: {
        where: {
          pool: options.poolAddress.toLowerCase(),
          owner_in: _addresses
        }
      },
      id: true,
      owner: true,
      liquidity: true,
      tickLower: {
        tickIdx: true
      },
      tickUpper: {
        tickIdx: true
      },
      pool: {
        tick: true,
        sqrtPrice: true,
        liquidity: true,
        feeTier: true
      },
      token0: {
        symbol: true,
        decimals: true,
        id: true
      },
      token1: {
        symbol: true,
        decimals: true,
        id: true
      }
    }
  };

  if (snapshot !== 'latest') {
    // @ts-ignore
    params.positions.__args.block = { number: snapshot };
  }

  try {
    const rawData = await subgraphRequest(
      options.subgraph || UNISWAP_V3_SUBGRAPH_URL[network],
      params
    );

    const usersUniswap = addresses.map(() => ({
      positions: []
    }));

    rawData?.positions?.map(position => {
      // Only include positions with the required fee tier (1% = 10000)
      if (position?.pool?.feeTier === requiredFeeTier.toString()) {
        const ownerIndex = _addresses.indexOf(position?.owner);
        if (ownerIndex !== -1) {
          usersUniswap[ownerIndex].positions.push(position);
        }
      }
    });

    const score = {};

    usersUniswap?.forEach((user: any, idx) => {
      let tokenReserveAdd = 0;

      user.positions.forEach((position: any) => {
        // Calculate total token amounts using custom function
        const tokenAmounts = calculateTotalTokenAmounts(position);
        
        // Add the token amount based on tokenReserve parameter
        if (tokenReserve === 'token0Reserve') {
          tokenReserveAdd += tokenAmounts.token0Amount;
        } else {
          tokenReserveAdd += tokenAmounts.token1Amount;
        }
      });

      score[addresses[idx]] = tokenReserveAdd;
    });

    // Return the actual scores from the subgraph
    // If no positions found, return zero scores

    return score || {};
  } catch (error) {
    console.error('Error fetching Uniswap V3 positions:', error);
    // Return empty scores if subgraph fails
    const emptyScore = {};
    addresses.forEach((address) => {
      emptyScore[address] = 0;
    });
    return emptyScore;
  }
}
