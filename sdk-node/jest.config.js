/** @type {import('jest').Config} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src'],
    testMatch: ['**/*.test.ts', '**/*.spec.ts'],
    transform: {
        '^.+\\.tsx?$': ['ts-jest', {
            tsconfig: {
                // Use a relaxed config for tests
                strict: true,
                esModuleInterop: true,
                skipLibCheck: true,
            },
        }],
    },
    collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts'],
    coverageThreshold: {
        global: { branches: 70, functions: 70, lines: 70, statements: 70 },
    },
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
}
