import React from 'react';

// VIOLATION: hardcoded color #1b58de (ΔE 2.1 from brand.primary #1a56db)
// VIOLATION: hardcoded color #6c7bf0 (ΔE 2.4 from brand.secondary #6875f5)
// VIOLATION: hardcoded color #0d9e6c (ΔE 2.3 from brand.accent #0e9f6e)
// VIOLATION: hardcoded color #f15151 (ΔE 3.1 from feedback.error #f05252)
// VIOLATION: padding 20px (not in spacing scale: sm=8px, md=16px, lg=24px)
// VIOLATION: font-size 15px (not in typography scale: sm=14px, base=16px)
// VIOLATION: font-weight 600 (not in weight scale: regular=400, medium=500, bold=700)

interface ProductCardProps {
  title: string;
  price: number;
  originalPrice?: number;
  rating: number;
  reviewCount: number;
  badge?: string;
  inStock: boolean;
}

export function ProductCard({ title, price, originalPrice, rating, reviewCount, badge, inStock }: ProductCardProps) {
  return (
    <div style={{
      padding: '20px',           // VIOLATION: not in spacing scale
      borderRadius: '8px',
      border: '1px solid #e5e7eb',
      backgroundColor: '#ffffff',
      maxWidth: '320px'
    }}>
      {badge && (
        <span style={{
          backgroundColor: '#1b58de',  // VIOLATION: ΔE 2.1 from brand.primary
          color: '#ffffff',
          fontSize: '12px',
          fontWeight: '600',           // VIOLATION: not in weight scale
          padding: '4px 8px',
          borderRadius: '4px'
        }}>
          {badge}
        </span>
      )}

      <h3 style={{
        fontSize: '15px',            // VIOLATION: not in type scale (should be 14px or 16px)
        fontWeight: '500',
        color: '#111928',
        marginTop: '12px'
      }}>
        {title}
      </h3>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
        <span style={{ fontSize: '20px', fontWeight: '700', color: '#111928' }}>
          ${price.toFixed(2)}
        </span>
        {originalPrice && (
          <span style={{ fontSize: '14px', textDecoration: 'line-through', color: '#6c7bf0' }}>
            {/* VIOLATION: ΔE 2.4 from brand.secondary */}
            ${originalPrice.toFixed(2)}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px' }}>
        {'★'.repeat(Math.floor(rating))}{'☆'.repeat(5 - Math.floor(rating))}
        <span style={{ fontSize: '14px', color: '#374151' }}>({reviewCount})</span>
      </div>

      <button style={{
        marginTop: '16px',
        width: '100%',
        padding: '8px 16px',
        backgroundColor: inStock ? '#0d9e6c' : '#9ca3af',  // VIOLATION: ΔE 2.3 from accent
        color: '#ffffff',
        border: 'none',
        borderRadius: '6px',
        cursor: inStock ? 'pointer' : 'not-allowed',
        fontSize: '14px',
        fontWeight: '500'
      }}>
        {inStock ? 'Add to Cart' : 'Out of Stock'}
      </button>

      {!inStock && (
        <p style={{ fontSize: '12px', color: '#f15151', marginTop: '8px' }}>
          {/* VIOLATION: ΔE 3.1 from feedback.error */}
          Currently unavailable
        </p>
      )}
    </div>
  );
}
