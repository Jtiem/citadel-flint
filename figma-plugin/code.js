"use strict";
/**
 * Bridge Link — code.ts  (Figma plugin main thread)
 *
 * Runs in Figma's sandboxed JS environment (no DOM, no fetch).
 * Its only job: collect local variable data and pass it to ui.html via postMessage.
 *
 * To compile:
 *   npm install          (installs @figma/plugin-typings + typescript)
 *   npm run build        (runs tsc → outputs code.js)
 *
 * Or load code.js directly — it is the pre-compiled equivalent of this file.
 */
figma.showUI(__html__, { width: 320, height: 260, title: 'Bridge Link' });
figma.ui.onmessage = (msg) => {
    if (msg.type === 'sync') {
        try {
            const collections = figma.variables.getLocalVariableCollections();
            const allVariables = figma.variables.getLocalVariables();
            // Build ID-keyed maps — the shape that normalizeFigmaVariables expects.
            const variablesMap = {};
            for (const v of allVariables) {
                variablesMap[v.id] = {
                    id: v.id,
                    name: v.name,
                    resolvedType: v.resolvedType,
                    valuesByMode: v.valuesByMode,
                    description: v.description,
                    variableCollectionId: v.variableCollectionId,
                };
            }
            const collectionsMap = {};
            for (const c of collections) {
                collectionsMap[c.id] = {
                    id: c.id,
                    name: c.name,
                    defaultModeId: c.defaultModeId,
                    variableIds: c.variableIds,
                    modes: c.modes,
                };
            }
            figma.ui.postMessage({
                type: 'payload',
                data: { variables: variablesMap, variableCollections: collectionsMap },
            });
        }
        catch (err) {
            figma.ui.postMessage({ type: 'error', message: String(err) });
        }
    }
    if (msg.type === 'export-ast') {
        try {
            const selection = figma.currentPage.selection;
            if (selection.length === 0) {
                figma.ui.postMessage({ type: 'error', message: "Select a Frame or Component to export." });
                return;
            }
            const root = selection[0];
            const payload = {
                screenName: root.name.replace(/[^a-zA-Z0-9]/g, ''),
                children: extractComponentTree(root)
            };
            figma.ui.postMessage({
                type: 'ast-payload',
                data: JSON.stringify(payload, null, 2)
            });
        }
        catch (err) {
            figma.ui.postMessage({ type: 'error', message: String(err) });
        }
    }
};
// ── Visual style extraction ────────────────────────────────────────────────
// Reads Figma node properties and returns a flat object of visual styles
// that the Bridge hydration pipeline can convert to Tailwind classes.
function rgbToHex(r, g, b) {
    const to256 = (v) => Math.round(v * 255);
    return '#' + [to256(r), to256(g), to256(b)].map(c => c.toString(16).padStart(2, '0')).join('');
}
function extractStyles(node) {
    const styles = {};
    let hasAny = false;
    // ── Layout (auto-layout on frames) ──────────────────────────────
    if ('layoutMode' in node && node.layoutMode !== 'NONE') {
        const f = node;
        styles.layoutMode = f.layoutMode; // 'HORIZONTAL' | 'VERTICAL'
        styles.itemSpacing = f.itemSpacing; // gap between children
        styles.paddingTop = f.paddingTop;
        styles.paddingRight = f.paddingRight;
        styles.paddingBottom = f.paddingBottom;
        styles.paddingLeft = f.paddingLeft;
        styles.primaryAxisAlignItems = f.primaryAxisAlignItems; // 'MIN'|'CENTER'|'MAX'|'SPACE_BETWEEN'
        styles.counterAxisAlignItems = f.counterAxisAlignItems; // 'MIN'|'CENTER'|'MAX'
        hasAny = true;
    }
    // ── Sizing ──────────────────────────────────────────────────────
    if ('width' in node && 'height' in node) {
        styles.width = Math.round(node.width);
        styles.height = Math.round(node.height);
        hasAny = true;
    }
    // ── Fill color (first solid paint) ──────────────────────────────
    if ('fills' in node) {
        const fills = node.fills;
        if (Array.isArray(fills)) {
            const solid = fills.find((f) => f.type === 'SOLID' && f.visible !== false);
            if (solid) {
                styles.fillColor = rgbToHex(solid.color.r, solid.color.g, solid.color.b);
                if (solid.opacity !== undefined && solid.opacity < 1) {
                    styles.fillOpacity = Math.round(solid.opacity * 100);
                }
                hasAny = true;
            }
        }
    }
    // ── Stroke ──────────────────────────────────────────────────────
    if ('strokes' in node) {
        const strokes = node.strokes;
        if (Array.isArray(strokes) && strokes.length > 0) {
            const solid = strokes.find((s) => s.type === 'SOLID' && s.visible !== false);
            if (solid) {
                styles.strokeColor = rgbToHex(solid.color.r, solid.color.g, solid.color.b);
                hasAny = true;
            }
        }
        if ('strokeWeight' in node && typeof node.strokeWeight === 'number') {
            styles.strokeWeight = node.strokeWeight;
            hasAny = true;
        }
    }
    // ── Corner radius ───────────────────────────────────────────────
    if ('cornerRadius' in node && typeof node.cornerRadius === 'number' && node.cornerRadius > 0) {
        styles.cornerRadius = node.cornerRadius;
        hasAny = true;
    }
    // ── Opacity ─────────────────────────────────────────────────────
    if ('opacity' in node && typeof node.opacity === 'number' && node.opacity < 1) {
        styles.opacity = Math.round(node.opacity * 100);
        hasAny = true;
    }
    // ── Typography (TEXT nodes) ──────────────────────────────────────
    if (node.type === 'TEXT') {
        const t = node;
        if (typeof t.fontSize === 'number') {
            styles.fontSize = t.fontSize;
            hasAny = true;
        }
        if (t.fontName && typeof t.fontName !== 'symbol' && t.fontName.style) {
            styles.fontStyle = t.fontName.style; // e.g. "Bold", "Medium", "Regular"
            hasAny = true;
        }
        if (t.letterSpacing !== figma.mixed && typeof t.letterSpacing === 'object') {
            styles.letterSpacing = t.letterSpacing.value;
            hasAny = true;
        }
        if (t.lineHeight !== figma.mixed && typeof t.lineHeight === 'object' && t.lineHeight.unit !== 'AUTO') {
            styles.lineHeight = t.lineHeight.value;
            hasAny = true;
        }
        // Text fill color
        if (Array.isArray(t.fills)) {
            const solid = t.fills.find((f) => f.type === 'SOLID' && f.visible !== false);
            if (solid) {
                styles.textColor = rgbToHex(solid.color.r, solid.color.g, solid.color.b);
                hasAny = true;
            }
        }
    }
    return hasAny ? styles : null;
}
function extractComponentTree(node) {
    var _a;
    const childrenPayload = [];
    if ('children' in node) {
        for (const child of node.children) {
            // If it's an instance of a Component, capture it
            if (child.type === 'INSTANCE') {
                const mainComponent = child.mainComponent;
                if (mainComponent) {
                    // Try to guess props based on Figma Component Properties
                    const props = {};
                    if (child.componentProperties) {
                        for (const [key, prop] of Object.entries(child.componentProperties)) {
                            // Clean up Figma's weird "Variant#Name" structure
                            const cleanKey = key.split('#')[0];
                            props[cleanKey] = String(prop.value);
                        }
                    }
                    // Fallback for getting text content if it's a simple text component
                    if (Object.keys(props).length === 0 && 'characters' in child) {
                        props['content'] = child.characters;
                    }
                    // Recursively get children if this instance wraps other things
                    const nestedChildren = extractComponentTree(child);
                    // Extract visual styles from the instance node
                    const styles = extractStyles(child);
                    childrenPayload.push(Object.assign(Object.assign({ figmaComponent: ((_a = mainComponent.parent) === null || _a === void 0 ? void 0 : _a.name) === 'Button' ? 'Button' : mainComponent.name, props }, (styles ? { styles } : {})), (nestedChildren.length > 0 ? { children: nestedChildren } : {})));
                }
            }
            else if (child.type === 'TEXT') {
                // Raw Text node — include typography styles
                const styles = extractStyles(child);
                childrenPayload.push(Object.assign({ figmaComponent: "_TextNode", props: { content: child.characters } }, (styles ? { styles } : {})));
            }
            else {
                // Frame/Group: extract layout styles and wrap children
                const styles = extractStyles(child);
                const nested = extractComponentTree(child);
                if (nested.length > 0 || styles) {
                    childrenPayload.push(Object.assign(Object.assign({ figmaComponent: "_Frame", props: {} }, (styles ? { styles } : {})), (nested.length > 0 ? { children: nested } : {})));
                }
            }
        }
    }
    return childrenPayload;
}
