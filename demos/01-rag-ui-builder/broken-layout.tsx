/**
 * BrokenLayout — demos/01-rag-ui-builder/broken-layout.tsx
 *
 * BEFORE state: a product notification panel written without any awareness
 * of the design system. Every color, size, and spacing value is hardcoded
 * into Tailwind utility classes. No semantic token is referenced.
 *
 * Bridge RAG demo target: the AI reads design-tokens.json via
 * bridge_query_registry, then rewrites this component to use the token
 * primitives (Box, Text, Stack, Button) from the component registry.
 */

import React, { useState } from 'react';

interface Notification {
  id: string;
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
  type: 'info' | 'warning' | 'error';
}

interface NotificationPanelProps {
  notifications: Notification[];
  onMarkAllRead: () => void;
  onDismiss: (id: string) => void;
}

export default function NotificationPanel({
  notifications,
  onMarkAllRead,
  onDismiss,
}: NotificationPanelProps) {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const visible = filter === 'unread'
    ? notifications.filter((n) => !n.read)
    : notifications;

  return (
    <div className="bg-white w-96 rounded-lg border border-gray-200 shadow-lg overflow-hidden">
      {/* Header — hardcoded blue that is NOT the primary token */}
      <div className="bg-blue-500 text-white px-5 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Notifications</h2>
          <p className="text-sm text-blue-100 mt-0.5">
            {notifications.filter((n) => !n.read).length} unread
          </p>
        </div>
        <button
          onClick={onMarkAllRead}
          className="text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded transition-colors"
        >
          Mark all read
        </button>
      </div>

      {/* Filter bar — raw gray values, not surface tokens */}
      <div className="flex border-b border-gray-200 bg-gray-50">
        <button
          onClick={() => setFilter('all')}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
            filter === 'all'
              ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
            filter === 'unread'
              ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Unread
        </button>
      </div>

      {/* Notification list */}
      <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
        {visible.length === 0 && (
          <div className="py-12 text-center text-gray-400 text-sm">
            No notifications
          </div>
        )}

        {visible.map((notification) => (
          <div
            key={notification.id}
            className={`px-5 py-4 flex gap-3 hover:bg-gray-50 transition-colors ${
              !notification.read ? 'bg-blue-50' : 'bg-white'
            }`}
          >
            {/* Type indicator dot — hardcoded color values */}
            <div className="mt-1 shrink-0">
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  notification.type === 'error'
                    ? 'bg-red-500'
                    : notification.type === 'warning'
                    ? 'bg-yellow-500'
                    : 'bg-blue-500'
                }`}
              />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p
                  className={`text-sm font-medium leading-snug ${
                    !notification.read ? 'text-gray-900' : 'text-gray-600'
                  }`}
                >
                  {notification.title}
                </p>
                <span className="text-xs text-gray-400 shrink-0 mt-0.5">
                  {notification.timestamp}
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                {notification.body}
              </p>
            </div>

            {/* Dismiss — no accessible name, hardcoded sizing */}
            <button
              onClick={() => onDismiss(notification.id)}
              className="shrink-0 w-6 h-6 rounded flex items-center justify-center text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors"
            >
              <svg
                viewBox="0 0 16 16"
                fill="currentColor"
                className="w-3.5 h-3.5"
              >
                <path d="M4.22 4.22a.75.75 0 0 1 1.06 0L8 6.94l2.72-2.72a.75.75 0 1 1 1.06 1.06L9.06 8l2.72 2.72a.75.75 0 1 1-1.06 1.06L8 9.06l-2.72 2.72a.75.75 0 0 1-1.06-1.06L6.94 8 4.22 5.28a.75.75 0 0 1 0-1.06z" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {/* Footer — hardcoded font size (15px) not in token set */}
      <div className="px-5 py-3 border-t border-gray-100 bg-gray-50">
        <a
          href="/notifications"
          className="text-[15px] font-medium text-blue-600 hover:underline"
        >
          View all notifications
        </a>
      </div>
    </div>
  );
}
