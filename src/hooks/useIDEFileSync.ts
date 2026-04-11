import { useEffect } from 'react'
import { useCanvasStore } from '../store/canvasStore'

/**
 * IDE→Glass File Sync hook.
 *
 * When the VS Code / Cursor extension changes the active editor, it writes the
 * new file path to `.flint/ide-active-file.json`. The Electron main process
 * polls that file and broadcasts `flint:ide-file-selected` to the renderer.
 *
 * This hook subscribes to that event and calls `setActiveFile` so Glass
 * automatically follows IDE focus — no manual Files tab interaction required.
 *
 * Mount once at the App root.
 */
export function useIDEFileSync(): void {
    const setActiveFile = useCanvasStore((s) => s.setActiveFile)

    useEffect(() => {
        if (!window.flintAPI?.onIDEFileSelected) return

        // Capture the callback reference so we can unsubscribe only this
        // instance on cleanup. Calling removeIDEFileSelectedListener() would
        // nuke every subscriber on the channel (unsubscribeAll), breaking any
        // other mounted consumers.
        const handleIDEFile = (data: unknown): void => {
            // In web mode the WS payload is the full data object { path: string };
            // in Electron mode ipcRenderer passes the string directly.
            const filePath =
                typeof data === 'string' ? data : (data as { path?: string })?.path
            if (!filePath) return
            const ws = useCanvasStore.getState().workspaceFiles
            const fileInCurrentProject = ws && filePath.startsWith(ws.path)

            // If the file is from a different project (or no project is open),
            // auto-open the project containing this file. This handles:
            //   - Right-click "Open in Flint Glass" when Glass is on LaunchScreen
            //   - IDE sends a file from workspace X while Glass has workspace Y open
            if (!fileInCurrentProject && window.flintAPI?.project?.openPath) {
                void (async () => {
                    try {
                        // Walk up from the file to find the project root
                        let projectRoot: string | null = null
                        if (window.flintAPI.project.findRootForFile) {
                            projectRoot = await window.flintAPI.project.findRootForFile(filePath)
                        }
                        // Fallback: use the file's directory
                        if (!projectRoot) {
                            projectRoot = filePath.substring(0, filePath.lastIndexOf('/'))
                        }
                        const tree = await window.flintAPI.project.openPath(projectRoot)
                        if (tree) {
                            void setActiveFile(filePath)
                        }
                    } catch {
                        void setActiveFile(filePath)
                    }
                })()
                useCanvasStore.getState().recordIDESyncEvent(filePath)
                return
            }

            void setActiveFile(filePath)
            // Herald: record the IDE sync event for the StatusBar chip
            useCanvasStore.getState().recordIDESyncEvent(filePath)
            // Unlock the governance tab so it's available, but only auto-switch
            // to it if the user hasn't manually selected a different tab.
            // This respects user intent — don't yank them away from Properties
            // or Tokens on every file change.
            const store = useCanvasStore.getState()
            store.unlockTab('governance')
            const currentTab = store.rightTab
            if (!currentTab || currentTab === 'governance') {
                store.setRightTab('governance')
            }
        }

        // onIDEFileSelected returns an unsubscribe function in web mode
        // (subscribe() → () => channelListeners.get(channel)?.delete(callback)).
        // In Electron mode it returns void, so we only call it if defined.
        const unsub = window.flintAPI.onIDEFileSelected(handleIDEFile)

        return () => {
            if (typeof unsub === 'function') {
                unsub()
            }
        }
    }, [setActiveFile])
}
