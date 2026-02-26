# Weighted Strategy

This strategy is a wrapper that applies a weight multiplier to any inner strategy's scores.

## Description

The weighted strategy takes an inner strategy and multiplies all its resulting scores by a configurable weight. This is useful when you want to give different importance to different voting strategies in a space configuration.

## Parameters

- `weight` (number, optional): The multiplier to apply to the inner strategy scores. Defaults to 1.
- `strategy` (object, required): The inner strategy configuration
  - `name` (string, required): The name of the inner strategy
  - `params` (object, required): The parameters for the inner strategy

## Examples

### Weight of 2 with erc4626-assets-of

```json
{
  "name": "weighted",
  "params": {
    "symbol": "MGN",
    "weight": 2,
    "strategy": {
      "name": "erc4626-assets-of",
      "params": {
        "address": "0x44e4c3668552033419520be229cd9df0c35c4417",
        "symbol": "MGN",
        "decimals": 18
      }
    }
  }
}
```

### Weight of 0.5 (half voting power)

```json
{
  "name": "weighted",
  "params": {
    "symbol": "MGN",
    "weight": 0.5,
    "strategy": {
      "name": "erc4626-assets-of",
      "params": {
        "address": "0x44e4c3668552033419520be229cd9df0c35c4417",
        "symbol": "MGN",
        "decimals": 18
      }
    }
  }
}
```
