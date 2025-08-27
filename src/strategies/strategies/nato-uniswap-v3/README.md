# NATO Uniswap V3 Strategy

This strategy calculates voting power based on Uniswap V3 LP positions that include the NATO token.

## Parameters

- **tokenAddress**: NATO token contract address  
- **poolAddress**: Uniswap V3 pool address (NATO/WETH)  
- **feeTier**: Uniswap V3 pool fee tier (e.g. `10000` for 1%)  
- **positionManager**: Uniswap V3 NFT Position Manager contract address  
- **network**: Target chain (e.g. `"base"`)

## Example

```json
[
  {
    "name": "Nato example",
    "strategy": {
      "name": "nato-uniswap-v3",
      "params": {
        "tokenAddress": "0xd968196fa6977c4e58f2af5ac01c655ea8332d22",
        "poolAddress": "0x02623e0e65a1d8537f6235512839e2f7b76c7a12",
        "feeTier": 10000,
        "positionManager": "0x03a520b32c04bf3beef7beb72e919cf822ed34f1",
        "network": "base"
      }
    },
    "network": "base",
    "addresses": [
      "0x4019fc024a385c6eb2ba17a43b286615f11c4ef4",
      "0x07a1f6fc8923c5ebd4e4ddae89ac97629856a0f",
      "0x38c0039247a31f399bae65e953612125cb88268"
    ],
    "snapshot": 12222222
  }
]
