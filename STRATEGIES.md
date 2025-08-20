# Snapshot strategies & validations

This directory contains voting strategies and validation strategies used by the Snapshot Score API.

## Adding a new strategy

### 1. Create the strategy folder

Create a new folder under `src/strategies/strategies/` with your strategy name (use kebab-case).

```text
src/strategies/strategies/my-new-strategy/
├── index.ts
├── examples.json
├── schema.json (optional)
└── README.md (recommended)
```

### 2. Implement the strategy

Update code in index.ts with your strategy implementation, and examples in examples.json and schema.json if needed:

### 3. Add to index

Add your strategy to `src/strategies/strategies/index.ts`:

### 4. Test your strategy

```bash
yarn test:strategy my-new-strategy
# To test with 500 addresses
yarn test:strategy my-new-strategy 500
```

## Adding a new validation

Same as above but create a new folder under `src/strategies/validations/` with your validation name.

```text
src/strategies/validations/my-new-validation/
├── index.ts
├── examples.json
├── schema.json (optional)
└── README.md (recommended)
```

### Add to index

Add your validation to `src/strategies/validations/index.ts`:

### Test your validation

```bash
yarn test:validation my-new-validation
```

## Checklist for new strategies

Here is a simple checklist to use when reviewing a PR for a new strategy:

### Overview

- The strategy must be unique.
- If the strategy does only a single call with an address as input, it's preferable to use the strategy "contract-call" instead of creating a new one.
- For validations better to use `basic` validation and use existing strategies

### Code

- Strategies should always use a `snapshot` to calculate user's voting power. As a result the voting power should not change throughout the proposal duration.
- There should be a maximum of 5 requests, a request can use "fetch" a "subgraphRequest" or "multicall".
- The strategy should not send a request for each voters, this doesn't scale.
- The strategy PR should not add any new dependency.
- The score returned by the strategy should use the same casing for address as on the input, or should return checksum addresses.
- Make sure that voting power of one address does not depend on other addresses.

### Example

- The example must include at least one address with a positive score.
- The example must use a snapshot block number in the past.
- The number of addresses in the example should be a minimum of 3 and a maximum of 20.

### Test

- The strategy should take less than 10 seconds to resolve.
- The strategy should work with 500 addresses.

### Recommended

- Add a README.md file that describes the strategy and provides an example of parameters.
- Use string ABI instead of object ABI.
- Add proper TypeScript types for a better development experience.
