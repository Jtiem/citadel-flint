/**
 * LegacyDivs — demos/05-semantic-refactor/legacy-divs.tsx
 *
 * A user profile settings panel written in raw HTML before the design system
 * component library existed. Every layout construct is a bare <div> with a
 * BEM-style className; every text node is a <span>; interactive controls are
 * built from scratch instead of using the canonical primitives.
 *
 * Bridge semantic refactor target: the AI reads the component registry via
 * bridge_query_registry, then uses bridge_ast_mutate to upgrade each
 * structural primitive to its design system equivalent:
 *
 *   <div className="box">          →  <Box>
 *   <div className="stack">        →  <Stack>
 *   <div className="flex-row">     →  <Inline>
 *   <span className="text-label">  →  <Text variant="label">
 *   <span className="text-body">   →  <Text variant="body">
 *   <span className="text-caption">→  <Text variant="caption">
 *   <div className="divider">      →  <Divider>
 *   <button className="btn-*">     →  <Button variant="*">
 *   <input className="input-*">    →  <TextField>
 *   <select className="select-*">  →  <SelectField>
 *
 * The AFTER state has the same visual output but the AST references typed
 * design system components that the governance engine can audit and trace.
 */

import React, { useState } from 'react';

interface UserProfile {
  displayName: string;
  email: string;
  jobTitle: string;
  department: string;
  timezone: string;
  language: string;
  avatarUrl: string;
}

interface ProfileSettingsProps {
  profile: UserProfile;
  onSave: (updated: UserProfile) => Promise<void>;
  onCancel: () => void;
}

export default function ProfileSettings({ profile, onSave, onCancel }: ProfileSettingsProps) {
  const [form, setForm] = useState<UserProfile>(profile);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function handleChange(field: keyof UserProfile) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
      setSaved(false);
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onSave(form);
    setSaving(false);
    setSaved(true);
  }

  return (
    <div className="box">
      {/* Page header */}
      <div className="flex-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="stack" style={{ gap: '4px' }}>
          <span className="text-heading">Profile Settings</span>
          <span className="text-body" style={{ color: '#6B7280' }}>
            Manage your personal information and preferences.
          </span>
        </div>
        {saved && (
          <div className="box" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '6px', padding: '8px 12px' }}>
            <span className="text-caption" style={{ color: '#15803D' }}>Changes saved</span>
          </div>
        )}
      </div>

      <div className="divider" style={{ height: '1px', backgroundColor: '#E5E7EB', margin: '20px 0' }} />

      <form onSubmit={handleSubmit}>
        {/* Avatar section */}
        <div className="flex-row" style={{ gap: '20px', alignItems: 'center', marginBottom: '28px' }}>
          <div className="box" style={{ position: 'relative' }}>
            <img
              src={form.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(form.displayName)}`}
              alt={`${form.displayName} avatar`}
              style={{ width: '72px', height: '72px', borderRadius: '9999px', objectFit: 'cover' }}
            />
          </div>
          <div className="stack" style={{ gap: '6px' }}>
            <button
              type="button"
              className="btn-outline"
              style={{ fontSize: '14px', padding: '6px 14px', borderRadius: '6px', border: '1px solid #D1D5DB', background: 'white', cursor: 'pointer' }}
            >
              Change photo
            </button>
            <span className="text-caption" style={{ color: '#9CA3AF', fontSize: '12px' }}>
              JPG, PNG or GIF. Max 2MB.
            </span>
          </div>
        </div>

        {/* Personal info section */}
        <div className="stack" style={{ gap: '0', marginBottom: '28px' }}>
          <span className="text-label" style={{ fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6B7280', marginBottom: '14px', display: 'block' }}>
            Personal Information
          </span>

          <div className="flex-row" style={{ gap: '16px', marginBottom: '16px' }}>
            <div className="stack" style={{ flex: 1, gap: '6px' }}>
              <label htmlFor="displayName" className="text-label" style={{ fontSize: '14px', fontWeight: 500, color: '#374151' }}>
                Display name
              </label>
              <input
                id="displayName"
                className="input-text"
                type="text"
                value={form.displayName}
                onChange={handleChange('displayName')}
                style={{ padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '14px', width: '100%', boxSizing: 'border-box' }}
              />
            </div>
            <div className="stack" style={{ flex: 1, gap: '6px' }}>
              <label htmlFor="email" className="text-label" style={{ fontSize: '14px', fontWeight: 500, color: '#374151' }}>
                Email address
              </label>
              <input
                id="email"
                className="input-text input-disabled"
                type="email"
                value={form.email}
                disabled
                style={{ padding: '8px 12px', border: '1px solid #E5E7EB', borderRadius: '6px', fontSize: '14px', width: '100%', boxSizing: 'border-box', backgroundColor: '#F9FAFB', color: '#9CA3AF' }}
              />
            </div>
          </div>

          <div className="flex-row" style={{ gap: '16px' }}>
            <div className="stack" style={{ flex: 1, gap: '6px' }}>
              <label htmlFor="jobTitle" className="text-label" style={{ fontSize: '14px', fontWeight: 500, color: '#374151' }}>
                Job title
              </label>
              <input
                id="jobTitle"
                className="input-text"
                type="text"
                value={form.jobTitle}
                onChange={handleChange('jobTitle')}
                placeholder="e.g. Senior Product Designer"
                style={{ padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '14px', width: '100%', boxSizing: 'border-box' }}
              />
            </div>
            <div className="stack" style={{ flex: 1, gap: '6px' }}>
              <label htmlFor="department" className="text-label" style={{ fontSize: '14px', fontWeight: 500, color: '#374151' }}>
                Department
              </label>
              <input
                id="department"
                className="input-text"
                type="text"
                value={form.department}
                onChange={handleChange('department')}
                placeholder="e.g. Design"
                style={{ padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '14px', width: '100%', boxSizing: 'border-box' }}
              />
            </div>
          </div>
        </div>

        <div className="divider" style={{ height: '1px', backgroundColor: '#E5E7EB', marginBottom: '28px' }} />

        {/* Locale section */}
        <div className="stack" style={{ gap: '0', marginBottom: '32px' }}>
          <span className="text-label" style={{ fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6B7280', marginBottom: '14px', display: 'block' }}>
            Locale &amp; Language
          </span>

          <div className="flex-row" style={{ gap: '16px' }}>
            <div className="stack" style={{ flex: 1, gap: '6px' }}>
              <label htmlFor="timezone" className="text-label" style={{ fontSize: '14px', fontWeight: 500, color: '#374151' }}>
                Timezone
              </label>
              <select
                id="timezone"
                className="select-default"
                value={form.timezone}
                onChange={handleChange('timezone')}
                style={{ padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '14px', width: '100%', backgroundColor: 'white' }}
              >
                <option value="America/New_York">Eastern Time (ET)</option>
                <option value="America/Chicago">Central Time (CT)</option>
                <option value="America/Denver">Mountain Time (MT)</option>
                <option value="America/Los_Angeles">Pacific Time (PT)</option>
                <option value="Europe/London">London (GMT)</option>
                <option value="Europe/Paris">Paris (CET)</option>
                <option value="Asia/Tokyo">Tokyo (JST)</option>
              </select>
            </div>
            <div className="stack" style={{ flex: 1, gap: '6px' }}>
              <label htmlFor="language" className="text-label" style={{ fontSize: '14px', fontWeight: 500, color: '#374151' }}>
                Language
              </label>
              <select
                id="language"
                className="select-default"
                value={form.language}
                onChange={handleChange('language')}
                style={{ padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '14px', width: '100%', backgroundColor: 'white' }}
              >
                <option value="en">English</option>
                <option value="fr">Français</option>
                <option value="de">Deutsch</option>
                <option value="ja">日本語</option>
                <option value="es">Español</option>
              </select>
            </div>
          </div>
        </div>

        {/* Action bar */}
        <div className="flex-row" style={{ justifyContent: 'flex-end', gap: '12px' }}>
          <button
            type="button"
            onClick={onCancel}
            className="btn-ghost"
            style={{ padding: '8px 18px', fontSize: '14px', fontWeight: 500, borderRadius: '6px', border: '1px solid #E5E7EB', background: 'white', cursor: 'pointer', color: '#374151' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="btn-primary"
            style={{ padding: '8px 18px', fontSize: '14px', fontWeight: 500, borderRadius: '6px', border: 'none', background: '#0066FF', color: 'white', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.65 : 1 }}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
