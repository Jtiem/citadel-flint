# Architectural Forensic Record — Phase Q: Asset Management Hub

This document serves as the high-fidelity architectural baseline for Phase Q, incorporating the full design philosophy, technical specifications, and forensic UX breakdown for Bridge Glass.

---

## 🏛️ Six Core UX Principles

### 1. Relentless Contextual Prioritization (Signal-to-Noise Management)
The interface operates on the assumption that showing a user a tool they don't currently need is a UX failure.
- **Manifestation**: The Right Pane rewires itself based on selection (text vs. vector). The Asset Panel hides external libraries until explicitly needed.
- **The "Why"**: Artificially lowers perceived complexity, preventing cognitive paralysis.

### 2. The Direct / Indirect Manipulation Symbiosis
Bridges tactility with precision.
- **Manifestation**: Physical dragging on the Canvas (direct) simultaneously updates pixel values in the Inspector (indirect).
- **The "Why"**: Caters to both spatial exploration and mathematical precision.

### 3. Visual Abstraction of Complex Code (The "No-Code" Bridge)
Generates compiler-ready data through visual metaphors.
- **Manifestation**: Flexbox math abstracted into a 3x3 Grid; state logic into "Add Variant" buttons.
- **The "Why"**: Allows visual thinkers to architect deep engineering systems.

### 4. Progressive Disclosure & Cognitive Pacing
Scales complexity only upon user demand.
- **Manifestation**: Messy ideation -> `Shift + A` (Auto Layout) -> "Create Component" (Variant logic).
- **The "Why"**: Guides users along a "paved path" from ideation to rigorous system architecture.

### 5. The "Author vs. Consumer" Dichotomy
- **Manifestation**: Architects see raw "wiring" (layers, bindings); Consumers see foolproof "forms" (dropdowns, text overrides).
- **The "Why"**: Democratizes the design system.

### 6. Anticipatory Feedback & State Certainty
- **Manifestation**: Scrubbing at 60fps; translucent "ghost" cursors; blue drop-zone highlights.
- **The "Why"**: Builds trust; previews consequences before action commitment.

---

## 🗺️ Spatial Strategy & Component Typology

### 1. The Three-Pane Architecture
- **Left Pane (Macro)**: Pages and Layers tree (The Structural Map).
- **Central Canvas (Direct)**: The infinite visual workspace.
- **Right Pane (Micro)**: Properties Inspector (The Atomic Details).

### 2. Input Control Typology
- **Scrubbable Number Fields**: Text inputs that function as hidden sliders for exploratory tuning.
- **Segmented Icon Controls**: For mutually exclusive choices (e.g., Alignment).
- **Dropdown Menus**: Reserved for high-optionality lists (Fonts) to save space.
- **Toggles / Switches**: Immediate, tactile binary state changes.

---

## 📦 Asset Panel Forensic Breakdown

### 1. Search vs. Browse (Targeted vs. Exploratory)
- **Omni-Search**: Sticky, auto-focused search for power users.
- **Accordion Tree**: Collapsible nested list for categorical exploration.

### 2. Information Display
- **Grid vs. List Toggles**: Balancing visual recognition (Icons) with semantic density (Input states).
- **Thumbnail Canvas Renderer**: Miniaturized, live-rendered components ensuring 100% fidelity.

### 3. Instantiation (Drag-and-Drop Physics)
- **Ghost Cursor**: Translucent 1:1 scale preview replacing the mouse.
- **Drop Signaling**: Blue insertion lines/border highlights for valid containers.

---

## ⚙️ Technical Specification (Phase Q Implementation)

### 1. IPC Schema & Data Flow
To ensure zero-latency UI, the data flow is split into metadata (fast) and binary (lazy).
- `bridge:get-assets-metadata`: Returns an array of `{ id, name, tags, type, previewThumb }`.
- `bridge:get-asset-binary(id)`: Asynchronous request for the full base64/buffer of the asset.
- **Streaming**: Assets > 2MB are streamed via the Electron `net` module to avoid UI jank.

### 2. State Management (`assetStore.ts`)
A dedicated Zustand store managing:
- `assets`: Reactive list of metadata for the Hub.
- `usageMap`: Cached mapping from Asset ID to TSX file paths (populated by the Auditor).
- `isSearching`: Boolean flag to trigger transition animations.

### 3. The Asset Usage Auditor (AST Scanning)
A background process (running in the main thread during idle time) that:
- Uses `Babel/Parser` to scan the project for `data-bridge-id` or image source references.
- **Zombie Management**: Flags assets in the SQLite `assets_cache` that have zero AST references for potential pruning.

---

## ✅ Tactical Verification & Success Metrics

### 1. Performance Targets
- **Search Filtering**: <30ms for 1,000+ items.
- **Drag Start**: <10ms from click to "Ghost" instantiation.
- **Memory**: Resident set size (RSS) should not grow more than 50MB during active browsing.

### 2. Automated Validation
- **AST Integrity**: Verify that deleting a component code-side triggers an audit flag.
- **IPC Stability**: Stress test `bridge:get-asset-binary` with 20 parallel requests.

---

## 🚀 Future Extensibility (The Roadmap)
- **Multi-Library Support**: Future-proof `Library Opt-In` modal to allow connecting to external Figma Team libraries.
- **Motion Support**: Placeholder for Lottie and SVG animation playback within the hub previews.
