/**
 * pathUtils — src/utils/pathUtils.ts
 *
 * Lightweight path resolution utilities for the browser environment.
 * Ensures we can resolve relative component imports across directories
 * without needing Node.js 'path' or 'path-browserify'.
 */

export function dirname(p: string): string {
    const parts = p.split('/')
    if (parts.length <= 1) return '.'
    parts.pop()
    return parts.join('/') || '/'
}

export function resolvePath(dir: string, relative: string): string {
    const dirParts = dir.split('/').filter(Boolean)
    const relParts = relative.split('/').filter(Boolean)

    for (const part of relParts) {
        if (part === '.') continue
        if (part === '..') {
            if (dirParts.length > 0) {
                dirParts.pop()
            }
        } else {
            dirParts.push(part)
        }
    }

    return (dir.startsWith('/') ? '/' : '') + dirParts.join('/')
}

export function relativePath(fromDir: string, toPath: string): string {
    const fromParts = fromDir.split('/').filter(Boolean)
    const toParts = toPath.split('/').filter(Boolean)

    let commonLength = 0
    while (
        commonLength < fromParts.length &&
        commonLength < toParts.length &&
        fromParts[commonLength] === toParts[commonLength]
    ) {
        commonLength++
    }

    const upDirCount = fromParts.length - commonLength
    const upDirs = Array(upDirCount).fill('..')
    const downDirs = toParts.slice(commonLength)

    const relParts = [...upDirs, ...downDirs]
    if (relParts.length === 0) return '.'

    let result = relParts.join('/')
    if (!result.startsWith('.')) {
        result = './' + result
    }

    return result
}
