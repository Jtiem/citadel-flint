export const TOKENS = {
  // --- COLOR PALETTE ---
  colors: {
    // Primitives
    white: '#FFFFFF',
    black: '#000000',
    gray: {
      50: '#F9FAFB',
      100: '#F3F4F6',
      200: '#E5E7EB',
      300: '#D1D5DB',
      400: '#9CA3AF',
      500: '#6B7280',
      900: '#111827',
    },
    brand: {
      vibrant: '#FF4A00', // Primary Action
      vibrantHover: '#D13D00',
    },
    // Semantics
    bg: {
      primary: '#FFFFFF',
      secondary: '#F3F4F6',
      accent: '#FF4A00',
    },
    text: {
      primary: '#111827',
      secondary: '#6B7280',
      inverted: '#FFFFFF',
      accent: '#FF4A00',
    },
    border: {
      thin: '#E5E7EB',
      heavy: '#111827',
      accent: '#FF4A00',
    }
  },

  // --- TYPOGRAPHY (Major Third Scale: 1.25) ---
  typography: {
    fonts: {
      heading: '"Space Grotesk", "Helvetica Neue", sans-serif',
      body: '"Space Grotesk", sans-serif',
      mono: '"JetBrains Mono", "Courier New", monospace',
    },
    sizes: {
      xs: '0.75rem',    // 12px
      sm: '0.875rem',   // 14px
      base: '1rem',      // 16px
      lg: '1.25rem',     // 20px
      xl: '1.563rem',    // 25px
      '2xl': '1.953rem',  // 31px
      '3xl': '2.441rem',  // 39px
      '4xl': '3.052rem',  // 49px
      '5xl': '3.815rem',  // 61px
    },
    weights: {
      normal: 400,
      medium: 500,
      bold: 700,
    },
    lineHeights: {
      none: 1,
      tight: 1.1,
      snug: 1.3,
      normal: 1.5,
      relaxed: 1.7,
    }
  },

  // --- GEOMETRY & SPACING (8px Grid) ---
  spacing: {
    0: '0rem',
    1: '0.25rem', // 4px
    2: '0.5rem',  // 8px
    3: '0.75rem', // 12px
    4: '1rem',    // 16px
    5: '1.25rem', // 20px
    6: '1.5rem',  // 24px
    8: '2rem',    // 32px
    10: '2.5rem', // 40px
    12: '3rem',   // 48px
    16: '4rem',   // 64px
    20: '5rem',   // 80px
  },

  // --- BORDERS & RADII (Crucial for the Angular Look) ---
  shape: {
    borderRadius: '0px', // Strict ban on rounded corners
    borderWidth: {
      hairline: '1px',
      thin: '2px',
      heavy: '4px',
    }
  },

  // --- HARD ELEVATION (No soft blurs allowed) ---
  shadows: {
    sm: '2px 2px 0px 0px #111827',
    md: '4px 4px 0px 0px #111827',
    lg: '8px 8px 0px 0px #111827',
    accentSm: '2px 2px 0px 0px #FF4A00',
    accentMd: '4px 4px 0px 0px #FF4A00',
    accentLg: '8px 8px 0px 0px #FF4A00',
  },

  // --- THE FORGOTTEN TOKENS ---
  
  // 1. Focus Rings (To replace default browser focus glows)
  focus: {
    ring: '2px solid #FF4A00',
    offset: '2px solid #FFFFFF',
  },

  // 2. Transitions (Brutalist styles should snap, not slide)
  transitions: {
    fast: 'all 0.1s ease-in-out',
    snap: 'all 0.05s linear',
  },

  // 3. Layout Offsets (For asymmetrical compositions)
  layout: {
    heavyLeftPadding: 'clamp(2rem, 5vw, 4rem)',
    slightRightPadding: '1rem',
  }
};