/**
 * NotificationCenter — src/components/ui/NotificationCenter.tsx
 *
 * Toast renderer that subscribes to the global notification store and renders
 * a stacked list of toasts fixed to the bottom-right corner of the viewport.
 *
 * Each toast:
 *   - Dark card with a left color bar keyed to severity
 *   - Title + message text
 *   - Optional action button
 *   - Dismiss X button
 *   - Auto-dismisses via useEffect + setTimeout when autoDismissMs > 0
 *
 * Severity → color mapping (Flint token palette only):
 *   success → emerald
 *   warning → amber
 *   error   → red
 *   info    → indigo
 *
 * Mithril Safety: all classes from Flint design token palette only.
 */

import { useEffect } from 'react';
import { X, Check, AlertTriangle, XCircle, Info } from 'lucide-react';
import { useNotificationStore } from '../../store/notificationStore';
import type { Notification } from '../../store/notificationStore';

// ── Severity helpers ──────────────────────────────────────────────────────────

interface SeverityStyle {
  bar: string;
  icon: React.ReactNode;
  title: string;
  border: string;
  action: string;
}
function severityStyle(severity: Notification['severity']): SeverityStyle {
  switch (severity) {
    case 'critical':
      // Persistent hard-blocker — bright red, visually distinct from error
      return {
        bar: 'bg-red-600',
        icon: <XCircle size={13} className="text-red-300" />,
        title: 'text-red-300',
        border: 'border-red-600/60',
        action: 'text-red-300 hover:text-red-200'
      };
    case 'success':
      return {
        bar: 'bg-emerald-500',
        icon: <Check size={13} className="text-emerald-400" />,
        title: 'text-emerald-400',
        border: 'border-emerald-800/40',
        action: 'text-emerald-400 hover:text-emerald-300'
      };
    case 'warning':
      return {
        bar: 'bg-amber-500',
        icon: <AlertTriangle size={13} className="text-amber-400" />,
        title: 'text-amber-400',
        border: 'border-amber-800/40',
        action: 'text-amber-400 hover:text-amber-300'
      };
    case 'error':
      return {
        bar: 'bg-red-500',
        icon: <XCircle size={13} className="text-red-400" />,
        title: 'text-red-400',
        border: 'border-red-800/40',
        action: 'text-red-400 hover:text-red-300'
      };
    case 'info':
    default:
      return {
        bar: 'bg-indigo-500',
        icon: <Info size={13} className="text-indigo-400" />,
        title: 'text-indigo-400',
        border: 'border-indigo-800/40',
        action: 'text-indigo-400 hover:text-indigo-300'
      };
  }
}

// ── ToastCard ─────────────────────────────────────────────────────────────────

interface ToastCardProps {
  notification: Notification;
}
function ToastCard({
  notification
}: ToastCardProps) {
  const dismiss = useNotificationStore(s => s.dismiss);
  const style = severityStyle(notification.severity);

  // Auto-dismiss via timeout
  useEffect(() => {
    if (!notification.autoDismissMs) return;
    const timer = setTimeout(() => {
      dismiss(notification.id);
    }, notification.autoDismissMs);
    return () => clearTimeout(timer);
  }, [notification.id, notification.autoDismissMs, dismiss]);
  return <div className={`flex w-full max-w-sm overflow-hidden rounded-lg border bg-zinc-900 shadow-xl ${style.border}`} role="alert" aria-live="polite">
            {/* Left severity bar */}
            <div className={`w-1 shrink-0 ${style.bar}`} />

            {/* Content */}
            <div className="flex min-w-0 flex-1 items-start gap-2.5 px-3 py-2.5">
                <span className="mt-0.5 shrink-0">{style.icon}</span>

                <div className="min-w-0 flex-1">
                    <p className={`text-xs font-semibold leading-snug ${style.title}`}>
                        {notification.title}
                    </p>
                    {notification.message && <p className="mt-0.5 text-xs leading-snug text-zinc-400">
                            {notification.message}
                        </p>}
                    {notification.actionLabel && notification.actionCallback && <button type="button" onClick={() => {
          notification.actionCallback?.();
          dismiss(notification.id);
        }} className={`mt-1.5 text-xs font-medium underline underline-offset-2 transition-colors ${style.action}`}>
                            {notification.actionLabel}
                        </button>}
                </div>

                {/* Dismiss button */}
                <button type="button" onClick={() => dismiss(notification.id)} aria-label="Dismiss notification" className="ml-1 shrink-0 rounded p-0.5 text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-zinc-300">
                    <X size={12} />
                </button>
            </div>
        </div>;
}

// ── NotificationCenter ────────────────────────────────────────────────────────

export function NotificationCenter() {
  const notifications = useNotificationStore(s => s.notifications);
  if (notifications.length === 0) return null;
  return <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2" aria-label="Notifications">
            {notifications.map(n => <ToastCard key={n.id} notification={n} />)}
        </div>;
}