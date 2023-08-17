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
  coveragePathIgnorePatterns: ['/node_modules/', '<rootDir>/dist/', '<rootDir>/test/fixtures/'],
  preset: 'ts-jest',
  testEnvironment: 'jest-environment-node-single-context',
  moduleFileExtensions: ['js', 'ts'],
  testMatch: ['<rootDir>/test/unit/**/?(*.)+(spec|test).(ts|js)'],
  testPathIgnorePatterns: ['dist/', 'node_modules/'],
  verbose: true,
  globals: {
    'ts-jest': {
      isolatedModules: true
    }
  }
};
