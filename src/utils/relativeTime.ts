/**
 * Formats a timestamp or ISO date string as a human-readable relative time.
 * Examples: "just now", "5m ago", "2h ago", "3d ago"
 */
export function formatRelativeTime(input: number | string | null | undefined): string {
    if (input == null) return ''
    const ms = typeof input === 'number' ? Date.now() - input : Date.now() - new Date(input).getTime()
    const mins = Math.floor(ms / 60_000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
}
