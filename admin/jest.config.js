module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@taste-food/shared$': '<rootDir>/../packages/shared/src/index.ts',
    '^@taste-food/shared/(.*)$': '<rootDir>/../packages/shared/src/$1/index.ts',
    '\\.(css|less|scss)$': 'identity-obj-proxy',
  },
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  testMatch: ['<rootDir>/src/__tests__/**/*.test.(ts|tsx)'],
};
