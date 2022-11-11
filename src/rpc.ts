import express from 'express';
import snapshot from '@snapshot-labs/strategies';
import scores from './scores';
import { clone, formatStrategies, rpcSuccess, rpcError, blockNumByNetwork } from './utils';
import { version } from '../package.json';
import { getVp, validate } from './methods';

const router = express.Router();

router.post('/', async (req, res) => {
  const { id = null, method, params = {} } = req.body;

  if (!method) return rpcError(res, 500, 'missing method', id);

  if (method === 'get_vp') {
    try {
      return await getVp(res, params, id);
    } catch (e) {
      console.log('[rpc] get_vp failed', params.space, e);
      return rpcError(res, 500, e, id);
    }
  }

  if (method === 'validate') {
    try {
      return await validate(res, params, id);
    } catch (e) {
      console.log('[rpc] validate failed', e);
      return rpcError(res, 500, e, id);
    }
  }

  if (!method) return rpcError(res, 500, 'wrong method', id);
});

router.get('/api', (req, res) => {
  const commit = process.env.COMMIT_HASH || '';
  const v = commit ? `${version}#${commit.substr(0, 7)}` : version;
  res.json({
    block_num: blockNumByNetwork,
    version: v
  });
});

router.get('/api/strategies', (req, res) => {
  const strategies = Object.fromEntries(
    Object.entries(clone(snapshot.strategies)).map(([key, strategy]) => [
      key,
      // @ts-ignore
      { key, ...strategy }
    ])
  );
  res.json(strategies);
});

router.get('/api/validations', (req, res) => {
  const validations = Object.fromEntries(
    Object.entries(clone(snapshot.validations)).map(([key, validation]) => [
      key,
      // @ts-ignore
      { key, ...validation }
    ])
  );
  res.json(validations);
});

router.post('/api/scores', async (req, res) => {
  const { params = {} } = req.body || {};
  const requestId = req.headers['x-request-id'];
  const { space = '', network = '1', snapshot = 'latest', addresses = [] } = params;
  let { strategies = [] } = params;
  strategies = formatStrategies(strategies, network);
  const strategyNames = strategies.map((strategy) => strategy.name);

  if (
    ['1319'].includes(network) ||
    ['revotu.eth', 'aitd.eth', 'benttest.eth'].includes(space) ||
    strategyNames.includes('pod-leader') ||
    strategies.length === 0
  )
    return rpcError(res, 500, 'something wrong with the strategies', null);

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
  } catch (e) {
    console.log(
      '[rpc] Get scores failed',
      network,
      space,
      JSON.stringify(strategies),
      e,
      requestId
    );
    return rpcError(res, 500, e, null);
  }
  const cache = result.cache || false;
  delete result.cache;
  return rpcSuccess(res, result, null, cache);
});

export default router;
