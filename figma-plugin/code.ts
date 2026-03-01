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

figma.showUI(__html__, { width: 320, height: 200, title: 'Bridge Link' })

figma.ui.onmessage = (msg: { type: string }) => {
    if (msg.type !== 'sync') return

    try {
        const collections = figma.variables.getLocalVariableCollections()
        const allVariables = figma.variables.getLocalVariables()

        // Build ID-keyed maps — the shape that normalizeFigmaVariables expects.
        const variablesMap: Record<string, object> = {}
        for (const v of allVariables) {
            variablesMap[v.id] = {
                id: v.id,
                name: v.name,
                resolvedType: v.resolvedType,
                valuesByMode: v.valuesByMode,
                description: v.description,
                variableCollectionId: v.variableCollectionId,
            }
        }

        const collectionsMap: Record<string, object> = {}
        for (const c of collections) {
            collectionsMap[c.id] = {
                id: c.id,
                name: c.name,
                defaultModeId: c.defaultModeId,
                variableIds: c.variableIds,
                modes: c.modes,
            }
        }

        figma.ui.postMessage({
            type: 'payload',
            data: { variables: variablesMap, variableCollections: collectionsMap },
        })
    } catch (err) {
        figma.ui.postMessage({ type: 'error', message: String(err) })
    }
}
