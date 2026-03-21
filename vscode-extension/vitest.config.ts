import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        include: ['src/__tests__/**/*.test.ts'],
        globals: false,
    },
    resolve: {
        alias: {
            vscode: path.resolve(__dirname, 'src/__tests__/__mocks__/vscode.ts'),
        },
    },
});
