/**
 * CorruptedCard — demos/06-macro-recovery/corrupted-card.tsx
 *
 * CURRENT STATE (HEAD): the RepoCard after an AI-assisted refactor went
 * wrong. The developer asked the AI to "extract the language bar into its
 * own component" — but the AI used `git checkout src/components/ui/RepoCard.tsx`
 * (a global file replacement) instead of a targeted transplant, which
 * silently reverted two other sections that had been updated in the same
 * commit:
 *
 *   1. The entire `repo-card-metrics` block (stars, forks, issues, updated
 *      timestamp) was deleted — the node with data-bridge-id="repo-card-metrics"
 *      is gone from the AST.
 *
 *   2. The `repo-card-footer` action bar was replaced with a broken stub
 *      that renders no buttons and has an unclosed JSX expression.
 *
 * Bridge macro-recovery: the RecoveryPanel finds this via `bridge_debt_report`
 * (health score drops from 94 to 61 because two WCAG nodes and four token
 * references are missing). The user opens Git Time Machine, selects commit
 * a3f8b12, and Bridge uses `ast:git-show` + `bridge_ast_mutate` to transplant
 * only the two missing subtrees back into this file — Commandment 11:
 * "never git checkout a shared file; transplant specific nodes."
 */

import React, { useState } from 'react';

interface Language {
  name: string;
  color: string;
  percentage: number;
}

interface RepoCardProps {
  name: string;
  owner: string;
  description: string;
  stars: number;
  forks: number;
  openIssues: number;
  primaryLanguage: Language | null;
  languages: Language[];
  isPrivate: boolean;
  updatedAt: string;
  topics: string[];
  onStar: (name: string) => void;
  onFork: (name: string) => void;
  onWatch: (name: string) => void;
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`;
  const years = Math.floor(days / 365);
  return `${years} year${years > 1 ? 's' : ''} ago`;
}

// LanguageBar extracted into its own component as requested —
// but the refactor clobbered the sections around it.
function LanguageBar({ languages }: { languages: Language[] }) {
  if (languages.length === 0) return null;
  return (
    <div
      data-bridge-id="repo-card-lang-bar"
      className="px-5 pb-4"
    >
      <div className="flex rounded-full overflow-hidden h-1.5 mt-2" role="img" aria-label="Language breakdown">
        {languages.map((lang) => (
          <div
            key={lang.name}
            style={{ width: `${lang.percentage}%`, backgroundColor: lang.color }}
            title={`${lang.name}: ${lang.percentage}%`}
          />
        ))}
      </div>
    </div>
  );
}

export default function RepoCard({
  name,
  owner,
  description,
  stars,
  forks,
  openIssues,
  primaryLanguage,
  languages,
  isPrivate,
  updatedAt,
  topics,
  onStar,
  onFork,
  onWatch,
}: RepoCardProps) {
  const [starred, setStarred] = useState(false);
  const [watching, setWatching] = useState(false);

  return (
    <article
      data-bridge-id="repo-card-root"
      className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
    >
      {/* Card header — intact */}
      <div
        data-bridge-id="repo-card-header"
        className="px-5 pt-5 pb-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <svg
              aria-hidden="true"
              className="w-4 h-4 text-gray-400 shrink-0"
              viewBox="0 0 16 16"
              fill="currentColor"
            >
              <path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8Z" />
            </svg>
            <div className="min-w-0">
              <a
                href={`https://github.com/${owner}/${name}`}
                className="text-sm font-semibold text-blue-600 hover:underline truncate block"
                aria-label={`View repository ${owner}/${name}`}
              >
                {owner} / {name}
              </a>
            </div>
          </div>
          <span
            className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full border ${
              isPrivate
                ? 'text-gray-600 border-gray-300 bg-gray-50'
                : 'text-green-700 border-green-200 bg-green-50'
            }`}
          >
            {isPrivate ? 'Private' : 'Public'}
          </span>
        </div>

        {description && (
          <p
            data-bridge-id="repo-card-description"
            className="mt-2.5 text-sm text-gray-600 line-clamp-2 leading-relaxed"
          >
            {description}
          </p>
        )}

        {topics.length > 0 && (
          <div
            data-bridge-id="repo-card-topics"
            className="mt-3 flex flex-wrap gap-1.5"
          >
            {topics.slice(0, 5).map((topic) => (
              <span
                key={topic}
                className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 cursor-pointer transition-colors"
              >
                {topic}
              </span>
            ))}
            {topics.length > 5 && (
              <span className="text-xs text-gray-400 py-0.5">
                +{topics.length - 5} more
              </span>
            )}
          </div>
        )}
      </div>

      {/*
        DELETED: repo-card-metrics block (stars / forks / issues / updated)
        was here. The node data-bridge-id="repo-card-metrics" is gone.
        Bridge identifies this as a missing node during the AST diff.
      */}

      {/* Language bar — the only thing the refactor was supposed to change */}
      <LanguageBar languages={languages} />

      {/*
        CORRUPTED: repo-card-footer was replaced with a broken stub.
        The original action bar (Star / Fork / Watch / View on GitHub)
        is gone. Bridge's debt report drops the health score from 94 → 61
        because three interactive affordances and their aria-label attributes
        are missing, failing A11Y-002 (button accessible name) x3.
      */}
      <div
        data-bridge-id="repo-card-footer"
        className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex items-center gap-2"
      >
        {/* TODO: restore action buttons — accidentally deleted during LanguageBar extraction */}
      </div>
    </article>
  );
}
