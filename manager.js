#!/usr/bin/env node
/**
 * Workflow Automation - Unified Manager Script
 * Replaces all .sh, .csh, and .ps1 execution scripts with a single cross-platform CLI tool.
 * 
 * Usage: node manager.js [command]
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const command = process.argv[2] || 'help';
const commandArgs = process.argv.slice(3);

// Directories
const ROOT_DIR = __dirname;
const BACKEND_DIR = path.join(ROOT_DIR, 'backend');
const FRONTEND_DIR = path.join(ROOT_DIR, 'frontend');

// Helper to run commands synchronously and stream output
function runCommand(cmd, cwd = ROOT_DIR, envAdditions = {}) {
    console.log(`\x1b[36m> [${cwd === ROOT_DIR ? 'root' : path.basename(cwd)}] ${cmd}\x1b[0m`);
    try {
        const env = { ...process.env, ...envAdditions };
        execSync(cmd, { cwd, stdio: 'inherit', env });
    } catch (error) {
        console.error(`\x1b[31mCommand failed: ${cmd}\x1b[0m`);
        process.exit(1);
    }
}

// Helper to copy environment files safely
function copyEnv(srcName, destDir) {
    const srcPath = path.join(ROOT_DIR, srcName);
    const destPath = path.join(destDir, '.env');
    if (!fs.existsSync(destPath) && fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
        console.log(`\x1b[33m[INFO] Copied ${srcName} to ${path.basename(destDir)}/.env\x1b[0m`);
    } else if (!fs.existsSync(srcPath)) {
        console.log(`\x1b[33m[WARN] Warning: ${srcName} not found in root directory\x1b[0m`);
    }
}

// Ensure basic directories exist
function ensureDirs() {
    ['logs', '.pids'].forEach(dir => {
        const fullPath = path.join(ROOT_DIR, dir);
        if (!fs.existsSync(fullPath)) fs.mkdirSync(fullPath);
    });
}

// The core commands available
const commands = {
    setup: () => {
        console.log('\x1b[32m[*] Setting up Workflow Automation...\x1b[0m');
        runCommand('npm install', ROOT_DIR);
        runCommand('npm install', BACKEND_DIR);
        runCommand('npm install', FRONTEND_DIR);
        copyEnv('.env.development', BACKEND_DIR);
        copyEnv('.env.development', FRONTEND_DIR);
        ensureDirs();
        console.log('\x1b[32m[DONE] Setup complete.\x1b[0m');
    },

    dev: () => {
        console.log('\x1b[32m[START] Starting Development Servers...\x1b[0m');
        copyEnv('.env.development', BACKEND_DIR);
        copyEnv('.env.development', FRONTEND_DIR);
        ensureDirs();
        // Uses concurrently defined in package.json to run both dev servers
        runCommand('npx concurrently "npm run dev:backend" "npm run dev:frontend"', ROOT_DIR);
    },

    build: () => {
        console.log('\x1b[33m[CLEAN] Cleaning old builds...\x1b[0m');
        fs.rmSync(path.join(FRONTEND_DIR, 'dist'), { recursive: true, force: true });
        fs.rmSync(path.join(BACKEND_DIR, 'dist'), { recursive: true, force: true });
        fs.rmSync(path.join(BACKEND_DIR, 'public'), { recursive: true, force: true });
        fs.mkdirSync(path.join(BACKEND_DIR, 'public'), { recursive: true });
        
        console.log('\x1b[32m[BUILD] Building frontend (Vite -> static files)...\x1b[0m');
        runCommand('npm run build:frontend', ROOT_DIR);
        
        console.log('\x1b[32m[MERGE] Merging frontend static assets into backend...\x1b[0m');
        fs.cpSync(path.join(FRONTEND_DIR, 'dist'), path.join(BACKEND_DIR, 'public'), { recursive: true });
        
        console.log('\x1b[32m[BUILD] Building backend (TypeScript -> JavaScript)...\x1b[0m');
        runCommand('npm run build:backend', ROOT_DIR);
        
        console.log('\x1b[32m[DONE] Production Build Successful.\x1b[0m');
    },

    prod: () => {
        console.log('\x1b[32m[START] Starting Production Server...\x1b[0m');
        copyEnv('.env.production', BACKEND_DIR);
        ensureDirs();
        
        // Check if build exists, if not, warn the user
        if (!fs.existsSync(path.join(BACKEND_DIR, 'dist')) || !fs.existsSync(path.join(BACKEND_DIR, 'public'))) {
            console.log('\x1b[33m[WARN] Warning: It looks like the project hasn\'t been built yet. Running build first...\x1b[0m');
            commands.build();
        }
        
        console.log('\x1b[32m[RUN] Running backend server...\x1b[0m');
        runCommand('npm start', BACKEND_DIR, { NODE_ENV: 'production' });
    },

    clean: () => {
        console.log('\x1b[33m[CLEAN] Deep Cleaning...\x1b[0m');
        const dirsToClean = [
            path.join(ROOT_DIR, 'node_modules'),
            path.join(BACKEND_DIR, 'node_modules'),
            path.join(FRONTEND_DIR, 'node_modules'),
            path.join(FRONTEND_DIR, 'dist'),
            path.join(BACKEND_DIR, 'dist'),
            path.join(BACKEND_DIR, 'public'),
        ];
        
        dirsToClean.forEach(d => {
            if (fs.existsSync(d)) {
                console.log(`   Removing ${path.relative(ROOT_DIR, d)}...`);
                fs.rmSync(d, { recursive: true, force: true });
            }
        });
        console.log('\x1b[32m[DONE] Clean complete. Run "npm run setup" to reinstall.\x1b[0m');
    },

    preflight: () => {
        console.log('\x1b[36m[PREFLIGHT] Checking environment...\x1b[0m');
        const reqs = [
            { cmd: 'node -v', name: 'Node.js' },
            { cmd: 'npm -v', name: 'npm' },
            { cmd: 'git --version', name: 'Git' }
        ];
        let errors = 0;
        for (const req of reqs) {
            try {
                const out = execSync(req.cmd, { stdio: 'pipe' }).toString().trim();
                console.log(`\x1b[32m[OK]\x1b[0m ${req.name}: ${out}`);
            } catch (e) {
                console.log(`\x1b[31m[ERROR]\x1b[0m ${req.name} not found or failed.`);
                errors++;
            }
        }
        if (errors > 0) {
            console.error('\x1b[31m[FAIL] Preflight checks failed.\x1b[0m');
            process.exit(1);
        } else {
            console.log('\x1b[32m[OK] All preflight checks passed.\x1b[0m');
        }
    },

    deploy: () => {
        const target = commandArgs[0] || '';
        console.log(`\x1b[36m[DEPLOY] Deploying Workflow Automation ${target ? `(Target: ${target})` : ''}...\x1b[0m`);
        commands.preflight();
        
        console.log('\x1b[34m[GIT] Syncing source code...\x1b[0m');
        if (target) {
            runCommand('git fetch --all --tags --prune');
            try {
                runCommand(`git checkout ${target}`);
            } catch (e) {
                runCommand(`git checkout -b ${target} origin/${target}`);
            }
            runCommand(`git pull origin ${target}`);
        } else {
            runCommand('git pull');
        }

        console.log('\x1b[34m[NPM] Installing dependencies...\x1b[0m');
        commands.setup();

        console.log('\x1b[34m[BUILD] Building application...\x1b[0m');
        commands.build();

        console.log('\x1b[32m[DONE] Deployment steps complete. You can now use "npm run prod" to start.\x1b[0m');
    },

    status: () => {
        console.log('\x1b[36m[STATUS] System Status:\x1b[0m');
        try {
            const version = require('./package.json').version;
            const branch = execSync('git branch --show-current', { stdio: 'pipe' }).toString().trim();
            const sha = execSync('git rev-parse --short HEAD', { stdio: 'pipe' }).toString().trim();
            console.log(`  Version: v${version} (${sha})`);
            console.log(`  Branch:  ${branch}`);
        } catch (e) {
            console.log('  \x1b[31Error fetching git status.\x1b[0m');
        }
        
        // Basic process check for node manager (less comprehensive than a PM2/Docker wrapper)
        console.log(`  Backend Dist: ${fs.existsSync(path.join(BACKEND_DIR, 'dist', 'index.js')) ? '\x1b[32mReady\x1b[0m' : '\x1b[31mMissing\x1b[0m'}`);
        console.log(`  Database:     ${fs.existsSync(path.join(ROOT_DIR, 'data', 'workflow.db')) ? '\x1b[32mPresent\x1b[0m' : '\x1b[33mNot Created Yet\x1b[0m'}`);
    },

    backup: () => {
        console.log('\x1b[36m[BACKUP] Creating backup of current build and database...\x1b[0m');
        const backupDir = path.join(ROOT_DIR, '.rollback');
        if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

        // Backup build artifacts
        const backDist = path.join(BACKEND_DIR, 'dist');
        if (fs.existsSync(backDist)) {
            try {
                const sha = execSync('git rev-parse HEAD', { stdio: 'pipe' }).toString().trim();
                fs.writeFileSync(path.join(backupDir, 'git-sha'), sha);
                const version = require('./package.json').version;
                fs.writeFileSync(path.join(backupDir, 'version'), version);
                
                fs.rmSync(path.join(backupDir, 'backend-dist'), { recursive: true, force: true });
                fs.cpSync(backDist, path.join(backupDir, 'backend-dist'), { recursive: true });
                console.log('\x1b[32m[OK]\x1b[0m Build artifacts backed up.');
            } catch (e) {
                console.log('\x1b[33m[WARN]\x1b[0m Error backing up build artifacts.', e.message);
            }
        }

        // Backup DB
        const dbPath = process.env.DB_PATH || path.join(ROOT_DIR, 'data', 'workflow.db');
        if (fs.existsSync(dbPath)) {
            const dbBackupDir = path.join(backupDir, 'db');
            if (!fs.existsSync(dbBackupDir)) fs.mkdirSync(dbBackupDir, { recursive: true });
            
            const timestamp = new Date().toISOString().replace(/[:.-]/g, '');
            const backupFile = path.join(dbBackupDir, `workflow_${timestamp}.db`);
            fs.copyFileSync(dbPath, backupFile);
            console.log(`\x1b[32m[OK]\x1b[0m Database backed up to ${path.basename(backupFile)}`);
            
            // Cleanup old backups (keep last 5)
            const files = fs.readdirSync(dbBackupDir)
                .map(f => ({ name: f, time: fs.statSync(path.join(dbBackupDir, f)).mtime.getTime() }))
                .sort((a, b) => b.time - a.time);
            
            if (files.length > 5) {
                files.slice(5).forEach(f => {
                    fs.rmSync(path.join(dbBackupDir, f.name));
                });
            }
        }
    },

    rollback: () => {
        console.log('\x1b[31m[ROLLBACK] Rolling back to previous build...\x1b[0m');
        const backupDir = path.join(ROOT_DIR, '.rollback');
        const backupDist = path.join(backupDir, 'backend-dist');
        
        if (!fs.existsSync(backupDist)) {
            console.error('\x1b[31m[ERROR] No backup found. Cannot rollback.\x1b[0m');
            process.exit(1);
        }

        const backDist = path.join(BACKEND_DIR, 'dist');
        fs.rmSync(backDist, { recursive: true, force: true });
        fs.cpSync(backupDist, backDist, { recursive: true });
        
        let rbVersion = '?';
        if (fs.existsSync(path.join(backupDir, 'version'))) {
            rbVersion = fs.readFileSync(path.join(backupDir, 'version'), 'utf-8').trim();
        }
        
        console.log(`\x1b[32m[OK]\x1b[0m Rollback complete. Restored version: ${rbVersion}`);
        console.log(`\x1b[33m[INFO]\x1b[0m Run "npm run prod" to start the restored version.`);
    },

    smoke: () => {
        console.log('\x1b[36m[SMOKE] Running basic health checks...\x1b[0m');
        const port = process.env.PORT || 3001;
        const endpoints = ['/api/health', '/api/workflows'];
        const http = require('http');

        let errors = 0;
        let checksPending = endpoints.length;

        endpoints.forEach(ep => {
            const req = http.get(`http://localhost:${port}${ep}`, (res) => {
                if (res.statusCode === 200) {
                    console.log(`\x1b[32m[OK]\x1b[0m GET ${ep} - 200 OK`);
                } else {
                    console.log(`\x1b[31m[FAIL]\x1b[0m GET ${ep} - ${res.statusCode}`);
                    errors++;
                }
                res.resume(); // consume response body
                checksPending--;
                if (checksPending === 0) finishSmoke(errors);
            }).on('error', (e) => {
                console.log(`\x1b[31m[FAIL]\x1b[0m GET ${ep} - Error: ${e.message}`);
                errors++;
                checksPending--;
                if (checksPending === 0) finishSmoke(errors);
            });
            req.setTimeout(5000, () => {
                req.destroy();
                console.log(`\x1b[31m[FAIL]\x1b[0m GET ${ep} - Timeout`);
                errors++;
                checksPending--;
                if (checksPending === 0) finishSmoke(errors);
            });
        });

        function finishSmoke(errCount) {
            if (errCount > 0) {
                console.error(`\x1b[31m[FAIL] Smoke tests failed (${errCount} errors).\x1b[0m`);
            } else {
                console.log('\x1b[32m[OK] All smoke tests passed.\x1b[0m');
            }
        }
    },

    help: () => {
        console.log(`
\x1b[36m═══════════════════════════════════════════════════════════\x1b[0m
\x1b[36m   Workflow Automation - Unified Manager Script\x1b[0m
\x1b[36m═══════════════════════════════════════════════════════════\x1b[0m

Usage: \x1b[32mnode manager.js [command]\x1b[0m
   OR  \x1b[32mnpm run [command]\x1b[0m (if configured in package.json)

Commands:
  \x1b[33msetup\x1b[0m     - Install all npm dependencies and setup environments
  \x1b[33mdev\x1b[0m       - Start frontend and backend concurrently in development mode
  \x1b[33mbuild\x1b[0m     - Build frontend, merge static assets, and compile backend
  \x1b[33mprod\x1b[0m      - Start the compiled production server
  \x1b[33mclean\x1b[0m     - Remove all node_modules and build directories
  \x1b[33mpreflight\x1b[0m - Validate server environment (Node, npm, git)
  \x1b[33mdeploy\x1b[0m    - Full deployment pipeline: git sync, npm install, build
  \x1b[33mstatus\x1b[0m    - Check Git branch, SHA, and basic build status
  \x1b[33mbackup\x1b[0m    - Backup current build and database
  \x1b[33mrollback\x1b[0m  - Restore previous build
  \x1b[33msmoke\x1b[0m     - Run smoke tests against local server
        `);
    }
};

if (commands[command]) {
    commands[command]();
} else {
    console.error(`\x1b[31m[ERROR] Unknown command: ${command}\x1b[0m`);
    commands.help();
    process.exit(1);
}
