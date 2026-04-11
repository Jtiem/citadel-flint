export default function App() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Welcome
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-500">
          Your project is ready. Start building — Flint is watching for
          accessibility, token drift, and design system compliance.
        </p>
        <button
          type="button"
          className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
        >
          Get started
        </button>
        <p className="mt-4 text-center text-xs text-gray-400">
          Built with Flint
        </p>
      </div>
    </div>
  )
}
