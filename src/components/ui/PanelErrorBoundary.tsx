/**
 * PanelErrorBoundary — catches render errors in Glass panels.
 *
 * React ErrorBoundaries must be class components. On error, renders a
 * recovery UI with Retry and Copy Error buttons. Errors are logged to
 * `console.error` and never swallowed silently.
 *
 * @module GLASS.2.3
 */

import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, Copy, RotateCcw } from 'lucide-react'

interface Props {
    panelName: string
    children: ReactNode
}

interface State {
    hasError: boolean
    error: Error | null
}

export class PanelErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props)
        this.state = { hasError: false, error: null }
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error }
    }

    componentDidCatch(error: Error, info: ErrorInfo): void {
        console.error(
            `[PanelErrorBoundary] Error in "${this.props.panelName}":`,
            error,
            info.componentStack,
        )
    }

    private handleRetry = () => {
        this.setState({ hasError: false, error: null })
    }

    private handleCopyError = () => {
        const message = this.state.error?.message ?? 'Unknown error'
        void navigator.clipboard.writeText(message)
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center gap-3 rounded border border-red-700/40 bg-red-900/10 p-4 text-center">
                    <AlertTriangle className="h-6 w-6 text-red-400" />
                    <p className="text-sm text-zinc-400">
                        Something went wrong in {this.props.panelName}
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={this.handleRetry}
                            className="flex items-center gap-1 rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white"
                        >
                            <RotateCcw className="h-3 w-3" />
                            Retry
                        </button>
                        <button
                            type="button"
                            onClick={this.handleCopyError}
                            className="flex items-center gap-1 rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white"
                        >
                            <Copy className="h-3 w-3" />
                            Copy Error
                        </button>
                    </div>
                </div>
            )
        }

        return this.props.children
    }
}
