import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

/**
 * Vitest configuration for React component tests.
 *
 * Separate from vitest.config.ts (which uses node environment for pure TS logic).
 * This config:
 *   - Uses jsdom for DOM simulation
 *   - Includes only src/components/**\/*.test.tsx files
 *   - Sets up @testing-library/jest-dom matchers via setupFiles
 *   - Polyfills process.env.NODE_ENV (same as the main config)
 */
export default defineConfig({
    plugins: [react()],
    define: {
        'process.env.NODE_ENV': JSON.stringify('test'),
    },
    test: {
        environment: 'jsdom',
        include: ['src/**/*.test.tsx', 'src/**/*.test.ts'],
        exclude: ['node_modules/**', 'dist/**', 'dist-electron/**'],
        setupFiles: ['src/components/__tests__/setup.ts'],
        globals: true,
    },
})
