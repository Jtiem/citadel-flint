/**
 * useThumbnail — src/hooks/useThumbnail.ts
 *
 * Phase CV2.2: Component Thumbnail Generator
 *
 * React hook for fetching component thumbnails via IPC.
 *
 * Usage:
 *   const { dataUrl, isLoading, error } = useThumbnail('Button', '/abs/path/Button.tsx')
 *
 * Behavior:
 *   1. On mount (or when componentName/filePath changes), calls
 *      `window.flintAPI.thumbnails.get(componentName)`.
 *   2. If null (not cached), calls `window.flintAPI.thumbnails.generate(...)`.
 *   3. After generate completes, calls `get()` again to retrieve the data URL.
 *   4. Returns `{ dataUrl, isLoading, error }` for the component to consume.
 *
 * The hook does NOT re-fetch on every render — it caches the result in React
 * state and only re-fetches when `componentName` or `filePath` changes.
 *
 * Renderer process only — all IPC calls go through window.flintAPI.
 */

import { useState, useEffect, useRef } from 'react'

export interface UseThumbnailState {
    /** base64 data URL string ('data:image/png;base64,...'), or null when not ready. */
    dataUrl: string | null
    /** True while the initial get() or generate() call is in flight. */
    isLoading: boolean
    /** Error message if generation failed, otherwise null. */
    error: string | null
}

/**
 * React hook for fetching component thumbnails via IPC.
 *
 * @param componentName PascalCase component name used as the cache key.
 * @param filePath      Absolute path to the component source file.
 *
 * Returns `{ dataUrl, isLoading, error }`.
 *   - On mount: isLoading = true, dataUrl = null, error = null
 *   - Cache hit: isLoading = false, dataUrl = 'data:image/png;base64,...'
 *   - Cache miss + generate success: same as cache hit
 *   - Generate failure: isLoading = false, error = '...', dataUrl = null
 */
export function useThumbnail(
    componentName: string,
    filePath: string,
): UseThumbnailState {
    const [state, setState] = useState<UseThumbnailState>({
        dataUrl: null,
        isLoading: true,
        error: null,
    })

    // Stable ref to track the active effect so we can cancel stale requests
    const activeRef = useRef(true)

    useEffect(() => {
        if (!componentName || !filePath) {
            setState({ dataUrl: null, isLoading: false, error: null })
            return
        }

        // Guard against window.flintAPI being absent in test/headless environments
        const api = (window as unknown as Record<string, unknown>).flintAPI as
            | { thumbnails?: {
                get: (name: string) => Promise<string | null>
                generate: (payload: {
                    filePath: string
                    componentName: string
                }) => Promise<{ componentName: string; thumbnailPath: string; generated: boolean; error: string | null }>
            } }
            | undefined

        if (!api?.thumbnails) {
            setState({
                dataUrl: null,
                isLoading: false,
                error: 'window.flintAPI.thumbnails is not available',
            })
            return
        }

        activeRef.current = true
        setState({ dataUrl: null, isLoading: true, error: null })

        const { thumbnails } = api

        void (async () => {
            try {
                // Step 1: Check cache first (< 50 ms for hits)
                const cached = await thumbnails.get(componentName)

                if (!activeRef.current) return // stale effect

                if (cached !== null) {
                    setState({ dataUrl: cached, isLoading: false, error: null })
                    return
                }

                // Step 2: Cache miss — trigger generation
                const result = await thumbnails.generate({ filePath, componentName })

                if (!activeRef.current) return // stale effect

                if (result.error) {
                    setState({ dataUrl: null, isLoading: false, error: result.error })
                    return
                }

                // Step 3: Re-read the cache to get the base64 data URL
                const dataUrl = await thumbnails.get(componentName)

                if (!activeRef.current) return // stale effect

                setState({
                    dataUrl,
                    isLoading: false,
                    error: dataUrl === null
                        ? 'Thumbnail was generated but could not be read back from cache'
                        : null,
                })
            } catch (err) {
                if (!activeRef.current) return // stale effect
                setState({
                    dataUrl: null,
                    isLoading: false,
                    error: err instanceof Error ? err.message : String(err),
                })
            }
        })()

        return () => {
            // Cancel in-flight requests when componentName or filePath changes
            activeRef.current = false
        }
    }, [componentName, filePath])

    return state
}
