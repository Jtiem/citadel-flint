# Flint Beta — Install Guide

**Version:** Closed Beta &nbsp;|&nbsp; **Expires:** 60 days from install &nbsp;|&nbsp; **Support:** [justin.tiemann@gmail.com](mailto:justin.tiemann@gmail.com)

---

## System requirements

| Requirement | Detail |
| --- | --- |
| **macOS** | macOS 14 Sonoma or later |
| **Windows** | Windows 10 or later |
| **Disk space** | ~200 MB |

---

## Download

**[Download Flint Beta]([BETA_DOWNLOAD_URL])**

macOS: `.dmg` &nbsp;|&nbsp; Windows: `.exe`

---

## Install on macOS

1. Open the `.dmg` and drag **Flint** to your **Applications** folder.
2. Open **Terminal** (Applications > Utilities > Terminal) and run:

   ```bash
   xattr -cr /Applications/Flint.app
   ```

   This clears the quarantine flag macOS sets on apps without an Apple notarization certificate. It is safe to run — you only need to do it once.

3. In Finder, **right-click** Flint in Applications and choose **Open**.
4. In the security dialog, click **Open**.

After this, Flint launches normally by double-clicking it.

---

## Install on Windows

1. Double-click the `.exe` installer.
2. When Windows SmartScreen appears, click **More info**, then **Run anyway**.
3. Follow the installer prompts. Flint will open when it finishes.

---

## First launch

Flint will show a consent dialog asking whether it can send anonymous usage events — tool names, audit counts, and crash reports. No file contents or design data are ever included. Accept or decline; either is fine, and you can change it later in Settings.

After that, you land on the launch screen. Choose **Open Demo Project** to start with something ready to explore right away.

---

## Send feedback

Click the **Send Feedback** button in the StatusBar at the bottom of the app. It opens a short form and attaches your app version, OS, and recent activity automatically (no file contents).

If the button is not working, it will copy the report to your clipboard — email it to [justin.tiemann@gmail.com](mailto:justin.tiemann@gmail.com) with the subject "Flint Beta Feedback." For a crash on launch or anything urgent, email directly and include "urgent" in the subject line.

---

## Build expiry

This build stops working 60 days after you install it. The StatusBar turns amber when less than a week remains. When it expires, the app shows a dialog and stops launching — email [justin.tiemann@gmail.com](mailto:justin.tiemann@gmail.com) and a fresh build will follow.

---

## Uninstall

**macOS:** Drag Flint to Trash. To clear app data: `rm -rf ~/Library/Application\ Support/Flint`

**Windows:** Settings > Apps > Flint > Uninstall. To clear app data: delete `%APPDATA%\Flint`

---

*Something broken? [justin.tiemann@gmail.com](mailto:justin.tiemann@gmail.com)*
