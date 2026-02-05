#!/bin/bash
#
# start-prod.sh - Start the Workflow Automation application in production mode
#
# Usage:
#   ./start-prod.sh [start|stop|restart|status]
#

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="${SCRIPT_DIR}/backend"
FRONTEND_DIR="${SCRIPT_DIR}/frontend"
PID_DIR="${SCRIPT_DIR}/.pids"

# Create directories if they don't exist
mkdir -p "${PID_DIR}"
mkdir -p "${SCRIPT_DIR}/logs"

BACKEND_PID="${PID_DIR}/backend-prod.pid"

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
    echo -e "${CYAN}🚀 Starting Workflow Automation (Production)${NC}"
    echo ""
    
    # Check if .env exists, if not copy from .env.production
    if [[ ! -f "${BACKEND_DIR}/.env" ]]; then
        if [[ -f "${SCRIPT_DIR}/.env.production" ]]; then
            cp "${SCRIPT_DIR}/.env.production" "${BACKEND_DIR}/.env"
            echo -e "${YELLOW}📝 Created backend/.env from .env.production${NC}"
        fi
    fi
    
    # Source environment if available
    if [[ -f "${SCRIPT_DIR}/.env.production" ]]; then
        set -a
        source "${SCRIPT_DIR}/.env.production"
        set +a
    fi
    
    # Build frontend for production
    echo -e "${GREEN}🔧 Building frontend for production...${NC}"
    cd "${FRONTEND_DIR}"
    npm run build
    
    if [[ $? -ne 0 ]]; then
        echo -e "${RED}❌ Frontend build failed!${NC}"
        exit 1
    fi
    
    # Start backend production server (serves static frontend)
    echo -e "${GREEN}🚀 Starting production server...${NC}"
    cd "${BACKEND_DIR}"
    nohup npm start > "${SCRIPT_DIR}/logs/backend-prod.log" 2>&1 &
    echo $! > "${BACKEND_PID}"
    echo "   Server PID: $(cat ${BACKEND_PID})"
    
    echo ""
    echo -e "${GREEN}✅ Production server started!${NC}"
    echo -e "   Application: ${CYAN}http://localhost:${PORT:-3002}${NC}"
    echo ""
    echo "📝 Logs:"
    echo "   tail -f logs/backend-prod.log"
    echo ""
    echo -e "${MAGENTA}💡 Use './start-prod.sh stop' to stop the server.${NC}"
}

stop_servers() {
    echo "🛑 Stopping Production Server..."
    
    if [[ -f "${BACKEND_PID}" ]]; then
        PID=$(cat "${BACKEND_PID}")
        if ps -p $PID > /dev/null 2>&1; then
            kill $PID 2>/dev/null
            pkill -P $PID 2>/dev/null
            echo "   Stopped server (PID: $PID)"
        fi
        rm -f "${BACKEND_PID}"
    fi
    
    # Cleanup any remaining node processes on our port
    if command -v lsof &> /dev/null; then
        lsof -ti:3002 | xargs kill -9 2>/dev/null
    fi
    
    echo -e "${GREEN}✅ Production server stopped.${NC}"
}

show_status() {
    echo "📊 Production Server Status"
    echo "───────────────────────────────────────"
    
    if [[ -f "${BACKEND_PID}" ]]; then
        PID=$(cat "${BACKEND_PID}")
        if ps -p $PID > /dev/null 2>&1; then
            echo "   Server: ✅ Running (PID: $PID)"
        else
            echo "   Server: ❌ Not running"
        fi
    else
        echo "   Server: ❌ Not running"
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
