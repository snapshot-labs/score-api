import snapshot from '@snapshot-labs/strategies';
import { createHash } from 'crypto';
import pagination from './pagination.json';

export function clone(item) {
  return JSON.parse(JSON.stringify(item));
}

export function sha256(str) {
  return createHash('sha256')
    .update(str)
    .digest('hex');
}

export function paginateStrategies(space, network, strategies) {
  return strategies.map(strategy => {
    const key = sha256(JSON.stringify({ space, network, strategy }));
    if (pagination[key]) {
      console.log('Custom pagination', space, key, pagination[key]);
      return {
        name: 'pagination',
        params: {
          limit: pagination[key],
          symbol: strategy.params.symbol || '',
          strategy
        }
      };
    }
    return strategy;
  });
}

const networks = {
  '1': 7929876,
  '137': 9834491,
  '100': 4108192
};

export async function tsToBlockNum(network, ts) {
  const provider = snapshot.utils.getProvider(network);
  let [from, to] = await Promise.all([
    provider.getBlock(networks[network] || 1),
    provider.getBlock('latest')
  ]);
  if (ts > to.timestamp) return 'latest';
  if (ts < from.timestamp) return 0;

  let steps = 0;
  let range = to.number - from.number;
  while (![1, 0].includes(range)) {
    steps++;
    console.log('From', from.number, 'to', to.number);
    console.log('Range', range);
    console.log('Diff', from.timestamp - ts, to.timestamp - ts);

    const blockNums: number[] = [];
    const blockTime = (to.timestamp - from.timestamp) / (to.number - from.number);
    const trialBlockNum = to.number - Math.ceil((to.timestamp - ts) / blockTime);
    console.log('Trial', trialBlockNum);

    blockNums.push(trialBlockNum);
    let leftSpace = Math.ceil((trialBlockNum - from.number) / 2);
    let rightSpace = Math.ceil((to.number - trialBlockNum) / 2);
    Array.from(Array(12)).forEach(() => {
      blockNums.push(trialBlockNum - leftSpace);
      blockNums.push(trialBlockNum + rightSpace);
      leftSpace = Math.ceil(leftSpace / 2);
      rightSpace = Math.ceil(rightSpace / 2);
    });

    let blocks: any[] = await Promise.all(
      [...new Set(blockNums)]
        .filter(blockNum => blockNum > from.number && blockNum < to.number)
        .map(blockNum => provider.getBlock(blockNum))
    );
    blocks = [from, ...blocks, to].sort((a, b) => a.number - b.number);
    console.log(blocks.map((block: any) => block.number));

    let newFrom = false;
    let newTo = false;
    blocks.forEach(block => {
      if (block.timestamp >= ts && !newTo) newTo = block;
      if (block.timestamp <= ts) newFrom = block;
    });
    from = newFrom;
    to = newTo;
    range = to.number - from.number;
  }

  if (range === 0) console.log('Perfect');
  console.log('From', from.number, from.timestamp, 'to', to.number, to.timestamp);
  console.log('Target', ts, 'steps', steps);
  return to.number;
}
