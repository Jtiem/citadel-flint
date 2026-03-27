// AccountSettings.tsx — Generated from Figma via Flint D2C pipeline
// Source: figma.com/design/vjl1FUdEAYouaXZQByCiZd node 4007:1808
// Library: Pure Tailwind CSS (no component library)
// Generated: 2026-03-26

import { useState } from "react"

export function AccountSettings() {
  const [activeTab, setActiveTab] = useState<"profile" | "security" | "notifications">("profile")

  return (
    <div className="flex flex-col gap-6 w-[640px]">
      {/* Page title */}
      <h2 className="text-2xl font-extrabold tracking-tight text-zinc-950">
        Account Settings
      </h2>

      {/* Profile Card */}
      <div className="rounded-lg border border-zinc-200 bg-white shadow-sm p-6 flex items-center gap-4">
        <div
          className="w-16 h-16 rounded-full border-2 border-blue-600 bg-blue-50 flex items-center justify-center text-xl font-semibold text-blue-600 shrink-0"
          aria-hidden="true"
        >
          JT
        </div>
        <div className="flex flex-col gap-0.5">
          <p className="text-base font-semibold text-zinc-950">Justin Tiemann</p>
          <p className="text-sm text-zinc-500">justin@example.com</p>
        </div>
        <span className="ml-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700">
          Pro
        </span>
      </div>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Account settings navigation"
        className="flex gap-1 bg-zinc-100 rounded-lg p-1"
      >
        {(["profile", "security", "notifications"] as const).map((tab) => (
          <button
            key={tab}
            role="tab"
            id={`tab-${tab}`}
            aria-selected={activeTab === tab}
            aria-controls={`panel-${tab}`}
            onClick={() => setActiveTab(tab)}
            className={[
              "flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              activeTab === tab
                ? "bg-white text-zinc-950 shadow-sm"
                : "text-zinc-500 hover:text-zinc-700",
            ].join(" ")}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Profile Information Card */}
      <section
        id="panel-profile"
        role="tabpanel"
        aria-labelledby="tab-profile"
        className="rounded-lg border border-zinc-200 bg-white shadow-sm"
      >
        <div className="px-6 py-4 border-b border-zinc-100">
          <h3 className="text-sm font-semibold text-zinc-950">Profile Information</h3>
        </div>
        <div className="p-6 flex flex-col gap-6">
          {/* Name + email row */}
          <div className="flex gap-4">
            <div className="flex-1 flex flex-col gap-1">
              <label
                htmlFor="displayName"
                className="text-sm font-medium text-zinc-700"
              >
                Display Name
              </label>
              <input
                id="displayName"
                type="text"
                placeholder="Justin Tiemann"
                className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <label
                htmlFor="email"
                className="text-sm font-medium text-zinc-700"
              >
                Email Address
              </label>
              <input
                id="email"
                type="email"
                placeholder="justin@example.com"
                className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>
          </div>

          {/* Bio */}
          <div className="flex flex-col gap-1">
            <label htmlFor="bio" className="text-sm font-medium text-zinc-700">
              Bio
            </label>
            <textarea
              id="bio"
              rows={4}
              placeholder="UX designer building the future of agentic design tools."
              className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 resize-none"
            />
          </div>

          {/* Divider */}
          <hr className="border-zinc-200" />

          {/* Timezone + language row */}
          <div className="flex gap-4">
            <div className="flex-1 flex flex-col gap-1">
              <label htmlFor="timezone" className="text-sm font-medium text-zinc-700">
                Timezone
              </label>
              <select
                id="timezone"
                defaultValue="ct"
                className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-950 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              >
                <option value="ct">Central (CT)</option>
                <option value="et">Eastern (ET)</option>
                <option value="pt">Pacific (PT)</option>
              </select>
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <label htmlFor="language" className="text-sm font-medium text-zinc-700">
                Language
              </label>
              <select
                id="language"
                defaultValue="en"
                className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-950 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Action Buttons */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          className="px-4 py-2 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600/50"
        >
          Delete Account
        </button>
        <div className="flex-1" />
        <button
          type="button"
          className="px-4 py-2 rounded-md border border-zinc-200 text-zinc-950 text-sm font-medium hover:bg-zinc-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/50"
        >
          Cancel
        </button>
        <button
          type="button"
          className="px-4 py-2 rounded-md bg-zinc-950 text-white text-sm font-medium hover:bg-zinc-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950/50"
        >
          Save Changes
        </button>
      </div>
    </div>
  )
}
