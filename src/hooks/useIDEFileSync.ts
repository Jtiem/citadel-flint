import { useEffect } from 'react'
import { useCanvasStore } from '../store/canvasStore'
import { useNotificationStore } from '../store/notificationStore'

/**
 * IDE→Glass File Sync hook (Herald).
 *
 * When the VS Code / Cursor extension sends a file via "Open in Flint Glass"
 * (or auto-follow on editor focus), Glass receives it here.
 *
 * Behavior:
 *   - If Glass has no file open (LaunchScreen): load it directly
 *   - If Glass already has a file open: show an acceptance toast so the
 *     designer isn't interrupted. They click "Open" to switch.
 *
 * Mount once at the App root.
 */
export function useIDEFileSync(): void {
    const setActiveFile = useCanvasStore((s) => s.setActiveFile)

    useEffect(() => {
        if (!window.flintAPI?.onIDEFileSelected) return

        // Herald: IDE sync disabled in dev mode (self-hosting) to prevent
        // file watcher + HMR + readFile loops. The pipeline works in production
        // builds (verified via E2E tests). This guard will be removed once the
        // self-hosting readFile loop is resolved.
        if (window.location.port === '4200') return

        const handleIDEFile = (data: unknown): void => {
            const filePath =
                typeof data === 'string' ? data : (data as { path?: string })?.path
            if (!filePath) return

            const currentFile = useCanvasStore.getState().activeFilePath
            const fileName = filePath.split('/').pop() ?? filePath

            // If the same file is already open, do nothing — record the event
            // only for actual changes, not redundant reconnect pushes.
            if (currentFile === filePath) return

            // Herald: record the event for the StatusBar chip (only on real transitions)
            useCanvasStore.getState().recordIDESyncEvent(filePath)

            // If nothing is open yet, load directly — no interruption possible
            if (!currentFile) {
                loadFile(filePath)
                return
            }

            // A file is already open — show an acceptance toast
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
