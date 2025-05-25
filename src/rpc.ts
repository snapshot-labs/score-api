import { capture } from '@snapshot-labs/snapshot-sentry';
import express from 'express';
import disabled from './disabled.json';
import getStrategies from './helpers/strategies';
import getValidations from './helpers/validations';
import { getVp, validate, verifyGetVp, verifyValidate } from './methods';
import serve from './requestDeduplicator';
import scores from './scores';
import {
  blockNumByNetwork,
  checkInvalidStrategies,
  formatStrategies,
  getFormattedAddress,
  rpcError,
  rpcSuccess
} from './utils';
import { version } from '../package.json';

const router = express.Router();

function handlePostError(
  res: express.Response,
  params: any,
  method: string,
  e: any,
  id: string | null
) {
  capture(e, { params, method });
  let error = JSON.stringify(e?.message || e || 'Unknown error').slice(0, 1000);

  // Detect provider error
  if (e?.reason && e?.error?.reason && e?.error?.url) {
    error = `[provider issue] ${e.error.url}, reason: ${e.reason}, ${e.error.reason}`;
  }

  console.log(`[rpc] ${method} failed`, JSON.stringify(params), error);
  return rpcError(res, 500, e, id);
}

router.post('/', async (req, res) => {
  const { id = null, method, params = {} } = req.body;

  switch (method) {
    case 'get_vp':
      if (params.space && disabled.includes(params.space))
        return rpcError(res, 429, 'too many requests', id);

      try {
        verifyGetVp(params);
      } catch (e: any) {
        return rpcError(res, 400, e, id);
      }

      try {
        const response: any = await serve(JSON.stringify(params), getVp, [
          params
        ]);
        return rpcSuccess(res, response.result, id, response.cache);
      } catch (e: any) {
        return handlePostError(res, params, method, e, id);
      }

    case 'validate':
      try {
        verifyValidate(params);
      } catch (e: any) {
        return rpcError(res, 400, e, id);
      }

      try {
        const result = await serve(JSON.stringify(params), validate, [params]);
        return rpcSuccess(res, result, id);
      } catch (e: any) {
        return handlePostError(res, params, method, e, id);
      }

    default:
      return rpcError(res, 400, 'wrong method', id);
  }
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
    addresses.forEach(getFormattedAddress);
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
