/**
 * OriginalCard — demos/06-macro-recovery/original-card.tsx
 *
 * BEFORE state (Git commit SHA: a3f8b12): a complete, well-structured
 * repository card component. This is the version that was in production
 * before an AI-assisted refactor accidentally deleted the metrics section
 * (lines 90-130 in the corrupted version) and broke the footer action bar.
 *
 * Bridge macro-recovery demo: the RecoveryPanel reads git history via
 * `ast:git-log`, diffs the AST at HEAD vs. a3f8b12 using `ast:git-show`,
 * identifies the missing JSX subtree (the <RepoMetrics> block and the
 * <CardFooter> actions), and performs a surgical node transplant —
 * grafting only those nodes back into the corrupted file without
 * touching any of the surrounding refactored code.
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

  function handleStar() {
    setStarred((s) => !s);
    onStar(name);
  }

  function handleWatch() {
    setWatching((w) => !w);
    onWatch(name);
  }

  return (
    <article
      data-bridge-id="repo-card-root"
      className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
    >
      {/* Card header */}
      <div
        data-bridge-id="repo-card-header"
        className="px-5 pt-5 pb-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Repo icon */}
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

        {/* Topics */}
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

      {/* Repo metrics — THIS SECTION IS DELETED IN corrupted-card.tsx */}
      <div
        data-bridge-id="repo-card-metrics"
        className="px-5 py-3 border-t border-gray-100 flex items-center gap-5 text-xs text-gray-500"
      >
        {/* Language */}
        {primaryLanguage && (
          <span className="flex items-center gap-1.5">
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: primaryLanguage.color }}
              aria-hidden="true"
            />
            {primaryLanguage.name}
          </span>
        )}

        {/* Stars */}
        <span className="flex items-center gap-1">
          <svg aria-hidden="true" className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z" />
          </svg>
          <span>{formatCount(stars)}</span>
        </span>

        {/* Forks */}
        <span className="flex items-center gap-1">
          <svg aria-hidden="true" className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
            <path d="M5 5.372v.878c0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75v-.878a2.25 2.25 0 1 1 1.5 0v.878a2.25 2.25 0 0 1-2.25 2.25h-1.5v2.128a2.251 2.251 0 1 1-1.5 0V8.5h-1.5A2.25 2.25 0 0 1 3.5 6.25v-.878a2.25 2.25 0 1 1 1.5 0ZM5 3.25a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Zm6.75.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm-3 8.75a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Z" />
          </svg>
          <span>{formatCount(forks)}</span>
        </span>

        {/* Open issues */}
        {openIssues > 0 && (
          <span className="flex items-center gap-1">
            <svg aria-hidden="true" className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
              <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z" />
            </svg>
            <span>{formatCount(openIssues)} issues</span>
          </span>
        )}

        <span className="ml-auto">Updated {timeAgo(updatedAt)}</span>
      </div>

      {/* Language bar */}
      {languages.length > 0 && (
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
      )}

      {/* Card footer actions — THIS SECTION IS CORRUPTED IN corrupted-card.tsx */}
      <div
        data-bridge-id="repo-card-footer"
        className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex items-center gap-2"
      >
        <button
          onClick={handleStar}
          aria-label={starred ? `Unstar ${name}` : `Star ${name}`}
          aria-pressed={starred}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border transition-colors ${
            starred
              ? 'bg-yellow-50 border-yellow-300 text-yellow-700 hover:bg-yellow-100'
              : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <svg
            aria-hidden="true"
            className="w-3.5 h-3.5"
            viewBox="0 0 16 16"
            fill={starred ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth={starred ? 0 : 1.5}
          >
            <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z" />
          </svg>
          {starred ? 'Starred' : 'Star'}
        </button>

        <button
          onClick={() => onFork(name)}
          aria-label={`Fork ${name}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <svg aria-hidden="true" className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
            <path d="M5 5.372v.878c0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75v-.878a2.25 2.25 0 1 1 1.5 0v.878a2.25 2.25 0 0 1-2.25 2.25h-1.5v2.128a2.251 2.251 0 1 1-1.5 0V8.5h-1.5A2.25 2.25 0 0 1 3.5 6.25v-.878a2.25 2.25 0 1 1 1.5 0ZM5 3.25a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Zm6.75.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm-3 8.75a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Z" />
          </svg>
          Fork
        </button>

        <button
          onClick={handleWatch}
          aria-label={watching ? `Unwatch ${name}` : `Watch ${name}`}
          aria-pressed={watching}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border transition-colors ${
            watching
              ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
              : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <svg aria-hidden="true" className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 3C4.5 3 1.5 6 1 8c.5 2 3.5 5 7 5s6.5-3 7-5c-.5-2-3.5-5-7-5z" />
            <circle cx="8" cy="8" r="2" />
          </svg>
          {watching ? 'Watching' : 'Watch'}
        </button>

        <a
          href={`https://github.com/${owner}/${name}`}
          aria-label={`Open ${owner}/${name} on GitHub`}
          className="ml-auto text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
        >
          View on GitHub →
        </a>
      </div>
    </article>
  );
}
