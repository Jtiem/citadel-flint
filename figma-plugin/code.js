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
                    childrenPayload.push(Object.assign({ figmaComponent: ((_a = mainComponent.parent) === null || _a === void 0 ? void 0 : _a.name) === 'Button' ? 'Button' : mainComponent.name, // Simplified matching
                        props }, (nestedChildren.length > 0 ? { children: nestedChildren } : {})));
                }
            }
            else if (child.type === 'TEXT') {
                // Raw Text node
                childrenPayload.push({
                    figmaComponent: "_TextNode",
                    props: { content: child.characters }
                });
            }
            else {
                // If it's a normal frame/group, just pass through and look for instances inside
                const nested = extractComponentTree(child);
                if (nested.length > 0) {
                    childrenPayload.push(...nested);
                }
            }
        }
    }
    return childrenPayload;
}
