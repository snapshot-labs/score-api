import request from 'supertest';
import { MAX_STRATEGIES } from '../../src/constants';

describe('getVp', () => {
  describe('when the address is invalid', () => {
    it.each([
      ['empty address', '0x0000000000000000000000000000000000000000'],
      ['empty string', ''],
      ['null', null],
      ['invalid address', 'test']
    ])('returns a 400 error on %s', async (title, address) => {
      const response = await request(process.env.HOST)
        .post('/')
        .send({ method: 'get_vp', address });

      expect(response.status).toEqual(400);
    });
  });

  describe('when the strategies are invalid', () => {
    it.each([
      ['no strategies', null],
      ['empty strategies', []],
      [
        'too many strategies for default spaces',
        Array(MAX_STRATEGIES['default'] + 1).fill({ name: 'test', param: 'a' })
      ],
      [
        'too many strategies for turbo spaces',
        Array(MAX_STRATEGIES['turbo'] + 1).fill({ name: 'test', param: 'a' })
      ]
    ])('returns a 400 error on %s', async (title, strategies) => {
      const response = await request(process.env.HOST).post('/').send({
        method: 'get_vp',
        address: '0x662a9706c7122D620D410ba565CAfaB29e4CB47f',
        strategies
      });

      expect(response.status).toEqual(400);
    });
  });

  it.todo('returns the voting power');
});
