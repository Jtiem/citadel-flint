/**
 * CodeEditor — src/components/editor/CodeEditor.tsx
 *
 * Monaco-based code editor wired to the Zustand editorStore.
 * Reads `rawCode` from the store and writes back via `setCode` on every
 * keystroke, triggering the automatic AST parse pipeline.
 *
 * Jump-to-line: the store exposes `jumpToLine: number | null`. When it
 * becomes non-null the editor scrolls to that 1-based line, moves the
 * cursor there, and the store resets to null so the same row can be
 * clicked again to re-trigger the jump.
 *
 * Renderer Process only — no Node.js imports.
 */

import { useEffect, useRef } from 'react'
import Editor from '@monaco-editor/react'
import type { BeforeMount, OnMount } from '@monaco-editor/react'
import { useEditorStore } from '../../store/editorStore'

type MonacoEditor = Parameters<OnMount>[0]

export function CodeEditor() {
    const rawCode = useEditorStore((state) => state.rawCode)
    const setCode = useEditorStore((state) => state.setCode)
    const jumpToLine = useEditorStore((state) => state.jumpToLine)
    const setJumpToLine = useEditorStore((state) => state.setJumpToLine)

    const editorRef = useRef<MonacoEditor | null>(null)

    // Monaco's onChange passes `string | undefined` — guard before forwarding.
    function handleChange(value: string | undefined): void {
        if (value !== undefined) {
            setCode(value)
        }
    }

    // Capture the editor instance so jump-to-line can call its API.
    const handleMount: OnMount = (editor) => {
        editorRef.current = editor
    }

    // Configure the TypeScript language service BEFORE the editor and its
    // models are created. Using beforeMount (not onMount) eliminates the race
    // condition where the TS worker calls getQuickInfoAtPosition on the
    // inmemory://model/1 URI before setCompilerOptions has run, which caused:
    // "Could not find source file: 'inmemory://model/1'"
    const handleBeforeMount: BeforeMount = (monaco) => {
        monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
            jsx: monaco.languages.typescript.JsxEmit.React,
            esModuleInterop: true,
            allowSyntheticDefaultImports: true,
        })
    }

    // Jump to source line when triggered by the Layer Tree's </> button.
    useEffect(() => {
        if (jumpToLine === null || editorRef.current === null) return
        const editor = editorRef.current
        editor.revealLineInCenter(jumpToLine)
        editor.setPosition({ lineNumber: jumpToLine, column: 1 })
        editor.focus()
        // Reset so clicking the same row again re-triggers the jump.
        setJumpToLine(null)
    }, [jumpToLine, setJumpToLine])

    return (
        <div className="h-full w-full overflow-hidden">
            <Editor
                height="100%"
                path="file:///App.tsx"
                defaultLanguage="typescript"
                value={rawCode}
                onChange={handleChange}
                beforeMount={handleBeforeMount}
                onMount={handleMount}
                theme="vs-dark"
                options={{
                    fontSize: 13,
                    fontFamily:
                        'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                    padding: { top: 12, bottom: 12 },
                    renderLineHighlight: 'line',
                    smoothScrolling: true,
                }}
            />
        </div>
    )
}
