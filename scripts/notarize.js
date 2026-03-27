/**
 * notarize.js — macOS notarization hook for electron-builder.
 *
 * Called automatically by electron-builder via the `afterSign` hook
 * when building on macOS with `hardenedRuntime: true`.
 *
 * Requires the following environment variables:
 *   APPLE_ID                    — Apple ID email used for notarization
 *   APPLE_APP_SPECIFIC_PASSWORD — App-specific password from appleid.apple.com
 *   APPLE_TEAM_ID               — 10-character Apple Developer Team ID
 *
 * When any of these variables are absent, notarization is skipped silently.
 * This allows unsigned local builds to proceed without errors.
 *
 * Setup:
 *   1. Enroll in the Apple Developer Program ($99/year).
 *   2. Generate an app-specific password at appleid.apple.com.
 *   3. Set the three env vars in GitHub Secrets for CI builds.
 *   4. For local signed builds, export them in your shell before running
 *      `npm run build:mac`.
 */

'use strict'

const { notarize } = require('@electron/notarize')

/**
 * @param {import('electron-builder').AfterPackContext} context
 */
exports.default = async function notarizeApp(context) {
  const { electronPlatformName, appOutDir } = context

  // Only notarize macOS builds
  if (electronPlatformName !== 'darwin') return

  const appleId = process.env.APPLE_ID
  const appleIdPassword = process.env.APPLE_APP_SPECIFIC_PASSWORD
  const teamId = process.env.APPLE_TEAM_ID

  if (!appleId || !appleIdPassword || !teamId) {
    console.log('[notarize] Skipping — APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD / APPLE_TEAM_ID not set.')
    return
  }

  const appName = context.packager.appInfo.productFilename
  const appPath = `${appOutDir}/${appName}.app`

  console.log(`[notarize] Notarizing ${appPath} with Apple ID ${appleId}...`)

  await notarize({
    appPath,
    appleId,
    appleIdPassword,
    teamId,
  })

  console.log('[notarize] Notarization complete.')
}
