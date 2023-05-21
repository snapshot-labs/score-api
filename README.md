# Snapshot Score API
The Score API is a simple RESTful API that calculates scores for various strategies based on the Snapshot protocol. This README outlines the functionality provided by the API and how to use it without any specific code examples.

---
We recommend using the [snapshot.js](https://github.com/snapshot-labs/snapshot.js) library for obtaining voting power and doing validation, as it provides a simple and convenient way to interact with the Snapshot Score API. The snapshot.js library offers the following methods:

- `getScores()` - https://docs.snapshot.org/tools/snapshot.js#getscores
- `getVp()` - https://github.com/snapshot-labs/snapshot.js/blob/ad55119b0b684f7d6eeaa06f3642f7424d1fa949/src/utils.ts#L190
- `validate()` - https://github.com/snapshot-labs/snapshot.js/blob/ad55119b0b684f7d6eeaa06f3642f7424d1fa949/src/utils.ts#L227
---

The URL for score api is `https://score.snapshot.org`

## API Endpoints

### 1. POST /
The base endpoint serves as the entry point for various methods:

- get_vp: Calculate voting power for a given address using strategies.
- validate: Validate a given address using validation strategies.



### 2. GET /api
This endpoint returns the current version of the Snapshot Score API and block numbers for different networks.

Send a GET request to this endpoint to receive a JSON object containing the version and block_num properties.

### 3. GET /api/strategies
This endpoint returns a list of available strategies for calculating voting power.

Send a GET request to this endpoint to receive a JSON object containing key-value pairs representing the strategies and their respective information.

### 4. GET /api/validations
This endpoint returns a list of available validation strategies for address validation.

Send a GET request to this endpoint to receive a JSON object containing key-value pairs representing the validation strategies and their respective information.

### 5. POST /api/scores
This endpoint calculates scores for a given set of strategies and addresses.

To use this endpoint, send a POST request with a JSON body containing the params object. The params object should include:

- space: The id of the space to calculate scores for.
- network: The network ID to use for calculations.
- snapshot: A specific block number or 'latest' for the latest block.
- addresses: An array of addresses for which the scores will be calculated.
- strategies: An array of strategy objects, each containing a name and params property.
- force: A boolean indicating whether to force the calculation of scores despite potential restrictions.


## Running the API locally with Docker

You can run the API locally using Docker. To do so, follow these steps:

1. Clone the repository and `cd` into it.
2. Copy the `.env.example` file to `.env` and set necessary values.
3. Run `docker-compose up -d` to start the API.
