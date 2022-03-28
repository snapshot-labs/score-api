import { createHash } from 'crypto';
import pagination from './pagination';

export function clone(item) {
  return JSON.parse(JSON.stringify(item));
}

export function sha256(str) {
  return createHash('sha256')
    .update(str)
    .digest('hex');
}

export function paginateStrategies(space, network, strategies) {
  return strategies.map(strategy => {
    const key = sha256(JSON.stringify({ space, network, strategy }));
    if (pagination[key]) {
      console.log('Custom pagination', space, key, pagination[key]);
      return {
        name: 'pagination',
        network: strategy.network,
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

export function updateStrategyNetwork(network) {
  return strategy => {
    strategy.network = strategy.network || network;
    return strategy;
  };
}

export function sortObjectByParam(obj) {
  // sort object by param name
  const sortedObj = {};
  Object.keys(obj)
    .sort()
    .forEach(function(key) {
      sortedObj[key] = obj[key];
    });
  return sortedObj;
}
