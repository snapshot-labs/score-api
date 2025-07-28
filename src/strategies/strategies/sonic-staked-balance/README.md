# sonic-staked-balance

This strategy calculates voting power based on staked balance across all validators in the Sonic network.

## Description

The strategy works by:

1. Calling `lastValidatorID()` to get the total number of validators
2. For each address, calling `getStake(address, validatorId)` for all validator IDs (1 to lastValidatorID)
3. Summing up all stakes across all validators for each address as their voting power

The strategy uses the default Sonic staking contract address `0xFC00FACE00000000000000000000000000000000` and 18 decimals.

## Parameters

- `symbol`: Token symbol for display purposes (optional)
