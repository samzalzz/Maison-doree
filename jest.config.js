const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Points to the Next.js app root so next.config.js and .env files are loaded
  dir: './',
})

/** @type {import('jest').Config} */
const customConfig = {
  testEnvironment: 'node',
  moduleNameMapper: {
    // Support the @/* path alias configured in tsconfig.json
    '^@/(.*)$': '<rootDir>/$1',
  },
  // Test files under lib/__tests__ (service/validator unit tests),
  // app/api/**/__tests__ (API route integration tests),
  // app/(admin)/admin/__tests__ (UI component/page tests), and
  // tests/integration (cross-cutting integration tests).
  testMatch: [
    '<rootDir>/lib/__tests__/**/*.test.ts',
    '<rootDir>/app/api/**/__tests__/**/*.test.ts',
    '<rootDir>/app/**/__tests__/**/*.test.tsx',
    '<rootDir>/tests/integration/**/*.test.tsx',
    '<rootDir>/tests/integration/**/*.test.ts',
  ],
}

module.exports = createJestConfig(customConfig)
