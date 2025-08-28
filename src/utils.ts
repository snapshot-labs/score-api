import { createHash } from 'crypto';
import { EMPTY_ADDRESS } from './constants';
import getStrategies from './helpers/strategies';
import snapshot from './strategies';

const broviderUrl = process.env.BROVIDER_URL || 'https://rpc.snapshot.org';

export const blockNumByNetwork = {};
const blockNumByNetworkTs = {};
const delay = 120;

export function clone(item) {
  return JSON.parse(JSON.stringify(item));
}

export function sha256(str) {
  return createHash('sha256').update(str).digest('hex');
}

export function sortObjectByParam(obj: Record<string, any>) {
  // sort object by param name
  const sortedObj: Record<string, any> = {};
  Object.keys(obj)
    .sort()
    .forEach(function (key) {
      sortedObj[key] = obj[key];
    });
  return sortedObj;
}

export function formatStrategies(network, strategies: Array<any> = []) {
  strategies = Array.isArray(strategies) ? strategies : [];
  // update strategy network, strategy parameters should be same order to maintain consistent key hashes
  return strategies
    .map(strategy => ({
      ...strategy,
      network: strategy?.network || network
    }))
    .map(sortObjectByParam);
}

export function checkInvalidStrategies(strategies): Array<string> {
  const strategyNames = strategies.map(strategy => strategy.name);
  const snapshotStrategiesNames = Object.keys(getStrategies());
  const invalidStrategies: Array<string> = strategyNames.filter(
    s => s === undefined || !snapshotStrategiesNames.includes(s)
  );

  return [...new Set(invalidStrategies)];
}

export function rpcSuccess(res, result, id, cache = false) {
  res.json({
    jsonrpc: '2.0',
    result,
    id,
    cache
  });
}

export function rpcError(res, code, e, id) {
  res.status(code).json({
    jsonrpc: '2.0',
    error: {
      code,
      message: 'unauthorized',
      data: e.message || e
    },
    id
  });
}

export async function getCurrentBlockNum(snapshotBlock, network) {
  if (blockNumByNetwork[network] && snapshotBlock <= blockNumByNetwork[network])
    return blockNumByNetwork[network];
  const ts = parseInt((Date.now() / 1e3).toFixed());
  if (blockNumByNetwork[network] && blockNumByNetworkTs[network] > ts - delay)
    return blockNumByNetwork[network];

  const provider = snapshot.utils.getProvider(network, { broviderUrl });
  const blockNum = await provider.getBlockNumber();

  blockNumByNetwork[network] = blockNum;
  blockNumByNetworkTs[network] = ts;

  return blockNum;
}

export function getIp(req) {
  const ips = (
    req.headers['cf-connecting-ip'] ||
    req.headers['x-real-ip'] ||
    req.headers['x-forwarded-for'] ||
    req.connection.remoteAddress ||
    ''
  ).split(',');

  return ips[0].trim();
}
export function isAddressValid(address: string, allowEmpty = false): boolean {
  if (address === EMPTY_ADDRESS) {
    return allowEmpty;
  }

  try {
    snapshot.utils.getFormattedAddress(address);
    return true;
  } catch (e: any) {
    return false;
  }
}
