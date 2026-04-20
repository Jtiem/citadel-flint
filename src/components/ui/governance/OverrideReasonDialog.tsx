/**
 * OverrideReasonDialog.tsx — src/components/ui/governance/OverrideReasonDialog.tsx
 *
 * CHRON.1-repair M3: Modal reason-capture for user-initiated rule overrides.
 *
 * Fills the gap where CHRON.1's reason pipeline was only wired to AI-proposed
 * mutations (DiffCard path). User-initiated overrides from ViolationCard had
 * no reason prompt — this dialog is the missing surface.
 *
 * Risk-tier gating:
 *   - Red   (critical | 'red')  → reason REQUIRED (>= 10 chars non-whitespace);
 *                                 submit button disabled until threshold met.
 *   - Amber (everything else)   → reason OPTIONAL; two buttons presented —
 *                                 "Override with reason" (primary, active only
 *                                 when reason is non-empty) and
 *                                 "Override without reason" (secondary).
 *
 * UX contract:
 *   - Escape / backdrop click fires onClose.
 *   - First focus lands on the textarea.
 *   - Enter alone inserts a newline; Cmd/Ctrl+Enter submits (so teammates can
 *     write multi-line reasons without mis-firing the Apply button).
 *   - Textarea is hard-capped at 2000 characters.
 *   - Reason is passed up trimmed but NOT sanitized here — sanitization
 *     happens at the IPC/storage layer (see CHRON.1-repair C5).
 *
 * Mithril compliance:
 *   - MUI components so sizing/spacing come from the theme; no hardcoded hex.
 *   - data-flint-id is not required (this component is not canvas-selectable).
 */

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material';

// ── Types ─────────────────────────────────────────────────────────────────────

/** Severities accepted from ViolationCard (LinterWarning.severity) and
 *  from risk-tier derivation ('red' | 'amber'). */
export type OverrideSeverity = 'critical' | 'warn' | 'info' | 'red' | 'amber' | 'advisory';

/** Internal risk tier derived from severity. No Green — Green-risk overrides
 *  bypass confirmation entirely and never surface this dialog. */
type RiskTier = 'red' | 'amber';
export interface OverrideReasonDialogProps {
  open: boolean;
  onClose: () => void;
  /** Fires with the reason text (trimmed) or undefined when user opts out
   *  of providing one (Amber tier only). Never called on Red tier without
   *  a reason — the button is disabled. */
  onConfirm: (reason?: string) => void;
  /** Raw rule ID, e.g. "A11Y-031". Shown after the human title. */
  ruleId: string;
  /** Plain-English rule title, e.g. "Color contrast below 4.5:1". */
  ruleTitle: string;
  /** Severity from the underlying LinterWarning. */
  severity: OverrideSeverity;
  /** Optional file path — shown as subtle context below the rule line. */
  filePath?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_REASON_CHARS = 2000;
const MIN_RED_REASON_CHARS = 10;

/** Map incoming severity → internal risk tier. */
export function severityToTier(severity: OverrideSeverity): RiskTier {
  if (severity === 'critical' || severity === 'red') return 'red';
  return 'amber';
}

// ── Component ─────────────────────────────────────────────────────────────────

export function OverrideReasonDialog({
  open,
  onClose,
  onConfirm,
  ruleId,
  ruleTitle,
  severity,
  filePath
}: OverrideReasonDialogProps) {
  const tier = useMemo(() => severityToTier(severity), [severity]);
  const [reason, setReason] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Reset state whenever the dialog opens (covers re-use across violations).
  useEffect(() => {
    if (open) {
      setReason('');
    }
  }, [open]);

  // Autofocus the textarea when the dialog opens. MUI's default focus lands
  // on the first interactive element — the textarea qualifies, but we force
  // it explicitly so screen readers announce the input label promptly.
  useEffect(() => {
    if (!open) return;
    // Defer one frame so MUI's portal/transition has attached the node.
    const raf = requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [open]);
  const trimmed = reason.trim();
  const trimmedLength = trimmed.length;
  const redReady = tier === 'red' && trimmedLength >= MIN_RED_REASON_CHARS;
  const amberHasReason = tier === 'amber' && trimmedLength > 0;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleChange = (value: string) => {
    // Hard-cap at MAX_REASON_CHARS regardless of how much was pasted.
    setReason(value.length > MAX_REASON_CHARS ? value.slice(0, MAX_REASON_CHARS) : value);
  };
  const handleSubmitWithReason = () => {
    if (tier === 'red' && !redReady) return;
    onConfirm(trimmed);
  };
  const handleSubmitWithoutReason = () => {
    // Amber-only path — undefined signals "user waived the reason".
    onConfirm(undefined);
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Cmd/Ctrl + Enter submits the primary action. Plain Enter inserts
    // a newline (default textarea behavior).
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      if (tier === 'red') {
        if (redReady) onConfirm(trimmed);
      } else {
        // Amber with content uses "with reason" path;
        // amber with no content is a no-op (user must click explicitly).
        if (amberHasReason) onConfirm(trimmed);
      }
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const titleLine = `Override: ${ruleTitle} (${ruleId})`;
  return <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
  // Expose testable ids without polluting the DOM with data-testid's
  // that MUI strips at the root. MUI forwards data-* via slotProps.
  slotProps={{
    paper: {
      'data-testid': 'override-reason-dialog'
      // Avoid aria-hidden on the paper — MUI handles focus trap
      // via the parent Modal. Keep role="dialog" implicit.
    } as Record<string, unknown>
  }} aria-labelledby="override-reason-dialog-title">
            <DialogTitle id="override-reason-dialog-title" sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 2,
      pr: 2
    }}>
                <Typography component="span" variant="subtitle1" sx={{
        fontWeight: 600,
        minWidth: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }}>
                    {titleLine}
                </Typography>
                {tier === 'red' ? <Chip label="Required" color="error" size="small" data-testid="override-tier-chip" aria-label="Reason required for this high-risk override" /> : <Chip label="Recommended" color="warning" size="small" data-testid="override-tier-chip" aria-label="Reason recommended for this override" />}
            </DialogTitle>

            <DialogContent dividers>
                {filePath && <Typography variant="caption" component="p" color="text.secondary" data-testid="override-file-path" sx={{
        mb: 1.5,
        wordBreak: 'break-all'
      }}>
                        {filePath}
                    </Typography>}

                <Typography variant="body2" color="text.secondary" sx={{
        mb: 1.5
      }}>
                    {tier === 'red' ? 'This rule blocks export. Record why the override is justified so teammates and auditors can review later.' : 'Leave a short note so teammates know why this rule was waived. This is optional but recommended.'}
                </Typography>

                <TextField inputRef={textareaRef} label="Reason" placeholder="Why are you overriding this rule? (e.g., 'Waived per Legal memo dated 2026-04-10')" multiline maxRows={6} minRows={3} fullWidth value={reason} onChange={e => handleChange(e.target.value)} onKeyDown={handleKeyDown} autoFocus slotProps={{
        htmlInput: {
          'data-testid': 'override-reason-textarea',
          'aria-label': 'Override reason',
          maxLength: MAX_REASON_CHARS
        }
      }} helperText={reason.length > 0 ? `${reason.length} / ${MAX_REASON_CHARS}` : tier === 'red' ? `At least ${MIN_RED_REASON_CHARS} characters required` : ' '} />
            </DialogContent>

            <DialogActions sx={{
      px: 3,
      py: 2,
      gap: 1
    }}>
                <Button onClick={onClose} color="inherit" data-testid="override-cancel-btn">
                    Cancel
                </Button>

                {tier === 'amber' && <Button onClick={handleSubmitWithoutReason} variant="outlined" color="warning" data-testid="override-without-reason-btn" aria-label="Override without providing a reason">
                        Override without reason
                    </Button>}

                {tier === 'amber' ? <Button onClick={handleSubmitWithReason} variant="contained" color="warning" disabled={!amberHasReason} data-testid="override-with-reason-btn" aria-label="Override with the reason you typed">
                        Override with reason
                    </Button> : <Button onClick={handleSubmitWithReason} variant="contained" color="error" disabled={!redReady} data-testid="override-submit-btn" aria-label="Override this critical issue with the reason you typed">
                        Override rule
                    </Button>}
            </DialogActions>
        </Dialog>;
}