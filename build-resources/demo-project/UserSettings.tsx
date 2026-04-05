import React, { useState } from 'react'

/**
 * UserSettings — A full account settings page.
 *
 * Built by AI based on the prompt: "Create a user settings page with
 * profile info, notification preferences, security settings, and a
 * danger zone for account deletion."
 *
 * Contains intentional governance violations for Flint to catch.
 */

interface UserProfile {
  name: string
  email: string
  avatar: string
  role: 'admin' | 'member' | 'viewer'
  joinedAt: string
}

const MOCK_USER: UserProfile = {
  name: 'Sarah Chen',
  email: 'sarah.chen@acme.design',
  avatar: '/avatars/sarah.png',
  role: 'admin',
  joinedAt: 'March 2024',
}

export default function UserSettings() {
  const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'security' | 'billing'>('profile')
  const [emailNotifs, setEmailNotifs] = useState(true)
  const [slackNotifs, setSlackNotifs] = useState(false)
  const [weeklyDigest, setWeeklyDigest] = useState(true)
  const [twoFactor, setTwoFactor] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const tabs = [
    { id: 'profile' as const, label: 'Profile' },
    { id: 'notifications' as const, label: 'Notifications' },
    { id: 'security' as const, label: 'Security' },
    { id: 'billing' as const, label: 'Billing' },
  ]

  return (
    <div data-flint-id="settings-root" className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header data-flint-id="settings-header" className="border-b border-zinc-800 bg-zinc-900">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            {/* Violation: img missing alt (A11Y-001) */}
            <img
              data-flint-id="header-logo"
              src="/logo.svg"
              className="h-8 w-8"
            />
            <span data-flint-id="header-title" className="text-lg font-semibold">Settings</span>
          </div>
          <button
            data-flint-id="header-back"
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 transition hover:bg-zinc-700"
          >
            Back to Dashboard
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-8">
        {/* Tab navigation */}
        <nav data-flint-id="settings-tabs" className="flex gap-1 rounded-lg bg-zinc-900 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              data-flint-id={`tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition ${
                activeTab === tab.id
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div data-flint-id="tab-content-profile" className="mt-8 space-y-8">
            {/* Avatar + Name section */}
            <div data-flint-id="profile-card" className="flex items-start gap-6 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <div data-flint-id="avatar-wrapper" className="relative">
                {/* Violation: img missing alt (A11Y-001) */}
                <img
                  data-flint-id="profile-avatar"
                  src={MOCK_USER.avatar}
                  className="h-20 w-20 rounded-full border-2 border-zinc-700 object-cover"
                />
                {/* Violation: button with no accessible label (A11Y-002) */}
                <button
                  data-flint-id="avatar-edit-btn"
                  className="absolute -bottom-1 -right-1 rounded-full bg-indigo-600 p-1.5 text-white shadow-lg transition hover:bg-indigo-500"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                    <path d="M9.5 1.5L10.5 2.5L3.5 9.5L1 10.5L2 8L9.5 1.5Z" />
                  </svg>
                </button>
              </div>
              <div className="flex-1">
                <h2 data-flint-id="profile-name" className="text-xl font-bold">{MOCK_USER.name}</h2>
                <p data-flint-id="profile-email" className="mt-1 text-sm text-zinc-400">{MOCK_USER.email}</p>
                <span
                  data-flint-id="profile-role-badge"
                  className="mt-2 inline-block rounded-full bg-indigo-600/20 px-2.5 py-0.5 text-xs font-medium text-indigo-400"
                >
                  {MOCK_USER.role}
                </span>
              </div>
              <button
                data-flint-id="profile-edit-btn"
                className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-700 hover:text-white"
              >
                Edit Profile
              </button>
            </div>

            {/* Form fields */}
            <div data-flint-id="profile-form" className="space-y-6 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <h3 data-flint-id="form-title" className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
                Personal Information
              </h3>
              <div className="grid gap-6 md:grid-cols-2">
                <div data-flint-id="field-name">
                  <label className="mb-1.5 block text-sm font-medium text-zinc-300">Full Name</label>
                  {/* Violation: input missing aria-label or linked label (A11Y-004) */}
                  <input
                    data-flint-id="input-name"
                    type="text"
                    defaultValue={MOCK_USER.name}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 transition focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div data-flint-id="field-email">
                  <label className="mb-1.5 block text-sm font-medium text-zinc-300">Email Address</label>
                  <input
                    data-flint-id="input-email"
                    type="email"
                    defaultValue={MOCK_USER.email}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 transition focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div data-flint-id="field-role">
                  <label className="mb-1.5 block text-sm font-medium text-zinc-300">Role</label>
                  {/* Violation: select missing accessible label (A11Y-005) */}
                  <select
                    data-flint-id="select-role"
                    defaultValue={MOCK_USER.role}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 transition focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
                <div data-flint-id="field-bio">
                  <label className="mb-1.5 block text-sm font-medium text-zinc-300">Bio</label>
                  {/* Violation: textarea missing accessible label (A11Y-006) */}
                  <textarea
                    data-flint-id="textarea-bio"
                    rows={3}
                    placeholder="Tell us about yourself..."
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 transition focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 border-t border-zinc-800 pt-4">
                <button
                  data-flint-id="form-cancel"
                  className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-400 transition hover:text-zinc-200"
                >
                  Cancel
                </button>
                {/* Violation: hardcoded hex color #4F46E5 instead of design token */}
                <button
                  data-flint-id="form-save"
                  className="rounded-lg bg-[#4F46E5] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#4338CA]"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div data-flint-id="tab-content-notifications" className="mt-8 space-y-4">
            <div data-flint-id="notif-card" className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <h3 data-flint-id="notif-title" className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
                Notification Preferences
              </h3>
              <div className="mt-6 space-y-5">
                {/* Email notifications toggle */}
                <div data-flint-id="notif-email" className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-zinc-200">Email Notifications</p>
                    <p className="text-xs text-zinc-500">Receive violation alerts and audit reports via email</p>
                  </div>
                  <button
                    data-flint-id="toggle-email"
                    onClick={() => setEmailNotifs(!emailNotifs)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                      emailNotifs ? 'bg-indigo-600' : 'bg-zinc-700'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition ${
                      emailNotifs ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>

                {/* Slack notifications toggle */}
                <div data-flint-id="notif-slack" className="flex items-center justify-between border-t border-zinc-800 pt-5">
                  <div>
                    <p className="text-sm font-medium text-zinc-200">Slack Notifications</p>
                    <p className="text-xs text-zinc-500">Post governance alerts to your team Slack channel</p>
                  </div>
                  <button
                    data-flint-id="toggle-slack"
                    onClick={() => setSlackNotifs(!slackNotifs)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                      slackNotifs ? 'bg-indigo-600' : 'bg-zinc-700'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition ${
                      slackNotifs ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>

                {/* Weekly digest toggle */}
                <div data-flint-id="notif-digest" className="flex items-center justify-between border-t border-zinc-800 pt-5">
                  <div>
                    <p className="text-sm font-medium text-zinc-200">Weekly Digest</p>
                    <p className="text-xs text-zinc-500">Summary of design debt trends and governance changes</p>
                  </div>
                  <button
                    data-flint-id="toggle-digest"
                    onClick={() => setWeeklyDigest(!weeklyDigest)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                      weeklyDigest ? 'bg-indigo-600' : 'bg-zinc-700'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition ${
                      weeklyDigest ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <div data-flint-id="tab-content-security" className="mt-8 space-y-6">
            {/* 2FA */}
            <div data-flint-id="security-2fa" className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-200">Two-Factor Authentication</h3>
                  <p className="mt-1 text-xs text-zinc-500">Add an extra layer of security to your account</p>
                </div>
                <button
                  data-flint-id="2fa-toggle"
                  onClick={() => setTwoFactor(!twoFactor)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                    twoFactor
                      ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700'
                  }`}
                >
                  {twoFactor ? 'Enabled' : 'Enable 2FA'}
                </button>
              </div>
            </div>

            {/* Sessions */}
            <div data-flint-id="security-sessions" className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <h3 className="text-sm font-semibold text-zinc-200">Active Sessions</h3>
              <div className="mt-4 space-y-3">
                <div data-flint-id="session-current" className="flex items-center justify-between rounded-lg bg-zinc-800/50 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    <div>
                      <p className="text-sm text-zinc-200">MacBook Pro — Chrome</p>
                      <p className="text-xs text-zinc-500">San Francisco, CA · Current session</p>
                    </div>
                  </div>
                  <span className="text-xs text-emerald-400">Active now</span>
                </div>
                <div data-flint-id="session-other" className="flex items-center justify-between rounded-lg bg-zinc-800/50 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="h-2 w-2 rounded-full bg-zinc-500" />
                    <div>
                      <p className="text-sm text-zinc-200">iPhone 15 — Safari</p>
                      <p className="text-xs text-zinc-500">San Francisco, CA · 2 hours ago</p>
                    </div>
                  </div>
                  <button
                    data-flint-id="session-revoke"
                    className="text-xs text-red-400 transition hover:text-red-300"
                  >
                    Revoke
                  </button>
                </div>
              </div>
            </div>

            {/* Danger zone */}
            <div data-flint-id="danger-zone" className="rounded-xl border border-red-900/30 bg-red-950/10 p-6">
              <h3 className="text-sm font-semibold text-red-400">Danger Zone</h3>
              <p className="mt-2 text-xs text-zinc-400">
                Permanently delete your account and all associated data. This action cannot be undone.
              </p>
              {!showDeleteConfirm ? (
                <button
                  data-flint-id="delete-account-btn"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="mt-4 rounded-lg border border-red-700/40 bg-red-900/20 px-4 py-2 text-sm font-medium text-red-400 transition hover:bg-red-900/40"
                >
                  Delete Account
                </button>
              ) : (
                <div data-flint-id="delete-confirm" className="mt-4 flex items-center gap-3">
                  <p className="text-sm text-red-300">Are you sure? Type your email to confirm.</p>
                  {/* Violation: input missing label (A11Y-004) */}
                  <input
                    data-flint-id="delete-confirm-input"
                    type="email"
                    placeholder="your@email.com"
                    className="rounded-lg border border-red-700/40 bg-red-950/20 px-3 py-1.5 text-sm text-red-300 placeholder-red-800 transition focus:border-red-500 focus:outline-none"
                  />
                  <button
                    data-flint-id="delete-confirm-btn"
                    className="rounded-lg bg-red-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-red-500"
                  >
                    Confirm Delete
                  </button>
                  <button
                    data-flint-id="delete-cancel-btn"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="text-sm text-zinc-400 transition hover:text-zinc-200"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Billing Tab */}
        {activeTab === 'billing' && (
          <div data-flint-id="tab-content-billing" className="mt-8 space-y-6">
            {/* Current plan */}
            <div data-flint-id="billing-plan" className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-200">Current Plan</h3>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span data-flint-id="plan-name" className="text-2xl font-bold text-white">Pro</span>
                    {/* Violation: hardcoded color #22C55E not in token set */}
                    <span data-flint-id="plan-status" className="rounded-full bg-[#22C55E]/20 px-2 py-0.5 text-xs font-medium text-[#22C55E]">
                      Active
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-zinc-400">$29/month · Renews April 15, 2026</p>
                </div>
                <button
                  data-flint-id="billing-manage"
                  className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-700"
                >
                  Manage Plan
                </button>
              </div>
            </div>

            {/* Payment method */}
            <div data-flint-id="billing-payment" className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <h3 className="text-sm font-semibold text-zinc-200">Payment Method</h3>
              <div data-flint-id="payment-card" className="mt-4 flex items-center gap-4 rounded-lg bg-zinc-800/50 px-4 py-3">
                <div className="flex h-8 w-12 items-center justify-center rounded bg-zinc-700 text-xs font-bold text-zinc-300">
                  VISA
                </div>
                <div>
                  <p className="text-sm text-zinc-200">•••• •••• •••• 4242</p>
                  <p className="text-xs text-zinc-500">Expires 12/2027</p>
                </div>
                <button
                  data-flint-id="payment-update"
                  className="ml-auto text-xs text-indigo-400 transition hover:text-indigo-300"
                >
                  Update
                </button>
              </div>
            </div>

            {/* Invoice history */}
            <div data-flint-id="billing-invoices" className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <h3 className="text-sm font-semibold text-zinc-200">Invoice History</h3>
              {/* Violation: table missing accessible summary (A11Y-008) */}
              <table data-flint-id="invoice-table" className="mt-4 w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium">Amount</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 text-right font-medium">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  <tr>
                    <td className="py-3 text-zinc-300">Mar 15, 2026</td>
                    <td className="py-3 text-zinc-300">$29.00</td>
                    <td className="py-3"><span className="rounded-full bg-emerald-600/20 px-2 py-0.5 text-xs text-emerald-400">Paid</span></td>
                    {/* Violation: link with no descriptive text (A11Y-003) */}
                    <td className="py-3 text-right"><a data-flint-id="invoice-link-1" href="#" className="text-indigo-400 hover:text-indigo-300">Download</a></td>
                  </tr>
                  <tr>
                    <td className="py-3 text-zinc-300">Feb 15, 2026</td>
                    <td className="py-3 text-zinc-300">$29.00</td>
                    <td className="py-3"><span className="rounded-full bg-emerald-600/20 px-2 py-0.5 text-xs text-emerald-400">Paid</span></td>
                    <td className="py-3 text-right"><a data-flint-id="invoice-link-2" href="#" className="text-indigo-400 hover:text-indigo-300">Download</a></td>
                  </tr>
                  <tr>
                    <td className="py-3 text-zinc-300">Jan 15, 2026</td>
                    <td className="py-3 text-zinc-300">$29.00</td>
                    <td className="py-3"><span className="rounded-full bg-emerald-600/20 px-2 py-0.5 text-xs text-emerald-400">Paid</span></td>
                    <td className="py-3 text-right"><a data-flint-id="invoice-link-3" href="#" className="text-indigo-400 hover:text-indigo-300">Download</a></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
