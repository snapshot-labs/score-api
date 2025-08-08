# welf-staking-balance-of-v1

This strategy retrieves staked balance for specific wallets on the WelfStaking contract deployed at `0xC1397AAe5Fdcaf254F19289387B5d8eE78a7bCb7` on Ethereum mainnet.

The WelfStaking contract is a sophisticated staking system that supports multiple pools with configurable tier-based APY structures. Users can create multiple individual stakes within each pool, and each stake tracks its own timing and amount. The strategy is optimized for governance voting where staking commitment should translate to voting power.

## Contract Architecture

The WelfStaking contract provides several key methods that this strategy utilizes:

- `getUserStakes(uint256 poolId, address user)` - Returns an array of all stakes for a user in a specific pool
- `getPoolInfo(uint256 poolId)` - Returns pool configuration and active tier information including APY durations
- Pool configuration includes pause status, minimum stake requirements, and tier-based reward structures

Each user stake contains:

- `amount`: The staked token amount
- `startTime`: When the stake was created (timestamp)
- `lastClaimTime`: When rewards were last claimed

The contract supports tier-based staking where longer commitment periods yield higher APY rates. This tier system is leveraged by the strategy to calculate time-weighted voting power.

## How the Strategy Works

### Basic Mode (weightByStakeTime = false)

In basic mode, the strategy simply aggregates all staked amounts across all user stakes:

```text
Voting Power = Sum of all stake amounts
```

### Time-Weighted Mode (weightByStakeTime = true)

When time weighting is enabled, the strategy applies a multiplier based on how long tokens have been staked relative to the maximum tier duration:

```text
For each stake:
  Stake Duration = Current Block Timestamp - Stake Start Time
  Duration Ratio = min(Stake Duration / Max Tier Duration, 1)
  Weight = 1 + Duration Ratio
  Weighted Amount = Stake Amount × Weight

Total Voting Power = Sum of all Weighted Amounts
```

This results in:

- **New stakes**: 1x voting power (no bonus)
- **Stakes at max tier duration**: 2x voting power (100% bonus)
- **Stakes in between**: Linear scaling from 1x to 2x

### Pool Status Handling

The strategy automatically:

- Skips paused pools (returns zero voting power)
- Handles non-existent pools gracefully
- Uses the pool's active tier configuration for duration calculations

## Parameters

```json
{
  "staking_contract": "0xC1397AAe5Fdcaf254F19289387B5d8eE78a7bCb7",
  "pool_id": "0",
  "decimals": 18,
  "weightByStakeTime": true
}
```

### Parameter Details

- **staking_contract**: Address of the WelfStaking contract on Ethereum mainnet
- **pool_id**: Pool identifier as string (currently "0" for the main staking pool)
- **decimals**: Token decimal places for amount formatting (typically 18 for ERC-20 tokens)
- **weightByStakeTime**: Boolean flag to enable time-based voting power weighting

*Decimals* is applied globally to all stake amounts. The strategy handles multiple stakes per user automatically and aggregates them appropriately.

## Examples

### Time-Weighted Governance Voting

For governance systems where long-term commitment should be rewarded with higher voting power:

```json
{
  "staking_contract": "0xC1397AAe5Fdcaf254F19289387B5d8eE78a7bCb7",
  "pool_id": "0",
  "decimals": 18,
  "weightByStakeTime": true
}
```

**Use case**: A DAO where users who stake for longer periods get more voting influence, encouraging long-term participation and reducing short-term speculation.

### Equal Representation Voting

For systems where all staked tokens should have equal voting weight regardless of time:

```json
{
  "staking_contract": "0xC1397AAe5Fdcaf254F19289387B5d8eE78a7bCb7",
  "pool_id": "0",
  "decimals": 18,
  "weightByStakeTime": false
}
```

**Use case**: Fair voting where the focus is on the amount staked rather than commitment duration, suitable for treasury decisions or protocol parameter changes.

## Technical Implementation

- Uses Multicaller for efficient batch contract calls
- Deterministic results using block timestamps (not current time)
- Robust error handling with graceful fallbacks
- Optimized for gas efficiency with minimal contract calls
- Supports large numbers of stakes per user without performance degradation

The strategy is designed to work seamlessly with Snapshot's voting infrastructure and provides consistent, verifiable results for governance participation.
