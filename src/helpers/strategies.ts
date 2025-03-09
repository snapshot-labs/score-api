import snapshot from '@snapshot-labs/strategies';
import { DISABLED_STRATEGIES } from '../constants';
import { clone } from '../utils';

let strategiesCache;

export default function getStrategies() {
  if (strategiesCache) {
    return strategiesCache;
  }

  strategiesCache = Object.fromEntries(
    Object.entries(clone(snapshot.strategies)).map(([key, strategy]) => {
      // @ts-ignore
      const normalizedStrategy = { key, ...strategy };
      if (DISABLED_STRATEGIES.includes(key)) {
        normalizedStrategy.disabled = true;
      }

      return [key, normalizedStrategy];
    })
  );

  return strategiesCache;
}
