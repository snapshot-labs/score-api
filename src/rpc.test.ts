import request from 'supertest';

import express from 'express';
import router from './rpc';
import serve from './requestDeduplicator';
import getStrategies from './helpers/strategies';
import getValidations from './helpers/validations';
import scores from './scores';
import { validate, getVp } from './methods';
import * as utils from './utils';

jest.mock('./methods', () => ({
  getVp: jest.fn().mockResolvedValue({ result: {}, cache: false }),
  validate: jest.fn().mockResolvedValue(true),
  disabledNetworks: ['1319']
}));
jest.mock('./scores', () => jest.fn().mockResolvedValue({ result: {}, cache: false }));
jest.mock('./helpers/strategies', () => jest.fn());
jest.mock('./helpers/validations', () => jest.fn());
jest.mock('./requestDeduplicator', () =>
  jest.fn().mockImplementation((id, fn, args) => fn(...args))
);
jest.mock('@ethersproject/address', () => ({
  getAddress: jest.fn()
}));
jest.mock('./utils', () => ({
  blockNumByNetwork: { 1: 123 },
  formatStrategies: jest.fn(),
  rpcSuccess: jest.fn(res => {
    res.send();
  }),
  rpcError: jest.fn((res, code) => {
    res.send(code);
  })
}));
console.log = jest.fn();
console.error = jest.fn();

const app = express();
app.use(express.json());
app.use('/', router);

describe('API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  describe('POST /', () => {
    it('should return error for missing method', async () => {
      const mockedRes = expect.anything();
      const response = await request(app).post('/').send({});

      expect(utils.rpcError).toBeCalledWith(mockedRes, 400, 'missing method', null);
      expect(response.status).toBe(400);
    });

    it('should return error for invalid address', async () => {
      const mockedRes = expect.anything();
      const response = await request(app)
        .post('/')
        .send({
          method: 'get_vp',
          params: { address: '0x0000000000000000000000000000000000000000' }
        });
      expect(utils.rpcError).toBeCalledWith(mockedRes, 400, 'invalid address', null);
      expect(response.status).toBe(400);
    });

    it('should handle get_vp method successfully', async () => {
      (serve as jest.Mock).mockResolvedValueOnce({ result: {}, cache: false });
      const response = await request(app)
        .post('/')
        .send({
          method: 'get_vp',
          params: { address: '0x123' }
        });
      expect(serve).toBeCalledWith(JSON.stringify({ address: '0x123' }), getVp, [
        { address: '0x123' }
      ]);
      expect(response.status).toBe(200);
    });

    it('should handle get_vp method with an error', async () => {
      const mockedRes = expect.anything();
      const err = new Error('Test error');
      (serve as jest.Mock).mockRejectedValueOnce(err);
      const response = await request(app)
        .post('/')
        .send({
          method: 'get_vp',
          params: { address: '0x123' }
        });
      expect(utils.rpcError).toBeCalledWith(mockedRes, 500, err, null);
      expect(response.status).toBe(500);
    });

    it('should handle validate method successfully', async () => {
      (serve as jest.Mock).mockResolvedValueOnce(true);
      const response = await request(app)
        .post('/')
        .send({
          method: 'validate',
          params: { author: '0x123' }
        });
      expect(serve).toBeCalledWith(JSON.stringify({ author: '0x123' }), validate, [
        { author: '0x123' }
      ]);
      expect(response.status).toBe(200);
    });

    it('should handle validate method with an error', async () => {
      const mockedRes = expect.anything();
      const err = new Error('Test error');
      (serve as jest.Mock).mockRejectedValueOnce(err);
      const response = await request(app)
        .post('/')
        .send({
          method: 'validate',
          params: { author: '0x123' }
        });
      expect(utils.rpcError).toBeCalledWith(mockedRes, 500, err, null);
      expect(response.status).toBe(500);
    });

    it('should return error for wrong method', async () => {
      const mockedRes = expect.anything();
      const response = await request(app)
        .post('/')
        .send({
          method: 'wrong_method',
          params: { address: '0x123' }
        });
      expect(utils.rpcError).toBeCalledWith(mockedRes, 400, 'wrong method', null);
      expect(response.status).toBe(400);
    });
  });

  describe('GET /', () => {
    it('should return block_num and version', async () => {
      const response = await request(app).get('/');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('block_num');
      expect(response.body).toHaveProperty('version');
      expect(response.body.block_num).toEqual(utils.blockNumByNetwork);
    });
  });

  describe('GET /api/strategies', () => {
    it('should return a list of strategies', async () => {
      const mockStrategies = {
        gno: {
          author: 'nginnever',
          version: '0.1.1',
          examples: null,
          schema: null,
          about: ''
        }
      };
      const expectedStrategies = {
        gno: { key: 'gno', ...mockStrategies.gno }
      };
      (getStrategies as jest.Mock).mockReturnValue(expectedStrategies);

      const response = await request(app).get('/api/strategies');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expectedStrategies);
    });
  });

  describe('GET /api/validations', () => {
    it('should return a list of validations excluding hidden ones', async () => {
      const mockedValidations = {
        basic: {
          examples: [],
          schema: {
            $schema: 'http://json-schema.org/draft-07/schema#',
            $ref: '#/definitions/Validation',
            definitions: {}
          },
          about: '',
          id: 'basic',
          github: 'bonustrack',
          version: '0.2.0',
          title: 'Basic',
          description: 'Use any strategy to determine if a user can vote.'
        },
        'passport-weighted': {
          // Hidden validation
          examples: [],
          schema: {
            $schema: 'http://json-schema.org/draft-07/schema#',
            $ref: '#/definitions/Validation',
            definitions: {}
          },
          about: '',
          id: 'passport-weighted',
          github: 'bonustrack',
          version: '0.2.0',
          title: 'Passport Weighted',
          description: 'Use any strategy to determine if a user can vote.'
        }
      };
      const expectedValidations = {
        basic: { key: 'basic', ...mockedValidations.basic }
      };
      (getValidations as jest.Mock).mockReturnValue(expectedValidations);

      const response = await request(app).get('/api/validations');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expectedValidations);
    });
  });

  describe('POST /api/scores', () => {
    it('should return error for disabled networks', async () => {
      const mockedRes = expect.anything();
      (utils.formatStrategies as jest.Mock).mockReturnValueOnce([{ name: 'test-strategy' }]);
      const response = await request(app)
        .post('/api/scores')
        .send({
          params: { network: '1319', strategies: [{ name: 'basic-strategy' }], space: '' }
        });

      expect(utils.rpcError).toBeCalledWith(
        mockedRes,
        500,
        'something wrong with the strategies',
        null
      );
      expect(response.status).toBe(500);
    });

    it('should return error for spaces with name that includes `pod-leader`', async () => {
      const mockedRes = expect.anything();
      (utils.formatStrategies as jest.Mock).mockReturnValueOnce([{ name: 'pod-leader' }]);
      const response = await request(app)
        .post('/api/scores')
        .send({
          params: { strategies: [{ name: 'pod-leader' }] }
        });

      expect(utils.rpcError).toBeCalledWith(
        mockedRes,
        500,
        'something wrong with the strategies',
        null
      );
      expect(response.status).toBe(500);
    });

    it('should return error if strategies are not defined', async () => {
      const mockedRes = expect.anything();
      (utils.formatStrategies as jest.Mock).mockReturnValueOnce([]);
      const response = await request(app).post('/api/scores').send({
        params: {}
      });

      expect(utils.rpcError).toBeCalledWith(
        mockedRes,
        500,
        'something wrong with the strategies',
        null
      );
      expect(response.status).toBe(500);
    });

    it('should return error if strategies are empty', async () => {
      const mockedRes = expect.anything();
      (utils.formatStrategies as jest.Mock).mockReturnValueOnce([]);
      const response = await request(app)
        .post('/api/scores')
        .send({
          params: { strategies: [] }
        });

      expect(utils.rpcError).toBeCalledWith(
        mockedRes,
        500,
        'something wrong with the strategies',
        null
      );
      expect(response.status).toBe(500);
    });

    it('should handle successful scenario', async () => {
      const mockedRes = expect.anything();
      const isCached = true;
      (scores as jest.Mock).mockReturnValueOnce({
        cache: isCached,
        data: 'test data'
      });
      (utils.formatStrategies as jest.Mock).mockReturnValueOnce([{ name: 'test-strategy' }]);

      const response = await request(app)
        .post('/api/scores')
        .send({
          params: { network: '1', strategies: [{ name: 'test-strategy' }] }
        });

      expect(utils.rpcSuccess).toBeCalledWith(mockedRes, { data: 'test data' }, null, isCached);
      expect(response.status).toBe(200);
    });

    it('should return error if score calculation fails', async () => {
      const mockedRes = expect.anything();
      (scores as jest.Mock).mockRejectedValueOnce(new Error('Test error'));
      (utils.formatStrategies as jest.Mock).mockReturnValueOnce([{ name: 'test-strategy' }]);

      const response = await request(app)
        .post('/api/scores')
        .send({
          params: { network: '1', strategies: [{ name: 'test-strategy' }] }
        });

      expect(utils.rpcError).toBeCalledWith(mockedRes, 500, new Error('Test error'), null);
      expect(response.status).toBe(500);
    });
  });
});
