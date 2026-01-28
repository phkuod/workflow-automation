#!/bin/csh
#
# start-dev.csh - Start the Workflow Automation application in development mode
#
# Usage:
#   ./start-dev.csh [start|stop|status]
#

set script_dir = `dirname $0`
set backend_dir = "${script_dir}/backend"
set frontend_dir = "${script_dir}/frontend"
set pid_dir = "${script_dir}/.pids"

# Create directories if not exists
if (! -d $pid_dir) then
    mkdir -p $pid_dir
endif

if (! -d "${script_dir}/logs") then
    mkdir -p ${script_dir}/logs
endif

set backend_pid = "${pid_dir}/backend-dev.pid"
set frontend_pid = "${pid_dir}/frontend-dev.pid"

if ($#argv < 1) then
    set action = "start"
else
    set action = $1
endif

switch ($action)
    case "start":
        echo "🚀 Starting Workflow Automation (Development)"
        echo ""
        
        # Load development environment
        if (-f "${script_dir}/.env.development") then
            source ${script_dir}/switch-env.csh dev
        endif
        
        # Start backend dev server
        echo "🔧 Starting backend dev server..."
        cd $backend_dir
        nohup npm run dev > ${script_dir}/logs/backend-dev.log 2>&1 &
        echo $! > $backend_pid
        echo "   Backend PID: `cat $backend_pid`"
        
        # Start frontend dev server
        echo "🎨 Starting frontend dev server..."
        cd $frontend_dir
        nohup npm run dev > ${script_dir}/logs/frontend-dev.log 2>&1 &
        echo $! > $frontend_pid
        echo "   Frontend PID: `cat $frontend_pid`"
        
        echo ""
        echo "✅ Development servers started!"
        echo "   Backend:  http://localhost:${PORT:-3001}"
        echo "   Frontend: http://localhost:5173"
        echo ""
        echo "📝 Logs:"
        echo "   tail -f logs/backend-dev.log"
        echo "   tail -f logs/frontend-dev.log"
        echo ""
        echo "💡 Use './start-dev.csh stop' to stop the servers."
        breaksw
        
    case "stop":
        echo "🛑 Stopping Development Servers..."
        
        if (-f $backend_pid) then
            set pid = `cat $backend_pid`
            if (`ps -p $pid | wc -l` > 1) then
                kill $pid
                echo "   Stopped backend (PID: $pid)"
            endif
            rm -f $backend_pid
        endif
        
        if (-f $frontend_pid) then
            set pid = `cat $frontend_pid`
            if (`ps -p $pid | wc -l` > 1) then
                kill $pid
                echo "   Stopped frontend (PID: $pid)"
            endif
            rm -f $frontend_pid
        endif
        
        echo "✅ Development servers stopped."
        breaksw
        
    case "restart":
        $0 stop
        sleep 2
        $0 start
        breaksw
        
    case "status":
        echo "📊 Development Server Status"
        echo "───────────────────────────────────────"
        
        if (-f $backend_pid) then
            set pid = `cat $backend_pid`
            if (`ps -p $pid | wc -l` > 1) then
                echo "   Backend:  ✅ Running (PID: $pid)"
            else
                echo "   Backend:  ❌ Not running"
            endif
        else
            echo "   Backend:  ❌ Not running"
        endif
        
        if (-f $frontend_pid) then
            set pid = `cat $frontend_pid`
            if (`ps -p $pid | wc -l` > 1) then
                echo "   Frontend: ✅ Running (PID: $pid)"
            else
                echo "   Frontend: ❌ Not running"
            endif
        else
            echo "   Frontend: ❌ Not running"
        endif
        
        echo "───────────────────────────────────────"
        breaksw
        
    default:
        echo "❌ Unknown action: $action"
        echo "   Usage: $0 [start|stop|restart|status]"
        exit 1
endsw
