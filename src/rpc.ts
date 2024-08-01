import { getAddress } from '@ethersproject/address';
import { capture } from '@snapshot-labs/snapshot-sentry';
import express from 'express';
import { EMPTY_ADDRESS, MAX_STRATEGIES } from './constants';
import disabled from './disabled.json';
import getStrategies from './helpers/strategies';
import getValidations from './helpers/validations';
import { getVp, validate } from './methods';
import serve from './requestDeduplicator';
import scores from './scores';
import {
  blockNumByNetwork,
  checkInvalidStrategies,
  formatStrategies,
  rpcError,
  rpcSuccess
} from './utils';
import { version } from '../package.json';

const router = express.Router();

router.post('/', async (req, res) => {
  const { id = null, method, params = {} } = req.body;

  if (!method) return rpcError(res, 400, 'missing method', id);

  try {
    if (
      (method === 'get_vp' && !params.address) ||
      (method === 'validate' && !params.author) ||
      params.address === EMPTY_ADDRESS ||
      params.author === EMPTY_ADDRESS
    ) {
      throw new Error('invalid address');
    }
    getAddress(params.address || params.author);
  } catch (e: any) {
    return rpcError(res, 400, 'invalid address', id);
  }

  if (method === 'get_vp') {
    if (params.space && disabled.includes(params.space))
      return rpcError(res, 429, 'too many requests', id);
    if (
      !params.strategies ||
      params.strategies.length === 0 ||
      params.strategies.length > MAX_STRATEGIES
    ) {
      return rpcError(res, 400, 'invalid strategies length', id);
    }

    const invalidStrategies = checkInvalidStrategies(params.strategies);
    if (invalidStrategies.length > 0) {
      return rpcError(
        res,
        400,
        `invalid strategies: ${invalidStrategies}`,
        null
      );
    }

    try {
      const response: any = await serve(JSON.stringify(params), getVp, [
        params
      ]);
      return rpcSuccess(res, response.result, id, response.cache);
    } catch (e: any) {
      capture(e, { params, method });
      let error = JSON.stringify(e?.message || e || 'Unknown error').slice(
        0,
        1000
      );

      // Detect provider error
      if (e?.reason && e?.error?.reason && e?.error?.url) {
        error = `[provider issue] ${e.error.url}, reason: ${e.reason}, ${e.error.reason}`;
      }

      console.log(
        '[rpc] get_vp failed',
        params.space,
        params.address,
        params.network,
        params.snapshot,
        error
      );
      return rpcError(res, 500, e, id);
    }
  }

  if (method === 'validate') {
    try {
      const result = await serve(JSON.stringify(params), validate, [params]);
      return rpcSuccess(res, result, id);
    } catch (e: any) {
      capture(e, { params, method });
      let error = JSON.stringify(e?.message || e || 'Unknown error').slice(
        0,
        1000
      );

      // Detect provider error
      if (e?.reason && e?.error?.reason && e?.error?.url) {
        error = `[provider issue] ${e.error.url}, reason: ${e.reason}, ${e.error.reason}`;
      }

      console.log('[rpc] validate failed', JSON.stringify(params), error);
      return rpcError(res, 500, e, id);
    }
  }

  return rpcError(res, 400, 'wrong method', id);
});

router.get('/', (req, res) => {
  const commit = process.env.COMMIT_HASH ?? '';
  const v = commit ? `${version}#${commit.substring(0, 7)}` : version;
  res.json({
    block_num: blockNumByNetwork,
    version: v
  });
});

router.get('/api/strategies', (req, res) => {
  const strategies = getStrategies();
  res.json(strategies);
});

router.get('/api/validations', (req, res) => {
  const validations = getValidations();
  res.json(validations);
});

router.post('/api/scores', async (req, res) => {
  const { params = {} } = req.body || {};
  const requestId = req.headers['x-request-id'];
  const {
    space = '',
    network = '1',
    snapshot = 'latest',
    addresses = [],
    force = false
  } = params;
  let { strategies = [] } = params;
  strategies = formatStrategies(network, strategies);
  const invalidStrategies = checkInvalidStrategies(strategies);
  if (invalidStrategies.length > 0) {
    return rpcError(res, 400, `invalid strategies: ${invalidStrategies}`, null);
  }

  const strategyNames = strategies.map(strategy => strategy.name);
  if (
    ['1319'].includes(network) ||
    (disabled.includes(space) && !force) ||
    strategyNames.includes('pod-leader') ||
    strategies.length === 0
  )
    return rpcError(res, 500, 'something wrong with the strategies', null);

  try {
    addresses.forEach(getAddress);
  } catch (e: any) {
    return rpcError(res, 400, 'invalid address', null);
  }

  let result;
  try {
    result = await scores(
      {
        requestId,
        strategyNames
      },
      {
        space,
        network,
        snapshot,
        strategies,
        addresses
      }
    );
  } catch (e: any) {
    capture(e, { params, strategies });
    // @ts-ignore
    const errorMessage = e?.message || e || 'Unknown error';
    console.log(
      '[rpc] Get scores failed',
      network,
      space,
      snapshot,
      JSON.stringify(strategies),
      JSON.stringify(errorMessage).slice(0, 256),
      requestId
    );
    return rpcError(res, 500, e, null);
  }
  const cache = result.cache || false;
  delete result.cache;
  return rpcSuccess(res, result, null, cache);
});

export default router;
