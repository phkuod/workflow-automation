#!/bin/bash
# =============================================================================
# test-production.sh — Production Environment Verification Script
# Run inside the Docker container to validate the RHEL 8 production setup.
#
# Usage:
#   docker run --rm workflow-automation:test bash /app/scripts/test-production.sh
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0
PORT="${PORT:-3002}"
BASE_URL="http://localhost:${PORT}"

pass() {
    PASS=$((PASS + 1))
    echo -e "  ${GREEN}✅ PASS${NC}: $1"
}

fail() {
    FAIL=$((FAIL + 1))
    echo -e "  ${RED}❌ FAIL${NC}: $1"
    if [ -n "$2" ]; then
        echo -e "         ${RED}$2${NC}"
    fi
}

section() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# =============================================================================
section "🖥️  System Info"
# =============================================================================
echo "  OS: $(cat /etc/redhat-release 2>/dev/null || echo 'Unknown')"
echo "  Node: $(node -v)"
echo "  Python: $(python3 --version 2>/dev/null || echo 'Not found')"
echo "  Arch: $(uname -m)"
echo "  Kernel: $(uname -r)"

# =============================================================================
section "📋 Pre-flight Checks"
# =============================================================================

# Check Node.js is available
if command -v node &> /dev/null; then
    pass "Node.js is available ($(node -v))"
else
    fail "Node.js not found"
fi

# Check Python 3 is available
if command -v python3 &> /dev/null; then
    pass "Python3 is available ($(python3 --version))"
else
    fail "Python3 not found"
fi

# Check backend compiled output exists
if [ -f "/app/backend/dist/index.js" ]; then
    pass "Backend compiled output exists (dist/index.js)"
else
    fail "Backend compiled output missing"
fi

# Check frontend static files exist
if [ -f "/app/backend/public/index.html" ]; then
    pass "Frontend static build exists (public/index.html)"
else
    fail "Frontend static build missing"
fi

# Check data directory is writable
if [ -w "/var/data" ]; then
    pass "Data directory /var/data is writable"
else
    fail "Data directory /var/data is not writable"
fi

# Check better-sqlite3 native module
if node -e "require('/app/backend/node_modules/better-sqlite3')" 2>/dev/null; then
    pass "better-sqlite3 native binding loads correctly"
else
    fail "better-sqlite3 native binding failed to load" \
         "This means native compilation did not work on RHEL 8"
fi

# =============================================================================
section "🚀 Starting Application Server"
# =============================================================================

# Start the server in the background
cd /app
node backend/dist/index.js &
SERVER_PID=$!
echo "  Server PID: ${SERVER_PID}"

# Wait for server to be ready
echo "  Waiting for server to start..."
RETRIES=0
MAX_RETRIES=30
until curl -s "${BASE_URL}/api/health" > /dev/null 2>&1; do
    RETRIES=$((RETRIES + 1))
    if [ $RETRIES -ge $MAX_RETRIES ]; then
        fail "Server failed to start within ${MAX_RETRIES} seconds"
        kill $SERVER_PID 2>/dev/null || true
        exit 1
    fi
    sleep 1
done
pass "Server started and responding"

# =============================================================================
section "🏥 Health Check"
# =============================================================================

HEALTH=$(curl -s "${BASE_URL}/api/health")
if echo "$HEALTH" | grep -q '"status":"ok"'; then
    pass "Health endpoint returns status=ok"
else
    fail "Health endpoint unexpected response" "$HEALTH"
fi

# =============================================================================
section "📡 API Smoke Tests"
# =============================================================================

# Create a test workflow
CREATE_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/workflows" \
    -H "Content-Type: application/json" \
    -d '{
        "name": "Docker Production Test",
        "description": "Automated test workflow",
        "definition": {
            "stations": [
                {
                    "id": "station-1",
                    "name": "Trigger Station",
                    "steps": [
                        {
                            "id": "step-1",
                            "name": "Test Step",
                            "type": "trigger-manual",
                            "config": {},
                            "position": { "x": 100, "y": 100 }
                        }
                    ],
                    "position": { "x": 100, "y": 100 }
                }
            ]
        }
    }')

WORKFLOW_ID=$(echo "$CREATE_RESPONSE" | node -e "
    let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
        try{const r=JSON.parse(d);console.log(r.data?.id||r.id||'')}catch(e){console.log('')}
    })
")

if [ -n "$WORKFLOW_ID" ]; then
    pass "Create workflow — ID: ${WORKFLOW_ID}"
else
    fail "Create workflow failed" "$CREATE_RESPONSE"
fi

# List workflows
LIST_RESPONSE=$(curl -s "${BASE_URL}/api/workflows")
if echo "$LIST_RESPONSE" | grep -q "Docker Production Test"; then
    pass "List workflows contains test workflow"
else
    fail "List workflows missing test workflow" "$LIST_RESPONSE"
fi

# Get single workflow
if [ -n "$WORKFLOW_ID" ]; then
    GET_RESPONSE=$(curl -s "${BASE_URL}/api/workflows/${WORKFLOW_ID}")
    if echo "$GET_RESPONSE" | grep -q "Docker Production Test"; then
        pass "Get workflow by ID"
    else
        fail "Get workflow by ID failed" "$GET_RESPONSE"
    fi
fi

# Delete workflow
if [ -n "$WORKFLOW_ID" ]; then
    DELETE_RESPONSE=$(curl -s -X DELETE "${BASE_URL}/api/workflows/${WORKFLOW_ID}")
    if echo "$DELETE_RESPONSE" | grep -q '"deleted"'; then
        pass "Delete workflow"
    else
        fail "Delete workflow failed" "$DELETE_RESPONSE"
    fi
fi

# =============================================================================
section "🐍 Python Execution Test"
# =============================================================================

PYTHON_RESULT=$(python3 -c "
import json, sys
result = {'status': 'ok', 'platform': sys.platform, 'version': sys.version.split()[0]}
print(json.dumps(result))
" 2>&1)

if echo "$PYTHON_RESULT" | grep -q '"status": "ok"'; then
    pass "Python3 script execution works"
    echo "       Platform: $(echo "$PYTHON_RESULT" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('platform',''))")"
else
    fail "Python3 script execution failed" "$PYTHON_RESULT"
fi

# =============================================================================
section "🌐 Frontend Static Files"
# =============================================================================

FRONTEND_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/")
if [ "$FRONTEND_RESPONSE" = "200" ]; then
    pass "Frontend index.html served (HTTP 200)"
else
    fail "Frontend index.html not served" "HTTP ${FRONTEND_RESPONSE}"
fi

# Check that JS assets are served
JS_FILES=$(find /app/backend/public/assets -name "*.js" 2>/dev/null | head -1)
if [ -n "$JS_FILES" ]; then
    JS_BASENAME=$(basename "$JS_FILES")
    ASSET_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/assets/${JS_BASENAME}")
    if [ "$ASSET_RESPONSE" = "200" ]; then
        pass "Frontend JS asset served (HTTP 200)"
    else
        fail "Frontend JS asset not served" "HTTP ${ASSET_RESPONSE}"
    fi
else
    fail "No JS assets found in /app/backend/public/assets"
fi

# =============================================================================
section "🛑 Graceful Shutdown Test"
# =============================================================================

# Send SIGTERM and check clean exit
kill -TERM $SERVER_PID 2>/dev/null
SHUTDOWN_RETRIES=0
while kill -0 $SERVER_PID 2>/dev/null; do
    SHUTDOWN_RETRIES=$((SHUTDOWN_RETRIES + 1))
    if [ $SHUTDOWN_RETRIES -ge 10 ]; then
        fail "Server did not shut down within 10 seconds"
        kill -9 $SERVER_PID 2>/dev/null || true
        break
    fi
    sleep 1
done

if [ $SHUTDOWN_RETRIES -lt 10 ]; then
    pass "Graceful shutdown completed in ${SHUTDOWN_RETRIES}s"
fi

# =============================================================================
section "📊 Test Results"
# =============================================================================

TOTAL=$((PASS + FAIL))
echo ""
echo -e "  Total:  ${TOTAL}"
echo -e "  ${GREEN}Pass:   ${PASS}${NC}"
echo -e "  ${RED}Fail:   ${FAIL}${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}══════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  ✅ ALL TESTS PASSED — Production environment is ready!${NC}"
    echo -e "${GREEN}══════════════════════════════════════════════════════════${NC}"
    exit 0
else
    echo -e "${RED}══════════════════════════════════════════════════════════${NC}"
    echo -e "${RED}  ❌ ${FAIL} TEST(S) FAILED — Review output above${NC}"
    echo -e "${RED}══════════════════════════════════════════════════════════${NC}"
    exit 1
fi
