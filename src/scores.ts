import events from 'events';
import snapshot from '@snapshot-labs/strategies';
import { get, set } from './aws';
import { getBlockNum, sha256 } from './utils';

const eventEmitter = new events.EventEmitter();
// https://stackoverflow.com/a/26176922
eventEmitter.setMaxListeners(1000);

const withCache = !!process.env.AWS_REGION;

async function calculateScores(parent, args, key) {
  const { space = '', strategies, network, addresses } = args;
  let snapshotBlockNum = 'latest';

  if (args.snapshot !== 'latest') {
    const currentBlockNum = await getBlockNum(args.snapshot, network);
    snapshotBlockNum = currentBlockNum < args.snapshot ? 'latest' : args.snapshot;
  }

  const state = snapshotBlockNum === 'latest' ? 'pending' : 'final';
  let scores;

  if (withCache && state === 'final') scores = await get(key);

  let cache = true;
  if (!scores) {
    cache = false;
    scores = await snapshot.utils.getScoresDirect(
      space,
      strategies,
      network,
      snapshot.utils.getProvider(network),
      addresses,
      snapshotBlockNum
    );

    if (withCache && state === 'final') {
      set(key, scores);
    }
  }

  return {
    state,
    cache,
    scores
  };
}

export default async function scores(parent, args) {
  const key = sha256(JSON.stringify(args));

  return new Promise(async (resolve, reject) => {
    // Wait for scores to be calculated
    eventEmitter.once(key, (data) => (data.error ? reject(data.e) : resolve(data)));
    // If this request is the first one, calculate scores
    if (eventEmitter.listenerCount(key) === 1) {
      try {
        const scoresData = await calculateScores(parent, args, key);
        eventEmitter.emit(key, scoresData);
      } catch (e) {
        eventEmitter.emit(key, { error: true, e });
      }
    }
  });
}
