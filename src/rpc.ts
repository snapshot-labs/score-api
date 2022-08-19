import express from 'express';
import snapshot from '@snapshot-labs/strategies';
import scores from './scores';
import redis from './redis';
import {
  clone,
  sha256,
  formatStrategies,
  rpcSuccess,
  rpcError,
  getBlockNum,
  blockNumByNetwork
} from './utils';
import { version } from '../package.json';

const router = express.Router();

router.post('/', async (req, res) => {
  const { id = null, params = {} } = req.body;
  try {
    if (typeof params.snapshot !== 'number') params.snapshot = 'latest';
    if (params.snapshot !== 'latest') {
      const currentBlockNum = await getBlockNum(params.network);
      params.snapshot = currentBlockNum < params.snapshot ? 'latest' : params.snapshot;
    }
    const key = sha256(JSON.stringify(params));
    if (redis && params.snapshot !== 'latest') {
      const cache = await redis.hGetAll(`vp:${key}`);
      if (cache && cache.vp_state) {
        cache.vp = parseFloat(cache.vp);
        cache.vp_by_strategy = JSON.parse(cache.vp_by_strategy);
        return rpcSuccess(res, cache, id, true);
      }
    }
    const result = await snapshot.utils.getVp(
      params.address,
      params.network,
      params.strategies,
      params.snapshot,
      params.space,
      params.delegation
    );
    if (redis && result.vp_state === 'final') {
      const multi = redis.multi();
      multi.hSet(`vp:${key}`, 'vp', result.vp);
      multi.hSet(`vp:${key}`, 'vp_by_strategy', JSON.stringify(result.vp_by_strategy));
      multi.hSet(`vp:${key}`, 'vp_state', result.vp_state);
      multi.exec();
    }
    return rpcSuccess(res, result, id);
  } catch (e) {
    console.log("getVp failed", JSON.stringify(e));
    return rpcError(res, 500, e, id);
  }
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

router.post('/api/scores', async (req, res) => {
  const { params = {} } = req.body || {};
  const requestId = req.headers['x-request-id'];
  const { space = '', network = '1', snapshot = 'latest', addresses = [] } = params;
  let { strategies = [] } = params;
  strategies = formatStrategies(strategies, network);
  const strategyNames = strategies.map((strategy) => strategy.name);

  if (
    ['revotu.eth'].includes(space) ||
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
    // @ts-ignore
    const errorMessage = e?.message || e;
    const strategiesHashes = strategies.map((strategy) =>
      sha256(JSON.stringify({ space, network, strategy }))
    );
    console.log(
      'Get scores failed',
      network,
      space,
      JSON.stringify(strategies),
      JSON.stringify(errorMessage).slice(0, 256),
      strategiesHashes,
      requestId
    );
    return rpcError(res, 500, e, null);
  }
  const cache = result.cache || false;
  delete result.cache;
  return rpcSuccess(res, result, null, cache);
});

export default router;
