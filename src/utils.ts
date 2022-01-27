import { createHash } from 'crypto';
import pagination from './pagination.json';

export function clone(item) {
  return JSON.parse(JSON.stringify(item));
}

export function sha256(str) {
  return createHash('sha256')
    .update(str)
    .digest('hex');
}

export function paginateStrategies(space, network, strategies) {
  return strategies.forEach(strategy => {
    const key = sha256(JSON.stringify({ space, network, strategy }));
    if (pagination[key]) {
      return {
        name: 'pagination',
        params: {
          limit: pagination[key],
          symbol: strategy.params.symbol || '',
          strategy
        }
      };
    }
    return strategy;
  });
}
