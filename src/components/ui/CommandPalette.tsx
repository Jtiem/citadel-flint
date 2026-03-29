/**
 * CommandPalette.tsx — Phase CP.1
 *
 * Raycast-style ⌘K command palette for Flint Glass.
 *
 * Surfaces: governance actions, canvas navigation, registry search,
 * git/recovery operations, and settings shortcuts in a single
 * keyboard-driven overlay.
 *
 * Renderer process only — no Node.js imports. All cross-boundary calls
 * route through `window.flintAPI` or Zustand store actions.
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
    Search,
    Shield,
    GitBranch,
    Settings,
    Loader2,
    LayoutGrid,
    Zap,
    RotateCcw,
    History,
    Bot,
    RefreshCw,
    Plug,
    Download,
    X,
} from 'lucide-react'
import { useCanvasStore } from '../../store/canvasStore'
import { useEditorStore } from '../../store/editorStore'
import { useNotificationStore } from '../../store/notificationStore'
import { applyUndo } from '../../core/recoveryController'
import type { MCPCallResult } from '../../types/flint-api'

// ── Types ─────────────────────────────────────────────────────────────────────

type CommandCategory = 'assets' | 'governance' | 'canvas' | 'git' | 'settings'

interface PaletteCommand {
    id: string
    label: string
    category: CommandCategory
    kbd?: string
    icon: React.ReactNode
    action: () => void | Promise<void>
}

interface RegistryResult {
    name: string
    importPath: string
    description?: string
}

// ── Category display ──────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<CommandCategory, string> = {
    assets: 'Assets',
    governance: 'Governance',
    canvas: 'Canvas',
    git: 'Git / Recovery',
    settings: 'Settings & Tools',
}

// ── Shadow Storybook parser ───────────────────────────────────────────────────

function parseRegistryMarkdown(markdown: string): RegistryResult[] {
    const results: RegistryResult[] = []
    const sections = markdown.split(/\n(?=### )/)
    for (const section of sections) {
        const heading = section.match(/^### (.+)/)
        if (!heading) continue
        const name = heading[1].trim()
        const importMatch = section.match(/\*\*Import\*\*:\s*`([^`]+)`/)
        if (!importMatch) continue
        const importPath = importMatch[1].trim()
        const descLine = section
            .split('\n')
            .slice(1)
            .map((l) => l.trim())
            .find((l) => l.length > 0 && !l.startsWith('**') && !l.startsWith('---') && !l.startsWith('#'))
        results.push({ name, importPath, description: descLine })
    }
    return results
}

// ── Component ─────────────────────────────────────────────────────────────────

export interface CommandPaletteProps {
    onOpenExportModal: () => void
    onOpenGovernancePanel: () => void
    /** Opens the Garrison setup wizard / IDE reconnect flow */
    onOpenSetupWizard?: () => void
}

export function CommandPalette({ onOpenExportModal, onOpenGovernancePanel, onOpenSetupWizard }: CommandPaletteProps) {
    const isOpen = useCanvasStore((s) => s.commandPaletteOpen)
    const setOpen = useCanvasStore((s) => s.setCommandPaletteOpen)
    const setRightTab = useCanvasStore((s) => s.setRightTab)
    const autopilotEnabled = useCanvasStore((s) => s.autopilotEnabled)
    const setAutopilotEnabled = useCanvasStore((s) => s.setAutopilotEnabled)
    const activeFilePath = useCanvasStore((s) => s.activeFilePath)

    const pushNotification = useNotificationStore((s) => s.push)

    const [query, setQuery] = useState('')
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [registryResults, setRegistryResults] = useState<RegistryResult[] | null>(null)
    const [registryLoading, setRegistryLoading] = useState(false)

    const inputRef = useRef<HTMLInputElement>(null)
    const listRef = useRef<HTMLDivElement>(null)
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // ── Close and run ─────────────────────────────────────────────────────────

    const closeAndRun = useCallback(
        (action: () => void | Promise<void>) => {
            setOpen(false)
            // Let the modal unmount before side-effecting the rest of the UI
            setTimeout(() => { void action() }, 60)
        },
        [setOpen],
    )

    // ── MCP tool helper ───────────────────────────────────────────────────────

    const callMcp = useCallback(
        async (tool: string, params: Record<string, unknown>, successTitle: string) => {
            if (!window.flintAPI?.mcp) {
                pushNotification({
                    type: 'info',
                    severity: 'error',
                    title: 'MCP not connected',
                    message: 'Start the Flint MCP server and try again',
                    autoDismissMs: 4000,
                })
                return
            }
            try {
                const result: MCPCallResult = await window.flintAPI.mcp.callTool(tool, params)
                if (result.isError) {
                    pushNotification({ type: 'info', severity: 'error', title: `${tool} failed`, message: '', autoDismissMs: 4000 })
                } else {
                    pushNotification({ type: 'mutation', severity: 'success', title: successTitle, message: '', autoDismissMs: 3000 })
                }
            } catch {
                pushNotification({ type: 'info', severity: 'error', title: `${tool} failed`, message: '', autoDismissMs: 4000 })
            }
        },
        [pushNotification],
    )

    // ── Static command catalog ────────────────────────────────────────────────

    const staticCommands = useMemo<PaletteCommand[]>(
        () => [
            // ── Governance ───────────────────────────────────────────────────
            {
                id: 'gov-audit',
                label: 'Run Audit on Current File',
                category: 'governance',
                icon: <Shield className="h-4 w-4" />,
                action: () => closeAndRun(async () => {
                    if (!activeFilePath) {
                        pushNotification({ type: 'info', severity: 'warning', title: 'No file open', message: 'Open a component first', autoDismissMs: 3000 })
                        return
                    }
                    // SEC.3: use flint_audit (allowlisted) rather than audit_ui_component (not in RENDERER_ALLOWED_MCP_TOOLS)
                    await callMcp('flint_audit', { path: activeFilePath }, 'Audit complete')
                }),
            },
            {
                id: 'gov-fix',
                label: 'Auto-fix Tier-1 Violations',
                category: 'governance',
                icon: <Zap className="h-4 w-4" />,
                action: () => closeAndRun(async () => {
                    if (!activeFilePath) {
                        pushNotification({ type: 'info', severity: 'warning', title: 'No file open', message: 'Open a component first', autoDismissMs: 3000 })
                        return
                    }
                    // Use applyBatch for auto-fix (flint_fix is not in SEC.3 renderer allowlist)
                    const warnings = useEditorStore.getState().linterWarnings
                    const fixOps: Array<{ op: string; nodeId: string; hardcodedClass: string; tokenClass: string }> = []
                    for (const [nodeId, w] of warnings) {
                        if (!w.nearestToken) continue
                        const m = w.message.match(/`([^`]+)`/)
                        if (m?.[1]) fixOps.push({ op: 'applyTokenFix', nodeId, hardcodedClass: m[1], tokenClass: w.nearestToken })
                    }
                    if (fixOps.length === 0) {
                        pushNotification({ type: 'info', severity: 'info', title: 'Nothing to fix', message: 'No auto-fixable violations found', autoDismissMs: 3000 })
                        return
                    }
                    await useEditorStore.getState().applyBatch(fixOps)
                    pushNotification({ type: 'info', severity: 'success', title: `Fixed ${fixOps.length} violations`, message: 'Auto-fixable token drifts resolved', autoDismissMs: 4000 })
                }),
            },
            {
                id: 'gov-export',
                label: 'Export Component…',
                category: 'governance',
                icon: <Download className="h-4 w-4" />,
                action: () => closeAndRun(onOpenExportModal),
            },
            {
                id: 'gov-health',
                label: 'View Health Score',
                category: 'governance',
                icon: <Shield className="h-4 w-4" />,
                action: () => closeAndRun(() => setRightTab('governance')),
            },
            {
                id: 'gov-autopilot',
                label: autopilotEnabled ? 'Disable Governance Autopilot' : 'Enable Governance Autopilot',
                category: 'governance',
                kbd: '⌘⇧G',
                icon: <Zap className="h-4 w-4" />,
                action: () => closeAndRun(() => setAutopilotEnabled(!autopilotEnabled)),
            },
            {
                id: 'gov-rules',
                label: 'Open Governance Rules',
                category: 'governance',
                icon: <Settings className="h-4 w-4" />,
                action: () => closeAndRun(onOpenGovernancePanel),
            },

            // ── Git / Recovery ───────────────────────────────────────────────
            {
                id: 'git-recovery',
                label: 'Open Git Time Machine',
                category: 'git',
                icon: <History className="h-4 w-4" />,
                action: () => closeAndRun(() => setRightTab('governance')),
            },
            {
                id: 'git-undo',
                label: 'Undo Last Mutation',
                category: 'git',
                kbd: '⌘Z',
                icon: <RotateCcw className="h-4 w-4" />,
                action: () => closeAndRun(() => {
                    const desc = applyUndo()
                    if (desc) {
                        pushNotification({
                            type: 'undo',
                            title: 'Undone',
                            message: typeof desc === 'string' ? desc : 'Change undone',
                            severity: 'info',
                            autoDismissMs: 2500,
                        })
                    }
                }),
            },
            {
                id: 'git-history',
                label: 'View Mutation History',
                category: 'git',
                icon: <GitBranch className="h-4 w-4" />,
                action: () => closeAndRun(() => setRightTab('governance')),
            },

            // ── Settings / Tools ─────────────────────────────────────────────
            {
                id: 'settings-agents',
                label: 'Open Agent Dashboard',
                category: 'settings',
                icon: <Bot className="h-4 w-4" />,
                action: () => closeAndRun(() => setRightTab('governance')),
            },
            {
                id: 'settings-reindex',
                label: 'Reindex Project Registry',
                category: 'settings',
                icon: <RefreshCw className="h-4 w-4" />,
                action: () => closeAndRun(async () => {
                    try {
                        await window.flintAPI.registry?.reindex?.()
                        pushNotification({ type: 'mutation', severity: 'success', title: 'Registry reindexed', message: '', autoDismissMs: 3000 })
                    } catch {
                        pushNotification({ type: 'info', severity: 'error', title: 'Reindex failed', message: '', autoDismissMs: 4000 })
                    }
                }),
            },
            {
                id: 'settings-reconnect-ide',
                label: 'Reconnect IDE / Setup',
                category: 'settings',
                icon: <Plug className="h-4 w-4" />,
                action: () => closeAndRun(() => {
                    if (onOpenSetupWizard) {
                        onOpenSetupWizard()
                    } else {
                        // Fallback: fire-and-forget MCP reconnect (mirrors StatusBar behaviour)
                        window.flintAPI.mcp?.reconnect?.()
                            .catch(() => { /* reconnect is fire-and-forget */ })
                    }
                }),
            },
        ],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [activeFilePath, autopilotEnabled, closeAndRun],
    )

    // ── Registry search ───────────────────────────────────────────────────────

    useEffect(() => {
        if (debounceRef.current !== null) clearTimeout(debounceRef.current)

        if (query.length < 2) {
            setRegistryResults(null)
            setRegistryLoading(false)
            return
        }

        setRegistryLoading(true)
        debounceRef.current = setTimeout(async () => {
            try {
                if (!window.flintAPI?.mcp) {
                    setRegistryResults([])
                    setRegistryLoading(false)
                    return
                }
                const res: MCPCallResult = await window.flintAPI.mcp.callTool(
                    'flint_query_registry',
                    { query, limit: 5 },
                )
                if (res.isError) {
                    setRegistryResults([])
                } else {
                    const text = res.content[0]?.text ?? ''
                    setRegistryResults(parseRegistryMarkdown(text))
                }
            } catch {
                setRegistryResults([])
            } finally {
                setRegistryLoading(false)
            }
        }, 280)

        return () => {
            if (debounceRef.current !== null) clearTimeout(debounceRef.current)
        }
    }, [query])

    // ── Filtered commands ─────────────────────────────────────────────────────

    const filteredCommands = useMemo(() => {
        if (!query.trim()) return staticCommands
        const lower = query.toLowerCase()
        return staticCommands.filter((c) => c.label.toLowerCase().includes(lower))
    }, [staticCommands, query])

    // ── Build flat list for keyboard nav ──────────────────────────────────────

    type FlatItem =
        | { kind: 'registry'; result: RegistryResult; index: number }
        | { kind: 'command'; command: PaletteCommand; index: number }

    const flatItems = useMemo<FlatItem[]>(() => {
        const items: FlatItem[] = []
        if (registryResults && registryResults.length > 0) {
            registryResults.forEach((r, i) => items.push({ kind: 'registry', result: r, index: items.length + i }))
        }
        filteredCommands.forEach((c) => items.push({ kind: 'command', command: c, index: items.length }))
        return items.map((item, i) => ({ ...item, index: i }))
    }, [registryResults, filteredCommands])

    // ── Keep selectedIndex in bounds ──────────────────────────────────────────

    useEffect(() => {
        setSelectedIndex(0)
    }, [query])

    useEffect(() => {
        if (selectedIndex >= flatItems.length && flatItems.length > 0) {
            setSelectedIndex(flatItems.length - 1)
        }
    }, [flatItems, selectedIndex])

    // ── Scroll selected item into view ────────────────────────────────────────

    useEffect(() => {
        const list = listRef.current
        if (!list) return
        const selected = list.querySelector('[data-selected="true"]') as HTMLElement | null
        selected?.scrollIntoView({ block: 'nearest' })
    }, [selectedIndex])

    // ── Focus input on open ───────────────────────────────────────────────────

    useEffect(() => {
        if (isOpen) {
            setQuery('')
            setSelectedIndex(0)
            setRegistryResults(null)
            setTimeout(() => inputRef.current?.focus(), 30)
        }
    }, [isOpen])

    // ── Keyboard navigation ───────────────────────────────────────────────────

    useEffect(() => {
        function handleKey(e: KeyboardEvent): void {
            if (!isOpen) return

            if (e.key === 'Escape') {
                e.preventDefault()
                setOpen(false)
                return
            }

            if (e.key === 'ArrowDown') {
                e.preventDefault()
                setSelectedIndex((i) => Math.min(i + 1, flatItems.length - 1))
                return
            }

            if (e.key === 'ArrowUp') {
                e.preventDefault()
                setSelectedIndex((i) => Math.max(i - 1, 0))
                return
            }

            if (e.key === 'Enter') {
                e.preventDefault()
                const item = flatItems[selectedIndex]
                if (!item) return
                if (item.kind === 'registry') {
                    handleInsertComponent(item.result)
                } else {
                    void item.command.action()
                }
            }
        }

        window.addEventListener('keydown', handleKey, { capture: true })
        return () => window.removeEventListener('keydown', handleKey, { capture: true })
    }, [isOpen, flatItems, selectedIndex, setOpen])

    // ── Insert registry component ─────────────────────────────────────────────

    function handleInsertComponent(result: RegistryResult): void {
        const { selectedNodeId, injectComponent } = useEditorStore.getState()
        if (selectedNodeId === null) {
            setOpen(false)
            pushNotification({
                type: 'info',
                severity: 'warning',
                title: 'Select a layer first',
                message: 'Click a node on the canvas, then insert.',
                autoDismissMs: 3000,
            })
            return
        }
        injectComponent(selectedNodeId, `<${result.name} />`, `import { ${result.name} } from '${result.importPath}';`)
        setOpen(false)
        pushNotification({
            type: 'mutation',
            severity: 'success',
            title: `${result.name} inserted`,
            message: 'Component added — Cmd+Z to undo',
            autoDismissMs: 2500,
        })
    }

    // ── Group commands by category (only for rendering) ───────────────────────

    const groupedCommands = useMemo(() => {
        const groups: { category: CommandCategory; commands: PaletteCommand[] }[] = []
        const seen = new Set<CommandCategory>()
        for (const cmd of filteredCommands) {
            if (!seen.has(cmd.category)) {
                seen.add(cmd.category)
                groups.push({ category: cmd.category, commands: [] })
            }
            groups[groups.length - 1].commands.push(cmd)
        }
        return groups
    }, [filteredCommands])

    // ── Compute the flat index for a command (for selected highlighting) ──────

    function flatIndexForCommand(cmd: PaletteCommand): number {
        return flatItems.findIndex((item) => item.kind === 'command' && item.command.id === cmd.id)
    }

    function flatIndexForRegistry(result: RegistryResult): number {
        return flatItems.findIndex((item) => item.kind === 'registry' && item.result.name === result.name)
    }

    if (!isOpen) return null

    return createPortal(
        <div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh]"
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={() => setOpen(false)}
                aria-hidden="true"
            />

            {/* Palette card */}
            <div
                className="relative z-10 w-full max-w-[560px] mx-4 rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Search row */}
                <div className="flex items-center gap-2.5 border-b border-zinc-800 px-4 py-3">
                    <Search className="h-4 w-4 shrink-0 text-zinc-400" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search commands and components…"
                        className="flex-1 bg-transparent text-sm text-zinc-100 placeholder-zinc-500 outline-none"
                        aria-label="Command search"
                        aria-autocomplete="list"
                        aria-controls="command-palette-list"
                    />
                    {registryLoading && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-zinc-500" />}
                    <button
                        type="button"
                        onClick={() => setOpen(false)}
                        aria-label="Close command palette"
                        className="text-zinc-600 hover:text-zinc-400 transition-colors"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>

                {/* Results */}
                <div
                    ref={listRef}
                    id="command-palette-list"
                    role="listbox"
                    aria-label="Commands"
                    className="max-h-[400px] overflow-y-auto py-2"
                >
                    {/* Registry results (at the top when query active) */}
                    {registryResults && registryResults.length > 0 && (
                        <div>
                            <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                                Assets
                            </div>
                            {registryResults.map((result) => {
                                const fi = flatIndexForRegistry(result)
                                const isSelected = fi === selectedIndex
                                return (
                                    <button
                                        key={result.name}
                                        type="button"
                                        role="option"
                                        aria-selected={isSelected}
                                        data-selected={isSelected}
                                        onClick={() => handleInsertComponent(result)}
                                        className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors ${
                                            isSelected ? 'bg-indigo-600/20 text-white' : 'text-zinc-200 hover:bg-zinc-800'
                                        }`}
                                    >
                                        <span className={`shrink-0 ${isSelected ? 'text-indigo-400' : 'text-zinc-500'}`}>
                                            <LayoutGrid className="h-4 w-4" />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-sm font-medium">{result.name}</span>
                                            {result.description && (
                                                <span className="block truncate text-[11px] text-zinc-500">
                                                    {result.description}
                                                </span>
                                            )}
                                        </span>
                                        <span className="shrink-0 rounded bg-indigo-900/50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-400">
                                            Insert
                                        </span>
                                    </button>
                                )
                            })}
                        </div>
                    )}

                    {/* Registry empty state (when query active, MCP responded, no results) */}
                    {query.length >= 2 && registryResults !== null && registryResults.length === 0 && !registryLoading && (
                        <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                            Assets — no matches
                        </div>
                    )}

                    {/* Static command groups */}
                    {groupedCommands.length > 0 ? (
                        groupedCommands.map(({ category, commands }) => (
                            <div key={category}>
                                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                                    {CATEGORY_LABELS[category]}
                                </div>
                                {commands.map((cmd) => {
                                    const fi = flatIndexForCommand(cmd)
                                    const isSelected = fi === selectedIndex
                                    return (
                                        <button
                                            key={cmd.id}
                                            type="button"
                                            role="option"
                                            aria-selected={isSelected}
                                            data-selected={isSelected}
                                            onClick={() => void cmd.action()}
                                            className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors ${
                                                isSelected ? 'bg-indigo-600/20 text-white' : 'text-zinc-200 hover:bg-zinc-800'
                                            }`}
                                        >
                                            <span className={`shrink-0 ${isSelected ? 'text-indigo-400' : 'text-zinc-500'}`}>
                                                {cmd.icon}
                                            </span>
                                            <span className="flex-1 text-sm">{cmd.label}</span>
                                            {cmd.kbd && (
                                                <span className="shrink-0 font-mono text-[10px] text-zinc-600">
                                                    {cmd.kbd}
                                                </span>
                                            )}
                                        </button>
                                    )
                                })}
                            </div>
                        ))
                    ) : (
                        !registryLoading && (
                            <div className="px-4 py-8 text-center text-sm text-zinc-500">
                                No commands match &ldquo;{query}&rdquo;
                            </div>
                        )
                    )}
                </div>

                {/* Footer hint */}
                <div className="flex items-center gap-4 border-t border-zinc-800 px-4 py-2 text-[10px] text-zinc-600">
                    <span><kbd className="font-mono">↑↓</kbd> navigate</span>
                    <span><kbd className="font-mono">↵</kbd> select</span>
                    <span><kbd className="font-mono">Esc</kbd> close</span>
                    <span className="ml-auto opacity-50">⌘K</span>
                </div>
            </div>
        </div>,
        document.body,
    )
}
