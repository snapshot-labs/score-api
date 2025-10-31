import { BigNumber } from '@ethersproject/bignumber';
import { getAddress } from '@ethersproject/address';
import { Multicaller } from '../../utils';
import { formatUnits } from '@ethersproject/units';


const REGISTRY_ABI = [
  'function getAmountsForLiquidity(bytes32 poolId, uint128 liquidity, int24 tickLower, int24 tickUpper) view returns (uint256 amount0, uint256 amount1, uint160 sqrtPriceX96)',
  'function getSubscriptions(address owner) view returns (uint256[])',
  'function getPositionDetails(uint256 tokenId) view returns (tuple(address owner, bytes32 poolId, int24 tickLower, int24 tickUpper, uint128 liquidity, tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) poolKey))'
];

interface TokenInfo {
  address: string;
  decimals: number;
  price: number;
}

export async function strategy(
  space,
  network,
  provider,
  addresses, // array of voter addresses to calculate scores for
  options,
  snapshot
): Promise<Record<string, number>> {
  const blockTag = typeof snapshot === 'number' ? snapshot : 'latest';

  const telPrice = options.telPrice;
  if (!telPrice || telPrice === 0) return {};

  // use generic token price & decimals lookup map for max maintainability
  const tokenInfoMap = new Map<string, { decimals: number; price: number }>();
  for (const token of options.tokens as TokenInfo[]) {
    // store key checksummed
    tokenInfoMap.set(getAddress(token.address), {
      decimals: token.decimals,
      price: token.price
    });
  }

  // 1. get all subscribed token IDs for all voters using Multicaller for efficiency
  const multiSubscriptions = new Multicaller(network, provider, REGISTRY_ABI, {
    blockTag
  });
  addresses.forEach(address =>
    multiSubscriptions.call(
      address,
      options.registryAddress,
      'getSubscriptions',
      [address]
    )
  );
  const subscriptionsResult: Record<string, BigNumber[]> =
    await multiSubscriptions.execute();

  // 2. prepare calls to get data for every unique token ID found
  const multiPositionDetails = new Multicaller(
    network,
    provider,
    REGISTRY_ABI,
    { blockTag }
  );
  const ownerOfToken: Record<string, string> = {};
  for (const [ownerAddress, tokenIds] of Object.entries(subscriptionsResult)) {
    if (tokenIds) {
      tokenIds.forEach(tokenId => {
        const tokenIdStr = tokenId.toString();
        multiPositionDetails.call(
          tokenIdStr,
          options.registryAddress,
          'getPositionDetails',
          [tokenIdStr]
        );
        ownerOfToken[tokenIdStr] = ownerAddress;
      });
    }
  }
  const positionDetailsResult = await multiPositionDetails.execute();

  // 3. get all token amounts using `PositionRegistry::getAmountsForLiquidity` in batched call
  const multiAmounts = new Multicaller(network, provider, REGISTRY_ABI, {
    blockTag
  });
  for (const [tokenIdStr, details] of Object.entries(positionDetailsResult)) {
    multiAmounts.call(
      tokenIdStr,
      options.registryAddress,
      'getAmountsForLiquidity',
      [details.poolId, details.liquidity, details.tickLower, details.tickUpper]
    );
  }
  const amountsResult = await multiAmounts.execute();

  // 4. calculate value for each position and aggregate scores
  const scores: Record<string, number> = {};
  for (const [tokenIdStr, details] of Object.entries(positionDetailsResult)) {
    const owner = ownerOfToken[tokenIdStr];
    if (!owner) continue;

    // get results from batched calls
    const amounts = amountsResult[tokenIdStr];
    if (!amounts) continue;

    // lookup token info
    const currency0 = getAddress(details.poolKey.currency0);
    const currency1 = getAddress(details.poolKey.currency1);
    const token0Info = tokenInfoMap.get(currency0);
    const token1Info = tokenInfoMap.get(currency1);

    // calculate value to USD then TEL using price && decimal info for both tokens
    if (token0Info && token1Info) {
      // format decimals
      const amount0 = parseFloat(
        formatUnits(amounts.amount0, token0Info.decimals)
      );
      const amount1 = parseFloat(
        formatUnits(amounts.amount1, token1Info.decimals)
      );

      // calculate amounts of both sides to USD value and sum
      const positionValueUsd =
        amount0 * token0Info.price + amount1 * token1Info.price;

      // convert to TEL denomination using TEL price
      const positionValueInTel = positionValueUsd / telPrice;

      // add the final TEL value to owners' scores mapping
      if (!scores[owner]) scores[owner] = 0;
      scores[owner] += positionValueInTel;
    }
  }
  // 4. Return the final scores, ensuring addresses are checksummed
  return Object.fromEntries(
    Object.entries(scores).map(([address, score]) => [
      getAddress(address),
      score
    ])
  );
}
