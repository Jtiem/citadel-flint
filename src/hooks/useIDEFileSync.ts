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

        window.flintAPI.onIDEFileSelected((filePath: string) => {
            // Read store state directly to avoid stale closure — same pattern
            // as the file-watcher effect in App.tsx (useCanvasStore.getState()).
            const ws = useCanvasStore.getState().workspaceFiles
            if (!ws || !filePath.startsWith(ws.path)) return
            void setActiveFile(filePath)
        })

        return () => {
            window.flintAPI.removeIDEFileSelectedListener?.()
        }
    }, [setActiveFile])
}
