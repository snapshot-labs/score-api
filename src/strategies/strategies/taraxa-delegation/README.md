# Simple Taraxa Delegation Strategy

Calculates the stakes of voters, based on their DPOS stakes in the previous specified snapshot together with their stTARA holdings.

## Examples

Used as the base vote strategy for Taraxa Governance, the space config will look like this:

```JSON
{
  "strategies": [
    ["taraxa-delegation"]
  ]
}
```
