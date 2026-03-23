/**
 * Pack Security Scanner -- flint-mcp/src/core/packSecurityScanner.ts
 *
 * Scans pack file contents for secrets, absolute paths, and Node.js
 * builtin imports before bundling into a .flint-pack archive.
 * Pure functions with no side effects.
 */

import type {
    PackContents,
    PackValidationError,
    PackValidationSeverity,
} from './packTypes.js';

// ── Secret Detection Patterns ───────────────────────────────────────────────

/**
 * Patterns that indicate potential secrets or API keys.
 * These are applied to every file included in the pack.
 */
export const SECRET_PATTERNS: ReadonlyArray<{
    name: string;
    pattern: RegExp;
}> = [
    { name: 'Generic API Key',         pattern: /(?:api[_-]?key|apikey)["']?\s*[:=]\s*['"][^'"]{8,}['"]/gi },
    { name: 'Generic Secret',          pattern: /(?:secret|password|passwd|token)["']?\s*[:=]\s*['"][^'"]{8,}['"]/gi },
    { name: 'AWS Access Key',          pattern: /AKIA[0-9A-Z]{16}/g },
    { name: 'AWS Secret Key',          pattern: /(?:aws_secret_access_key|secret_key)["']?\s*[:=]\s*['"][^'"]{20,}['"]/gi },
    { name: 'GitHub Token',            pattern: /gh[pousr]_[A-Za-z0-9_]{36,}/g },
    { name: 'Anthropic API Key',       pattern: /sk-ant-[A-Za-z0-9_-]{20,}/g },
    { name: 'OpenAI API Key',          pattern: /sk-[A-Za-z0-9]{20,}/g },
    { name: 'Slack Token',             pattern: /xox[baprs]-[0-9]{10,}-[A-Za-z0-9]{10,}/g },
    { name: 'Private Key Block',       pattern: /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/g },
    { name: 'Env Variable Assignment', pattern: /^[A-Z][A-Z0-9_]{2,}=\S{8,}$/gm },
    { name: 'Bearer Token',            pattern: /(?:bearer|authorization)["']?\s*[:=]\s*['"][^'"]{20,}['"]/gi },
];

// ── Absolute Path Detection ─────────────────────────────────────────────────

/**
 * Detect absolute local file paths.
 * Matches Unix-style (/Users/..., /home/..., /tmp/...) and
 * Windows-style (C:\..., D:\...) absolute paths.
 */
export const ABSOLUTE_PATH_PATTERNS: ReadonlyArray<RegExp> = [
    /(?:^|["'\s=:])\/(?:Users|home|tmp|var|opt|etc|root)\/[^\s"']+/gm,
    /(?:^|["'\s=:])[A-Z]:\\[^\s"']+/gm,
];

// ── Node.js Builtin Import Detection ────────────────────────────────────────

/**
 * Detect imports of Node.js built-in modules in skill files.
 * Skills are sandboxed to the MCP tool surface.
 */
export const NODE_BUILTIN_PATTERN = /(?:require\s*\(\s*['"]|from\s*['"]|import\s*['"])(?:node:)?(?:fs|path|child_process|os|crypto|net|http|https|dgram|cluster|dns|tls|readline|repl|vm|worker_threads)['"]/g;

// ── Scanner API ─────────────────────────────────────────────────────────────

export interface ScanResult {
    clean: boolean;
    errors: PackValidationError[];
}

/**
 * Scans a file's content for secret patterns.
 * Returns an array of PackValidationError with severity 'error'.
 */
export function scanForSecrets(
    content: string,
    filePath: string,
): PackValidationError[] {
    const errors: PackValidationError[] = [];

    for (const { name, pattern } of SECRET_PATTERNS) {
        // Reset lastIndex for global regexps
        pattern.lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = pattern.exec(content)) !== null) {
            const line = lineNumberAt(content, match.index);
            errors.push({
                severity: 'error',
                file: filePath,
                line,
                message: `${name} detected: "${redact(match[0])}"`,
                code: 'SECRET_DETECTED',
            });
        }
    }

    return errors;
}

/**
 * Scans a file's content for absolute local paths.
 *
 * Severity rules:
 *   - Files under 'claude-fragments/' are 'error' (fragments are injected into prompts)
 *   - All other files are 'warning'
 */
export function scanForAbsolutePaths(
    content: string,
    filePath: string,
): PackValidationError[] {
    const errors: PackValidationError[] = [];
    const isFragment = filePath.startsWith('claude-fragments/');
    const severity: PackValidationSeverity = isFragment ? 'error' : 'warning';

    for (const pattern of ABSOLUTE_PATH_PATTERNS) {
        pattern.lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = pattern.exec(content)) !== null) {
            const line = lineNumberAt(content, match.index);
            const trimmedMatch = match[0].replace(/^["'\s=:]/, '');
            errors.push({
                severity,
                file: filePath,
                line,
                message: `Absolute path detected: "${trimmedMatch}"`,
                code: 'ABSOLUTE_PATH',
            });
        }
    }

    return errors;
}

/**
 * Scans a file's content for Node.js builtin imports.
 * Returns an array of PackValidationError with severity 'error'.
 */
export function scanForNodeBuiltins(
    content: string,
    filePath: string,
): PackValidationError[] {
    const errors: PackValidationError[] = [];
    NODE_BUILTIN_PATTERN.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = NODE_BUILTIN_PATTERN.exec(content)) !== null) {
        const line = lineNumberAt(content, match.index);
        errors.push({
            severity: 'error',
            file: filePath,
            line,
            message: `Node.js builtin import detected: "${match[0]}"`,
            code: 'NODE_BUILTIN_IMPORT',
        });
    }

    return errors;
}

/**
 * Scans a single file's content for all security violations:
 * secrets, absolute paths, and optionally Node.js builtins.
 */
export function scanPackFile(
    content: string,
    filePath: string,
    options?: { checkNodeBuiltins?: boolean },
): PackValidationError[] {
    const errors: PackValidationError[] = [];

    errors.push(...scanForSecrets(content, filePath));
    errors.push(...scanForAbsolutePaths(content, filePath));

    if (options?.checkNodeBuiltins) {
        errors.push(...scanForNodeBuiltins(content, filePath));
    }

    return errors;
}

/**
 * Scans a single file's content for security violations.
 * Convenience wrapper that returns a ScanResult with a clean flag.
 */
export function scanContent(
    content: string,
    filePath: string,
    options?: { checkNodeBuiltins?: boolean },
): ScanResult {
    const errors = scanPackFile(content, filePath, options);
    return {
        clean: errors.length === 0,
        errors,
    };
}

/**
 * Scans all files in a PackContents for security violations.
 * Claude fragments are checked with Node.js builtin detection enabled.
 */
export function scanPackContents(contents: PackContents): PackValidationError[] {
    const errors: PackValidationError[] = [];

    if (contents.policy) {
        errors.push(...scanPackFile(contents.policy.content, contents.policy.packPath));
    }

    if (contents.agentPolicy) {
        errors.push(...scanPackFile(contents.agentPolicy.content, contents.agentPolicy.packPath));
    }

    for (const rule of contents.rules) {
        errors.push(...scanPackFile(rule.content, rule.packPath));
    }

    for (const fragment of contents.claudeFragments) {
        errors.push(...scanPackFile(fragment.content, fragment.packPath, {
            checkNodeBuiltins: true,
        }));
    }

    return errors;
}

// ── Internal Helpers ────────────────────────────────────────────────────────

/**
 * Returns the 1-based line number for a character offset in a string.
 */
function lineNumberAt(content: string, offset: number): number {
    let line = 1;
    for (let i = 0; i < offset && i < content.length; i++) {
        if (content[i] === '\n') line++;
    }
    return line;
}

/**
 * Redacts a matched secret string for safe display in error messages.
 * Shows the first 6 characters and replaces the rest with asterisks.
 */
function redact(value: string): string {
    if (value.length <= 8) {
        return '***';
    }
    return value.slice(0, 6) + '***' + value.slice(-2);
}
