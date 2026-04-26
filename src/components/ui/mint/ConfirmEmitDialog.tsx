/**
 * ConfirmEmitDialog — src/components/ui/mint/ConfirmEmitDialog.tsx
 *
 * MINT.5 Phase 3 — Confirm dialog for write-mode emit (Scout).
 *
 * Shown before `flint_emit_tokens` is invoked with `dryRun: false`. Mirrors
 * the FocusTrap pattern from ConfirmPushDialog but with asymmetric initial
 * focus: the Cancel button receives initial focus (not Confirm) because
 * write-to-disk is destructive and we bias against accidental confirmation.
 *
 * Contract satisfied:
 *   - role="dialog" + aria-modal="true"
 *   - FocusTrap cycles Tab/Shift+Tab within the dialog
 *   - Escape fires onCancel (via FocusTrap.onClose)
 *   - Initial focus lands on Cancel (asymmetric — destructive action bias)
 *   - onConfirm is guarded by a ref so double-clicks cannot double-fire
 *   - Resolved outputDir is shown in the dialog body
 *   - Platform list rendered as a comma-separated human-readable string
 *
 * Contract: MINT.5-phase3.contract.ts — ConfirmEmitDialogProps
 * Commandments: 5 (A11y), 1 (Code is Truth — destructive write gated here)
 *
 * Renderer Process only — no Node.js imports.
 */

import { useId, useRef } from 'react'
import { Upload } from 'lucide-react'
import { FocusTrap } from '../FocusTrap'
import type { ConfirmEmitDialogProps } from '../../../../.flint-context/contracts/MINT.5-phase3.contract'

// ── Platform display labels ───────────────────────────────────────────────────

const PLATFORM_LABELS: Record<string, string> = {
  css:            'CSS variables',
  tailwind:       'Tailwind config',
  'react-native': 'React Native',
  swift:          'Swift',
  kotlin:         'Kotlin',
}

function formatPlatformList(platforms: string[]): string {
  return platforms.map(p => PLATFORM_LABELS[p] ?? p).join(', ')
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ConfirmEmitDialog({
  isOpen,
  platforms,
  outputDir,
  onConfirm,
  onCancel,
}: ConfirmEmitDialogProps) {
  const titleId = useId()
  const descriptionId = useId()

  // Cancel receives initial focus — bias against accidental destructive confirm.
  const cancelBtnRef = useRef<HTMLButtonElement>(null)

  // Guard against double-clicks on the confirm button.
  const confirmedRef = useRef(false)

  if (!isOpen) return null

  const platformList = formatPlatformList(platforms)

  function handleConfirm() {
    if (confirmedRef.current) return
    confirmedRef.current = true
    onConfirm()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      data-testid="confirm-emit-dialog-root"
    >
      {/* Backdrop — aria-hidden, layout only. */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-hidden="true"
      />

      <FocusTrap
        initialFocusRef={cancelBtnRef as React.RefObject<HTMLElement>}
        onClose={onCancel}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          data-testid="confirm-emit-dialog"
          className="relative flex w-full max-w-md flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl"
        >
          {/* ── Header ── */}
          <div className="flex shrink-0 items-start gap-3 border-b border-zinc-800 px-5 py-4">
            <Upload
              className="mt-0.5 h-5 w-5 shrink-0 text-indigo-400"
              aria-hidden="true"
            />
            <div className="flex-1">
              <h2 id={titleId} className="text-sm font-semibold text-white">
                Emit tokens to disk?
              </h2>
            </div>
          </div>

          {/* ── Body ── */}
          <div className="px-5 py-4" id={descriptionId}>
            <p className="mb-3 text-sm text-zinc-300">
              The following platform files will be written to{' '}
              <span
                className="font-mono text-xs text-zinc-100 bg-zinc-800 px-1.5 py-0.5 rounded"
                data-testid="confirm-emit-output-dir"
              >
                {outputDir}
              </span>
            </p>
            <p className="text-sm text-zinc-300">
              <span className="font-medium text-zinc-100">Platforms: </span>
              <span data-testid="confirm-emit-platform-list">{platformList}</span>
            </p>
          </div>

          {/* ── Footer ── */}
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-zinc-800 px-5 py-3">
            <button
              ref={cancelBtnRef}
              type="button"
              onClick={onCancel}
              data-testid="confirm-emit-cancel"
              className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              data-testid="confirm-emit-confirm"
              className="rounded-md border border-indigo-600 bg-indigo-600/20 px-3 py-1.5 text-xs font-semibold text-indigo-100 transition-colors hover:bg-indigo-600/30"
            >
              Emit to disk
            </button>
          </div>
        </div>
      </FocusTrap>
    </div>
  )
}
