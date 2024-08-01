import { requestDeduplicatorSize } from './metrics';
import serve from './requestDeduplicator';

jest.mock('./utils', () => ({
  sha256: jest.fn(id => `hashed_${id}`)
}));
jest.mock('./metrics', () => ({
  requestDeduplicatorSize: {
    set: jest.fn()
  }
}));

describe('serve function', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initiate a new request if not ongoing', async () => {
    const mockAction = jest.fn().mockResolvedValue('response');
    const id = '12345';

    const response = await serve(id, mockAction, []);

    expect(response).toBe('response');
    expect(mockAction).toHaveBeenCalledTimes(1);
    expect(requestDeduplicatorSize.set).toHaveBeenCalledWith(1);
  });

  it('should not initiate a new request if one is ongoing with the same id', async () => {
    const mockAction = jest.fn(
      () => new Promise(resolve => setTimeout(() => resolve('response'), 100))
    );
    const id = '12345';

    const promise1 = serve(id, mockAction, []);
    const promise2 = serve(id, mockAction, []);

    const [response1, response2] = await Promise.all([promise1, promise2]);

    expect(response1).toBe('response');
    expect(response2).toBe('response');
    expect(mockAction).toHaveBeenCalledTimes(1);
    expect(requestDeduplicatorSize.set).toHaveBeenCalledWith(1);
  });

  it('should handle errors correctly', async () => {
    const mockAction = jest.fn().mockRejectedValue(new Error('test error'));
    const id = '12345';

    try {
      await serve(id, mockAction, []);
      fail('Expected serve to throw an error');
    } catch (error: any) {
      expect(error.message).toBe('test error');
    }

    expect(mockAction).toHaveBeenCalledTimes(1);
    expect(requestDeduplicatorSize.set).toHaveBeenCalledWith(1);
  });
});
