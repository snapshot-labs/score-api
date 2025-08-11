# spark-with-delegation

This strategy calculates voting power for Spark protocol tokens with delegation support. It combines both SPK token balance and staked SPK balance from the vault contract.

## Parameters

- `whitelistedDelegates` (optional): Array of addresses that should receive delegated balance. If not provided or empty, no addresses will receive delegated balance.
- `symbol` (optional): Token symbol for display purposes (defaults to SPARK)

## How it works

1. **For non-delegators**: They receive their own balance (SPK + staked SPK)
2. **For whitelisted delegates**: They receive their own balance + any delegated balance from others
3. **For non-whitelisted delegates**: They only receive their own balance (delegations to them don't count)
4. **For delegators**: They get 0 voting power as it's transferred to their delegates

## Voting Power Calculation

Total voting power = SPK token balance + staked SPK balance 
