import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

/** @type {import("jest").Config} */
const customJestConfig = {
  testEnvironment: "jest-environment-jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testPathIgnorePatterns: [
    "<rootDir>/node_modules/",
    "<rootDir>/.next/",
    "<rootDir>/dist/",
    "<rootDir>/src/__tests__/mocks/",
  ],
  moduleNameMapper: {
    "^@prisma/client$": "<rootDir>/src/testing/prisma-client-jest.ts",
    "^next-auth/next$": "<rootDir>/src/testing/__mocks__/next-auth-next.ts",
    "^@/lib/next-auth-options$": "<rootDir>/src/testing/__mocks__/nextauth-route.stub.ts",
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  collectCoverageFrom: [
    "src/lib/**/*.{ts,tsx}",
    "src/pages/api/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
  ],
  coverageDirectory: "<rootDir>/coverage",
  clearMocks: true,
  restoreMocks: true,
};

export default createJestConfig(customJestConfig);
