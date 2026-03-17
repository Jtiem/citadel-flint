export default function App() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 p-8">
      <div className="max-w-md rounded-xl border border-gray-800 bg-gray-900 p-8 shadow-lg">
        <h1 className="text-2xl font-bold text-white">Welcome to Bridge</h1>
        <p className="mt-3 text-sm text-gray-400">
          This starter component is governed by your design system.
          Edit it to see live governance feedback.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Get Started
          </button>
          <button
            type="button"
            className="rounded-lg border border-gray-700 px-4 py-2 text-sm font-medium text-gray-300 hover:border-gray-600"
          >
            Learn More
          </button>
        </div>
      </div>
    </div>
  )
}
