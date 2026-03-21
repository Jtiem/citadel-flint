# Third-Party Licenses

Flint (v7.2) bundles and depends on open-source software. This file documents the licenses
of those dependencies as required for compliance. Flint itself is proprietary software
(see LICENSE at the project root).

---

## License Summary

| License | Package count | Obligations |
|---------|--------------|-------------|
| MIT / ISC / BSD | ~800 packages | None beyond attribution in source |
| Apache-2.0 | ~44 packages | Preserve NOTICE files on redistribution |
| MPL-2.0 | 2 packages | Modified MPL-licensed files must be shared; no effect on surrounding code |
| LGPL-3.0-or-later | 1 package (`@img/sharp-libvips-darwin-arm64`) | Dynamic linking; library is replaceable |

---

## 1. LGPL-3.0-or-later: libvips (via sharp)

### Package

| Field | Value |
|-------|-------|
| npm package | `@img/sharp-libvips-darwin-arm64` |
| Version | 1.2.4 |
| Upstream library | libvips 8.17.3 |
| License | LGPL-3.0-or-later |
| Repository | https://github.com/lovell/sharp-libvips |
| Funding | https://opencollective.com/libvips |

### How Flint uses it

Flint bundles `sharp` (Apache-2.0) as a transitive dependency pulled in by
`@huggingface/transformers`. `sharp` dynamically loads the prebuilt `libvips-cpp` shared
library at runtime. The library is **not statically linked** into Flint's own code.

### LGPL compliance statement

The GNU Lesser General Public License v3 (LGPL-3.0) permits use of LGPL-covered libraries
in proprietary applications provided the library is linked dynamically so that end users
can replace it with a modified version. Flint satisfies this requirement:

- The `libvips-cpp.*.dylib` file ships outside the application ASAR archive via
  `electron-builder`'s `asarUnpack` directive. This means the `.node` native addon and the
  `libvips` shared library are placed in an unpacked directory alongside the ASAR, keeping
  them accessible as ordinary filesystem objects.
- Users can therefore substitute a compatible version of libvips simply by replacing
  the `.dylib` file in the unpacked directory.
- Flint makes no modifications to libvips source code.

The full text of LGPL-3.0 is available at:
https://www.gnu.org/licenses/lgpl-3.0.html

### Bundled libvips dependencies (selected)

The prebuilt libvips binary bundles additional open-source libraries, each under their own
permissive or GPL-compatible license. The complete version manifest is at
`node_modules/@img/sharp-libvips-darwin-arm64/versions.json`. Notable inclusions:

| Library | Version | License |
|---------|---------|---------|
| vips | 8.17.3 | LGPL-2.1+ |
| glib | 2.86.1 | LGPL-2.1+ |
| cairo | 1.18.4 | LGPL-2.1 / MPL-1.1 |
| pango | 1.57.0 | LGPL-2.1+ |
| libxml2 | 2.15.1 | MIT |
| libpng | 1.6.50 | PNG Reference Library License |
| libtiff | 4.7.1 | BSD-like |
| libwebp | 1.6.0 | BSD-3-Clause |
| libjpeg (mozjpeg) | 0826579 | BSD/zlib |
| libheif | 1.20.2 | LGPL-3.0+ |
| FreeType | 2.14.1 | FTL (BSD-like) / GPL-2.0 |
| HarfBuzz | 12.1.0 | MIT |
| lcms2 | 2.17 | MIT |
| libaom | 3.13.1 | BSD-2-Clause |

---

## 2. MPL-2.0: lightningcss

### Packages

| npm package | Version | Repository |
|-------------|---------|-----------|
| `lightningcss` | 1.31.1 | https://github.com/parcel-bundler/lightningcss |
| `lightningcss-darwin-arm64` | 1.31.1 | https://github.com/parcel-bundler/lightningcss |

`lightningcss-darwin-arm64` is the platform-specific native binary companion to
`lightningcss`; they are a single logical package.

### How Flint uses it

`lightningcss` is a transitive dependency introduced by `tailwindcss` v4. Flint does not
import `lightningcss` directly. Tailwind uses it internally as its CSS parsing and
transformation engine.

### MPL-2.0 compliance statement

The Mozilla Public License 2.0 is a file-level copyleft license. Its obligations are:

- If you **modify** any `.rs` (Rust) or other source files from the `lightningcss` package,
  those modified files must be made available under MPL-2.0.
- Code in other files and packages — including Flint's own TypeScript source — is **not
  affected** by this requirement.
- Flint does not modify `lightningcss` source files. The package is used unmodified as
  installed from npm.

The full text of MPL-2.0 is available at:
https://www.mozilla.org/en-US/MPL/2.0/

---

## 3. Apache-2.0: Notable packages

The following key dependencies are licensed under Apache-2.0. Apache-2.0 requires
preservation of any `NOTICE` files when redistributing. Flint does not modify these
packages.

| Package | Version | Author / Project |
|---------|---------|-----------------|
| `typescript` | 5.9.3 | Microsoft |
| `@google/genai` | 1.44.0 | Google LLC |
| `openai` | 6.25.0 | OpenAI |
| `@huggingface/transformers` | 3.8.1 | Hugging Face |
| `@codesandbox/sandpack-react` | 2.20.0 | CodeSandbox |
| `@powersync/node` | 0.18.0 | Journey Mobile / PowerSync |
| `@powersync/common` | (same) | Journey Mobile / PowerSync |
| `sharp` | 0.34.5 | Lovell Fuller |

The complete set of Apache-2.0 packages (~44 total, including transitive dependencies) and
their individual NOTICE files can be found in the respective subdirectories of
`node_modules/`.

The full text of Apache-2.0 is available at:
https://www.apache.org/licenses/LICENSE-2.0

---

## 4. MIT / ISC / BSD: Permissive packages (~800 packages)

The vast majority of Flint's dependencies — including React, Vite, Electron, Babel,
Zustand, better-sqlite3, lucide-react, and the @babel/* suite — are released under
MIT, ISC, or BSD-family licenses. These licenses place no restrictions on use, modification,
or distribution beyond including the original copyright notice.

Selected direct dependencies:

| Package | License | Author |
|---------|---------|-------|
| `react` / `react-dom` | MIT | Meta |
| `electron` | MIT | OpenJS Foundation / GitHub |
| `vite` | MIT | Evan You |
| `@anthropic-ai/sdk` | MIT | Anthropic |
| `@xyflow/react` | MIT | xyflow |
| `@vue/compiler-sfc` | MIT | Evan You |
| `better-sqlite3` | MIT | Joshua Wise |
| `sqlite-vec` | MIT | Alex Garcia |
| `zustand` | MIT | pmndrs |
| `tailwindcss` | MIT | Tailwind Labs |
| `@babel/parser` / `@babel/traverse` / `@babel/types` | MIT | Babel contributors |
| `lucide-react` | ISC | Lucide contributors |
| `highlight.js` | BSD-3-Clause | Ivan Sagalaev |
| `dompurify` | Apache-2.0 OR MPL-2.0 | Cure53 (Apache-2.0 grant applies) |

Individual license texts for all packages are available inside their respective
`node_modules/<package>/LICENSE` (or `LICENCE`, `LICENSE.md`) files.

---

## 5. Contact

For licensing questions about Flint itself, contact:
Justin Tiemann — justin.tiemann@gmail.com

For questions about a specific third-party dependency, refer to that package's upstream
repository (linked in the sections above or in the package's own `package.json`).
