/**
 * MediaPropsSection — src/components/inspector/MediaPropsSection.tsx
 *
 * Inspector section for media-element-specific props:
 * src, alt, width, height, object-fit, loading (img);
 * autoplay, controls (video); viewBox (svg).
 *
 * - Dimension values (width, height) are matched against spacing/dimension
 *   tokens; off-token flag shown when applicable.
 * - Empty `alt` is flagged with StatBadge variant="critical" (a11y-critical).
 * - Non-empty `alt` passes without a badge.
 *
 * @schemaRole support-evidence (root)
 * CONTRACT: INSPECTOR.1 Group B
 * Commandments: C2, C5 (alt flagging), C13 (read-only)
 */

import React from 'react';
import Section from '../ui/primitives/Section';
import PropertyRow from '../ui/primitives/PropertyRow';
import StatBadge from '../ui/primitives/StatBadge';
import MetadataTooltip from '../ui/primitives/MetadataTooltip';
import { matchValueToToken } from '../../utils/tokenMatcher';
import { useTokenStore } from '../../store/tokenStore';
import type { VisualLayer } from '../../core/ast-parser';
import { Info } from 'lucide-react';

export interface MediaPropsSectionProps {
  layer: VisualLayer;
  onCommitProp: (propName: string, value: string | undefined) => void;
  /** FIX 1: Controls whether the Section starts expanded (ODQ-3 primary-only). */
  initiallyExpanded?: boolean;
}

/** Tag-to-prop mapping — only render props relevant to the element. */
const TAG_PROPS: Record<string, ReadonlyArray<string>> = {
  img:     ['src', 'alt', 'width', 'height', 'objectFit', 'loading'],
  video:   ['src', 'width', 'height', 'autoPlay', 'controls'],
  picture: ['src', 'width', 'height'],
  svg:     ['viewBox', 'width', 'height'],
};

const LABEL_MAP: Record<string, string> = {
  src:       'Src',
  alt:       'Alt',
  width:     'Width',
  height:    'Height',
  objectFit: 'Object Fit',
  loading:   'Loading',
  autoPlay:  'Autoplay',
  controls:  'Controls',
  viewBox:   'ViewBox',
};

const ALT_TOOLTIP = 'The alt attribute is required for images. An empty alt (alt="") hides the image from assistive technology and is only acceptable for decorative images.';

const MediaPropsSection: React.FC<MediaPropsSectionProps> = ({ layer, initiallyExpanded = false }) => {
  const tokens = useTokenStore(s => s.tokens);
  const tag = layer.tagName.toLowerCase();
  const props = layer.props ?? {};

  // Determine which prop keys to show for this tag; fallback to img props
  const propKeys = TAG_PROPS[tag] ?? TAG_PROPS['img'];

  const rows = propKeys.map(key => {
    // Resolve prop value: check both exact key and lowercase variant
    const rawValue = props[key] ?? props[key.toLowerCase()];

    // Special handling for `alt` — render when the attribute is explicitly set
    // (including empty string), but not when entirely absent from the layer.
    const isAlt = key === 'alt';
    // FIX 3: Distinguish between missing alt (undefined — filtered above) and
    // empty alt ('' or boolean true). Empty alt="" is WCAG-H67-valid for
    // decorative images; only missing alt is a critical a11y problem.
    const isEmptyAlt = isAlt && (rawValue === '' || rawValue === true);

    // For all props (including alt): skip when not present on the layer at all
    if (rawValue === undefined) return null;

    const label = LABEL_MAP[key] ?? key;

    // Dimension token matching for width/height
    const isDimension = key === 'width' || key === 'height';
    let valueNode: React.ReactNode;

    if (isAlt) {
      if (isEmptyAlt) {
        // FIX 3: alt="" is WCAG-H67 valid for decorative images — downgrade to
        // neutral/info. Reserve 'critical' for fully-missing alt (undefined),
        // which is already filtered out by the rawValue === undefined guard above.
        valueNode = (
          <span className="flex items-center gap-1 justify-end">
            <span
              className="font-mono"
              style={{ fontSize: 'var(--text-body)', color: 'var(--text-primary)' }}
            >
              {String(rawValue === true ? '' : rawValue ?? '')}
            </span>
            <StatBadge variant="neutral" compact>
              decorative
            </StatBadge>
          </span>
        );
      } else {
        valueNode = (
          <span
            style={{ fontSize: 'var(--text-body)', color: 'var(--text-primary)' }}
          >
            {String(rawValue ?? '')}
          </span>
        );
      }
    } else if (isDimension && typeof rawValue === 'string') {
      const result = matchValueToToken(rawValue, 'spacing', tokens);
      const isOffToken = !result.inTokenSet && result.nearestTokenName !== null;
      if (isOffToken) {
        valueNode = (
          <span className="flex items-center gap-1 justify-end">
            <span
              className="font-mono"
              style={{ fontSize: 'var(--text-body)', color: 'var(--text-primary)' }}
            >
              {rawValue}
            </span>
            <StatBadge variant="warning" compact>
              off-token
            </StatBadge>
          </span>
        );
      } else {
        valueNode = String(rawValue);
      }
    } else {
      const display = rawValue === true ? 'true' : rawValue === false ? 'false' : String(rawValue ?? '');
      valueNode = display;
    }

    const labelNode = isAlt ? (
      <span className="flex items-center gap-1">
        {label}
        <MetadataTooltip content={ALT_TOOLTIP} side="right">
          <Info size={11} aria-hidden="true" />
        </MetadataTooltip>
      </span>
    ) : label;

    return (
      <PropertyRow
        key={key}
        label={labelNode as string}
        value={valueNode}
        schemaRole="support-evidence"
      />
    );
  }).filter(Boolean);

  return (
    <div data-schema-role="support-evidence" data-testid="media-props-section">
      <Section
        title="Media Props"
        schemaRole="primary-content"
        expandedWhen={() => initiallyExpanded}
        stackItem={false}
      >
        {rows.length > 0 ? rows : (
          <p
            className="px-3 py-2"
            style={{ fontSize: 'var(--text-label)', color: 'var(--text-tertiary)' }}
          >
            No media props found.
          </p>
        )}
      </Section>
    </div>
  );
};

export default MediaPropsSection;
