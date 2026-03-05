# maturity-adjusted-governance-bonds

Snapshot voting strategy for [Rize](https://rize.io) governance bond NFTs on Base.

## How Rize governance bonds work

Rize governance bonds are ERC-721 NFTs minted through the `NFTBond` contract (which inherits `ERC721Enumerable`). When a user bonds tokens, they receive an NFT representing their position. A single wallet can hold multiple bond NFTs.

Each bond has a **maturity period**. The `GovernanceBonding` contract (built on `WeightedBonds` and `MaturityPools`) tracks per-bond weight through a function called `getNormalizedWeight(tokenId)`. This weight increases **linearly** over time as the bond approaches full maturity, at which point it is capped. The weight is already normalized by the bonded token's decimals inside the contract, so no additional decimal adjustment is needed by consumers.

## How the strategy computes voting power

For each queried address:

1. Call `NFTBond.balanceOf(address)` to get the number of bonds held.
2. For each bond index `i` in `[0, count)`, call `NFTBond.tokenOfOwnerByIndex(address, i)` to get the token ID.
3. For each token ID, call `GovernanceBonding.getNormalizedWeight(tokenId)` to get the current weight.
4. Sum all weights. The result, divided by `10^decimals`, is the Snapshot voting power.

All calls use the snapshot block number when provided, ensuring consistent point-in-time results. A wallet with no bonds scores zero. A cap of `maxBondsPerAddress` (default 10) limits per-address call volume.

## Deployed contracts (Base mainnet)

| Contract | Address |
|---|---|
| NFTBond | `0xF33F231B769CCC1C7f74190De14340fBD51879FF` |
| GovernanceBonding | `0x5a134098bDBEb05Da9eAc35439c5624547ed26eE` |

Deployed at block 28890827.

## Parameters

| Param | Type | Required | Default | Description |
|---|---|---|---|---|
| `nftBondAddress` | string | yes | — | NFTBond contract address |
| `governanceBondingAddress` | string | yes | — | GovernanceBonding contract address |
| `decimals` | number | no | `2` | Decimal places for weight formatting (2 matches the portal UI) |
| `maxBondsPerAddress` | number | no | `10` | Max bonds scored per address |
| `symbol` | string | no | — | UI label (e.g. `gRIZE`) |

## Example

```json
{
  "nftBondAddress": "0xF33F231B769CCC1C7f74190De14340fBD51879FF",
  "governanceBondingAddress": "0x5a134098bDBEb05Da9eAc35439c5624547ed26eE",
  "decimals": 2,
  "maxBondsPerAddress": 10,
  "symbol": "gRIZE"
}
```
