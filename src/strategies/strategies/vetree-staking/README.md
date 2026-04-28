# vetree-staking

This strategy returns a delegator's total staked TREE balance, aggregated from three buckets:

1. **Undelegated balance** — tokens deposited but not yet delegated to any panelist.
2. **Active panelist stakes** — tokens actively delegated to panelists (remains until claimed even after panelist deactivation).
3. **Pending redemptions** — tokens queued for withdrawal via `requestDelegatorRedemption()`.

The final voting power is the **square root** of the total balance.

Here is an example of parameters:

```json
{
  "address": "0x0000000000000000000000000000000000000000",
  "symbol": "TREE",
  "decimals": 18
}
```
