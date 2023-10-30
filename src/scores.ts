import snapshot from '@snapshot-labs/strategies';
import { getCurrentBlockNum, sha256 } from './utils';
import serve from './requestDeduplicator';
import { cachedScores } from './helpers/cache';

const broviderUrl = process.env.BROVIDER_URL || 'https://rpc.snapshot.org';

type ScoresResult = ReturnType<typeof snapshot.utils.getScoresDirect>;

async function calculateScores(parent, args, key) {
  const { space = '', strategies, network, addresses } = args;
  let snapshotBlockNum = 'latest';

  if (args.snapshot !== 'latest') {
    const currentBlockNum = await getCurrentBlockNum(args.snapshot, network);
    snapshotBlockNum = currentBlockNum < args.snapshot ? 'latest' : args.snapshot;
  }

  const state = snapshotBlockNum === 'latest' ? 'pending' : 'final';
  const results = await cachedScores<ScoresResult>(
    key,
    async () =>
      await snapshot.utils.getScoresDirect(
        space,
        strategies,
        network,
        snapshot.utils.getProvider(network, { broviderUrl }),
        addresses,
        snapshotBlockNum
      ),
    state === 'final'
  );

  return {
    state,
    ...results
  };
}

export default function scores(parent, args) {
  const id = JSON.stringify(args);
  const cacheKey = sha256(id);
  return serve(id, calculateScores, [parent, args, cacheKey]);
}
