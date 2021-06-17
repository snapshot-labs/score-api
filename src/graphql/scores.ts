import snapshot from '@snapshot-labs/snapshot.js';

const blockNumByNetwork = {};
const blockNumByNetworkTs = {};

async function getBlockNum(network) {
  const ts = parseInt((Date.now() / 1e3).toFixed());
  if (blockNumByNetwork[network] && blockNumByNetworkTs[network] > ts - 15) return blockNumByNetwork[network];

  const provider = snapshot.utils.getProvider(network);
  const blockNum = await provider.getBlockNumber();

  blockNumByNetwork[network] = blockNum;
  blockNumByNetworkTs[network] = ts;

  return blockNum;
}

export default async function async(parent, args) {
  const { space = '', strategies, network, addresses } = args;

  let snapshotBlockNum = 'latest';
  if (args.snapshot !== 'latest') {
    const currentBlockNum = await getBlockNum(network);
    snapshotBlockNum = currentBlockNum < args.snapshot ? 'latest' : args.snapshot;
  }

  const scores = await snapshot.utils.getScores(
    space,
    strategies,
    network,
    snapshot.utils.getProvider(network),
    addresses,
    snapshotBlockNum
  );

  return {
    scores,
    state: snapshotBlockNum === 'latest' ? 'pending' : 'final'
  };
}
