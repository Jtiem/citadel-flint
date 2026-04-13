/**
 * Sanitises an error message for display in a toast notification.
 * - Replaces absolute paths with their basename to avoid leaking usernames/directory structure
 * - Caps length at 120 characters
 *
 * Note: uses regex instead of Node.js `path` module — this runs in the browser renderer.
 */
export function sanitiseToastMessage(message: string): string {
  // Replace Unix absolute paths (e.g. /Users/justin/project/src/Button.tsx → Button.tsx)
  // Replace Windows absolute paths (e.g. C:\Users\justin\project\src\Button.tsx → Button.tsx)
  const sanitised = message
    .replace(/(?:\/[^\s/]+)+\/([^\s/]+)/g, '$1')
    .replace(/(?:[A-Z]:\\)?(?:[^\s\\]+\\)+([^\s\\]+)/gi, '$1')

  return sanitised.length > 120 ? sanitised.slice(0, 117) + '...' : sanitised
}
