/**
 * Integration tests talk to a running local Supabase over real HTTP, so they run in plain
 * Node (the Expo preset swaps out fetch for app tests).
 * @type {import('jest').Config}
 */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/integration/**/*.test.ts'],
  maxWorkers: 1, // the files share test users
  transform: { '^.+\\.tsx?$': ['babel-jest', { presets: ['babel-preset-expo'] }] },
};
