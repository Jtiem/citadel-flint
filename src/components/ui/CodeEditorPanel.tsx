import React, { useRef, useEffect } from 'react'
import Editor, { useMonaco, type BeforeMount } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import { useEditorStore } from '../../store/editorStore'
import { useCanvasStore } from '../../store/canvasStore'

export const CodeEditorPanel: React.FC = () => {
    const monaco = useMonaco()
    const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)

    // Bind to the global stores
    const rawCode = useEditorStore(s => s.rawCode)
    const setCode = useEditorStore(s => s.setCode)
    const jumpToLine = useEditorStore(s => s.jumpToLine)
    const setJumpToLine = useEditorStore(s => s.setJumpToLine)

    // Display the current file path
    const activeFilePath = useCanvasStore(s => s.activeFilePath)
    const saveState = useCanvasStore(s => s.saveState)
    const fileName = activeFilePath ? activeFilePath.split('/').pop() : 'No File Open'

    // Determine language from file extension
    const extension = fileName?.split('.').pop()?.toLowerCase() || ''
    const languageMap: Record<string, string> = {
        'js': 'javascript',
        'jsx': 'javascript',
        'ts': 'typescript',
        'tsx': 'typescript',
        'css': 'css',
        'html': 'html',
        'json': 'json',
        'vue': 'vue',
        'svelte': 'svelte'
    }
    const language = languageMap[extension] || 'plaintext'

    const handleEditorDidMount = (editor: editor.IStandaloneCodeEditor) => {
        editorRef.current = editor
    }

    // Configure the TypeScript language service BEFORE the editor and its
    // models are created. Using beforeMount eliminates race conditions for inmemory models
    // and suppresses false-positive JSX parsing errors.
    const handleBeforeMount: BeforeMount = (monacoInstance) => {
        monacoInstance.languages.typescript.typescriptDefaults.setCompilerOptions({
            jsx: monacoInstance.languages.typescript.JsxEmit.React,
            esModuleInterop: true,
            allowSyntheticDefaultImports: true,
        })
    }

    // Explicit manual save trigger
    const handleSave = () => {
        if (!editorRef.current) return
        const currentCode = editorRef.current.getValue()
        // Force an immediate save without the normal 1 second typing debounce
        useCanvasStore.getState().triggerAutoSave(currentCode, 0)
    }

    // Set up a Cmd+S / Ctrl+S keybinding
    useEffect(() => {
        if (!monaco || !editorRef.current) return

        editorRef.current.addCommand(
            monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
            () => {
                handleSave()
            }
        )
    }, [monaco])

    // Handle external jump-to-line requests from the visual click-to-select
    useEffect(() => {
        if (jumpToLine !== null && editorRef.current) {
            editorRef.current.revealLineInCenter(jumpToLine)
            editorRef.current.setPosition({ lineNumber: jumpToLine, column: 1 })
            editorRef.current.focus()

            // Clear the request so it can trigger again for the same line later
            setJumpToLine(null)
        }
    }, [jumpToLine, setJumpToLine])

    return (
        <div className="flex flex-col h-full w-full bg-[#1e1e1e] border-t border-gray-800">
            {/* Minimal Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800">
                <div className="flex items-center space-x-2">
                    <span className="text-xs font-mono text-gray-400">
                        {fileName}
                    </span>
                    <span className="px-2 py-0.5 text-[10px] bg-blue-500/10 text-blue-400 rounded">
                        {language}
                    </span>
                    {saveState === 'editing' && (
                        <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse ml-2" title="Unsaved changes" />
                    )}
                    {saveState === 'saving' && (
                        <span className="text-[10px] text-gray-500 ml-2">Saving...</span>
                    )}
                </div>
                <button
                    onClick={handleSave}
                    disabled={activeFilePath === null}
                    className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Save
                </button>
            </div>

            {/* Monaco Container */}
            <div className="flex-1 relative border-t border-gray-800">
                <Editor
                    height="100%"
                    language={language}
                    theme="vs-dark"
                    value={activeFilePath ? rawCode : '// Select a file from the explorer to begin editing'}
                    onChange={(val) => {
                        if (activeFilePath && val !== undefined) {
                            setCode(val)
                        }
                    }}
                    beforeMount={handleBeforeMount}
                    onMount={handleEditorDidMount}
                    options={{
                        readOnly: activeFilePath === null,
                        minimap: { enabled: false },
                        fontSize: 13,
                        fontFamily: 'JetBrains Mono, Menlo, Monaco, Courier New, monospace',
                        smoothScrolling: true,
                        cursorBlinking: 'smooth',
                        cursorSmoothCaretAnimation: 'on',
                        formatOnPaste: true,
                        padding: { top: 16 },
                    }}
                />
            </div>
        </div>
    )
}
