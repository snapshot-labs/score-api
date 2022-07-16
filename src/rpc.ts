import express from 'express';
import snapshot from '@snapshot-labs/strategies';
import scores, { blockNumByNetwork } from './scores';
import { clone, sha256, formatStrategies, rpcSuccess, rpcError } from './utils';
import { version } from '../package.json';

const router = express.Router();

router.post('/', async (req, res) => {
  const { id = null, params = {} } = req.body;
  try {
    const result = await snapshot.utils.getVp(
      params.address,
      params.network,
      params.strategies,
      params.snapshot,
      params.space,
      params.delegation
    );
    return rpcSuccess(res, result, id);
  } catch (e) {
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
  const strategyNames = strategies.map(strategy => strategy.name);

  if (['revotu.eth'].includes(space) || strategyNames.includes('pod-leader') || strategies.length === 0)
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
    const strategiesHashes = strategies.map(strategy => sha256(JSON.stringify({ space, network, strategy })));
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

  return rpcSuccess(res, result, null);
});

export default router;
