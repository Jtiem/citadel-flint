/**
 * Emitter registry -- flint-mcp/src/core/emitters/index.ts
 *
 * EXP.7: Central registry for platform-specific token emitters.
 * Provides a lazy factory-based registry so the barrel compiles even before
 * individual emitter files exist. Adding a new platform requires only:
 *   1. A new emitter file implementing PlatformEmitter
 *   2. A registerEmitter() call in this file
 */

import type { PlatformTarget, PlatformEmitter } from './types.js'

// ---------------------------------------------------------------------------
// Emitter Registry (factory-based, lazy instantiation)
// ---------------------------------------------------------------------------

const EMITTER_REGISTRY = new Map<PlatformTarget, () => PlatformEmitter>()

/**
 * Register a platform emitter factory. Called at module load time for each
 * supported platform.
 */
export function registerEmitter(
    platform: PlatformTarget,
    factory: () => PlatformEmitter,
): void {
    EMITTER_REGISTRY.set(platform, factory)
}

/**
 * Get the emitter for a specific platform.
 * Throws if the platform is not registered.
 */
export function getEmitter(platform: PlatformTarget): PlatformEmitter {
    const factory = EMITTER_REGISTRY.get(platform)
    if (!factory) {
        throw new Error(`No emitter registered for platform: ${platform}`)
    }
    return factory()
}

/**
 * Get all registered platform targets.
 */
export function getAvailablePlatforms(): PlatformTarget[] {
    return [...EMITTER_REGISTRY.keys()]
}

/**
 * Check whether a specific platform has an emitter registered.
 */
export function hasEmitter(platform: PlatformTarget): boolean {
    return EMITTER_REGISTRY.has(platform)
}

// ---------------------------------------------------------------------------
// Emitter registrations
// ---------------------------------------------------------------------------
import { TailwindEmitter } from './tailwindEmitter.js'
registerEmitter('tailwind', () => new TailwindEmitter())

import { CSSEmitter } from './cssEmitter.js'
registerEmitter('css', () => new CSSEmitter())

import { ReactNativeEmitter } from './reactNativeEmitter.js'
registerEmitter('react-native', () => new ReactNativeEmitter())

import { SwiftEmitter } from './swiftEmitter.js'
registerEmitter('swift', () => new SwiftEmitter())

import { KotlinEmitter } from './kotlinEmitter.js'
registerEmitter('kotlin', () => new KotlinEmitter())

// Re-export all types
export * from './types.js'
