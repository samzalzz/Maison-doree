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
  // Only discover test files under lib/__tests__ for now;
  // extend this glob as more test directories are added.
  testMatch: ['<rootDir>/lib/__tests__/**/*.test.ts'],
}

module.exports = createJestConfig(customConfig)
