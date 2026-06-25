# voting-proxy

Generic overriding strategy for older multisigs that cannot upgrade to
ERC-1271 or move their voting power.

The voter submits a Snapshot vote from a small ERC-1271 voting proxy. If that
proxy has zero direct voting power, this strategy batch-calls `source()` on
zero-VP proxies, scores the returned source address with the configured inner
strategies, and returns that voting power under the original proxy voter.

Reference contract and tests: https://github.com/orbs-network/voting-proxy

This strategy only maps voting power from `source()` to the proxy voter. It does
not validate ERC-1271 signatures or prove that a voter is an Orbs voting proxy.
Use it only with Snapshot signature validation against the proxy contract;
pairing it with arbitrary `source()` contracts is unsafe.

If several proxy voters resolve to the same source, a direct source voter with a
positive score wins. Otherwise, the lowest proxy address wins deterministically
and the other proxies return `0`.

Here is an example of parameters:

```json
{
  "strategies": [
    {
      "name": "erc20-balance-of",
      "network": "1",
      "params": {
        "address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        "symbol": "USDC",
        "decimals": 6
      }
    }
  ]
}
```
