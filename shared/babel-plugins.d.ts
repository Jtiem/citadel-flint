// Ambient declarations for the two Babel plugins we import directly.
// @types/babel__plugin-transform-{typescript,react-jsx} do not exist on npm,
// so we declare the minimal shape here. The plugins are passed to
// transformSync() as the first element of a [plugin, options] tuple — Babel
// only needs them to be functions for its plugin-runner contract.
//
// Why direct imports? See the comment at the top of electron/main.ts —
// Babel's string-name plugin resolver does not reliably cross asar
// boundaries in packaged Electron apps.
declare module '@babel/plugin-transform-typescript' {
    import type { PluginObj } from '@babel/core'
    const plugin: (...args: unknown[]) => PluginObj
    export default plugin
}

declare module '@babel/plugin-transform-react-jsx' {
    import type { PluginObj } from '@babel/core'
    const plugin: (...args: unknown[]) => PluginObj
    export default plugin
}
