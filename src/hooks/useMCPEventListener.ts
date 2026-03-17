/**
 * useMCPEventListener.ts — Phase W.1: MCP-to-Glass Push Channel
 *
 * Subscribes to `bridge:mcp-event` IPC events pushed by the Electron main
 * process from the `.bridge/mcp-events.jsonl` tail-follow watcher.
 *
 * Each call delivers a batch of MCPEvent objects (debounced at 500ms in the
 * main process). This hook dispatches them to the appropriate stores:
 *
 *   violation          → notificationStore.push() with warning/error severity
 *   audit              → notificationStore.push() with info severity
 *   annotation         → annotationStore.fetchAnnotations() (triggers re-read)
 *   mutation / fix     → notificationStore.push() with info severity
 *   debt               → notificationStore.push() with info severity
 *
 * Catch-up guard: events older than 60 seconds at the time of dispatch are
 * silently dropped. This prevents a storm of stale notifications on startup
 * when the Electron main process reads catch-up lines from the JSONL file.
 *
 * Cleanup: call `window.bridgeAPI.mcp?.removeEventListener()` in the useEffect
 * return — this hook handles that automatically. Never call this hook more
 * than once per React tree (use it at the App root level only).
 *
 * Renderer process only — no Node.js imports.
 */

import { useEffect } from 'react'
import { useNotificationStore } from '../store/notificationStore'
import { useAnnotationStore } from '../store/annotationStore'
import type { MCPEvent } from '../types/bridge-api'

/** Events older than this threshold (in ms) are ignored on startup catch-up. */
const CATCH_UP_THRESHOLD_MS = 60_000

/**
 * Subscribes to MCP push events and dispatches them to the appropriate stores.
 *
 * Mount this hook once at the App root. It registers the IPC listener and
 * removes it on unmount. Calling it multiple times creates duplicate listeners.
 */
export function useMCPEventListener(): void {
    useEffect(() => {
        if (typeof window === 'undefined' || !window.bridgeAPI?.mcp) return

        const { push: pushNotification } = useNotificationStore.getState()
        const { fetchAnnotations } = useAnnotationStore.getState()

        /**
         * Dispatches a batch of MCPEvents to the correct store actions.
         * Filters out events older than CATCH_UP_THRESHOLD_MS.
         */
        function handleEvents(events: MCPEvent[]): void {
            const now = Date.now()

            for (const event of events) {
                // Catch-up guard: ignore stale events from before Glass opened
                if (typeof event.timestamp === 'number' && now - event.timestamp > CATCH_UP_THRESHOLD_MS) {
                    continue
                }

                switch (event.type) {
                    case 'violation': {
                        pushNotification({
                            type: 'violation',
                            title: event.severity === 'critical' ? 'Critical Violation' : 'Governance Warning',
                            message: event.summary,
                            severity: event.severity === 'critical' ? 'error' : 'warning',
                            autoDismissMs: event.severity === 'critical' ? 0 : 8000,
                        })
                        break
                    }

                    case 'audit': {
                        pushNotification({
                            type: 'info',
                            title: 'MCP Audit Complete',
                            message: event.summary,
                            severity: event.severity === 'critical' ? 'error' : event.severity === 'warning' ? 'warning' : 'info',
                            autoDismissMs: 6000,
                        })
                        break
                    }

                    case 'annotation': {
                        // Trigger a re-read of the annotations file — no additional notification,
                        // as the annotation panel will reflect the change visually.
                        void fetchAnnotations()
                        break
                    }

                    case 'mutation':
                    case 'fix': {
                        pushNotification({
                            type: 'mutation',
                            title: event.type === 'fix' ? 'MCP Auto-Fix Applied' : 'MCP Mutation',
                            message: event.summary,
                            severity: 'info',
                            autoDismissMs: 5000,
                        })
                        break
                    }

                    case 'debt': {
                        pushNotification({
                            type: 'info',
                            title: 'Debt Report',
                            message: event.summary,
                            severity: event.severity === 'critical' ? 'error' : event.severity === 'warning' ? 'warning' : 'info',
                            autoDismissMs: 8000,
                        })
                        break
                    }

                    default:
                        // Unknown event type — forward as generic info
                        pushNotification({
                            type: 'info',
                            title: 'MCP Event',
                            message: event.summary ?? 'An MCP event was received.',
                            severity: 'info',
                            autoDismissMs: 5000,
                        })
                }
            }
        }

        // The preload casts the callback argument — we cast on the receiver side.
        // The MCPEvent[] shape is guaranteed by the main process JSON parse.
        window.bridgeAPI.mcp.onEvent(handleEvents as (events: unknown[]) => void)

        return () => {
            window.bridgeAPI.mcp?.removeEventListener()
        }
    }, [])
}
