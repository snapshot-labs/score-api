import snapshot from '@snapshot-labs/strategies';
import { clone } from '../utils';

let strategiesCache;

export default async function getStrategies() {
  if (strategiesCache) {
    return strategiesCache;
  }

  strategiesCache = Object.fromEntries(
    Object.entries(clone(snapshot.strategies)).map(([key, strategy]) => [
      key,
      // @ts-ignore
      { key, ...strategy }
    ])
  );

  return strategiesCache;
}
