# lido-voting-delegation

This strategy returns delegated-in LDO voting power for Lido DAO delegates. It sums
the LDO balances of accounts that delegated to each voter address through either
the Snapshot Delegate Registry or Lido DAO `Voting` contract.

It returns delegated power only. It must be used together with `erc20-balance-of` if the
space should count each voter's own LDO balance as well.

Snapshot delegations take precedence over Lido DAO `Voting` delegations. If a
holder delegated in both systems, their voting power follows the Snapshot
delegate. Within the Snapshot Delegate Registry, a space-specific delegation
overrides a global one, so a holder delegating globally to one address and
space-specifically to another is counted only for the latter. If a delegator is
also present in the voter set, their delegated power is excluded from their
delegate's score so the delegator can reclaim voting power by voting directly.

The strategy uses batched, address-scoped reads and supports snapshot block
pinning. Zero address inputs are ignored for the Lido DAO `Voting` delegation
reads because the `Voting` getters revert for `address(0)`.

## Difference from the `delegation` strategy

The space-specific override is resolved against all of a holder's delegations,
not only those pointing at a scored address. `delegation` filters by delegate
first, so a holder delegating globally to A and space-specifically to B is
credited to A whenever B is not being scored — and since voting power is
computed one address at a time, that is the usual case. Here such a holder is
always credited to B.

| Param Name        | Description                                                                      |
| ----------------- | -------------------------------------------------------------------------------- |
| `address`         | ERC-20 token contract address used for balances. For Lido this is the LDO token. |
| `decimals`        | Token decimals.                                                                  |
| `votingContract`  | Lido DAO `Voting` contract proxy used for onchain delegation reads.              |
| `symbol`          | Optional display symbol.                                                         |
| `delegationSpace` | Optional Snapshot delegation space. Defaults to the proposal space.              |

Here is an example of parameters:

```json
{
  "symbol": "LDO",
  "address": "0x5a98fcbea516cf06857215779fd812ca3bef1b32",
  "decimals": 18,
  "votingContract": "0x2e59A20f205bB85a89C53f1936454680651E618e",
  "delegationSpace": "lido-snapshot.eth"
}
```
