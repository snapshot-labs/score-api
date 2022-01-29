import snapshot from '@snapshot-labs/strategies';
import { get, set } from './aws';
import { paginateStrategies, sha256 } from './utils';

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

export default async function scores(parent, args) {
  const { space = '', strategies, network, addresses } = args;

  const key = sha256(JSON.stringify(args));
  // console.log('Key', key, JSON.stringify({ space, strategies, network }), addresses.length);

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
