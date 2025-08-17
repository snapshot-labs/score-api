# VeTree Vested Program

This strategy calculates voting power for users in the VeTree vested program. The voting power is based on the claimable balance for a specific tranche, but only for users who have not yet claimed.

The strategy works as follows:
1. It checks if a user has already claimed their tokens for a given tranche from the vesting contract.
2. For users who have not claimed, it fetches an `amount` from an external API. This API should return a JSON object mapping user addresses to their allocated amounts.
3. It then calls the `claimableBalance` function on the vesting contract with the tranche ID and the fetched amount. This function returns the claimable balance.
4. The final voting power is the square root of the total claimable balance.

Addresses that have already claimed will have a voting power of 0.

Here is an example of the parameters:

```json
{
  "address": "0xdD8A6C6D3667133e783E8bd2a3B33b551B97482f",
  "symbol": "VETREE",
  "decimals": 18,
  "apiUrl": "https://example.com/api/allocations.json",
  "tranche": 2
}
```