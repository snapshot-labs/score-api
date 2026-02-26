# ERC-721 CryptoLegacy Weighted Locked Voting

CryptoLegacy is a multichain protocol and dApp that protects your digital assets through secure emergency recovery and inheritance. It’s built on fundless personal contracts — your assets always stay in your wallets until they’re actually needed.

This strategy calculates voting power based on locked NFTs in a locker contract. For each user, it checks if they have a locked NFT by calling `lockedNft` on the locker contract. If a token is locked (tokenId > 0), it fetches the tier of that token from the NFT contract using `getTier` and applies weights based on tier ranges to determine the voting power.

Here is an example of parameters:

```json
{
  "address": "0x22C1f6050E56d2876009903609a2cC3fEf83B415",
  "locker": "0x2C8660b01F7d45561370AC1DE3E75cf7F80199a6",
  "defaultWeight": 1,
  "tokenIdWeightRanges": [
    { "start": 1, "end": 100, "weight": 20 },
    { "start": 101, "end": 300, "weight": 9 },
    { "start": 301, "end": 700, "weight": 4 },
    { "start": 701, "end": 1500, "weight": 2 }
  ]
}
```

- `address`: The address of the ERC-721 NFT contract.
- `locker`: The address of the locker contract that holds the locked NFTs.
- `defaultWeight`: The default voting power if the tier does not match any range.
- `tokenIdWeightRanges`: An array of objects defining ranges of tiers and their corresponding weights.
