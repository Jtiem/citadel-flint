import { defineConfig } from 'vitest/config'

/**
 * Vitest configuration — separate from vite.config.ts.
 *
 * The electron and renderer Vite plugins MUST NOT be included here;
 * they configure Rollup/Vite for the Electron app build and would
 * interfere with the test runner.
 *
 * Test scope: pure, headless TypeScript logic only.
 *   ✓ electron/FileTransactionManager.ts  — Node.js fs utilities
 *   ✓ src/core/ASTService.ts              — stub + re-export surface
 *   ✗ React components, IPC handlers, Electron APIs
 */
export default defineConfig({
    define: {
        // @babel/types reads process.env.NODE_ENV internally.
        // Polyfill it so Babel's CJS guards don't throw in Node.js ESM.
        'process.env.NODE_ENV': JSON.stringify('test'),
    },
    test: {
        environment: 'node',
        include: [
            'electron/**/*.test.ts',
            'src/core/**/*.test.ts',
            'src/utils/**/*.test.ts',
        ],
        exclude: ['node_modules/**', 'dist/**', 'dist-electron/**'],
    },
})
