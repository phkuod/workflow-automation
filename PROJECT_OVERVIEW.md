# Project Overview

## Mission

The **Workflow Automation System** is designed to provide a powerful yet accessible platform for automating complex tasks. It bridges the gap between simple linear automation and complex scripting by offering a visual editor backed by a robust execution engine that supports multi-language scripting (JavaScript, Python) and conditional logic.

## Architecture

The system follows a modern client-server architecture:

```mermaid
graph TD
    Client[Frontend (React/Vite)]
    Server[Backend (Node/Express)]
    DB[(SQLite Database)]
    Engine[Execution Engine]

    Client -- API Requests --> Server
    Server -- Reads/Writes --> DB
    Server -- Spawns --> Engine
    Engine -- Executes --> Scripts[JS/Python Scripts]
    Engine -- Updates --> DB
```

- **Frontend**: A React-based Single Page Application (SPA) using React Flow for the visual workflow editor. It manages state via Zustand and communicates with the backend via REST APIs.
- **Backend**: A Node.js Express server that manages workflow CRUD operations, execution triggers, and persists data.
- **Database**: SQLite is used for simplicity and portability, storing workflow definitions (`Workflow`), execution history (`Execution`), and logs.
- **Execution Engine**: A dedicated component within the backend responsible for traversing the workflow graph, executing steps sequentially, and managing data flow between steps.

## Key Features

1.  **Visual Workflow Builder**:
    - Drag-and-drop interface.
    - Support for "Stations" (logical groups of steps).
    - Real-time validation.

2.  **Diverse Step Library**:
    - **Manual Trigger**: User-initiated workflows.
    - **Scripting**: Execute custom JavaScript (sandboxed) or Python code.
    - **HTTP Request**: Interact with external APIs.
    - **Logic**: If/Else branching for conditional execution.
    - **Variables**: Set and manipulate workflow variables.

3.  **Robust Execution**:
    - Step-by-step execution tracking.
    - Detailed logging of stdout/stderr for scripts.
    - Input/Output variable mapping between steps (`${step.output}`).

4.  **Simulation & Testing**:
    - "Simulate" mode to test workflows directly in the editor before saving.
    - View live execution logs and variable states.

## Technology Stack

| Component    | Technology     | Description                     |
| :----------- | :------------- | :------------------------------ |
| **Frontend** | React 18       | UI Library                      |
|              | TypeScript     | Type Safety                     |
|              | React Flow     | Node-based graph editor         |
|              | Vite           | Build tool and dev server       |
|              | Zustand        | State Management                |
|              | Tailwind CSS   | Utility-first styling (implied) |
| **Backend**  | Node.js        | Runtime                         |
|              | Express        | Web Framework                   |
|              | TypeScript     | Type Safety                     |
|              | better-sqlite3 | SQLite driver                   |
|              | vm2 / vm       | Sandboxed JS execution          |

## Operations & CLI

The project is managed via a unified, cross-platform Node.js script (`manager.js`). This eliminates the need for OS-specific shell or PowerShell scripts.

You can run these commands via `npm`:

```bash
# First-time setup (Installs dependencies and initializes .env files)
npm run setup

# Start local development servers (Frontend & Backend concurrently)
npm run dev

# Build the project for production
npm run build

# Start the production server (Frontend served by Backend)
npm run prod

# Deep clean node_modules and build artifacts
npm run clean
```

For advanced server deployments, `manager.js` also provides `preflight`, `deploy`, `backup`, `rollback`, `smoke`, and `status` capabilities (accessible via `node manager.js [cmd]`).

## Future Roadmap

- **Authentication**: Multi-user support.
- **More Nodes**: Database connectors, email triggers, webhook triggers.
- **Scheduled Workflows**: Cron-based triggering (e.g., "Run every morning").
- **Deployment**: Docker containerization.
