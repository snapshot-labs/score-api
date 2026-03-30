# strk-staked-balance

This strategy returns the staked STRK balance of voters across whitelisted staking contracts on Starknet. It aggregates the staked amounts from multiple staking pools (200 active pools on 30th March 2026) to calculate the total voting power for each address.

The strategy calls the `get_pool_member_info` function on whitelisted staking contracts to retrieve staking information for each voter address.

## Parameters

```json
{
  "symbol": "STRK"
}
```
