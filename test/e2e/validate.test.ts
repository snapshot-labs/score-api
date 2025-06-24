import request from 'supertest';
import disabled from '../../src/disabled.json';

describe('POST / - validate method', () => {
  describe('when the author is invalid', () => {
    it.each([
      ['empty address', '0x0000000000000000000000000000000000000000'],
      ['empty string', ''],
      ['null', null],
      ['invalid address', 'test']
    ])(
      'returns a 400 error with invalid address message on %s',
      async (_, author) => {
        const response = await request(process.env.HOST)
          .post('/')
          .send({ method: 'validate', params: { author } });

        expect(response.status).toEqual(400);
        expect(response.body.error.data).toBe('invalid address');
      }
    );

    it('returns a 400 error with invalid address message when author key is not set', async () => {
      const response = await request(process.env.HOST)
        .post('/')
        .send({
          method: 'validate',
          params: {
            space: 'test.eth',
            network: '1',
            snapshot: 'latest',
            params: {}
          }
        });

      expect(response.status).toEqual(400);
      expect(response.body.error.data).toBe('invalid address');
    });
  });

  describe('when validation parameter is not provided', () => {
    it('returns success with result true', async () => {
      const response = await request(process.env.HOST)
        .post('/')
        .send({
          method: 'validate',
          params: {
            author: '0x1234567890123456789012345678901234567890',
            space: 'test.eth',
            network: '1',
            snapshot: 'latest',
            params: {}
          }
        });

      expect(response.status).toEqual(200);
      expect(response.body.result).toBe(true);
    });
  });

  describe('when validation is "any"', () => {
    it('returns success with result true', async () => {
      const response = await request(process.env.HOST)
        .post('/')
        .send({
          method: 'validate',
          params: {
            validation: 'any',
            author: '0x1234567890123456789012345678901234567890',
            space: 'test.eth',
            network: '1',
            snapshot: 'latest',
            params: {}
          }
        });

      expect(response.status).toEqual(200);
      expect(response.body.result).toBe(true);
    });
  });

  describe('when validation method does not exist', () => {
    it('returns a 500 error with validation not found message', async () => {
      const response = await request(process.env.HOST)
        .post('/')
        .send({
          method: 'validate',
          params: {
            validation: 'nonExistentValidation',
            author: '0x1234567890123456789012345678901234567890',
            space: 'test.eth',
            network: '1',
            snapshot: 'latest',
            params: {}
          }
        });

      expect(response.status).toEqual(500);
      expect(response.body.error.data).toBe('Validation not found');
    });
  });

  describe('when using a real validation method', () => {
    it('processes validation request and return true when passing the validation', async () => {
      const response = await request(process.env.HOST)
        .post('/')
        .send({
          method: 'validate',
          params: {
            validation: 'basic',
            author: '0x1234567890123456789012345678901234567890',
            space: 'test.eth',
            network: '1',
            snapshot: 'latest',
            params: {
              strategies: [
                {
                  name: 'whitelist',
                  params: {
                    addresses: [
                      '0x02a0a8F3B6097e7A6bd7649DEB30715323072A159c0E6B71B689Bd245c146cC0',
                      '0x91FD2c8d24767db4Ece7069AA27832ffaf8590f3'
                    ]
                  }
                }
              ]
            }
          }
        });

      expect(response.status).toEqual(200);
      expect(response.body.result).toBe(true);
    });

    it('processes validation request and returns false when failing the validation', async () => {
      const response = await request(process.env.HOST)
        .post('/')
        .send({
          method: 'validate',
          params: {
            validation: 'basic',
            author: '0x9999999999999999999999999999999999999999',
            space: 'test.eth',
            network: '1',
            snapshot: 'latest',
            params: {
              strategies: [
                {
                  name: 'whitelist',
                  params: {
                    addresses: [
                      '0x02a0a8F3B6097e7A6bd7649DEB30715323072A159c0E6B71B689Bd245c146cC0',
                      '0x91FD2c8d24767db4Ece7069AA27832ffaf8590f3'
                    ]
                  }
                }
              ]
            }
          }
        });

      expect(response.status).toEqual(200);
      expect(response.body.result).toBe(false);
    });
  });

  describe('when request includes id parameter', () => {
    it('returns the same id in response', async () => {
      const testId = 'test-request-id-123';
      const response = await request(process.env.HOST)
        .post('/')
        .send({
          id: testId,
          method: 'validate',
          params: {
            author: '0x1234567890123456789012345678901234567890',
            space: 'test.eth',
            network: '1',
            snapshot: 'latest',
            params: {}
          }
        });

      expect(response.status).toEqual(200);
      expect(response.body.id).toBe(testId);
    });
  });

  describe('when space is disabled', () => {
    const testFn = disabled.length === 0 ? it.skip : it;

    testFn('returns a 429 error for disabled space', async () => {
      const disabledSpace = disabled[0]; // Use first disabled space from the list
      const response = await request(process.env.HOST)
        .post('/')
        .send({
          method: 'validate',
          params: {
            author: '0x1234567890123456789012345678901234567890',
            space: disabledSpace,
            network: '1',
            snapshot: 'latest',
            params: {}
          }
        });

      expect(response.status).toEqual(429);
      expect(response.body.error.data).toBe('too many requests');
    });
  });

  describe('when strategies parameter is provided', () => {
    it('validates strategies length when empty', async () => {
      const response = await request(process.env.HOST)
        .post('/')
        .send({
          method: 'validate',
          params: {
            author: '0x1234567890123456789012345678901234567890',
            space: 'test.eth',
            network: '1',
            snapshot: 'latest',
            strategies: [],
            params: {}
          }
        });

      expect(response.status).toEqual(400);
      expect(response.body.error.data).toBe('invalid strategies length');
    });

    it('validates strategies length when too many', async () => {
      const tooManyStrategies = Array(11)
        .fill(0)
        .map((_, i) => ({
          name: `strategy-${i}`,
          params: {}
        }));

      const response = await request(process.env.HOST)
        .post('/')
        .send({
          method: 'validate',
          params: {
            author: '0x1234567890123456789012345678901234567890',
            space: 'test.eth',
            network: '1',
            snapshot: 'latest',
            strategies: tooManyStrategies,
            params: {}
          }
        });

      expect(response.status).toEqual(400);
      expect(response.body.error.data).toBe('invalid strategies length');
    });

    it('accepts valid strategies', async () => {
      const response = await request(process.env.HOST)
        .post('/')
        .send({
          method: 'validate',
          params: {
            author: '0x1234567890123456789012345678901234567890',
            space: 'test.eth',
            network: '1',
            snapshot: 'latest',
            strategies: [{ name: 'erc20-balance-of', params: {} }],
            params: {}
          }
        });

      expect(response.status).toEqual(200);
    });
  });

  describe('response format', () => {
    it('returns proper JSON-RPC format for success', async () => {
      const response = await request(process.env.HOST)
        .post('/')
        .send({
          method: 'validate',
          params: {
            author: '0x1234567890123456789012345678901234567890',
            space: 'test.eth',
            network: '1',
            snapshot: 'latest',
            params: {}
          }
        });

      expect(response.status).toEqual(200);
      expect(response.body).toHaveProperty('result');
      expect(typeof response.body.result).toBe('boolean');
      expect(response.body.id).toBeNull();
    });

    it('returns proper JSON-RPC format for error', async () => {
      const response = await request(process.env.HOST)
        .post('/')
        .send({
          method: 'validate',
          params: {
            author: 'invalid-address',
            space: 'test.eth',
            network: '1',
            snapshot: 'latest',
            params: {}
          }
        });

      expect(response.status).toEqual(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error).toHaveProperty('data');
      expect(typeof response.body.error.code).toBe('number');
      expect(typeof response.body.error.data).toBe('string');
      expect(response.body.id).toBeNull();
      expect(response.body).not.toHaveProperty('result');
    });
  });
});
