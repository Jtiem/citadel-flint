/**
 * Bridge Link — code.js  (Figma plugin main thread, compiled output)
 *
 * This is the pre-compiled version of code.ts. Figma loads this file directly
 * (see "main" in manifest.json). Edit code.ts and run `npm run build` to
 * regenerate this file after any changes.
 */

figma.showUI(__html__, { width: 320, height: 200, title: 'Bridge Link' });

figma.ui.onmessage = (msg) => {
    if (msg.type !== 'sync') return;

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
    } catch (err) {
        figma.ui.postMessage({ type: 'error', message: String(err) });
    }
};
