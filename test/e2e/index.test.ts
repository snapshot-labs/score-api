import request from 'supertest';

const EMPTY_ADDRESS = '0x0000000000000000000000000000000000000000';

describe('/', () => {
  describe('when method params is missing', () => {
    it('returns a 500 error', async () => {
      const response = await request(process.env.HOST).post('/').send({});

      expect(response.status).toEqual(500);
    });
  });

  describe('when method params is invalid', () => {
    it('returns a 500 error', async () => {
      const response = await request(process.env.HOST).post('/').send({ method: 'test' });

      expect(response.status).toEqual(500);
    });
  });

  describe('when the address params is blank', () => {
    it('returns a 500 error', async () => {
      const response = await request(process.env.HOST)
        .post('/')
        .send({ method: 'get_vp', address: EMPTY_ADDRESS });

      expect(response.status).toEqual(500);
    });
  });

  describe('when the author params is blank', () => {
    it('returns a 500 error', async () => {
      const response = await request(process.env.HOST)
        .post('/')
        .send({ method: 'get_vp', author: EMPTY_ADDRESS });

      expect(response.status).toEqual(500);
    });
  });
});
