import { getVp, validate } from './methods';
import snapshot from '@snapshot-labs/strategies';
import { getCurrentBlockNum, sha256 } from './utils';
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

  it('should set snapshot to "latest" if it is not a number', async () => {
    const expectedSnapshotNum = 'latest';
    const params = {
      address: '0x123',
      network: '1',
      strategies: [],
      snapshot: 'not-a-number',
      space: 'testSpace'
    };
    const votingPower = { vp_state: 'pending', vp: 100 };

    (snapshot.utils.getVp as jest.Mock).mockResolvedValue(votingPower);
    (getCurrentBlockNum as jest.Mock).mockResolvedValue(expectedSnapshotNum);

    // @ts-expect-error
    const result = await getVp(params);

    expect(getCurrentBlockNum).not.toHaveBeenCalled();
    expect(params.snapshot).toBe('latest');
    expect(result).toEqual({
      cache: false,
      result: votingPower
    });
  });

  it('should call getCurrentBlockNum if snapshot is not "latest"', async () => {
    const params = {
      address: '0x123',
      network: '1',
      strategies: [],
      snapshot: 1000,
      space: 'testSpace'
    };

    (getCurrentBlockNum as jest.Mock).mockResolvedValue(900);

    const result = await getVp(params);

    expect(getCurrentBlockNum).toHaveBeenCalledWith(1000, '1');
    expect(result).toEqual({
      cache: false,
      result: { vp_state: 'pending', vp: 100 }
    });
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
    (getCurrentBlockNum as jest.Mock).mockResolvedValue(params.snapshot);

    const result = await getVp(params);

    expect(snapshot.utils.getVp).toHaveBeenCalledWith(
      '0x123',
      '1',
      [],
      12345,
      'testSpace',
      undefined
    );
    expect(result).toEqual({
      cache: false,
      result: { vp_state: 'pending', vp: 100 }
    });
  });

  it('should use cache if conditions are met', async () => {
    const params = {
      address: '0x123',
      network: '1',
      strategies: [],
      snapshot: 100,
      space: 'testSpace'
    };
    const cachedData = { vp_state: 'pending', vp: 100, vp_by_strategy: '{}' };

    (getCurrentBlockNum as jest.Mock).mockResolvedValue(900);
    mockRedis.hGetAll.mockResolvedValue(cachedData);

    const result = await getVp(params);

    expect(mockRedis.hGetAll).toHaveBeenCalled();
    expect(result).toEqual({
      cache: true,
      result: cachedData
    });
  });

  it('should save to cache if snapshotBlock is not "latest" and cache is not defined', async () => {
    const params = {
      address: '0x123',
      network: '1',
      strategies: [],
      snapshot: 100,
      space: 'testSpace'
    };
    const votingPower = { vp_state: 'final', vp: 100, vp_by_strategy: '{}' };
    const cacheKey = 'mockKey';
    (getCurrentBlockNum as jest.Mock).mockResolvedValue(900);
    (snapshot.utils.getVp as jest.Mock).mockResolvedValue(votingPower);
    (sha256 as jest.Mock).mockReturnValue(cacheKey);
    mockRedis.hGetAll.mockResolvedValue(undefined);
    const mockMulti = {
      hSet: jest.fn(),
      exec: jest.fn()
    };
    (mockRedis.multi as jest.Mock).mockReturnValueOnce(mockMulti);

    const result = await getVp(params);

    expect(mockRedis.multi).toHaveBeenCalled();

    expect(mockMulti.hSet).toHaveBeenCalledWith(`vp:${cacheKey}`, 'vp', votingPower.vp);
    expect(mockMulti.hSet).toHaveBeenCalledWith(
      `vp:${cacheKey}`,
      'vp_by_strategy',
      JSON.stringify(votingPower.vp_by_strategy)
    );
    expect(mockMulti.hSet).toHaveBeenCalledWith(`vp:${cacheKey}`, 'vp_state', votingPower.vp_state);
    expect(mockMulti.exec).toHaveBeenCalled();

    expect(result).toEqual({
      cache: false,
      result: { vp_state: 'final', vp: 100, vp_by_strategy: '{}' }
    });
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
    (getCurrentBlockNum as jest.Mock).mockResolvedValue(params.snapshot);

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
    (getCurrentBlockNum as jest.Mock).mockResolvedValue(params.snapshot);

    await getVp(params);

    expect(snapshot.utils.getVp).toHaveBeenCalledWith('0x123', '1', [], 1000, 'testSpace', true);
  });
});

describe('validate', () => {
  const mockedArgs = {
    validation: 'any',
    author: '0x123',
    space: 'testSpace',
    network: '1',
    snapshot: 12345,
    params: {}
  };
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns true if params.validation is not defined', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { validation, ...restParams } = mockedArgs;

    // @ts-expect-error
    const result = await validate(restParams);

    expect(result).toBe(true);
  });

  it('returns true if params.validation is "any"', async () => {
    const result = await validate({ ...mockedArgs, validation: 'any' });

    expect(result).toBe(true);
  });

  it('throws an error if params.validation defined but not found in snapshot.validations', async () => {
    try {
      await validate({ ...mockedArgs, validation: 'notFoundValidation' });
      fail('Expected validate to throw an error');
    } catch (error: any) {
      expect(error).toBe('Validation not found');
    }
  });

  it('creates a new instance of the validation class if params.validation is defined and found in snapshot.validations and calls validate() on it', async () => {
    const mockValidate = jest.fn().mockReturnValue(true);
    const MockValidationClass = jest.fn().mockImplementation(() => {
      return { validate: mockValidate };
    });
    (snapshot.validations as any).isAddress = {
      validation: MockValidationClass
    };

    const result = await validate({ ...mockedArgs, validation: 'isAddress' });

    expect(await validate(result)).toBe(true);
  });
});
