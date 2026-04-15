/**
 * useGovernanceMcpActivity — src/hooks/useGovernanceMcpActivity.ts
 *
 * H15: MCP activity log feed state.
 *
 * Extracts the MCP activity feed logic from GovernanceDashboard.tsx
 * (lines ~1537–1550).
 *
 * The feed is derived from the notification store's history — we only surface
 * events that actually fired this session (mutation / violation / sync types).
 * The most recent 20 events are returned in reverse chronological order.
 *
 * `isStreaming` is true when an MCP tool call is in-flight (subscribes to
 * the notificationStore for live activity). Currently a static false since
 * the in-flight state lives in orchestratorStore (out of scope for H15).
 *
 * Zero .getState() in render path.
 */

import { useMemo } from 'react'
import { useNotificationStore } from '../store/notificationStore'
import type { UseGovernanceMcpActivityResult } from '../../.flint-context/contracts/sprint-2-glass-ui-fixes.contract'

export type { UseGovernanceMcpActivityResult }

export function useGovernanceMcpActivity(): UseGovernanceMcpActivityResult {
    const history = useNotificationStore((s) => s.history)

    const feed = useMemo(
        () =>
            history
                .filter((n) => n.type === 'mutation' || n.type === 'violation' || n.type === 'sync')
                .slice(-20)
                .reverse(),
        [history],
    )

    return {
        feed,
        // isStreaming is false until the orchestratorStore integration is wired
        // by the Group E refactor. H15 owns only the feed slice.
        isStreaming: false,
    }
}
