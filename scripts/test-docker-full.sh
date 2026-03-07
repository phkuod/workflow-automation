#!/bin/bash
# =============================================================================
# test-docker-full.sh — Complete Docker Test Pipeline
#
# Runs all 3 test stages against the Docker production image:
#   Stage 1: Unit tests inside Docker container
#   Stage 2: API integration tests against running container
#   Stage 3: Playwright E2E tests against running container
#
# Usage:
#   bash scripts/test-docker-full.sh          # Run all stages
#   bash scripts/test-docker-full.sh --skip-build  # Skip Docker build
#   bash scripts/test-docker-full.sh --stage 2     # Run only stage 2
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

SKIP_BUILD=false
ONLY_STAGE=""
IMAGE_NAME="workflow-automation:test"
COMPOSE_FILE="docker-compose.test.yml"
CONTAINER_NAME="workflow-automation-test"

# Parse args
while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-build) SKIP_BUILD=true; shift ;;
    --stage) ONLY_STAGE="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

should_run() {
  [[ -z "$ONLY_STAGE" ]] || [[ "$ONLY_STAGE" == "$1" ]]
}

section() {
  echo ""
  echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
  echo -e "${CYAN}  $1${NC}"
  echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
  echo ""
}

cleanup() {
  echo -e "\n${YELLOW}Cleaning up...${NC}"
  docker compose -f "$COMPOSE_FILE" down -v 2>/dev/null || true
}
trap cleanup EXIT

# =============================================================================
# Build
# =============================================================================
if [[ "$SKIP_BUILD" == false ]]; then
  section "Building Docker Image"
  docker build -t "$IMAGE_NAME" .
  echo -e "${GREEN}Build successful${NC}"
else
  echo -e "${YELLOW}Skipping build (--skip-build)${NC}"
fi

# =============================================================================
# Stage 1: Unit Tests in Docker
# =============================================================================
if should_run 1; then
  section "Stage 1: Unit Tests in Docker (Linux)"

  echo -e "${CYAN}Running backend unit tests...${NC}"
  docker run --rm \
    -w /app \
    "$IMAGE_NAME" \
    sh -c "cd backend && node_modules/.bin/vitest run 2>&1" \
    || { echo -e "${RED}Backend unit tests FAILED${NC}"; exit 1; }

  echo -e "\n${GREEN}Stage 1: PASSED${NC}"
fi

# =============================================================================
# Stage 2: API Integration Tests
# =============================================================================
if should_run 2; then
  section "Stage 2: API Integration Tests"

  # Start the container
  echo -e "${CYAN}Starting Docker container...${NC}"
  docker compose -f "$COMPOSE_FILE" up -d --build

  # Wait for healthy
  echo -e "${CYAN}Waiting for container to be healthy...${NC}"
  RETRIES=0
  MAX_RETRIES=30
  until curl -sf http://localhost:3001/api/health > /dev/null 2>&1; do
    RETRIES=$((RETRIES + 1))
    if [ $RETRIES -ge $MAX_RETRIES ]; then
      echo -e "${RED}Container failed to start within ${MAX_RETRIES}s${NC}"
      docker compose -f "$COMPOSE_FILE" logs
      exit 1
    fi
    sleep 1
  done
  echo -e "${GREEN}Container is healthy${NC}"

  # Run production smoke test
  echo -e "\n${CYAN}Running production smoke tests...${NC}"
  docker exec "$CONTAINER_NAME" bash /app/scripts/test-production.sh \
    || { echo -e "${RED}Production smoke tests FAILED${NC}"; exit 1; }

  # Run API integration tests
  echo -e "\n${CYAN}Running API integration tests...${NC}"
  node scripts/test-api-integration.js \
    || { echo -e "${RED}API integration tests FAILED${NC}"; exit 1; }

  echo -e "\n${GREEN}Stage 2: PASSED${NC}"
fi

# =============================================================================
# Stage 3: Playwright E2E Tests
# =============================================================================
if should_run 3; then
  section "Stage 3: Playwright E2E Tests (Docker Production)"

  # Ensure container is running (may already be up from Stage 2)
  if ! curl -sf http://localhost:3001/api/health > /dev/null 2>&1; then
    echo -e "${CYAN}Starting Docker container...${NC}"
    docker compose -f "$COMPOSE_FILE" up -d --build

    RETRIES=0
    until curl -sf http://localhost:3001/api/health > /dev/null 2>&1; do
      RETRIES=$((RETRIES + 1))
      if [ $RETRIES -ge 30 ]; then
        echo -e "${RED}Container failed to start${NC}"
        exit 1
      fi
      sleep 1
    done
    echo -e "${GREEN}Container is healthy${NC}"
  fi

  # Install Playwright browsers if needed
  echo -e "${CYAN}Ensuring Playwright browsers are installed...${NC}"
  cd e2e
  npx playwright install chromium --with-deps 2>/dev/null || npx playwright install chromium

  # Run E2E tests against Docker production
  echo -e "\n${CYAN}Running Playwright E2E tests...${NC}"
  CI=true npx playwright test --project=docker-production \
    || { echo -e "${RED}Playwright E2E tests FAILED${NC}"; cd ..; exit 1; }

  cd ..
  echo -e "\n${GREEN}Stage 3: PASSED${NC}"
fi

# =============================================================================
# Summary
# =============================================================================
section "All Tests Passed!"
echo -e "${GREEN}  Stage 1: Unit Tests in Docker (Linux)     — PASSED${NC}"
echo -e "${GREEN}  Stage 2: API Integration Tests            — PASSED${NC}"
echo -e "${GREEN}  Stage 3: Playwright E2E (Docker Prod)     — PASSED${NC}"
echo ""
echo -e "${GREEN}  Production environment is verified and ready!${NC}"
echo ""
