/// <reference types="node" />

// Service unit tests run without Mongo + R2. Provide just enough env to satisfy
// @repo/config/env's Zod parser at module load. Real values are not used —
// every service test mocks the repos, the R2 client, and requireSession.
process.env.MONGODB_URI ??= "mongodb://localhost:27017/test";
process.env.AUTH_SECRET ??= "test-secret-test-secret-test-secret-test";
