# grove-with-delegation

This strategy calculates voting power for Grove protocol governance with delegation support. Voting power is the actively staked GROVE balance — `activeBalanceOf` an account in the stGROVE vault (`0xF3Ddcaa3BD5D04ba08beC69cf34D9d9C9c112d14`). Stake that has been requested for withdrawal is excluded (using `activeBalanceOf` rather than `slashableBalanceOf` means an account cannot keep voting power while already queued to exit).

## Parameters

- `whitelistedDelegates` (optional): Array of addresses that should receive delegated balance. If not provided or empty, no addresses will receive delegated balance.
- `symbol` (optional): Token symbol for display purposes (defaults to stGROVE)

## How it works

1. **For non-delegators**: They receive their own actively staked GROVE balance
2. **For whitelisted delegates**: They receive their own balance + any delegated balance from others
3. **For non-whitelisted delegates**: They only receive their own balance (delegations to them don't count)
4. **For delegators**: They get 0 voting power as it's transferred to their delegates

## Voting Power Calculation

Total voting power = actively staked GROVE balance (stGROVE vault `activeBalanceOf`; withdrawal-queued stake excluded)
