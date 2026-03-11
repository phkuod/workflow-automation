#!/bin/csh
#
# build-prod.csh - Build Workflow Automation for production (C-Shell)
#
# Usage:
#   ./build-prod.csh
#
# This script will:
#   1. Clean previous builds
#   2. Build the Vite React frontend
#   3. Copy frontend static files to the backend public folder
#   4. Compile the Express TypeScript backend
#

set -e  # Exit on any error

set SCRIPT_DIR = `dirname $0`
set SCRIPT_DIR = `cd $SCRIPT_DIR && pwd`

# Colors for output
set RED = '\033[0;31m'
set GREEN = '\033[0;32m'
set CYAN = '\033[0;36m'
set YELLOW = '\033[1;33m'
set NC = '\033[0m'

printf "${CYAN}═══════════════════════════════════════════════════════════${NC}\n"
printf "${CYAN}   Workflow Automation - Production Build${NC}\n"
printf "${CYAN}═══════════════════════════════════════════════════════════${NC}\n\n"

cd "${SCRIPT_DIR}"

printf "${YELLOW}🧹 Cleaning previous builds...${NC}\n"
rm -rf frontend/dist
rm -rf backend/dist
rm -rf backend/public
mkdir -p backend/public
printf "   ${GREEN}✓${NC} Clean complete\n\n"

printf "${YELLOW}🏗️  Building frontend (Vite -> static files)...${NC}\n"
npm run build:frontend
printf "   ${GREEN}✓${NC} Frontend build complete\n\n"

printf "${YELLOW}📦 Merging frontend static assets into backend...${NC}\n"
cp -R frontend/dist/* backend/public/
printf "   ${GREEN}✓${NC} Assets copied to backend/public\n\n"

printf "${YELLOW}⚙️  Building backend (TypeScript -> JavaScript)...${NC}\n"
npm run build:backend
printf "   ${GREEN}✓${NC} Backend build complete\n\n"

printf "${GREEN}═══════════════════════════════════════════════════════════${NC}\n"
printf "${GREEN}   ✅ Production Build Successful!${NC}\n"
printf "${GREEN}═══════════════════════════════════════════════════════════${NC}\n\n"

printf "To start the production server locally in C-Shell, run:\n"
printf "  ${CYAN}cd backend${NC}\n"
printf "  ${CYAN}setenv NODE_ENV production${NC}\n"
printf "  ${CYAN}npm start${NC}\n\n"
printf "Your app will then be available at http://localhost:3001/\n\n"
