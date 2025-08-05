
# Sonic Staked Balance

## How is Voting Power Calculated?

- **If you are a validator:**
  - Your voting power is the total amount of SONIC tokens delegated to you by others (including your own stake), **unless you are deactivated**.
  - If you are deactivated, your voting power is **zero**.

- **If you are a staker (not a validator):**
  - Your voting power is the total amount of SONIC tokens you have staked (delegated) to active validators.
  - Stakes to deactivated validators do **not** count.

## Example Table

| Who are you?           | What counts for your voting power?                |
|------------------------|--------------------------------------------------|
| Active Validator       | All SONIC tokens delegated to you                |
| Deactivated Validator  | 0 (no voting power)                              |
| Staker                 | All your SONIC tokens staked to active validators|
