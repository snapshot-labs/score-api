import snapshot from '@snapshot-labs/strategies';
import { get, set } from './aws';
import { getCurrentBlockNum, sha256 } from './utils';
import serve from './requestDeduplicator';

const broviderUrl = process.env.BROVIDER_URL || 'https://rpc.snapshot.org';

async function calculateScores(parent, args, key) {
  const withCache = !!process.env.AWS_REGION;
  const { space = '', strategies, network, addresses } = args;
  let snapshotBlockNum = 'latest';

  if (args.snapshot !== 'latest') {
    const currentBlockNum = await getCurrentBlockNum(args.snapshot, network);
    snapshotBlockNum =
      currentBlockNum < args.snapshot ? 'latest' : args.snapshot;
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
      snapshot.utils.getProvider(network, { broviderUrl }),
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

export default function scores(parent, args) {
  const id = JSON.stringify(args);
  const cacheKey = sha256(id);
  return serve(id, calculateScores, [parent, args, cacheKey]);
}
