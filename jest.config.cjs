/** @type {import('ts-jest').JestConfigWithTsJest} */
const commonConfig = {
    testEnvironment: 'node',
    rootDir: './src',
    preset: 'ts-jest/presets/default-esm',
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
        "^lodash-es$": "lodash",
    },
    transform: {
        '^.+\\.tsx?$': [
            'ts-jest',
            {
                useESM: true,
            },
        ],
    },
};

/** @type {import('jest').Config} */
module.exports = {
    projects: [
        {
            displayName: 'unit',
            testRegex: '.*\\.spec\\.ts$',
            ...commonConfig,
        },
        {
            displayName: 'integration',
            testRegex: '/.*\\.integration-spec\\.ts$',
            ...commonConfig,
        },
    ],
    coverageDirectory: './coverage',
    coverageProvider: 'v8',
    collectCoverageFrom: [
        '**/*.ts',
        '!**/*.d.ts',
        '!**/*.spec.ts',
        '!**/*.integration-spec.ts',
        '!**/index.ts',
        '!**/main.ts',
        '!**/*.types.ts',
    ],
    coverageThreshold: {
        global: {
            statements: -100, // ~99%
            branches: -50, // ~96%
            functions: -5, // ~99%
            lines: -100, // ~99%
        },
    },
    testTimeout: 10000,
};
