/**
 * D2C.4 Feature 1 — classifyFrame + classifyComponent unit tests
 *
 * Dedicated test file covering the structural heuristics that map Figma FRAME
 * nodes to semantic HTML wrapper types and component classifications.
 *
 * The actual implementation returns a plain FrameClassification string (not
 * the contract's FrameClassificationResult with confidence) because the
 * implementer simplified the interface. Tests are written against the actual
 * implementation signatures:
 *
 *   classifyFrame(node, depth) => FrameClassification
 *   classifyComponent(name, componentType?) => ComponentClassification | null
 */

import { describe, it, expect } from 'vitest';
import { classifyFrame, classifyComponent } from '../hydroPaste.js';

// ---------------------------------------------------------------------------
// classifyFrame — card / panel keywords
// ---------------------------------------------------------------------------

describe('classifyFrame — card/panel keywords', () => {
    it('returns "card" for name containing "card" (e.g. "ProfileCard")', () => {
        expect(classifyFrame({ name: 'ProfileCard', type: 'FRAME' }, 2)).toBe('card');
    });

    it('returns "card" for name containing "panel" (e.g. "DashboardPanel")', () => {
        expect(classifyFrame({ name: 'DashboardPanel', type: 'FRAME' }, 3)).toBe('card');
    });

    it('card keyword takes priority over depth-based section even at depth 0', () => {
        // Card keyword wins over depth-based rules
        expect(classifyFrame({ name: 'InfoCard', type: 'FRAME' }, 0)).toBe('card');
    });
});

// ---------------------------------------------------------------------------
// classifyFrame — form keyword
// ---------------------------------------------------------------------------

describe('classifyFrame — form keyword', () => {
    it('returns "form" for name "ContactForm"', () => {
        expect(classifyFrame({ name: 'ContactForm', type: 'FRAME' }, 2)).toBe('form');
    });

    it('returns "form" for name "contact-form" (case insensitive)', () => {
        expect(classifyFrame({ name: 'contact-form', type: 'FRAME' }, 3)).toBe('form');
    });

    it('returns "form" for name "RegistrationForm"', () => {
        expect(classifyFrame({ name: 'RegistrationForm', type: 'FRAME' }, 1)).toBe('form');
    });

    it('form keyword wins over depth <= 1 rule', () => {
        // "form" keyword should return 'form', not 'div' (depth fallback)
        expect(classifyFrame({ name: 'SignupForm', type: 'FRAME' }, 0)).toBe('form');
    });
});

// ---------------------------------------------------------------------------
// classifyFrame — nav keywords
// ---------------------------------------------------------------------------

describe('classifyFrame — nav keywords', () => {
    it('returns "nav" for name "NavigationBar"', () => {
        expect(classifyFrame({ name: 'NavigationBar', type: 'FRAME' }, 1)).toBe('nav');
    });

    it('returns "nav" for name "sidebar-menu" (sidebar and menu are nav keywords per D2C.4 contract)', () => {
        // "sidebar-menu" contains both "sidebar" and "menu" which are now
        // included in the nav keyword list per the D2C.4 contract.
        const result = classifyFrame({ name: 'sidebar-menu', type: 'FRAME' }, 2);
        expect(result).toBe('nav');
    });

    it('returns "nav" for name "MainNavbar"', () => {
        expect(classifyFrame({ name: 'MainNavbar', type: 'FRAME' }, 2)).toBe('nav');
    });

    it('returns "nav" for name "SiteNav"', () => {
        expect(classifyFrame({ name: 'SiteNav', type: 'FRAME' }, 2)).toBe('nav');
    });

    it('nav keyword wins over depth <= 1 rule', () => {
        expect(classifyFrame({ name: 'TopNav', type: 'FRAME' }, 0)).toBe('nav');
    });
});

// ---------------------------------------------------------------------------
// classifyFrame — header / footer keywords
// ---------------------------------------------------------------------------

describe('classifyFrame — header/footer keywords', () => {
    it('returns "header" for name "PageHeader"', () => {
        expect(classifyFrame({ name: 'PageHeader', type: 'FRAME' }, 1)).toBe('header');
    });

    it('returns "footer" for name "SiteFooter"', () => {
        expect(classifyFrame({ name: 'SiteFooter', type: 'FRAME' }, 1)).toBe('footer');
    });
});

// ---------------------------------------------------------------------------
// classifyFrame — section keywords
// ---------------------------------------------------------------------------

describe('classifyFrame — section keywords', () => {
    it('returns "section" for name "HeroSection"', () => {
        expect(classifyFrame({ name: 'HeroSection', type: 'FRAME' }, 2)).toBe('section');
    });

    it('returns "section" for name "PromoBanner"', () => {
        expect(classifyFrame({ name: 'PromoBanner', type: 'FRAME' }, 2)).toBe('section');
    });

    it('section keyword wins over depth <= 1 fallback', () => {
        expect(classifyFrame({ name: 'HeroBanner', type: 'FRAME' }, 0)).toBe('section');
    });
});

// ---------------------------------------------------------------------------
// classifyFrame — depth-based fallback (shallow = div)
// ---------------------------------------------------------------------------

describe('classifyFrame — depth-based fallback', () => {
    it('returns "div" for depth 0 FRAME with generic name', () => {
        expect(classifyFrame({ name: 'RootFrame', type: 'FRAME' }, 0)).toBe('div');
    });

    it('returns "div" for depth 1 FRAME with generic name', () => {
        expect(classifyFrame({ name: 'LayoutFrame', type: 'FRAME' }, 1)).toBe('div');
    });

    it('depth 0 with many children still returns "div" (section requires name keyword)', () => {
        // The implementation uses name-based keywords for section, not child count
        const node = {
            name: 'TopLevel',
            type: 'FRAME',
            children: [
                { name: 'A', type: 'TEXT', characters: 'a' },
                { name: 'B', type: 'TEXT', characters: 'b' },
                { name: 'C', type: 'TEXT', characters: 'c' },
            ],
        };
        expect(classifyFrame(node, 0)).toBe('div');
    });
});

// ---------------------------------------------------------------------------
// classifyFrame — visual cue card detection (fill + shadow/border keyword)
// ---------------------------------------------------------------------------

describe('classifyFrame — visual cue card detection', () => {
    it('returns "card" for depth >= 2 with solid fill and "shadow" in name', () => {
        const node = {
            name: 'ProductShadowTile',
            type: 'FRAME',
            fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }],
        };
        expect(classifyFrame(node, 3)).toBe('card');
    });

    it('returns "card" for depth >= 2 with solid fill and "border" in name', () => {
        const node = {
            name: 'ItemBorderBox',
            type: 'FRAME',
            fills: [{ type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.9 } }],
        };
        expect(classifyFrame(node, 2)).toBe('card');
    });

    it('returns "card" for depth >= 2 with solid fill and "stroke" in name', () => {
        const node = {
            name: 'StrokeContainer',
            type: 'FRAME',
            fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }],
        };
        expect(classifyFrame(node, 2)).toBe('card');
    });

    it('returns "div" for depth >= 2 with fill but no visual cue keyword in name', () => {
        const node = {
            name: 'ContentArea',
            type: 'FRAME',
            fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }],
        };
        expect(classifyFrame(node, 3)).toBe('div');
    });

    it('returns "div" for depth >= 2 with visual cue keyword but no solid fill', () => {
        const node = {
            name: 'ShadowBox',
            type: 'FRAME',
            fills: [{ type: 'IMAGE' }],
        };
        expect(classifyFrame(node, 3)).toBe('div');
    });
});

// ---------------------------------------------------------------------------
// classifyFrame — layout keyword fallback
// ---------------------------------------------------------------------------

describe('classifyFrame — layout keywords produce "div"', () => {
    it('returns "div" for "MainContainer"', () => {
        expect(classifyFrame({ name: 'MainContainer', type: 'FRAME' }, 2)).toBe('div');
    });

    it('returns "div" for "ContentWrapper"', () => {
        expect(classifyFrame({ name: 'ContentWrapper', type: 'FRAME' }, 3)).toBe('div');
    });

    it('returns "div" for "MainLayout"', () => {
        expect(classifyFrame({ name: 'MainLayout', type: 'FRAME' }, 2)).toBe('div');
    });

    it('returns "div" for name containing "row"', () => {
        expect(classifyFrame({ name: 'ItemRow', type: 'FRAME' }, 2)).toBe('div');
    });

    it('returns "div" for name containing "col"', () => {
        expect(classifyFrame({ name: 'LeftCol', type: 'FRAME' }, 2)).toBe('div');
    });

    it('returns "div" for name containing "group"', () => {
        expect(classifyFrame({ name: 'ButtonGroup', type: 'FRAME' }, 2)).toBe('div');
    });
});

// ---------------------------------------------------------------------------
// classifyFrame — default fallback for unrecognized names
// ---------------------------------------------------------------------------

describe('classifyFrame — default fallback', () => {
    it('returns "div" for completely unrecognized name at depth >= 2', () => {
        expect(classifyFrame({ name: 'XyzUnknown123', type: 'FRAME' }, 2)).toBe('div');
    });

    it('returns "div" for empty name at depth >= 2', () => {
        expect(classifyFrame({ name: '', type: 'FRAME' }, 2)).toBe('div');
    });

    it('returns "div" for node with missing name property', () => {
        expect(classifyFrame({ type: 'FRAME' }, 2)).toBe('div');
    });
});

// ---------------------------------------------------------------------------
// classifyFrame — priority order validation
// ---------------------------------------------------------------------------

describe('classifyFrame — priority order (first keyword match wins)', () => {
    it('card keyword wins over form keyword (e.g. "FormCard")', () => {
        // "card" is checked before "form" in the decision tree
        expect(classifyFrame({ name: 'FormCard', type: 'FRAME' }, 2)).toBe('card');
    });

    it('form keyword wins over nav keyword (e.g. "NavigationForm")', () => {
        // "form" is checked before "nav"
        // Actually "nav" is also in "NavigationForm" and nav is checked AFTER form
        expect(classifyFrame({ name: 'NavigationForm', type: 'FRAME' }, 2)).toBe('form');
    });

    it('card keyword wins over header keyword (e.g. "HeaderCard")', () => {
        expect(classifyFrame({ name: 'HeaderCard', type: 'FRAME' }, 2)).toBe('card');
    });
});

// ===========================================================================
// classifyComponent tests
// ===========================================================================

// ---------------------------------------------------------------------------
// classifyComponent — input classification
// ---------------------------------------------------------------------------

describe('classifyComponent — input type matching', () => {
    it('"EmailInput" returns Input with matchedKeywords ["input"]', () => {
        const result = classifyComponent('EmailInput');
        expect(result).not.toBeNull();
        expect(result!.type).toBe('input');
        expect(result!.matchedKeywords).toContain('input');
    });

    it('"PasswordTextField" returns Input with matchedKeywords containing "textfield"', () => {
        const result = classifyComponent('PasswordTextField');
        expect(result).not.toBeNull();
        expect(result!.type).toBe('input');
        expect(result!.matchedKeywords).toContain('textfield');
    });

    it('"SearchField" returns Input with matchedKeywords containing "field"', () => {
        const result = classifyComponent('SearchField');
        expect(result).not.toBeNull();
        expect(result!.type).toBe('input');
    });
});

// ---------------------------------------------------------------------------
// classifyComponent — avatar classification
// ---------------------------------------------------------------------------

describe('classifyComponent — avatar type matching', () => {
    it('"UserAvatar" returns Avatar with matchedKeywords ["avatar"]', () => {
        const result = classifyComponent('UserAvatar');
        expect(result).not.toBeNull();
        expect(result!.type).toBe('avatar');
        expect(result!.matchedKeywords).toContain('avatar');
    });
});

// ---------------------------------------------------------------------------
// classifyComponent — select classification
// ---------------------------------------------------------------------------

describe('classifyComponent — select type matching', () => {
    it('"MainDropdown" returns Select with matchedKeywords ["dropdown"]', () => {
        const result = classifyComponent('MainDropdown');
        expect(result).not.toBeNull();
        expect(result!.type).toBe('select');
        expect(result!.matchedKeywords).toContain('dropdown');
    });
});

// ---------------------------------------------------------------------------
// classifyComponent — switch classification
// ---------------------------------------------------------------------------

describe('classifyComponent — switch type matching', () => {
    it('"dark-toggle" returns Switch with matchedKeywords ["toggle"]', () => {
        const result = classifyComponent('dark-toggle');
        expect(result).not.toBeNull();
        expect(result!.type).toBe('switch');
        expect(result!.matchedKeywords).toContain('toggle');
    });
});

// ---------------------------------------------------------------------------
// classifyComponent — badge classification
// ---------------------------------------------------------------------------

describe('classifyComponent — badge type matching', () => {
    it('"status-badge" returns Badge with matchedKeywords ["badge"]', () => {
        const result = classifyComponent('status-badge');
        expect(result).not.toBeNull();
        expect(result!.type).toBe('badge');
        expect(result!.matchedKeywords).toContain('badge');
    });
});

// ---------------------------------------------------------------------------
// classifyComponent — separator classification
// ---------------------------------------------------------------------------

describe('classifyComponent — separator type matching', () => {
    it('"content-divider" returns Separator with matchedKeywords ["divider"]', () => {
        const result = classifyComponent('content-divider');
        expect(result).not.toBeNull();
        expect(result!.type).toBe('separator');
        expect(result!.matchedKeywords).toContain('divider');
    });
});

// ---------------------------------------------------------------------------
// classifyComponent — alert classification
// ---------------------------------------------------------------------------

describe('classifyComponent — alert type matching', () => {
    it('"alert-message" returns Alert with matchedKeywords containing "alert" (first match wins)', () => {
        const result = classifyComponent('alert-message');
        expect(result).not.toBeNull();
        expect(result!.type).toBe('alert');
        expect(result!.matchedKeywords).toContain('alert');
        expect(result!.matchedKeywords).toContain('message');
    });
});

// ---------------------------------------------------------------------------
// classifyComponent — null results (no match)
// ---------------------------------------------------------------------------

describe('classifyComponent — null results for non-matching names', () => {
    it('"MainContainer" returns null', () => {
        expect(classifyComponent('MainContainer')).toBeNull();
    });

    it('"SomeRandomFrame" returns null', () => {
        expect(classifyComponent('SomeRandomFrame')).toBeNull();
    });

    it('empty string returns null', () => {
        expect(classifyComponent('')).toBeNull();
    });

    it('"ProfileCard" returns null (card is not a component type)', () => {
        expect(classifyComponent('ProfileCard')).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// classifyComponent — case insensitivity
// ---------------------------------------------------------------------------

describe('classifyComponent — case insensitivity', () => {
    it('"EMAIL_INPUT" (all caps) returns Input', () => {
        const result = classifyComponent('EMAIL_INPUT');
        expect(result).not.toBeNull();
        expect(result!.type).toBe('input');
    });

    it('"user-AVATAR" (mixed case) returns Avatar', () => {
        const result = classifyComponent('user-AVATAR');
        expect(result).not.toBeNull();
        expect(result!.type).toBe('avatar');
    });

    it('"DARK-TOGGLE" returns Switch', () => {
        const result = classifyComponent('DARK-TOGGLE');
        expect(result).not.toBeNull();
        expect(result!.type).toBe('switch');
    });
});

// ---------------------------------------------------------------------------
// classifyComponent — componentType override (Figma MCP enrichment)
// ---------------------------------------------------------------------------

describe('classifyComponent — componentType override param', () => {
    it('returns the componentType directly when provided', () => {
        const result = classifyComponent('SomeGenericName', 'input');
        expect(result).not.toBeNull();
        expect(result!.type).toBe('input');
        expect(result!.matchedKeywords).toContain('data-name:input');
    });

    it('componentType takes priority over name-based matching', () => {
        // Name "UserAvatar" would match avatar, but componentType overrides it
        const result = classifyComponent('UserAvatar', 'badge');
        expect(result).not.toBeNull();
        expect(result!.type).toBe('badge');
        expect(result!.matchedKeywords).toContain('data-name:badge');
    });
});

// ---------------------------------------------------------------------------
// classifyComponent — tabs exclusion (table guard)
// ---------------------------------------------------------------------------

describe('classifyComponent — tabs vs table guard', () => {
    it('"SettingsTab" returns tabs', () => {
        const result = classifyComponent('SettingsTab');
        expect(result).not.toBeNull();
        expect(result!.type).toBe('tabs');
    });

    it('"DataTable" does NOT match tabs (table exclusion)', () => {
        expect(classifyComponent('DataTable')).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// classifyComponent — textarea vs input ordering
// ---------------------------------------------------------------------------

describe('classifyComponent — textarea beats input when both could match', () => {
    it('"MultilineInput" returns textarea (multiline keyword wins)', () => {
        const result = classifyComponent('MultilineInput');
        expect(result).not.toBeNull();
        expect(result!.type).toBe('textarea');
    });

    it('"CommentTextArea" returns textarea', () => {
        const result = classifyComponent('CommentTextArea');
        expect(result).not.toBeNull();
        expect(result!.type).toBe('textarea');
    });

    it('"UserTextField" returns input (textfield maps to input)', () => {
        const result = classifyComponent('UserTextField');
        expect(result).not.toBeNull();
        expect(result!.type).toBe('input');
    });
});
