# evolabs-dao

Enhanced voting strategy for EvoLabs DAO that implements:

- **Soulbound Token (SBT) Requirement**: Only users who have minted/own an SBT can participate in voting
- **Dual-Layer Blacklist Protection**: SBT contract blacklist + optional Snapshot blacklist
- **Delegation System**: Users can delegate their voting power to other users
- **Delegation Management**: Users can change their delegate or remove delegation
- **One Person, One Vote**: Each SBT holder gets exactly 1 vote regardless of token quantity

## Features

### 🏷️ Soulbound Token Gating
Only addresses that hold at least one SBT from the specified contract can vote. This ensures each voter is a verified community member.

### 🚫 Dual-Layer Blacklist Protection
**Contract-Level**: The SBT contract automatically burns tokens from contract-blacklisted users.
**Governance-Level**: Optional additional blacklist configured in Snapshot for extra flexibility and rapid response to new threats.

### 🗳️ Delegation Support
- Users can delegate their voting power through Snapshot's delegation system
- Optional on-chain delegation support via a delegation contract
- Delegated votes count toward the delegate's total voting power
- Users who delegate cannot vote themselves (prevents double voting)

### 🔄 Delegation Management
- Users can change who they delegate to at any time
- Users can remove their delegation to regain voting power
- Delegation changes are reflected immediately in voting calculations

### ⚖️ One Person, One Vote
Each SBT holder gets exactly 1 vote, regardless of how many SBTs they own. This ensures democratic participation.

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `address` | `string` | ✅ | Contract address of the Soulbound Token (handles contract blacklist automatically) |
| `additionalBlacklist` | `string[]` | ❌ | Additional addresses to exclude from voting (Snapshot-level blacklist) |
| `delegationSpace` | `string` | ❌ | Snapshot space for delegation (defaults to current space) |
| `useOnChainDelegation` | `boolean` | ❌ | Enable on-chain delegation support |
| `delegationContract` | `string` | ❌ | Contract address for on-chain delegation (required if useOnChainDelegation is true) |

**Note**: `additionalBlacklist` is supported in the strategy code but not defined in the UI schema due to array type limitations. No schema.json file is provided to avoid validation conflicts.

## Example Configuration

```json
{
  "address": "0x1234567890123456789012345678901234567890",
  "additionalBlacklist": [
    "0xbadactor1234567890123456789012345678901234",
    "0xbadactor2345678901234567890123456789012345"
  ],
  "delegationSpace": "evolabsdaotest.eth",
  "useOnChainDelegation": false
}
```

## Example with On-Chain Delegation

```json
{
  "address": "0x1234567890123456789012345678901234567890",
  "additionalBlacklist": [],
  "useOnChainDelegation": true,
  "delegationContract": "0x5678901234567890123456789012345678901234"
}
```

## Supermajority Requirement (80% Threshold)

**Note**: The 80% supermajority requirement for proposal passage cannot be implemented in the voting strategy itself. This must be configured in your Snapshot space settings:

1. Go to your Snapshot space settings
2. Navigate to "Voting" settings
3. Set "Quorum" to the minimum number of votes required
4. For 80% supermajority, proposals would need custom validation

Alternative approaches for 80% threshold:
- Use Snapshot's validation system with custom rules
- Implement post-voting verification in your governance process
- Use a governance contract that enforces the 80% threshold

## How It Works

1. **SBT Verification**: The strategy checks if each address owns at least one SBT
2. **Dual Blacklist Check**: 
   - **Contract-level**: SBT contract automatically burns tokens from contract-blacklisted users (balance = 0)
   - **Snapshot-level**: Additional addresses excluded via Snapshot configuration
3. **Delegation Resolution**: The strategy looks up delegation relationships
4. **Vote Calculation**: Each eligible SBT holder contributes 1 vote to their chosen delegate (or themselves if not delegated)
5. **Score Assignment**: Final voting power is assigned to addresses based on delegated + own votes

## Use Cases

- DAO governance requiring identity verification
- Community voting with sybil resistance
- Delegated voting systems with equal representation
- Governance with dual-layer blacklist protection against malicious actors

## Technical Notes

- Uses Snapshot's delegation system by default (when available)
- Gracefully handles networks where delegation subgraph is unavailable
- Supports both ERC-721 and ERC-1155 SBT contracts
- Efficient multicall implementation for gas optimization
- Compatible with all EVM-compatible networks
- Follows Snapshot strategy best practices
- No schema.json provided to avoid array type validation conflicts with UI

## Network Support

- **Delegation**: Available on networks with Snapshot delegation subgraph support
- **Fallback**: If delegation is unavailable, all SBT holders vote for themselves
- **On-chain Delegation**: Available on all networks when delegation contract is provided
