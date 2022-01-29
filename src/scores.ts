import { createHash } from 'crypto';
import events from 'events';
import snapshot from '@snapshot-labs/strategies';
import { get, set } from './aws';
import { paginateStrategies, sha256 } from './utils';

const eventEmitter = new events.EventEmitter();
// https://stackoverflow.com/a/26176922
eventEmitter.setMaxListeners(1000);
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

async function calculateScores(args, key) {
  const { space = '', strategies, network, addresses } = args;
  console.log('Request:', space, network, key);

  let snapshotBlockNum = 'latest';
  if (args.snapshot !== 'latest') {
    const currentBlockNum = await getBlockNum(network);
    snapshotBlockNum = currentBlockNum < args.snapshot ? 'latest' : args.snapshot;
  }

  const state = snapshotBlockNum === 'latest' ? 'pending' : 'final';
  let scores;

  if (state === 'final') scores = await get(key);

  let cache = true;
  if (!scores) {
    cache = false;
    const strategiesWithPagination = paginateStrategies(space, network, strategies);
    scores = await snapshot.utils.getScoresDirect(
      space,
      strategiesWithPagination,
      network,
      snapshot.utils.getProvider(network),
      addresses,
      snapshotBlockNum
    );

    if (state === 'final') {
      set(key, scores).then(() => {
        // console.log('Stored!');
      });
    }
  }

  return {
    state,
    cache,
    scores
  };
}

export default async function scores(parent, args) {
  const key = createHash('sha256')
    .update(JSON.stringify(args))
    .digest('hex');
  // console.log('Key', key, JSON.stringify({ space, strategies, network }), addresses.length);

  return new Promise(async resolve => {
    // Wait for scores to be calculated
    eventEmitter.once(key, data => resolve(data));
    // If this request is the first one, calculate scores
    if (eventEmitter.listenerCount(key) === 1) {
      const scoresData = await calculateScores(args, key);
      eventEmitter.emit(key, scoresData);
    }
  });
}
