# Aventus DAO Strategy

The Aventus DAO strategy extends the standard ERC-20 voting strategy to include AVT balances held on the Aventus Network (AvN), a Polkadot parachain.

## Strategy Overview

- AVT exists on both Ethereum and AvN.
- Users can link up to 10 AvN accounts to a single Ethereum address.
- AVT held by linked AvN accounts (including both free and staked balances) is attributed to the linked Ethereum address.
- Voting power is the sum of Ethereum and linked AvN AVT balances.

## Balance Resolution

For each Ethereum address:

1. The Ethereum AVT balance is resolved at the Snapshot proposal block using the standard ERC-20 strategy.
2. The block's corresponding timestamp is retrieved.
3. The AvN public RPC is queried to resolve the total AVT balance across all linked AvN accounts at, or immediately prior to, that timestamp.
4. The final voting power is calculated as: `Ethereum AVT balance + linked AvN AVT balance`

## Determinism

- Ethereum balances are resolved at a fixed Snapshot block.
- AvN balances are resolved using the corresponding timestamp.
- The closest state at or before the timestamp is used to ensure deterministic results.

## Example Parameters
```
"params": {
    "avn": "https://avn-parachain.mainnet.aventus.io",
    "avt": "0x0d88ed6e74bbfd96b831231638b66c05571e824f"
}
```