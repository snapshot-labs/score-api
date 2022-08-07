import { createHash } from 'crypto';
import pagination from './pagination';

export function clone(item) {
  return JSON.parse(JSON.stringify(item));
}

export function sha256(str) {
  return createHash('sha256').update(str).digest('hex');
}

export function paginateStrategies(space, network, strategies) {
  return strategies.map((strategy) => {
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
    .forEach(function (key) {
      sortedObj[key] = obj[key];
    });
  return sortedObj;
}

export function formatStrategies(strategies: Array<any> = [], network) {
  strategies = Array.isArray(strategies) ? strategies : [];
  // update strategy network, strategy parameters should be same order to maintain consistent key hashes and limit to 8 strategies
  return strategies
    .map((strategy) => ({
      ...strategy,
      network: strategy?.network || network
    }))
    .map(sortObjectByParam)
    .slice(0, 8);
}

export function rpcSuccess(res, result, id = null, cache = false) {
  res.json({
    jsonrpc: '2.0',
    result,
    id,
    cache
  });
}

export function rpcError(res, code, e, id = null) {
  res.status(code).json({
    jsonrpc: '2.0',
    error: {
      code,
      message: 'unauthorized',
      data: e
    },
    id
  });
}
