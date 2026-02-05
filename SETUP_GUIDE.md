# Setup Guide

This guide provides detailed instructions for setting up the Workflow Automation System development environment.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: Version 18 or higher is required. [Download Node.js](https://nodejs.org/)
- **Python**: Version 3.x is required for executing Python script nodes. [Download Python](https://www.python.org/downloads/)
- **Git**: For version control. [Download Git](https://git-scm.com/)

## Installation

1.  **Clone the repository:**

    ```bash
    git clone <repository_url>
    cd workflow-automation
    ```

2.  **Install Backend Dependencies:**

    ```bash
    cd backend
    npm install
    ```

3.  **Install Frontend Dependencies:**

    ```bash
    cd ../frontend
    npm install
    ```

## Environment Configuration

### Backend

The backend uses defaults or searches for a `.env` file.  
Create a `.env` file in the `backend` directory if you need to override defaults (e.g., PORT).

Example `backend/.env`:

```env
PORT=3001
# Add other backend configurations here
```

### Frontend

The frontend uses Vite and requires environment variables for API configuration.
Copy `.env.example` to `.env` in the `frontend` directory:

```bash
cd frontend
cp .env.example .env
```

Ensure `frontend/.env` contains:

```env
VITE_API_URL=http://localhost:3001
```

## Running the Application

You can run the frontend and backend servers separately or concurrently.

### Option 1: Quick Start Scripts (Recommended)

**On Linux/macOS:**

```bash
# Make the script executable (first time only)
chmod +x start-dev.sh

# Start the servers
./start-dev.sh

# Other commands
./start-dev.sh stop     # Stop all servers
./start-dev.sh restart  # Restart servers
./start-dev.sh status   # Check server status
```

**On Windows (PowerShell):**

```powershell
.\start-dev.ps1
```

### Option 2: Separate Terminals

**Backend:**
Open a terminal in the `backend` directory:

```bash
npm run dev
```

The backend server will start at `http://localhost:3001`.

**Frontend:**
Open a terminal in the `frontend` directory:

```bash
npm run dev
```

The frontend application will be available at `http://localhost:5173`.

### Option 2: Concurrently (Root)

If you have installed dependencies in the root (optional), you can run both with one command:

```bash
# In the root directory
npm install # if not already done
npm run dev
```

## Troubleshooting

- **Port Conflicts**:
  - If port 3001 (Backend) or 5173 (Frontend) is in use, verify your `.env` settings or kill the process using those ports.
- **Database Issues**:
  - The application uses SQLite. If you encounter database errors, try deleting the `database.sqlite` file in the backend directory (it will be recreated automatically).
- **Python Script Failures**:
  - Ensure `python` or `python3` is in your system PATH. The backend attempts to spawn a python process for Python nodes.
