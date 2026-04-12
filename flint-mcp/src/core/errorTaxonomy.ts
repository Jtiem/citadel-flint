/**
 * Error Taxonomy — flint-mcp/src/core/errorTaxonomy.ts
 *
 * CX.3: Canonical registry of all Flint error codes with plain-language
 * explanations and actionable recovery instructions.
 *
 * Design constraints:
 *   - Static const data — no computation, no imports at runtime.
 *   - O(1) lookup via REGISTRY map keyed by code.
 *   - < 1ms lookup overhead (hash map, no iteration on hot path).
 *   - Additive — no existing warning/violation shapes are modified here.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type ErrorCategory = 'mithril' | 'a11y' | 'governance' | 'session' | 'system'
export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical'

export interface ErrorEntry {
    /** Stable Flint error code, e.g. "FLINT-MITH-001". */
    code: string
    /** Rule ID as used in LinterWarning.ruleId or A11yViolationDetail.ruleId. */
    ruleId: string
    /** Broad classification for grouping and filtering. */
    category: ErrorCategory
    /** Severity tier — separate from amber/critical; maps to the reporting context. */
    severity: ErrorSeverity
    /** Short title suitable for headings and toast notifications. */
    title: string
    /** 2–3 sentences explaining why this rule exists. */
    explanation: string
    /** Actionable steps to resolve the violation. */
    recovery: string
    /** The specification, standard, or Flint commandment that mandates this rule. */
    sourceAuthority?: string
    /** Specific section reference within the authority document. */
    regulatoryRef?: string
}

// ── Registry ──────────────────────────────────────────────────────────────────

/**
 * Complete static registry of all Flint error entries.
 * Keyed by error code for O(1) lookup.
 */
const REGISTRY: Record<string, ErrorEntry> = {

    // ── Mithril rules ──────────────────────────────────────────────────────────

    'FLINT-MITH-001': {
        code: 'FLINT-MITH-001',
        ruleId: 'MITHRIL-COL',
        category: 'mithril',
        severity: 'error',
        title: 'Color Token Drift',
        explanation:
            'An arbitrary hex color value in a Tailwind class does not correspond to a registered design token. ' +
            'Design systems rely on a controlled color palette to maintain visual consistency across products and brands. ' +
            'Unregistered colors erode that consistency and make future rebrand or theming operations unreliable.',
        recovery:
            'Replace the arbitrary color class (e.g. `bg-[#e53e3e]`) with the nearest semantic token class ' +
            '(e.g. `bg-error-500`). Run `flint_sync_tokens` to ensure your token set is current. ' +
            'If no token fits, add the new color to your design token file and re-run `flint_fix`.',
        sourceAuthority: 'Flint Commandment 2 (No Hallucinated Styling); Flint Commandment 9 (CIEDE2000 Delta-E Logic)',
        regulatoryRef: 'CIEDE2000 ΔE > 2.0 threshold',
    },

    'FLINT-MITH-002': {
        code: 'FLINT-MITH-002',
        ruleId: 'MITHRIL-TYP-001',
        category: 'mithril',
        severity: 'warning',
        title: 'Font Family Not in Token Set',
        explanation:
            'An arbitrary font-family value is applied directly in a Tailwind class rather than via a typography token. ' +
            'Font families are a core brand asset; hardcoding them bypasses the design system and creates divergence ' +
            'whenever the brand typeface changes.',
        recovery:
            'Replace the arbitrary `font-[...]` class with a token-backed utility class registered in your `fontFamily` tokens. ' +
            'If the typeface is intentional and new, add a `fontFamily` token entry and re-run the audit.',
        sourceAuthority: 'Flint Commandment 2 (No Hallucinated Styling)',
    },

    'FLINT-MITH-003': {
        code: 'FLINT-MITH-003',
        ruleId: 'MITHRIL-TYP-002',
        category: 'mithril',
        severity: 'warning',
        title: 'Font Size Not in Token Set',
        explanation:
            'An arbitrary font-size value (px/rem/em) is applied via a Tailwind bracket notation rather than a dimension token. ' +
            'Type scales defined in design tokens ensure visual rhythm and make system-wide size adjustments safe. ' +
            'Hardcoded sizes fragment the scale and make responsive or accessibility-driven resize operations error-prone.',
        recovery:
            'Replace the arbitrary `text-[...]` class with a token-backed text-size utility. ' +
            'If the size is valid for the scale, register it as a `dimension` token and re-run the audit.',
        sourceAuthority: 'Flint Commandment 2 (No Hallucinated Styling)',
    },

    'FLINT-MITH-004': {
        code: 'FLINT-MITH-004',
        ruleId: 'MITHRIL-TYP-003',
        category: 'mithril',
        severity: 'warning',
        title: 'Font Weight Not in Token Set',
        explanation:
            'An arbitrary font-weight value is applied via Tailwind bracket notation rather than a `fontWeight` token. ' +
            'Weight steps communicate hierarchy and emphasis; arbitrary weights introduce visual inconsistency ' +
            'across components that share typographic intent.',
        recovery:
            'Replace the arbitrary `font-[400]` style class with a token-backed weight utility. ' +
            'Register the weight as a `fontWeight` token if it belongs in the design system.',
        sourceAuthority: 'Flint Commandment 2 (No Hallucinated Styling)',
    },

    'FLINT-MITH-005': {
        code: 'FLINT-MITH-005',
        ruleId: 'MITHRIL-TYP-004',
        category: 'mithril',
        severity: 'warning',
        title: 'Line Height Not in Token Set',
        explanation:
            'An arbitrary line-height value is applied via Tailwind bracket notation rather than a `lineHeight` token. ' +
            'Consistent vertical rhythm depends on controlled line-height steps. ' +
            'Arbitrary values break paragraph density and make cross-component reading flow unpredictable.',
        recovery:
            'Replace the arbitrary `leading-[...]` class with a token-backed line-height utility. ' +
            'Add the value as a `lineHeight` token if it is an intentional design system addition.',
        sourceAuthority: 'Flint Commandment 2 (No Hallucinated Styling)',
    },

    'FLINT-MITH-006': {
        code: 'FLINT-MITH-006',
        ruleId: 'MITHRIL-TYP-005',
        category: 'mithril',
        severity: 'warning',
        title: 'Letter Spacing Not in Token Set',
        explanation:
            'An arbitrary letter-spacing value is applied via Tailwind bracket notation rather than a `letterSpacing` token. ' +
            'Letter-spacing affects legibility and brand feel. ' +
            'Arbitrary values outside the token set create micro-inconsistencies that accumulate into visible brand drift.',
        recovery:
            'Replace the arbitrary `tracking-[...]` class with a token-backed tracking utility. ' +
            'Register the value as a `letterSpacing` token if it is part of the design system specification.',
        sourceAuthority: 'Flint Commandment 2 (No Hallucinated Styling)',
    },

    'FLINT-MITH-007': {
        code: 'FLINT-MITH-007',
        ruleId: 'MITHRIL-SPC-001',
        category: 'mithril',
        severity: 'warning',
        title: 'Spacing Value Not in Token Set',
        explanation:
            'An arbitrary spacing value (padding, margin, gap, width, height) is applied via Tailwind bracket notation ' +
            'rather than a registered `dimension` token. ' +
            'Spacing tokens define the grid and layout rhythm of the design system; arbitrary values break alignment ' +
            'and make components impossible to maintain across breakpoints.',
        recovery:
            'Replace the arbitrary spacing class (e.g. `p-[18px]`) with a token-backed spacing utility. ' +
            'If the value is a legitimate design system spacing step, add it as a `dimension` token.',
        sourceAuthority: 'Flint Commandment 2 (No Hallucinated Styling)',
    },

    'FLINT-MITH-008': {
        code: 'FLINT-MITH-008',
        ruleId: 'MITHRIL-SHD-001',
        category: 'mithril',
        severity: 'warning',
        title: 'Shadow Not in Token Set',
        explanation:
            'An arbitrary box-shadow value is applied via Tailwind bracket notation rather than a registered `shadow` token. ' +
            'Shadow definitions control depth hierarchy and material language across the UI. ' +
            'Hardcoded shadows break the elevation system and make UI reskinning brittle.',
        recovery:
            'Replace the arbitrary `shadow-[...]` class with a token-backed shadow utility. ' +
            'Register the shadow definition as a `shadow` token if it is an intentional design system elevation step.',
        sourceAuthority: 'Flint Commandment 2 (No Hallucinated Styling)',
    },

    'FLINT-MITH-009': {
        code: 'FLINT-MITH-009',
        ruleId: 'MITHRIL-OPC-001',
        category: 'mithril',
        severity: 'warning',
        title: 'Opacity Not in Token Set',
        explanation:
            'An arbitrary opacity value is applied via Tailwind bracket notation rather than a registered `opacity` token. ' +
            'Opacity tokens define the transparency vocabulary of the design system (disabled states, overlays, ghost elements). ' +
            'Arbitrary values create inconsistent transparency behavior across components.',
        recovery:
            'Replace the arbitrary `opacity-[...]` class with a token-backed opacity utility. ' +
            'Register the value as an `opacity` token if it is a legitimate transparency step.',
        sourceAuthority: 'Flint Commandment 2 (No Hallucinated Styling)',
    },

    // ── Mithril Inline Style rules (MITHRIL-IST-*) ────────────────────────────
    // These mirror the className visitors but fire on `style={{ ... }}` object props.

    'FLINT-MITH-010': {
        code: 'FLINT-MITH-010',
        ruleId: 'MITHRIL-IST-COL',
        category: 'mithril',
        severity: 'error',
        title: 'Inline Style Color Not in Token Set',
        explanation:
            'A hardcoded hex or rgb() color value appears in a `style={{}}` prop rather than referencing a design token. ' +
            'Inline style colors bypass the design system entirely: they are invisible to theme switching, brand audits, ' +
            'and rebranding operations. CIEDE2000 perceptual distance confirms the color is not equivalent to any registered token.',
        recovery:
            'Replace the hardcoded color value with a CSS variable or token reference ' +
            '(e.g. `color: tokens.colorOnSurface` or `color: var(--color-on-surface)`). ' +
            'If the color is intentional and new, add it as a `color` design token first.',
        sourceAuthority: 'Flint Commandment 2 (No Hallucinated Styling); Flint Commandment 9 (CIEDE2000 Delta-E Logic)',
        regulatoryRef: 'CIEDE2000 ΔE > 2.0 threshold',
    },

    'FLINT-MITH-011': {
        code: 'FLINT-MITH-011',
        ruleId: 'MITHRIL-IST-TYP',
        category: 'mithril',
        severity: 'warning',
        title: 'Inline Style Typography Value Not in Token Set',
        explanation:
            'A hardcoded typography value (fontSize, fontWeight, lineHeight, letterSpacing, or fontFamily) appears in a ' +
            '`style={{}}` prop rather than referencing a design token. ' +
            'Hardcoded type values fragment the type scale and prevent system-wide accessibility or brand adjustments ' +
            'from propagating to this element.',
        recovery:
            'Replace the hardcoded value with a token reference ' +
            '(e.g. `fontSize: tokens.typeSizeSm` or `fontWeight: tokens.typeWeightBold`). ' +
            'If the value is a legitimate type scale step, add it as a typography token and re-run the audit.',
        sourceAuthority: 'Flint Commandment 2 (No Hallucinated Styling)',
    },

    'FLINT-MITH-012': {
        code: 'FLINT-MITH-012',
        ruleId: 'MITHRIL-IST-SPC',
        category: 'mithril',
        severity: 'warning',
        title: 'Inline Style Spacing Value Not in Token Set',
        explanation:
            'A hardcoded spacing or dimension value (margin, padding, gap, width, height, borderRadius, etc.) appears in a ' +
            '`style={{}}` prop rather than referencing a dimension token. ' +
            'Spacing tokens define the layout grid and rhythm; arbitrary inline values break alignment ' +
            'and make components impossible to maintain across breakpoints or design system updates.',
        recovery:
            'Replace the hardcoded value with a token reference ' +
            '(e.g. `marginTop: tokens.spacingSm` or `padding: tokens.spacing4`). ' +
            'If the value belongs in the spacing scale, add it as a `dimension` token.',
        sourceAuthority: 'Flint Commandment 2 (No Hallucinated Styling)',
    },

    'FLINT-MITH-013': {
        code: 'FLINT-MITH-013',
        ruleId: 'MITHRIL-IST-SHD',
        category: 'mithril',
        severity: 'warning',
        title: 'Inline Style Shadow Not in Token Set',
        explanation:
            'A hardcoded `boxShadow` or `textShadow` value appears in a `style={{}}` prop rather than referencing a shadow token. ' +
            'Shadow definitions control the elevation language and material depth of the UI. ' +
            'Hardcoded shadows break the elevation system and prevent retheming.',
        recovery:
            'Replace the hardcoded shadow with a token reference ' +
            '(e.g. `boxShadow: tokens.shadowMd`). ' +
            'Register the shadow definition as a `shadow` token if it is an intentional elevation step.',
        sourceAuthority: 'Flint Commandment 2 (No Hallucinated Styling)',
    },

    'FLINT-MITH-014': {
        code: 'FLINT-MITH-014',
        ruleId: 'MITHRIL-IST-OPC',
        category: 'mithril',
        severity: 'warning',
        title: 'Inline Style Opacity Not in Token Set',
        explanation:
            'A hardcoded `opacity` value appears in a `style={{}}` prop rather than referencing an opacity token. ' +
            'Opacity tokens define the transparency vocabulary of the design system (disabled states, overlays, ghost elements). ' +
            'Arbitrary inline values create inconsistent transparency behaviour across components.',
        recovery:
            'Replace the hardcoded opacity with a token reference ' +
            '(e.g. `opacity: tokens.opacityDisabled`). ' +
            'Register the value as an `opacity` token if it is a legitimate transparency step.',
        sourceAuthority: 'Flint Commandment 2 (No Hallucinated Styling)',
    },

    // ── Mithril Local Token Object rule (MITHRIL-DTO-001) ─────────────────────

    'FLINT-MITH-015': {
        code: 'FLINT-MITH-015',
        ruleId: 'MITHRIL-DTO-001',
        category: 'mithril',
        severity: 'warning',
        title: 'Local Token Object Shadows Design System',
        explanation:
            'A module-scoped object literal contains hardcoded values that duplicate entries in the Flint token store. ' +
            'If the design system changes, this local copy will not update, causing silent drift. ' +
            'Flint\'s CIEDE2000 engine cannot track drift through local object indirection.',
        recovery:
            'Remove the local token object. Reference design tokens via CSS custom properties (var(--color-primary)) ' +
            'or use the project\'s Tailwind token classes.',
        sourceAuthority: 'Flint Commandment 2 (No Hallucinated Styling)',
    },

    // ── Mithril Tailwind Version Drift rules (P1c) ─────────────────────────────

    'FLINT-MITH-016': {
        code: 'FLINT-MITH-016',
        ruleId: 'MITHRIL-TW-001',
        category: 'mithril',
        severity: 'warning',
        title: 'Deprecated Tailwind v3 Class in v4 Project',
        explanation:
            'This component uses a Tailwind CSS class that was deprecated or renamed in v4. ' +
            'While it may still render correctly with compatibility layers, it creates silent drift ' +
            'that will break when compatibility shims are removed. LLMs frequently mix v3 and v4 ' +
            'classes because they lack version awareness.',
        recovery:
            'Replace the deprecated class with its v4 equivalent. For example: ' +
            '`flex-grow` → `grow`, `bg-opacity-50` → merge with color class as `bg-blue-500/50`, ' +
            '`bg-gradient-to-r` → `bg-linear-to-r`. Run `flint_migrate_tw` for automated migration.',
        sourceAuthority: 'Flint Commandment 2 (No Hallucinated Styling) + Tailwind CSS v4 Upgrade Guide',
    },

    'FLINT-MITH-017': {
        code: 'FLINT-MITH-017',
        ruleId: 'MITHRIL-TW-002',
        category: 'mithril',
        severity: 'warning',
        title: 'Tailwind v4 Class in v3 Project',
        explanation:
            'This component uses a Tailwind CSS class that only exists in v4, but the project ' +
            'is configured for Tailwind v3. These classes will have no effect and produce invisible ' +
            'styling failures. This commonly occurs when LLMs generate code using v4 conventions ' +
            'for a v3 project.',
        recovery:
            'Replace the v4-only class with its v3 equivalent. For example: ' +
            '`grow` → `flex-grow`, `bg-linear-to-r` → `bg-gradient-to-r`, ' +
            '`shadow-xs` → `shadow-sm`.',
        sourceAuthority: 'Flint Commandment 2 (No Hallucinated Styling) + Tailwind CSS v4 Upgrade Guide',
    },

    // ── Motion / Animation rules (P5 — Behavioral & Motion Governance) ────────

    'FLINT-MITH-024': {
        code: 'FLINT-MITH-024',
        ruleId: 'MOTION-001',
        category: 'mithril',
        severity: 'warning',
        title: 'Motion Drift — Untokenized Timing or Easing',
        explanation:
            'A transition, duration, easing, or animation value is applied without referencing the ' +
            'project\'s motion language. Inconsistent motion — arbitrary durations, off-brand easing ' +
            'curves, or one-off animations — makes a product feel "off" even when the layout is pixel-perfect. ' +
            'LLMs routinely emit `transition-all duration-200 ease-linear` without any awareness of a brand\'s ' +
            'curated motion system, producing compliant-looking but inconsistent behavior.',
        recovery:
            'Replace the literal timing / easing with a motion token (e.g. `transition.interactive`, ' +
            '`motion.page`). If no matching token exists, add one to your motion token set, or audit in ' +
            'advisory mode until a motion language is defined. Configure via ' +
            '`mithril.motionCheck: off | advisory | blocking`.',
        sourceAuthority: 'Flint Commandment 2 (No Hallucinated Styling)',
    },

    // ── Hydration rules (P4 — Anti-Hardcode Linter) ───────────────────────────

    'FLINT-HYD-001': {
        code: 'FLINT-HYD-001',
        ruleId: 'HYDRATION-001',
        category: 'mithril',
        severity: 'warning',
        title: 'Hardcoded Placeholder Data in JSX',
        explanation:
            'A JSX text literal appears to be designer-supplied dummy data ' +
            '("John Doe", "$99.99", "Lorem ipsum", or a value that maps to a Figma ' +
            'data-binding layer). LLMs frequently bake this placeholder copy into ' +
            'generated components instead of parameterizing it as a prop, so the ' +
            'component ships with fake data the first time it runs in production.',
        recovery:
            'Extract the literal as a component prop (e.g. `userName`, `price`, ' +
            '`avatarUrl`) and hydrate it from real application state. Flint cannot ' +
            'infer the correct prop name — a human or LLM must choose it. Configure ' +
            'via `mithril.hydrationCheck: off | warn | error`.',
        sourceAuthority: 'Flint Commandment 2 (No Hallucinated Styling)',
    },

    // ── Mithril Dark Mode Safety rules (P1d) ──────────────────────────────────

    'FLINT-MITH-018': {
        code: 'FLINT-MITH-018',
        ruleId: 'MITHRIL-DARK-001',
        category: 'mithril',
        severity: 'warning',
        title: 'Dark Mode Safety Violation',
        explanation:
            'A color utility class is applied without a corresponding `dark:` variant or semantic ' +
            'design token that includes a dark mode value. When the user switches to dark mode, this ' +
            'component will display the light-mode color against a dark background, causing readability ' +
            'and contrast failures. This is the most visually obvious sign of ungoverned AI-generated UI.',
        recovery:
            'Either add a `dark:` variant for the same property (e.g., `bg-white dark:bg-gray-900`) ' +
            'or replace the primitive color class with a semantic design token that automatically ' +
            'flips between modes (e.g., `bg-[var(--color-surface)]`). If the project uses semantic ' +
            'tokens with a `modes.dark` field, switching to those tokens is the preferred approach.',
        sourceAuthority: 'Flint Commandment 2 (No Hallucinated Styling) + Design Token Theming Best Practices',
    },

    // ── Mithril Fluid Interpolator (P6) ────────────────────────────────────────

    'FLINT-MITH-023': {
        code: 'FLINT-MITH-023',
        ruleId: 'MITHRIL-FLUID-001',
        category: 'mithril',
        severity: 'info',
        title: 'Fluid Scaling Opportunity',
        explanation:
            'Two or more breakpoint-specific Tailwind values were detected for the same property ' +
            '(e.g. `text-base lg:text-xl`). Designers typically author these as fixed steps, but real ' +
            'screens stretch fluidly between breakpoints — producing awkward intermediate states at ' +
            'widths that do not match a named breakpoint. Fluid typography and spacing via `clamp()` ' +
            'provide smooth interpolation between the smallest and largest value and eliminate visible ' +
            'step transitions when the viewport is resized.',
        recovery:
            'Consider replacing the breakpoint variants with a single fluid `clamp()` expression that ' +
            'interpolates linearly between the minimum and maximum values. Keep hard breakpoints only ' +
            'when you need editorial control over intermediate viewport widths (e.g., a headline that ' +
            'must wrap differently on tablet). This is an advisory suggestion and never blocks export.',
        sourceAuthority: 'Flint Commandment 2 (No Hallucinated Styling) + Flint P6 Breakpoint Governance (progressive enhancement)',
    },

    // ── A11y rules — Names & Labels ────────────────────────────────────────────

    'FLINT-A11Y-001': {
        code: 'FLINT-A11Y-001',
        ruleId: 'A11Y-001',
        category: 'a11y',
        severity: 'critical',
        title: 'Image Missing Alt Text',
        explanation:
            'Screen readers announce the content of `alt` attributes to blind and low-vision users. ' +
            'An `<img>` without an `alt` attribute provides no information about the image, causing ' +
            'assistive technologies to read out the file path or skip the image entirely. ' +
            'This is a Level A requirement and blocks WCAG 2.1 AA conformance.',
        recovery:
            'Add `alt=""` for purely decorative images (the screen reader will skip them). ' +
            'For informational images, write a concise description of the image content and purpose. ' +
            'Never use the filename as the alt text (see A11Y-011).',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryRef: '§ 1.1.1 Non-text Content (Level A)',
    },

    'FLINT-A11Y-002': {
        code: 'FLINT-A11Y-002',
        ruleId: 'A11Y-002',
        category: 'a11y',
        severity: 'critical',
        title: 'Button Missing Accessible Name',
        explanation:
            'Buttons without an accessible name are announced as "button" by screen readers, giving users ' +
            'no information about the action they trigger. ' +
            'Icon-only buttons are the most common source of this violation. ' +
            'This prevents keyboard and AT users from operating interactive controls.',
        recovery:
            'Add text content inside the button, or add `aria-label="[action description]"` for icon-only buttons. ' +
            'Alternatively, add `title="[action description]"` or `aria-labelledby="[id of label element]"`.',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryRef: '§ 4.1.2 Name, Role, Value (Level A)',
    },

    'FLINT-A11Y-003': {
        code: 'FLINT-A11Y-003',
        ruleId: 'A11Y-003',
        category: 'a11y',
        severity: 'critical',
        title: 'Link Missing Accessible Name',
        explanation:
            'An `<a>` element without an accessible name is announced as "link" by screen readers, with no ' +
            'indication of where it leads. ' +
            'This is one of the most common accessibility failures in production applications and directly ' +
            'prevents screen reader users from understanding navigation structure.',
        recovery:
            'Add descriptive text content inside the anchor, or add `aria-label="[destination description]"`. ' +
            'If the link contains only an icon, use `aria-label` to describe the destination, not the icon.',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryRef: '§ 4.1.2 Name, Role, Value (Level A)',
    },

    'FLINT-A11Y-004': {
        code: 'FLINT-A11Y-004',
        ruleId: 'A11Y-004',
        category: 'a11y',
        severity: 'critical',
        title: 'Input Missing Label',
        explanation:
            'Form inputs without programmatic labels are inaccessible to screen reader users, who cannot ' +
            'determine what information to enter. ' +
            'Visual placeholder text is not a substitute — it disappears on focus and is not consistently ' +
            'announced by assistive technologies.',
        recovery:
            'Associate a `<label htmlFor="[inputId]">` element, or add `aria-label="[field description]"`, ' +
            'or use `aria-labelledby="[id of visible label]"`. ' +
            'Placeholder text alone does not satisfy this requirement.',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryRef: '§ 1.3.1 Info and Relationships (Level A)',
    },

    'FLINT-A11Y-005': {
        code: 'FLINT-A11Y-005',
        ruleId: 'A11Y-005',
        category: 'a11y',
        severity: 'critical',
        title: 'Select Missing Label',
        explanation:
            'A `<select>` dropdown without an accessible label leaves screen reader users unable to identify ' +
            'the purpose of the control or the context of its options. ' +
            'This is a Level A failure with high impact on form usability for AT users.',
        recovery:
            'Add `aria-label="[field name]"`, pair with a `<label htmlFor="[selectId]">`, ' +
            'or use `aria-labelledby="[id of visible label element]"`.',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryRef: '§ 1.3.1 Info and Relationships (Level A)',
    },

    'FLINT-A11Y-006': {
        code: 'FLINT-A11Y-006',
        ruleId: 'A11Y-006',
        category: 'a11y',
        severity: 'critical',
        title: 'Textarea Missing Label',
        explanation:
            'A `<textarea>` without an accessible label prevents screen reader users from knowing what text ' +
            'to enter. ' +
            'Multi-line text inputs often contain critical information (comments, descriptions, notes) ' +
            'and the purpose must be programmatically determinable.',
        recovery:
            'Add `aria-label="[field description]"`, pair with a `<label htmlFor="[textareaId]">`, ' +
            'or use `aria-labelledby="[id of visible label]"`.',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryRef: '§ 1.3.1 Info and Relationships (Level A)',
    },

    'FLINT-A11Y-007': {
        code: 'FLINT-A11Y-007',
        ruleId: 'A11Y-007',
        category: 'a11y',
        severity: 'critical',
        title: 'Positive TabIndex Disrupts Tab Order',
        explanation:
            'A `tabIndex` greater than 0 forces keyboard focus to jump to that element before following the ' +
            'natural DOM order. ' +
            'This creates a confusing and unpredictable focus sequence for keyboard users and violates the ' +
            'principle that the visual and focus order should match.',
        recovery:
            'Use `tabIndex={0}` to include an element in the natural tab order, ' +
            'or `tabIndex={-1}` to remove it from the flow (but keep it programmatically focusable). ' +
            'Never use positive values. Restructure the DOM if the desired focus order differs from the visual order.',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryRef: '§ 2.4.3 Focus Order (Level A)',
    },

    'FLINT-A11Y-008': {
        code: 'FLINT-A11Y-008',
        ruleId: 'A11Y-008',
        category: 'a11y',
        severity: 'critical',
        title: 'Table Missing Accessible Summary',
        explanation:
            'Data tables without an accessible summary or caption make it impossible for screen reader users ' +
            'to understand the purpose or structure of the table before navigating its contents. ' +
            'Complex tables especially require context about what data they contain and how it is organized.',
        recovery:
            'Add a `<caption>` element as the first child of the table describing its content. ' +
            'Alternatively, use `aria-label="[table description]"` or ' +
            '`aria-labelledby="[id of a heading or description element]"`.',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryRef: '§ 1.3.1 Info and Relationships (Level A)',
    },

    'FLINT-A11Y-009': {
        code: 'FLINT-A11Y-009',
        ruleId: 'A11Y-009',
        category: 'a11y',
        severity: 'critical',
        title: 'HTML Missing Lang Attribute',
        explanation:
            'Screen readers use the `lang` attribute on the `<html>` element to select the correct language ' +
            'voice and pronunciation rules. ' +
            'Without it, content may be read with the wrong accent, mispronounced, or rendered unintelligibly ' +
            'to users whose screen reader defaults to a different language.',
        recovery:
            'Add `lang="en"` (or the appropriate BCP 47 language tag) to the root `<html>` element. ' +
            'For multilingual pages, also add `lang` attributes to sections that use different languages.',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryRef: '§ 3.1.1 Language of Page (Level A)',
    },

    'FLINT-A11Y-010': {
        code: 'FLINT-A11Y-010',
        ruleId: 'A11Y-010',
        category: 'a11y',
        severity: 'critical',
        title: 'Heading Level Skipped',
        explanation:
            'Screen reader users navigate pages by jumping between headings. ' +
            'Skipping heading levels (e.g. going from `<h2>` to `<h4>`) breaks the document outline and ' +
            'confuses users who rely on heading hierarchy to understand content structure.',
        recovery:
            'Use headings in sequential order: `h1` → `h2` → `h3`, etc. ' +
            'Do not skip levels for visual styling — instead, use CSS or Tailwind classes to control the ' +
            'visual appearance while maintaining semantic hierarchy.',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryRef: '§ 1.3.1 Info and Relationships (Level A)',
    },

    'FLINT-A11Y-011': {
        code: 'FLINT-A11Y-011',
        ruleId: 'A11Y-011',
        category: 'a11y',
        severity: 'critical',
        title: 'Image Alt Is Filename',
        explanation:
            'Using a filename as the `alt` text of an image (e.g. `alt="hero-image.png"`) provides no ' +
            'meaningful description of the image content. ' +
            'Screen readers will literally announce "hero-image dot png" to the user, which is meaningless ' +
            'and a poor accessibility experience.',
        recovery:
            'Replace the filename alt with a concise, descriptive string that conveys the image\'s content and purpose. ' +
            'For decorative images with no informational value, use `alt=""` so screen readers skip them.',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryRef: '§ 1.1.1 Non-text Content (Level A)',
    },

    'FLINT-A11Y-012': {
        code: 'FLINT-A11Y-012',
        ruleId: 'A11Y-012',
        category: 'a11y',
        severity: 'critical',
        title: 'SVG Missing Accessible Name',
        explanation:
            'SVG elements used as graphics or icons must have an accessible name so screen readers can ' +
            'describe them. ' +
            'Without one, screen readers may announce the raw SVG path data or silently skip the element, ' +
            'leaving users without context for what the graphic represents.',
        recovery:
            'For decorative SVGs (purely visual): add `aria-hidden="true"`. ' +
            'For informational SVGs: add `aria-label="[description]"` or a `<title>` child element. ' +
            'Consider pairing with `role="img"` for maximum compatibility.',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryRef: '§ 1.1.1 Non-text Content (Level A)',
    },

    'FLINT-A11Y-013': {
        code: 'FLINT-A11Y-013',
        ruleId: 'A11Y-013',
        category: 'a11y',
        severity: 'critical',
        title: 'Image Input Missing Alt',
        explanation:
            '`<input type="image">` elements function as submit buttons and must have an `alt` attribute ' +
            'describing the action they trigger. ' +
            'Without alt text, screen readers cannot announce what the button does, blocking form submission ' +
            'for AT users.',
        recovery:
            'Add `alt="[action description]"` that describes what clicking the image input will do ' +
            '(e.g. `alt="Submit order"`). ' +
            'For decorative image inputs, use `alt=""`.',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryRef: '§ 1.1.1 Non-text Content (Level A)',
    },

    'FLINT-A11Y-014': {
        code: 'FLINT-A11Y-014',
        ruleId: 'A11Y-014',
        category: 'a11y',
        severity: 'critical',
        title: 'Generic Link Text',
        explanation:
            'Link text such as "click here", "read more", or "learn more" does not describe the link destination. ' +
            'Screen reader users often navigate pages by reading a list of all links — generic text makes this ' +
            'list meaningless and forces users to read surrounding context for every link.',
        recovery:
            'Replace generic text with descriptive text that makes sense out of context (e.g. "Read the accessibility guide"). ' +
            'If generic text must remain visible, add `aria-label="[descriptive text]"` to provide the accessible name.',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryRef: '§ 2.4.4 Link Purpose (In Context) (Level A)',
    },

    'FLINT-A11Y-015': {
        code: 'FLINT-A11Y-015',
        ruleId: 'A11Y-015',
        category: 'a11y',
        severity: 'critical',
        title: 'List Contains Non-List-Item Children',
        explanation:
            'The `<ul>` and `<ol>` elements may only contain `<li>` children per the HTML spec. ' +
            'Non-list-item children break the list semantics that screen readers rely on to announce ' +
            'list size and navigate between items.',
        recovery:
            'Wrap any non-`<li>` direct children of `<ul>` or `<ol>` inside an `<li>` element. ' +
            'If the structure is a deliberate pattern (e.g. group headers), use ARIA role overrides ' +
            'or restructure to nested lists.',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryRef: '§ 1.3.1 Info and Relationships (Level A)',
    },

    'FLINT-A11Y-016': {
        code: 'FLINT-A11Y-016',
        ruleId: 'A11Y-016',
        category: 'a11y',
        severity: 'critical',
        title: 'Definition List Contains Invalid Children',
        explanation:
            '`<dl>` elements must only contain `<dt>` (term) and `<dd>` (description) children. ' +
            'Invalid children corrupt the definition list semantics that screen readers use to pair ' +
            'terms with their definitions.',
        recovery:
            'Ensure all direct children of `<dl>` are either `<dt>` or `<dd>` elements. ' +
            'You may group term/description pairs inside `<div>` wrappers for styling purposes.',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryRef: '§ 1.3.1 Info and Relationships (Level A)',
    },

    'FLINT-A11Y-017': {
        code: 'FLINT-A11Y-017',
        ruleId: 'A11Y-017',
        category: 'a11y',
        severity: 'critical',
        title: 'Page Must Have Exactly One H1',
        explanation:
            'The `<h1>` element defines the main topic of the page and is the first heading screen reader ' +
            'users encounter when navigating by heading. ' +
            'Multiple `<h1>` elements create an ambiguous document outline and confuse AT users about ' +
            'the primary purpose of the page.',
        recovery:
            'Ensure exactly one `<h1>` exists per page. ' +
            'Secondary section titles should use `<h2>` and below. ' +
            'If you have multiple visually prominent headings, only promote one to `<h1>` semantically.',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryRef: '§ 2.4.2 Page Titled (Level A)',
    },

    // ── A11y rules — Keyboard ──────────────────────────────────────────────────

    'FLINT-A11Y-020': {
        code: 'FLINT-A11Y-020',
        ruleId: 'A11Y-020',
        category: 'a11y',
        severity: 'critical',
        title: 'Non-Interactive Element With Click Handler',
        explanation:
            'Non-interactive elements (`div`, `span`, etc.) with `onClick` handlers are invisible to ' +
            'keyboard users and assistive technologies unless they also have a semantic role, a tab stop, ' +
            'and a keyboard event handler. ' +
            'Users who cannot use a mouse have no way to activate such elements.',
        recovery:
            'Add `role="button"` and `tabIndex={0}` to make the element keyboard-reachable. ' +
            'Add an `onKeyDown` handler that triggers the same action as `onClick` when Enter or Space is pressed. ' +
            'Better yet, replace the element with a native `<button>` which provides all of this by default.',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryRef: '§ 2.1.1 Keyboard (Level A)',
    },

    'FLINT-A11Y-021': {
        code: 'FLINT-A11Y-021',
        ruleId: 'A11Y-021',
        category: 'a11y',
        severity: 'critical',
        title: 'Mouse-Only Event Handler',
        explanation:
            'Event handlers like `onMouseDown`, `onMouseUp`, and `onMouseOver` only fire for pointer device ' +
            'users. ' +
            'Keyboard users and switch access users who trigger the same functional states will receive no ' +
            'feedback, effectively locking them out of interactive behavior.',
        recovery:
            'Add keyboard equivalents: `onKeyDown` for `onMouseDown`, `onKeyUp` for `onMouseUp`, ' +
            '`onFocus` for `onMouseOver`. ' +
            'Consider using `onClick` (which fires on Enter/Space for keyboard) as the primary handler ' +
            'for activation actions.',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryRef: '§ 2.1.1 Keyboard (Level A)',
    },

    'FLINT-A11Y-022': {
        code: 'FLINT-A11Y-022',
        ruleId: 'A11Y-022',
        category: 'a11y',
        severity: 'critical',
        title: 'Focus Indicator Removed',
        explanation:
            'Removing the focus ring via `outline-none` without providing a replacement focus style makes ' +
            'it impossible for keyboard users to determine which element currently has focus. ' +
            'This is one of the most common and highest-impact keyboard accessibility failures in modern ' +
            'Tailwind-based applications.',
        recovery:
            'Replace `outline-none` with a custom focus indicator using `focus:ring-*`, ' +
            '`focus-visible:ring-*`, or `focus:border-*` classes. ' +
            'The replacement must have a 3:1 contrast ratio with adjacent colors per WCAG 1.4.11.',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryRef: '§ 2.4.7 Focus Visible (Level AA)',
    },

    // ── A11y rules — Structure ─────────────────────────────────────────────────

    // (A11Y-008 through A11Y-010 and A11Y-015 through A11Y-017 registered above
    //  under their sequential rule numbers)

    // ── A11y rules — ARIA ──────────────────────────────────────────────────────

    'FLINT-A11Y-030': {
        code: 'FLINT-A11Y-030',
        ruleId: 'A11Y-030',
        category: 'a11y',
        severity: 'critical',
        title: 'Invalid ARIA Role',
        explanation:
            'The `role` attribute must contain a valid WAI-ARIA 1.2 role name. ' +
            'Invalid roles are ignored by assistive technologies, which then fall back to the native ' +
            'element semantics — potentially stripping the intended accessible behavior entirely.',
        recovery:
            'Check the WAI-ARIA 1.2 role taxonomy and use the correct role name. ' +
            'Common typos: "buttn" → "button", "dialogbox" → "dialog". ' +
            'If no standard role fits your pattern, consult the ARIA Authoring Practices Guide (APG).',
        sourceAuthority: 'WCAG 2.1 AA; WAI-ARIA 1.2',
        regulatoryRef: '§ 4.1.2 Name, Role, Value (Level A)',
    },

    'FLINT-A11Y-031': {
        code: 'FLINT-A11Y-031',
        ruleId: 'A11Y-031',
        category: 'a11y',
        severity: 'critical',
        title: 'Required ARIA Children Missing',
        explanation:
            'Certain ARIA widget roles require specific child roles to function correctly. ' +
            'For example, `role="listbox"` requires `role="option"` children. ' +
            'Without the required children, assistive technologies cannot navigate or operate the widget.',
        recovery:
            'Add child elements with the required roles as specified in the WAI-ARIA spec. ' +
            'Check the ARIA Authoring Practices Guide for the correct widget pattern and required child structure.',
        sourceAuthority: 'WCAG 2.1 AA; WAI-ARIA 1.2',
        regulatoryRef: '§ 4.1.2 Name, Role, Value (Level A)',
    },

    'FLINT-A11Y-032': {
        code: 'FLINT-A11Y-032',
        ruleId: 'A11Y-032',
        category: 'a11y',
        severity: 'critical',
        title: 'Element Outside Required ARIA Parent',
        explanation:
            'Certain ARIA roles are only meaningful in specific parent contexts. ' +
            'For example, `role="tab"` must be inside `role="tablist"`. ' +
            'An element with a required-context role outside that context has its semantics undefined or ignored.',
        recovery:
            'Wrap the element inside an ancestor with the required parent role. ' +
            'Restructure the component hierarchy to match the ARIA widget pattern. ' +
            'Refer to the WAI-ARIA spec "Required Context Role" for the specific rule.',
        sourceAuthority: 'WCAG 2.1 AA; WAI-ARIA 1.2',
        regulatoryRef: '§ 4.1.2 Name, Role, Value (Level A)',
    },

    'FLINT-A11Y-033': {
        code: 'FLINT-A11Y-033',
        ruleId: 'A11Y-033',
        category: 'a11y',
        severity: 'critical',
        title: 'Required ARIA Attribute Missing',
        explanation:
            'Some ARIA roles have required state or property attributes that must be present for the ' +
            'widget to be announced correctly. ' +
            'For example, `role="checkbox"` requires `aria-checked`. ' +
            'Without the required attribute, the widget state is undefined to assistive technologies.',
        recovery:
            'Add the required ARIA attribute with an appropriate initial value. ' +
            'Ensure the attribute is dynamically updated when widget state changes. ' +
            'Check the WAI-ARIA spec "Required States and Properties" for the specific role.',
        sourceAuthority: 'WCAG 2.1 AA; WAI-ARIA 1.2',
        regulatoryRef: '§ 4.1.2 Name, Role, Value (Level A)',
    },

    'FLINT-A11Y-034': {
        code: 'FLINT-A11Y-034',
        ruleId: 'A11Y-034',
        category: 'a11y',
        severity: 'critical',
        title: 'Invalid ARIA Attribute Name',
        explanation:
            'Only ARIA attributes defined in the WAI-ARIA 1.2 specification are valid. ' +
            'Misspelled or invented `aria-*` attributes are silently ignored by browsers and ATs, ' +
            'providing no accessible benefit while misleading developers into thinking accessibility is addressed.',
        recovery:
            'Correct the attribute name typo. Common errors: "aria-lable" → "aria-label", ' +
            '"aria-labelby" → "aria-labelledby", "aria-describeby" → "aria-describedby". ' +
            'Flint auto-fix can remove invalid attributes; re-add the corrected version.',
        sourceAuthority: 'WCAG 2.1 AA; WAI-ARIA 1.2',
        regulatoryRef: '§ 4.1.2 Name, Role, Value (Level A)',
    },

    'FLINT-A11Y-035': {
        code: 'FLINT-A11Y-035',
        ruleId: 'A11Y-035',
        category: 'a11y',
        severity: 'critical',
        title: 'Invalid ARIA Attribute Value',
        explanation:
            'ARIA state and property attributes have enumerated allowed values. ' +
            'For example, `aria-checked` must be "true", "false", or "mixed". ' +
            'Invalid values are treated as if the attribute were absent, removing the state announcement.',
        recovery:
            'Correct the attribute value to one of the allowed values specified in the WAI-ARIA spec. ' +
            'Ensure dynamic state updates also use valid values.',
        sourceAuthority: 'WCAG 2.1 AA; WAI-ARIA 1.2',
        regulatoryRef: '§ 4.1.2 Name, Role, Value (Level A)',
    },

    'FLINT-A11Y-036': {
        code: 'FLINT-A11Y-036',
        ruleId: 'A11Y-036',
        category: 'a11y',
        severity: 'critical',
        title: 'Aria-Hidden On Focusable Element',
        explanation:
            '`aria-hidden="true"` hides an element from the accessibility tree but does not remove it ' +
            'from the keyboard tab order. ' +
            'A focusable element that is hidden from AT but reachable by keyboard creates a "focus trap" — ' +
            'keyboard users land on an element that the screen reader cannot describe.',
        recovery:
            'Remove `aria-hidden="true"` from focusable elements, or add `tabIndex={-1}` to remove the ' +
            'element from the keyboard flow. ' +
            'If the element should be truly hidden, use CSS `display: none` or the `hidden` attribute.',
        sourceAuthority: 'WCAG 2.1 AA; WAI-ARIA 1.2',
        regulatoryRef: '§ 4.1.2 Name, Role, Value (Level A)',
    },

    'FLINT-A11Y-037': {
        code: 'FLINT-A11Y-037',
        ruleId: 'A11Y-037',
        category: 'a11y',
        severity: 'critical',
        title: 'Duplicate ARIA Attributes',
        explanation:
            'When the same ARIA attribute appears multiple times on an element, only the last value is ' +
            'used — but browser behavior is inconsistent. ' +
            'Duplicate attributes typically indicate a coding error where two code paths both set the ' +
            'same attribute without coordination.',
        recovery:
            'Remove the duplicate attribute declaration. ' +
            'Review the component\'s render logic to ensure a single, authoritative source sets each ARIA attribute.',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryRef: '§ 4.1.2 Name, Role, Value (Level A)',
    },

    'FLINT-A11Y-038': {
        code: 'FLINT-A11Y-038',
        ruleId: 'A11Y-038',
        category: 'a11y',
        severity: 'critical',
        title: 'Interactive Element With Presentation Role',
        explanation:
            '`role="presentation"` and `role="none"` strip all semantics from an element, including ' +
            'its interactive role. ' +
            'Applying these roles to `<button>`, `<input>`, `<a>`, or other interactive elements ' +
            'removes them from the accessibility tree, making them invisible and inoperable for AT users.',
        recovery:
            'Remove `role="presentation"` or `role="none"` from interactive elements. ' +
            'These roles are intended only for layout elements that carry no semantic meaning.',
        sourceAuthority: 'WCAG 2.1 AA; WAI-ARIA 1.2',
        regulatoryRef: '§ 4.1.2 Name, Role, Value (Level A)',
    },

    // ── A11y rules — Landmarks ─────────────────────────────────────────────────

    'FLINT-A11Y-050': {
        code: 'FLINT-A11Y-050',
        ruleId: 'A11Y-050',
        category: 'a11y',
        severity: 'critical',
        title: 'Missing Main Landmark',
        explanation:
            'The `<main>` landmark identifies the primary content area of the page, allowing screen ' +
            'reader users to skip navigation and jump directly to the content they came for. ' +
            'Without it, users must tab through every navigation item and header element on every page load.',
        recovery:
            'Wrap the primary page content in a `<main>` element or add `role="main"` to the container. ' +
            'There should be exactly one `<main>` per page.',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryRef: '§ 1.3.1 Info and Relationships (Level A)',
    },

    'FLINT-A11Y-051': {
        code: 'FLINT-A11Y-051',
        ruleId: 'A11Y-051',
        category: 'a11y',
        severity: 'warning',
        title: 'Missing Navigation Landmark',
        explanation:
            'The `<nav>` landmark identifies navigation regions, allowing screen reader users to jump ' +
            'directly to or skip over navigation. ' +
            'Pages with navigation menus but no `<nav>` landmark miss this structural shortcut.',
        recovery:
            'Wrap navigation menus in a `<nav>` element or add `role="navigation"`. ' +
            'If multiple `<nav>` elements exist, distinguish them with `aria-label`.',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryRef: '§ 1.3.1 Info and Relationships (Level A)',
    },

    'FLINT-A11Y-052': {
        code: 'FLINT-A11Y-052',
        ruleId: 'A11Y-052',
        category: 'a11y',
        severity: 'critical',
        title: 'Multiple Main Landmarks',
        explanation:
            'The `<main>` landmark must appear at most once per page. ' +
            'Multiple `<main>` elements create an ambiguous document structure — screen reader users ' +
            'land in unpredictable locations when navigating by landmarks.',
        recovery:
            'Ensure only one `<main>` element (or `role="main"`) exists in the document. ' +
            'For SPAs, dynamically swap the `<main>` content rather than rendering multiple.',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryRef: '§ 1.3.1 Info and Relationships (Level A)',
    },

    'FLINT-A11Y-053': {
        code: 'FLINT-A11Y-053',
        ruleId: 'A11Y-053',
        category: 'a11y',
        severity: 'critical',
        title: 'Duplicate Landmark Without Distinct Label',
        explanation:
            'When multiple landmarks of the same type exist (e.g. two `<nav>` elements), screen reader ' +
            'users navigating by landmarks cannot distinguish between them without distinct labels. ' +
            'The landmarks list becomes: "navigation, navigation" — meaningless.',
        recovery:
            'Add a unique `aria-label` to each instance of the repeated landmark, describing its purpose. ' +
            'For example: `<nav aria-label="Primary navigation">` and `<nav aria-label="Footer navigation">`.',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryRef: '§ 1.3.1 Info and Relationships (Level A)',
    },

    // ── A11y rules — Contrast ──────────────────────────────────────────────────

    'FLINT-A11Y-060': {
        code: 'FLINT-A11Y-060',
        ruleId: 'A11Y-060',
        category: 'a11y',
        severity: 'critical',
        title: 'Normal Text Insufficient Contrast',
        explanation:
            'Normal-size text must have a contrast ratio of at least 4.5:1 between the text color and ' +
            'background color per WCAG 2.1 AA. ' +
            'Low-contrast text is unreadable for users with low vision, color blindness, or when viewing ' +
            'screens in bright environments.',
        recovery:
            'Darken the text color or lighten the background (or both) until the 4.5:1 ratio is met. ' +
            'Use the WebAIM Contrast Checker or Flint\'s token picker to find compliant color pairs. ' +
            'Replace arbitrary color classes with token-backed classes that have been pre-validated for contrast.',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryRef: '§ 1.4.3 Contrast (Minimum) (Level AA)',
    },

    'FLINT-A11Y-061': {
        code: 'FLINT-A11Y-061',
        ruleId: 'A11Y-061',
        category: 'a11y',
        severity: 'critical',
        title: 'Large Text Insufficient Contrast',
        explanation:
            'Large text (18pt or 14pt bold) has a reduced minimum contrast requirement of 3:1 under ' +
            'WCAG 2.1 AA because the larger letterforms are easier to read at lower contrast. ' +
            'Text that fails even this reduced threshold is inaccessible to low-vision users.',
        recovery:
            'Adjust the text or background color to achieve at least 3:1 contrast. ' +
            'Large text is defined as 18pt (24px) regular or 14pt (18.67px) bold. ' +
            'Verify the text size when determining which threshold applies.',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryRef: '§ 1.4.3 Contrast (Minimum) (Level AA)',
    },

    'FLINT-A11Y-062': {
        code: 'FLINT-A11Y-062',
        ruleId: 'A11Y-062',
        category: 'a11y',
        severity: 'critical',
        title: 'UI Component Insufficient Contrast',
        explanation:
            'Interactive UI components (inputs, buttons, custom controls) must have at least 3:1 contrast ' +
            'between their visual boundaries and adjacent colors. ' +
            'This ensures users with low vision can identify form controls and interactive elements.',
        recovery:
            'Increase the border or outline contrast of the UI component against its background. ' +
            'Replace arbitrary border color classes with token-backed colors validated for 3:1 contrast. ' +
            'Consider adding a focus ring with adequate contrast for the focused state.',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryRef: '§ 1.4.11 Non-text Contrast (Level AA)',
    },

    // ── A11y rules — Forms ─────────────────────────────────────────────────────

    'FLINT-A11Y-070': {
        code: 'FLINT-A11Y-070',
        ruleId: 'A11Y-070',
        category: 'a11y',
        severity: 'critical',
        title: 'Fieldset Missing Legend',
        explanation:
            '`<fieldset>` groups related form controls and requires a `<legend>` child to describe the ' +
            'group to screen reader users. ' +
            'Without a `<legend>`, users hear each field in isolation without knowing what context ' +
            'connects them (e.g. "address fields", "payment method", "shipping options").',
        recovery:
            'Add a `<legend>` as the first child of `<fieldset>` with a concise description of the group. ' +
            'If visual design requires hiding the legend, use a visually-hidden CSS class rather than `display: none`.',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryRef: '§ 1.3.1 Info and Relationships (Level A)',
    },

    'FLINT-A11Y-071': {
        code: 'FLINT-A11Y-071',
        ruleId: 'A11Y-071',
        category: 'a11y',
        severity: 'critical',
        title: 'Required Input Missing aria-required',
        explanation:
            'The HTML `required` attribute prevents form submission but does not reliably communicate ' +
            'the required nature of the field to all screen readers. ' +
            '`aria-required="true"` provides a consistent signal to assistive technologies that the ' +
            'field must be filled before the form can be submitted.',
        recovery:
            'Add `aria-required="true"` alongside the `required` attribute. ' +
            'Ensure error messages are announced when required fields are left empty on submit.',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryRef: '§ 3.3.2 Labels or Instructions (Level A)',
    },

    'FLINT-A11Y-072': {
        code: 'FLINT-A11Y-072',
        ruleId: 'A11Y-072',
        category: 'a11y',
        severity: 'critical',
        title: 'Invalid Input Missing Error Description',
        explanation:
            '`aria-invalid="true"` signals to assistive technologies that a field contains an error, but ' +
            'it does not describe what the error is. ' +
            'Without `aria-describedby` pointing to an error message element, screen reader users know ' +
            'a field is invalid but not why.',
        recovery:
            'Add an error message element with a unique `id` and set `aria-describedby="[error-element-id]"` ' +
            'on the input. ' +
            'Show the error message element when the field is invalid and hide it otherwise.',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryRef: '§ 3.3.1 Error Identification (Level A)',
    },

    'FLINT-A11Y-073': {
        code: 'FLINT-A11Y-073',
        ruleId: 'A11Y-073',
        category: 'a11y',
        severity: 'critical',
        title: 'Invalid Autocomplete Value',
        explanation:
            'The `autocomplete` attribute helps browsers and password managers autofill form fields ' +
            'correctly, and is required by WCAG 1.3.5 to identify input purpose. ' +
            'Invalid values are silently ignored, disabling browser autofill and failing the criterion.',
        recovery:
            'Replace the invalid value with a standard HTML5 autofill detail token such as "name", ' +
            '"email", "tel", "current-password", or "street-address". ' +
            'See the full list of valid tokens in the HTML Living Standard.',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryRef: '§ 1.3.5 Identify Input Purpose (Level AA)',
    },

    // ── A11y rules — Behavioral Anti-Patterns (P1b) ────────────────────────────

    'FLINT-A11Y-100': {
        code: 'FLINT-A11Y-100',
        ruleId: 'A11Y-100',
        category: 'a11y',
        severity: 'critical',
        title: 'Interactive Handler on Non-Interactive Element',
        explanation:
            'Non-interactive HTML elements like `<div>`, `<span>`, and `<section>` have no implicit ARIA ' +
            'role or keyboard behavior. Adding `onClick` or other event handlers makes them visually ' +
            'clickable for mouse users, but keyboard users cannot focus or activate them, and screen ' +
            'readers do not announce them as interactive controls.',
        recovery:
            'Replace the element with a native interactive element like `<button>`, or add ' +
            '`role="button"` and `tabIndex={0}` to make it keyboard-focusable and semantically interactive. ' +
            'Also add an `onKeyDown` handler to support Enter/Space activation.',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryRef: '§ 4.1.2 Name, Role, Value (Level A)',
    },

    'FLINT-A11Y-101': {
        code: 'FLINT-A11Y-101',
        ruleId: 'A11Y-101',
        category: 'a11y',
        severity: 'critical',
        title: 'Dialog Missing Accessibility Attributes',
        explanation:
            'Dialog and modal components must declare `role="dialog"` and `aria-modal="true"` so that ' +
            'assistive technologies can manage focus trapping and announce the dialog context. ' +
            'Without these, screen reader users may navigate outside the modal boundary without realizing ' +
            'background content is blocked.',
        recovery:
            'Add `role="dialog"` and `aria-modal="true"` to the dialog root element. ' +
            'Use a native `<dialog>` element where possible, which provides these semantics automatically. ' +
            'Ensure focus is trapped within the dialog and returned to the trigger element on close.',
        sourceAuthority: 'WCAG 2.1 AA; WAI-ARIA 1.2',
        regulatoryRef: '§ 4.1.2 Name, Role, Value (Level A)',
    },

    'FLINT-A11Y-102': {
        code: 'FLINT-A11Y-102',
        ruleId: 'A11Y-102',
        category: 'a11y',
        severity: 'critical',
        title: 'Navigation Component Missing Nav Landmark',
        explanation:
            'Components classified as navigation must use a `<nav>` element or `role="navigation"` to be ' +
            'identified as a navigation landmark. Screen reader users rely on landmark navigation to jump ' +
            'directly to or skip over navigation regions.',
        recovery:
            'Wrap the navigation content in a `<nav>` element, or add `role="navigation"` to the root ' +
            'element. If multiple navigation regions exist, give each a unique `aria-label`.',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryRef: '§ 1.3.1 Info and Relationships (Level A)',
    },

    'FLINT-A11Y-103': {
        code: 'FLINT-A11Y-103',
        ruleId: 'A11Y-103',
        category: 'a11y',
        severity: 'critical',
        title: 'Form Component Missing Form Landmark',
        explanation:
            'Components classified as forms should use a `<form>` element or `role="form"` to provide ' +
            'proper form semantics. Without these, assistive technologies cannot identify form boundaries, ' +
            'and the browser\'s native form submission and validation behaviors are unavailable.',
        recovery:
            'Wrap form controls in a `<form>` element, or add `role="form"` to the container. ' +
            'A `<form>` element also enables native form submission via Enter key and browser validation.',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryRef: '§ 1.3.1 Info and Relationships (Level A)',
    },

    // ── Session rules (GOV.3) ──────────────────────────────────────────────────

    'FLINT-SES-001': {
        code: 'FLINT-SES-001',
        ruleId: 'SES-001',
        category: 'session',
        severity: 'error',
        title: 'Duplicate Flint Node IDs',
        explanation:
            'Flint uses `data-flint-id` attributes to track individual AST nodes across edits. ' +
            'Duplicate IDs cause the mutation engine to target the wrong node during AST operations, ' +
            'producing incorrect or destructive code edits.',
        recovery:
            'Re-run `injectFlintIds` on the affected file to regenerate unique IDs. ' +
            'Duplicate IDs typically arise from copy-paste operations that bypass the AST surgery layer. ' +
            'Use the Flint undo system to restore the pre-duplicate state if needed.',
        sourceAuthority: 'Flint Commandment 7 (ID Preservation)',
    },

    'FLINT-SES-002': {
        code: 'FLINT-SES-002',
        ruleId: 'SES-002',
        category: 'session',
        severity: 'warning',
        title: 'Orphaned Nodes',
        explanation:
            'Orphaned nodes are AST elements with `data-flint-id` attributes that are not registered ' +
            'in the Flint node index. ' +
            'They accumulate from structural operations (delete, move) that did not clean up stale IDs, ' +
            'bloating the session state without providing useful tracking.',
        recovery:
            'Reload the file in Flint to rebuild the node index from the current AST. ' +
            'If orphaned nodes persist, run a full session reset to clear stale index entries.',
        sourceAuthority: 'Flint Commandment 7 (ID Preservation)',
    },

    'FLINT-SES-003': {
        code: 'FLINT-SES-003',
        ruleId: 'SES-003',
        category: 'session',
        severity: 'warning',
        title: 'Stale Imports',
        explanation:
            'Stale imports are `import` statements that reference components or utilities no longer used ' +
            'in the file. ' +
            'They accumulate during cross-file move and delete operations and inflate bundle size. ' +
            'They also confuse the Import Synthesizer when generating context for new component insertions.',
        recovery:
            'Run `flint_fix` with the import cleanup option to remove unused imports automatically. ' +
            'The Import Synthesizer (`synthesizeImports`) will remove stale entries when the next mutation batch is applied.',
        sourceAuthority: 'Flint Commandment 1 (Code is Truth)',
    },

    'FLINT-SES-004': {
        code: 'FLINT-SES-004',
        ruleId: 'SES-004',
        category: 'session',
        severity: 'error',
        title: 'Missing Flint IDs',
        explanation:
            'JSX elements without `data-flint-id` attributes cannot be targeted by Flint\'s mutation ' +
            'engine. ' +
            'They become invisible to the visual layer and cannot be selected, moved, or mutated via ' +
            'Flint\'s AST surgery operations.',
        recovery:
            'Run `injectFlintIds` on the affected file to assign IDs to all eligible JSX elements. ' +
            'This happens automatically on file load and after every structural mutation — if IDs are ' +
            'missing, the file may have been edited outside Flint.',
        sourceAuthority: 'Flint Commandment 7 (ID Preservation)',
    },

    // ── CR-SEAL: Registry constraint rules ────────────────────────────────────

    'FLINT-REG-001': {
        code: 'FLINT-REG-001',
        ruleId: 'REG-001',
        category: 'governance',
        severity: 'warning',
        title: 'Unregistered Component Usage',
        explanation:
            'A component was used that is not part of your project\'s registered component library. ' +
            'When a library is configured, Flint ensures all generated and existing code uses only ' +
            'approved components — this prevents design system drift and unauthorized component usage.',
        recovery:
            'Add this component to your Armory (project registry), or replace it with ' +
            'a registered alternative from your component library.',
        sourceAuthority: 'Flint CR.2 (Constrained Registry)',
    },

    // ── P2: Rogue Intrinsic Detection ─────────────────────────────────────────

    'FLINT-MITH-019': {
        code: 'FLINT-MITH-019',
        ruleId: 'MITHRIL-REG-001',
        category: 'mithril',
        severity: 'warning',
        title: 'Rogue Intrinsic Element — Design System Component Available',
        explanation:
            'A raw HTML intrinsic element was used when the project\'s component registry provides ' +
            'a design system equivalent. Using raw intrinsics instead of library components creates ' +
            'inconsistent styling, accessibility gaps, and design system drift. LLMs frequently ' +
            'default to raw HTML elements instead of the project\'s component library.',
        recovery:
            'Replace the raw HTML element with the corresponding design system component. ' +
            'For example: <button> → <Button>, <input> → <Input>, <select> → <Select>. ' +
            'The violation message includes the exact import path and component name to use.',
        sourceAuthority: 'Commandment 2 (No Hallucinated Styling) + Flint P2 (Design System Adoption Enforcement)',
    },

    // ── P2.5: Composition & Slot Governance ──────────────────────────────────

    'FLINT-MITH-020': {
        code: 'FLINT-MITH-020',
        ruleId: 'MITHRIL-COMP-001',
        category: 'mithril',
        severity: 'warning',
        title: 'Forbidden Child Component',
        explanation:
            'A component was nested inside a parent that explicitly forbids it, or it is not in the ' +
            'parent\'s allowed children list. Design systems define structural contracts between components — ' +
            'for example, a Card should never be placed inside a Button, and a Table should not appear ' +
            'inside an interactive control. Violating these contracts produces broken layouts, ' +
            'inaccessible interaction patterns, and unpredictable rendering behavior.',
        recovery:
            'Move the child component outside of its current parent, or restructure the composition ' +
            'to use an approved parent-child relationship. Check the component\'s compositionRules ' +
            'in the registry for the list of allowed and forbidden children.',
        sourceAuthority: 'Commandment 2 (No Hallucinated Styling) + Flint P2.5 (Composition & Slot Governance)',
    },

    'FLINT-MITH-021': {
        code: 'FLINT-MITH-021',
        ruleId: 'MITHRIL-COMP-002',
        category: 'mithril',
        severity: 'warning',
        title: 'Missing Required Parent Component',
        explanation:
            'A component that requires a specific parent container was used outside of it. ' +
            'Some components are designed to function only within their parent context — ' +
            'for example, TabPanel must appear inside Tabs, and DialogFooter must appear inside Dialog. ' +
            'Using them standalone produces broken behavior because they depend on the parent ' +
            'for state management, layout context, or accessibility semantics.',
        recovery:
            'Wrap this component inside the required parent component. Check the component\'s ' +
            'compositionRules.requiredParent field in the registry for the correct parent.',
        sourceAuthority: 'Commandment 2 (No Hallucinated Styling) + Flint P2.5 (Composition & Slot Governance)',
    },

    'FLINT-MITH-022': {
        code: 'FLINT-MITH-022',
        ruleId: 'MITHRIL-COMP-003',
        category: 'mithril',
        severity: 'warning',
        title: 'Maximum Component Nesting Depth Exceeded',
        explanation:
            'A component is nested deeper than its maximum allowed depth. Deep nesting of the same ' +
            'component type (e.g., Card inside Card inside Card) indicates a structural anti-pattern ' +
            'that typically produces broken layouts, performance issues, and confusing visual hierarchy. ' +
            'Design systems set maximum depth limits to enforce flat, maintainable compositions.',
        recovery:
            'Flatten the component structure by removing unnecessary nesting levels. If the deep ' +
            'nesting is intentional, consider using a different component or increasing the maxDepth ' +
            'limit in the component\'s compositionRules.',
        sourceAuthority: 'Commandment 2 (No Hallucinated Styling) + Flint P2.5 (Composition & Slot Governance)',
    },

    // ── P7: Visual Regression ────────────────────────────────────────────────

    'FLINT-VIS-001': {
        code: 'FLINT-VIS-001',
        ruleId: 'VISUAL-REG-001',
        category: 'mithril',
        severity: 'warning',
        title: 'Visual Regression Detected',
        explanation:
            'A rendered element diverged from its expected Figma bounding box by more than the configured ' +
            'tolerance. AST-level analysis cannot detect context-dependent CSS failures like flex shrinking, ' +
            'overflow clipping, or cascading font-size inheritance — only a real browser layout engine can. ' +
            'Visual regression auditing closes that blind spot by rendering the component in a hidden ' +
            'BrowserWindow and measuring bounding boxes against the Figma AST.',
        recovery:
            'Open the component in Flint Glass and inspect the highlighted element. Common fixes: add ' +
            '`flex-shrink-0` to prevent unintended shrinking, `overflow-hidden` or `min-w-0` to contain ' +
            'width overflow, or `flex-none` to lock a layout slot. Re-run the visual audit to confirm.',
        sourceAuthority: 'Commandment 2 (No Hallucinated Styling) + Flint P7 (Visual Regression Driving AST Mutation)',
    },
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Returns the ErrorEntry for the given Flint error code, or null if not found.
 * O(1) hash map lookup — safe to call on every linter iteration.
 */
export function getErrorEntry(code: string): ErrorEntry | null {
    return REGISTRY[code] ?? null
}

/**
 * Returns the ErrorEntry whose ruleId matches the given rule identifier.
 * Used by linter visitors to attach explanation/recovery to warnings by ruleId.
 * O(n) scan — call once at startup or cache results if calling in a hot loop.
 */
export function getErrorEntryByRuleId(ruleId: string): ErrorEntry | null {
    for (const entry of Object.values(REGISTRY)) {
        if (entry.ruleId === ruleId) return entry
    }
    return null
}

/**
 * Returns all ErrorEntries belonging to the specified category.
 */
export function getErrorsByCategory(category: ErrorCategory): ErrorEntry[] {
    return Object.values(REGISTRY).filter((e) => e.category === category)
}

/**
 * Returns every registered ErrorEntry in insertion order.
 */
export function getAllErrors(): ErrorEntry[] {
    return Object.values(REGISTRY)
}

/**
 * Formats an ErrorEntry into a human-readable string suitable for agent responses
 * and CLI output. Includes title, explanation, recovery, and authority when present.
 */
export function formatErrorForAgent(entry: ErrorEntry): string {
    const lines: string[] = [
        `[${entry.code}] ${entry.title}`,
        '',
        `Explanation: ${entry.explanation}`,
        '',
        `Recovery: ${entry.recovery}`,
    ]

    if (entry.sourceAuthority) {
        lines.push('')
        lines.push(`Authority: ${entry.sourceAuthority}`)
    }

    if (entry.regulatoryRef) {
        lines.push(`Reference: ${entry.regulatoryRef}`)
    }

    return lines.join('\n')
}
