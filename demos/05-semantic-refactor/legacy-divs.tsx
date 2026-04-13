import React, { useState } from 'react';

/**
 * ProfileSettings — Demo fixture for semantic HTML refactor (Demo 05).
 *
 * This is a legacy component written in the "div-everything" style common in
 * pre-2020 React codebases: no <form>, no <fieldset>, no <legend>, no semantic
 * input types, click handlers on divs instead of buttons, and visual-only
 * labels with no programmatic association to their controls.
 *
 * Flint's Warden linter detects 12+ structural and accessibility violations:
 *   - A11Y-004: Every "input" is a raw <div> with no role, tabIndex, or label
 *   - A11Y-020: onClick on non-interactive elements (div containers)
 *   - A11Y-010: "Heading" is a styled <div>, not an <h*> element
 *   - Structure: no <form>, <fieldset>, <legend>, <main>
 *
 * Demo flow: audit → 12 violations → flint_ast_mutate upgrades to
 * <form>, <fieldset>, <label>, <input>, <select>, <button> — zero violations.
 */

interface UserProfile {
  displayName: string;
  email: string;
  jobTitle: string;
  department: string;
  timezone: string;
  language: string;
}

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'Europe/London', label: 'London (GMT)' },
  { value: 'Europe/Paris', label: 'Paris (CET)' },
];

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'ja', label: '日本語' },
];

/* ── VIOLATION: Global variable simulates form state outside React ────────── */
let _savedProfile: UserProfile | null = null;

export default function ProfileSettingsLegacy() {
  const [displayName, setDisplayName] = useState('Alex Kim');
  const [email] = useState('alex@example.com');
  const [jobTitle, setJobTitle] = useState('Product Designer');
  const [department, setDepartment] = useState('Design');
  const [timezone, setTimezone] = useState('America/Los_Angeles');
  const [language, setLanguage] = useState('en');
  const [saved, setSaved] = useState(false);

  /* VIOLATION: onClick on a <div> container — should be a <form onSubmit> */
  function handleSave() {
    _savedProfile = { displayName, email, jobTitle, department, timezone, language };
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleCancel() {
    setDisplayName('Alex Kim');
    setJobTitle('Product Designer');
    setDepartment('Design');
  }

  return (
    /* VIOLATION: No <main> landmark */
    <div className="max-w-2xl mx-auto p-8 bg-white border border-gray-200 rounded-lg shadow-sm">

      {/* VIOLATION: <div> used as page heading — should be <h1> or <h2> */}
      <div className="text-xl font-semibold text-gray-900 mb-1">
        Profile Settings
      </div>
      <div className="text-sm text-gray-500 mb-6">
        Manage your personal information and preferences.
      </div>

      {saved && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded px-3 py-2 text-xs font-medium text-green-700">
          Changes saved
        </div>
      )}

      <div className="h-px bg-gray-200 mb-6" />

      {/* VIOLATION: No <form> wrapper — submit logic is in a click handler on a div */}
      <div>

        {/* VIOLATION: No <fieldset><legend> — section label is a styled <div> */}
        <div className="mb-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-4">
            Personal Information
          </div>

          <div className="flex gap-4 mb-4">
            {/* VIOLATION: <div> as label with no htmlFor; "input" is a div with onChange simulation */}
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-700 mb-1">Display name</div>
              {/* VIOLATION: <input> has no associated label (no id/htmlFor pairing) */}
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-700 mb-1">Email address</div>
              {/* VIOLATION: disabled input with no label association */}
              <input
                type="text"
                value={email}
                disabled
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-gray-50 text-gray-400 cursor-not-allowed"
              />
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-700 mb-1">Job title</div>
              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="e.g. Senior Product Designer"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-700 mb-1">Department</div>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. Design"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="h-px bg-gray-200 mb-6" />

        {/* VIOLATION: No <fieldset><legend> for Locale section */}
        <div className="mb-8">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-4">
            Locale &amp; Language
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              {/* VIOLATION: <div> label with no programmatic association to the select */}
              <div className="text-sm font-medium text-gray-700 mb-1">Timezone</div>
              {/* VIOLATION: <select> has no accessible label (no aria-label, no htmlFor) */}
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>{tz.label}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-700 mb-1">Language</div>
              {/* VIOLATION: same unlabeled select problem */}
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.value} value={lang.value}>{lang.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Action bar */}
        <div className="flex justify-end gap-3">
          {/* VIOLATION: onClick on a plain <div> — not a <button> */}
          <div
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium rounded-md border border-gray-200 bg-white text-gray-700 cursor-pointer hover:bg-gray-50"
          >
            Cancel
          </div>
          {/* VIOLATION: onClick on a plain <div> — not a <button type="submit"> */}
          <div
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white cursor-pointer hover:bg-blue-700"
          >
            Save changes
          </div>
        </div>
      </div>
    </div>
  );
}
