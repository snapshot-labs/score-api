import request from 'supertest';

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

  it.todo('returns the voting power');
});
