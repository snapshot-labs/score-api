import request from 'supertest';

describe('/', () => {
  describe('when method params is missing', () => {
    it('returns a 400 error', async () => {
      const response = await request(process.env.HOST).post('/').send({});

      expect(response.status).toEqual(400);
    });
  });

  describe('when method params is invalid', () => {
    it('returns a 400 error', async () => {
      const response = await request(process.env.HOST)
        .post('/')
        .send({ method: 'test' });

      expect(response.status).toEqual(400);
    });
  });
});
