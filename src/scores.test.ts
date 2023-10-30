import scores from './scores';
import { cachedScores } from './helpers/cache';
import { getCurrentBlockNum, sha256 } from './utils';
import snapshot from '@snapshot-labs/strategies';

jest.mock('./utils');
jest.mock('./helpers/cache');
jest.mock('@snapshot-labs/strategies');

describe('scores function', () => {
  const mockArgs = {
    space: '',
    strategies: ['strategy1'],
    network: 'ethereum',
    addresses: ['0x123'],
    snapshot: '12345'
  };
  const key = 'mockKey';
  const mockScores = { data: 'scores' };

  beforeEach(() => {
    (sha256 as jest.Mock).mockReturnValue(key);
    jest.clearAllMocks();
  });

  it('should deduplicate requests', async () => {
    (cachedScores as jest.Mock).mockResolvedValue({ scores: mockScores, cache: false });
    const firstCall = scores(null, mockArgs);
    const secondCall = scores(null, mockArgs);

    const firstResult = await firstCall;
    const secondResult = await secondCall;

    expect(firstResult).toEqual(secondResult);
    expect(cachedScores).toHaveBeenCalledTimes(1);
  });

  it('should return cached results', async () => {
    (cachedScores as jest.Mock).mockResolvedValue({ scores: mockScores, cache: true });

    const result = await scores(null, mockArgs);

    expect(result).toEqual({
      cache: true,
      scores: mockScores,
      state: 'final'
    });
    expect(cachedScores).toHaveBeenCalledWith(key, expect.anything(), true);
  });

  it('should return uncached results when cache is not needed', async () => {
    (getCurrentBlockNum as jest.Mock).mockResolvedValue('latest');
    (cachedScores as jest.Mock).mockResolvedValue({ scores: mockScores, cache: false }); // Not in cache
    const result = await scores(null, { ...mockArgs, snapshot: 'latest' }); // "latest" should bypass cache

    expect(result).toEqual({
      cache: false,
      scores: mockScores,
      state: 'pending'
    });
    expect(cachedScores).toHaveBeenCalledWith(key, expect.anything(), false);
  });

  it('should restrict block number by `latest`', async () => {
    (snapshot.utils.getScoresDirect as jest.Mock).mockResolvedValue(mockScores);
    (getCurrentBlockNum as jest.Mock).mockResolvedValue('latest');

    const args = { ...mockArgs, snapshot: '99999999' }; // block in the future
    const result = await scores(null, args);

    expect(result).toEqual({
      cache: false,
      scores: mockScores,
      state: 'final'
    });
  });

  it('should set snapshotBlockNum to "latest" if currentBlockNum is less than args.snapshot', async () => {
    (getCurrentBlockNum as jest.Mock).mockResolvedValue(1);
    const result = await scores(null, mockArgs);

    expect(getCurrentBlockNum).toBeCalled();
    expect(result).toEqual({
      cache: false,
      scores: mockScores,
      state: 'pending'
    });
  });

  it('should set snapshotBlockNum to args.snapshot if currentBlockNum is greater than or equal to args.snapshot', async () => {
    (getCurrentBlockNum as jest.Mock).mockResolvedValue(99999999);
    const result = await scores(null, mockArgs);

    expect(getCurrentBlockNum).toBeCalled();
    expect(result).toEqual({
      cache: false,
      scores: mockScores,
      state: 'final'
    });
  });
});
