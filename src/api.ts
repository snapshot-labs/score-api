import express from 'express';
import snapshot from '@snapshot-labs/strategies';
import scores, { blockNumByNetwork } from './scores';
import { clone, sha256, tsToBlockNum } from './utils';
import client from './redis';

const router = express.Router();

router.get('/', (req, res) => {
  res.json(blockNumByNetwork);
});

router.get('/block', async (req, res) => {
  let networks: any = req.query.network || '1';
  const ts = req.query.ts || 1640300930;
  if (!Array.isArray(networks)) networks = [networks];

  // Check cache
  const cache: any = await client.hGetAll(`blocks:${ts}`);

  const p: any[] = [];
  networks.map(network => {
    p.push(cache[network] ? parseInt(cache[network]) : tsToBlockNum(network, ts));
  });
  const blockNums = await Promise.all(p);
  const blockNumsObj = Object.fromEntries(blockNums.map((blockNum, i) => [networks[i], blockNum]));
  res.json(blockNumsObj);

  // Cache results
  const multi = client.multi();
  Object.entries(blockNumsObj).forEach(([network, blockNum]: any) => {
    if (![0, 'error', 'latest'].includes(blockNum)) multi.hSet(`blocks:${ts}`, network, blockNum);
  });
  await multi.exec();
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
  const strategyNames = strategies.map(strategy => strategy.name);

  if (['revotu.eth'].includes(space) || strategyNames.includes('pod-leader'))
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
    const strategiesHashes = strategies.map(strategy => sha256(JSON.stringify({ space, network, strategy })));
    console.log('Get scores failed', network, space, JSON.stringify(e).slice(0, 256), strategiesHashes);
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
