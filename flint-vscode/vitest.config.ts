import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
    test: {
        include: ['src/__tests__/**/*.test.ts'],
        exclude: ['node_modules', 'dist'],
    },
    resolve: {
        alias: {
            vscode: path.resolve(__dirname, 'src/__tests__/__mocks__/vscode.ts'),
        },
    },
});
