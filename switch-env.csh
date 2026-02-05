#!/bin/csh
#
# switch-env.csh - Switch between development and production environments
#
# Usage:
#   source switch-env.csh dev
#   source switch-env.csh prod
#

if ($#argv < 1) then
    echo "❌ Usage: source switch-env.csh [dev|prod]"
    exit 1
endif

set env_arg = $1
set script_dir = `dirname $0`

# Normalize environment name
switch ($env_arg)
    case "dev":
    case "development":
        set env_name = "development"
        breaksw
    case "prod":
    case "production":
        set env_name = "production"
        breaksw
    default:
        echo "❌ Invalid environment: $env_arg"
        echo "   Use 'dev' or 'prod'"
        exit 1
endsw

set source_file = "${script_dir}/.env.${env_name}"

if (! -f $source_file) then
    echo "❌ Error: $source_file not found!"
    exit 1
endif

# Copy to backend
cp -f $source_file ${script_dir}/backend/.env
echo "✅ Copied to backend/.env"

# Copy to frontend
cp -f $source_file ${script_dir}/frontend/.env
echo "✅ Copied to frontend/.env"

# Export environment variables for current shell
foreach line (`grep -v '^#' $source_file | grep -v '^$'`)
    set var_name = `echo $line | cut -d= -f1`
    set var_value = `echo $line | cut -d= -f2-`
    setenv $var_name "$var_value"
end

# Display current settings
echo ""
echo "🔧 Environment switched to: $env_name"
echo "───────────────────────────────────────"
grep -v '^#' $source_file | grep -v '^$' | sed 's/^/   /'
echo "───────────────────────────────────────"
echo ""
echo "💡 Restart your dev server to apply changes."
echo "   Environment variables are now set in this shell."
