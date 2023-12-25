const originalBroviderUrl = process.env.BROVIDER_URL;
process.env.BROVIDER_URL = 'test.brovider.url';

import {
  getCurrentBlockNum,
  blockNumByNetwork,
  getIp,
  rpcError,
  clone,
  sha256,
  formatStrategies,
  rpcSuccess
} from './utils';
import snapshot from '@snapshot-labs/strategies';
import { createHash } from 'crypto';
import { MAX_STRATEGIES } from './constants';

jest.mock('@snapshot-labs/strategies');
jest.mock('crypto', () => ({
  createHash: jest.fn(() => ({
    update: jest.fn(() => ({
      digest: jest.fn(() => 'mockHash')
    }))
  }))
}));
jest.mock('./utils', () => {
  const originalModule = jest.requireActual('./utils');
  return {
    ...originalModule,
    getCurrentBlockNum: jest.fn(originalModule.getCurrentBlockNum)
  };
});

describe('getCurrentBlockNum function', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(blockNumByNetwork).forEach(
      key => delete blockNumByNetwork[key]
    );
  });

  afterAll(() => {
    process.env.BROVIDER_URL = originalBroviderUrl;
  });

  it('should return block number from blockNumByNetwork if it exists and is less than or equal to snapshotBlock', async () => {
    const firstRequestBlockNum = 100;
    const secondRequestBlockNum = 99;
    const mockProvider = {
      getBlockNumber: jest.fn().mockResolvedValue(firstRequestBlockNum)
    };
    (snapshot.utils.getProvider as jest.Mock).mockReturnValue(mockProvider);
    await getCurrentBlockNum(firstRequestBlockNum, '1');

    const result = await getCurrentBlockNum(secondRequestBlockNum, '1');
    expect(result).toBe(firstRequestBlockNum);
  });

  it('should return block number from blockNumByNetwork if it exists and is greater than snapshotBlock and timestamp is within delay', async () => {
    const firstRequestBlockNum = 100;
    const secondRequestBlockNum = 101;

    const mockProvider = {
      getBlockNumber: jest.fn().mockResolvedValue(firstRequestBlockNum)
    };
    (snapshot.utils.getProvider as jest.Mock).mockReturnValue(mockProvider);
    await getCurrentBlockNum(firstRequestBlockNum, '1');

    const result = await getCurrentBlockNum(secondRequestBlockNum, '1');
    expect(result).toBe(firstRequestBlockNum);
  });

  it('should fetch block number from provider if not in blockNumByNetwork or timestamp is beyond delay', async () => {
    const mockBlockNumber = 120;
    const mockProvider = {
      getBlockNumber: jest.fn().mockResolvedValue(mockBlockNumber)
    };
    (snapshot.utils.getProvider as jest.Mock).mockReturnValue(mockProvider);

    const result = await getCurrentBlockNum(110, '1');

    expect(snapshot.utils.getProvider).toHaveBeenCalledWith('1', {
      broviderUrl: process.env.BROVIDER_URL
    });
    expect(mockProvider.getBlockNumber).toHaveBeenCalled();
    expect(result).toBe(120);
  });

  it('should return passed block if fetched block number is less than snapshotBlock', async () => {
    const mockBlockNumber = 90;
    const mockProvider = {
      getBlockNumber: jest.fn().mockResolvedValue(mockBlockNumber)
    };
    (snapshot.utils.getProvider as jest.Mock).mockReturnValue(mockProvider);

    const result = await getCurrentBlockNum(110, '1');

    expect(result).toBe(90);
  });
});

describe('getIp function', () => {
  it('should return IP from cf-connecting-ip header', () => {
    const req = {
      headers: {
        'cf-connecting-ip': '192.168.1.1'
      },
      connection: {
        remoteAddress: '192.168.1.2'
      }
    };

    const ip = getIp(req);
    expect(ip).toBe('192.168.1.1');
  });

  it('should return IP from x-real-ip header', () => {
    const req = {
      headers: {
        'x-real-ip': '192.168.1.3'
      },
      connection: {
        remoteAddress: '192.168.1.4'
      }
    };

    const ip = getIp(req);
    expect(ip).toBe('192.168.1.3');
  });

  it('should return IP from x-forwarded-for header', () => {
    const req = {
      headers: {
        'x-forwarded-for': '192.168.1.5, 192.168.1.6'
      },
      connection: {
        remoteAddress: '192.168.1.7'
      }
    };

    const ip = getIp(req);
    expect(ip).toBe('192.168.1.5');
  });

  it('should return IP from connection remote address', () => {
    const req = {
      headers: {},
      connection: {
        remoteAddress: '192.168.1.8'
      }
    };

    const ip = getIp(req);
    expect(ip).toBe('192.168.1.8');
  });

  it('should return empty string if no IP found', () => {
    const req = {
      headers: {},
      connection: {}
    };

    const ip = getIp(req);
    expect(ip).toBe('');
  });
});

describe('rpcError function', () => {
  let mockRes;

  beforeEach(() => {
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
  });

  it('should send a JSON-RPC error response', () => {
    const mockCode = 401;
    const mockError = new Error('Some error');
    const mockId = '12345';

    rpcError(mockRes, mockCode, mockError, mockId);

    expect(mockRes.status).toHaveBeenCalledWith(mockCode);
    expect(mockRes.json).toHaveBeenCalledWith({
      jsonrpc: '2.0',
      error: {
        code: mockCode,
        message: 'unauthorized',
        data: mockError
      },
      id: mockId
    });
  });

  it('should handle different error codes', () => {
    const mockCode = 403;
    const mockError = new Error('Another error');
    const mockId = '67890';

    rpcError(mockRes, mockCode, mockError, mockId);

    expect(mockRes.status).toHaveBeenCalledWith(mockCode);
    expect(mockRes.json).toHaveBeenCalledWith({
      jsonrpc: '2.0',
      error: {
        code: mockCode,
        message: 'unauthorized',
        data: mockError
      },
      id: mockId
    });
  });
});

describe('clone function', () => {
  it('should return a deep clone of the item', () => {
    const obj = { a: 1, b: { c: 2 } };
    const clonedObj = clone(obj);

    expect(clonedObj).toEqual(obj);
    expect(clonedObj).not.toBe(obj);
    expect(clonedObj.b).not.toBe(obj.b);
  });
});

describe('sha256 function', () => {
  it('should return a sha256 hash of the string', () => {
    const str = 'test';
    const hash = sha256(str);

    const expectedHash = createHash('sha256').update(str).digest('hex');
    expect(hash).toBe(expectedHash);
  });
});

describe('formatStrategies function', () => {
  it('accepts only array', () => {
    const strategies: any = {};
    const network = 'defaultNetwork';

    const formattedStrategies: any[] = formatStrategies(network, strategies);

    expect(formattedStrategies).toEqual([]);
  });

  it('should format strategies correctly', () => {
    const strategies = [
      { name: 'strategy1', param: 'a' },
      { name: 'strategy2', param: 'b', network: 'customNetwork' }
    ];
    const network = 'defaultNetwork';

    const formattedStrategies: any[] = formatStrategies(network, strategies);

    expect(formattedStrategies[0].network).toBe(network);
    expect(formattedStrategies[1].network).toBe('customNetwork');
    expect(formattedStrategies).toHaveLength(2);
  });

  it(`should limit strategies to ${MAX_STRATEGIES}`, () => {
    const strategies = new Array(12).fill({ name: 'strategy', param: 'a' });
    const network = 'defaultNetwork';

    const formattedStrategies = formatStrategies(network, strategies);

    expect(formattedStrategies).toHaveLength(MAX_STRATEGIES);
  });
});

describe('rpcSuccess function', () => {
  let mockRes;

  beforeEach(() => {
    mockRes = {
      json: jest.fn()
    };
  });

  it('should send a JSON-RPC success response', () => {
    const result = { data: 'testData' };
    const id = '12345';
    const cache = true;

    rpcSuccess(mockRes, result, id, cache);

    expect(mockRes.json).toHaveBeenCalledWith({
      jsonrpc: '2.0',
      result,
      id,
      cache
    });
  });
});
