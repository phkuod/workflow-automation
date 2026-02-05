#!/bin/bash
#
# switch-env.sh - Switch between development and production environments
#
# Usage:
#   source ./switch-env.sh [dev|prod]
#

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ $# -lt 1 ]]; then
    echo "Usage: source $0 [dev|prod]"
    echo ""
    echo "Examples:"
    echo "  source ./switch-env.sh dev   - Switch to development environment"
    echo "  source ./switch-env.sh prod  - Switch to production environment"
    return 1 2>/dev/null || exit 1
fi

ENV_TYPE="$1"

case "$ENV_TYPE" in
    dev|development)
        ENV_FILE="${SCRIPT_DIR}/.env.development"
        ENV_NAME="development"
        ;;
    prod|production)
        ENV_FILE="${SCRIPT_DIR}/.env.production"
        ENV_NAME="production"
        ;;
    *)
        echo "❌ Unknown environment: $ENV_TYPE"
        echo "   Valid options: dev, prod"
        return 1 2>/dev/null || exit 1
        ;;
esac

if [[ ! -f "$ENV_FILE" ]]; then
    echo "❌ Environment file not found: $ENV_FILE"
    return 1 2>/dev/null || exit 1
fi

# Export variables from the environment file
set -a
source "$ENV_FILE"
set +a

# Copy to backend and frontend
cp "$ENV_FILE" "${SCRIPT_DIR}/backend/.env"
cp "$ENV_FILE" "${SCRIPT_DIR}/frontend/.env"

echo "✅ Switched to ${ENV_NAME} environment"
echo "   Copied to backend/.env and frontend/.env"
echo ""
echo "Environment variables loaded:"
while IFS='=' read -r key value; do
    # Skip comments and empty lines
    [[ $key =~ ^#.*$ ]] && continue
    [[ -z "$key" ]] && continue
    echo "   $key=$value"
done < "$ENV_FILE"
