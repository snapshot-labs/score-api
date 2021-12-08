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
  const { space = '', network, snapshot = 'latest', strategies, addresses } = params;

  if (
    strategies.map(strategy => strategy.name).includes('pod-leader') ||
    strategies.map(strategy => strategy.name).includes('biswap')
  )
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
      {},
      {
        space,
        network,
        snapshot,
        strategies,
        addresses
      }
    );
  } catch (e) {
    console.log('Get scores failed', network, space, JSON.stringify(e).slice(0, 256));
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
