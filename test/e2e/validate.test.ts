import request from 'supertest';

describe('validate', () => {
  describe('when the author is invalid', () => {
    it.each([
      ['empty address', '0x0000000000000000000000000000000000000000'],
      ['empty string', ''],
      ['null', null],
      ['invalid address', 'test']
    ])('returns a 400 error on %s', async (title, author) => {
      const response = await request(process.env.HOST)
        .post('/')
        .send({ method: 'validate', author });

      expect(response.status).toEqual(400);
    });
  });

  it.todo('validates the voting power');
});
