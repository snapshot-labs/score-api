# vesoc-nft-power

This strategy supports two different voting power calculation modes that can be selected via configuration.

## Strategy Types

### 1. vesoc-nft-power (Default)
Calculates voting power based on two components:
- **veSocPower**: Calculated from user's veSOC lock position in VeSocLocker contract
- **NFT Multiplier**: Maximum consensusValue from user's NFTs

#### Calculation Logic

**veSocPower Calculation:**
```
veSocPower = veSocAmount * (remainingTime / lockDuration)
```
- `remainingTime = endTime - currentTimestamp`
- If `endTime < currentTimestamp` or lock amount is 0, veSocPower = 0 (no active lock)
- Only locks with `amount > 0` that haven't expired are considered
- The power decreases linearly as the lock approaches expiration

**NFT Multiplier:**
- Fetches user's NFT IDs using `userPasses(address)` method
- Queries HTTP API to get consensusValue for each NFT ID
- Takes the maximum consensusValue as the multiplier
- If user has no NFTs, multiplier = 1

**Final Score:**
```
finalScore = veSocPower * maxConsensusValue
```

**Active Vote Lock Requirement (Optional):**
If `minLockPerActiveVote` is set to a value greater than 0, the strategy checks the
number of the user's active Snapshot votes in the current space (`n`) and enforces:
```
if lock.amount < n * minLockPerActiveVote, then veSocPower = 0
```
The Snapshot GraphQL endpoint is configurable via `snapshotGraphqlEndpoint`.
If you need to override the space used for filtering, set `snapshotSpace`.
If `minLockPerActiveVote` is 0 or omitted, the strategy behaves exactly as before.

### 2. vesoc-supply-ratio
Calculates voting power based on user's veSOC balance as a percentage of total supply:

#### Calculation Logic

**Score Calculation:**
```
ratio = balanceOf(address) / totalSupply()
finalScore = ratio * multiplier
```
- Uses the current `balanceOf(address)` to get user's veSOC balance
- Computes the ratio of user's veSOC to total veSOC supply
- Multiplies the ratio by a configured multiplier for easier readability
- Simpler and more direct calculation compared to vesoc-nft-power strategy

## API Response Format

The consensus API should return an array of objects with the following format (required only for vesoc-nft-power strategy):

```json
[
  {
    "id": "1",
    "consensusValue": 1.5
  },
  {
    "id": "2",
    "consensusValue": 2.0
  }
]
```

## Examples

### vesoc-nft-power Strategy Example

```json
{
  "name": "vesoc-nft-power",
  "params": {
    "veSocLockerAddress": "0x1234567890123456789012345678901234567890",
    "nftContractAddress": "0x0987654321098765432109876543210987654321",
    "consensusApi": "https://api.project.com/nft/consensus",
    "strategyType": "vesoc-nft-power",
    "decimals": 18,
    "minLockPerActiveVote": "1000000000000000000",
    "snapshotGraphqlEndpoint": "https://testnet.hub.snapshot.org/graphql",
    "snapshotSpace": "your-space-id"
  }
}
```

### vesoc-supply-ratio Strategy Example

```json
{
  "name": "vesoc-nft-power",
  "params": {
    "veSocLockerAddress": "0x1234567890123456789012345678901234567890",
    "strategyType": "vesoc-supply-ratio",
    "multiplier": 1000,
    "decimals": 18
  }
}
```

In the supply ratio example, a user with 1% of total veSOC supply would get a score of 10 (1% * 1000).
