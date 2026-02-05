#!/bin/bash
#
# start-dev.sh - Start the Workflow Automation application in development mode
#
# Usage:
#   ./start-dev.sh [start|stop|restart|status]
#

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="${SCRIPT_DIR}/backend"
FRONTEND_DIR="${SCRIPT_DIR}/frontend"
PID_DIR="${SCRIPT_DIR}/.pids"

# Create directories if they don't exist
mkdir -p "${PID_DIR}"
mkdir -p "${SCRIPT_DIR}/logs"

BACKEND_PID="${PID_DIR}/backend-dev.pid"
FRONTEND_PID="${PID_DIR}/frontend-dev.pid"

# Default action is start
ACTION="${1:-start}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

start_servers() {
    echo -e "${CYAN}🚀 Starting Workflow Automation (Development)${NC}"
    echo ""
    
    # Check if .env exists, if not copy from .env.development
    if [[ ! -f "${BACKEND_DIR}/.env" ]]; then
        if [[ -f "${SCRIPT_DIR}/.env.development" ]]; then
            cp "${SCRIPT_DIR}/.env.development" "${BACKEND_DIR}/.env"
            echo -e "${YELLOW}📝 Created backend/.env from .env.development${NC}"
        fi
    fi
    
    if [[ ! -f "${FRONTEND_DIR}/.env" ]]; then
        if [[ -f "${SCRIPT_DIR}/.env.development" ]]; then
            cp "${SCRIPT_DIR}/.env.development" "${FRONTEND_DIR}/.env"
            echo -e "${YELLOW}📝 Created frontend/.env from .env.development${NC}"
        fi
    fi
    
    # Source environment if available
    if [[ -f "${SCRIPT_DIR}/.env.development" ]]; then
        set -a
        source "${SCRIPT_DIR}/.env.development"
        set +a
    fi
    
    # Start backend dev server
    echo -e "${GREEN}🔧 Starting backend dev server...${NC}"
    cd "${BACKEND_DIR}"
    nohup npm run dev > "${SCRIPT_DIR}/logs/backend-dev.log" 2>&1 &
    echo $! > "${BACKEND_PID}"
    echo "   Backend PID: $(cat ${BACKEND_PID})"
    
    # Start frontend dev server
    echo -e "${GREEN}🎨 Starting frontend dev server...${NC}"
    cd "${FRONTEND_DIR}"
    nohup npm run dev > "${SCRIPT_DIR}/logs/frontend-dev.log" 2>&1 &
    echo $! > "${FRONTEND_PID}"
    echo "   Frontend PID: $(cat ${FRONTEND_PID})"
    
    echo ""
    echo -e "${GREEN}✅ Development servers started!${NC}"
    echo -e "   Backend:  ${CYAN}http://localhost:${PORT:-3002}${NC}"
    echo -e "   Frontend: ${CYAN}http://localhost:5173${NC}"
    echo ""
    echo "📝 Logs:"
    echo "   tail -f logs/backend-dev.log"
    echo "   tail -f logs/frontend-dev.log"
    echo ""
    echo -e "${MAGENTA}💡 Use './start-dev.sh stop' to stop the servers.${NC}"
}

stop_servers() {
    echo "🛑 Stopping Development Servers..."
    
    if [[ -f "${BACKEND_PID}" ]]; then
        PID=$(cat "${BACKEND_PID}")
        if ps -p $PID > /dev/null 2>&1; then
            kill $PID 2>/dev/null
            # Also kill child processes (npm spawns node)
            pkill -P $PID 2>/dev/null
            echo "   Stopped backend (PID: $PID)"
        fi
        rm -f "${BACKEND_PID}"
    fi
    
    if [[ -f "${FRONTEND_PID}" ]]; then
        PID=$(cat "${FRONTEND_PID}")
        if ps -p $PID > /dev/null 2>&1; then
            kill $PID 2>/dev/null
            # Also kill child processes
            pkill -P $PID 2>/dev/null
            echo "   Stopped frontend (PID: $PID)"
        fi
        rm -f "${FRONTEND_PID}"
    fi
    
    # Cleanup any remaining node processes on our ports
    if command -v lsof &> /dev/null; then
        lsof -ti:3002 | xargs kill -9 2>/dev/null
        lsof -ti:5173 | xargs kill -9 2>/dev/null
    fi
    
    echo -e "${GREEN}✅ Development servers stopped.${NC}"
}

show_status() {
    echo "📊 Development Server Status"
    echo "───────────────────────────────────────"
    
    if [[ -f "${BACKEND_PID}" ]]; then
        PID=$(cat "${BACKEND_PID}")
        if ps -p $PID > /dev/null 2>&1; then
            echo "   Backend:  ✅ Running (PID: $PID)"
        else
            echo "   Backend:  ❌ Not running"
        fi
    else
        echo "   Backend:  ❌ Not running"
    fi
    
    if [[ -f "${FRONTEND_PID}" ]]; then
        PID=$(cat "${FRONTEND_PID}")
        if ps -p $PID > /dev/null 2>&1; then
            echo "   Frontend: ✅ Running (PID: $PID)"
        else
            echo "   Frontend: ❌ Not running"
        fi
    else
        echo "   Frontend: ❌ Not running"
    fi
    
    echo "───────────────────────────────────────"
}

case "$ACTION" in
    start)
        start_servers
        ;;
    stop)
        stop_servers
        ;;
    restart)
        stop_servers
        sleep 2
        start_servers
        ;;
    status)
        show_status
        ;;
    *)
        echo -e "${RED}❌ Unknown action: $ACTION${NC}"
        echo "   Usage: $0 [start|stop|restart|status]"
        exit 1
        ;;
esac
