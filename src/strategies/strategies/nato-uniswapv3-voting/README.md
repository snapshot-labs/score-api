# nato-uniswapv3-voting

This strategy calculates voting power based on Uniswap V3 NFT positions in the 1% fee tier pool. It checks if a wallet holds Uniswap V3 NFTs and calculates the token holdings from 1% tier positions only.

The strategy:
1. Checks if wallet holds Uniswap V3 NFTs
2. Filters positions to only include 1% fee tier pools
3. Calculates token holdings from those positions
4. Returns the token amount as voting power (1 token = 1 vote)

Here is an example of parameters:

```json
{
  "poolAddress": "0x02623e0e65a1d8537f6235512839e2f7b76c7a12",
  "tokenReserve": 0,
  "feeTier": 10000
}
```

Parameters:
- `poolAddress`: The Uniswap V3 pool address
- `tokenReserve`: Which token to count (0 for token0, 1 for token1)
- `feeTier`: The fee tier to filter for (10000 = 1%)
- `subgraph`: Optional custom subgraph URL
