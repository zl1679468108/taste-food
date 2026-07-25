module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^@taste-food/shared$': '<rootDir>/../packages/shared/src/index.ts',
    '^@taste-food/shared/(.*)$': '<rootDir>/../packages/shared/src/$1/index.ts',
    '\\.(scss|sass|css)$': '<rootDir>/__mocks__/styleMock.js',
    '\\.(wav|mp3|png|jpg|jpeg|webp)$': '<rootDir>/__mocks__/fileMock.js',
  },
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  verbose: true,
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/__tests__/miniprogram.e2e.test.ts'],
};
