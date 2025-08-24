# Native Balance Strategy

This strategy returns the native token balances as voting power. It can be used on any network to get the balance of the native token (ETH on Ethereum, MATIC on Polygon, BNB on BSC, etc.).

## Parameters

- `symbol` (optional): Token symbol for display purposes (e.g. "ETH", "MATIC", "BNB")

## Examples

```json
{
  "name": "native-balance",
  "params": {
    "symbol": "ETH"
  }
}
```
