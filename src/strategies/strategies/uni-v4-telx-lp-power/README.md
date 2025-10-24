# TELx Uniswap V4 LP Position Strategy

This strategy calculates voting power based on the value of a user's Uniswap V4 LP positions, as tracked by the TELx Position Registry contract.

The strategy is designed to be **generic and maintainable**. It does not require any code changes to support new pools or tokens. All configuration must be handled manually by the proposal creator in the Snapshot UI.

The strategy works by:

1.  Fetching all of a user's _subscribed_ LP position NFTs from the `PositionRegistry` contract on a specific chain.
2.  Batch-fetching the underlying token amounts for each position using on-chain data from the snapshot block.
3.  Valuing all positions in USD using **fixed price data provided by the proposal creator** in the strategy parameters.
4.  Converting the total USD value into a final score denominated in TEL (using the provided `telPrice`).

**All token prices are provided as parameters by the proposal creator.**

The integrity of the vote calculation depends on the proposer accurately sourcing and providing the historical prices corresponding to the proposal's snapshot block. Voters are strongly encouraged to **socially validate** these parameters.

**If token information for a pool is missing from the parameters, the strategy will silently value all positions in that pool at 0.**

## Manual Proposal Creation Process

1.  **Create Proposal as a Draft:** Go to the Snapshot space and start creating a new proposal. Do not publish it yet.
2.  **Identify the Snapshot Block:** The UI will show the "Snapshot block number" it has automatically selected.
3.  **Fetch Historical Prices (One-Time Task):** Using the block number, the proposal creator must manually fetch the historical USD price for **all** tokens in the incentivized pools (e.g., from CoinGecko) and the final `telPrice` for denomination.
4.  **Enter Parameters in Strategy:** Go back to the draft proposal. In the "Voting" section, enter the `registryAddress`, the `telPrice`, and the complete list of tokens and their data into the `tokens` array.
5.  **Publish Proposal:** Once all parameters are entered and verified, publish the proposal.

## Parameters

- **`symbol`** (string): The symbol to display
- **`registryAddress`** (address): The address of the deployed `PositionRegistry` contract _on this chain_.
- **`telPrice`** (number): The price of 1 TEL in USD, used for the final denomination.
- **`tokens`** (array): An array of token info objects. This list must include **every token** that is part of a pool you want to value.
  - **`address`** (string): The token's contract address.
  - **`decimals`** (number): The token's decimals (e.g., 18 for ETH, 6 for USDC).
  - **`price`** (number): The token's price in USD at the snapshot block.

## Example Setup

This example setup would value positions in `ETH/TEL` and `USDC/EMXN` pools.

```json
{
  "symbol": "vTEL",
  "registryAddress": "0x123456789...YourRegistryOnThisChain",
  "telPrice": 0.003,
  "tokens": [
    {
      "address": "0xETH_ADDRESS",
      "decimals": 18,
      "price": 3850.45
    },
    {
      "address": "0xTEL_ADDRESS",
      "decimals": 2,
      "price": 0.003
    },
    {
      "address": "0xUSDC_ADDRESS",
      "decimals": 6,
      "price": 1.0
    },
    {
      "address": "0xEMXN_ADDRESS",
      "decimals": 6,
      "price": 0.057
    }
  ]
}
```
