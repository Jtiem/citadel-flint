import { useState } from 'react';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';

// Design tokens — sourced from .flint/design-tokens.json
const tokens = {
  colorPrimary:        '#0066FF',
  colorSurface:        '#FFFFFF',
  colorSurfaceRaised:  '#F8F9FA',
  colorOnSurface:      '#111827',
  colorOnSurfaceMuted: '#6B7280',
  colorDanger:         '#DC2626',
  colorBorder:         '#E5E7EB',
  shadowLg:            '0 10px 15px -3px rgba(0,0,0,0.10), 0 4px 6px -2px rgba(0,0,0,0.05)',
} as const;

export default function LoginScreen() {
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [loading, setLoading]           = useState(false);

  const handleSubmit = () => {
    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }
    setError(null);
    setLoading(true);
    // Wire to auth provider here
    setLoading(false);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: tokens.colorSurfaceRaised,
      }}
    >
      <main
        aria-labelledby="login-heading"
        style={{
          width: '100%',
          maxWidth: '400px',
          backgroundColor: tokens.colorSurface,
          borderRadius: '12px',
          padding: '40px',
          boxShadow: tokens.shadowLg,
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1
            id="login-heading"
            style={{
              fontSize: '24px',
              fontWeight: 700,
              color: tokens.colorOnSurface,
              margin: 0,
            }}
          >
            Welcome back
          </h1>
          <p
            style={{
              fontSize: '14px',
              color: tokens.colorOnSurfaceMuted,
              marginTop: '8px',
              marginBottom: 0,
            }}
          >
            Sign in to your account
          </p>
        </div>

        {/* Email */}
        <div style={{ marginBottom: '16px' }}>
          <label
            htmlFor="login-email"
            style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 500,
              color: tokens.colorOnSurface,
              marginBottom: '6px',
            }}
          >
            Email address
          </label>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-required="true"
            disabled={loading}
          />
        </div>

        {/* Password */}
        <div style={{ marginBottom: '24px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: '6px',
            }}
          >
            <label
              htmlFor="login-password"
              style={{
                fontSize: '14px',
                fontWeight: 500,
                color: tokens.colorOnSurface,
              }}
            >
              Password
            </label>
            <nav aria-label="Account links">
              <a
                href="#forgot"
                style={{
                  fontSize: '12px',
                  color: tokens.colorPrimary,
                  textDecoration: 'none',
                }}
              >
                Forgot password?
              </a>
            </nav>
          </div>
          <div style={{ position: 'relative' }}>
            <Input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-required="true"
              disabled={loading}
              style={{ paddingRight: '40px' }}
            />
            <div
              style={{
                position: 'absolute',
                right: '6px',
                top: '50%',
                transform: 'translateY(-50%)',
              }}
            >
              <IconButton
                icon="info"
                size="sm"
                label="Toggle password visibility"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((v) => !v)}
                type="button"
                disabled={loading}
              />
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div
            role="alert"
            style={{
              border: `1px solid ${tokens.colorDanger}`,
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '16px',
              fontSize: '14px',
              color: tokens.colorDanger,
            }}
          >
            {error}
          </div>
        )}

        {/* Submit */}
        <div style={{ width: '100%' }} role="group" aria-label="Form actions">
          <Button
            primary
            size="large"
            label={loading ? 'Signing in…' : 'Sign in'}
            onClick={handleSubmit}
          />
        </div>
      </main>
    </div>
  );
}