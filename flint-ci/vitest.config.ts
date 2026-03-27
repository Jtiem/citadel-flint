import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['src/**/*.test.ts', 'src/**/__tests__/**/*.ts'],
        testTimeout: 15000,
    },
    resolve: {
        alias: {
            '@flint-mcp': '../flint-mcp/src',
        },
    },
})
