import express from 'express';
import snapshot from '@snapshot-labs/strategies';
import scores, { blockNumByNetwork } from './scores';
import { clone } from './utils';

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
  const { params } = req.body;
  const { space = '', network, snapshot: snapshotBlock = 'latest', addresses } = params;
  let { strategies } = params;
  strategies = strategies.map(strategy => {
    if (snapshot.alias && snapshot.alias[strategy.name]) {
      strategy.name = snapshot.alias[strategy.name];
    }
    return strategy;
  });
  let result;
  try {
    result = await scores(
      {},
      {
        space,
        network,
        snapshot: snapshotBlock,
        strategies,
        addresses
      }
    );
  } catch (e) {
    console.log('Get scores failed', space, e);
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
