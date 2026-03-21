#!/usr/bin/env node
/**
 * Flint VS Code Extension — Icon Generator
 *
 * Generates images/icon.png (128×128 RGBA PNG) with zero npm dependencies.
 * Uses only Node.js built-ins: zlib, fs, path.
 *
 * Design: dark navy rounded-square background with a suspension-flint
 * silhouette in indigo. Reads cleanly at 16×16 (sidebar) and 128×128
 * (marketplace / extension panel).
 *
 * Usage:
 *   node scripts/generate-icon.js
 */

'use strict';

const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

// ─── Canvas ────────────────────────────────────────────────────────────────

const SIZE = 128;
const pix  = Buffer.alloc(SIZE * SIZE * 4, 0); // RGBA, transparent

const C = {
  bg:     [13,  13,  22,  255], // #0D0D16 — deep navy
  tower:  [67,  56,  202, 255], // #4338ca — indigo-700
  deck:   [79,  70,  229, 255], // #4f46e5 — indigo-600
  cable:  [129, 140, 248, 255], // #818cf8 — indigo-400
  hanger: [165, 180, 252, 255], // #a5b4fc — indigo-300
};

function setPixel(x, y, [r, g, b, a]) {
  if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return;
  const i = (y * SIZE + x) * 4;
  pix[i] = r; pix[i + 1] = g; pix[i + 2] = b; pix[i + 3] = a;
}

/** Blend a color over the existing pixel with a given 0-255 alpha weight. */
function blendPixel(x, y, [r, g, b, a], alpha) {
  if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return;
  const i = (y * SIZE + x) * 4;
  const t = (alpha / 255) * (a / 255);
  pix[i]     = Math.round(pix[i]     * (1 - t) + r * t);
  pix[i + 1] = Math.round(pix[i + 1] * (1 - t) + g * t);
  pix[i + 2] = Math.round(pix[i + 2] * (1 - t) + b * t);
  pix[i + 3] = Math.min(255, pix[i + 3] + Math.round(255 * t));
}

function fillRect(x, y, w, h, color) {
  for (let dy = 0; dy < h; dy++)
    for (let dx = 0; dx < w; dx++)
      setPixel(x + dx, y + dy, color);
}

// ─── Shapes ────────────────────────────────────────────────────────────────

/**
 * Signed-distance-field rounded-rect fill with 1 px anti-aliased edge.
 * Pixels outside the shape stay fully transparent.
 */
function drawRoundedRect(radius, color) {
  const half = SIZE / 2;
  const inner = half - radius;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = Math.max(0, Math.abs(x - half + 0.5) - inner);
      const dy = Math.max(0, Math.abs(y - half + 0.5) - inner);
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < radius) {
        const alpha = dist > radius - 1 ? Math.round((radius - dist) * 255) : 255;
        blendPixel(x, y, color, alpha);
      }
    }
  }
}

/**
 * Draw a parabolic arc (suspension cable) with given thickness.
 * Arc passes through (x1,y1), peak (xp,yp), (x2,y2).
 */
function drawArc(x1, y1, xp, yp, x2, y2, color, thickness) {
  const a = (y1 - yp) / ((x1 - xp) ** 2);
  for (let x = x1; x <= x2; x++) {
    const y = a * (x - xp) ** 2 + yp;
    for (let t = -thickness; t <= thickness + 1; t++) {
      const alpha = t === -thickness || t === thickness + 1
        ? 140 // soft edges
        : 255;
      blendPixel(x, Math.round(y) + t, color, alpha);
    }
  }
}

/** Draw a vertical line segment. */
function drawVLine(x, y1, y2, color, alpha = 255) {
  for (let y = y1; y <= y2; y++) blendPixel(x, y, color, alpha);
}

// ─── Icon Design ───────────────────────────────────────────────────────────
//
//  Layout (128×128):
//
//    ┌─────────────────────────────────────────┐
//    │                  ╭─╮                    │  ← cable peak  y=14
//    │                ╭─╯ ╰─╮                  │
//    │              ╭─╯     ╰─╮                │
//    │  ┌──┐ ───────╯         ╰─────── ┌──┐   │  ← tower tops  y=44
//    │  │  │|   hangers              |  │  │   │
//    │  │  │|                        |  │  │   │  towers y=44-104
//    │  │  │|                        |  │  │   │
//    │██████████████████████████████████████│  │  ← deck        y=98-106
//    └─────────────────────────────────────────┘

// Tower geometry
const LX = 24, RX = 98;   // tower left-edge x
const TW = 9;              // tower width
const TY_TOP = 40, TY_BOT = 97; // tower y range

// Cable anchor points (mid of each tower top)
const CL = LX + Math.floor(TW / 2);  // 28
const CR = RX + Math.floor(TW / 2);  // 102
const CABLE_Y   = TY_TOP + 2;        // meets tower top: 42
const CABLE_PY  = 13;                // cable peak y

// Deck
const DK_Y = 98, DK_H = 8;
const DK_X = 12, DK_W = 104;

// Hanger x-positions (between towers)
const HANGERS = [38, 47, 55, 64, 73, 81, 90];

// 1. Background
drawRoundedRect(24, C.bg);

// 2. Flint towers
fillRect(LX,  TY_TOP, TW, TY_BOT - TY_TOP, C.tower);
fillRect(RX,  TY_TOP, TW, TY_BOT - TY_TOP, C.tower);

// Tower top caps (slightly wider)
fillRect(LX - 2, TY_TOP - 6, TW + 4, 7, C.tower);
fillRect(RX - 2, TY_TOP - 6, TW + 4, 7, C.tower);

// 3. Deck
fillRect(DK_X, DK_Y, DK_W, DK_H, C.deck);

// 4. Vertical hangers (drawn before cable so cable overlaps)
for (const hx of HANGERS) {
  const a     = (CABLE_Y - CABLE_PY) / ((CL - 64) ** 2);
  const topY  = Math.round(a * (hx - 64) ** 2 + CABLE_PY);
  drawVLine(hx, topY, DK_Y - 1, C.hanger, 180);
  drawVLine(hx + 1, topY, DK_Y - 1, C.hanger, 60); // soft shadow
}

// 5. Main suspension cable (top arc)
drawArc(CL, CABLE_Y, 64, CABLE_PY, CR, CABLE_Y, C.cable, 1);

// 6. Subtle highlight shimmer on deck top edge
fillRect(DK_X + 2, DK_Y, DK_W - 4, 1, C.cable);

// ─── PNG Encoder ───────────────────────────────────────────────────────────

// CRC-32 table
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
  crcTable[i] = c;
}
function crc32(data) {
  let c = 0xFFFFFFFF;
  for (const b of data) c = (c >>> 8) ^ crcTable[(c ^ b) & 0xFF];
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf  = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf   = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

// IHDR
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8]  = 8; // bit depth
ihdr[9]  = 6; // RGBA
ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

// Raw scanlines: filter byte 0 (None) + 4 bytes per pixel
const raw = Buffer.alloc(SIZE * (1 + SIZE * 4));
for (let y = 0; y < SIZE; y++) {
  raw[y * (1 + SIZE * 4)] = 0;
  pix.copy(raw, y * (1 + SIZE * 4) + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
}
const idat = zlib.deflateSync(raw, { level: 9 });

// Assemble
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // signature
  pngChunk('IHDR', ihdr),
  pngChunk('IDAT', idat),
  pngChunk('IEND', Buffer.alloc(0)),
]);

// Write
const outDir  = path.join(__dirname, '..', 'images');
const outFile = path.join(outDir, 'icon.png');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, png);
console.log(`✓ ${outFile} — ${png.length} bytes`);
