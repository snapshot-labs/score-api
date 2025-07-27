import getStrategies from './strategies';
import { clone } from '../utils';

jest.mock('../strategies', () => ({
  strategies: {
    gno: {
      author: 'nginnever',
      version: '0.1.1',
      examples: null,
      schema: null,
      about: ''
    }
  }
}));
jest.mock('../utils', () => ({
  clone: jest.fn(obj => obj)
}));

describe('getStrategies function', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('should clone and transform the snapshot strategies if cache is empty', async () => {
    (clone as jest.Mock).mockImplementationOnce(obj => obj);

    const strategies = await getStrategies();

    expect(clone).toHaveBeenCalled();

    expect(strategies).toEqual({
      gno: {
        key: 'gno',
        author: 'nginnever',
        version: '0.1.1',
        examples: null,
        schema: null,
        about: ''
      }
    });
  });

  it('should return strategies from cache if available', async () => {
    await getStrategies();

    const spy = jest.spyOn(Object, 'fromEntries');

    await getStrategies();

    expect(spy).not.toHaveBeenCalled();

    spy.mockRestore();
  });
});
