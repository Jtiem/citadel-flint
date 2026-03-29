import React from 'react';

// Grade D — 5 violations
// VIOLATION: color #e85d04 (ΔE 4.1 from feedback.warning #f59e0b)
// VIOLATION: color #1e40af (close to brand.primary but not token)
// VIOLATION: font-size 13px (not in scale)
// VIOLATION: missing role="alert" for screen readers
// VIOLATION: close button has no aria-label

interface AlertBannerProps {
  message: string;
  type?: 'warning' | 'error';
  onDismiss?: () => void;
}

export function AlertBanner({ message, type = 'warning', onDismiss }: AlertBannerProps) {
  const bgColor = type === 'error' ? '#fee2e2' : '#fef3c7';

  return (
    // VIOLATION: missing role="alert"
    <div style={{
      backgroundColor: bgColor,
      border: `1px solid ${type === 'error' ? '#fca5a5' : '#fcd34d'}`,
      borderRadius: '8px',
      padding: '12px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }}>
      <span style={{
        fontSize: '13px',        // VIOLATION: not in scale
        color: type === 'error' ? '#991b1b' : '#e85d04'   // VIOLATION: #e85d04 ΔE 4.1
      }}>
        {message}
      </span>
      {onDismiss && (
        // VIOLATION: no aria-label
        <button onClick={onDismiss} style={{ background: 'none', border: 'none', color: '#1e40af', cursor: 'pointer' }}>
          {/* VIOLATION: #1e40af close to brand but not token */}
          ✕
        </button>
      )}
    </div>
  );
}
