# strk-staked-balance

This strategy returns the staked STRK balance of voters on Starknet by combining two sources:

1. **Pool delegator balances** — Calls `get_pool_member_info` on 200 whitelisted staking pool contracts to get delegated amounts.
2. **Direct staker balances** — Calls `get_staker_info` on the staking contract to get `amount_own` for direct stakers.

Both are summed to calculate total voting power per address.

## Parameters

```json
{
  "symbol": "STRK"
}
```
