import request from 'supertest';

describe('getVp', () => {
  describe('when the address params is missing', () => {
    it('returns a 500 error', async () => {
      const response = await request(process.env.HOST).post('/').send({ method: 'get_vp' });

      expect(response.status).toEqual(500);
    });
  });

  it.todo('returns the voting power');
});
