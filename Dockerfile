# ── Flint Glass Web ──────────────────────────────────────────────────────────
# Multi-stage build: compile everything in a heavy image,
# ship only the runtime in a slim one.
#
# Usage:
#   docker build -t flint-glass .
#   docker run -p 4201:4201 flint-glass
#   docker run -p 4201:4201 -v ~/my-project:/project flint-glass --project /project
#
# The --demo flag is the default — opens a built-in demo project.

# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:22-bookworm AS builder

WORKDIR /app

# Install native module build deps (better-sqlite3, sqlite-vec)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Install root deps
COPY package.json package-lock.json ./
RUN npm ci

# Install MCP engine deps
COPY flint-mcp/package.json flint-mcp/package-lock.json* ./flint-mcp/
RUN cd flint-mcp && npm ci

# Copy source
COPY tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.web.ts ./
COPY src/ ./src/
COPY shared/ ./shared/
COPY server/ ./server/
COPY electron/ ./electron/
COPY flint-mcp/src/ ./flint-mcp/src/
COPY flint-mcp/tsconfig.json* ./flint-mcp/

# Copy demo project and build resources
COPY build-resources/ ./build-resources/

# Build web frontend
RUN npx vite build --config vite.config.web.ts --mode production

# ── Stage 2: Runtime ────────────────────────────────────────────────────────
FROM node:22-bookworm-slim

WORKDIR /app

# Only runtime deps needed — no compiler toolchain
RUN apt-get update && apt-get install -y --no-install-recommends libsqlite3-0 && rm -rf /var/lib/apt/lists/*

# Copy package manifests and install production deps only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY flint-mcp/package.json flint-mcp/package-lock.json* ./flint-mcp/
RUN cd flint-mcp && npm ci --omit=dev

# Copy built frontend
COPY --from=builder /app/dist-web ./dist-web

# Copy server source (runs via tsx at runtime)
COPY server/ ./server/
COPY shared/ ./shared/

# Copy MCP engine source
COPY flint-mcp/src/ ./flint-mcp/src/
COPY flint-mcp/tsconfig.json* ./flint-mcp/

# Copy demo project
COPY build-resources/demo-project ./build-resources/demo-project

# Copy config defaults
COPY .flint/policy.json* ./.flint/

# Expose server port
EXPOSE 4201

# Default: run with demo project, suppress browser open (headless container)
ENTRYPOINT ["npx", "tsx", "server/cli.ts", "--no-open", "--port", "4201"]
CMD ["--demo"]
