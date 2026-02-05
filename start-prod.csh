#!/bin/csh
#
# start-prod.csh - Start the Workflow Automation application in production mode
#
# Usage:
#   ./start-prod.csh [start|stop|restart|status]
#

set script_dir = `dirname $0`
set backend_dir = "${script_dir}/backend"
set frontend_dir = "${script_dir}/frontend"
set pid_dir = "${script_dir}/.pids"

# Create pid directory if not exists
if (! -d $pid_dir) then
    mkdir -p $pid_dir
endif

set backend_pid = "${pid_dir}/backend.pid"
set frontend_pid = "${pid_dir}/frontend.pid"

if ($#argv < 1) then
    set action = "start"
else
    set action = $1
endif

switch ($action)
    case "start":
        echo "🚀 Starting Workflow Automation (Production)"
        echo ""
        
        # Load production environment
        if (-f "${script_dir}/.env.production") then
            source ${script_dir}/switch-env.csh prod
        endif
        
        # Build frontend for production
        echo "📦 Building frontend..."
        cd $frontend_dir
        npm run build
        
        # Start backend
        echo "🔧 Starting backend server..."
        cd $backend_dir
        nohup npm start > ${script_dir}/logs/backend.log 2>&1 &
        echo $! > $backend_pid
        echo "   Backend PID: `cat $backend_pid`"
        
        # Serve frontend (using backend static serving or separate server)
        echo ""
        echo "✅ Production server started!"
        echo "   Backend: http://localhost:${PORT:-3001}"
        echo ""
        echo "💡 Use './start-prod.csh stop' to stop the server."
        breaksw
        
    case "stop":
        echo "🛑 Stopping Workflow Automation..."
        
        if (-f $backend_pid) then
            set pid = `cat $backend_pid`
            if (`ps -p $pid | wc -l` > 1) then
                kill $pid
                echo "   Stopped backend (PID: $pid)"
            endif
            rm -f $backend_pid
        endif
        
        echo "✅ Servers stopped."
        breaksw
        
    case "restart":
        $0 stop
        sleep 2
        $0 start
        breaksw
        
    case "status":
        echo "📊 Server Status"
        echo "───────────────────────────────────────"
        
        if (-f $backend_pid) then
            set pid = `cat $backend_pid`
            if (`ps -p $pid | wc -l` > 1) then
                echo "   Backend:  ✅ Running (PID: $pid)"
            else
                echo "   Backend:  ❌ Not running (stale PID file)"
            endif
        else
            echo "   Backend:  ❌ Not running"
        endif
        
        echo "───────────────────────────────────────"
        breaksw
        
    default:
        echo "❌ Unknown action: $action"
        echo "   Usage: $0 [start|stop|restart|status]"
        exit 1
endsw
