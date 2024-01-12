import SpaceSchema from '@snapshot-labs/snapshot.js/src/schemas/space.json';

const maxStrategiesWithSpaceType =
  SpaceSchema.definitions.Space.properties.strategies.maxItemsWithSpaceType;

export const EMPTY_ADDRESS = '0x0000000000000000000000000000000000000000';
export const MAX_STRATEGIES = {
  default: maxStrategiesWithSpaceType['default'],
  turbo: maxStrategiesWithSpaceType['turbo']
};
export const APP_NAME = 'score-api';
export const AWS_CACHE_KEY = '4';
