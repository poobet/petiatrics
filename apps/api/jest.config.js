/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  moduleNameMapper: {
    '^@petiatrics/types$': '<rootDir>/../../../packages/types/dist',
    '^@petiatrics/types/(.*)$': '<rootDir>/../../../packages/types/dist/$1',
    '^@petiatrics/config$': '<rootDir>/../../../packages/config/dist',
    '^@petiatrics/config/(.*)$': '<rootDir>/../../../packages/config/dist/$1',
    '^@petiatrics/database$': '<rootDir>/../../../packages/database/dist/src',
    '^@petiatrics/database/(.*)$': '<rootDir>/../../../packages/database/dist/src/$1',
  },
};
