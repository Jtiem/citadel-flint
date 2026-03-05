export default function App() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-white">
          Hello, Bridge!
        </h1>
        <p className="mt-2 text-sm text-gray-400">
          Open this file in Bridge IDE to start editing.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <button
            type="button"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Get Started
          </button>
          <button
            type="button"
            className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700"
          >
            Learn More
          </button>
        </div>
      </div>
    </div>
  )
}
