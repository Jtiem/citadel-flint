/**
 * AgentSettingsModal.tsx — src/components/ui/AgentSettingsModal.tsx
 *
 * Settings panel for the Flint Auditor AI engine.
 * Manages:
 *   • API keys for multiple providers (stored in ~/.flint/config.json in the main process)
 *   • Provider selection (Anthropic, OpenAI, Gemini)
 *   • Model selection based on active provider
 *
 * Design: dark modal overlay, consistent with ExportModal.tsx.
 * Supports showing / masking the key and one-click model switching.
 */

import { useState, useEffect } from 'react'
import { BRAND } from '../../../shared/brand'
import { X, Key, Eye, EyeOff, Check, Loader2, ChevronDown, CheckCircle2, Globe } from 'lucide-react'
import { useOrchestratorStore } from '../../store/orchestratorStore'
import type { AIProvider } from '../../types/flint-api'

const PROVIDERS: { id: AIProvider; label: string; tag: string }[] = [
    { id: 'anthropic', label: 'Anthropic', tag: '(Full Support)' },
    { id: 'openai', label: 'OpenAI', tag: '(Chat Only)' },
    { id: 'gemini', label: 'Google Gemini', tag: '(Chat Only)' },
]

type TierType = 'fast' | 'balanced' | 'powerful'

const MODELS: Record<AIProvider, { id: string; label: string; description: string; tier: TierType }[]> = {
    anthropic: [
        {
            id: 'claude-3-5-haiku-20241022',
            label: 'Claude 3.5 Haiku',
            description: 'Fastest responses, best for high-frequency audits.',
            tier: 'fast',
        },
        {
            id: 'claude-3-5-sonnet-20241022',
            label: 'Claude 3.5 Sonnet',
            description: 'Balanced speed and reasoning.',
            tier: 'balanced',
        },
        {
            id: 'claude-3-7-sonnet-20250219',
            label: 'Claude 3.7 Sonnet',
            description: 'Latest Sonnet. Recommended.',
            tier: 'balanced',
        },
        {
            id: 'claude-opus-4-5',
            label: 'Claude Opus 4.5',
            description: 'Maximum reasoning. Best for complex cross-file refactors.',
            tier: 'powerful',
        },
    ],
    openai: [
        {
            id: 'gpt-4o-mini',
            label: 'GPT-4o Mini',
            description: 'Fast, lightweight intelligence.',
            tier: 'fast'
        },
        {
            id: 'gpt-4o',
            label: 'GPT-4o',
            description: 'Versatile, high-intelligence flagship model.',
            tier: 'balanced'
        },
        {
            id: 'o1',
            label: 'OpenAI o1',
            description: 'Deep reasoning for complex problems.',
            tier: 'powerful'
        },
        {
            id: 'o3-mini',
            label: 'OpenAI o3-mini',
            description: 'Fast code generation and reasoning.',
            tier: 'fast'
        }
    ],
    gemini: [
        {
            id: 'gemini-2.5-flash',
            label: 'Gemini 2.5 Flash',
            description: 'Fastest multimodal model for general tasks.',
            tier: 'fast'
        },
        {
            id: 'gemini-2.5-pro',
            label: 'Gemini 2.5 Pro',
            description: 'Most capable multimodal model.',
            tier: 'powerful'
        }
    ]
}

const TIER_COLORS = {
    fast: 'text-emerald-400 bg-emerald-900/20 border-emerald-700/40',
    balanced: 'text-indigo-400 bg-indigo-900/20 border-indigo-700/40',
    powerful: 'text-purple-400 bg-purple-900/20 border-purple-700/40',
}

const TIER_LABELS = {
    fast: '⚡ Fast',
    balanced: '⚖️ Balanced',
    powerful: '🧠 Powerful',
}

interface AgentSettingsModalProps {
    onClose: () => void
}

export function AgentSettingsModal({ onClose }: AgentSettingsModalProps) {
    const currentProvider = useOrchestratorStore((s) => s.currentProvider) ?? 'anthropic'
    const currentModel = useOrchestratorStore((s) => s.currentModel)
    const currentBaseURL = useOrchestratorStore((s) => s.currentBaseURL)
    const hasConfig = useOrchestratorStore((s) => s.hasConfig)
    const saveSettings = useOrchestratorStore((s) => s.saveSettings)

    const [selectedProvider, setSelectedProvider] = useState<AIProvider>(currentProvider)
    const [apiKey, setApiKey] = useState('')
    const [keyVisible, setKeyVisible] = useState(false)
    const [selectedModel, setSelectedModel] = useState(currentModel ?? MODELS[selectedProvider][0].id)
    const [customBaseURL, setCustomBaseURL] = useState(currentBaseURL ?? '')
    const [advancedOpen, setAdvancedOpen] = useState(!!currentBaseURL)

    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Reset model selection when provider changes
    useEffect(() => {
        if (selectedProvider === currentProvider && currentModel) {
            setSelectedModel(currentModel)
        } else {
            setSelectedModel(MODELS[selectedProvider][0].id)
        }
        setApiKey('') // Clear key input on provider switch
    }, [selectedProvider, currentProvider, currentModel])

    // Close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [onClose])

    const handleSave = async () => {
        setError(null)
        if (!hasConfig && !apiKey.trim()) {
            setError('An API key is required the first time.')
            return
        }
        // Validate custom URL if provided
        if (customBaseURL.trim()) {
            try { new URL(customBaseURL.trim()) } catch {
                setError('Custom endpoint must be a valid URL (e.g. https://gateway.example.com/v1)')
                return
            }
        }
        setSaving(true)
        try {
            await saveSettings({
                provider: selectedProvider,
                ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
                model: selectedModel,
                baseURL: customBaseURL.trim() || undefined,
            })
            setSaved(true)
            setTimeout(() => { setSaved(false); onClose() }, 900)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save settings.')
        } finally {
            setSaving(false)
        }
    }

    const currentModels = MODELS[selectedProvider]
    const keyPrefix = selectedProvider === 'openai' ? 'sk-proj-…' : selectedProvider === 'anthropic' ? 'sk-ant-…' : 'AIza…'

    return (
        /* Backdrop */
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/80 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        >
            <div className="relative w-full max-w-md max-h-[90vh] flex flex-col rounded-xl border border-gray-700 bg-gray-900 shadow-2xl ring-1 ring-white/5">
                {/* Header */}
                <div className="flex shrink-0 items-center justify-between border-b border-gray-800 px-5 py-4">
                    <div>
                        <h2 className="text-sm font-semibold text-gray-100">AI Settings</h2>
                        <p className="mt-0.5 text-[11px] text-gray-500">{BRAND.product} Auditor Configuration</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-zinc-500 transition-colors hover:text-zinc-300"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-5 p-5">
                    {/* Provider Selection */}
                    <div>
                        <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-gray-400">
                            <ChevronDown className="h-3 w-3" />
                            Provider
                        </label>
                        <div className="flex gap-2">
                            {PROVIDERS.map((p) => (
                                <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => setSelectedProvider(p.id)}
                                    className={`flex-1 rounded border px-2 py-2 text-[11px] font-medium transition-colors ${selectedProvider === p.id
                                        ? 'border-indigo-500/50 bg-indigo-900/30 text-indigo-300'
                                        : 'border-gray-800 bg-gray-800/30 text-gray-400 hover:border-gray-700 hover:text-gray-300'
                                        }`}
                                >
                                    {p.label}
                                    <div className="font-normal text-[10px] text-zinc-400 mt-0.5">{p.tag}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* API Key Section */}
                    <div>
                        <label className="mb-1.5 flex items-center justify-between text-[11px] font-medium text-gray-400">
                            <span className="flex items-center gap-1.5">
                                <Key className="h-3 w-3" />
                                {PROVIDERS.find(p => p.id === selectedProvider)?.label} API Key
                            </span>
                            {selectedProvider === currentProvider && hasConfig && (
                                <span className="flex items-center gap-1 text-[10px] text-emerald-500/80">
                                    <CheckCircle2 className="h-3 w-3" /> Active
                                </span>
                            )}
                        </label>
                        <div className="relative">
                            <input
                                type={keyVisible ? 'text' : 'password'}
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder={selectedProvider === currentProvider && hasConfig ? '••••••••  (key already saved — leave blank to keep)' : keyPrefix}
                                className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 pr-9 text-xs text-gray-200 placeholder-gray-600 outline-none transition-colors focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30"
                            />
                            <button
                                type="button"
                                onClick={() => setKeyVisible((v) => !v)}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                            >
                                {keyVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                        </div>
                        <p className="mt-1 text-[10px] text-zinc-500">
                            Stored locally in <code className="text-zinc-400">~/.flint/config.json</code>
                        </p>
                    </div>

                    {/* Model Selection */}
                    <div>
                        <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-gray-400">
                            <ChevronDown className="h-3 w-3" />
                            Model
                        </label>
                        <div className="space-y-1.5">
                            {currentModels.map((m) => {
                                const isSelected = selectedModel === m.id
                                return (
                                    <button
                                        key={m.id}
                                        type="button"
                                        onClick={() => setSelectedModel(m.id)}
                                        className={`flex w-full items-start gap-3 rounded border px-3 py-2.5 text-left transition-colors ${isSelected
                                            ? 'border-indigo-500/50 bg-indigo-950/40'
                                            : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                                            }`}
                                    >
                                        {/* Selection indicator */}
                                        <div className={`mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border ${isSelected ? 'border-indigo-500 bg-indigo-600' : 'border-gray-600'
                                            }`}>
                                            {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[11px] font-medium ${isSelected ? 'text-gray-100' : 'text-gray-300'}`}>
                                                    {m.label}
                                                </span>
                                                <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${TIER_COLORS[m.tier]}`}>
                                                    {TIER_LABELS[m.tier]}
                                                </span>
                                            </div>
                                            <p className="mt-0.5 text-[10px] text-gray-500">{m.description}</p>
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Advanced Settings */}
                    <div className="rounded border border-gray-800 bg-gray-800/20">
                        <button
                            type="button"
                            onClick={() => setAdvancedOpen((v) => !v)}
                            className="flex w-full items-center justify-between px-3 py-2.5 text-left"
                        >
                            <span className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500">
                                <Globe className="h-3 w-3" />
                                Advanced
                                {customBaseURL.trim() && (
                                    <span className="rounded bg-amber-900/30 border border-amber-700/40 px-1.5 py-0.5 text-[10px] text-amber-400">Custom Endpoint Active</span>
                                )}
                            </span>
                            <ChevronDown className={`h-3 w-3 text-zinc-500 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {advancedOpen && (
                            <div className="border-t border-gray-800 px-3 pb-3 pt-2.5 space-y-1.5">
                                <label className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400">
                                    Custom API Base URL
                                </label>
                                <input
                                    type="url"
                                    value={customBaseURL}
                                    onChange={(e) => setCustomBaseURL(e.target.value)}
                                    placeholder="https://gateway.cloudflare.com/v1/..."
                                    className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-xs text-gray-200 placeholder-gray-600 outline-none transition-colors focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/20"
                                />
                                <p className="text-[10px] text-zinc-500">
                                    Override the API endpoint for Cloudflare AI Gateway, Helicone, or any OpenAI-compatible proxy. Leave blank to use the provider's default.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Error */}
                    {error && (
                        <p className="rounded border border-red-700/40 bg-red-900/20 px-3 py-2 text-[11px] text-red-400">
                            {error}
                        </p>
                    )}
                </div>

                {/* Footer */}
                <div className="flex shrink-0 items-center justify-end gap-2 border-t border-gray-800 px-5 py-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-3 py-1.5 text-[11px] text-gray-500 transition-colors hover:text-gray-300"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={() => void handleSave()}
                        disabled={saving || saved}
                        className="flex items-center gap-1.5 rounded bg-indigo-600 px-4 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {saved
                            ? <><Check className="h-3 w-3 text-emerald-300" /> Saved</>
                            : saving
                                ? <><Loader2 className="h-3 w-3 animate-spin" /> Saving…</>
                                : 'Save Changes'
                        }
                    </button>
                </div>
            </div>
        </div>
    )
}
