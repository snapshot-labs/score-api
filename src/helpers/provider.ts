import snapshot from '@snapshot-labs/snapshot.js';

const broviderUrl = process.env.BROVIDER_URL || 'https://rpc.snapshot.org';

export function getProvider(network: string | number) {
  return snapshot.utils.getProvider(network, {
    broviderUrl,
    clientName: 'score-api'
  });
}
