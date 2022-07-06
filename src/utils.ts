import { createHash } from 'crypto';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import pagination from './pagination';

const providers = {};

export function clone(item) {
  return JSON.parse(JSON.stringify(item));
}

export function sha256(str) {
  return createHash('sha256')
    .update(str)
    .digest('hex');
}

export function getProvider(network) {
  const url = `https://brovider.xyz/${network}`;
  if (!providers[network]) providers[network] = new StaticJsonRpcProvider({ url, timeout: 30000 });
  return providers[network];
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

function sortObjectByParam(obj) {
  // sort object by param name
  const sortedObj = {};
  Object.keys(obj)
    .sort()
    .forEach(function(key) {
      sortedObj[key] = obj[key];
    });
  return sortedObj;
}

export function formatStrategies(strategies: Array<any> = [], network) {
  strategies = Array.isArray(strategies) ? strategies : [];
  // update strategy network, strategy parameters should be same order to maintain consistent key hashes and limit to 8 strategies
  return strategies
    .map(strategy => ({
      ...strategy,
      network: strategy?.network || network
    }))
    .map(sortObjectByParam)
    .slice(0, 8);
}
