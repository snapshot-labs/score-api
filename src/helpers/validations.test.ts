import getValidations from './validations';
import { clone } from '../utils';

jest.mock('@snapshot-labs/strategies', () => ({
  validations: {
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
  }
}));

jest.mock('../utils', () => ({
  clone: jest.fn(obj => obj)
}));

describe('getValidations function', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('should clone and transform the snapshot validations if cache is empty', async () => {
    (clone as jest.Mock).mockImplementationOnce(obj => obj);
    const validations = await getValidations();

    expect(clone).toHaveBeenCalled();
    expect(validations).toEqual({
      basic: {
        key: 'basic',
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
      }
    });
  });

  it('should return validations from cache if available', async () => {
    await getValidations();

    const spy = jest.spyOn(Object, 'fromEntries');

    await getValidations();

    expect(spy).not.toHaveBeenCalled();

    spy.mockRestore();
  });

  it('should filter out hidden validations', async () => {
    const validations = await getValidations();

    expect(validations).not.toHaveProperty('passportWeighted');
  });
});
