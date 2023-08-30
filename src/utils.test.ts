const originalBroviderUrl = process.env.BROVIDER_URL;
process.env.BROVIDER_URL = 'test.brovider.url';

import { getBlockNum, blockNumByNetwork } from './utils';
import snapshot from '@snapshot-labs/strategies';

jest.mock('@snapshot-labs/strategies');
jest.mock('./utils', () => {
  const originalModule = jest.requireActual('./utils');
  return {
    ...originalModule,
    getBlockNum: jest.fn(originalModule.getBlockNum)
  };
});

describe('getBlockNum function', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(blockNumByNetwork).forEach((key) => delete blockNumByNetwork[key]);
  });

  afterAll(() => {
    process.env.BROVIDER_URL = originalBroviderUrl;
  });

  it('should return "latest" if snapshotBlock is "latest"', async () => {
    const result = await getBlockNum('latest', '1');
    expect(result).toBe('latest');
  });

  it('should return block number from blockNumByNetwork if it exists and is less than or equal to snapshotBlock', async () => {
    const firstRequestBlockNum = 100;
    const secondRequestBlockNum = 99;
    const mockProvider = {
      getBlockNumber: jest.fn().mockResolvedValue(firstRequestBlockNum)
    };
    (snapshot.utils.getProvider as jest.Mock).mockReturnValue(mockProvider);
    await getBlockNum(firstRequestBlockNum, '1');

    const result = await getBlockNum(secondRequestBlockNum, '1');
    expect(result).toBe(firstRequestBlockNum);
  });

  it('should return block number from blockNumByNetwork if it exists and is greater than snapshotBlock and timestamp is within delay', async () => {
    const firstRequestBlockNum = 100;
    const secondRequestBlockNum = 101;

    const mockProvider = {
      getBlockNumber: jest.fn().mockResolvedValue(firstRequestBlockNum)
    };
    (snapshot.utils.getProvider as jest.Mock).mockReturnValue(mockProvider);
    await getBlockNum(firstRequestBlockNum, '1');

    const result = await getBlockNum(secondRequestBlockNum, '1');
    expect(result).toBe(firstRequestBlockNum);
  });

  it('should fetch block number from provider if not in blockNumByNetwork or timestamp is beyond delay', async () => {
    const mockBlockNumber = '120';
    const mockProvider = {
      getBlockNumber: jest.fn().mockResolvedValue(mockBlockNumber)
    };
    (snapshot.utils.getProvider as jest.Mock).mockReturnValue(mockProvider);

    const result = await getBlockNum(110, '1');
    expect(result).toBe(110);
    expect(snapshot.utils.getProvider).toHaveBeenCalledWith('1', {
      broviderUrl: process.env.BROVIDER_URL
    });
    expect(mockProvider.getBlockNumber).toHaveBeenCalled();
  });

  it('should return "latest" if fetched block number is less than snapshotBlock', async () => {
    const mockBlockNumber = 90;
    const mockProvider = {
      getBlockNumber: jest.fn().mockResolvedValue(mockBlockNumber)
    };
    (snapshot.utils.getProvider as jest.Mock).mockReturnValue(mockProvider);

    const result = await getBlockNum(110, '1');
    expect(result).toBe('latest');
  });
});
