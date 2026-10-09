# cl-positions-token-amount

Voting power is the amount of one token (for example a governance token) that each voter holds inside concentrated-liquidity LP positions, instead of one vote per position NFT.

For every voter the strategy:

1. lists the voter's position NFTs in each position manager, plus the NFTs the voter has staked in the configured staking contracts;
2. reads each position (tokens, tick range, liquidity) at the snapshot block;
3. keeps the positions that belong to one of the configured pools and contain the token;
4. converts the position's liquidity into token amounts with the pool price at the snapshot block, using the same integer math the pools use when a position is burned, and adds up the token side.

Out-of-range positions count in full. Uncollected fees are not counted.

Supported position managers:

- `uniswap-v3`: Uniswap v3 and forks with the same `positions()` layout, such as PancakeSwap v3. Pools are matched by token pair and fee tier. `stakingContracts` accepts farms that take custody of the NFTs and expose `balanceOf(user)` and `tokenOfOwnerByIndex(user, index)`, such as PancakeSwap MasterChefV3.
- `algebra-integral`: Algebra Integral position managers, whose `positions()` returns the pool deployer, such as THENA V3. Pools are matched by token pair and `deployer` (leave it out for base pools, set it for custom pools). Algebra farming keeps the NFT in the owner's wallet, so no staking contract is needed.

The strategy makes at most 3 multicall requests, whatever the number of voters.

Here is an example of parameters (SINGULARRY on BNB Chain, THENA V3 and PancakeSwap v3):

```json
{
  "symbol": "SINGULARRY-LP",
  "token": "0x18EA4dF6a9CDE2472f2321a4Ec77da106498A66E",
  "decimals": 18,
  "sources": [
    {
      "type": "algebra-integral",
      "positionManager": "0x643B68Bf3f855B8475C0A700b6D1020bfc21d02e",
      "pools": [
        { "address": "0x256Aa364c44c44a3714bdB548237B0A4fD7DE6C2" },
        {
          "address": "0x26399Af833bCa82c0c8c2EF4255B4939b26C39F5",
          "deployer": "0xF807462b5ce54A89e2F5B847D8281030eAfE241B"
        }
      ]
    },
    {
      "type": "uniswap-v3",
      "positionManager": "0x46A15B0b27311cedF172AB29E4f4766fbE7F4364",
      "stakingContracts": ["0x556B9306565093C855AEA9AE92A594704c2Cd59e"],
      "pools": [{ "address": "0xEeFF64823C63F87fa6539ea702CA71221329E7d8" }]
    }
  ]
}
```
