/**
 * Custom Jest Test Sequencer for Mobile Tests
 * Ensures location and critical marine navigation tests run first
 */

const Sequencer = require('@jest/test-sequencer').default;

class MobileTestSequencer extends Sequencer {
  sort(tests) {
    // Define test priorities for marine navigation
    const priority = {
      location: 1,
      navigation: 2,
      safety: 2,
      battery: 3,
      offline: 4,
      maps: 5,
      ui: 6,
    };

    const sortedTests = [...tests].sort((testA, testB) => {
      // Get priority based on test file path
      const getPriority = (test) => {
        const path = test.path;
        for (const [key, value] of Object.entries(priority)) {
          if (path.includes(key)) return value;
        }
        return 10; // Default priority for other tests
      };

      const priorityA = getPriority(testA);
      const priorityB = getPriority(testB);

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      // If same priority, sort alphabetically
      return testA.path.localeCompare(testB.path);
    });

    return sortedTests;
  }
}

module.exports = MobileTestSequencer;