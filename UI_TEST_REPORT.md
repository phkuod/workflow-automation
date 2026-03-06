# UI Test Report — Workflow Automation Platform

**Test Date**: 2026-03-06
**Tester**: Claude (Chrome browser automation + code analysis)
**Frontend**: localhost:5173 | **Backend**: localhost:3001
**GIF Recording**: `ui-test-full-suite.gif` (downloaded)

---

## Suite Results Summary

| Suite | Description | Result | Issues Found |
|-------|------------|--------|-------------|
| 1 | Dashboard | ✅ PASS | 4 issues |
| 2 | Editor - Stage View | ✅ PASS | 1 issue |
| 3 | Editor - Step View | ✅ PASS | 2 issues |
| 4 | Save & Unsaved Changes | ✅ PASS | 1 issue |
| 5 | Simulation | ✅ PASS | 1 issue |
| 6 | Executions | ⚠️ PASS with issues | 2 issues |
| 7 | Monitoring | ✅ PASS | 0 issues |
| 8 | Sidebar Navigation | ✅ PASS | 0 issues |

**Total Issues Found: 11**

---

## Suite 1: Dashboard (/)

### 1.1 Page Load & Basic Display
- ✅ `/` correctly redirects to `/dashboard`
- ✅ 4 stat cards display: Total Workflows, Active, Paused, Draft
- ✅ Stat card numbers are consistent (Active + Paused + Draft = Total)
- ✅ Workflow table loads with correct data
- ✅ Sidebar navigation visible (Dashboard, Executions, Monitoring)

### 1.2 Create Workflow
- ✅ "New Workflow" button opens modal
- ✅ Modal has Workflow Name (required) and Description (optional)
- ✅ Successful creation redirects to Editor page
- ✅ New workflow appears in Dashboard list after returning
- ⚠️ **BUG: No validation error on empty name** — Clicking "Create" with empty name silently does nothing. No error message shown.

### 1.3 Workflow Operations
- ✅ **Activate**: Draft → Active status change works, button changes to Pause icon
- ✅ **Duplicate**: Creates copy with "(Copy)" suffix, correct station count
- ✅ **Export**: Download button present (not tested for file download)
- ✅ **Delete**: Shows confirmation dialog "Are you sure you want to delete this workflow?"

### 1.4 Import Workflow
- ⚠️ **BUG: Import errors use `alert()` instead of toast** (DashboardPage.tsx:125, :130)
  - `alert('Invalid workflow file')` and `alert('Failed to import workflow: Invalid JSON')`
  - Inconsistent with rest of app which uses toast notifications
  - `alert()` blocks the UI thread

### Potential Issues Checked
| Check | Result |
|-------|--------|
| Empty name submission blocked? | ✅ Yes, but ❌ no error message shown |
| Overflow on long names? | ⚠️ Not tested (needs manual long name) |
| Empty state (0 workflows)? | Not tested (workflows exist) |
| Import invalid JSON error? | ❌ Uses `alert()` not toast |
| Stats match list? | ✅ Consistent |
| Grammar: "1 station" | ❌ **BUG: Always shows "stations"** (DashboardPage.tsx:250) |

---

## Suite 2: Editor - Stage View

### 2.1 Stage Canvas
- ✅ Empty state shows "Get Started — Add a stage to begin building your workflow"
- ✅ "Add Stage" button opens naming modal
- ✅ Stage nodes display with name, step count, and "Edit Steps" button
- ✅ Connection arrows between sequential stages
- ✅ Multiple stages layout correctly (tested with 2 stages)

### 2.2 Station Config Panel
- ✅ Clicking a stage node opens "Configure Stage" panel on right
- ✅ Fields: Stage Name, Description, Execution Condition, Loop/Iterator
- ✅ Condition Type dropdown: "Always Run"
- ✅ Delete and Save buttons at bottom
- ✅ Selected stage highlighted with purple border

### 2.3 Navigation to Step View
- ✅ "Edit Steps >" button navigates to Step View
- ✅ Breadcrumb shows: `UI Test Workflow > Data Fetch Stage`

### Issues Found
- ⚠️ **No empty name validation for stage names** (same pattern as workflow creation)

---

## Suite 3: Editor - Step View

### 3.1 Node Library
- ✅ Left panel shows "Node Library" with search bar
- ✅ Station selector dropdown ("Add to Station")
- ✅ **12 node types** in 3 categories:
  - **Triggers** (3): Manual Trigger, Cron Trigger, Webhook Trigger
  - **Actions** (7): JavaScript, Python, HTTP Request, Set Variable, Send Email, Slack Message, Database Query
  - **Flow Control** (2): If/Else, Wait
- ✅ Categories are collapsible

### 3.2 Adding Steps
- ✅ Clicking node type opens "Add Step" modal with name input
- ✅ Step appears on canvas with correct icon and type label
- ✅ Connection handles (blue dots) on top and bottom

### 3.3 NodeConfigPanel - HTTP Request
- ✅ Step Name (editable)
- ✅ URL input with placeholder `https://api.example.com/data`
- ✅ Variable Picker icon (database icon) next to URL field
- ✅ Output Structure documentation shown
- ✅ Method dropdown (GET/POST/etc.)
- ✅ Request Headers section with "+ Add Header"
- ✅ Advanced Settings (collapsible)
- ✅ Retry Policy checkbox
- ✅ Delete / Save buttons

### 3.3 NodeConfigPanel - Database Query (Code Analysis)
- ✅ **Password field uses `type="password"`** — properly masked (NodeConfigPanel.tsx:731)
- ✅ Fields: DB Type, Host, Port, Name, User, Password, Query

### Issues Found
- ⚠️ **Simulation + Config + Node Library can all show simultaneously**, leaving very little canvas space
- ⚠️ **No cron expression validation** on frontend (known issue, confirmed by plan)

---

## Suite 4: Save & Unsaved Changes

### 4.1 Save Flow
- ✅ Unsaved changes indicated by `Save*` (asterisk) and yellow/orange button style
- ✅ Clicking Save removes asterisk, button returns to normal style
- ✅ Data persists after page reload (verified by returning to Dashboard)

### 4.2 Status Switching
- ✅ Draft dropdown visible in Editor toolbar
- ✅ Status changes reflected on Dashboard

### Issues Found
- ⚠️ **No toast notification on save success** — Save button changes silently from `Save*` to `Save` without visual confirmation

---

## Suite 5: Simulation

### 5.1 Execution
- ✅ "Simulate" button triggers simulation
- ✅ Simulation panel appears on right side
- ✅ Shows: Status badge (Completed), Success Rate, Duration, Stations count

### 5.2 Results
- ✅ Station Progress shows each stage with step completion (e.g., "1/1 steps")
- ✅ Green checkmarks for completed stations
- ✅ Execution Log section (showed "No logs available" for empty HTTP step)
- ✅ Step nodes get green border on success

### Issues Found
- ⚠️ **Panel overlap**: Simulation panel + Config panel + Node Library all visible simultaneously, cramping the canvas

---

## Suite 6: Executions Page

### 6.1 Page Load
- ✅ Table loads with execution count ("25 executions")
- ✅ Columns: Workflow, Status, Trigger, Started, Duration, Success
- ✅ Status badges: `completed` (green), `failed` (red)
- ✅ Refresh button in top-right

### 6.2 Expanded Detail
- ✅ Click expand arrow (>) shows Station Results
- ✅ Nested station → step hierarchy with individual statuses
- ✅ Step types shown (trigger-cron, script-js, etc.)
- ✅ Failed stations highlighted in red

### 6.3 Delete
- ❌ **BUG (HIGH): No confirmation dialog for execution deletion** — Trash icon deletes immediately
  - Unlike Dashboard workflow delete which has a confirmation modal
  - Risk of accidental data loss

### Issues Found
| Check | Result |
|-------|--------|
| Delete confirmation? | ❌ **No confirmation dialog** |
| Pagination? | ❌ **Hardcoded 50 limit, no pagination** |
| Empty state? | Not tested |

---

## Suite 7: Monitoring Page

### 7.1 Page Load
- ✅ 4 stat cards: Success Rate (56%), Server Uptime (6h 52m), Active Schedules (0), Memory Heap (17 MB)
- ✅ 3 info panels: Workflows breakdown, Executions breakdown, System info
- ✅ Execution Trend line chart (Last 7 Days) — shows completed vs failed over time
- ✅ Execution Results gauge/pie chart — Completed vs Failed

### 7.2 Data Consistency
- ✅ Workflows Total (8) matches Dashboard count
- ✅ Executions Total (25) matches Executions page count
- ✅ Active/Paused/Draft breakdown matches Dashboard cards

### 7.3 Auto-refresh
- ✅ "Last updated" timestamp shown
- ✅ Refresh button available

### Issues Found
- None observed during testing

---

## Suite 8: Sidebar Navigation

### 8.1 Navigation
- ✅ Dashboard, Executions, Monitoring links work
- ✅ Active page highlighted (blue text)
- ✅ Sidebar correctly hidden in Editor page

### 8.2 Collapse/Expand
- ✅ Toggle button collapses sidebar to icon-only mode
- ✅ Content area expands to use freed space
- ✅ Navigation icons still visible when collapsed
- ✅ Expand arrow (>) visible to restore

### 8.3 Responsive (Not tested)
- ⚠️ Could not resize browser window below minimum (Windows limitation with maximized window)

---

## All Issues Summary

### CRITICAL (Security)
| # | Issue | Location | Status |
|---|-------|----------|--------|
| 1 | `new Function()` + `with` for condition evaluation | Backend executionEngine | Known (from plan) |
| 2 | Python script injection risk | Backend scriptRunner | Known (from plan) |
| 3 | SSRF risk in HTTP request step | Backend executionEngine | Known (from plan) |

### HIGH (UX / Data Loss Risk)
| # | Issue | Location | Status |
|---|-------|----------|--------|
| 4 | **Execution delete has NO confirmation dialog** | Executions page | ❌ Confirmed |
| 5 | **Import errors use `alert()` instead of toast** | DashboardPage.tsx:125,:130 | ❌ Confirmed |
| 6 | **No validation error on empty workflow name** | Create Workflow modal | 🆕 New finding |

### MEDIUM (UX / Functionality)
| # | Issue | Location | Status |
|---|-------|----------|--------|
| 7 | **Grammar: "1 stations" instead of "1 station"** | DashboardPage.tsx:250 | 🆕 New finding |
| 8 | **No save success toast notification** | Editor Save button | 🆕 New finding |
| 9 | **Panel overlap in Step View** (Library + Config + Simulation) | Editor Step View | 🆕 New finding |
| 10 | No pagination for Executions | Executions page | Known (from plan) |
| 11 | No cron expression frontend validation | NodeConfigPanel | Known (from plan) |

### LOW (Polish)
| # | Issue | Location | Status |
|---|-------|----------|--------|
| 12 | No empty name validation for stages | Add Stage modal | 🆕 New finding |
| 13 | No search/filter on Dashboard | Dashboard | Known (from plan) |

---

## Recommendations (Priority Order)

1. **Add confirmation dialog to Execution delete** — Copy the pattern from Dashboard's workflow delete modal
2. **Replace `alert()` with toast** in import handler (DashboardPage.tsx:125,:130)
3. **Add validation error message** for empty workflow/stage names
4. **Fix grammar**: `${count} station${count !== 1 ? 's' : ''}` in DashboardPage.tsx:250
5. **Add save success toast** notification in Editor
6. **Auto-close panels** when Simulation starts (or stack them without overlap)
7. **Add cron expression validation** using a library like `cron-parser`
8. **Add pagination** to Executions page

---

## Test Artifacts

- **GIF Recording**: `ui-test-full-suite.gif` — 50 frames covering Dashboard → Editor → Simulation → Executions → Monitoring → Sidebar collapse
- **Test Workflow**: "UI Test Workflow" (Active, 2 stages: Data Fetch Stage + Processing Stage, 1 HTTP Request step)
