/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  setupFiles: ["<rootDir>/jest.setup.js"],
  // Cold CI runs compile the jest-expo transform cache on first execution,
  // which can push async waitFor() assertions past the 5s default and flake.
  // A roomier timeout absorbs that without masking real failures.
  testTimeout: 20000,
};
