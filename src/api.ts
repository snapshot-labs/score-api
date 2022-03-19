import express from 'express';
import snapshot from '@snapshot-labs/strategies';
import scores, { blockNumByNetwork } from './scores';
import { clone, sha256, sortObjectByParam } from './utils';

const router = express.Router();

router.get('/', (req, res) => {
  res.json(blockNumByNetwork);
});

router.get('/strategies', (req, res) => {
  const strategies = Object.fromEntries(
    Object.entries(clone(snapshot.strategies)).map(([key, strategy]) => [
      key,
      // @ts-ignore
      { key, ...strategy }
    ])
  );
  res.json(strategies);
});

router.post('/scores', async (req, res) => {
  const { params = {} } = req.body || {};
  const requestId = req.headers['x-request-id'];
  const { space = '', network = '1', snapshot = 'latest', addresses = [] } = params;
  let { strategies = [] } = params;
  // strategy parameters should be same order to maintain consistent key hashes
  strategies = Array.isArray(strategies) ? strategies.map(sortObjectByParam) : [];
  const strategyNames = strategies.map(strategy => strategy.name);

  if (['revotu.eth'].includes(space) || strategyNames.includes('pod-leader') || strategies.length === 0)
    return res.status(500).json({
      jsonrpc: '2.0',
      error: {
        code: 500,
        data: 'something wrong with the strategies'
      }
    });

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
    const strategiesHashes = strategies.map(strategy => sha256(JSON.stringify({ space, network, strategy })));
    console.log(
      'Get scores failed',
      network,
      space,
      JSON.stringify(strategies),
      JSON.stringify(e).slice(0, 256),
      strategiesHashes,
      requestId
    );
    return res.status(500).json({
      jsonrpc: '2.0',
      error: {
        code: 500,
        data: e
      }
    });
  }

  return res.json({
    jsonrpc: '2.0',
    result
  });
});

export default router;
