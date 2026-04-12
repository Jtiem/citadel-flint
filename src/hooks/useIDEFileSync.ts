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

        const handleIDEFile = (data: unknown): void => {
            const filePath =
                typeof data === 'string' ? data : (data as { path?: string })?.path
            if (!filePath) return

            // Herald: record the event for the StatusBar chip
            useCanvasStore.getState().recordIDESyncEvent(filePath)

            const currentFile = useCanvasStore.getState().activeFilePath
            const fileName = filePath.split('/').pop() ?? filePath

            // If the same file is already open, do nothing
            if (currentFile === filePath) return

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
            const store = useCanvasStore.getState()
            // If the file is outside the current workspace, close the workspace
            // first to prevent the demo auto-load from fighting back.
            const ws = store.workspaceFiles
            if (ws && !filePath.startsWith(ws.path)) {
                store.closeWorkspace()
            }
            void setActiveFile(filePath)
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
