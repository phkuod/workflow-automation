# Workflow Automation System

A complete workflow automation platform with a visual editor, execution engine, and dashboard.

## Features

- **Two-layer Architecture**: Stations (groups) + Steps (individual tasks)
- **Visual Workflow Editor**: Drag-and-drop canvas powered by React Flow
- **Node Library**: Manual Trigger, Cron, JavaScript, Python, HTTP Request, If/Else, Set Variable
- **Execution Engine**: Sequential execution with fail-fast behavior
- **Simulation & Debugging**: Run workflows and view detailed execution logs
- **SQLite Database**: Persistent storage for workflows and execution history

## Tech Stack

### Backend

- Node.js + Express + TypeScript
- SQLite (better-sqlite3)
- VM-based JavaScript execution
- Python subprocess execution

### Frontend

- React 18 + TypeScript
- React Flow (workflow canvas)
- Zustand (state management)
- Vite (build tool)
- Lucide React (icons)

## Documentation

- **[Project Overview](PROJECT_OVERVIEW.md)**: Mission, usage, and architecture.
- **[Setup Guide](SETUP_GUIDE.md)**: Installation, configuration, and running the application.

## Quick Start

For detailed instructions, please refer to the [Setup Guide](SETUP_GUIDE.md).

### Prerequisites

- Node.js 18+
- Python 3.x (for Python script nodes)

### Installation & Run

```bash
# Install root dependencies (optional, but recommended for concurrent running)
npm install

# Run both frontend and backend concurrently
npm run dev
```

### Access

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3002

## API Endpoints

### Workflows

- `GET /api/workflows` - List all workflows
- `POST /api/workflows` - Create a new workflow
- `GET /api/workflows/:id` - Get workflow by ID
- `PUT /api/workflows/:id` - Update workflow
- `DELETE /api/workflows/:id` - Delete workflow
- `POST /api/workflows/:id/execute` - Execute workflow
- `POST /api/workflows/:id/simulate` - Simulate workflow
- `GET /api/workflows/:id/executions` - Get execution history

### Executions

- `GET /api/executions` - List all executions
- `GET /api/executions/:id` - Get execution by ID
- `GET /api/executions/:id/logs` - Get execution logs
- `DELETE /api/executions/:id` - Delete execution

## Project Structure

```
workflow-automation/
├── backend/
│   ├── src/
│   │   ├── db/          # Database setup
│   │   ├── models/      # Data models
│   │   ├── routes/      # API routes
│   │   ├── services/    # Business logic
│   │   ├── types/       # TypeScript types
│   │   ├── app.ts       # Express app
│   │   └── index.ts     # Entry point
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/         # API client
│   │   ├── components/
│   │   │   ├── Editor/  # Canvas editor components
│   │   │   ├── Nodes/   # React Flow node components
│   │   │   └── common/  # Shared components
│   │   ├── pages/       # Dashboard, Editor pages
│   │   ├── stores/      # Zustand stores
│   │   └── types/       # TypeScript types
│   └── package.json
└── package.json
```

## Usage

1. Open the Dashboard at http://localhost:5173
2. Click "New Workflow" to create a workflow
3. Add a Station (a group of steps)
4. Add Steps from the Node Library:
   - **Manual Trigger**: Start the workflow manually
   - **JavaScript**: Run custom JS code
   - **Python**: Run Python scripts
   - **HTTP Request**: Make API calls
   - **If/Else**: Conditional branching
   - **Set Variable**: Store values
5. Configure each step by clicking on it
6. Click "Save" to save the workflow
7. Click "Simulate" to test the workflow

## Data Flow

Steps can pass data to each other using variable expressions:

```javascript
// Access previous step output
${step1.output.data}

// Access station aggregated output
${station1.output.stepResults}

// Environment variables
${env.API_KEY}
```

## License

MIT
