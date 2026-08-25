import snapshot from '@snapshot-labs/snapshot.js';
import { getProvider } from './provider';

jest.mock('@snapshot-labs/snapshot.js', () => ({
  __esModule: true,
  default: { utils: { getProvider: jest.fn() } }
}));

it('attributes RPC traffic to score-api', () => {
  getProvider('1');

  expect(snapshot.utils.getProvider).toHaveBeenCalledWith('1', {
    broviderUrl: process.env.BROVIDER_URL || 'https://rpc.snapshot.org',
    clientName: 'score-api'
  });
});
