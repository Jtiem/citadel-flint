import { useEffect, useRef } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from '@xterm/addon-fit'
import 'xterm/css/xterm.css'
import { useCanvasStore } from '../../store/canvasStore'

export function TerminalPanel() {
    const terminalRef = useRef<HTMLDivElement>(null)
    const xtermRef = useRef<Terminal | null>(null)
    const fitAddonRef = useRef<FitAddon | null>(null)
    const cwd = useCanvasStore((s) => s.workspaceFiles?.path)

    useEffect(() => {
        if (!terminalRef.current || !cwd) return

        const terminal = new Terminal({
            theme: {
                background: '#030712', // Match Bridge IDE background
                foreground: '#e5e7eb',
                cursor: '#818cf8',
            },
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
            fontSize: 13,
            cursorBlink: true,
            allowProposedApi: true,
        })
        const fitAddon = new FitAddon()
        terminal.loadAddon(fitAddon)

        let observer: ResizeObserver | null = null
        let onDataDisposable: { dispose: () => void } | null = null
        let removeOutputListener: (() => void) | null = null

        const timer = setTimeout(() => {
            if (!terminalRef.current) return

            terminal.open(terminalRef.current)

            try {
                fitAddon.fit()
            } catch (e) {
                console.warn('xterm fitAddon failed to fit on open', e)
            }

            xtermRef.current = terminal
            fitAddonRef.current = fitAddon

            // Spawn Native Process via IPC
            void window.bridgeAPI.terminal.spawn(cwd)

            // Web -> Node: On Keystroke
            onDataDisposable = terminal.onData((data) => {
                void window.bridgeAPI.terminal.write(data)
            })

            // Node -> Web: On Output
            removeOutputListener = window.bridgeAPI.terminal.onOutput((data) => {
                terminal.write(data)
            })

            const handleResize = () => {
                try {
                    fitAddon.fit()
                    const dims = fitAddon.proposeDimensions()
                    if (dims && dims.cols && dims.rows) {
                        void window.bridgeAPI.terminal.resize(dims.cols, dims.rows)
                    }
                } catch (e) {
                    // Ignore dimensions errors if the element is not visible yet
                }
            }

            observer = new ResizeObserver(() => {
                // Debounce slighty to avoid RAF loop crashes in xterm
                requestAnimationFrame(handleResize)
            })
            observer.observe(terminalRef.current)
        }, 100)

        return () => {
            clearTimeout(timer)
            observer?.disconnect()
            onDataDisposable?.dispose()
            removeOutputListener?.()
            terminal.dispose()
        }
    }, [cwd])
    return (
        <div className="h-full w-full overflow-hidden p-2">
            <div className="h-full w-full" ref={terminalRef} />
        </div>
    )
}
