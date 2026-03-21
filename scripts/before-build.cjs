/**
 * before-build.js — Runs the Vite frontend + Electron main process build
 * before electron-builder packages the app.
 *
 * electron-builder calls this via the `beforeBuild` hook in electron-builder.yml.
 */

const { execSync } = require('child_process')

exports.default = async function beforeBuild(context) {
    console.log('[Flint Build] Running Vite build...')
    execSync('npm run build', {
        stdio: 'inherit',
        cwd: context.appDir,
        env: {
            ...process.env,
            NODE_ENV: 'production',
        },
    })
    console.log('[Flint Build] Vite build complete.')
}
