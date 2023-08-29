import scores from './scores';
import { get, set } from './aws';
import { getBlockNum, sha256 } from './utils';
import snapshot from '@snapshot-labs/strategies';

jest.mock('./utils');
jest.mock('./aws');
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
    (snapshot.utils.getScoresDirect as jest.Mock).mockResolvedValue(mockScores);
    const firstCall = scores(mockArgs);
    const secondCall = scores(mockArgs);

    const firstResult = await firstCall;
    const secondResult = await secondCall;

    expect(firstResult).toEqual(secondResult);
    expect(snapshot.utils.getScoresDirect).toHaveBeenCalledTimes(1);
  });

  it('should return cached results', async () => {
    process.env.AWS_REGION = 'us-west-1';
    (get as jest.Mock).mockResolvedValue(mockScores);

    const result = await scores(mockArgs);

    expect(result).toEqual({
      cache: true,
      scores: mockScores,
      state: 'final'
    });
    expect(get).toHaveBeenCalledWith(key);
  });

  it('should set cache if not cached before', async () => {
    process.env.AWS_REGION = 'us-west-1';
    (get as jest.Mock).mockResolvedValue(null); // Not in cache
    (snapshot.utils.getScoresDirect as jest.Mock).mockResolvedValue(mockScores);

    await scores(mockArgs);

    expect(set).toHaveBeenCalledWith(key, mockScores);
  });

  it('should return uncached results when cache is not needed', async () => {
    process.env.AWS_REGION = 'us-west-1';
    (get as jest.Mock).mockResolvedValue(null); // Not in cache
    (snapshot.utils.getScoresDirect as jest.Mock).mockResolvedValue(mockScores);
    const result = await scores({ ...mockArgs, snapshot: 'latest' }); // "latest" should bypass cache

    expect(result).toEqual({
      cache: false,
      scores: mockScores,
      state: 'pending'
    });
    expect(set).not.toHaveBeenCalled();
  });

  it("shouldn't return cached results when cache is not available", async () => {
    process.env.AWS_REGION = '';
    (snapshot.utils.getScoresDirect as jest.Mock).mockResolvedValue(mockScores);
    const result = await scores(mockArgs);

    expect(result).toEqual({
      cache: false,
      scores: mockScores,
      state: 'final'
    });
    expect(get).not.toHaveBeenCalled();
  });

  it('should restrict block number by `latest`', async () => {
    (snapshot.utils.getScoresDirect as jest.Mock).mockResolvedValue(mockScores);
    (getBlockNum as jest.Mock).mockResolvedValue('100');

    const result = await scores({ ...mockArgs, snapshot: '99999999' });

    expect(result).toEqual({
      cache: false,
      scores: mockScores,
      state: 'pending'
    });
  });
});
