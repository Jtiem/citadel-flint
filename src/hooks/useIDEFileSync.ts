import { useEffect } from 'react'
import { useCanvasStore } from '../store/canvasStore'
import { useNotificationStore } from '../store/notificationStore'

// Vite-style env access — `process` isn't defined in the renderer context.
const process = (globalThis as { process?: { env: Record<string, string | undefined> } }).process
    ?? { env: { NODE_ENV: 'production' } as Record<string, string | undefined> }

/**
 * IDE→Glass File Sync hook (Herald).
 *
 * When the VS Code / Cursor extension sends a file via "Open in Flint Glass"
 * (or auto-follow on editor focus), Glass receives it here.
 *
 * Behavior:
 *   - explicit=true (user invoked "Open in Flint Glass" command):
 *       Always load the file directly — even if a different file is already
 *       open. This matches user intent: the command means "show this in Glass
 *       right now." The same-file dedup is NOT applied for explicit events
 *       because the user may want to reload after an external edit.
 *   - explicit=false / absent (passive auto-follow on editor focus change):
 *       If Glass has no file open → load directly.
 *       If Glass already has a file open → show an acceptance toast so the
 *       designer isn't interrupted mid-work. They click "Open" to switch.
 *       Same-file dedup prevents noise when the IDE re-focuses an already
 *       loaded file.
 *
 * Mount once at the App root.
 */
export function useIDEFileSync(): void {
    const setActiveFile = useCanvasStore((s) => s.setActiveFile)

    useEffect(() => {
        if (!window.flintAPI?.onIDEFileSelected) return

        const handleIDEFile = (data: unknown): void => {
            const payload = typeof data === 'string' ? { path: data } : (data as { path?: string; explicit?: boolean })
            const filePath = payload?.path
            const isExplicit = payload?.explicit === true

            if (process.env['NODE_ENV'] !== 'production') {
                console.log('[IDE-SYNC-DEBUG] Glass hook received event — filePath:', filePath, 'explicit:', isExplicit)
            }

            if (!filePath) {
                if (process.env['NODE_ENV'] !== 'production') {
                    console.log('[IDE-SYNC-DEBUG] Glass hook SKIP — no filePath in event data')
                }
                return
            }

            const currentFile = useCanvasStore.getState().activeFilePath
            const fileName = filePath.split('/').pop() ?? filePath

            // For explicit commands: always load, even if the same file is
            // already active. The user said "show this now" — honour it.
            if (!isExplicit && currentFile === filePath) {
                if (process.env['NODE_ENV'] !== 'production') {
                    console.log('[IDE-SYNC-DEBUG] Glass hook SKIP — same file already active (auto-follow dedup):', filePath)
                }
                return
            }

            if (process.env['NODE_ENV'] !== 'production') {
                console.log('[IDE-SYNC-DEBUG] Glass hook proceeding — currentFile:', currentFile, '→', filePath, isExplicit ? '(explicit)' : '(auto-follow)')
            }

            // Herald: record the event for the StatusBar chip (only on real transitions)
            if (currentFile !== filePath) {
                useCanvasStore.getState().recordIDESyncEvent(filePath)
            }

            // Explicit command or no file open yet — load immediately, no toast.
            if (isExplicit || !currentFile) {
                if (process.env['NODE_ENV'] !== 'production') {
                    console.log('[IDE-SYNC-DEBUG] Glass hook — loading directly (explicit or first file)')
                }
                loadFile(filePath)
                return
            }

            // Passive auto-follow with a file already open — show an acceptance
            // toast so the designer isn't interrupted mid-work.
            if (process.env['NODE_ENV'] !== 'production') {
                console.log('[IDE-SYNC-DEBUG] Glass hook — auto-follow toast for:', filePath)
            }
            useNotificationStore.getState().push({
                type: 'mutation',
                severity: 'info',
                title: `${fileName}`,
                message: 'Received from your IDE',
                autoDismissMs: 8000,
                actionLabel: 'Open',
                actionCallback: () => loadFile(filePath),
            })
        }

        function loadFile(filePath: string): void {
            void setActiveFile(filePath)
            const store = useCanvasStore.getState()
            store.unlockTab('governance')
            const currentTab = store.rightTab
            if (!currentTab || currentTab === 'governance') {
                store.setRightTab('governance')
            }
        }

        const unsub = window.flintAPI.onIDEFileSelected(handleIDEFile)

        return () => {
            if (typeof unsub === 'function') {
                unsub()
            }
        }
    }, [setActiveFile])
}
