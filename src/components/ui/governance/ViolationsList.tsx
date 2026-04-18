/**
 * ViolationsList.tsx — C6 extraction from GovernanceDashboard
 *
 * Renders the full violations section including:
 *   - BatchActionBar (batch fix CTAs)
 *   - Resurfaced section header
 *   - Mithril ViolationCard list
 *   - A11y ViolationCard list
 *   - Deferred section header
 *   - Overrides row
 *
 * Pure presentational — all data and callbacks passed via props.
 * No Zustand reads, no IPC calls.
 *
 * Mithril compliance:
 * - No hardcoded hex colours — token palette only.
 * - No arbitrary spacing — 4px grid scale only.
 */

import type { LinterWarning, ProvenanceInfo } from '../../../types/flint-api'
import type { FixableItem } from '../FixPreviewDrawer'
import type { DeferDuration } from '../../../../shared/deferralUtils'
import { ViolationCard, extractHardcodedClassFromMsg, extractRuleIdFromMsg } from './ViolationCard'
import { BatchActionBar } from './BatchActionBar'

// ── Mithril card row data ─────────────────────────────────────────────────────

export interface MithrilCardData {
    warning: LinterWarning
    cardKey: string
    isPinned: boolean
    isFlagged: boolean
    isDeferred: boolean
    deferExpiresAtMs: number | null
    isDeferSuccess: boolean
    deferSuccessMsg: string | undefined
    isResurfaced: boolean
    isAiSourced: boolean
    isExpanded: boolean
    isDiffOpen: boolean
    isDiffLoading: boolean
    diffData: { current: string; proposed: string; tokenName: string; isColor: boolean } | null
    isDeferFormOpen: boolean
    fixItem: FixableItem | null
    provenance: ProvenanceInfo | null
    deferReason: string
    deferDuration: DeferDuration
    navigationIndex: number | null
    // CHRON.1 UX A+: past override decoration for this rule + file
    overrideReason: string | null
    overrideActor: string | null
    overrideTimestamp: string | null
}

// ── A11y card row data ────────────────────────────────────────────────────────

export interface A11yCardData {
    warning: LinterWarning
    cardKey: string
    indexInList: number
    isPinned: boolean
    isFlagged: boolean
    isDeferred: boolean
    deferExpiresAtMs: number | null
    isDeferSuccess: boolean
    deferSuccessMsg: string | undefined
    isResurfaced: boolean
    isAiSourced: boolean
    isExpanded: boolean
    isDeferFormOpen: boolean
    provenance: ProvenanceInfo | null
    deferReason: string
    deferDuration: DeferDuration
    navigationIndex: number | null
    // CHRON.1 UX A+: past override decoration for this rule + file
    overrideReason: string | null
    overrideActor: string | null
    overrideTimestamp: string | null
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ViolationsListProps {
    // Mithril cards
    mithrilCards: MithrilCardData[]

    // A11y cards
    a11yCards: A11yCardData[]

    // Resurface state
    resurfacedCardKeys: Set<string>
    resurfaceTick: number

    // Deferred state
    deferredCardKeys: Set<string>

    // Overrides
    overridesExist: boolean

    // BatchActionBar props
    acceptedCount: number
    autoFixableCount: number
    a11yFixableCount: number
    manualCount: number
    sessionProgress?: { fixed: number; total: number }
    isBaselineSet: boolean
    effortEstimate: string

    // Active file path (for diff previews)
    activeFilePath: string | null

    // Node name resolver
    getNodeName: (id: string) => string

    // BatchActionBar callbacks
    onApplyAccepted: () => void
    onAutoFixMithril: () => void
    onFixAllA11y: () => void
    onReviewManual: () => void

    // Per-mithril-card callbacks (key → handler)
    onToggleExpand: (key: string) => void
    onFix: (key: string, fixItem: FixableItem) => void
    onPreviewFix: (key: string) => void
    onAcceptFix: (key: string, fixItem: FixableItem) => void
    onSkipFix: (key: string) => void
    onFlag: (key: string) => void
    onUnflag: (key: string) => void
    onDefer: (key: string, d: DeferDuration) => void
    onDeferReasonChange: (key: string, r: string) => void
    onDeferDurationChange: (key: string, d: DeferDuration) => void
    onSubmitDefer: (key: string) => void
    onCancelDefer: (key: string) => void
    onPin: (key: string) => void
    /**
     * CHRON.1-repair M3: Fires when the user confirms a rule override for a
     * specific violation card via OverrideReasonDialog. The reason is already
     * trimmed (or undefined when the user waived it on an Amber-tier dialog).
     * Optional — when omitted, no Override button is rendered in the card footer.
     */
    onOverride?: (key: string, reason?: string) => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ViolationsList({
    mithrilCards,
    a11yCards,
    resurfacedCardKeys,
    resurfaceTick,
    deferredCardKeys,
    overridesExist,
    acceptedCount,
    autoFixableCount,
    a11yFixableCount,
    manualCount,
    sessionProgress,
    isBaselineSet,
    effortEstimate,
    activeFilePath,
    getNodeName,
    onApplyAccepted,
    onAutoFixMithril,
    onFixAllA11y,
    onReviewManual,
    onToggleExpand,
    onFix,
    onPreviewFix,
    onAcceptFix,
    onSkipFix,
    onFlag,
    onUnflag,
    onDefer,
    onDeferReasonChange,
    onDeferDurationChange,
    onSubmitDefer,
    onCancelDefer,
    onPin,
    onOverride,
}: ViolationsListProps) {
    return (
        <div>
            {/* BatchActionBar — batch fix CTAs */}
            <BatchActionBar
                acceptedCount={acceptedCount}
                autoFixableCount={autoFixableCount}
                a11yFixableCount={a11yFixableCount}
                manualCount={manualCount}
                onApplyAccepted={onApplyAccepted}
                onAutoFixMithril={onAutoFixMithril}
                onFixAllA11y={onFixAllA11y}
                onReviewManual={onReviewManual}
                sessionProgress={sessionProgress}
                isBaselineSet={isBaselineSet}
                effortEstimate={effortEstimate}
            />

            {/* Violation cards — expandable action items, sectioned by state */}
            <div className="divide-y divide-zinc-800/50" data-testid="violations-list">

                {/* COUNSEL.2.3: Resurfaced violations — shown at top with amber badge */}
                {resurfacedCardKeys.size > 0 && (
                    <div data-testid="resurfaced-section">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-900/10 border-b border-amber-700/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" aria-hidden="true" />
                            <span className="text-[10px] font-medium uppercase tracking-wider text-amber-400">Resurfaced</span>
                        </div>
                    </div>
                )}

                {/* Mithril violation cards */}
                {mithrilCards.map((card) => {
                    void resurfaceTick
                    return (
                        <ViolationCard
                            key={card.cardKey}
                            issue={card.warning}
                            type="mithril"
                            cardKey={card.cardKey}
                            isPinned={card.isPinned}
                            isFlagged={card.isFlagged}
                            isDeferred={card.isDeferred}
                            deferExpiresAtMs={card.deferExpiresAtMs}
                            isDeferSuccess={card.isDeferSuccess}
                            deferSuccessMsg={card.deferSuccessMsg}
                            resurfaceTick={resurfaceTick}
                            isResurfaced={card.isResurfaced}
                            isAiSourced={card.isAiSourced}
                            isExpanded={card.isExpanded}
                            isDiffOpen={card.isDiffOpen}
                            isDiffLoading={card.isDiffLoading}
                            diffData={card.diffData}
                            isDeferFormOpen={card.isDeferFormOpen}
                            fixItem={card.fixItem}
                            provenance={card.provenance}
                            deferReason={card.deferReason}
                            deferDuration={card.deferDuration}
                            onToggleExpand={() => onToggleExpand(card.cardKey)}
                            onFix={() => card.fixItem && onFix(card.cardKey, card.fixItem)}
                            onPreviewFix={() => onPreviewFix(card.cardKey)}
                            onAcceptFix={() => card.fixItem && onAcceptFix(card.cardKey, card.fixItem)}
                            onSkipFix={() => onSkipFix(card.cardKey)}
                            onFlag={() => onFlag(card.cardKey)}
                            onUnflag={() => onUnflag(card.cardKey)}
                            onDefer={(d) => onDefer(card.cardKey, d)}
                            onDeferReasonChange={(r) => onDeferReasonChange(card.cardKey, r)}
                            onDeferDurationChange={(d) => onDeferDurationChange(card.cardKey, d)}
                            onSubmitDefer={() => onSubmitDefer(card.cardKey)}
                            onCancelDefer={() => onCancelDefer(card.cardKey)}
                            onPin={() => onPin(card.cardKey)}
                            onOverride={onOverride ? (reason) => onOverride(card.cardKey, reason) : undefined}
                            getNodeName={getNodeName}
                            activeFilePath={activeFilePath}
                            navigationIndex={card.navigationIndex}
                            overrideReason={card.overrideReason}
                            overrideActor={card.overrideActor}
                            overrideTimestamp={card.overrideTimestamp}
                        />
                    )
                })}

                {/* A11y violation cards */}
                {a11yCards.map((card) => {
                    void resurfaceTick
                    return (
                        <ViolationCard
                            key={card.cardKey}
                            issue={card.warning}
                            type="a11y"
                            cardKey={card.cardKey}
                            indexInList={card.indexInList}
                            isPinned={card.isPinned}
                            isFlagged={card.isFlagged}
                            isDeferred={card.isDeferred}
                            deferExpiresAtMs={card.deferExpiresAtMs}
                            isDeferSuccess={card.isDeferSuccess}
                            deferSuccessMsg={card.deferSuccessMsg}
                            resurfaceTick={resurfaceTick}
                            isResurfaced={card.isResurfaced}
                            isAiSourced={card.isAiSourced}
                            isExpanded={card.isExpanded || card.isPinned}
                            isDeferFormOpen={card.isDeferFormOpen}
                            fixItem={null}
                            diffData={null}
                            isDiffOpen={false}
                            isDiffLoading={false}
                            provenance={card.provenance}
                            deferReason={card.deferReason}
                            deferDuration={card.deferDuration}
                            onToggleExpand={() => onToggleExpand(card.cardKey)}
                            onFix={() => { /* a11y violations use handleA11yFix in parent */ }}
                            onPreviewFix={() => { /* no inline diff for a11y */ }}
                            onAcceptFix={() => { /* no inline diff for a11y */ }}
                            onSkipFix={() => { /* no inline diff for a11y */ }}
                            onFlag={() => onFlag(card.cardKey)}
                            onUnflag={() => onUnflag(card.cardKey)}
                            onDefer={(d) => onDefer(card.cardKey, d)}
                            onDeferReasonChange={(r) => onDeferReasonChange(card.cardKey, r)}
                            onDeferDurationChange={(d) => onDeferDurationChange(card.cardKey, d)}
                            onSubmitDefer={() => onSubmitDefer(card.cardKey)}
                            onCancelDefer={() => onCancelDefer(card.cardKey)}
                            onPin={() => onPin(card.cardKey)}
                            onOverride={onOverride ? (reason) => onOverride(card.cardKey, reason) : undefined}
                            getNodeName={getNodeName}
                            activeFilePath={activeFilePath}
                            navigationIndex={card.navigationIndex}
                            overrideReason={card.overrideReason}
                            overrideActor={card.overrideActor}
                            overrideTimestamp={card.overrideTimestamp}
                        />
                    )
                })}

                {/* COUNSEL.2.1: Deferred section — muted cards at the bottom */}
                {deferredCardKeys.size > 0 && (
                    <div data-testid="deferred-section">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900/50 border-b border-zinc-800/40 border-t border-t-zinc-800/40">
                            <span className="h-1.5 w-1.5 rounded-full bg-zinc-600 shrink-0" aria-hidden="true" />
                            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                                Deferred ({deferredCardKeys.size})
                            </span>
                        </div>
                    </div>
                )}

                {/* Overrides */}
                {overridesExist && (
                    <div className="flex items-start gap-2 px-3 py-2">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden="true" />
                        <div className="flex-1">
                            <p className="text-[10px] text-zinc-300 font-medium">Unapplied Overrides</p>
                            <p className="text-[10px] text-zinc-400">Property overrides are blocking export. Apply or revert them to unblock.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

// Re-export helpers so callers that use ViolationsList can access them without
// reaching into ViolationCard directly.
export { extractHardcodedClassFromMsg, extractRuleIdFromMsg }
