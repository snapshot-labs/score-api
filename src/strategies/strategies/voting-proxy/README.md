# voting-proxy

Generic overriding strategy for older multisigs that cannot upgrade to
ERC-1271 or change where their existing Snapshot voting power lives.

The voter submits a Snapshot vote from a small ERC-1271 voting proxy. If that
proxy has zero direct voting power, this strategy calls `source()` on the proxy,
scores the returned source address with the configured inner strategies, and
returns that voting power under the original proxy voter.

If several proxy voters resolve to the same source, a direct source voter wins.
Otherwise, the lowest proxy address wins deterministically and the other proxies
return `0`.

Here is an example of parameters:

```json
{
  "strategies": [
    {
      "name": "erc20-balance-of",
      "network": "1",
      "params": {
        "address": "0xToken",
        "symbol": "TOKEN",
        "decimals": 18
      }
    }
  ]
}
```
