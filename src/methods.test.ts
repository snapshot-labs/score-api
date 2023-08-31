import { getVp } from './methods';
import snapshot from '@snapshot-labs/strategies';
import { getBlockNum } from './utils';
import * as redisModule from './redis';

jest.mock('@snapshot-labs/strategies');
jest.mock('./utils');
jest.mock('./redis', () => ({
  __esModule: true,
  default: {
    hGetAll: jest.fn(),
    multi: jest.fn(() => ({
      hSet: jest.fn(),
      exec: jest.fn()
    })),
    connect: jest.fn(),
    on: jest.fn()
  }
}));

const mockRedis = redisModule.default;

describe('getVp function', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  xit('should set snapshot to "latest" if it is not a number', async () => {
    const expectedSnapshotNum = 'latest';
    const params = {
      address: '0x123',
      network: '1',
      strategies: [],
      snapshot: 'not-a-number',
      space: 'testSpace'
    };

    (snapshot.utils.getVp as jest.Mock).mockResolvedValue({ vp_state: 'pending', vp: 100 });
    (getBlockNum as jest.Mock).mockResolvedValue(expectedSnapshotNum);

    // @ts-expect-error
    await getVp(params);

    expect(getBlockNum).toHaveBeenCalledWith(expectedSnapshotNum, params.network);
    expect(params.snapshot).toBe('latest');
  });

  it('should call getBlockNum if snapshot is not "latest"', async () => {
    const params = {
      address: '0x123',
      network: '1',
      strategies: [],
      snapshot: 1000,
      space: 'testSpace'
    };

    (getBlockNum as jest.Mock).mockResolvedValue(900);

    await getVp(params);

    expect(getBlockNum).toHaveBeenCalledWith(1000, '1');
  });

  it('should throw an error for disabled networks or spaces', async () => {
    const params = {
      address: '0x123',
      network: '1319',
      strategies: [],
      snapshot: 12345,
      space: 'testSpace'
    };

    try {
      await getVp(params);
      fail('Expected getVp to throw an error'); // This will fail the test if no error is thrown
    } catch (error) {
      expect(error).toMatch('something wrong with the strategies');
    }
  });

  it('should call snapshot.utils.getVp with correct parameters', async () => {
    const params = {
      address: '0x123',
      network: '1',
      strategies: [],
      snapshot: 12345,
      space: 'testSpace'
    };

    (snapshot.utils.getVp as jest.Mock).mockResolvedValue({ vp_state: 'pending', vp: 100 });
    (getBlockNum as jest.Mock).mockResolvedValue(params.snapshot);

    await getVp(params);

    expect(snapshot.utils.getVp).toHaveBeenCalledWith(
      '0x123',
      '1',
      [],
      12345,
      'testSpace',
      undefined
    );
  });

  xit('should use cache if conditions are met', async () => {
    const params = {
      address: '0x123',
      network: '1',
      strategies: [],
      snapshot: 1000,
      space: 'testSpace'
    };

    (getBlockNum as jest.Mock).mockResolvedValue(900);
    mockRedis.hGetAll.mockResolvedValue({ vp_state: 'pending', vp: 100, vp_by_strategy: '{}' });

    const result = await getVp(params);

    expect(mockRedis.hGetAll).toHaveBeenCalled();
    expect(result.cache).toBe(true);
    expect(result.result.vp).toBe(100);
  });

  it('should return correct result values', async () => {
    const params = {
      address: '0x123',
      network: '1',
      strategies: [],
      snapshot: 1000,
      space: 'testSpace'
    };

    mockRedis.hGetAll.mockResolvedValue();
    (snapshot.utils.getVp as jest.Mock).mockResolvedValue({
      vp_state: 'pending',
      vp: 100,
      vp_by_strategy: '{}'
    });
    (getBlockNum as jest.Mock).mockResolvedValue(params.snapshot);

    const result = await getVp(params);

    expect(result.cache).toBe(false);
    expect(result.result.vp).toBe(100);
    expect(result.result.vp_state).toBe('pending');
  });

  it('should handle the delegation parameter correctly', async () => {
    const params = {
      address: '0x123',
      network: '1',
      strategies: [],
      snapshot: 1000,
      space: 'testSpace',
      delegation: true
    };

    (snapshot.utils.getVp as jest.Mock).mockResolvedValue({ vp_state: 'pending', vp: 100 });
    (getBlockNum as jest.Mock).mockResolvedValue(params.snapshot);

    await getVp(params);

    expect(snapshot.utils.getVp).toHaveBeenCalledWith('0x123', '1', [], 1000, 'testSpace', true);
  });
});
