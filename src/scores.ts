import snapshot from '@snapshot-labs/strategies';
import { get, set } from './aws';
import { getBlockNum, sha256 } from './utils';
import serve from './requestDeduplicator';

const broviderUrl = process.env.BROVIDER_URL || 'https://rpc.snapshot.org';

async function calculateScores(args, key) {
  const withCache = !!process.env.AWS_REGION;
  const { space = '', strategies, network, addresses } = args;
  let snapshotBlockNum = args.snapshot || 'latest';

  if (snapshotBlockNum !== 'latest') {
    const currentBlockNum = await getBlockNum(snapshotBlockNum, network);
    snapshotBlockNum = currentBlockNum < snapshotBlockNum ? 'latest' : snapshotBlockNum;
  }

  const state = snapshotBlockNum === 'latest' ? 'pending' : 'final';

  let scores;
  let cache = false;

  if (withCache && state === 'final') {
    cache = true;
    scores = await get(key);
  }

  if (!scores) {
    cache = false;
    const provider = snapshot.utils.getProvider(network, { broviderUrl });
    scores = await snapshot.utils.getScoresDirect(
      space,
      strategies,
      network,
      provider,
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

export default function scores(args) {
  const id = JSON.stringify(args);
  const cacheKey = sha256(id);
  return serve(id, calculateScores, [args, cacheKey]);
}
