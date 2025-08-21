/**
 * Jest Configuration for Mobile-specific tests
 * Focused on location services, battery usage, and navigation accuracy
 */

const baseConfig = require('./jest.config');

module.exports = {
  ...baseConfig,
  displayName: 'Mobile Tests',
  testMatch: [
    '<rootDir>/src/**/*.(mobile|location|battery|navigation|offline).test.(ts|tsx|js)',
    '<rootDir>/src/services/**/*.test.(ts|tsx|js)',
    '<rootDir>/src/hooks/**/*.test.(ts|tsx|js)',
  ],
  setupFilesAfterEnv: [
    ...baseConfig.setupFilesAfterEnv,
    '<rootDir>/src/test/mobile-setup.ts',
  ],
  testEnvironment: 'jsdom',
  testTimeout: 30000, // Longer timeout for location and network tests
  
  // Focus on mobile-specific coverage
  collectCoverageFrom: [
    'src/services/location/**/*.{ts,tsx}',
    'src/services/maps/**/*.{ts,tsx}',
    'src/services/offline/**/*.{ts,tsx}',
    'src/hooks/**/*.{ts,tsx}',
    'src/store/slices/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/*.spec.{ts,tsx}',
  ],
  
  // Higher coverage thresholds for critical marine navigation components
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    'src/services/location/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    'src/services/offline/': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
  },
  
  // Test categories
  runner: 'jest-runner',
  maxWorkers: 2, // Limit workers for location tests
  
  // Custom test sequencer for mobile tests
  testSequencer: '<rootDir>/src/test/mobile-test-sequencer.js',
  
  // Globals for mobile testing
  globals: {
    ...baseConfig.globals,
    __MOBILE_TEST__: true,
    __LOCATION_MOCK__: true,
  },
};