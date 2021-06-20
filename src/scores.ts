import { createHash } from 'crypto';
import snapshot from '@snapshot-labs/snapshot.js';
import { get, set } from './aws';

export const blockNumByNetwork = {};
const blockNumByNetworkTs = {};
const delay = 30;

async function getBlockNum(network) {
  const ts = parseInt((Date.now() / 1e3).toFixed());
  if (blockNumByNetwork[network] && blockNumByNetworkTs[network] > ts - delay) return blockNumByNetwork[network];

  const provider = snapshot.utils.getProvider(network);
  const blockNum = await provider.getBlockNumber();

  blockNumByNetwork[network] = blockNum;
  blockNumByNetworkTs[network] = ts;

  return blockNum;
}

export default async function(parent, args) {
  const { space = '', strategies, network, addresses } = args;

  const key = createHash('sha256')
    .update(JSON.stringify(args))
    .digest('hex');
  console.log('Key', key);

  let snapshotBlockNum = 'latest';
  if (args.snapshot !== 'latest') {
    const currentBlockNum = await getBlockNum(network);
    snapshotBlockNum = currentBlockNum < args.snapshot ? 'latest' : args.snapshot;
  }

  const state = snapshotBlockNum === 'latest' ? 'pending' : 'final';
  let scores;

  if (state === 'final') {
    console.log('Check cache');
    scores = await get(key);
  }

  if (!scores) {
    console.log('Get scores');
    // @ts-ignore
    scores = await snapshot.utils.getScoresDirect(
      space,
      strategies,
      network,
      snapshot.utils.getProvider(network),
      addresses,
      snapshotBlockNum
    );

    if (state === 'final') {
      set(key, scores).then(() => console.log('Stored!'));
    }
  }

  return {
    state,
    scores
  };
}
