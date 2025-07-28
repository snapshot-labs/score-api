/*
 * For a detailed explanation regarding each configuration property and type check, visit:
 * https://jestjs.io/docs/configuration
 */

export default {
  clearMocks: true,
  collectCoverage: true,
  collectCoverageFrom: ['./src/**'],
  coverageDirectory: 'coverage-unit',
  coverageProvider: 'v8',
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/test/fixtures/',
    '<rootDir>/src/strategies/'
  ],
  preset: 'ts-jest',
  testEnvironment: 'jest-environment-node-single-context',
  moduleFileExtensions: ['js', 'ts'],
  testMatch: [
    '<rootDir>/src/**/?(*.)+(spec|test).[jt]s?(x)',
    '<rootDir>/test/strategies/unit/**/?(*.)+(spec|test).[jt]s?(x)'
  ],
  verbose: true,
  globals: {
    'ts-jest': {
      isolatedModules: true
    }
  }
};
