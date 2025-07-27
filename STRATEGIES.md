# Snapshot Strategies & Validations

This directory contains voting strategies and validation strategies used by the Snapshot Score API.

## Adding a New Strategy

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
yarn test:strategy --strategy=my-new-strategy
```

## Adding a New Validation

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
yarn test:validation --validation=my-new-validation
```

## Checklist for new strategies

Here is a simple checklist to look at when reviewing a PR for a new strategy:

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

- Example must include at least 1 address with a positive score.
- Example must use a snapshot block number in the past.
- Addresses in example should be minimum 3 and maximum 20.

### Test

- The strategy should take less than 10sec to resolve.
- The strategy should work with 500 addresses. [Here is a list of addresses](https://github.com/labs/score/blob/master/test/strategies/unit/addresses.json).

### Recommended

- Add a README.md file that describes the strategy and provides an example of parameters.
- Use string ABI instead of object.
- Add proper TypeScript types for better development experience.
