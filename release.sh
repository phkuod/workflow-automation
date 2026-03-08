#!/bin/bash
# =============================================================================
# release.sh — Production Release Script
# =============================================================================
# Target: RHEL 7 + Node 16 + Python 3
#
# 流程:
#   1. git pull (source code 同步到 production server, 不含 node_modules)
#   2. npm install (在 server 上重新安裝 dependencies)
#   3. build (tsc + vite)
#   4. 啟動服務 + 驗證
#
# Usage:
#   ./release.sh preflight              # 檢查環境
#   ./release.sh deploy [tag|branch]    # 完整部署
#   ./release.sh start / stop / status  # 服務管理
#   ./release.sh rollback               # 回滾
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_NAME="workflow-automation"
PID_FILE="${SCRIPT_DIR}/.pids/app.pid"
LOG_DIR="${SCRIPT_DIR}/logs"
LOG_FILE="${LOG_DIR}/app.log"
BACKUP_DIR="${SCRIPT_DIR}/.rollback"

# --- Defaults (override via .env.production) ---
PORT="${PORT:-3001}"
DB_PATH="${DB_PATH:-${SCRIPT_DIR}/data/workflow.db}"
PYTHON_CMD="${PYTHON_CMD:-python3}"
NODE_ENV="${NODE_ENV:-production}"

# --- Colors ---
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

load_env() {
    if [ -f "${SCRIPT_DIR}/.env.production" ]; then
        set -a; source "${SCRIPT_DIR}/.env.production"; set +a
    fi
}

get_version() { node -e "console.log(require('./package.json').version)" 2>/dev/null || echo "0.0.0"; }
get_sha()     { git rev-parse --short HEAD 2>/dev/null || echo "unknown"; }
get_branch()  { git branch --show-current 2>/dev/null || echo "unknown"; }

# =============================================================================
# preflight — 檢查 server 環境
# =============================================================================
cmd_preflight() {
    log_info "=== Pre-flight Check ==="
    local errors=0

    # OS
    [ -f /etc/redhat-release ] && log_info "OS:      $(cat /etc/redhat-release)" \
                               || log_warn "OS:      $(uname -s) $(uname -r)"

    # Node.js
    if command -v node &>/dev/null; then
        local node_ver major
        node_ver=$(node --version)
        major=$(echo "${node_ver}" | sed 's/v\([0-9]*\).*/\1/')
        if [ "${major}" -lt 16 ]; then
            log_error "Node.js: ${node_ver} (need >= 16)"; errors=1
        elif [ "${major}" -ge 18 ]; then
            log_warn  "Node.js: ${node_ver} (RHEL 7 glibc 2.17 only supports Node 16)"
        else
            log_info  "Node.js: ${node_ver}"
        fi
    else
        log_error "Node.js: not found"; errors=1
    fi

    # npm
    command -v npm &>/dev/null && log_info "npm:     $(npm --version)" \
                               || { log_error "npm: not found"; errors=1; }

    # Python 3
    command -v python3 &>/dev/null && log_info "Python:  $(python3 --version 2>&1)" \
                                   || { log_error "Python3: not found (yum install -y python3)"; errors=1; }

    # Git
    command -v git &>/dev/null && log_info "Git:     $(git --version | awk '{print $3}')" \
                               || { log_error "Git: not found"; errors=1; }

    # glibc
    command -v ldd &>/dev/null && log_info "glibc:   $(ldd --version 2>&1 | head -1 | grep -oE '[0-9]+\.[0-9]+$' || echo 'unknown')"

    # Disk
    log_info "Disk:    $(df -h "${SCRIPT_DIR}" 2>/dev/null | awk 'NR==2{print $4}' || echo 'unknown') available"

    [ ${errors} -eq 1 ] && { log_error "Pre-flight FAILED."; return 1; }
    log_info "All checks passed."
}

# =============================================================================
# deploy — 完整部署流程
#   Step 1: git pull source code
#   Step 2: npm install (重新安裝 dependencies)
#   Step 3: build (tsc + vite)
#   Step 4: 啟動 + 驗證
# =============================================================================
cmd_deploy() {
    local target="${1:-}"
    local deploy_start
    deploy_start=$(date +%s)

    log_info "========================================="
    log_info "  Deploying ${APP_NAME}"
    log_info "========================================="

    # --- Pre-flight ---
    log_info ""
    log_info "[Pre-flight] Checking environment..."
    cmd_preflight || exit 1

    # --- Stop service ---
    log_info ""
    log_info "[Stop] Stopping current service..."
    cmd_stop 2>/dev/null || true

    # --- Backup ---
    log_info ""
    log_info "[Backup] Saving current version for rollback..."
    cmd_backup

    # --- Step 1: Git pull ---
    log_info ""
    log_info "[Step 1/4] Syncing source code from Git..."
    if [ -n "${target}" ]; then
        git fetch --all --tags --prune
        if git tag -l "${target}" | grep -q "^${target}$"; then
            git checkout "${target}"
            log_info "  Checked out tag: ${target}"
        else
            git checkout "${target}" 2>/dev/null || git checkout -b "${target}" "origin/${target}"
            git pull origin "${target}"
            log_info "  Checked out branch: ${target}"
        fi
    else
        git pull
        log_info "  Pulled latest: $(get_branch)"
    fi
    log_info "  SHA: $(get_sha)"

    # --- Step 2: npm install ---
    log_info ""
    log_info "[Step 2/4] Installing dependencies (npm install)..."
    (cd "${SCRIPT_DIR}" && npm install --ignore-scripts 2>/dev/null || true)
    (cd "${SCRIPT_DIR}/backend" && npm install)
    (cd "${SCRIPT_DIR}/frontend" && npm install)
    log_info "  Dependencies installed."

    # --- Step 3: Build ---
    log_info ""
    log_info "[Step 3/4] Building application..."

    # 3a: backend (TypeScript -> JavaScript)
    log_info "  Compiling backend (tsc)..."
    (cd "${SCRIPT_DIR}/backend" && npx tsc)

    # 3b: frontend (Vite production build)
    log_info "  Building frontend (vite)..."
    (cd "${SCRIPT_DIR}/frontend" && npm run build)

    # 3c: Copy frontend into backend/public
    log_info "  Packaging frontend assets..."
    rm -rf "${SCRIPT_DIR}/backend/public"
    mkdir -p "${SCRIPT_DIR}/backend/public"
    cp -r "${SCRIPT_DIR}/frontend/dist/"* "${SCRIPT_DIR}/backend/public/"

    log_info "  Build complete."

    # --- Step 4: Start + Verify ---
    log_info ""
    log_info "[Step 4/4] Starting service..."
    cmd_start

    # Smoke test
    log_info ""
    log_info "[Verify] Running smoke test..."
    cmd_smoke

    # Done
    local elapsed=$(( $(date +%s) - deploy_start ))
    log_info ""
    log_info "========================================="
    log_info "  Deploy complete! (${elapsed}s)"
    log_info "  Version: v$(get_version) ($(get_sha))"
    log_info "  URL:     http://localhost:${PORT}"
    log_info "========================================="
}

# =============================================================================
# backup — 備份當前 build + DB
# =============================================================================
cmd_backup() {
    mkdir -p "${BACKUP_DIR}"

    # Backup build artifacts
    if [ -d "${SCRIPT_DIR}/backend/dist" ]; then
        git rev-parse HEAD > "${BACKUP_DIR}/git-sha" 2>/dev/null || true
        get_version > "${BACKUP_DIR}/version"
        date -u +"%Y-%m-%dT%H:%M:%SZ" > "${BACKUP_DIR}/backup-date"

        rm -rf "${BACKUP_DIR}/backend-dist" "${BACKUP_DIR}/backend-public" "${BACKUP_DIR}/backend-node_modules"
        cp -r "${SCRIPT_DIR}/backend/dist"         "${BACKUP_DIR}/backend-dist"
        cp -r "${SCRIPT_DIR}/backend/public"       "${BACKUP_DIR}/backend-public" 2>/dev/null || true
        cp -r "${SCRIPT_DIR}/backend/node_modules" "${BACKUP_DIR}/backend-node_modules" 2>/dev/null || true

        log_info "  Build backed up: v$(cat "${BACKUP_DIR}/version") ($(cat "${BACKUP_DIR}/git-sha" | head -c 7))"
    fi

    # Backup database
    load_env
    if [ -f "${DB_PATH}" ]; then
        mkdir -p "${BACKUP_DIR}/db"
        local timestamp backup_file
        timestamp=$(date +%Y%m%d_%H%M%S)
        backup_file="${BACKUP_DIR}/db/workflow_${timestamp}.db"
        cp "${DB_PATH}" "${backup_file}"
        log_info "  DB backed up: $(basename "${backup_file}")"

        # 保留最近 5 份
        local count
        count=$(ls -1 "${BACKUP_DIR}/db"/workflow_*.db 2>/dev/null | wc -l)
        if [ "${count}" -gt 5 ]; then
            ls -1t "${BACKUP_DIR}/db"/workflow_*.db | tail -n +6 | xargs rm -f
        fi
    fi
}

# =============================================================================
# rollback — 回滾到上一個版本
# =============================================================================
cmd_rollback() {
    if [ ! -d "${BACKUP_DIR}/backend-dist" ]; then
        log_error "No backup found. Cannot rollback."
        exit 1
    fi

    local rb_ver="?" rb_sha="?"
    [ -f "${BACKUP_DIR}/version" ] && rb_ver=$(cat "${BACKUP_DIR}/version")
    [ -f "${BACKUP_DIR}/git-sha" ] && rb_sha=$(cat "${BACKUP_DIR}/git-sha" | head -c 7)

    log_info "=== Rollback ==="
    log_info "  Current:  v$(get_version) ($(get_sha))"
    log_info "  Rollback: v${rb_ver} (${rb_sha})"

    cmd_stop 2>/dev/null || true

    rm -rf "${SCRIPT_DIR}/backend/dist"
    cp -r "${BACKUP_DIR}/backend-dist" "${SCRIPT_DIR}/backend/dist"

    [ -d "${BACKUP_DIR}/backend-public" ] && {
        rm -rf "${SCRIPT_DIR}/backend/public"
        cp -r "${BACKUP_DIR}/backend-public" "${SCRIPT_DIR}/backend/public"
    }

    [ -d "${BACKUP_DIR}/backend-node_modules" ] && {
        rm -rf "${SCRIPT_DIR}/backend/node_modules"
        cp -r "${BACKUP_DIR}/backend-node_modules" "${SCRIPT_DIR}/backend/node_modules"
    }

    cmd_start
    log_info "Rollback complete: v${rb_ver} (${rb_sha})"
}

# =============================================================================
# start — 啟動
# =============================================================================
cmd_start() {
    load_env

    # Already running?
    if [ -f "${PID_FILE}" ]; then
        local pid; pid=$(cat "${PID_FILE}")
        if kill -0 "${pid}" 2>/dev/null; then
            log_warn "Already running (PID: ${pid})"
            return 0
        fi
        rm -f "${PID_FILE}"
    fi

    # Check build
    if [ ! -f "${SCRIPT_DIR}/backend/dist/index.js" ]; then
        log_error "No build found. Run './release.sh deploy' first."
        exit 1
    fi

    mkdir -p "${LOG_DIR}" "$(dirname "${PID_FILE}")"
    mkdir -p "$(dirname "${DB_PATH}")" 2>/dev/null || true

    # Log rotation (> 50MB)
    if [ -f "${LOG_FILE}" ]; then
        local log_size
        log_size=$(stat -c%s "${LOG_FILE}" 2>/dev/null || stat -f%z "${LOG_FILE}" 2>/dev/null || echo 0)
        if [ "${log_size}" -gt 52428800 ]; then
            mv "${LOG_FILE}" "${LOG_FILE}.$(date +%Y%m%d_%H%M%S)"
            ls -1t "${LOG_DIR}"/app.log.* 2>/dev/null | tail -n +6 | xargs rm -f 2>/dev/null || true
        fi
    fi

    export NODE_ENV PORT DB_PATH PYTHON_CMD

    log_info "Starting ${APP_NAME} (port=${PORT}, node=$(node --version))..."
    nohup node "${SCRIPT_DIR}/backend/dist/index.js" >> "${LOG_FILE}" 2>&1 &
    echo $! > "${PID_FILE}"

    # Wait for health
    local pid max_wait=15 i=0
    pid=$(cat "${PID_FILE}")
    while [ ${i} -lt ${max_wait} ]; do
        sleep 1; i=$((i + 1))
        if ! kill -0 "${pid}" 2>/dev/null; then
            log_error "Process died. Check: tail -20 ${LOG_FILE}"
            rm -f "${PID_FILE}"; exit 1
        fi
        if curl -sf "http://localhost:${PORT}/api/health" >/dev/null 2>&1; then
            log_info "Started (PID: ${pid}, port: ${PORT})"
            return 0
        fi
    done
    log_warn "Started (PID: ${pid}) but health not responding after ${max_wait}s"
}

# =============================================================================
# stop — 停止
# =============================================================================
cmd_stop() {
    if [ ! -f "${PID_FILE}" ]; then
        log_info "Not running."; return 0
    fi

    local pid; pid=$(cat "${PID_FILE}")
    if ! kill -0 "${pid}" 2>/dev/null; then
        log_info "Not running (stale PID)."; rm -f "${PID_FILE}"; return 0
    fi

    log_info "Stopping (PID: ${pid})..."
    kill "${pid}" 2>/dev/null
    local i=0
    while kill -0 "${pid}" 2>/dev/null && [ ${i} -lt 10 ]; do sleep 1; i=$((i+1)); done
    if kill -0 "${pid}" 2>/dev/null; then
        kill -9 "${pid}" 2>/dev/null || true; sleep 1
    fi
    rm -f "${PID_FILE}"
    log_info "Stopped."
}

# =============================================================================
# restart
# =============================================================================
cmd_restart() { cmd_stop; sleep 1; cmd_start; }

# =============================================================================
# status — 顯示狀態
# =============================================================================
cmd_status() {
    load_env
    echo ""
    echo -e "${BOLD}  ${APP_NAME} Status${NC}"
    echo "  ----------------------------------------"

    echo -e "  Version:  ${BOLD}v$(get_version)${NC} ($(get_sha))"
    echo    "  Branch:   $(get_branch)"

    if [ -f "${PID_FILE}" ] && kill -0 "$(cat "${PID_FILE}")" 2>/dev/null; then
        echo -e "  Process:  ${GREEN}Running${NC} (PID: $(cat "${PID_FILE}"))"
    else
        echo -e "  Process:  ${RED}Stopped${NC}"
    fi

    if curl -sf "http://localhost:${PORT}/api/health" >/dev/null 2>&1; then
        echo -e "  Health:   ${GREEN}OK${NC} (port ${PORT})"
    else
        echo -e "  Health:   ${RED}Unreachable${NC}"
    fi

    if [ -f "${DB_PATH}" ]; then
        echo "  Database: ${DB_PATH} ($(ls -lh "${DB_PATH}" | awk '{print $5}'))"
    else
        echo "  Database: not created yet"
    fi

    if [ -d "${BACKUP_DIR}/backend-dist" ]; then
        local rb_ver="?" rb_sha="?"
        [ -f "${BACKUP_DIR}/version" ] && rb_ver=$(cat "${BACKUP_DIR}/version")
        [ -f "${BACKUP_DIR}/git-sha" ] && rb_sha=$(cat "${BACKUP_DIR}/git-sha" | head -c 7)
        echo -e "  Rollback: ${GREEN}available${NC} (v${rb_ver} / ${rb_sha})"
    fi

    if [ -f "${LOG_FILE}" ]; then
        echo ""
        echo "  Recent logs:"
        tail -5 "${LOG_FILE}" 2>/dev/null | sed 's/^/    /'
    fi
    echo ""
}

# =============================================================================
# smoke — 部署後快速驗證
# =============================================================================
cmd_smoke() {
    load_env
    local base="http://localhost:${PORT}" errors=0

    for endpoint in "/api/health" "/api/workflows" "/api/executions" "/api/metrics"; do
        local code
        code=$(curl -sf -o /dev/null -w "%{http_code}" "${base}${endpoint}" 2>/dev/null || echo "000")
        if [ "${code}" = "200" ]; then
            log_info "  GET ${endpoint} ... ${code} OK"
        else
            log_error "  GET ${endpoint} ... ${code} FAIL"
            errors=1
        fi
    done

    # Frontend
    local code
    code=$(curl -sf -o /dev/null -w "%{http_code}" "${base}/" 2>/dev/null || echo "000")
    [ "${code}" = "200" ] && log_info "  GET / (frontend) ... ${code} OK" \
                          || log_warn "  GET / (frontend) ... ${code}"

    [ ${errors} -eq 1 ] && { log_error "Smoke test FAILED."; return 1; }
    log_info "  Smoke test passed."
}

# =============================================================================
# logs — 查看 log
# =============================================================================
cmd_logs() {
    [ ! -f "${LOG_FILE}" ] && { log_warn "No log file."; return 0; }
    tail -f -n "${1:-50}" "${LOG_FILE}"
}

# =============================================================================
# Main
# =============================================================================
case "${1:-help}" in
    preflight)   cmd_preflight ;;
    deploy)      cmd_deploy "${2:-}" ;;
    start)       cmd_start ;;
    stop)        cmd_stop ;;
    restart)     cmd_restart ;;
    status)      cmd_status ;;
    rollback)    cmd_rollback ;;
    smoke)       cmd_smoke ;;
    logs)        cmd_logs "${2:-50}" ;;
    *)
        echo ""
        echo -e "${BOLD}Usage: $0 <command>${NC}"
        echo ""
        echo "  preflight            Check server environment"
        echo "  deploy [tag|branch]  Full deploy (pull -> install -> build -> start)"
        echo "  start                Start service"
        echo "  stop                 Stop service"
        echo "  restart              Restart service"
        echo "  status               Show status"
        echo "  rollback             Rollback to previous version"
        echo "  smoke                Run smoke tests"
        echo "  logs [lines]         Tail logs"
        echo ""
        echo -e "${DIM}First time:${NC}"
        echo "  git clone <repo> /opt/workflow-automation"
        echo "  cd /opt/workflow-automation"
        echo "  ./release.sh preflight"
        echo "  ./release.sh deploy"
        echo ""
        echo -e "${DIM}Update:${NC}"
        echo "  ./release.sh deploy              # pull latest + rebuild"
        echo "  ./release.sh deploy v1.2.0       # deploy specific tag"
        echo "  ./release.sh deploy release/1.3  # deploy specific branch"
        echo ""
        echo -e "${DIM}Rollback:${NC}"
        echo "  ./release.sh rollback"
        echo ""
        ;;
esac
