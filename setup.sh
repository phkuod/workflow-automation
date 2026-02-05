#!/bin/bash
#
# setup.sh - Initialize the Workflow Automation project on a new environment
#
# Usage:
#   ./setup.sh
#
# This script will:
#   1. Check prerequisites (Node.js, Python)
#   2. Install all npm dependencies (root, backend, frontend)
#   3. Set up environment files
#   4. Initialize the database
#

set -e  # Exit on any error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}   Workflow Automation System - Environment Setup${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

# ─────────────────────────────────────────────────────────────
# Step 1: Check Prerequisites
# ─────────────────────────────────────────────────────────────
echo -e "${YELLOW}📋 Checking prerequisites...${NC}"

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo -e "   ${GREEN}✓${NC} Node.js: $NODE_VERSION"
else
    echo -e "   ${RED}✗ Node.js is not installed!${NC}"
    echo "     Please install Node.js 18+ from: https://nodejs.org/"
    exit 1
fi

# Check npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    echo -e "   ${GREEN}✓${NC} npm: $NPM_VERSION"
else
    echo -e "   ${RED}✗ npm is not installed!${NC}"
    exit 1
fi

# Check Python (optional but recommended)
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version)
    echo -e "   ${GREEN}✓${NC} $PYTHON_VERSION"
elif command -v python &> /dev/null; then
    PYTHON_VERSION=$(python --version)
    echo -e "   ${GREEN}✓${NC} $PYTHON_VERSION"
else
    echo -e "   ${YELLOW}⚠${NC} Python not found (optional, needed for Python script nodes)"
fi

echo ""

# ─────────────────────────────────────────────────────────────
# Step 2: Install Dependencies
# ─────────────────────────────────────────────────────────────
echo -e "${YELLOW}📦 Installing dependencies...${NC}"

# Root dependencies (if any)
if [[ -f "${SCRIPT_DIR}/package.json" ]]; then
    echo -e "   Installing root dependencies..."
    cd "${SCRIPT_DIR}"
    npm install
fi

# Backend dependencies
echo -e "   Installing backend dependencies..."
cd "${SCRIPT_DIR}/backend"
npm install

# Frontend dependencies
echo -e "   Installing frontend dependencies..."
cd "${SCRIPT_DIR}/frontend"
npm install

echo -e "   ${GREEN}✓${NC} All dependencies installed!"
echo ""

# ─────────────────────────────────────────────────────────────
# Step 3: Setup Environment Files
# ─────────────────────────────────────────────────────────────
echo -e "${YELLOW}⚙️  Setting up environment files...${NC}"

# Copy .env.development to backend and frontend if .env doesn't exist
if [[ -f "${SCRIPT_DIR}/.env.development" ]]; then
    if [[ ! -f "${SCRIPT_DIR}/backend/.env" ]]; then
        cp "${SCRIPT_DIR}/.env.development" "${SCRIPT_DIR}/backend/.env"
        echo -e "   ${GREEN}✓${NC} Created backend/.env"
    else
        echo -e "   ${YELLOW}⚠${NC} backend/.env already exists (skipped)"
    fi
    
    if [[ ! -f "${SCRIPT_DIR}/frontend/.env" ]]; then
        cp "${SCRIPT_DIR}/.env.development" "${SCRIPT_DIR}/frontend/.env"
        echo -e "   ${GREEN}✓${NC} Created frontend/.env"
    else
        echo -e "   ${YELLOW}⚠${NC} frontend/.env already exists (skipped)"
    fi
else
    echo -e "   ${YELLOW}⚠${NC} No .env.development found, skipping env setup"
fi

echo ""

# ─────────────────────────────────────────────────────────────
# Step 4: Create Required Directories
# ─────────────────────────────────────────────────────────────
echo -e "${YELLOW}📁 Creating required directories...${NC}"

mkdir -p "${SCRIPT_DIR}/logs"
mkdir -p "${SCRIPT_DIR}/.pids"

echo -e "   ${GREEN}✓${NC} Created logs/ and .pids/ directories"
echo ""

# ─────────────────────────────────────────────────────────────
# Step 5: Make Scripts Executable
# ─────────────────────────────────────────────────────────────
echo -e "${YELLOW}🔧 Making scripts executable...${NC}"

chmod +x "${SCRIPT_DIR}/start-dev.sh" 2>/dev/null || true
chmod +x "${SCRIPT_DIR}/start-prod.sh" 2>/dev/null || true
chmod +x "${SCRIPT_DIR}/switch-env.sh" 2>/dev/null || true

echo -e "   ${GREEN}✓${NC} Scripts are now executable"
echo ""

# ─────────────────────────────────────────────────────────────
# Done!
# ─────────────────────────────────────────────────────────────
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}   ✅ Setup Complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "Next steps:"
echo -e "  1. Start development servers:  ${CYAN}./start-dev.sh${NC}"
echo -e "  2. View status:                ${CYAN}./start-dev.sh status${NC}"
echo -e "  3. Stop servers:               ${CYAN}./start-dev.sh stop${NC}"
echo ""
echo -e "URLs:"
echo -e "  Backend:  ${CYAN}http://localhost:3002${NC}"
echo -e "  Frontend: ${CYAN}http://localhost:5173${NC}"
echo ""
