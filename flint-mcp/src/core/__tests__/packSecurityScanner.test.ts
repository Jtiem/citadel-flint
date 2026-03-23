import { describe, it, expect } from 'vitest';
import {
    scanForSecrets,
    scanForAbsolutePaths,
    scanForNodeBuiltins,
    scanPackFile,
    scanContent,
    scanPackContents,
    SECRET_PATTERNS,
    ABSOLUTE_PATH_PATTERNS,
    NODE_BUILTIN_PATTERN,
} from '../packSecurityScanner.js';
import type { PackContents } from '../packTypes.js';

describe('packSecurityScanner', () => {
    // ── Secret Detection ────────────────────────────────────────────────────

    describe('scanForSecrets', () => {
        it('detects generic API key pattern in JSON content', () => {
            const content = '{ "api_key": "abcdefghijklmnop" }';
            const errors = scanForSecrets(content, 'policy.json');
            expect(errors.length).toBeGreaterThanOrEqual(1);
            expect(errors[0].code).toBe('SECRET_DETECTED');
            expect(errors[0].severity).toBe('error');
            expect(errors[0].file).toBe('policy.json');
        });

        it('detects AWS access key', () => {
            const content = 'aws_key = AKIAIOSFODNN7EXAMPLE';
            const errors = scanForSecrets(content, 'config.md');
            expect(errors.length).toBeGreaterThanOrEqual(1);
            expect(errors.some(e => e.message.includes('AWS Access Key'))).toBe(true);
            expect(errors[0].code).toBe('SECRET_DETECTED');
        });

        it('detects Anthropic API key pattern', () => {
            const content = 'key: sk-ant-api03-abcdefghijklmnopqrstuv';
            const errors = scanForSecrets(content, 'fragment.md');
            expect(errors.length).toBeGreaterThanOrEqual(1);
            expect(errors.some(e => e.message.includes('Anthropic API Key'))).toBe(true);
        });

        it('detects OpenAI API key pattern', () => {
            const content = 'OPENAI_KEY=sk-proj1234567890abcdefghij';
            const errors = scanForSecrets(content, 'env.txt');
            expect(errors.length).toBeGreaterThanOrEqual(1);
            expect(errors.some(e => e.message.includes('OpenAI API Key'))).toBe(true);
        });

        it('detects GitHub token pattern (ghp_)', () => {
            const content = 'token = ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij';
            const errors = scanForSecrets(content, 'config.json');
            expect(errors.length).toBeGreaterThanOrEqual(1);
            expect(errors.some(e => e.message.includes('GitHub Token'))).toBe(true);
        });

        it('detects GitHub token pattern (gho_)', () => {
            const content = 'gho_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmn';
            const errors = scanForSecrets(content, 'config.json');
            expect(errors.length).toBeGreaterThanOrEqual(1);
            expect(errors.some(e => e.message.includes('GitHub Token'))).toBe(true);
        });

        it('detects private key block', () => {
            const content = '-----BEGIN RSA PRIVATE KEY-----\nMIIEow...';
            const errors = scanForSecrets(content, 'key.pem');
            expect(errors.length).toBeGreaterThanOrEqual(1);
            expect(errors.some(e => e.message.includes('Private Key Block'))).toBe(true);
        });

        it('detects EC private key block', () => {
            const content = '-----BEGIN EC PRIVATE KEY-----\nMHQCAQEE...';
            const errors = scanForSecrets(content, 'key.pem');
            expect(errors.length).toBeGreaterThanOrEqual(1);
            expect(errors.some(e => e.message.includes('Private Key Block'))).toBe(true);
        });

        it('detects env variable assignment', () => {
            const content = 'DATABASE_URL=postgres://user:pass@host:5432/db';
            const errors = scanForSecrets(content, '.env');
            expect(errors.length).toBeGreaterThanOrEqual(1);
            expect(errors.some(e => e.message.includes('Env Variable Assignment'))).toBe(true);
        });

        it('detects bearer token pattern', () => {
            const content = 'authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI"';
            const errors = scanForSecrets(content, 'config.json');
            expect(errors.length).toBeGreaterThanOrEqual(1);
            expect(errors.some(e => e.message.includes('Bearer Token'))).toBe(true);
        });

        it('detects Slack token pattern (xoxb-)', () => {
            const content = 'xoxb-1234567890-1234567890123-ABCDefghIJKL';
            const errors = scanForSecrets(content, 'config.json');
            expect(errors.length).toBeGreaterThanOrEqual(1);
            expect(errors.some(e => e.message.includes('Slack Token'))).toBe(true);
        });

        it('detects generic secret/password pattern', () => {
            const content = 'password = "mysuperSecretPassword123"';
            const errors = scanForSecrets(content, 'config.json');
            expect(errors.length).toBeGreaterThanOrEqual(1);
            expect(errors.some(e => e.message.includes('Generic Secret'))).toBe(true);
        });

        it('returns empty array for clean content', () => {
            const content = JSON.stringify({
                version: 2,
                domain: 'healthcare',
                mithril: { mode: 'blocking' },
            });
            const errors = scanForSecrets(content, 'policy.json');
            expect(errors).toEqual([]);
        });

        it('includes correct line numbers', () => {
            const content = 'line1\nline2\nAKIAIOSFODNN7EXAMPLE\nline4';
            const errors = scanForSecrets(content, 'test.txt');
            expect(errors.length).toBeGreaterThanOrEqual(1);
            expect(errors[0].line).toBe(3);
        });

        it('redacts matched secret values in error messages', () => {
            const content = 'AKIAIOSFODNN7EXAMPLE';
            const errors = scanForSecrets(content, 'test.txt');
            expect(errors.length).toBeGreaterThanOrEqual(1);
            // Should not contain the full key in the message
            expect(errors[0].message).not.toContain('AKIAIOSFODNN7EXAMPLE');
            expect(errors[0].message).toContain('***');
        });
    });

    // ── Absolute Path Detection ─────────────────────────────────────────────

    describe('scanForAbsolutePaths', () => {
        it('detects Unix absolute path (/Users/...)', () => {
            const content = 'root: "/Users/john/projects/my-app"';
            const errors = scanForAbsolutePaths(content, 'policy.json');
            expect(errors.length).toBeGreaterThanOrEqual(1);
            expect(errors[0].code).toBe('ABSOLUTE_PATH');
        });

        it('detects Unix absolute path (/home/...)', () => {
            const content = 'path = /home/deploy/.config/flint';
            const errors = scanForAbsolutePaths(content, 'config.json');
            expect(errors.length).toBeGreaterThanOrEqual(1);
            expect(errors[0].code).toBe('ABSOLUTE_PATH');
        });

        it('detects Unix absolute path (/etc/...)', () => {
            const content = 'config: /etc/flint/config.json';
            const errors = scanForAbsolutePaths(content, 'setup.md');
            expect(errors.length).toBeGreaterThanOrEqual(1);
            expect(errors[0].code).toBe('ABSOLUTE_PATH');
        });

        it('detects Windows absolute path (C:\\...)', () => {
            const content = 'path: C:\\Users\\admin\\Documents\\project';
            const errors = scanForAbsolutePaths(content, 'config.json');
            expect(errors.length).toBeGreaterThanOrEqual(1);
            expect(errors[0].code).toBe('ABSOLUTE_PATH');
        });

        it('detects Windows absolute path (D:\\...)', () => {
            const content = 'source: D:\\Projects\\flint-app';
            const errors = scanForAbsolutePaths(content, 'config.json');
            expect(errors.length).toBeGreaterThanOrEqual(1);
            expect(errors[0].code).toBe('ABSOLUTE_PATH');
        });

        it('does not flag relative paths as absolute', () => {
            const content = './src/components/Button.tsx\n../utils/helpers.ts';
            const errors = scanForAbsolutePaths(content, 'manifest.json');
            expect(errors).toEqual([]);
        });

        it('returns warning severity for non-fragment files', () => {
            const content = 'path: /Users/dev/project';
            const errors = scanForAbsolutePaths(content, 'policy.json');
            expect(errors.length).toBeGreaterThanOrEqual(1);
            expect(errors[0].severity).toBe('warning');
        });

        it('returns error severity for fragment files', () => {
            const content = 'Use the file at /Users/dev/project/config.json';
            const errors = scanForAbsolutePaths(content, 'claude-fragments/sentinel.md');
            expect(errors.length).toBeGreaterThanOrEqual(1);
            expect(errors[0].severity).toBe('error');
        });

        it('returns empty array for clean content with no paths', () => {
            const content = '{ "mode": "blocking", "level": "AA" }';
            const errors = scanForAbsolutePaths(content, 'policy.json');
            expect(errors).toEqual([]);
        });
    });

    // ── Node.js Builtin Detection ───────────────────────────────────────────

    describe('scanForNodeBuiltins', () => {
        it('detects import of node:fs', () => {
            const content = "import fs from 'node:fs'";
            const errors = scanForNodeBuiltins(content, 'skill.ts');
            expect(errors.length).toBeGreaterThanOrEqual(1);
            expect(errors[0].code).toBe('NODE_BUILTIN_IMPORT');
        });

        it('detects require of child_process', () => {
            const content = "const cp = require('child_process')";
            const errors = scanForNodeBuiltins(content, 'skill.ts');
            expect(errors.length).toBeGreaterThanOrEqual(1);
            expect(errors[0].code).toBe('NODE_BUILTIN_IMPORT');
        });

        it('detects import of path without node: prefix', () => {
            const content = "import path from 'path'";
            const errors = scanForNodeBuiltins(content, 'skill.ts');
            expect(errors.length).toBeGreaterThanOrEqual(1);
            expect(errors[0].code).toBe('NODE_BUILTIN_IMPORT');
        });

        it('does not flag allowed imports (zod, vite)', () => {
            const content = "import { z } from 'zod'\nimport vite from 'vite'";
            const errors = scanForNodeBuiltins(content, 'skill.ts');
            expect(errors).toEqual([]);
        });

        it('does not flag partial name matches', () => {
            // "filesystem" contains "fs" but is not a builtin
            const content = "import { FileSystem } from 'filesystem'";
            const errors = scanForNodeBuiltins(content, 'skill.ts');
            expect(errors).toEqual([]);
        });
    });

    // ── Combined scanPackFile ────────────────────────────────────────────────

    describe('scanPackFile', () => {
        it('combines secret and path detection', () => {
            const content = 'key: AKIAIOSFODNN7EXAMPLE\npath: /Users/dev/project';
            const errors = scanPackFile(content, 'config.json');
            const codes = errors.map(e => e.code);
            expect(codes).toContain('SECRET_DETECTED');
            expect(codes).toContain('ABSOLUTE_PATH');
        });

        it('does not check node builtins by default', () => {
            const content = "import fs from 'node:fs'";
            const errors = scanPackFile(content, 'skill.ts');
            // Should not detect NODE_BUILTIN_IMPORT without the option
            expect(errors.some(e => e.code === 'NODE_BUILTIN_IMPORT')).toBe(false);
        });

        it('checks node builtins when option is enabled', () => {
            const content = "import fs from 'node:fs'";
            const errors = scanPackFile(content, 'skill.ts', { checkNodeBuiltins: true });
            expect(errors.some(e => e.code === 'NODE_BUILTIN_IMPORT')).toBe(true);
        });

        it('returns empty array for completely clean content', () => {
            const content = '{ "rules": { "MITHRIL-COL": "advisory" } }';
            const errors = scanPackFile(content, 'rules/MITHRIL-COL.json');
            expect(errors).toEqual([]);
        });
    });

    // ── scanContent convenience wrapper ──────────────────────────────────────

    describe('scanContent', () => {
        it('returns clean: true for safe content', () => {
            const result = scanContent('{ "mode": "blocking" }', 'policy.json');
            expect(result.clean).toBe(true);
            expect(result.errors).toEqual([]);
        });

        it('returns clean: false when secrets found', () => {
            const result = scanContent('AKIAIOSFODNN7EXAMPLE', 'test.txt');
            expect(result.clean).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });
    });

    // ── scanPackContents (full pack scan) ────────────────────────────────────

    describe('scanPackContents', () => {
        it('scans all entries in PackContents', () => {
            const contents: PackContents = {
                policy: {
                    packPath: 'policy.json',
                    content: 'AKIAIOSFODNN7EXAMPLE',
                    checksum: 'sha256:abc',
                },
                agentPolicy: {
                    packPath: 'agent-policy.json',
                    content: '/Users/dev/project/config',
                    checksum: 'sha256:def',
                },
                rules: [
                    {
                        packPath: 'rules/MITHRIL-COL.json',
                        content: '{ "id": "MITHRIL-COL", "mode": "advisory" }',
                        checksum: 'sha256:ghi',
                    },
                ],
                claudeFragments: [
                    {
                        packPath: 'claude-fragments/sentinel.md',
                        content: "import fs from 'node:fs'",
                        checksum: 'sha256:jkl',
                    },
                ],
            };

            const errors = scanPackContents(contents);
            const files = errors.map(e => e.file);

            // Should find issues in policy (secret), agentPolicy (abs path),
            // and claudeFragments (node builtin)
            expect(files).toContain('policy.json');
            expect(files).toContain('agent-policy.json');
            expect(files).toContain('claude-fragments/sentinel.md');
        });

        it('enables node builtin detection for claude fragments', () => {
            const contents: PackContents = {
                policy: null,
                agentPolicy: null,
                rules: [],
                claudeFragments: [
                    {
                        packPath: 'claude-fragments/agent.md',
                        content: "const cp = require('child_process')",
                        checksum: 'sha256:xyz',
                    },
                ],
            };

            const errors = scanPackContents(contents);
            expect(errors.some(e => e.code === 'NODE_BUILTIN_IMPORT')).toBe(true);
        });

        it('returns empty array for clean pack contents', () => {
            const contents: PackContents = {
                policy: {
                    packPath: 'policy.json',
                    content: '{ "version": 2, "domain": "healthcare" }',
                    checksum: 'sha256:abc',
                },
                agentPolicy: null,
                rules: [],
                claudeFragments: [],
            };

            const errors = scanPackContents(contents);
            expect(errors).toEqual([]);
        });

        it('handles null policy and agentPolicy gracefully', () => {
            const contents: PackContents = {
                policy: null,
                agentPolicy: null,
                rules: [],
                claudeFragments: [],
            };

            const errors = scanPackContents(contents);
            expect(errors).toEqual([]);
        });
    });

    // ── Pattern Exports ─────────────────────────────────────────────────────

    describe('exported constants', () => {
        it('SECRET_PATTERNS is a non-empty array', () => {
            expect(SECRET_PATTERNS.length).toBeGreaterThan(0);
        });

        it('ABSOLUTE_PATH_PATTERNS is a non-empty array', () => {
            expect(ABSOLUTE_PATH_PATTERNS.length).toBeGreaterThan(0);
        });

        it('NODE_BUILTIN_PATTERN is a RegExp', () => {
            expect(NODE_BUILTIN_PATTERN).toBeInstanceOf(RegExp);
        });
    });
});
