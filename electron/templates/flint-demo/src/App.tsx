import { useState } from 'react'

// ── Stat Card ─────────────────────────────────────────────────────────────────
interface StatCardProps {
  label: string
  value: string
  change: string
  accent?: string
}

function StatCard({ label, value, change, accent = 'text-emerald-400' }: StatCardProps) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-white">{value}</p>
      <p className={`mt-1 text-xs ${accent}`}>{change}</p>
    </div>
  )
}

// ── Activity Feed ─────────────────────────────────────────────────────────────
const ACTIVITY_ITEMS = [
  { id: 'a1', text: 'AST surgery on Button.tsx', tag: 'AST' },
  { id: 'a2', text: 'Token sync received from Figma plugin', tag: 'Sync' },
  { id: 'a3', text: 'Cross-file drag: Card → Layout.tsx', tag: 'Move' },
  { id: 'a4', text: 'ΔE drift corrected — indigo-600 → indigo-500', tag: 'Mithril' },
  { id: 'a5', text: 'Atomic save: FileTransactionManager committed', tag: 'Save' },
]

function ActivityFeed() {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <h2 className="mb-4 text-sm font-semibold text-white">Recent Activity</h2>
      <div className="space-y-3">
        {ACTIVITY_ITEMS.map((item) => (
          <div key={item.id} className="flex items-center gap-3">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
            <span className="flex-1 text-sm text-gray-400">{item.text}</span>
            <span className="rounded-full border border-gray-700 bg-gray-800 px-2 py-0.5 text-[10px] font-medium text-gray-500">
              {item.tag}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Component Library Preview ─────────────────────────────────────────────────
const COMPONENTS = [
  { id: 'c1', name: 'Button', variants: 3, status: 'Clean' },
  { id: 'c2', name: 'Card', variants: 2, status: 'Clean' },
  { id: 'c3', name: 'StatCard', variants: 1, status: 'Clean' },
  { id: 'c4', name: 'Sidebar', variants: 1, status: 'Clean' },
]

function ComponentLibrary() {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <h2 className="mb-4 text-sm font-semibold text-white">Component Library</h2>
      <div className="divide-y divide-gray-800">
        {COMPONENTS.map((comp) => (
          <div key={comp.id} className="flex items-center justify-between py-2.5">
            <div>
              <p className="text-sm font-medium text-gray-300">{comp.name}</p>
              <p className="text-xs text-gray-600">{comp.variants} variant{comp.variants > 1 ? 's' : ''}</p>
            </div>
            <span className="rounded-full bg-emerald-900/40 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
              {comp.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
const NAV_ITEMS = ['Dashboard', 'Components', 'Tokens', 'Activity', 'Settings']

function Sidebar() {
  const [active, setActive] = useState('Dashboard')

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-gray-800 bg-gray-950 p-4">
      <div className="mb-6">
        <h2 className="text-sm font-bold tracking-tight text-white">Flint Demo</h2>
        <p className="text-xs text-gray-600">Agentic UI OS · v5.7</p>
      </div>
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setActive(item)}
            className={`rounded-lg px-3 py-2 text-left text-sm transition-colors ${
              active === item
                ? 'bg-indigo-600/20 text-indigo-400'
                : 'text-gray-500 hover:bg-gray-800 hover:text-gray-300'
            }`}
          >
            {item}
          </button>
        ))}
      </nav>
      <div className="mt-auto rounded-lg border border-indigo-500/20 bg-indigo-600/10 p-3">
        <p className="text-xs font-medium text-indigo-400">Mithril Status</p>
        <p className="mt-0.5 text-xs text-gray-500">ΔE drift: 0.00 · Clean</p>
      </div>
    </aside>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────
const STATS: StatCardProps[] = [
  { label: 'Components', value: '24', change: '+4 this week' },
  { label: 'Token Syncs', value: '138', change: '+12 today' },
  { label: 'ΔE Violations', value: '0', change: 'Mithril Clean' },
  { label: 'AST Mutations', value: '1,204', change: 'All atomic', accent: 'text-indigo-400' },
]

export default function App() {
  return (
    <div className="flex h-screen bg-gray-950 text-white">
      <Sidebar />
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold text-white">Dashboard</h1>
            <p className="text-xs text-gray-500">Flint Glass · Demo Workspace</p>
          </div>
          <button
            type="button"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            New Component
          </button>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Stat cards */}
          <div className="grid grid-cols-4 gap-4">
            {STATS.map((s) => (
              <StatCard key={s.label} {...s} />
            ))}
          </div>

          {/* Lower panels */}
          <div className="mt-6 grid grid-cols-2 gap-4">
            <ActivityFeed />
            <ComponentLibrary />
          </div>
        </div>
      </main>
    </div>
  )
}
