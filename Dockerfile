# =============================================================================
# Dockerfile - Workflow Automation System
# Target: Red Hat Enterprise Linux 8 (simulated via UBI 8)
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: Builder — install deps, compile TypeScript, build frontend
# ---------------------------------------------------------------------------
FROM registry.access.redhat.com/ubi8/nodejs-18:latest AS builder

USER root

# Install build tools for native modules (better-sqlite3 v11+ needs C++20)
# gcc-toolset-12 provides GCC 12.x with C++20 support on RHEL/UBI 8
RUN dnf install -y gcc-toolset-12-gcc-c++ make python3 && \
    dnf clean all

WORKDIR /app

# --- Root ---
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# --- Backend ---
COPY backend/package.json backend/package-lock.json ./backend/
# Enable gcc-toolset-12 so node-gyp uses GCC 12 (C++20 support)
RUN scl enable gcc-toolset-12 -- bash -c 'cd backend && npm ci'

# --- Frontend ---
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN cd frontend && npm ci

# Copy source code
COPY backend/ ./backend/
COPY frontend/ ./frontend/
COPY scripts/ ./scripts/

# Build backend (TypeScript → JavaScript)
RUN cd backend && npx tsc

# Build frontend (Vite production build)
RUN cd frontend && npm run build

# Copy frontend build output into backend/public for static serving
RUN mkdir -p backend/public && \
    cp -r frontend/dist/* backend/public/

# ---------------------------------------------------------------------------
# Stage 2: Production — minimal runtime image
# ---------------------------------------------------------------------------
FROM registry.access.redhat.com/ubi8/nodejs-18:latest AS production

USER root

# Install Python 3 for Python script nodes & curl for health checks
RUN dnf install -y python3 procps-ng && \
    dnf clean all && \
    ln -sf /usr/bin/python3 /usr/bin/python

WORKDIR /app

# Copy built backend (including compiled JS and frontend static files)
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/public ./backend/public
COPY --from=builder /app/backend/node_modules ./backend/node_modules
COPY --from=builder /app/backend/package.json ./backend/package.json

# Copy test scripts
COPY --from=builder /app/scripts ./scripts

# Create data directory for SQLite
RUN mkdir -p /var/data && chown -R 1001:0 /var/data && \
    chmod -R g=u /var/data

# Create logs directory
RUN mkdir -p /app/logs && chown -R 1001:0 /app/logs && \
    chmod -R g=u /app/logs

# Environment
ENV NODE_ENV=production \
    PORT=3001 \
    DB_PATH=/var/data/workflow.db \
    PYTHON_CMD=python3

EXPOSE 3001

# Switch to non-root user
USER 1001

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "const http=require('http');const r=http.get('http://localhost:3001/api/health',res=>{process.exit(res.statusCode===200?0:1)});r.on('error',()=>process.exit(1));"

# Start the application
CMD ["node", "backend/dist/index.js"]
