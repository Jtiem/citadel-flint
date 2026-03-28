/**
 * FileExplorer.test.tsx — src/components/ui/__tests__/FileExplorer.test.tsx
 *
 * Tests for the recursive project file tree sidebar.
 *
 * Covers:
 *   - Empty state (no folder open)
 *   - File and directory rendering
 *   - GLASS.2.1: WAI-ARIA tree semantics (role, aria-level, aria-selected, aria-expanded)
 *   - GLASS.2.1: Keyboard navigation (ArrowDown, ArrowUp, ArrowLeft, ArrowRight, Home, End, Enter)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FileExplorer } from '../FileExplorer'
import { useCanvasStore } from '../../../store/canvasStore'
import type { FileTreeNode } from '../../../types/flint-api'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockWorkspaceFiles: FileTreeNode = {
    name: 'my-project',
    path: '/tmp/my-project',
    type: 'directory',
    children: [
        {
            name: 'src',
            path: '/tmp/my-project/src',
            type: 'directory',
            children: [
                {
                    name: 'App.tsx',
                    path: '/tmp/my-project/src/App.tsx',
                    type: 'file',
                },
                {
                    name: 'index.ts',
                    path: '/tmp/my-project/src/index.ts',
                    type: 'file',
                },
            ],
        },
        {
            name: 'package.json',
            path: '/tmp/my-project/package.json',
            type: 'file',
        },
    ],
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('FileExplorer', () => {
    describe('empty state', () => {
        it('shows empty state with icon, guidance, and Open Folder button when workspaceFiles is null', () => {
            useCanvasStore.setState({ workspaceFiles: null })
            render(<FileExplorer />)
            expect(screen.getByText(/No project folder/i)).toBeDefined()
            expect(screen.getByText(/Load a project to browse its file tree/i)).toBeDefined()
            expect(screen.getByRole('button', { name: /Open Folder/i })).toBeDefined()
        })
    })

    describe('file rendering', () => {
        beforeEach(() => {
            useCanvasStore.setState({
                workspaceFiles: mockWorkspaceFiles,
                expandedFolders: new Set(['/tmp/my-project/src']),
            })
        })

        it('renders the root folder name', () => {
            render(<FileExplorer />)
            expect(screen.getByText('my-project')).toBeDefined()
        })

        it('renders directory and file names', () => {
            render(<FileExplorer />)
            expect(screen.getByText('src')).toBeDefined()
            expect(screen.getByText('App.tsx')).toBeDefined()
            expect(screen.getByText('index.ts')).toBeDefined()
            expect(screen.getByText('package.json')).toBeDefined()
        })
    })

    // ── GLASS.2.1: WAI-ARIA tree semantics ──────────────────────────────────

    describe('ARIA tree semantics', () => {
        beforeEach(() => {
            useCanvasStore.setState({
                workspaceFiles: mockWorkspaceFiles,
                expandedFolders: new Set(['/tmp/my-project/src']),
            })
        })

        it('root container has role="tree" and aria-label', () => {
            render(<FileExplorer />)
            const tree = screen.getByRole('tree')
            expect(tree).toBeDefined()
            expect(tree.getAttribute('aria-label')).toBe('Project files')
        })

        it('each node has role="treeitem"', () => {
            render(<FileExplorer />)
            const items = screen.getAllByRole('treeitem')
            // src (directory, expanded) + App.tsx + index.ts + package.json = 4
            expect(items.length).toBe(4)
        })

        it('top-level items have aria-level=1, nested items have aria-level=2', () => {
            render(<FileExplorer />)
            const items = screen.getAllByRole('treeitem')
            // src is depth=0 → aria-level=1
            expect(items[0].getAttribute('aria-level')).toBe('1')
            // App.tsx is depth=1 → aria-level=2
            expect(items[1].getAttribute('aria-level')).toBe('2')
        })

        it('directory nodes have aria-expanded, file nodes do not', () => {
            render(<FileExplorer />)
            const items = screen.getAllByRole('treeitem')
            // First item is src directory (expanded)
            expect(items[0].getAttribute('aria-expanded')).toBe('true')
            // Second item is App.tsx (file) — no aria-expanded
            expect(items[1].hasAttribute('aria-expanded')).toBe(false)
        })

        it('collapsed directory has aria-expanded=false', () => {
            useCanvasStore.setState({
                workspaceFiles: mockWorkspaceFiles,
                expandedFolders: new Set(), // nothing expanded
            })
            render(<FileExplorer />)
            const items = screen.getAllByRole('treeitem')
            // src directory is collapsed
            expect(items[0].getAttribute('aria-expanded')).toBe('false')
            // Its children should not be visible — only 2 items: src + package.json
            expect(items.length).toBe(2)
        })
    })

    // ── GLASS.2.1: Keyboard navigation ──────────────────────────────────────

    describe('keyboard navigation', () => {
        beforeEach(() => {
            useCanvasStore.setState({
                workspaceFiles: mockWorkspaceFiles,
                expandedFolders: new Set(['/tmp/my-project/src']),
                activeFilePath: null,
            })
        })

        it('ArrowDown moves focus to the next visible treeitem', () => {
            render(<FileExplorer />)
            const tree = screen.getByRole('tree')
            const items = screen.getAllByRole('treeitem')

            // Focus the first item (src directory)
            fireEvent.focus(items[0])
            // Press ArrowDown
            fireEvent.keyDown(tree, { key: 'ArrowDown' })

            // The second item should now have tabIndex=0
            expect(items[1].tabIndex).toBe(0)
        })

        it('ArrowUp moves focus to the previous visible treeitem', () => {
            render(<FileExplorer />)
            const tree = screen.getByRole('tree')
            const items = screen.getAllByRole('treeitem')

            // Focus the second item (App.tsx)
            fireEvent.focus(items[1])
            // Press ArrowUp
            fireEvent.keyDown(tree, { key: 'ArrowUp' })

            // The first item should now have tabIndex=0
            expect(items[0].tabIndex).toBe(0)
        })

        it('Home moves focus to the first treeitem', () => {
            render(<FileExplorer />)
            const tree = screen.getByRole('tree')
            const items = screen.getAllByRole('treeitem')

            // Focus the last item
            fireEvent.focus(items[items.length - 1])
            // Press Home
            fireEvent.keyDown(tree, { key: 'Home' })

            expect(items[0].tabIndex).toBe(0)
        })

        it('End moves focus to the last visible treeitem', () => {
            render(<FileExplorer />)
            const tree = screen.getByRole('tree')
            const items = screen.getAllByRole('treeitem')

            // Focus the first item
            fireEvent.focus(items[0])
            // Press End
            fireEvent.keyDown(tree, { key: 'End' })

            const lastItem = items[items.length - 1]
            expect(lastItem.tabIndex).toBe(0)
        })

        it('Enter on a file node activates it', () => {
            const setActiveFile = vi.fn()
            useCanvasStore.setState({ setActiveFile })

            render(<FileExplorer />)
            const tree = screen.getByRole('tree')
            const items = screen.getAllByRole('treeitem')

            // Focus App.tsx (index 1)
            fireEvent.focus(items[1])
            // Press Enter
            fireEvent.keyDown(tree, { key: 'Enter' })

            expect(setActiveFile).toHaveBeenCalledWith('/tmp/my-project/src/App.tsx')
        })

        it('Enter on a directory node toggles it', () => {
            const toggleFolder = vi.fn()
            useCanvasStore.setState({ toggleFolder })

            render(<FileExplorer />)
            const tree = screen.getByRole('tree')
            const items = screen.getAllByRole('treeitem')

            // Focus src directory (index 0)
            fireEvent.focus(items[0])
            // Press Enter
            fireEvent.keyDown(tree, { key: 'Enter' })

            expect(toggleFolder).toHaveBeenCalledWith('/tmp/my-project/src')
        })

        it('ArrowLeft on an expanded directory collapses it', () => {
            const toggleFolder = vi.fn()
            useCanvasStore.setState({ toggleFolder })

            render(<FileExplorer />)
            const tree = screen.getByRole('tree')
            const items = screen.getAllByRole('treeitem')

            // src directory is expanded
            expect(items[0].getAttribute('aria-expanded')).toBe('true')

            // Focus src directory
            fireEvent.focus(items[0])
            // Press ArrowLeft to collapse
            fireEvent.keyDown(tree, { key: 'ArrowLeft' })

            expect(toggleFolder).toHaveBeenCalledWith('/tmp/my-project/src')
        })

        it('ArrowRight on a collapsed directory expands it', () => {
            useCanvasStore.setState({
                workspaceFiles: mockWorkspaceFiles,
                expandedFolders: new Set(), // collapsed
            })
            const toggleFolder = vi.fn()
            useCanvasStore.setState({ toggleFolder })

            render(<FileExplorer />)
            const tree = screen.getByRole('tree')
            const items = screen.getAllByRole('treeitem')

            // src directory is collapsed
            expect(items[0].getAttribute('aria-expanded')).toBe('false')

            // Focus src directory
            fireEvent.focus(items[0])
            // Press ArrowRight to expand
            fireEvent.keyDown(tree, { key: 'ArrowRight' })

            expect(toggleFolder).toHaveBeenCalledWith('/tmp/my-project/src')
        })
    })
})
